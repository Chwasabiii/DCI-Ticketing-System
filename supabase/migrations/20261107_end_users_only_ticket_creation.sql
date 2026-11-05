begin;

-- Ticket creation is reserved for end users. Keep the restriction in the
-- database policy as well as the application action and page guard.
drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert"
  on public.tickets for insert to authenticated
  with check (
    public.current_side() = 'client'
    and requester_id = auth.uid()
    and assigned_to is null
    and status = 'open'
    and service_team_id = (
      select id from public.service_teams
      where slug = 'it-support' and is_active and is_in_scope
    )
  );

commit;
