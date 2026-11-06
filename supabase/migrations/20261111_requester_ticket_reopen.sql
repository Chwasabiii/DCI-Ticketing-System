begin;

alter table public.tickets
  add column if not exists reopened_at timestamptz;

create or replace function public.guard_ticket_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_side public.user_side := public.current_side();
  actor_team_id bigint;
  can_route boolean;
  can_work boolean;
  only_client_close_fields boolean;
  only_client_reopen_fields boolean;
  only_route_fields boolean;
  only_work_fields boolean;
begin
  if current_setting('pmsg.recording_first_response', true) = 'on'
     and (to_jsonb(new) - array['first_response_at','updated_at']) = (to_jsonb(old) - array['first_response_at','updated_at'])
     and new.first_response_at is not null then
    return new;
  end if;
  if actor_side = 'admin' then return new; end if;
  if actor_side is null then raise exception 'An active account is required to update tickets.'; end if;

  select p.service_team_id into actor_team_id from public.profiles p where p.id = auth.uid();
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'Coordinator'
  ) into can_route;
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'Personnel'
  ) into can_work;

  only_client_close_fields :=
    (to_jsonb(new) - array['status','closed_at','updated_at'])
      = (to_jsonb(old) - array['status','closed_at','updated_at']);
  if actor_side = 'client' and old.requester_id = auth.uid()
     and old.status = 'resolved' and new.status = 'closed' and only_client_close_fields then
    return new;
  end if;

  only_client_reopen_fields :=
    (to_jsonb(new) - array['status','resolved_at','closed_at','due_date','first_response_at','reopened_at','updated_at'])
      = (to_jsonb(old) - array['status','resolved_at','closed_at','due_date','first_response_at','reopened_at','updated_at']);
  if actor_side = 'client' and old.requester_id = auth.uid()
     and old.status in ('resolved', 'closed') and new.status = 'open'
     and new.reopened_at is not null and only_client_reopen_fields then
    return new;
  end if;

  only_route_fields :=
    (to_jsonb(new) - array['priority','impact','urgency','assigned_to','due_date','status','resolved_at','updated_at'])
      = (to_jsonb(old) - array['priority','impact','urgency','assigned_to','due_date','status','resolved_at','updated_at']);
  if actor_side = 'employee' and actor_team_id = old.service_team_id and can_route
     and only_route_fields and new.status not in ('resolved', 'closed', 'rejected') then
    return new;
  end if;

  only_work_fields :=
    (to_jsonb(new) - array['status','resolution_notes','resolved_at','updated_at'])
      = (to_jsonb(old) - array['status','resolution_notes','resolved_at','updated_at']);
  if actor_side = 'employee' and actor_team_id = old.service_team_id and can_work and only_work_fields then
    return new;
  end if;

  raise exception 'You do not have permission to change these ticket fields.' using errcode = '42501';
end;
$$;

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
  if public.current_side() <> 'client'
     or char_length(clean_reason) < 5
     or char_length(clean_reason) > 1000 then
    return false;
  end if;

  update public.tickets
  set status = 'open',
      resolved_at = null,
      closed_at = null,
      due_date = null,
      first_response_at = null,
      reopened_at = now()
  where id = p_ticket_id
    and requester_id = auth.uid()
    and status in ('resolved', 'closed')
  returning id into reopened_ticket_id;

  if reopened_ticket_id is null then return false; end if;

  insert into public.ticket_comments (ticket_id, author_id, body, is_internal)
  values (reopened_ticket_id, auth.uid(), 'Reopen reason: ' || clean_reason, false);

  return true;
end;
$$;

revoke all on function public.reopen_own_ticket(bigint, text) from public, anon;
grant execute on function public.reopen_own_ticket(bigint, text) to authenticated;

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
      coalesce(t.reopened_at, t.created_at) as created_at,
      t.reopened_at,
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
        || case when breach.reopened_at is null then '' else ':' || to_char(breach.reopened_at, 'YYYYMMDDHH24MISS') end
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
