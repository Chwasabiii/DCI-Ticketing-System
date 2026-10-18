begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickets_title_length_check') then
    alter table public.tickets add constraint tickets_title_length_check
      check (char_length(btrim(title)) between 1 and 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tickets_description_length_check') then
    alter table public.tickets add constraint tickets_description_length_check
      check (description is null or char_length(btrim(description)) between 1 and 10000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticket_comments_body_length_check') then
    alter table public.ticket_comments add constraint ticket_comments_body_length_check
      check (char_length(btrim(body)) between 1 and 5000) not valid;
  end if;
end $$;

-- Clients should only read their own profile row. Staff use the directory for routing.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_side() in ('employee', 'admin'));

drop policy if exists "project approvers read" on public.project_approvers;
create policy "project approvers read"
  on public.project_approvers for select to authenticated
  using (user_id = auth.uid() or public.current_side() in ('employee', 'admin'));

create or replace function public.project_has_active_approver(p_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_side() is not null and exists (
    select 1 from public.projects project
    where project.id = p_project_id
      and project.status in ('planned', 'ongoing')
      and (
        exists (select 1 from public.profiles pm where pm.id = project.pm_user_id and pm.status = 'active')
        or exists (
          select 1 from public.project_approvers approver
          join public.profiles profile on profile.id = approver.user_id and profile.status = 'active'
          where approver.project_id = project.id
        )
      )
  )
$$;
revoke all on function public.project_has_active_approver(bigint) from public, anon;
grant execute on function public.project_has_active_approver(bigint) to authenticated;

create or replace function public.get_ticket_profile_summary(p_ticket_id bigint, p_profile_id uuid)
returns table(id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name,
    case when profile.id = auth.uid() then profile.email else null::text end as email
  from public.profiles profile
  where profile.id = p_profile_id
    and public.can_view_ticket(p_ticket_id)
    and exists (
      select 1 from public.tickets ticket
      where ticket.id = p_ticket_id
        and (ticket.requester_id = profile.id or ticket.assigned_to = profile.id or ticket.reviewed_by = profile.id)
    )
$$;
revoke all on function public.get_ticket_profile_summary(bigint, uuid) from public, anon;
grant execute on function public.get_ticket_profile_summary(bigint, uuid) to authenticated;

create or replace function public.get_ticket_activity_profiles(p_ticket_id bigint)
returns table(id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name,
    case when profile.id = auth.uid() then profile.email else null::text end as email
  from public.profiles profile
  where public.can_view_ticket(p_ticket_id)
    and profile.id in (
      select event.actor_id from public.ticket_events event
      where event.ticket_id = p_ticket_id and event.actor_id is not null
      union
      select comment.author_id from public.ticket_comments comment
      where comment.ticket_id = p_ticket_id
        and comment.author_id is not null
        and (not comment.is_internal or public.current_side() <> 'client')
    )
$$;
revoke all on function public.get_ticket_activity_profiles(bigint) from public, anon;
grant execute on function public.get_ticket_activity_profiles(bigint) to authenticated;

create or replace function public.close_own_resolved_ticket(p_ticket_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_ticket_id bigint;
begin
  if public.current_side() is distinct from 'client' then return false; end if;
  update public.tickets
  set status = 'closed', closed_at = now()
  where id = p_ticket_id
    and requester_id = auth.uid()
    and status = 'resolved'
  returning id into updated_ticket_id;
  return updated_ticket_id is not null;
end;
$$;
revoke all on function public.close_own_resolved_ticket(bigint) from public, anon;
grant execute on function public.close_own_resolved_ticket(bigint) to authenticated;

-- Enforce ticket field permissions in the database as well as in server actions.
-- Supabase clients can call PostgREST directly, so UI checks alone are insufficient.
drop policy if exists "tickets update" on public.tickets;
create policy "tickets update"
  on public.tickets for update to authenticated
  using (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and (not is_confidential or assigned_to = auth.uid())
      and (
        exists (
          select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Discipline Lead', 'Personnel')
        )
      )
    )
  )
  with check (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and (not is_confidential or assigned_to = auth.uid())
      and exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Discipline Lead', 'Personnel')
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
  can_route boolean;
  can_work boolean;
  only_approval_fields boolean;
  only_client_close_fields boolean;
  only_route_fields boolean;
  only_work_fields boolean;
begin
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

drop trigger if exists tickets_guard_update_permissions on public.tickets;
create trigger tickets_guard_update_permissions
  before update on public.tickets
  for each row execute function public.guard_ticket_update_permissions();
revoke all on function public.guard_ticket_update_permissions() from public, anon, authenticated;

-- Keep uploads private, cap each user's ticket attachments, and reject active web payload types.
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
where id = 'ticket-attachments';

create or replace function public.can_upload_ticket_attachment(p_ticket_id bigint, p_object_name text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  object_count bigint;
begin
  if auth.uid() is null
     or public.current_side() is null
     or not public.can_view_ticket(p_ticket_id)
     or (storage.foldername(p_object_name))[1] <> p_ticket_id::text
     or (storage.foldername(p_object_name))[2] <> auth.uid()::text
     or array_length(storage.foldername(p_object_name), 1) <> 2 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_ticket_id::text || ':' || auth.uid()::text, 0));
  select count(*) into object_count
  from storage.objects object
  where object.bucket_id = 'ticket-attachments'
    and (storage.foldername(object.name))[1] = p_ticket_id::text
    and (storage.foldername(object.name))[2] = auth.uid()::text;
  return object_count < 5;
end;
$$;
revoke all on function public.can_upload_ticket_attachment(bigint, text) from public, anon;
grant execute on function public.can_upload_ticket_attachment(bigint, text) to authenticated;

drop policy if exists "attachments bucket read" on storage.objects;
create policy "attachments bucket read" on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and public.can_view_ticket((storage.foldername(name))[1]::bigint)
  );

drop policy if exists "attachments bucket upload" on storage.objects;
create policy "attachments bucket upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and public.can_upload_ticket_attachment((storage.foldername(name))[1]::bigint, name)
  );

drop policy if exists "attachments bucket delete own uploads" on storage.objects;
create policy "attachments bucket delete own uploads" on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.can_view_ticket((storage.foldername(name))[1]::bigint)
  );

create unique index if not exists attachments_file_path_unique on public.attachments(file_path);
drop policy if exists "attachments insert" on public.attachments;
create policy "attachments insert" on public.attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (storage.foldername(file_path))[2] = auth.uid()::text
    and public.can_view_ticket(ticket_id)
    and exists (
      select 1 from storage.objects object
      where object.bucket_id = 'ticket-attachments' and object.name = file_path
    )
  );

commit;
