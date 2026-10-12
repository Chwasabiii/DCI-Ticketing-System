begin;

alter table public.attachments enable row level security;

drop policy if exists "attachments read" on public.attachments;
create policy "attachments read" on public.attachments for select to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
  ));

drop policy if exists "attachments insert" on public.attachments;
create policy "attachments insert" on public.attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (storage.foldername(file_path))[1] = ticket_id::text
    and (storage.foldername(file_path))[2] = auth.uid()::text
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
    )
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-attachments', 'ticket-attachments', false, 10485760)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "attachments bucket read" on storage.objects;
create policy "attachments bucket read" on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
    )
  );

drop policy if exists "attachments bucket upload" on storage.objects;
create policy "attachments bucket upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
    )
  );

drop policy if exists "attachments bucket delete own uploads" on storage.objects;
create policy "attachments bucket delete own uploads" on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.requester_id = auth.uid() or public.current_side() in ('employee','admin'))
    )
  );

commit;