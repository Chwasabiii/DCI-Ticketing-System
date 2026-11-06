begin;

alter table public.tickets
  add column if not exists ccg_database_result text,
  add column if not exists ccg_followup_type text,
  add column if not exists ccg_followup_status text;

alter table public.tickets
  drop constraint if exists tickets_ccg_database_result_check,
  add constraint tickets_ccg_database_result_check
    check (ccg_database_result is null or ccg_database_result in ('available', 'unavailable', 'not_required')),
  drop constraint if exists tickets_ccg_followup_type_check,
  add constraint tickets_ccg_followup_type_check
    check (ccg_followup_type is null or ccg_followup_type in ('vendor_quote', 'vendor_search')),
  drop constraint if exists tickets_ccg_followup_status_check,
  add constraint tickets_ccg_followup_status_check
    check (ccg_followup_status is null or ccg_followup_status in ('pending', 'completed', 'vendor_unresponsive', 'unsuitable'));

drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert"
  on public.tickets for insert to authenticated
  with check (
    public.current_side() = 'client'
    and requester_id = auth.uid()
    and (
      (assigned_to is null and status = 'open'
        and current_setting('pmsg.auto_routing_ticket', true) is distinct from 'on')
      or (current_setting('pmsg.auto_routing_ticket', true) = 'on'
        and status in ('open', 'assigned')
        and (assigned_to is null or exists (
          select 1 from public.profiles assignee
          where assignee.id = assigned_to
            and assignee.user_side = 'employee'
            and assignee.status = 'active'
            and assignee.service_team_id = team.id
            and (
              team.slug <> 'cost-control'
              or exists (
                select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                where ur.user_id = assignee.id and r.name in ('Personnel', 'Coordinator')
              )
            )
        )))
    )
    and ccg_database_result is null
    and ccg_followup_type is null
    and ccg_followup_status is null
    and exists (
      select 1 from public.service_teams team
      where team.id = service_team_id
        and team.is_active and team.is_in_scope
        and team.slug in ('it-support', 'cost-control')
        and (
          (team.slug = 'it-support' and ccg_request_type is null and ccg_request_scope is null and ccg_procurement_in_scope is null)
          or (team.slug = 'cost-control'
            and ccg_procurement_in_scope is false
            and ccg_request_type in ('unit_rate', 'vendor_list', 'tor_contracts')
            and ((ccg_request_type = 'unit_rate' and ccg_request_scope in ('whole_boq', 'per_material'))
              or (ccg_request_type <> 'unit_rate' and ccg_request_scope is null)))
        )
    )
  );

-- Confidential CCG tickets remain visible and actionable to authorized CCG staff
-- so they cannot be stranded before assignment.
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
              t.ccg_request_type is not null
              and actor.service_team_id = t.service_team_id
              and t.service_team_id = (select team.id from public.service_teams team where team.slug = 'cost-control')
              and exists (
                select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                where ur.user_id = auth.uid() and r.name in ('Personnel', 'Coordinator')
              )
            )
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
revoke all on function public.can_view_ticket(bigint) from public, anon;
grant execute on function public.can_view_ticket(bigint) to authenticated;

drop policy if exists "tickets update" on public.tickets;
create policy "tickets update"
  on public.tickets for update to authenticated
  using (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and service_team_id = (select p.service_team_id from public.profiles p where p.id = auth.uid())
      and (
        not is_confidential
        or assigned_to = auth.uid()
        or (ccg_request_type is not null
          and service_team_id = (select team.id from public.service_teams team where team.slug = 'cost-control')
          and exists (
          select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name = 'Coordinator'
        ))
      )
      and (
        public.is_it_support_provider()
        or exists (
          select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Personnel')
        )
      )
    )
  )
  with check (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and service_team_id = (select p.service_team_id from public.profiles p where p.id = auth.uid())
      and (
        not is_confidential
        or assigned_to = auth.uid()
        or (ccg_request_type is not null
          and service_team_id = (select team.id from public.service_teams team where team.slug = 'cost-control')
          and exists (
          select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name = 'Coordinator'
        ))
      )
      and (
        public.is_it_support_provider()
        or exists (
          select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Personnel')
        )
      )
    )
  );

