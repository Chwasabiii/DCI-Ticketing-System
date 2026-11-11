-- Candidate indexes for profile and ticket lookup hot paths.
-- Review with EXPLAIN (ANALYZE, BUFFERS) on production-sized data before applying.
create index if not exists profiles_full_name_idx
  on public.profiles (full_name);

create index if not exists profiles_email_idx
  on public.profiles (email);

create index if not exists profiles_active_employee_team_name_idx
  on public.profiles (service_team_id, full_name)
  where user_side = 'employee' and status = 'active';

create index if not exists faq_entries_published_order_idx
  on public.faq_entries (display_order, id)
  where is_published = true;

create index if not exists tickets_public_resolved_notes_order_idx
  on public.tickets (resolved_at desc)
  where status in ('resolved', 'closed')
    and is_confidential = false
    and resolution_notes is not null;

create index if not exists tickets_team_public_resolved_notes_order_idx
  on public.tickets (service_team_id, resolved_at desc)
  where status in ('resolved', 'closed')
    and is_confidential = false
    and resolution_notes is not null;
