begin;

-- Keep a single sequence for every service team so ticket numbers remain
-- globally unique while the prefix identifies the team that received them.
alter table public.tickets
  alter column ticket_no drop default;

create or replace function public.assign_team_ticket_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_slug text;
  ticket_prefix text;
begin
  select team.slug into team_slug
  from public.service_teams team
  where team.id = new.service_team_id;

  ticket_prefix := case team_slug
    when 'it-support' then 'IT'
    when 'cost-control' then 'CCG'
    else 'DCI'
  end;

  new.ticket_no := ticket_prefix || '-'
    || to_char(clock_timestamp(), 'YYYY') || '-'
    || lpad(nextval('public.ticket_no_seq')::text, 4, '0');
  return new;
end;
$$;

revoke all on function public.assign_team_ticket_number() from public, anon, authenticated;

drop trigger if exists tickets_assign_team_ticket_number on public.tickets;
create trigger tickets_assign_team_ticket_number
  before insert on public.tickets
  for each row execute function public.assign_team_ticket_number();

commit;
