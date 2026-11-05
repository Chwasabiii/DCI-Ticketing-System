begin;

create table if not exists public.service_teams (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  is_in_scope boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.service_teams (name, slug, is_in_scope) values
  ('IT Support Department', 'it-support', true),
  ('Cost Control Group', 'cost-control', true),
  ('Architectural', 'architectural', false),
  ('Structural', 'structural', false),
  ('Mechanical', 'mechanical', false),
  ('Electrical', 'electrical', false),
  ('Documents', 'documents', false),
  ('Other Support Services', 'other-support', false)
on conflict (slug) do update set name = excluded.name, is_in_scope = excluded.is_in_scope;

alter table public.profiles
  add column if not exists service_team_id bigint references public.service_teams(id) on delete set null;
alter table public.tickets
  add column if not exists service_team_id bigint references public.service_teams(id) on delete set null;

update public.profiles profile
set service_team_id = team.id
from public.service_teams team
where profile.user_side = 'employee'
  and profile.service_team_id is null
  and team.slug = 'it-support';

-- The backfill is a database migration, so it has no authenticated app actor.
-- Bypass the user-facing ticket guard for this one data-only update and restore
-- it below with the team-aware permissions.
drop trigger if exists tickets_guard_update_permissions on public.tickets;

update public.tickets ticket
set service_team_id = team.id
from public.service_teams team
where ticket.service_team_id is null
  and team.slug = 'it-support';

alter table public.service_teams enable row level security;
grant select on public.service_teams to authenticated;
grant select, insert, update, delete on public.service_teams to service_role;
grant usage, select on sequence public.service_teams_id_seq to service_role;

drop policy if exists "service teams read" on public.service_teams;
create policy "service teams read"
  on public.service_teams for select to authenticated
  using (public.current_side() is not null);

create index if not exists profiles_service_team_id_idx on public.profiles(service_team_id);
create index if not exists tickets_service_team_created_idx on public.tickets(service_team_id, created_at desc);

drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert"
  on public.tickets for insert to authenticated
  with check (
    public.current_side() = 'client'
    and requester_id = auth.uid()
    and assigned_to is null
    and status = 'open'
    and service_team_id = (
      select id from public.service_teams
      where slug = 'it-support' and is_active and is_in_scope
    )
  );

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
          )
        )
      )
  )
$$;

drop policy if exists "tickets update" on public.tickets;
create policy "tickets update"
  on public.tickets for update to authenticated
  using (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and (not is_confidential or assigned_to = auth.uid())
      and service_team_id = (select p.service_team_id from public.profiles p where p.id = auth.uid())
      and exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Personnel')
      )
    )
  )
  with check (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and (not is_confidential or assigned_to = auth.uid())
      and service_team_id = (select p.service_team_id from public.profiles p where p.id = auth.uid())
      and exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Personnel')
      )
    )
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