create or replace function public.enforce_ccg_ticket_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_side public.user_side := public.current_side();
  actor_team_id bigint;
  can_work boolean;
  can_route boolean;
  valid_transition boolean := false;
  needs_followup boolean := false;
  expected_followup_type text;
  valid_ccg_assignee boolean;
begin
  if current_setting('pmsg.recording_first_response', true) = 'on'
     and (to_jsonb(new) - array['first_response_at','updated_at']) = (to_jsonb(old) - array['first_response_at','updated_at'])
     and new.first_response_at is not null then
    return new;
  end if;
  if old.ccg_request_type is null then
    if new.ccg_request_type is not null
       or new.ccg_request_scope is not null
       or new.ccg_procurement_in_scope is not null
       or new.ccg_database_result is not null
       or new.ccg_followup_type is not null
       or new.ccg_followup_status is not null then
      raise exception 'CCG workflow fields can only be set when a CCG request is created.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.ccg_request_type is distinct from old.ccg_request_type
     or new.ccg_request_scope is distinct from old.ccg_request_scope
     or new.ccg_procurement_in_scope is distinct from old.ccg_procurement_in_scope then
    raise exception 'The CCG request type and scope cannot be changed after submission.' using errcode = '42501';
  end if;

  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    select exists (
      select 1 from public.profiles assignee
      where assignee.id = new.assigned_to
        and assignee.user_side = 'employee'
        and assignee.status = 'active'
        and assignee.service_team_id = old.service_team_id
        and exists (
          select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
          where ur.user_id = assignee.id and r.name in ('Personnel', 'Coordinator')
        )
    ) into valid_ccg_assignee;
    if not valid_ccg_assignee then
      raise exception 'CCG requests can only be assigned to active CCG Personnel or Coordinators.' using errcode = '23514';
    end if;
  end if;

  if actor_side = 'admin' then return new; end if;
  if actor_side is null then raise exception 'An active account is required to update tickets.'; end if;

  if actor_side = 'client' then
    if old.requester_id = auth.uid()
       and old.status = 'resolved' and new.status = 'closed'
       and new.ccg_database_result is not distinct from old.ccg_database_result
       and new.ccg_followup_type is not distinct from old.ccg_followup_type
       and new.ccg_followup_status is not distinct from old.ccg_followup_status then
      return new;
    end if;
    if old.requester_id = auth.uid()
       and old.status in ('resolved', 'closed') and new.status = 'open'
       and new.ccg_database_result is null
       and new.ccg_followup_type is null
       and new.ccg_followup_status is null then
      return new;
    end if;
    raise exception 'Requesters can only confirm or reopen their own CCG response.' using errcode = '42501';
  end if;

  select p.service_team_id into actor_team_id from public.profiles p where p.id = auth.uid();
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name in ('Personnel', 'Coordinator')
  ) into can_work;
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'Coordinator'
  ) into can_route;
  if actor_side <> 'employee' or actor_team_id is distinct from old.service_team_id or not can_work then
    raise exception 'Only CCG Personnel or Coordinators can advance a CCG request.' using errcode = '42501';
  end if;
  if old.is_confidential and old.assigned_to is distinct from auth.uid()
     and new.assigned_to is distinct from auth.uid()
     and not (can_route and new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to) then
    raise exception 'A confidential CCG request must be assigned to you before you can work on it.' using errcode = '42501';
  end if;

  valid_transition :=
    (old.status = 'open' and new.status in ('open', 'assigned', 'under_review'))
    or (old.status = 'assigned' and new.status in ('assigned', 'under_review'))
    or (old.status = 'under_review' and new.status in ('under_review', 'assigned', 'in_progress', 'resolved', 'waiting_for_info'))
    or (old.status = 'in_progress' and new.status in ('in_progress', 'resolved', 'waiting_for_info'))
    or (old.status = 'waiting_for_info' and new.status in ('waiting_for_info', 'under_review'));
  if not valid_transition then
    raise exception 'This CCG status transition is not allowed.' using errcode = '23514';
  end if;
  if new.status = 'assigned' and old.status is distinct from 'assigned'
     and (new.assigned_to is null or (not can_route and new.assigned_to is distinct from auth.uid())) then
    raise exception 'A CCG request can only be assigned to an employee by a Coordinator or claimed by its assignee.' using errcode = '23514';
  end if;
  if new.status = 'resolved' and new.resolved_at is null then
    raise exception 'Set the response submission time when resolving a CCG request.' using errcode = '23514';
  end if;

  if old.status in ('open', 'assigned')
     and (new.ccg_database_result is not null or new.ccg_followup_type is not null or new.ccg_followup_status is not null) then
    raise exception 'Acknowledge and review the request before recording a database decision.' using errcode = '23514';
  end if;
  if old.status = 'under_review' and new.status = 'under_review'
     and (new.ccg_database_result is distinct from old.ccg_database_result
       or new.ccg_followup_type is distinct from old.ccg_followup_type
       or new.ccg_followup_status is distinct from old.ccg_followup_status) then
    raise exception 'Record the database decision only when advancing to CCG work.' using errcode = '23514';
  end if;
  if old.status = 'in_progress' and new.status = 'waiting_for_info'
     and old.ccg_followup_type = 'vendor_quote' and old.ccg_followup_status = 'pending' then
    raise exception 'Do not return the request while an external vendor quote is pending.' using errcode = '23514';
  end if;
  if old.status = 'waiting_for_info'
     and (new.ccg_database_result is distinct from old.ccg_database_result
       or new.ccg_followup_type is distinct from old.ccg_followup_type
       or new.ccg_followup_status is distinct from old.ccg_followup_status) then
    raise exception 'Resume CCG review before changing database or vendor decisions.' using errcode = '23514';
  end if;

  if old.status = 'under_review' and new.status in ('in_progress', 'resolved') then
    if old.ccg_request_type = 'unit_rate' and old.ccg_request_scope = 'whole_boq' then
      if new.ccg_database_result is distinct from 'not_required' or new.ccg_followup_type is not null or new.ccg_followup_status is not null then
        raise exception 'Whole BOQ requests do not use a database check or external follow-up.' using errcode = '23514';
      end if;
    elsif new.ccg_database_result is null or new.ccg_database_result not in ('available', 'unavailable') then
      raise exception 'Record the database result before starting CCG work.' using errcode = '23514';
    end if;

    needs_followup := new.ccg_database_result = 'unavailable'
      and ((old.ccg_request_type = 'unit_rate' and old.ccg_request_scope = 'per_material')
        or old.ccg_request_type = 'vendor_list');
    if needs_followup then
      expected_followup_type := case
        when old.ccg_request_type = 'unit_rate' then 'vendor_quote'
        else 'vendor_search'
      end;
      if new.status = 'resolved' then
        raise exception 'Start the vendor quote or vendor search before submitting the response.' using errcode = '23514';
      end if;
      if new.ccg_followup_type is distinct from expected_followup_type
         or (old.ccg_followup_type is null and new.ccg_followup_status is distinct from 'pending')
         or (old.ccg_followup_type is not null and new.ccg_followup_status is distinct from old.ccg_followup_status) then
        raise exception 'Record the required vendor quote or search as pending before continuing.' using errcode = '23514';
      end if;
    elsif new.ccg_followup_type is not null or new.ccg_followup_status is not null then
      raise exception 'This CCG branch does not require vendor follow-up.' using errcode = '23514';
    end if;

    if new.status = 'resolved' and nullif(btrim(new.resolution_notes), '') is null then
      raise exception 'Record the CCG response before submitting it.' using errcode = '23514';
    end if;
  elsif old.status = 'in_progress' then
    if new.ccg_database_result is distinct from old.ccg_database_result
       or new.ccg_followup_type is distinct from old.ccg_followup_type then
      raise exception 'The database decision and follow-up type are fixed once CCG work begins.' using errcode = '23514';
    end if;
    if old.ccg_followup_status is distinct from new.ccg_followup_status then
      if old.ccg_followup_status is distinct from 'pending'
         or new.ccg_followup_status is null
         or new.ccg_followup_status not in ('completed', 'vendor_unresponsive', 'unsuitable') then
        raise exception 'A pending vendor follow-up can only be completed, marked unresponsive, or marked unsuitable.' using errcode = '23514';
      end if;
    end if;
    if old.ccg_followup_type is null and new.ccg_followup_status is not null then
      raise exception 'This CCG request has no vendor follow-up to update.' using errcode = '23514';
    end if;
    if new.status = 'resolved' then
      if old.ccg_followup_type is not null and (new.ccg_followup_status is null or new.ccg_followup_status not in ('completed', 'vendor_unresponsive', 'unsuitable')) then
        raise exception 'Complete the vendor follow-up or record why the vendor could not provide a suitable response.' using errcode = '23514';
      end if;
      if nullif(btrim(new.resolution_notes), '') is null then
        raise exception 'Record the CCG response before submitting it.' using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tickets_ccg_stage_guard on public.tickets;
