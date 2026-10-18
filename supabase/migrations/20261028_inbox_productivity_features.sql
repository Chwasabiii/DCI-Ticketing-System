-- Persistent SLA targets and response tracking.
begin;

create table if not exists public.ticket_sla_policies (
  priority text primary key check (priority in ('low', 'medium', 'high', 'urgent')),
  first_response_hours integer not null check (first_response_hours between 1 and 8760),
  resolution_hours integer not null check (resolution_hours between 1 and 8760),
  updated_at timestamptz not null default now()
);

insert into public.ticket_sla_policies (priority, first_response_hours, resolution_hours)
values ('urgent', 1, 8), ('high', 4, 24), ('medium', 8, 72), ('low', 24, 120)
on conflict (priority) do nothing;

alter table public.ticket_sla_policies enable row level security;
grant select on public.ticket_sla_policies to authenticated;
grant insert, update on public.ticket_sla_policies to authenticated;
drop policy if exists "ticket SLA policies read" on public.ticket_sla_policies;
create policy "ticket SLA policies read" on public.ticket_sla_policies
  for select to authenticated using (public.current_side() is not null);
drop policy if exists "ticket SLA policies manage" on public.ticket_sla_policies;
create policy "ticket SLA policies manage" on public.ticket_sla_policies
  for all to authenticated using (public.current_side() = 'admin')
  with check (public.current_side() = 'admin');

alter table public.tickets add column if not exists first_response_at timestamptz;

create or replace function public.record_first_staff_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_internal and exists (
    select 1 from public.profiles p
    where p.id = new.author_id and p.user_side in ('employee', 'admin') and p.status = 'active'
  ) then
    perform set_config('pmsg.recording_first_response', 'on', true);
    update public.tickets
    set first_response_at = new.created_at
    where id = new.ticket_id and requester_id <> new.author_id and first_response_at is null;
    perform set_config('pmsg.recording_first_response', 'off', true);
  end if;
  return new;
end;
$$;

-- Permit the response tracker to change only first_response_at; preserve all
-- existing role checks for normal ticket updates.
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
  if current_setting('pmsg.recording_first_response', true) = 'on'
     and (to_jsonb(new) - array['first_response_at','updated_at']) = (to_jsonb(old) - array['first_response_at','updated_at'])
     and new.first_response_at is not null then
    return new;
  end if;
  if actor_side = 'admin' then return new; end if;
  if actor_side is null then raise exception 'An active account is required to update tickets.'; end if;

  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Discipline Lead')
  ) into can_route;
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name in ('Personnel', 'Discipline Lead')
  ) into can_work;

  only_approval_fields := (to_jsonb(new) - array['approval_status','approval_comment','reviewed_by','reviewed_at','updated_at']) = (to_jsonb(old) - array['approval_status','approval_comment','reviewed_by','reviewed_at','updated_at']);
  if only_approval_fields and current_setting('pmsg.reviewing_ticket_approval', true) = 'on' and public.can_approve_project_ticket(old.id) then return new; end if;
  only_client_close_fields := (to_jsonb(new) - array['status','closed_at','updated_at']) = (to_jsonb(old) - array['status','closed_at','updated_at']);
  if actor_side = 'client' and old.requester_id = auth.uid() and old.status = 'resolved' and new.status = 'closed' and only_client_close_fields then return new; end if;
  only_route_fields := (to_jsonb(new) - array['priority','discipline_id','assigned_to','due_date','status','resolved_at','updated_at']) = (to_jsonb(old) - array['priority','discipline_id','assigned_to','due_date','status','resolved_at','updated_at']);
  if actor_side = 'employee' and can_route and only_route_fields and new.status not in ('resolved','closed','rejected') then return new; end if;
  only_work_fields := (to_jsonb(new) - array['status','resolution_notes','resolved_at','updated_at']) = (to_jsonb(old) - array['status','resolution_notes','resolved_at','updated_at']);
  if actor_side = 'employee' and can_work and only_work_fields then return new; end if;
  raise exception 'You do not have permission to change these ticket fields.' using errcode = '42501';
end;
$$;
drop trigger if exists ticket_comments_record_first_response on public.ticket_comments;
create trigger ticket_comments_record_first_response
  after insert on public.ticket_comments
  for each row execute function public.record_first_staff_response();

select set_config('pmsg.recording_first_response', 'on', true);
update public.tickets t
set first_response_at = (
  select min(c.created_at)
  from public.ticket_comments c
  join public.profiles author on author.id = c.author_id
  where c.ticket_id = t.id and not c.is_internal
    and c.author_id <> t.requester_id
    and author.user_side in ('employee', 'admin')
)
where t.first_response_at is null and exists (
  select 1 from public.ticket_comments c
  join public.profiles author on author.id = c.author_id
  where c.ticket_id = t.id and not c.is_internal
    and c.author_id <> t.requester_id
    and author.user_side in ('employee', 'admin')
);
select set_config('pmsg.recording_first_response', 'off', true);

create or replace function public.create_ticket_handoff(
  p_ticket_id bigint,
  p_assigned_to uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  approval_state text;
  is_confidential_ticket boolean;
  current_assignee uuid;
  current_status text;
  recipient_name text;
begin
  if actor_id is null or coalesce(public.current_side() not in ('employee', 'admin'), true) then
    raise exception 'An active staff account is required to hand off a ticket.';
  end if;
  if public.current_side() <> 'admin' and not exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = actor_id and r.name in ('Coordinator', 'Discipline Lead')
  ) then
    raise exception 'Only Coordinators, Discipline Leads, or administrators can hand off tickets.';
  end if;
  if p_note is null or char_length(btrim(p_note)) not between 5 and 2000 then
    raise exception 'Handoff notes must be between 5 and 2,000 characters.';
  end if;
  select t.approval_status, t.is_confidential, t.assigned_to, t.status into approval_state, is_confidential_ticket, current_assignee, current_status
  from public.tickets t where t.id = p_ticket_id;
  if not found then raise exception 'Ticket not found.'; end if;
  if is_confidential_ticket and current_assignee is distinct from actor_id and public.current_side() <> 'admin' then
    raise exception 'You do not have access to hand off this confidential ticket.';
  end if;
  if approval_state in ('pending', 'rejected') then
    raise exception 'This ticket cannot be handed off until project approval is complete.';
  end if;
  if current_status in ('resolved', 'closed', 'rejected') then
    raise exception 'Only active tickets can be handed off.';
  end if;
  if p_assigned_to is not null then
    select coalesce(p.full_name, p.email, 'an employee') into recipient_name
    from public.profiles p where p.id = p_assigned_to and p.user_side = 'employee' and p.status = 'active';
    if not found then raise exception 'Choose an active employee as the recipient.'; end if;
  else
    recipient_name := 'the unassigned queue';
  end if;
  update public.tickets set assigned_to = p_assigned_to where id = p_ticket_id;
  insert into public.ticket_comments (ticket_id, author_id, body, is_internal)
  values (p_ticket_id, actor_id, 'Handoff to ' || recipient_name || E'\n\n' || btrim(p_note), true);
end;
$$;
revoke all on function public.create_ticket_handoff(bigint, uuid, text) from public, anon;
grant execute on function public.create_ticket_handoff(bigint, uuid, text) to authenticated;

commit;
