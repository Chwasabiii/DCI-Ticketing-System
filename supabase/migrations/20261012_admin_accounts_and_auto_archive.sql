begin;

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.current_side()
returns public.user_side language sql stable security definer set search_path = '' as $$
  select user_side from public.profiles where id = auth.uid() and status = 'active'
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['departments','profiles','roles','user_roles',
                                    'disciplines','discipline_members','categories','projects']
  loop
    execute format('drop policy if exists "%s read" on public.%I', table_name, table_name);
    if table_name = 'profiles' then
      execute format('create policy "%s read" on public.%I for select to authenticated using (id = auth.uid() or public.current_side() is not null)', table_name, table_name);
    else
      execute format('create policy "%s read" on public.%I for select to authenticated using (public.current_side() is not null)', table_name, table_name);
    end if;
  end loop;
end $$;

drop policy if exists "tickets read" on public.tickets;
create policy "tickets read" on public.tickets for select to authenticated
  using (public.current_side() is not null
         and (requester_id = auth.uid() or public.current_side() in ('employee','admin')));

drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert" on public.tickets for insert to authenticated
  with check (public.current_side() is not null and requester_id = auth.uid());

drop policy if exists "notifications read" on public.notifications;
create policy "notifications read" on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.current_side() is not null);

drop policy if exists "notifications update" on public.notifications;
create policy "notifications update" on public.notifications for update to authenticated
  using (user_id = auth.uid() and public.current_side() is not null);

create or replace function public.archive_inactive_profiles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_count integer;
begin
  update public.profiles p
  set status = 'inactive'
  from auth.users u
  where p.id = u.id
    and p.status = 'active'
    and p.user_side <> 'admin'
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '6 months';

  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

revoke all on function public.archive_inactive_profiles() from public;
grant execute on function public.archive_inactive_profiles() to postgres;

select cron.schedule(
  'archive-inactive-profiles-daily',
  '17 3 * * *',
  'select public.archive_inactive_profiles();'
);

commit;
