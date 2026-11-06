begin;

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
  elsif new.status is distinct from old.status and new.status = 'resolved' then
    notification_type := 'ticket_updated';
    notification_message := 'Ticket ' || new.ticket_no || ' has been resolved. Please review the resolution.';
    recipient_ids := array[new.requester_id, new.assigned_to];
  elsif new.status is distinct from old.status and new.status = 'rejected' then
    notification_type := 'ticket_rejected';
    notification_message := 'Ticket ' || new.ticket_no || ' was rejected'
      || case when nullif(btrim(new.resolution_notes), '') is not null
        then ': ' || btrim(new.resolution_notes) else '.' end;
    recipient_ids := array[new.requester_id, new.assigned_to];
  elsif new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is null then
      notification_type := 'ticket_updated';
      notification_message := 'Ticket ' || new.ticket_no || ' is no longer assigned to an employee.';
      recipient_ids := array[new.requester_id];
    else
      if new.assigned_to is distinct from new.requester_id then
        insert into public.notifications (user_id, ticket_id, type, message, dedupe_key)
        select new.assigned_to, new.id, 'ticket_assigned',
          'Ticket ' || new.ticket_no || ' was assigned to you.',
          'ticket:' || new.id::text || ':' || txid_current()::text || ':ticket_assigned:' || new.assigned_to::text
        where public.notification_is_enabled(new.assigned_to, 'ticket_assigned')
        on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
      end if;
      if new.requester_id is distinct from new.assigned_to then
        insert into public.notifications (user_id, ticket_id, type, message, dedupe_key)
        select new.requester_id, new.id, 'ticket_updated',
          'Ticket ' || new.ticket_no || ' was assigned to the service team.',
          'ticket:' || new.id::text || ':' || txid_current()::text || ':ticket_updated:' || new.requester_id::text
        where public.notification_is_enabled(new.requester_id, 'ticket_updated')
        on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
      end if;
      return new;
    end if;
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

commit;
