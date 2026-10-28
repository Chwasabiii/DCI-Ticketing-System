-- Run against a local Supabase database after applying schema.sql and all
-- migrations: supabase test db
-- All test users and rows are rolled back at the end of this file.
create extension if not exists pgtap with schema extensions;
begin;
set local search_path = public, extensions;
select plan(27);
create temp sequence ticket_access_tap_seq;
create temp table ticket_access_tap_output (
  sequence_no bigint not null default nextval('pg_temp.ticket_access_tap_seq'),
  tap text not null
);
grant insert on pg_temp.ticket_access_tap_output to authenticated;
grant usage, select on sequence pg_temp.ticket_access_tap_seq to authenticated;

-- Create synthetic users. The auth trigger creates each profile; update their
-- sides and employee roles to exercise policies as real authenticated users.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'acl-client-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"ACL Client A"}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'acl-client-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"ACL Client B"}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'acl-coordinator@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"ACL Coordinator"}', now(), now()),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'acl-personnel@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"ACL Personnel"}', now(), now()),
  ('10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'acl-manager@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"ACL Manager"}', now(), now()),
  ('10000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'acl-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"ACL Admin"}', now(), now());

update public.profiles set user_side = 'employee'
where id in (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005'
);
update public.profiles set user_side = 'admin'
where id = '10000000-0000-4000-8000-000000000006';

insert into public.roles (name) values ('Coordinator'), ('Personnel'), ('Manager')
on conflict (name) do nothing;
insert into public.user_roles (user_id, role_id)
select fixture.user_id, role.id
from (values
  ('10000000-0000-4000-8000-000000000003'::uuid, 'Coordinator'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'Personnel'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'Manager')
) as fixture(user_id, role_name)
join public.roles role on role.name = fixture.role_name;

insert into public.projects (id, name, status, pm_user_id)
overriding system value values
  (991, 'ACL approval fixture project', 'ongoing', '10000000-0000-4000-8000-000000000005');
insert into public.project_approvers (project_id, user_id)
values (991, '10000000-0000-4000-8000-000000000005');

insert into public.tickets (id, ticket_no, title, description, requester_id, assigned_to, is_confidential, status, project_id, approval_status)
overriding system value values
  (990000001, 'DCI-ACL-001', 'Normal ticket for client A', 'Fixture ticket.', '10000000-0000-4000-8000-000000000001', null, false, 'open', null, 'not_required'),
  (990000002, 'DCI-ACL-002', 'Confidential ticket for client A', 'Fixture confidential ticket.', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', true, 'assigned', null, 'not_required'),
  (990000003, 'DCI-ACL-003', 'Normal ticket for client B', 'Fixture ticket.', '10000000-0000-4000-8000-000000000002', null, false, 'open', null, 'not_required'),
  (990000004, 'DCI-ACL-004', 'Approver confidential ticket', 'Fixture pending approval ticket.', '10000000-0000-4000-8000-000000000001', null, true, 'open', 991, 'pending');

-- The automatic-routing BEFORE INSERT trigger intentionally clears a supplied
-- assignee. Assign it in fixture setup under the synthetic administrator.
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000006';
update public.tickets
set assigned_to = '10000000-0000-4000-8000-000000000004', status = 'assigned'
where id = 990000002;
set local request.jwt.claim.sub = '';

insert into public.ticket_comments (ticket_id, author_id, body, is_internal) values
  (990000002, '10000000-0000-4000-8000-000000000004', 'Visible response', false),
  (990000002, '10000000-0000-4000-8000-000000000004', 'Staff-only note', true);

insert into storage.objects (bucket_id, name) values
  ('ticket-attachments', '990000001/10000000-0000-4000-8000-000000000001/normal.txt'),
  ('ticket-attachments', '990000002/10000000-0000-4000-8000-000000000004/confidential.pdf');
insert into public.attachments (ticket_id, uploaded_by, file_name, file_path) values
  (990000001, '10000000-0000-4000-8000-000000000001', 'normal.txt', '990000001/10000000-0000-4000-8000-000000000001/normal.txt'),
  (990000002, '10000000-0000-4000-8000-000000000004', 'confidential.pdf', '990000002/10000000-0000-4000-8000-000000000004/confidential.pdf');

-- Client A can see its own tickets and public comments, but not another
-- client's ticket, internal comments, or ticket changes.
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000001), 1::bigint, 'requester can read own normal ticket');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000002), 1::bigint, 'requester can read own confidential ticket');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000003), 0::bigint, 'requester cannot read another client ticket');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.ticket_comments where ticket_id = 990000002 and not is_internal), 1::bigint, 'requester can read public comment on own confidential ticket');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.ticket_comments where ticket_id = 990000002 and is_internal), 0::bigint, 'requester cannot read internal comment');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.attachments where ticket_id = 990000001), 1::bigint, 'requester can read own attachment metadata');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from storage.objects where bucket_id = 'ticket-attachments' and name = '990000001/10000000-0000-4000-8000-000000000001/normal.txt'), 1::bigint, 'requester can download own attachment');
with changed as (
  update public.tickets set title = 'Client changed title' where id = 990000001 returning id
)
insert into pg_temp.ticket_access_tap_output(tap)
select is((select count(*) from changed), 0::bigint, 'requester cannot directly edit ticket fields');
do $$
declare was_denied boolean := false;
begin
  begin
    insert into public.ticket_comments (ticket_id, author_id, body, is_internal)
    values (990000002, auth.uid(), 'Unauthorized internal note', true);
  exception when insufficient_privilege then
    was_denied := true;
  end;
  insert into pg_temp.ticket_access_tap_output(tap)
  select is(was_denied, true, 'requester cannot add an internal note');
