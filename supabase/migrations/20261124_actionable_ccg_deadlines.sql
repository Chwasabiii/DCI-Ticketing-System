begin;

create table if not exists public.ccg_business_holidays (
  holiday_date date primary key,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
alter table public.ccg_business_holidays enable row level security;
grant select, insert, update, delete on public.ccg_business_holidays to authenticated;
drop policy if exists "CCG holidays read" on public.ccg_business_holidays;
create policy "CCG holidays read" on public.ccg_business_holidays for select to authenticated
  using (public.current_side() is not null);
drop policy if exists "CCG holidays admin manage" on public.ccg_business_holidays;
create policy "CCG holidays admin manage" on public.ccg_business_holidays for all to authenticated
  using (public.current_side() = 'admin') with check (public.current_side() = 'admin');

alter table public.tickets
  add column if not exists ccg_stage_due_at timestamptz,
  add column if not exists ccg_vendor_expected_at timestamptz,
  add column if not exists ccg_vendor_due_at timestamptz,
  add column if not exists ccg_vendor_wait_started_at timestamptz,
  add column if not exists ccg_vendor_wait_seconds bigint not null default 0,
  add column if not exists ccg_requester_wait_started_at timestamptz,
  add column if not exists ccg_requester_wait_seconds bigint not null default 0;

alter table public.tickets
  add constraint tickets_ccg_vendor_wait_seconds_check check (ccg_vendor_wait_seconds >= 0),
  add constraint tickets_ccg_requester_wait_seconds_check check (ccg_requester_wait_seconds >= 0);

create or replace function public.add_ccg_business_days(p_started_at timestamptz, p_business_days integer)
returns timestamptz
language plpgsql
stable
strict
security definer
set search_path = ''
as $$
declare
  due_utc timestamp without time zone := p_started_at at time zone 'UTC';
  counted_days integer := 0;
begin
  if p_business_days < 0 then raise exception 'Business days must not be negative.'; end if;
  while counted_days < p_business_days loop
    due_utc := due_utc + interval '1 day';
    if extract(isodow from due_utc) between 1 and 5
       and not exists (
         select 1 from public.ccg_business_holidays holiday
         where holiday.holiday_date = due_utc::date
       ) then
      counted_days := counted_days + 1;
    end if;
  end loop;
  return due_utc at time zone 'UTC';
end;
$$;
revoke all on function public.add_ccg_business_days(timestamptz, integer) from public, anon, authenticated;

create or replace function public.manage_ccg_ticket_deadlines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  clock_now timestamptz := now();
  requester_wait integer := 0;
  vendor_wait integer := 0;
begin
  if tg_op = 'INSERT' then
    new.ccg_stage_due_at := null;
    new.ccg_vendor_expected_at := null;
    new.ccg_vendor_due_at := null;
    new.ccg_vendor_wait_started_at := null;
    new.ccg_vendor_wait_seconds := 0;
    new.ccg_requester_wait_started_at := null;
    new.ccg_requester_wait_seconds := 0;
    if new.ccg_request_type is not null then
      new.ccg_stage_due_at := coalesce(new.created_at, clock_now) + interval '24 hours';
    end if;
    return new;
  end if;

  new.ccg_stage_due_at := old.ccg_stage_due_at;
  new.ccg_vendor_expected_at := old.ccg_vendor_expected_at;
  new.ccg_vendor_due_at := old.ccg_vendor_due_at;
  new.ccg_vendor_wait_started_at := old.ccg_vendor_wait_started_at;
  new.ccg_vendor_wait_seconds := old.ccg_vendor_wait_seconds;
  new.ccg_requester_wait_started_at := old.ccg_requester_wait_started_at;
  new.ccg_requester_wait_seconds := old.ccg_requester_wait_seconds;
  if old.ccg_request_type is null then return new; end if;

  if old.status in ('resolved', 'closed') and new.status = 'open' then
    new.ccg_stage_due_at := clock_now + interval '24 hours';
    new.ccg_vendor_expected_at := null;
    new.ccg_vendor_due_at := null;
    new.ccg_vendor_wait_started_at := null;
    new.ccg_vendor_wait_seconds := 0;
    new.ccg_requester_wait_started_at := null;
    new.ccg_requester_wait_seconds := 0;
    return new;
  end if;

  if old.status <> 'waiting_for_info' and new.status = 'waiting_for_info' then
    new.ccg_requester_wait_started_at := clock_now;
    return new;
  end if;
  if old.status = 'waiting_for_info' and new.status = 'under_review' then
    if old.ccg_requester_wait_started_at is not null then
      requester_wait := greatest(0, floor(extract(epoch from (clock_now - old.ccg_requester_wait_started_at)))::integer);
      new.ccg_requester_wait_seconds := old.ccg_requester_wait_seconds + requester_wait;
      if old.ccg_stage_due_at is not null then
        new.ccg_stage_due_at := old.ccg_stage_due_at + make_interval(secs => requester_wait);
      end if;
    end if;
    new.ccg_requester_wait_started_at := null;
    return new;
  end if;

  if old.status = 'under_review' and new.status in ('in_progress', 'resolved') then
    if new.status = 'resolved' then
      new.ccg_stage_due_at := null;
      new.ccg_vendor_expected_at := null;
      new.ccg_vendor_due_at := null;
      new.ccg_vendor_wait_started_at := null;
      return new;
    end if;

    if new.ccg_followup_type = 'vendor_quote' and new.ccg_followup_status = 'pending' then
      new.ccg_stage_due_at := null;
      if old.ccg_followup_type is distinct from 'vendor_quote' or old.ccg_followup_status is distinct from 'pending' then
        new.ccg_vendor_expected_at := clock_now + interval '3 weeks';
        new.ccg_vendor_due_at := clock_now + interval '6 weeks';
        new.ccg_vendor_wait_started_at := clock_now;
      end if;
    elsif new.ccg_followup_type = 'vendor_search' and new.ccg_followup_status = 'pending' then
      if old.ccg_followup_type is distinct from 'vendor_search' or old.ccg_followup_status is distinct from 'pending' then
        new.ccg_stage_due_at := public.add_ccg_business_days(clock_now, 5);
      end if;
      new.ccg_vendor_expected_at := null;
      new.ccg_vendor_due_at := null;
      new.ccg_vendor_wait_started_at := null;
    else
      new.ccg_stage_due_at := clock_now + interval '24 hours';
      new.ccg_vendor_expected_at := null;
      new.ccg_vendor_due_at := null;
      new.ccg_vendor_wait_started_at := null;
    end if;
    return new;
  end if;

  if old.status = 'in_progress' and old.ccg_followup_status = 'pending'
     and new.ccg_followup_status is distinct from 'pending' then
    if old.ccg_followup_type = 'vendor_quote' and old.ccg_vendor_wait_started_at is not null then
      vendor_wait := greatest(0, floor(extract(epoch from (clock_now - old.ccg_vendor_wait_started_at)))::integer);
      new.ccg_vendor_wait_seconds := old.ccg_vendor_wait_seconds + vendor_wait;
    end if;
    new.ccg_vendor_wait_started_at := null;
    new.ccg_vendor_expected_at := null;
    new.ccg_vendor_due_at := null;
    new.ccg_stage_due_at := case when new.status = 'resolved' then null else clock_now + interval '24 hours' end;
  end if;

  if new.status = 'resolved' then
    new.ccg_stage_due_at := null;
    new.ccg_vendor_expected_at := null;
    new.ccg_vendor_due_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.manage_ccg_ticket_deadlines() from public, anon, authenticated;

drop trigger if exists tickets_ccg_deadline_management on public.tickets;
create trigger tickets_ccg_deadline_management
  before insert or update on public.tickets
  for each row execute function public.manage_ccg_ticket_deadlines();

create or replace function public.ticket_sla_is_at_risk(p_ticket_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id
      and (
        (t.ccg_request_type is not null
          and t.ccg_stage_due_at is not null
          and t.status::text not in ('waiting_for_info', 'resolved', 'closed', 'rejected')
          and now() >= t.ccg_stage_due_at - interval '8 hours')
        or
        (t.ccg_request_type is null and exists (
          select 1 from public.ticket_sla_policies p
          where p.priority_group = case when t.priority::text in ('high', 'urgent') then 'high' else 'standard' end
            and (
              (t.first_response_at is null and now() >= public.add_sla_business_days(coalesce(t.reopened_at, t.created_at), p.first_response_business_days)
                - make_interval(secs => greatest(3600::double precision, p.first_response_business_days::double precision * 21600)))
              or (t.resolved_at is null and t.status::text not in ('resolved', 'closed', 'rejected')
                and now() >= public.add_sla_business_days(coalesce(t.reopened_at, t.created_at), p.resolution_business_days)
                - make_interval(secs => greatest(3600::double precision, p.resolution_business_days::double precision * 21600)))
            )
        ))
      )
  )
$$;
revoke all on function public.ticket_sla_is_at_risk(bigint) from public, anon, authenticated;

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
    select t.id as ticket_id, t.ticket_no, t.priority::text as priority,
      coalesce(t.reopened_at, t.created_at) as created_at, t.reopened_at,
      t.first_response_at, t.resolved_at, t.status::text as status,
      p.first_response_business_days, p.resolution_business_days
    from public.tickets t
    join public.ticket_sla_policies p
      on p.priority_group = case when t.priority::text in ('high', 'urgent') then 'high' else 'standard' end
    where t.approval_status in ('not_required', 'approved')
      and t.status::text not in ('rejected')
      and t.ccg_request_type is null
  ),
  breaches as (
    select b.*, breach.kind, breach.deadline
    from breached b
    cross join lateral (values
      ('first_response', public.add_sla_business_days(b.created_at, b.first_response_business_days)),
      ('resolution', public.add_sla_business_days(b.created_at, b.resolution_business_days))
    ) as breach(kind, deadline)
    where (breach.kind = 'first_response' and ((b.first_response_at is null and now() >= breach.deadline) or b.first_response_at > breach.deadline))
      or (breach.kind = 'resolution' and ((b.resolved_at is null and b.status not in ('resolved', 'closed') and now() >= breach.deadline) or (b.resolved_at is not null and b.resolved_at > breach.deadline)))
  ),
  recipients as (
    select distinct ur.user_id
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles profile on profile.id = ur.user_id
    where r.name in ('Coordinator', 'Manager') and profile.user_side in ('employee', 'admin') and profile.status = 'active'
  ),
  inserted as (
    insert into public.notifications (user_id, ticket_id, type, message, dedupe_key)
    select recipient.user_id, breach.ticket_id, 'ticket_sla_escalated',
      'Escalation: ' || coalesce(breach.priority, 'high') || '-priority ticket ' || coalesce(breach.ticket_no, '#' || breach.ticket_id::text)
        || ' missed its ' || replace(breach.kind, '_', ' ') || ' SLA.',
      'sla-escalation:' || breach.ticket_id::text || ':' || breach.kind
        || case when breach.reopened_at is null then '' else ':' || to_char(breach.reopened_at, 'YYYYMMDDHH24MISS') end
    from breaches breach cross join recipients recipient
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;
  return inserted_count;
end;
$$;
revoke all on function public.escalate_breached_ticket_slas() from public, anon, authenticated;
grant execute on function public.escalate_breached_ticket_slas() to postgres;

create or replace function public.notify_ccg_deadlines()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  with events as (
    select t.id as ticket_id, t.ticket_no, t.service_team_id, t.assigned_to,
      'ccg_deadline_soon'::text as event_type, t.ccg_stage_due_at as deadline,
      'CCG-controlled response is due within 8 hours for ' as message_prefix
    from public.tickets t
    where t.ccg_request_type is not null and t.ccg_stage_due_at > now()
      and t.ccg_stage_due_at <= now() + interval '8 hours'
      and t.status::text not in ('waiting_for_info', 'resolved', 'closed', 'rejected')
    union all
    select t.id, t.ticket_no, t.service_team_id, t.assigned_to,
      'ccg_deadline_overdue', t.ccg_stage_due_at,
      'CCG-controlled response is overdue for '
    from public.tickets t
    where t.ccg_request_type is not null and t.ccg_stage_due_at <= now()
      and t.status::text not in ('waiting_for_info', 'resolved', 'closed', 'rejected')
    union all
    select t.id, t.ticket_no, t.service_team_id, t.assigned_to,
      'ccg_vendor_deadline_overdue', t.ccg_vendor_due_at,
      'Vendor response is overdue for '
    from public.tickets t
    where t.ccg_request_type is not null and t.ccg_followup_type = 'vendor_quote'
      and t.ccg_followup_status = 'pending' and t.ccg_vendor_due_at <= now()
  ),
  recipients as (
    select e.*, p.id as user_id
    from events e
    join public.profiles p on p.status = 'active' and (
      p.id = e.assigned_to
      or (p.service_team_id = e.service_team_id and exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = p.id and r.name in ('Personnel', 'Coordinator', 'Manager')
      ))
    )
  ),
  inserted as (
    insert into public.notifications (user_id, ticket_id, type, message, dedupe_key)
    select user_id, ticket_id, event_type,
      message_prefix || coalesce(ticket_no, '#' || ticket_id::text)
        || case when event_type = 'ccg_vendor_deadline_overdue' then '. The CCG-controlled clock remains paused while awaiting the vendor.' else '.' end,
      event_type || ':' || ticket_id::text || ':' || floor(extract(epoch from deadline))::bigint::text
    from recipients
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;
  return inserted_count;
end;
$$;
revoke all on function public.notify_ccg_deadlines() from public, anon, authenticated;
grant execute on function public.notify_ccg_deadlines() to postgres;

do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'notify-ccg-deadlines-every-15-minutes';
    perform cron.schedule('notify-ccg-deadlines-every-15-minutes', '*/15 * * * *',
      'select public.notify_ccg_deadlines();');
  end if;
end;
$$;

commit;
