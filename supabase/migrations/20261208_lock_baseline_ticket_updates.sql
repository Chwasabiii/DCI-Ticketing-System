begin;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.tickets'::regclass
      and tgname = 'tickets_guard_update_permissions'
      and not tgisinternal
      and tgenabled in ('O', 'A')
  ) then
    execute 'drop policy if exists "tickets update" on public.tickets';
    execute 'create policy "tickets update"
      on public.tickets for update to authenticated
      using (public.current_side() = ''admin'')
      with check (public.current_side() = ''admin'')';
  end if;
end
$$;

commit;
