-- =====================================================================
-- PMSG Desk - Supabase (PostgreSQL) schema
-- Paste into: Supabase Dashboard > SQL Editor > New query > Run
-- Draft for a capstone prototype. Roles, statuses, and rules are
-- proposed and must be confirmed with DCI.
-- =====================================================================

-- ---------- 1. ENUM TYPES -------------------------------------------
create type public.user_side     as enum ('client', 'employee', 'admin');
create type public.ticket_status as enum
  ('open','under_review','assigned','in_progress','waiting_for_info','resolved','closed','rejected');
create type public.ticket_priority as enum ('low','medium','high','urgent');

-- ---------- 2. TABLES ------------------------------------------------
create table public.departments (
  id   bigint generated always as identity primary key,
  name text not null unique
);

-- One profile per Supabase Auth user (auth.users holds the login itself)
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  employee_id   text unique,
  full_name     text,
  email         text,
  user_side     public.user_side not null default 'client',
  status        text not null default 'active',          -- active / inactive (archived)
  invitation_pending boolean not null default false,
  department_id bigint references public.departments(id),
  created_at    timestamptz not null default now()
);

-- Permission levels inside the Employee-User side
create table public.roles (
  id   bigint generated always as identity primary key,
  name text not null unique        -- Coordinator, Discipline Lead, Personnel, Manager
);

create table public.user_roles (
  user_id uuid   not null references public.profiles(id) on delete cascade,
  role_id bigint not null references public.roles(id)    on delete cascade,
  primary key (user_id, role_id)
);

create table public.disciplines (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  lead_user_id uuid references public.profiles(id),
  status       text not null default 'active'
);

create table public.discipline_members (
  discipline_id bigint not null references public.disciplines(id) on delete cascade,
  user_id       uuid   not null references public.profiles(id)    on delete cascade,
  primary key (discipline_id, user_id)
);

create table public.categories (
  id            bigint generated always as identity primary key,
  discipline_id bigint not null references public.disciplines(id) on delete cascade,
  name          text not null
);

-- Reference only: no scheduling or task management
create table public.projects (
  id           bigint generated always as identity primary key,
  project_code text unique,
  name         text not null,
  location     text,
  status       text not null default 'planned'
                 check (status in ('planned', 'ongoing', 'completed'))
);

create sequence public.ticket_no_seq;   -- note: does not reset each year

