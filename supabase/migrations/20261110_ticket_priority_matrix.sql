begin;

alter table public.tickets
  add column if not exists impact text,
  add column if not exists urgency text;

-- Existing tickets are classified by the migration, without an authenticated app actor.
drop trigger if exists tickets_guard_update_permissions on public.tickets;

update public.tickets
set impact = case priority::text
      when 'urgent' then 'high'
      when 'high' then 'high'
      when 'medium' then 'medium'
      else 'low'
    end,
    urgency = case priority::text
      when 'urgent' then 'high'
      when 'high' then 'medium'
      when 'medium' then 'medium'
      else 'low'
    end
where impact is null or urgency is null;

alter table public.tickets
  alter column impact set default 'medium',
  alter column impact set not null,
  alter column urgency set default 'medium',
  alter column urgency set not null,
  add constraint tickets_impact_check check (impact in ('low', 'medium', 'high')),
  add constraint tickets_urgency_check check (urgency in ('low', 'medium', 'high')),
  add constraint tickets_priority_matrix_check check (
    priority::text = case
      when impact = 'high' and urgency = 'high' then 'urgent'
      when impact = 'high' and urgency = 'medium' then 'high'
      when impact = 'medium' and urgency = 'high' then 'high'
      when impact = 'medium' and urgency = 'medium' then 'medium'
      when impact = 'high' and urgency = 'low' then 'medium'
      when impact = 'low' and urgency = 'high' then 'medium'
      when impact = 'low' and urgency = 'medium' then 'low'
      when impact = 'medium' and urgency = 'low' then 'low'
      else 'low'
    end
  );

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
create trigger tickets_guard_update_permissions
  before update on public.tickets
  for each row execute function public.guard_ticket_update_permissions();
revoke all on function public.guard_ticket_update_permissions() from public, anon, authenticated;

commit;
