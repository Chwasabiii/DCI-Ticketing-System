begin;

create or replace function public.get_service_dashboard_metrics(p_service_team_id bigint default null)
returns table (
  total bigint,
  open_total bigint,
  unassigned bigint,
  assigned_to_me bigint,
  awaiting_user bigint,
  resolved_this_week bigint,
  overdue bigint,
  average_first_response_hours numeric,
  average_resolution_days numeric,
  categories jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped_tickets as (
    select ticket.*
    from public.tickets ticket
    where p_service_team_id is null or ticket.service_team_id = p_service_team_id
  ),
  category_counts as (
    select categories.category, count(distinct scoped_tickets.id) as ticket_count
    from scoped_tickets
    cross join lateral unnest(
      case
        when scoped_tickets.ccg_request_type is not null then
          coalesce(
            nullif(scoped_tickets.ccg_request_types, '{}'::text[]),
            array[scoped_tickets.ccg_request_type]
          )
        else array[scoped_tickets.service_category]
      end
    ) as categories(category)
    where scoped_tickets.status::text not in ('resolved', 'closed', 'rejected')
    group by categories.category
  )
  select
    count(*) as total,
    count(*) filter (
      where scoped_tickets.status::text not in ('resolved', 'closed', 'rejected')
    ) as open_total,
    count(*) filter (
      where scoped_tickets.status::text not in ('resolved', 'closed', 'rejected')
        and scoped_tickets.assigned_to is null
    ) as unassigned,
    count(*) filter (
      where scoped_tickets.status::text not in ('resolved', 'closed', 'rejected')
        and scoped_tickets.assigned_to = auth.uid()
    ) as assigned_to_me,
    count(*) filter (
      where scoped_tickets.status::text = 'waiting_for_info'
    ) as awaiting_user,
    count(*) filter (
      where scoped_tickets.status::text in ('resolved', 'closed')
        and scoped_tickets.resolved_at >= (
          date_trunc('week', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'
        )
        and scoped_tickets.resolved_at < (
          (date_trunc('week', now() at time zone 'Asia/Manila') + interval '1 week')
          at time zone 'Asia/Manila'
        )
    ) as resolved_this_week,
    count(*) filter (
      where scoped_tickets.status::text not in ('resolved', 'closed', 'rejected')
        and case
          when scoped_tickets.ccg_request_type is not null then
            scoped_tickets.status::text <> 'waiting_for_info'
            and scoped_tickets.ccg_stage_due_at is not null
            and scoped_tickets.ccg_stage_due_at < now()
          else exists (
            select 1
            from public.ticket_sla_policies policy
            where policy.priority_group = case
              when scoped_tickets.priority::text in ('high', 'urgent') then 'high'
              else 'standard'
            end
            and (
              (
                scoped_tickets.first_response_at is null
                and now() >= public.add_sla_business_days(
                  coalesce(scoped_tickets.reopened_at, scoped_tickets.created_at),
                  policy.first_response_business_days
                )
              )
              or (
                scoped_tickets.first_response_at is not null
                and scoped_tickets.first_response_at > public.add_sla_business_days(
                  coalesce(scoped_tickets.reopened_at, scoped_tickets.created_at),
                  policy.first_response_business_days
                )
              )
              or (
                scoped_tickets.resolved_at is null
                and now() >= public.add_sla_business_days(
                  coalesce(scoped_tickets.reopened_at, scoped_tickets.created_at),
                  policy.resolution_business_days
                )
              )
              or (
                scoped_tickets.resolved_at is not null
                and scoped_tickets.resolved_at > public.add_sla_business_days(
                  coalesce(scoped_tickets.reopened_at, scoped_tickets.created_at),
                  policy.resolution_business_days
                )
              )
            )
          )
        end
    ) as overdue,
    avg(
      extract(epoch from (scoped_tickets.first_response_at - scoped_tickets.created_at)) / 3600
    ) filter (where scoped_tickets.first_response_at is not null) as average_first_response_hours,
    avg(
      extract(epoch from (scoped_tickets.resolved_at - scoped_tickets.created_at)) / 86400
    ) filter (
      where scoped_tickets.status::text in ('resolved', 'closed')
        and scoped_tickets.resolved_at is not null
    ) as average_resolution_days,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('category', category, 'count', ticket_count) order by category)
        from category_counts
      ),
      '[]'::jsonb
    ) as categories
  from scoped_tickets;
$$;

revoke all on function public.get_service_dashboard_metrics(bigint) from public, anon;
grant execute on function public.get_service_dashboard_metrics(bigint) to authenticated;

commit;