create trigger tickets_ccg_stage_guard
  before update on public.tickets
  for each row execute function public.enforce_ccg_ticket_workflow();
revoke all on function public.enforce_ccg_ticket_workflow() from public, anon, authenticated;

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
  can_status boolean;
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
  ) or public.is_it_support_provider() into can_route;
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'Personnel'
  ) or public.is_it_support_provider() into can_work;
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name = 'Coordinator'
  ) or public.is_it_support_provider() into can_status;

  only_client_close_fields := (to_jsonb(new) - array['status','closed_at','updated_at']) = (to_jsonb(old) - array['status','closed_at','updated_at']);
  if actor_side = 'client' and old.requester_id = auth.uid() and old.status = 'resolved' and new.status = 'closed' and only_client_close_fields then return new; end if;

  only_client_reopen_fields := (to_jsonb(new) - array['status','resolved_at','closed_at','due_date','first_response_at','reopened_at','updated_at','ccg_database_result','ccg_followup_type','ccg_followup_status','ccg_stage_due_at','ccg_vendor_expected_at','ccg_vendor_due_at','ccg_vendor_wait_started_at','ccg_vendor_wait_seconds','ccg_requester_wait_started_at','ccg_requester_wait_seconds'])
    = (to_jsonb(old) - array['status','resolved_at','closed_at','due_date','first_response_at','reopened_at','updated_at','ccg_database_result','ccg_followup_type','ccg_followup_status','ccg_stage_due_at','ccg_vendor_expected_at','ccg_vendor_due_at','ccg_vendor_wait_started_at','ccg_vendor_wait_seconds','ccg_requester_wait_started_at','ccg_requester_wait_seconds']);
  if actor_side = 'client' and old.requester_id = auth.uid() and old.status in ('resolved', 'closed') and new.status = 'open' and new.reopened_at is not null and only_client_reopen_fields then return new; end if;

  only_employee_claim_fields := (to_jsonb(new) - array['assigned_to','status','updated_at']) = (to_jsonb(old) - array['assigned_to','status','updated_at']);
  if actor_side = 'employee' and actor_team_id = old.service_team_id and new.assigned_to = auth.uid() and old.assigned_to is distinct from auth.uid()
     and old.status not in ('resolved', 'closed', 'rejected')
     and ((old.status in ('open', 'under_review') and new.status = 'assigned')
       or (old.ccg_request_type is not null and old.status = 'under_review' and new.status = 'under_review')
       or (old.status not in ('open', 'under_review') and new.status = old.status))
     and only_employee_claim_fields and (old.assigned_to is null or public.ticket_sla_is_at_risk(old.id)) then return new; end if;

  only_priority_review_fields := (to_jsonb(new) - array['impact','urgency','priority','priority_reviewed_at','priority_reviewed_by','updated_at']) = (to_jsonb(old) - array['impact','urgency','priority','priority_reviewed_at','priority_reviewed_by','updated_at']);
  if actor_side = 'employee' and actor_team_id = old.service_team_id and can_work and old.status not in ('resolved', 'closed', 'rejected')
     and new.priority_reviewed_at is not null and new.priority_reviewed_by = auth.uid() and only_priority_review_fields then return new; end if;

  only_software_csr_escalation_fields := (to_jsonb(new) - array['service_team_id','assigned_to','status','updated_at']) = (to_jsonb(old) - array['service_team_id','assigned_to','status','updated_at']);
  if current_setting('pmsg.escalating_software_csr_ticket', true) = old.id::text and actor_side = 'employee' and actor_team_id = old.service_team_id and can_work
     and old.request_type = 'incident_report' and old.service_category = 'software' and old.status = 'in_progress'
     and nullif(btrim(old.resolution_notes), '') is not null
     and new.service_team_id = (select team.id from public.service_teams team where team.slug = 'software-csr' and team.is_active)
     and new.assigned_to is null and new.status = 'open' and only_software_csr_escalation_fields then return new; end if;

  only_route_fields := (to_jsonb(new) - array['priority','impact','urgency','assigned_to','due_date','status','resolved_at','priority_reviewed_at','priority_reviewed_by','updated_at'])
    = (to_jsonb(old) - array['priority','impact','urgency','assigned_to','due_date','status','resolved_at','priority_reviewed_at','priority_reviewed_by','updated_at']);
  if actor_side = 'employee' and actor_team_id = old.service_team_id and can_route and only_route_fields and new.status not in ('resolved', 'closed', 'rejected') then return new; end if;

  only_work_fields := (to_jsonb(new) - array['status','resolution_notes','resolved_at','updated_at','ccg_database_result','ccg_followup_type','ccg_followup_status','ccg_stage_due_at','ccg_vendor_expected_at','ccg_vendor_due_at','ccg_vendor_wait_started_at','ccg_vendor_wait_seconds','ccg_requester_wait_started_at','ccg_requester_wait_seconds'])
    = (to_jsonb(old) - array['status','resolution_notes','resolved_at','updated_at','ccg_database_result','ccg_followup_type','ccg_followup_status','ccg_stage_due_at','ccg_vendor_expected_at','ccg_vendor_due_at','ccg_vendor_wait_started_at','ccg_vendor_wait_seconds','ccg_requester_wait_started_at','ccg_requester_wait_seconds']);
  if actor_side = 'employee' and actor_team_id = old.service_team_id and (can_work or can_status) and only_work_fields then return new; end if;

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
  if public.current_side() <> 'client' or char_length(clean_reason) < 5 or char_length(clean_reason) > 1000 then return false; end if;
  update public.tickets
  set status = 'open', resolved_at = null, closed_at = null, due_date = null,
      first_response_at = null, reopened_at = now(),
      ccg_database_result = null, ccg_followup_type = null, ccg_followup_status = null
  where id = p_ticket_id and requester_id = auth.uid() and status in ('resolved', 'closed')
  returning id into reopened_ticket_id;
  if reopened_ticket_id is null then return false; end if;
  insert into public.ticket_comments (ticket_id, author_id, body, is_internal)
  values (reopened_ticket_id, auth.uid(), 'Reopen reason: ' || clean_reason, false);
  return true;
end;
$$;
revoke all on function public.reopen_own_ticket(bigint, text) from public, anon;
grant execute on function public.reopen_own_ticket(bigint, text) to authenticated;

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
      status = case
        when t.status::text = 'open' then 'assigned'::public.ticket_status
        when t.status::text = 'under_review' and t.ccg_request_type is null then 'assigned'::public.ticket_status
        else t.status
      end
  where t.id = p_ticket_id
    and t.service_team_id = actor_team_id
    and t.status::text not in ('resolved', 'closed', 'rejected')
    and t.assigned_to is distinct from auth.uid()
    and (t.ccg_request_type is null or exists (
      select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and r.name in ('Personnel', 'Coordinator')
    ))
    and (t.assigned_to is null or public.ticket_sla_is_at_risk(t.id))
  returning t.id into claimed_ticket_id;
  return claimed_ticket_id is not null;
end;
$$;
revoke all on function public.claim_team_ticket(bigint) from public, anon;
grant execute on function public.claim_team_ticket(bigint) to authenticated;

commit;
