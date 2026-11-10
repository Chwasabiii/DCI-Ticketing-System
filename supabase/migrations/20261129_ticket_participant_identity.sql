begin;

drop function if exists public.get_ticket_profile_summary(bigint, uuid);
drop function if exists public.get_ticket_activity_profiles(bigint);

-- Ticket participants need a usable identity when a profile has no display name.
-- The ticket visibility check and participant checks keep this data scoped to
-- people who can already view the ticket and are part of its history.
create function public.get_ticket_profile_summary(p_ticket_id bigint, p_profile_id uuid)
returns table(id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name, profile.email
  from public.profiles profile
  where profile.id = p_profile_id
    and public.can_view_ticket(p_ticket_id)
    and exists (
      select 1 from public.tickets ticket
      where ticket.id = p_ticket_id
        and (ticket.requester_id = profile.id or ticket.assigned_to = profile.id or ticket.reviewed_by = profile.id)
    )
$$;
revoke all on function public.get_ticket_profile_summary(bigint, uuid) from public, anon;
grant execute on function public.get_ticket_profile_summary(bigint, uuid) to authenticated;

create function public.get_ticket_activity_profiles(p_ticket_id bigint)
returns table(id uuid, full_name text, email text, user_side public.user_side)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name, profile.email, profile.user_side
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

commit;
