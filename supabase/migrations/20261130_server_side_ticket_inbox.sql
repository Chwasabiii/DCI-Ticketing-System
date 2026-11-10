begin;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create index if not exists tickets_title_trigram_idx
  on public.tickets using gin (lower(title) extensions.gin_trgm_ops);
create index if not exists tickets_number_trigram_idx
  on public.tickets using gin (lower(ticket_no) extensions.gin_trgm_ops);
create index if not exists tickets_status_created_id_idx
  on public.tickets (status, created_at desc, id desc);
create index if not exists tickets_team_status_created_id_idx
  on public.tickets (service_team_id, status, created_at desc, id desc);
create index if not exists tickets_assignee_status_created_id_idx
  on public.tickets (assigned_to, status, created_at desc, id desc);

create or replace function public.search_ticket_inbox(
  p_service_team_id bigint default null,
  p_view text default 'all',
  p_status text default null,
  p_priority text default null,
  p_needs_priority_review boolean default false,
  p_search text default null
)
returns setof public.tickets
language sql
stable
security invoker
set search_path = ''
as $$
  with search_input as (
    select
      nullif(btrim(left(coalesce(p_search, ''), 100)), '') as term,
      replace(
        replace(
          replace(btrim(left(coalesce(p_search, ''), 100)), E'\\', E'\\\\'),
          '%', E'\\%'
        ),
        '_', E'\\_'
      ) as pattern
  )
  select ticket.*
  from public.tickets ticket
  cross join search_input
  where (p_service_team_id is null or ticket.service_team_id = p_service_team_id)
    and (
      (p_view in ('all', 'unassigned', 'mine', 'overdue')
        and ticket.status::text in ('open', 'under_review', 'assigned', 'in_progress', 'waiting_for_info'))
      or (p_view = 'resolved' and ticket.status::text in ('resolved', 'closed'))
    )
    and (p_view <> 'unassigned' or ticket.assigned_to is null)
    and (p_view <> 'mine' or ticket.assigned_to = auth.uid())
    and (
      p_view <> 'overdue'
      or case
        when ticket.ccg_request_type is not null then
          ticket.status::text <> 'waiting_for_info'
          and ticket.ccg_stage_due_at is not null
          and ticket.ccg_stage_due_at < now()
        else exists (
          select 1
          from public.ticket_sla_policies policy
          where policy.priority_group = case
            when ticket.priority::text in ('high', 'urgent') then 'high'
            else 'standard'
          end
          and (
            (ticket.first_response_at is null
              and now() >= public.add_sla_business_days(
                coalesce(ticket.reopened_at, ticket.created_at),
                policy.first_response_business_days
              ))
            or (ticket.first_response_at is not null
              and ticket.first_response_at > public.add_sla_business_days(
                coalesce(ticket.reopened_at, ticket.created_at),
                policy.first_response_business_days
              ))
            or (ticket.resolved_at is null
              and ticket.status::text not in ('resolved', 'closed', 'rejected')
              and now() >= public.add_sla_business_days(
                coalesce(ticket.reopened_at, ticket.created_at),
                policy.resolution_business_days
              ))
            or (ticket.resolved_at is not null
              and ticket.resolved_at > public.add_sla_business_days(
                coalesce(ticket.reopened_at, ticket.created_at),
                policy.resolution_business_days
              ))
          )
        )
      end
    )
    and (p_status is null or ticket.status::text = p_status)
    and (p_priority is null or ticket.priority::text = p_priority)
    and (
      not p_needs_priority_review
      or (
        ticket.priority_reviewed_at is null
        and (ticket.reported_impact = 'high' or ticket.reported_urgency = 'high')
      )
    )
    and (
      search_input.term is null
      or lower(ticket.title) like '%' || lower(search_input.pattern) || '%' escape E'\\'
      or lower(ticket.ticket_no) like '%' || lower(search_input.pattern) || '%' escape E'\\'
    )
  order by ticket.created_at desc, ticket.id desc;
$$;

revoke all on function public.search_ticket_inbox(bigint, text, text, text, boolean, text) from public, anon;
grant execute on function public.search_ticket_inbox(bigint, text, text, text, boolean, text) to authenticated;

commit;
