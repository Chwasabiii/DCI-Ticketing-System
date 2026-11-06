begin;

create or replace function public.ticket_sla_is_at_risk(p_ticket_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets t
    join public.ticket_sla_policies p
      on p.priority_group = case when t.priority::text in ('high', 'urgent') then 'high' else 'standard' end
    where t.id = p_ticket_id
      and (
        (t.first_response_at is null and now() >=
          public.add_sla_business_days(coalesce(t.reopened_at, t.created_at), p.first_response_business_days)
          - make_interval(secs => greatest(3600::double precision, p.first_response_business_days::double precision * 21600)))
        or
        (t.resolved_at is null and t.status::text not in ('resolved', 'closed', 'rejected') and now() >=
          public.add_sla_business_days(coalesce(t.reopened_at, t.created_at), p.resolution_business_days)
          - make_interval(secs => greatest(3600::double precision, p.resolution_business_days::double precision * 21600)))
      )
  )
$$;

revoke all on function public.ticket_sla_is_at_risk(bigint) from public, anon, authenticated;

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
  only_employee_claim_fields boolean;
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

  only_employee_claim_fields :=
    (to_jsonb(new) - array['assigned_to','status','updated_at'])
      = (to_jsonb(old) - array['assigned_to','status','updated_at']);
  if actor_side = 'employee'
     and actor_team_id = old.service_team_id
     and new.assigned_to = auth.uid()
     and old.assigned_to is distinct from auth.uid()
     and old.status not in ('resolved', 'closed', 'rejected')
     and (
       (old.status in ('open', 'under_review') and new.status = 'assigned')
       or (old.status not in ('open', 'under_review') and new.status = old.status)
     )
     and only_employee_claim_fields
     and (old.assigned_to is null or public.ticket_sla_is_at_risk(old.id)) then
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

create or replace function public.claim_team_ticket(p_ticket_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_team_id bigint;
  claimed_ticket_id bigint;
begin
  if public.current_side() <> 'employee' then return false; end if;

  select service_team_id into actor_team_id
  from public.profiles
  where id = auth.uid() and status = 'active';
  if actor_team_id is null then return false; end if;

  update public.tickets t
  set assigned_to = auth.uid(),
      status = case when t.status::text in ('open', 'under_review') then 'assigned'::public.ticket_status else t.status end
  where t.id = p_ticket_id
    and t.service_team_id = actor_team_id
    and t.status::text not in ('resolved', 'closed', 'rejected')
    and t.assigned_to is distinct from auth.uid()
    and (t.assigned_to is null or public.ticket_sla_is_at_risk(t.id))
  returning t.id into claimed_ticket_id;

  return claimed_ticket_id is not null;
end;
$$;

revoke all on function public.claim_team_ticket(bigint) from public, anon;
grant execute on function public.claim_team_ticket(bigint) to authenticated;

commit;
