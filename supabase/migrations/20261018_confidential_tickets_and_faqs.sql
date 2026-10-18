begin;

alter table public.tickets
  add column if not exists is_confidential boolean not null default false;

create or replace function public.can_view_ticket(p_ticket_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and public.current_side() is not null
      and (
        t.requester_id = auth.uid()
        or public.current_side() = 'admin'
        or public.can_approve_project_ticket(t.id)
        or (
          public.current_side() = 'employee'
          and (
            not t.is_confidential
            or t.assigned_to = auth.uid()
            or public.can_approve_project_ticket(t.id)
          )
        )
      )
  )
$$;

revoke all on function public.can_view_ticket(bigint) from public;
grant execute on function public.can_view_ticket(bigint) to authenticated;

drop policy if exists "tickets read" on public.tickets;
create policy "tickets read"
  on public.tickets for select to authenticated
  using (public.can_view_ticket(id));

drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert"
  on public.tickets for insert to authenticated
  with check (
    public.current_side() is not null
    and requester_id = auth.uid()
    and assigned_to is null
    and status = 'open'
  );

drop policy if exists "tickets update" on public.tickets;
create policy "tickets update"
  on public.tickets for update to authenticated
  using (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and (not is_confidential or assigned_to = auth.uid())
    )
  )
  with check (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and (not is_confidential or assigned_to = auth.uid())
    )
  );

drop policy if exists "events read" on public.ticket_events;
create policy "events read"
  on public.ticket_events for select to authenticated
  using (public.can_view_ticket(ticket_id));

drop policy if exists "comments read" on public.ticket_comments;
create policy "comments read"
  on public.ticket_comments for select to authenticated
  using (
    public.can_view_ticket(ticket_id)
    and (not is_internal or public.current_side() <> 'client')
  );

drop policy if exists "comments insert" on public.ticket_comments;
create policy "comments insert"
  on public.ticket_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_view_ticket(ticket_id)
    and (not is_internal or public.current_side() <> 'client')
  );

drop policy if exists "attachments read" on public.attachments;
create policy "attachments read"
  on public.attachments for select to authenticated
  using (public.can_view_ticket(ticket_id));

drop policy if exists "attachments insert" on public.attachments;
create policy "attachments insert"
  on public.attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (storage.foldername(file_path))[1] = ticket_id::text
    and (storage.foldername(file_path))[2] = auth.uid()::text
    and public.can_view_ticket(ticket_id)
  );

drop policy if exists "attachments bucket read" on storage.objects;
create policy "attachments bucket read" on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and exists (
      select 1
      from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and public.can_view_ticket(t.id)
    )
  );

drop policy if exists "attachments bucket upload" on storage.objects;
create policy "attachments bucket upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1
      from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and public.can_view_ticket(t.id)
    )
  );

drop policy if exists "attachments bucket delete own uploads" on storage.objects;
create policy "attachments bucket delete own uploads" on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1
      from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and public.can_view_ticket(t.id)
    )
  );

create table if not exists public.faq_entries (
  id bigint generated always as identity primary key,
  question text not null check (length(btrim(question)) between 1 and 300),
  answer text not null check (length(btrim(answer)) between 1 and 5000),
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.faq_entries enable row level security;
grant select, insert, update, delete on public.faq_entries to authenticated;
grant usage, select on sequence public.faq_entries_id_seq to authenticated;

drop policy if exists "faqs read published" on public.faq_entries;
create policy "faqs read published"
  on public.faq_entries for select to authenticated
  using (is_published or public.current_side() = 'admin');

drop policy if exists "faqs admin write" on public.faq_entries;
create policy "faqs admin write"
  on public.faq_entries for all to authenticated
  using (public.current_side() = 'admin')
  with check (public.current_side() = 'admin');

create or replace function public.set_faq_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists faq_entries_set_updated_at on public.faq_entries;
create trigger faq_entries_set_updated_at
  before update on public.faq_entries
  for each row execute function public.set_faq_updated_at();

commit;
