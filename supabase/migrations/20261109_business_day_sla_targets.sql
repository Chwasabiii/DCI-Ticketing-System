begin;

create or replace function public.add_sla_business_days(p_started_at timestamptz, p_business_days integer)
returns timestamptz
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  due_utc timestamp without time zone := p_started_at at time zone 'UTC';
  counted_days integer := 0;
begin
  if p_business_days < 0 then
    raise exception 'Business days must not be negative.';
  end if;

  while counted_days < p_business_days loop
    due_utc := due_utc + interval '1 day';
    if extract(isodow from due_utc) between 1 and 5 then
      counted_days := counted_days + 1;
    end if;
  end loop;

  return due_utc at time zone 'UTC';
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ticket_sla_policies' and column_name = 'priority'
  ) then
    create temporary table sla_policy_migration on commit drop as
      select
        case when priority in ('high', 'urgent') then 'high' else 'standard' end as priority_group,
        min(greatest(1, (first_response_hours + 23) / 24)) as first_response_business_days,
        min(greatest(1, (resolution_hours + 23) / 24)) as resolution_business_days
      from public.ticket_sla_policies
      group by case when priority in ('high', 'urgent') then 'high' else 'standard' end;

    alter table public.ticket_sla_policies drop constraint if exists ticket_sla_policies_priority_check;
    alter table public.ticket_sla_policies drop constraint if exists ticket_sla_policies_first_response_hours_check;
    alter table public.ticket_sla_policies drop constraint if exists ticket_sla_policies_resolution_hours_check;
    alter table public.ticket_sla_policies rename column priority to priority_group;
    alter table public.ticket_sla_policies rename column first_response_hours to first_response_business_days;
    alter table public.ticket_sla_policies rename column resolution_hours to resolution_business_days;

    delete from public.ticket_sla_policies;
    insert into public.ticket_sla_policies (priority_group, first_response_business_days, resolution_business_days)
    select priority_group, first_response_business_days, resolution_business_days
    from sla_policy_migration;
  end if;
end;
$$;

alter table public.ticket_sla_policies
  add constraint ticket_sla_policies_priority_group_check check (priority_group in ('high', 'standard')),
  add constraint ticket_sla_policies_first_response_business_days_check check (first_response_business_days between 1 and 365),
  add constraint ticket_sla_policies_resolution_business_days_check check (resolution_business_days between 1 and 365);

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
      p.first_response_business_days,
      p.resolution_business_days
    from public.tickets t
    join public.ticket_sla_policies p
      on p.priority_group = case when t.priority::text in ('high', 'urgent') then 'high' else 'standard' end
    where t.approval_status in ('not_required', 'approved')
      and t.status::text not in ('rejected')
  ),
  breaches as (
    select b.*, breach.kind, breach.deadline
    from breached b
    cross join lateral (
      values
        ('first_response', public.add_sla_business_days(b.created_at, b.first_response_business_days)),
        ('resolution', public.add_sla_business_days(b.created_at, b.resolution_business_days))
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
    where r.name in ('Coordinator', 'Manager')
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

commit;
