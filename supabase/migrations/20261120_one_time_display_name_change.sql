alter table public.profiles
  add column if not exists full_name_change_used boolean not null default false;

create or replace function public.change_own_display_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to change your display name.';
  end if;
  if p_full_name is null or length(btrim(p_full_name)) = 0 or length(btrim(p_full_name)) > 200 then
    raise exception 'Enter a display name up to 200 characters.';
  end if;
  update public.profiles
  set full_name = btrim(p_full_name), full_name_change_used = true
  where id = auth.uid() and status = 'active' and full_name_change_used = false;
  if not found then
    if exists (select 1 from public.profiles where id = auth.uid() and full_name_change_used) then
      raise exception 'Display name change already used.';
    end if;
    raise exception 'Could not find an active profile.';
  end if;
end;
$$;

revoke all on function public.change_own_display_name(text) from public;
grant execute on function public.change_own_display_name(text) to authenticated;
