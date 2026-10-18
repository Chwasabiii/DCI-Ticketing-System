begin;

create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'ticket_submitted', 'ticket_assigned', 'ticket_approved', 'ticket_rejected', 'ticket_updated'
  )),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_type)
);

alter table public.notification_preferences enable row level security;
drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences"
  on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.notification_preferences from anon;
grant select, insert, update, delete on public.notification_preferences to authenticated;

alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_user_dedupe_key_idx
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

create or replace function public.notification_is_enabled(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select preference.enabled
    from public.notification_preferences preference
    where preference.user_id = p_user_id
      and preference.notification_type = p_type
  ), true)
$$;
revoke all on function public.notification_is_enabled(uuid, text) from public, anon, authenticated;

create or replace function public.log_ticket_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  discipline_label text;
  assignee_label text;
  change_notes text[] := array[]::text[];
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
      select d.name into discipline_label from public.disciplines d where d.id = new.discipline_id;
      insert into public.ticket_events (ticket_id, actor_id, event_type, note)
      values (new.id, auth.uid(), 'routed', case when new.discipline_id is null then 'Support group cleared'
        else 'Routed to ' || coalesce(discipline_label, 'a support group') end);
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      select coalesce(nullif(btrim(p.full_name), ''), p.email) into assignee_label
      from public.profiles p where p.id = new.assigned_to;
      insert into public.ticket_events (ticket_id, actor_id, event_type, note)
      values (new.id, auth.uid(), 'assigned', case when new.assigned_to is null then 'Assignee cleared'
        else 'Assigned to ' || coalesce(assignee_label, 'a teammate') end);
    end if;
    if new.title is distinct from old.title then change_notes := array_append(change_notes, 'Title updated'); end if;
    if new.description is distinct from old.description then change_notes := array_append(change_notes, 'Details updated'); end if;
    if new.resolution_notes is distinct from old.resolution_notes then change_notes := array_append(change_notes, 'Resolution summary updated'); end if;
    if new.priority is distinct from old.priority then
      change_notes := array_append(change_notes, 'Priority changed from ' || old.priority::text || ' to ' || new.priority::text);
    end if;
    if new.due_date is distinct from old.due_date then
      change_notes := array_append(change_notes, case when new.due_date is null then 'Due date cleared'
        when old.due_date is null then 'Due date set to ' || new.due_date::text
        else 'Due date changed from ' || old.due_date::text || ' to ' || new.due_date::text end);
    end if;
    if new.project_id is distinct from old.project_id then change_notes := array_append(change_notes, 'Project changed'); end if;
    if new.category_id is distinct from old.category_id then change_notes := array_append(change_notes, 'Category changed'); end if;
    if new.request_type is distinct from old.request_type then change_notes := array_append(change_notes, 'Request type changed'); end if;
    if new.is_confidential is distinct from old.is_confidential then
      change_notes := array_append(change_notes, case when new.is_confidential then 'Confidential access enabled' else 'Confidential access disabled' end);
    end if;
    if cardinality(change_notes) > 0 then
      insert into public.ticket_events (ticket_id, actor_id, event_type, note)
      values (new.id, auth.uid(), 'updated', array_to_string(change_notes, '; '));
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_ticket_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_ids uuid[];
  notification_type text;
  notification_message text;
begin
  if tg_op = 'INSERT' then
    notification_type := 'ticket_submitted';
    notification_message := 'Ticket ' || new.ticket_no || ' was submitted'
      || case when new.approval_status = 'pending' then ' and is awaiting project approval.' else '.' end;
    recipient_ids := array[new.requester_id, new.assigned_to];
  elsif new.approval_status is distinct from old.approval_status
        and new.approval_status in ('approved', 'rejected') then
    notification_type := case when new.approval_status = 'approved' then 'ticket_approved' else 'ticket_rejected' end;
    notification_message := 'Ticket ' || new.ticket_no || ' was ' || new.approval_status
      || case when new.approval_status = 'rejected' and nullif(btrim(new.approval_comment), '') is not null
        then ': ' || btrim(new.approval_comment) else '.' end;
    recipient_ids := array[new.requester_id, new.assigned_to];
  elsif new.status is distinct from old.status and new.status = 'rejected' then
    notification_type := 'ticket_rejected';
    notification_message := 'Ticket ' || new.ticket_no || ' was rejected'
      || case when nullif(btrim(new.resolution_notes), '') is not null
        then ': ' || btrim(new.resolution_notes) else '.' end;
    recipient_ids := array[new.requester_id, new.assigned_to];
  elsif new.assigned_to is distinct from old.assigned_to then
    notification_type := case when new.assigned_to is null then 'ticket_updated' else 'ticket_assigned' end;
    notification_message := case when new.assigned_to is null
      then 'Ticket ' || new.ticket_no || ' is no longer assigned to an employee.'
      else 'Ticket ' || new.ticket_no || ' was assigned to you.' end;
    recipient_ids := array[new.requester_id, new.assigned_to];
  elsif new.status is distinct from old.status
        or new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.priority is distinct from old.priority
        or new.discipline_id is distinct from old.discipline_id
        or new.category_id is distinct from old.category_id
        or new.due_date is distinct from old.due_date
        or new.resolution_notes is distinct from old.resolution_notes
        or new.request_type is distinct from old.request_type
        or new.is_confidential is distinct from old.is_confidential then
    notification_type := 'ticket_updated';
    notification_message := 'Ticket ' || new.ticket_no || ' was updated'
      || case when new.status is distinct from old.status then ' (status: ' || new.status::text || ').' else '.' end;
    recipient_ids := array[new.requester_id, new.assigned_to];
  else
    return new;
  end if;

  insert into public.notifications (user_id, ticket_id, type, message, dedupe_key)
  select distinct recipient_id, new.id, notification_type, notification_message,
    'ticket:' || new.id::text || ':' || txid_current()::text || ':' || notification_type || ':' || recipient_id::text
  from unnest(recipient_ids) as recipients(recipient_id)
  where recipient_id is not null
    and public.notification_is_enabled(recipient_id, notification_type)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  return new;
end;
$$;

create or replace function public.notify_ticket_comment_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket_number text;
  requester_id uuid;
  assigned_user_id uuid;
  recipient_ids uuid[];
begin
  select t.ticket_no, t.requester_id, t.assigned_to
    into ticket_number, requester_id, assigned_user_id
  from public.tickets t where t.id = new.ticket_id;
  if not found then return new; end if;

  recipient_ids := case when new.is_internal then array[assigned_user_id]
    else array[requester_id, assigned_user_id] end;

  insert into public.notifications (user_id, ticket_id, type, message, dedupe_key)
  select distinct recipient_id, new.ticket_id, 'ticket_updated', 'New comment on ticket ' || ticket_number || '.',
    'comment:' || new.id::text || ':' || recipient_id::text
  from unnest(recipient_ids) as recipients(recipient_id)
  where recipient_id is not null
    and recipient_id is distinct from new.author_id
    and public.notification_is_enabled(recipient_id, 'ticket_updated')
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  return new;
end;
$$;

commit;
