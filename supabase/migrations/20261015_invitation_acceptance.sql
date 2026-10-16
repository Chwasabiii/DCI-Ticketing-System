begin;

alter table public.profiles
  add column if not exists invitation_pending boolean not null default false;

create or replace function public.complete_invitation(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or p_full_name is null
     or length(btrim(p_full_name)) = 0
     or length(btrim(p_full_name)) > 200 then
    raise exception 'A valid signed-in user and name are required';
  end if;

  update public.profiles
  set full_name = btrim(p_full_name),
      invitation_pending = false
  where id = auth.uid()
    and status = 'active'
    and invitation_pending = true;

  if not found then
    raise exception 'No active pending invitation was found';
  end if;
end;
$$;

revoke all on function public.complete_invitation(text) from public;
grant execute on function public.complete_invitation(text) to authenticated;

commit;
