begin;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

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
    notification_message := case
      when new.assigned_to is null then 'Ticket ' || new.ticket_no || ' is no longer assigned to an employee.'
      else 'Ticket ' || new.ticket_no || ' was assigned to you.'
    end;
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

  insert into public.notifications (user_id, ticket_id, type, message)
  select distinct recipient_id, new.id, notification_type, notification_message
  from unnest(recipient_ids) as recipients(recipient_id)
  where recipient_id is not null;

  return new;
end;
$$;

revoke all on function public.notify_ticket_participants() from public, anon, authenticated;
drop trigger if exists tickets_notify_participants on public.tickets;
create trigger tickets_notify_participants
  after insert or update on public.tickets
  for each row execute function public.notify_ticket_participants();

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
  from public.tickets t
  where t.id = new.ticket_id;

  if not found then return new; end if;

  recipient_ids := case when new.is_internal
    then array[assigned_user_id]
    else array[requester_id, assigned_user_id]
  end;

  insert into public.notifications (user_id, ticket_id, type, message)
  select distinct recipient_id, new.ticket_id, 'ticket_updated',
    'New comment on ticket ' || ticket_number || '.'
  from unnest(recipient_ids) as recipients(recipient_id)
  where recipient_id is not null
    and recipient_id is distinct from new.author_id;

  return new;
end;
$$;

revoke all on function public.notify_ticket_comment_participants() from public, anon, authenticated;
drop trigger if exists ticket_comments_notify_participants on public.ticket_comments;
create trigger ticket_comments_notify_participants
  after insert on public.ticket_comments
  for each row execute function public.notify_ticket_comment_participants();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;

commit;
