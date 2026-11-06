begin;

alter table public.tickets
  drop constraint if exists tickets_reported_impact_check,
  drop constraint if exists tickets_reported_urgency_check;

alter table public.tickets
  add column if not exists reported_impact text,
  add column if not exists reported_urgency text,
  add column if not exists priority_reviewed_at timestamptz,
  add column if not exists priority_reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.tickets
  add constraint tickets_reported_impact_check
    check (reported_impact is null or reported_impact in ('low', 'medium', 'high')),
  add constraint tickets_reported_urgency_check
    check (reported_urgency is null or reported_urgency in ('low', 'medium', 'high'));

create or replace function public.normalize_requester_ticket_priority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_side() is distinct from 'client' then return new; end if;

  new.reported_impact := coalesce(new.reported_impact, new.impact);
  new.reported_urgency := coalesce(new.reported_urgency, new.urgency);

  if new.reported_impact = 'high' or new.reported_urgency = 'high' then
    new.impact := 'medium';
    new.urgency := 'medium';
    new.priority := 'medium';
    new.priority_reviewed_at := null;
    new.priority_reviewed_by := null;
  else
    new.impact := new.reported_impact;
    new.urgency := new.reported_urgency;
    new.priority := case
      when new.impact = 'high' and new.urgency = 'high' then 'urgent'::public.ticket_priority
      when new.impact = 'high' and new.urgency = 'medium' then 'high'::public.ticket_priority
      when new.impact = 'medium' and new.urgency = 'high' then 'high'::public.ticket_priority
      when new.impact = 'medium' and new.urgency = 'medium' then 'medium'::public.ticket_priority
      when new.impact = 'high' and new.urgency = 'low' then 'medium'::public.ticket_priority
      when new.impact = 'low' and new.urgency = 'high' then 'medium'::public.ticket_priority
      when new.impact = 'low' and new.urgency = 'medium' then 'low'::public.ticket_priority
      when new.impact = 'medium' and new.urgency = 'low' then 'low'::public.ticket_priority
      else 'low'::public.ticket_priority
    end;
    new.priority_reviewed_at := now();
    new.priority_reviewed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_normalize_requester_priority on public.tickets;
create trigger tickets_normalize_requester_priority
  before insert on public.tickets
  for each row execute function public.normalize_requester_ticket_priority();
revoke all on function public.normalize_requester_ticket_priority() from public, anon, authenticated;

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
  only_priority_review_fields boolean;
  only_software_csr_escalation_fields boolean;
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

  only_priority_review_fields :=
    (to_jsonb(new) - array['impact','urgency','priority','priority_reviewed_at','priority_reviewed_by','updated_at'])
      = (to_jsonb(old) - array['impact','urgency','priority','priority_reviewed_at','priority_reviewed_by','updated_at']);
  if actor_side = 'employee'
     and actor_team_id = old.service_team_id
     and can_work
     and old.status not in ('resolved', 'closed', 'rejected')
     and new.priority_reviewed_at is not null
     and new.priority_reviewed_by = auth.uid()
     and only_priority_review_fields then
    return new;
  end if;

  only_software_csr_escalation_fields :=
    (to_jsonb(new) - array['service_team_id','assigned_to','status','updated_at'])
      = (to_jsonb(old) - array['service_team_id','assigned_to','status','updated_at']);
  if current_setting('pmsg.escalating_software_csr_ticket', true) = old.id::text
     and actor_side = 'employee'
     and actor_team_id = old.service_team_id
     and can_work
     and old.request_type = 'incident_report'
     and old.service_category = 'software'
     and old.status = 'in_progress'
     and nullif(btrim(old.resolution_notes), '') is not null
     and new.service_team_id = (select team.id from public.service_teams team where team.slug = 'software-csr' and team.is_active)
     and new.assigned_to is null
     and new.status = 'open'
     and only_software_csr_escalation_fields then
    return new;
  end if;

  only_route_fields :=
    (to_jsonb(new) - array['priority','impact','urgency','assigned_to','due_date','status','resolved_at','priority_reviewed_at','priority_reviewed_by','updated_at'])
      = (to_jsonb(old) - array['priority','impact','urgency','assigned_to','due_date','status','resolved_at','priority_reviewed_at','priority_reviewed_by','updated_at']);
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

commit;
