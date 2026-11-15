begin;

create table public.ticket_retention (
  ticket_id bigint primary key references public.tickets(id) on delete cascade,
  archived_at timestamptz not null default now(),
  delete_after timestamptz not null,
  created_at timestamptz not null default now(),
  constraint ticket_retention_delete_after_check check (delete_after > archived_at)
);

create index ticket_retention_delete_after_idx
  on public.ticket_retention (delete_after);

alter table public.ticket_retention enable row level security;
revoke all on public.ticket_retention from public, anon;
grant select on public.ticket_retention to authenticated;
create policy "ticket retention read visible tickets"
  on public.ticket_retention for select to authenticated
  using (public.can_view_ticket(ticket_id));

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
  from public.tickets as ticket
  cross join search_input
  where (p_service_team_id is null or ticket.service_team_id = p_service_team_id)
    and not exists (
      select 1 from public.ticket_retention as retention where retention.ticket_id = ticket.id
    )
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
          from public.ticket_sla_policies as policy
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

create or replace function public.ticket_reopen_deadline(
  p_priority public.ticket_priority,
  p_resolved_at timestamptz,
  p_closed_at timestamptz
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_resolved_at, p_closed_at)
    + case when p_priority = 'urgent'::public.ticket_priority
      then interval '30 days'
      else interval '15 days'
    end;
$$;
revoke all on function public.ticket_reopen_deadline(public.ticket_priority, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.ticket_reopen_deadline(public.ticket_priority, timestamptz, timestamptz) to postgres;

create or replace function public.reopen_own_ticket(p_ticket_id bigint, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reopened_ticket_id bigint;
  clean_reason text := btrim(coalesce(p_reason, ''));
begin
  if public.current_side() <> 'client' or char_length(clean_reason) < 5 or char_length(clean_reason) > 1000 then
    return false;
  end if;

  update public.tickets as ticket
  set status = 'open', resolved_at = null, closed_at = null, due_date = null,
      first_response_at = null, reopened_at = now(),
      ccg_database_result = null, ccg_followup_type = null, ccg_followup_status = null
  where ticket.id = p_ticket_id
    and ticket.requester_id = auth.uid()
    and ticket.status in ('resolved', 'closed')
    and now() < public.ticket_reopen_deadline(ticket.priority, ticket.resolved_at, ticket.closed_at)
    and not exists (
      select 1 from public.ticket_retention as retention where retention.ticket_id = ticket.id
    )
  returning ticket.id into reopened_ticket_id;

  if reopened_ticket_id is null then return false; end if;

  insert into public.ticket_comments (ticket_id, author_id, body, is_internal)
  values (reopened_ticket_id, auth.uid(), 'Reopen reason: ' || clean_reason, false);
  return true;
end;
$$;
revoke all on function public.reopen_own_ticket(bigint, text) from public, anon;
grant execute on function public.reopen_own_ticket(bigint, text) to authenticated;

create or replace function public.prevent_completed_ticket_status_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('resolved', 'closed') and new.status is distinct from old.status then
    if public.current_side() = 'client'
       and old.requester_id = auth.uid()
       and new.reopened_at is not null
       and new.status = 'open'
       and now() < public.ticket_reopen_deadline(old.priority, old.resolved_at, old.closed_at)
       and not exists (
         select 1 from public.ticket_retention as retention where retention.ticket_id = old.id
       ) then
      return new;
    end if;

    if public.current_side() = 'client'
       and old.requester_id = auth.uid()
       and old.status = 'resolved'
       and new.status = 'closed' then
      return new;
    end if;

    raise exception 'This ticket is complete or its reopen window has ended.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function public.prevent_completed_ticket_status_changes() from public, anon, authenticated;

create or replace function public.archive_resolved_tickets()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_count integer;
begin
  insert into public.ticket_retention (ticket_id, archived_at, delete_after)
  select ticket.id, now(), now() + interval '12 months'
  from public.tickets as ticket
  where ticket.status in ('resolved', 'closed')
    and coalesce(ticket.resolved_at, ticket.closed_at) <= now() - interval '6 months'
    and not exists (
      select 1 from public.ticket_retention as retention where retention.ticket_id = ticket.id
    )
  on conflict (ticket_id) do nothing;

  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;
revoke all on function public.archive_resolved_tickets() from public, anon, authenticated;
grant execute on function public.archive_resolved_tickets() to postgres;

select public.archive_resolved_tickets();

do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'archive-resolved-tickets-daily';

    perform cron.schedule(
      'archive-resolved-tickets-daily',
      '0 2 * * *',
      'select public.archive_resolved_tickets();'
    );
  end if;
end;
$$;

commit;
