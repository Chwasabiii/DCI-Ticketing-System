begin;

create or replace function public.prevent_completed_ticket_status_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('resolved', 'closed') and new.status is distinct from old.status then
    if public.current_side() = 'client'
       and old.requester_id = auth.uid()
       and new.reopened_at is not null
       and new.status = 'open' then
      return new;
    end if;

    if public.current_side() = 'client'
       and old.requester_id = auth.uid()
       and old.status = 'resolved'
       and new.status = 'closed' then
      return new;
    end if;

    raise exception 'This ticket is complete. The requester must reopen it before its status can change.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_ticket_completed_status_guard on public.tickets;
create trigger zz_ticket_completed_status_guard
  before update on public.tickets
  for each row execute function public.prevent_completed_ticket_status_changes();

revoke all on function public.prevent_completed_ticket_status_changes() from public, anon, authenticated;

commit;
