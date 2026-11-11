begin;

create or replace function public.add_sla_business_seconds(
  p_started_at timestamptz,
  p_business_seconds integer
)
returns timestamptz
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  local_time timestamp without time zone := p_started_at at time zone 'Asia/Manila';
  remaining_seconds numeric := abs(p_business_seconds::bigint)::numeric;
  weekday integer;
  available_seconds numeric;
  step_seconds numeric;
begin
  if p_business_seconds = 0 then
    return p_started_at;
  end if;

  while remaining_seconds > 0 loop
    weekday := extract(isodow from local_time)::integer;

    if p_business_seconds > 0 then
      if weekday > 5 then
        local_time := date_trunc('day', local_time)
          + ((8 - weekday) * interval '1 day')
          + interval '9 hours';
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
      if weekday > 5 then
        local_time := date_trunc('day', local_time)
          - ((weekday - 5) * interval '1 day')
          + interval '17 hours';
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
immutable
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

create or replace function public.ticket_sla_is_at_risk(p_ticket_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        (t.ccg_request_type is not null
          and t.ccg_stage_due_at is not null
          and t.status::text not in ('waiting_for_info', 'resolved', 'closed', 'rejected')
          and now() >= t.ccg_stage_due_at - interval '8 hours')
        or
        (t.ccg_request_type is null and exists (
          select 1
          from public.ticket_sla_policies p
          where p.priority_group = case when t.priority::text in ('high', 'urgent') then 'high' else 'standard' end
            and (
              (t.first_response_at is null and now() >= public.add_sla_business_seconds(
                public.add_sla_business_days(coalesce(t.reopened_at, t.created_at), p.first_response_business_days),
                -greatest(3600::bigint, p.first_response_business_days::bigint * 7200)::integer
              ))
              or (t.resolved_at is null and t.status::text not in ('resolved', 'closed', 'rejected')
                and now() >= public.add_sla_business_seconds(
                  public.add_sla_business_days(coalesce(t.reopened_at, t.created_at), p.resolution_business_days),
                  -greatest(3600::bigint, p.resolution_business_days::bigint * 7200)::integer
                ))
            )
        ))
      )
  )
$$;

revoke all on function public.ticket_sla_is_at_risk(bigint) from public, anon, authenticated;

commit;
