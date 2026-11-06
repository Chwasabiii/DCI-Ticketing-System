begin;

insert into public.service_teams (name, slug, is_in_scope, is_active)
values ('Software CSR', 'software-csr', true, true)
on conflict (slug) do update
set name = excluded.name,
    is_in_scope = excluded.is_in_scope,
    is_active = excluded.is_active;

create or replace function public.can_view_ticket(p_ticket_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets t
    left join public.profiles actor on actor.id = auth.uid()
    where t.id = p_ticket_id
      and public.current_side() is not null
      and (
        t.requester_id = auth.uid()
        or public.current_side() = 'admin'
        or (
          public.current_side() = 'employee'
          and (
            t.assigned_to = auth.uid()
            or (not t.is_confidential and actor.service_team_id = t.service_team_id)
            or (
              actor.service_team_id = t.service_team_id
              and t.service_team_id = (select team.id from public.service_teams team where team.slug = 'software-csr')
              and t.request_type = 'incident_report'
              and t.service_category = 'software'
            )
          )
        )
      )
  )
$$;

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

create or replace function public.escalate_incident_to_software_csr(p_ticket_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_team_id bigint;
  software_csr_team_id bigint;
  escalated_ticket_id bigint;
begin
  if public.current_side() <> 'employee' then return false; end if;

  select p.service_team_id into actor_team_id
  from public.profiles p
  join public.service_teams source_team on source_team.id = p.service_team_id
  where p.id = auth.uid()
    and p.status = 'active'
    and source_team.slug = 'it-support'
    and source_team.is_active;
  if actor_team_id is null then return false; end if;

  if not exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'Personnel'
  ) then return false; end if;

  select id into software_csr_team_id
  from public.service_teams
  where slug = 'software-csr' and is_active and is_in_scope;
  if software_csr_team_id is null then return false; end if;

  perform set_config('pmsg.escalating_software_csr_ticket', p_ticket_id::text, true);
  update public.tickets t
  set service_team_id = software_csr_team_id,
      assigned_to = null,
      status = 'open'
  where t.id = p_ticket_id
    and t.service_team_id = actor_team_id
    and t.request_type = 'incident_report'
    and t.service_category = 'software'
    and t.status = 'in_progress'
    and (not t.is_confidential or t.assigned_to = auth.uid())
    and nullif(btrim(t.resolution_notes), '') is not null
  returning t.id into escalated_ticket_id;
  perform set_config('pmsg.escalating_software_csr_ticket', '', true);

  if escalated_ticket_id is null then return false; end if;

  insert into public.ticket_events (ticket_id, actor_id, event_type, note)
  values (escalated_ticket_id, auth.uid(), 'routed', 'Escalated to the Software CSR service team for further investigation.');

  insert into public.notifications (user_id, ticket_id, type, message)
  select distinct p.id,
         escalated_ticket_id,
         'ticket_escalated',
         'Software incident ' || coalesce(t.ticket_no, '#' || t.id::text) || ' was escalated to the Software CSR team.'
  from public.profiles p
  join public.tickets t on t.id = escalated_ticket_id
  where p.service_team_id = software_csr_team_id
    and p.user_side = 'employee'
    and p.status = 'active';

  return true;
end;
$$;

revoke all on function public.escalate_incident_to_software_csr(bigint) from public, anon;
grant execute on function public.escalate_incident_to_software_csr(bigint) to authenticated;

commit;
