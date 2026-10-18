-- Notify active leads and managers when high-priority tickets breach an SLA.
-- Runs from pg_cron and creates in-app notifications once per ticket and breach.
begin;

create or replace function public.escalate_breached_ticket_slas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  with breached as (
    select
      t.id as ticket_id,
      t.ticket_no,
      t.priority::text as priority,
      t.created_at,
      t.first_response_at,
      t.resolved_at,
      t.status::text as status,
      p.first_response_hours,
      p.resolution_hours
    from public.tickets t
    join public.ticket_sla_policies p on p.priority = t.priority::text
    where t.priority::text in ('high', 'urgent')
      and t.approval_status in ('not_required', 'approved')
      and t.status::text not in ('rejected')
  ),
  breaches as (
    select b.*, breach.kind, breach.deadline
    from breached b
    cross join lateral (
      values
        ('first_response', b.created_at + make_interval(hours => b.first_response_hours)),
        ('resolution', b.created_at + make_interval(hours => b.resolution_hours))
    ) as breach(kind, deadline)
    where
      (breach.kind = 'first_response' and (
        (b.first_response_at is null and now() >= breach.deadline)
        or b.first_response_at > breach.deadline
      ))
      or
      (breach.kind = 'resolution' and (
        (b.resolved_at is null and b.status not in ('resolved', 'closed') and now() >= breach.deadline)
        or (b.resolved_at is not null and b.resolved_at > breach.deadline)
      ))
  ),
  recipients as (
    select distinct ur.user_id
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles profile on profile.id = ur.user_id
    where r.name in ('Discipline Lead', 'Manager')
      and profile.user_side in ('employee', 'admin')
      and profile.status = 'active'
  ),
  inserted as (
    insert into public.notifications (user_id, ticket_id, type, message, dedupe_key)
    select
      recipient.user_id,
      breach.ticket_id,
      'ticket_sla_escalated',
      'Escalation: ' || coalesce(breach.priority, 'high') || '-priority ticket '
        || coalesce(breach.ticket_no, '#' || breach.ticket_id::text)
        || ' missed its ' || replace(breach.kind, '_', ' ') || ' SLA.',
      'sla-escalation:' || breach.ticket_id::text || ':' || breach.kind
    from breaches breach
    cross join recipients recipient
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

revoke all on function public.escalate_breached_ticket_slas() from public, anon, authenticated;
grant execute on function public.escalate_breached_ticket_slas() to postgres;

do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'escalate-breached-ticket-slas-every-5-minutes';

    perform cron.schedule(
      'escalate-breached-ticket-slas-every-5-minutes',
      '*/5 * * * *',
      'select public.escalate_breached_ticket_slas();'
    );
  end if;
end;
$$;

commit;
