begin;

create table if not exists public.ticket_routing_rules (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  project_id bigint references public.projects(id) on delete cascade,
  category_id bigint references public.categories(id) on delete cascade,
  request_type text check (request_type in ('general', 'access_request', 'incident_report')),
  discipline_id bigint references public.disciplines(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete cascade,
  rule_priority integer not null default 100 check (rule_priority between 0 and 9999),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ticket_routing_rules_match_required
    check (num_nonnulls(project_id, category_id, request_type) > 0),
  constraint ticket_routing_rules_action_required
    check (num_nonnulls(discipline_id, assigned_to) > 0)
);

create index if not exists ticket_routing_rules_active_idx
  on public.ticket_routing_rules(is_active, rule_priority, id);

alter table public.ticket_routing_rules enable row level security;
grant select on public.ticket_routing_rules to authenticated;
grant select, insert, update, delete on public.ticket_routing_rules to service_role;
grant usage, select on sequence public.ticket_routing_rules_id_seq to service_role;
drop policy if exists "routing rules admin read" on public.ticket_routing_rules;
create policy "routing rules admin read"
  on public.ticket_routing_rules for select to authenticated
  using (public.current_side() = 'admin');

-- A ticket with a project approver must wait for approval before any routing occurs.
create or replace function public.route_ticket_on_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_rule public.ticket_routing_rules%rowtype;
begin
  -- Never trust assignment or status fields supplied by an API client.
  new.assigned_to := null;
  new.status := 'open';

  if new.project_id is not null then return new; end if;

  select rule.* into selected_rule
  from public.ticket_routing_rules rule
  where rule.is_active
    and (rule.project_id is null or rule.project_id = new.project_id)
    and (rule.category_id is null or rule.category_id = new.category_id)
    and (rule.request_type is null or rule.request_type = new.request_type)
    and (
      rule.discipline_id is null
      or exists (
        select 1 from public.disciplines discipline
        where discipline.id = rule.discipline_id and discipline.status = 'active'
      )
    )
    and (
      rule.assigned_to is null
      or exists (
        select 1 from public.profiles assignee
        where assignee.id = rule.assigned_to
          and assignee.user_side = 'employee'
          and assignee.status = 'active'
      )
    )
  order by
    ((rule.project_id is not null)::integer * 4
      + (rule.category_id is not null)::integer * 2
      + (rule.request_type is not null)::integer) desc,
    rule.rule_priority asc,
    rule.id asc
  limit 1;

  if selected_rule.id is not null then
    if selected_rule.discipline_id is not null then
      new.discipline_id := selected_rule.discipline_id;
    end if;
    new.assigned_to := selected_rule.assigned_to;
    if new.assigned_to is not null then new.status := 'assigned'; end if;
    perform pg_catalog.set_config('pmsg.auto_routing_ticket', 'on', true);
  end if;
  return new;
end;
$$;
revoke all on function public.route_ticket_on_submission() from public, anon, authenticated;

drop trigger if exists tickets_auto_route_before_insert on public.tickets;
create trigger tickets_auto_route_before_insert
  before insert on public.tickets
  for each row execute function public.route_ticket_on_submission();

-- Allow assigned rows only when the trusted BEFORE INSERT trigger matched a rule.
drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert"
  on public.tickets for insert to authenticated
  with check (
    public.current_side() is not null
    and requester_id = auth.uid()
    and (
      (assigned_to is null and status = 'open'
        and current_setting('pmsg.auto_routing_ticket', true) is distinct from 'on')
      or (
        current_setting('pmsg.auto_routing_ticket', true) = 'on'
        and status in ('open', 'assigned')
        and (
          assigned_to is null
          or exists (
            select 1 from public.profiles assignee
            where assignee.id = assigned_to
              and assignee.user_side = 'employee'
              and assignee.status = 'active'
          )
        )
      )
    )
  );

create or replace function public.record_automatic_ticket_route()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  discipline_name text;
  assignee_name text;
begin
  if current_setting('pmsg.auto_routing_ticket', true) is distinct from 'on' then
    return new;
  end if;

  if new.discipline_id is not null then
    select name into discipline_name from public.disciplines where id = new.discipline_id;
  end if;
  if new.assigned_to is not null then
    select coalesce(nullif(btrim(full_name), ''), email)
      into assignee_name from public.profiles where id = new.assigned_to;
  end if;

  insert into public.ticket_events(ticket_id, actor_id, event_type, note)
  values (
    new.id,
    auth.uid(),
    'auto_routed',
    'Automatically routed'
      || case when discipline_name is null then '' else ' to ' || discipline_name end
      || case when assignee_name is null then '' else '; assigned to ' || assignee_name end
      || '.'
  );

  perform pg_catalog.set_config('pmsg.auto_routing_ticket', 'off', true);
  return new;
end;
$$;
revoke all on function public.record_automatic_ticket_route() from public, anon, authenticated;

drop trigger if exists tickets_zz_auto_route_audit on public.tickets;
create trigger tickets_zz_auto_route_audit
  after insert on public.tickets
  for each row execute function public.record_automatic_ticket_route();

-- When project approval is granted, run the same matching rules against the now-approved ticket.
create or replace function public.route_ticket_after_project_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_rule public.ticket_routing_rules%rowtype;
  previous_routing_setting text := current_setting('pmsg.auto_routing_ticket', true);
begin
  select rule.* into selected_rule
  from public.ticket_routing_rules rule
  where rule.is_active
    and (rule.project_id is null or rule.project_id = new.project_id)
    and (rule.category_id is null or rule.category_id = new.category_id)
    and (rule.request_type is null or rule.request_type = new.request_type)
    and (
      rule.discipline_id is null
      or exists (
        select 1 from public.disciplines discipline
        where discipline.id = rule.discipline_id and discipline.status = 'active'
      )
    )
    and (
      rule.assigned_to is null
      or exists (
        select 1 from public.profiles assignee
        where assignee.id = rule.assigned_to
          and assignee.user_side = 'employee'
          and assignee.status = 'active'
      )
    )
  order by
    ((rule.project_id is not null)::integer * 4
      + (rule.category_id is not null)::integer * 2
      + (rule.request_type is not null)::integer) desc,
    rule.rule_priority asc,
    rule.id asc
  limit 1;

  if selected_rule.id is not null then
    perform pg_catalog.set_config('pmsg.auto_routing_ticket', 'on', true);
    update public.tickets
    set discipline_id = coalesce(selected_rule.discipline_id, discipline_id),
        assigned_to = selected_rule.assigned_to,
        status = case when selected_rule.assigned_to is null then status else 'assigned'::public.ticket_status end
    where id = new.id;
    perform pg_catalog.set_config('pmsg.auto_routing_ticket', coalesce(previous_routing_setting, 'off'), true);
  end if;
  return new;
end;
$$;
revoke all on function public.route_ticket_after_project_approval() from public, anon, authenticated;

drop trigger if exists tickets_auto_route_after_approval on public.tickets;
create trigger tickets_auto_route_after_approval
  after update of approval_status on public.tickets
  for each row
  when (old.approval_status = 'pending' and new.approval_status = 'approved')
  execute function public.route_ticket_after_project_approval();

-- The scoped setting above is written only by trusted triggers. It cannot authorize a user RPC.
create or replace function public.guard_ticket_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_side public.user_side := public.current_side();
  can_route boolean;
  can_work boolean;
  only_approval_fields boolean;
  only_client_close_fields boolean;
  only_route_fields boolean;
  only_work_fields boolean;
begin
  if actor_side = 'admin' then return new; end if;
  if actor_side is null then raise exception 'An active account is required to update tickets.'; end if;
  if current_setting('pmsg.auto_routing_ticket', true) = 'on' then return new; end if;

  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Discipline Lead')
  ) into can_route;
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name in ('Personnel', 'Discipline Lead')
  ) into can_work;

  only_approval_fields :=
    (to_jsonb(new) - array['approval_status','approval_comment','reviewed_by','reviewed_at','updated_at'])
      = (to_jsonb(old) - array['approval_status','approval_comment','reviewed_by','reviewed_at','updated_at']);
  if only_approval_fields
     and current_setting('pmsg.reviewing_ticket_approval', true) = 'on'
     and public.can_approve_project_ticket(old.id) then
    return new;
  end if;

  only_client_close_fields :=
    (to_jsonb(new) - array['status','closed_at','updated_at'])
      = (to_jsonb(old) - array['status','closed_at','updated_at']);
  if actor_side = 'client'
     and old.requester_id = auth.uid()
     and old.status = 'resolved'
     and new.status = 'closed'
     and only_client_close_fields then
    return new;
  end if;

  only_route_fields :=
    (to_jsonb(new) - array['priority','discipline_id','assigned_to','due_date','status','resolved_at','updated_at'])
      = (to_jsonb(old) - array['priority','discipline_id','assigned_to','due_date','status','resolved_at','updated_at']);
  if actor_side = 'employee' and can_route and only_route_fields
     and new.status not in ('resolved', 'closed', 'rejected') then
    return new;
  end if;

  only_work_fields :=
    (to_jsonb(new) - array['status','resolution_notes','resolved_at','updated_at'])
      = (to_jsonb(old) - array['status','resolution_notes','resolved_at','updated_at']);
  if actor_side = 'employee' and can_work and only_work_fields then
    return new;
  end if;

  raise exception 'You do not have permission to change these ticket fields.' using errcode = '42501';
end;
$$;

commit;
