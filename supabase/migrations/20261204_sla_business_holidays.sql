begin;

create table if not exists public.ticket_sla_holidays (
  holiday_date date primary key,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

alter table public.ticket_sla_holidays enable row level security;
grant select, insert, update, delete on public.ticket_sla_holidays to authenticated;

drop policy if exists "Ticket SLA holidays read" on public.ticket_sla_holidays;
create policy "Ticket SLA holidays read" on public.ticket_sla_holidays
  for select to authenticated using (public.current_side() is not null);

drop policy if exists "Ticket SLA holidays admin manage" on public.ticket_sla_holidays;
create policy "Ticket SLA holidays admin manage" on public.ticket_sla_holidays
  for all to authenticated
  using (public.current_side() = 'admin')
  with check (public.current_side() = 'admin');

create or replace function public.add_sla_business_seconds(
  p_started_at timestamptz,
  p_business_seconds integer
)
returns timestamptz
language plpgsql
stable
strict
set search_path = ''
as $$
declare
  local_time timestamp without time zone := p_started_at at time zone 'Asia/Manila';
  remaining_seconds numeric := abs(p_business_seconds::bigint)::numeric;
  weekday integer;
  local_date_value date;
  available_seconds numeric;
  step_seconds numeric;
begin
  if p_business_seconds = 0 then
    return p_started_at;
  end if;

  while remaining_seconds > 0 loop
    weekday := extract(isodow from local_time)::integer;
    local_date_value := local_time::date;

    if p_business_seconds > 0 then
      if weekday > 5 or exists (
        select 1 from public.ticket_sla_holidays holiday
        where holiday.holiday_date = local_date_value
      ) then
        local_time := date_trunc('day', local_time) + interval '1 day' + interval '9 hours';
        continue;
      end if;

      if local_time < date_trunc('day', local_time) + interval '9 hours' then
        local_time := date_trunc('day', local_time) + interval '9 hours';
        continue;
      end if;

      if local_time >= date_trunc('day', local_time) + interval '17 hours' then
        local_time := date_trunc('day', local_time) + interval '1 day' + interval '9 hours';
        continue;
      end if;

      available_seconds := extract(epoch from (
        date_trunc('day', local_time) + interval '17 hours' - local_time
      ));
      step_seconds := least(remaining_seconds, available_seconds);
      local_time := local_time + make_interval(secs => step_seconds::double precision);
      remaining_seconds := remaining_seconds - step_seconds;
    else
      if weekday > 5 or exists (
        select 1 from public.ticket_sla_holidays holiday
        where holiday.holiday_date = local_date_value
      ) then
        local_time := date_trunc('day', local_time) - interval '1 day' + interval '17 hours';
        continue;
      end if;

      if local_time <= date_trunc('day', local_time) + interval '9 hours' then
        local_time := date_trunc('day', local_time) - interval '1 day' + interval '17 hours';
        continue;
      end if;

      if local_time > date_trunc('day', local_time) + interval '17 hours' then
        local_time := date_trunc('day', local_time) + interval '17 hours';
        continue;
      end if;

      available_seconds := extract(epoch from (
        local_time - (date_trunc('day', local_time) + interval '9 hours')
      ));
      step_seconds := least(remaining_seconds, available_seconds);
      local_time := local_time - make_interval(secs => step_seconds::double precision);
      remaining_seconds := remaining_seconds - step_seconds;
    end if;
  end loop;

  return local_time at time zone 'Asia/Manila';
end;
$$;

create or replace function public.add_sla_business_days(
  p_started_at timestamptz,
  p_business_days integer
)
returns timestamptz
language plpgsql
stable
strict
set search_path = ''
as $$
begin
  if p_business_days < 0 then
    raise exception 'Business days must not be negative.';
  end if;
  if p_business_days > 74565 then
    raise exception 'Business day target is too large.';
  end if;

  return public.add_sla_business_seconds(p_started_at, p_business_days * 28800);
end;
$$;

commit;