end;
$$;
insert into pg_temp.ticket_access_tap_output(tap)
select 'DEBUG requester context: uid=' || coalesce(auth.uid()::text, 'NULL')
  || ', side=' || coalesce(public.current_side()::text, 'NULL')
  || ', can_view_other=' || public.can_view_ticket(990000003)::text
  || ', can_view_own=' || public.can_view_ticket(990000001)::text;
reset role;

-- Coordinator can work with ordinary tickets, but confidential ticket content
-- and its attachment remain hidden unless the coordinator is assigned/approver.
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000001), 1::bigint, 'coordinator can read normal ticket');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000002), 0::bigint, 'unassigned coordinator cannot read confidential ticket');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.attachments where ticket_id = 990000002), 0::bigint, 'unassigned coordinator cannot read confidential attachment metadata');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from storage.objects where bucket_id = 'ticket-attachments' and name = '990000002/10000000-0000-4000-8000-000000000004/confidential.pdf'), 0::bigint, 'unassigned coordinator cannot download confidential attachment');
with changed as (
  update public.tickets set priority = 'high' where id = 990000001 returning id
)
insert into pg_temp.ticket_access_tap_output(tap)
select is((select count(*) from changed), 1::bigint, 'coordinator can route a normal ticket');
do $$
declare was_denied boolean := false;
begin
  begin
    insert into public.attachments (ticket_id, uploaded_by, file_name, file_path)
    values (990000002, auth.uid(), 'unauthorized.pdf', '990000002/10000000-0000-4000-8000-000000000003/unauthorized.pdf');
  exception when insufficient_privilege then was_denied := true;
  end;
  insert into pg_temp.ticket_access_tap_output(tap)
  select is(was_denied, true, 'unassigned coordinator cannot add confidential attachment metadata');
end;
$$;
do $$
declare was_denied boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('ticket-attachments', '990000002/10000000-0000-4000-8000-000000000003/unauthorized.pdf');
  exception when insufficient_privilege then was_denied := true;
  end;
  insert into pg_temp.ticket_access_tap_output(tap)
  select is(was_denied, true, 'unassigned coordinator cannot upload to confidential ticket');
end;
$$;
reset role;

-- Assigned Personnel can see the confidential ticket, internal notes, and
-- associated file, and can update work status. They cannot forge uploads as
-- another user or view confidential tickets assigned to someone else.
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000004';
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000002), 1::bigint, 'assigned Personnel can read confidential ticket');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.ticket_comments where ticket_id = 990000002 and is_internal), 1::bigint, 'assigned Personnel can read internal note');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.attachments where ticket_id = 990000002), 1::bigint, 'assigned Personnel can read confidential attachment metadata');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from storage.objects where bucket_id = 'ticket-attachments' and name = '990000002/10000000-0000-4000-8000-000000000004/confidential.pdf'), 1::bigint, 'assigned Personnel can download confidential attachment');
with changed as (
  update public.tickets set status = 'in_progress' where id = 990000002 returning id
)
insert into pg_temp.ticket_access_tap_output(tap)
select is((select count(*) from changed), 1::bigint, 'assigned Personnel can update work status');
reset role;

-- Manager has employee-side visibility for normal tickets, but is not granted
-- confidential access or ticket-field editing by the current policy matrix.
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000005';
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000001), 1::bigint, 'Manager can read normal ticket');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000002), 0::bigint, 'unassigned Manager cannot read confidential ticket');
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000004), 1::bigint, 'assigned project approver can read confidential ticket pending approval');
with changed as (
  update public.tickets set priority = 'urgent' where id = 990000001 returning id
)
insert into pg_temp.ticket_access_tap_output(tap)
select is((select count(*) from changed), 0::bigint, 'Manager cannot edit ticket routing fields');
reset role;

-- Administrators can read and manage confidential tickets.
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000006';
insert into pg_temp.ticket_access_tap_output(tap) select is((select count(*) from public.tickets where id = 990000002), 1::bigint, 'administrator can read confidential ticket');
with changed as (
  update public.tickets set title = 'Admin updated confidential ticket' where id = 990000002 returning id
)
insert into pg_temp.ticket_access_tap_output(tap)
select is((select count(*) from changed), 1::bigint, 'administrator can edit confidential ticket');
reset role;

insert into pg_temp.ticket_access_tap_output(tap) select * from finish();
-- Include live policy and fixture details in the report. PostgreSQL combines
-- permissive RLS policies with OR, so an older policy can override a newer
-- restrictive-looking policy if it was not dropped in the target database.
insert into pg_temp.ticket_access_tap_output(tap)
select 'DEBUG RLS policies: ' || coalesce(string_agg(
  format('%s.%s [%s; %s; roles=%s; using=%s; check=%s]',
    schemaname, tablename, policyname, permissive, array_to_string(roles, ','),
    coalesce(qual, '—'), coalesce(with_check, '—')),
  E'\n' order by tablename, policyname), '(none found)')
from pg_policies
where schemaname = 'public'
  and tablename in ('tickets', 'ticket_comments', 'attachments');
insert into pg_temp.ticket_access_tap_output(tap)
select 'DEBUG fixture internal comments: ' || count(*)::text || ' [ '
  || coalesce(string_agg(id::text || ':' || body, ' | '), '(none)') || ' ]'
from public.ticket_comments
where ticket_id = 990000002 and is_internal;
select string_agg(tap, E'\n' order by sequence_no) as pg_tap_report
from pg_temp.ticket_access_tap_output;
rollback;
