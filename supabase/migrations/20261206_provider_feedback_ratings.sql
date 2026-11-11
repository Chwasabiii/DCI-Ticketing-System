begin;

alter table public.tickets
  add column if not exists resolved_assignee_id uuid references public.profiles(id) on delete set null;

alter table public.ticket_feedback
  add column if not exists provider_id uuid references public.profiles(id) on delete set null;

create index if not exists ticket_feedback_provider_id_idx
  on public.ticket_feedback (provider_id)
  where provider_id is not null;

comment on column public.tickets.resolved_assignee_id is
  'Assignee captured when the ticket is resolved; null for older tickets without a reliable resolution-time assignee.';

comment on column public.ticket_feedback.provider_id is
  'Provider attributed to this feedback from the ticket assignee captured at resolution.';

create or replace function public.capture_ticket_resolved_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('resolved', 'closed') then
      new.resolved_assignee_id := new.assigned_to;
    else
      new.resolved_assignee_id := null;
    end if;
  elsif new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_assignee_id := new.assigned_to;
  elsif new.status not in ('resolved', 'closed') then
    new.resolved_assignee_id := null;
  else
    new.resolved_assignee_id := old.resolved_assignee_id;
  end if;

  return new;
end
$$;

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

create or replace function public.set_ticket_feedback_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select ticket.resolved_assignee_id
    into new.provider_id
  from public.tickets ticket
  where ticket.id = new.ticket_id
    and ticket.requester_id = new.requester_id
    and ticket.status in ('resolved', 'closed');

  if not found then
    new.provider_id := null;
  end if;

  return new;
end
$$;

revoke all on function public.set_ticket_feedback_provider() from public, anon, authenticated;

drop trigger if exists set_ticket_feedback_provider on public.ticket_feedback;
create trigger set_ticket_feedback_provider
  before insert on public.ticket_feedback
  for each row execute function public.set_ticket_feedback_provider();

create or replace function public.get_my_ticket_feedback_summary()
returns table(average_rating numeric, response_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.user_side = 'employee'
      and profile.status = 'active'
  ) then
    raise exception 'Only active service providers can view a feedback summary.';
  end if;

  return query
  select round(avg(feedback.rating)::numeric, 1), count(*)
  from public.ticket_feedback feedback
  where feedback.provider_id = auth.uid();
end
$$;

revoke all on function public.get_my_ticket_feedback_summary() from public, anon;
grant execute on function public.get_my_ticket_feedback_summary() to authenticated;

commit;