create table public.tickets (
  id               bigint generated always as identity primary key,
  ticket_no        text not null unique default
                     ('DCI-' || to_char(now(), 'YYYY') || '-' ||
                      lpad(nextval('public.ticket_no_seq')::text, 4, '0')),
  title            text not null,
  description      text,
  priority         public.ticket_priority not null default 'medium',
  status           public.ticket_status   not null default 'open',
  requester_id     uuid not null default auth.uid() references public.profiles(id),
  department_id    bigint references public.departments(id),
  project_id       bigint references public.projects(id),
  discipline_id    bigint references public.disciplines(id),
  category_id      bigint references public.categories(id),
  assigned_to      uuid references public.profiles(id),
  due_date         date,
  resolution_notes text,
  resolved_at      timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Audit trail / activity timeline (rows are only ever added)
create table public.ticket_events (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.tickets(id) on delete cascade,
  actor_id    uuid default auth.uid() references public.profiles(id),
  event_type  text not null,       -- submitted, status_changed, routed, assigned
  from_status text,
  to_status   text,
  note        text,
  created_at  timestamptz not null default now()
);

create table public.ticket_comments (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.tickets(id) on delete cascade,
  author_id   uuid not null default auth.uid() references public.profiles(id),
  body        text not null,
  is_internal boolean not null default false,   -- hidden from client-users
  created_at  timestamptz not null default now()
);

create table public.attachments (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.tickets(id) on delete cascade,
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  file_name   text not null,
  file_path   text not null,                    -- path inside the storage bucket
  created_at  timestamptz not null default now()
);

-- Optional: supports the costing report (cost figures only, not accounting)
create table public.ticket_costs (
  ticket_id      bigint primary key references public.tickets(id) on delete cascade,
  estimated_cost numeric(14,2),
  approved_cost  numeric(14,2),
  approved_by    uuid references public.profiles(id),
  notes          text
);

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  ticket_id  bigint references public.tickets(id) on delete cascade,
  type       text not null,
  message    text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 3. INDEXES ----------------------------------------------
create index on public.tickets (status);
create index on public.tickets (discipline_id);
create index on public.tickets (assigned_to);
create index on public.tickets (requester_id);
create index on public.ticket_events (ticket_id);
create index on public.notifications (user_id, is_read);

-- ---------- 4. TRIGGERS ---------------------------------------------
-- 4a. Create a profile automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.complete_invitation(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or p_full_name is null
     or length(btrim(p_full_name)) = 0
     or length(btrim(p_full_name)) > 200 then
    raise exception 'A valid signed-in user and name are required';
  end if;

  update public.profiles
  set full_name = btrim(p_full_name),
      invitation_pending = false
  where id = auth.uid()
    and status = 'active'
    and invitation_pending = true;

  if not found then
    raise exception 'No active pending invitation was found';
  end if;
end;
$$;

revoke all on function public.complete_invitation(text) from public;
grant execute on function public.complete_invitation(text) to authenticated;

-- 4b. Keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- 4c. Write the audit trail automatically
create or replace function public.log_ticket_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_events (ticket_id, actor_id, event_type, to_status)
    values (new.id, auth.uid(), 'submitted', new.status::text);
  else
    if new.status is distinct from old.status then
      insert into public.ticket_events (ticket_id, actor_id, event_type, from_status, to_status)
      values (new.id, auth.uid(), 'status_changed', old.status::text, new.status::text);
    end if;
    if new.discipline_id is distinct from old.discipline_id then
      insert into public.ticket_events (ticket_id, actor_id, event_type, note)
      values (new.id, auth.uid(), 'routed', 'Discipline changed');
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      insert into public.ticket_events (ticket_id, actor_id, event_type, note)
      values (new.id, auth.uid(), 'assigned', 'Assignee changed');
    end if;
  end if;
  return new;
end $$;

create trigger tickets_log_event
  after insert or update on public.tickets
  for each row execute function public.log_ticket_event();

-- ---------- 5. HELPER FUNCTIONS FOR ACCESS RULES --------------------
create or replace function public.current_side()
returns public.user_side language sql stable security definer set search_path = '' as $$
  select user_side from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.has_role(role_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = role_name)
$$;

-- Archive non-admin accounts after six months without a successful sign-in.
-- Never-used invitations use their account creation time as the inactivity start.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.archive_inactive_profiles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_count integer;
begin
  update public.profiles p
  set status = 'inactive'
  from auth.users u
  where p.id = u.id
    and p.status = 'active'
    and p.user_side <> 'admin'
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '6 months';

  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

revoke all on function public.archive_inactive_profiles() from public;
grant execute on function public.archive_inactive_profiles() to postgres;

select cron.schedule(
  'archive-inactive-profiles-daily',
  '17 3 * * *',
  'select public.archive_inactive_profiles();'
);

-- ---------- 6. ROW LEVEL SECURITY -----------------------------------
alter table public.departments        enable row level security;
alter table public.profiles           enable row level security;
alter table public.roles              enable row level security;
alter table public.user_roles         enable row level security;
alter table public.disciplines        enable row level security;
alter table public.discipline_members enable row level security;
alter table public.categories         enable row level security;
alter table public.projects           enable row level security;
alter table public.tickets            enable row level security;
alter table public.ticket_events      enable row level security;
alter table public.ticket_comments    enable row level security;
alter table public.attachments        enable row level security;
alter table public.ticket_costs       enable row level security;
alter table public.notifications      enable row level security;

-- Setup/lookup tables: everyone signed in can read, only Admin can change
do $$
declare t text;
begin
  foreach t in array array['departments','profiles','roles','user_roles',
                           'disciplines','discipline_members','categories','projects']
  loop
    if t = 'profiles' then
      execute format('create policy "%s read" on public.%I for select to authenticated using (id = auth.uid() or public.current_side() is not null)', t, t);
    else
      execute format('create policy "%s read" on public.%I for select to authenticated using (public.current_side() is not null)', t, t);
    end if;
    execute format('create policy "%s admin write" on public.%I for all to authenticated
                    using (public.current_side() = ''admin'')
                    with check (public.current_side() = ''admin'')', t, t);
  end loop;
end $$;

-- Tickets: client-users see only their own; employee-users and admins see all
create policy "tickets read" on public.tickets for select to authenticated
  using (public.current_side() is not null
         and (requester_id = auth.uid() or public.current_side() in ('employee','admin')));
create policy "tickets insert" on public.tickets for insert to authenticated
  with check (public.current_side() is not null and requester_id = auth.uid());
create policy "tickets update" on public.tickets for update to authenticated
  using (public.current_side() in ('employee','admin'));

-- Events: visible if the ticket is visible. No insert policy: only the trigger writes them
create policy "events read" on public.ticket_events for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

-- Comments: internal notes hidden from client-users
create policy "comments read" on public.ticket_comments for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id)
         and (not is_internal or public.current_side() <> 'client'));
create policy "comments insert" on public.ticket_comments for insert to authenticated
  with check (author_id = auth.uid()
              and exists (select 1 from public.tickets t where t.id = ticket_id)
              and (not is_internal or public.current_side() <> 'client'));

-- Publish ticket comments for ticket-scoped Supabase Realtime subscriptions
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'ticket_comments'
     ) then
    execute 'alter publication supabase_realtime add table public.ticket_comments';
  end if;
