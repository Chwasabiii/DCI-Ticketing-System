begin;

create table if not exists public.ticket_feedback (
  id bigint generated always as identity primary key,
  ticket_id bigint not null unique references public.tickets(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(btrim(comment)) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.ticket_feedback enable row level security;
alter table public.ticket_feedback force row level security;

drop policy if exists "ticket feedback read" on public.ticket_feedback;
create policy "ticket feedback read"
  on public.ticket_feedback for select to authenticated
  using (
    requester_id = auth.uid()
    or (
      public.current_side() in ('employee', 'admin')
      and public.can_view_ticket(ticket_id)
    )
  );

drop policy if exists "ticket feedback submit" on public.ticket_feedback;
create policy "ticket feedback submit"
  on public.ticket_feedback for insert to authenticated
  with check (
    requester_id = auth.uid()
    and public.current_side() = 'client'
    and exists (
      select 1 from public.tickets ticket
      where ticket.id = ticket_feedback.ticket_id
        and ticket.requester_id = auth.uid()
        and ticket.status in ('resolved', 'closed')
    )
  );

revoke all on public.ticket_feedback from anon, public;
grant select, insert on public.ticket_feedback to authenticated;
grant usage, select on sequence public.ticket_feedback_id_seq to authenticated;

commit;
