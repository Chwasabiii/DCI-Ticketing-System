-- Include the profile side in ticket activity so the UI can identify client
-- comments even when an account has no display name configured.
drop function if exists public.get_ticket_activity_profiles(bigint);

create function public.get_ticket_activity_profiles(p_ticket_id bigint)
returns table(id uuid, full_name text, email text, user_side public.user_side)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name,
    case when profile.id = auth.uid() then profile.email else null::text end as email,
    profile.user_side
  from public.profiles profile
  where public.can_view_ticket(p_ticket_id)
    and profile.id in (
      select event.actor_id from public.ticket_events event
      where event.ticket_id = p_ticket_id and event.actor_id is not null
      union
      select comment.author_id from public.ticket_comments comment
      where comment.ticket_id = p_ticket_id
        and comment.author_id is not null
        and (not comment.is_internal or public.current_side() <> 'client')
    )
$$;

revoke all on function public.get_ticket_activity_profiles(bigint) from public, anon;
grant execute on function public.get_ticket_activity_profiles(bigint) to authenticated;
