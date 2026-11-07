begin;

alter table public.tickets
  add column if not exists ccg_request_types text[] not null default '{}';

update public.tickets
set ccg_request_types = array[ccg_request_type]
where ccg_request_type is not null and cardinality(ccg_request_types) = 0;

alter table public.tickets
  drop constraint if exists tickets_ccg_request_bundle_check,
  add constraint tickets_ccg_request_bundle_check check (
    (ccg_request_type is null and cardinality(ccg_request_types) = 0 and ccg_request_scope is null)
    or (
      ccg_request_type is not null
      and ccg_request_type = any(ccg_request_types)
      and cardinality(ccg_request_types) between 1 and 3
      and array_position(ccg_request_types, null) is null
      and ccg_request_types <@ array['unit_rate', 'vendor_list', 'tor_contracts']::text[]
      and (
        ('unit_rate' = any(ccg_request_types) and ccg_request_scope in ('whole_boq', 'per_material'))
        or ('unit_rate' <> all(ccg_request_types) and ccg_request_scope is null)
      )
    )
  );

drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert"
  on public.tickets for insert to authenticated
  with check (
    public.current_side() = 'client'
    and requester_id = auth.uid()
    and (
      (assigned_to is null and status = 'open'
        and current_setting('pmsg.auto_routing_ticket', true) is distinct from 'on')
      or (current_setting('pmsg.auto_routing_ticket', true) = 'on'
        and status in ('open', 'assigned')
        and (assigned_to is null or exists (
          select 1 from public.profiles assignee
          join public.service_teams team on team.id = tickets.service_team_id
          where assignee.id = assigned_to
            and assignee.user_side = 'employee'
            and assignee.status = 'active'
            and assignee.service_team_id = team.id
            and (
              team.slug <> 'cost-control'
              or exists (
                select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                where ur.user_id = assignee.id and r.name in ('Personnel', 'Coordinator')
              )
            )
        )))
    )
    and ccg_database_result is null
    and ccg_followup_type is null
    and ccg_followup_status is null
    and exists (
      select 1 from public.service_teams team
      where team.id = service_team_id
        and team.is_active and team.is_in_scope
        and team.slug in ('it-support', 'cost-control')
        and (
          (team.slug = 'it-support'
            and ccg_request_type is null
            and cardinality(ccg_request_types) = 0
            and ccg_request_scope is null
            and ccg_procurement_in_scope is null)
          or (team.slug = 'cost-control'
            and ccg_procurement_in_scope is false
            and ccg_request_type = any(ccg_request_types)
            and cardinality(ccg_request_types) between 1 and 3
            and ccg_request_types <@ array['unit_rate', 'vendor_list', 'tor_contracts']::text[]
            and (
              ('unit_rate' = any(ccg_request_types) and ccg_request_scope in ('whole_boq', 'per_material'))
              or ('unit_rate' <> all(ccg_request_types) and ccg_request_scope is null)
            ))
        )
    )
  );

create or replace function public.guard_ccg_request_bundle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_unit_rate boolean;
  has_vendor_list boolean;
  needs_vendor_quote boolean;
  needs_vendor_search boolean;
  needs_database_check boolean;
  expected_primary text;
  expected_followup text;
begin
  if tg_op = 'INSERT' and new.ccg_request_type is not null and cardinality(new.ccg_request_types) = 0 then
    new.ccg_request_types := array[new.ccg_request_type];
  end if;

  if tg_op = 'UPDATE' then
    if old.ccg_request_types is distinct from new.ccg_request_types
       or old.ccg_request_type is distinct from new.ccg_request_type
       or old.ccg_request_scope is distinct from new.ccg_request_scope then
      raise exception 'The CCG request types and scope cannot be changed after submission.' using errcode = '42501';
    end if;
    if old.ccg_request_type is null then return new; end if;
  elsif new.ccg_request_type is null then
    if cardinality(new.ccg_request_types) <> 0 then
      raise exception 'CCG request types require a CCG ticket.' using errcode = '23514';
    end if;
    return new;
  end if;

  if cardinality(new.ccg_request_types) = 0
     or not (new.ccg_request_type = any(new.ccg_request_types))
     or cardinality(new.ccg_request_types) <> cardinality(array(select distinct unnest(new.ccg_request_types))) then
    raise exception 'Select one or more unique CCG request types.' using errcode = '23514';
  end if;

  has_unit_rate := 'unit_rate' = any(new.ccg_request_types);
  has_vendor_list := 'vendor_list' = any(new.ccg_request_types);
  needs_vendor_quote := has_unit_rate and new.ccg_request_scope = 'per_material';
  needs_vendor_search := has_vendor_list;
  needs_database_check := not (cardinality(new.ccg_request_types) = 1 and has_unit_rate and new.ccg_request_scope = 'whole_boq');

  expected_primary := case
    when needs_vendor_quote then 'unit_rate'
    when has_vendor_list then 'vendor_list'
    when has_unit_rate then 'unit_rate'
    else 'tor_contracts'
  end;
  if new.ccg_request_type <> expected_primary then
    raise exception 'The primary CCG request type is inconsistent with the selected services.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.status = 'under_review' and new.status in ('in_progress', 'resolved') then
    if needs_database_check and new.ccg_database_result not in ('available', 'unavailable') then
      raise exception 'Record one shared database result for the selected CCG services.' using errcode = '23514';
    end if;
    if not needs_database_check and new.ccg_database_result is distinct from 'not_required' then
      raise exception 'A whole BOQ only request does not use a database check.' using errcode = '23514';
    end if;

    if new.ccg_database_result = 'unavailable' and (needs_vendor_quote or needs_vendor_search) then
      expected_followup := case when needs_vendor_quote then 'vendor_quote' else 'vendor_search' end;
      if new.status = 'resolved'
         or new.ccg_followup_type is distinct from expected_followup
         or new.ccg_followup_status is distinct from 'pending' then
        raise exception 'Start the shared vendor follow-up for all unavailable selected services before continuing.' using errcode = '23514';
      end if;
    elsif new.ccg_followup_type is not null or new.ccg_followup_status is not null then
      raise exception 'This shared CCG result does not require vendor follow-up.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_ccg_request_bundle_guard on public.tickets;
create trigger aaa_ccg_request_bundle_guard
  before insert or update on public.tickets
  for each row execute function public.guard_ccg_request_bundle();
revoke all on function public.guard_ccg_request_bundle() from public, anon, authenticated;

create or replace function public.add_ccg_bundle_search_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and 'unit_rate' = any(new.ccg_request_types)
     and new.ccg_request_scope = 'per_material'
     and 'vendor_list' = any(new.ccg_request_types)
     and new.status = 'in_progress'
     and new.ccg_followup_type = 'vendor_quote'
     and new.ccg_followup_status = 'pending'
     and (old.status is distinct from 'in_progress' or old.ccg_followup_status is distinct from 'pending') then
    new.ccg_stage_due_at := public.add_ccg_business_days(now(), 5);
  end if;
  return new;
end;
$$;

drop trigger if exists zzz_ccg_bundle_search_deadline on public.tickets;
create trigger zzz_ccg_bundle_search_deadline
  before update on public.tickets
  for each row execute function public.add_ccg_bundle_search_deadline();
revoke all on function public.add_ccg_bundle_search_deadline() from public, anon, authenticated;

commit;
