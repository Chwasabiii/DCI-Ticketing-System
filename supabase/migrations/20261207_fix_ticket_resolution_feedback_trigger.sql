begin;

drop trigger if exists capture_ticket_resolved_assignee on public.tickets;
drop trigger if exists zzzzzz_capture_resolved_assignee_insert on public.tickets;
drop trigger if exists zzzzzz_capture_resolved_assignee_update on public.tickets;

-- Run after ticket permission guards so the added attribution field does not
-- make an otherwise authorized ticket update appear to change extra fields.
create trigger zzzzzz_capture_resolved_assignee_insert
  before insert on public.tickets
  for each row execute function public.capture_ticket_resolved_assignee();

create trigger zzzzzz_capture_resolved_assignee_update
  before update of status, assigned_to, resolved_assignee_id on public.tickets
  for each row execute function public.capture_ticket_resolved_assignee();

commit;