end $$;

-- Attachments
create policy "attachments read" on public.attachments for select to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
  ));
create policy "attachments insert" on public.attachments for insert to authenticated
  with check (uploaded_by = auth.uid()
              and (storage.foldername(file_path))[1] = ticket_id::text
              and (storage.foldername(file_path))[2] = auth.uid()::text
              and exists (
                select 1 from public.tickets t
                where t.id = ticket_id
                  and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
              ));

-- Costs: employee-users and admins only
create policy "costs all" on public.ticket_costs for all to authenticated
  using (public.current_side() in ('employee','admin'))
  with check (public.current_side() in ('employee','admin'));

-- Notifications: your own only
create policy "notifications read" on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.current_side() is not null);
create policy "notifications update" on public.notifications for update to authenticated
  using (user_id = auth.uid() and public.current_side() is not null);

-- ---------- 7. PRIVATE STORAGE BUCKET FOR ATTACHMENTS ---------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-attachments', 'ticket-attachments', false, 10485760)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;

create policy "attachments bucket read" on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
    )
  );
create policy "attachments bucket upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
    )
  );
create policy "attachments bucket delete own uploads" on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
    )
  );

-- ---------- 8. SAMPLE (FICTIONAL) DATA ------------------------------
insert into public.roles (name) values
  ('Coordinator'), ('Discipline Lead'), ('Personnel'), ('Manager');

insert into public.disciplines (name) values
  ('Architectural'), ('Structural'), ('Mechanical'), ('Electrical'),
  ('Cost Control'), ('Documents'), ('IT Services'), ('Other Support Services');

insert into public.departments (name) values
  ('Project Engineering'), ('Project Controls'), ('Site Operations');

insert into public.projects (project_code, name, location, status) values
  ('HVT-01', 'Harborview Tower',     'Sample City', 'ongoing'),
  ('NGH-02', 'Northgate Logistics Hub', 'Sample City', 'planned');

-- ---------- 9. AFTER YOUR FIRST SIGN-UP ------------------------------
-- Make yourself the first admin (replace the email), then run it:
-- update public.profiles set user_side = 'admin' where email = 'you@example.com';
