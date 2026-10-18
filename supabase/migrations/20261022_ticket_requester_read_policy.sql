begin;

drop policy if exists "tickets requester read own" on public.tickets;
create policy "tickets requester read own"
  on public.tickets for select to authenticated
  using (
    requester_id = auth.uid()
    and public.current_side() is not null
  );

commit;
