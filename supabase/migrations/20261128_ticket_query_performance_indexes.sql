create index if not exists tickets_created_at_desc_idx
  on public.tickets (created_at desc);

create index if not exists ticket_events_ticket_created_at_idx
  on public.ticket_events (ticket_id, created_at);
drop index if exists public.ticket_events_ticket_id_idx;

create index if not exists ticket_comments_ticket_created_at_idx
  on public.ticket_comments (ticket_id, created_at);

create index if not exists attachments_ticket_created_at_idx
  on public.attachments (ticket_id, created_at);
