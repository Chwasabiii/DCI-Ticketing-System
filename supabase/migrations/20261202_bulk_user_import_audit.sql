begin;

create table public.bulk_user_import_runs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  file_name text not null,
  total_rows integer not null check (total_rows between 1 and 500),
  invited_count integer not null default 0 check (invited_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  status text not null default 'running' check (status in ('running', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index bulk_user_import_runs_admin_created_idx
  on public.bulk_user_import_runs (admin_id, created_at desc);

create table public.bulk_user_import_items (
  run_id uuid not null references public.bulk_user_import_runs(id) on delete cascade,
  email text not null,
  status text not null default 'processing'
    check (status in ('processing', 'invited', 'failed', 'skipped')),
  reason text,
  updated_at timestamptz not null default now(),
  primary key (run_id, email)
);

alter table public.bulk_user_import_runs enable row level security;
alter table public.bulk_user_import_items enable row level security;
revoke all on public.bulk_user_import_runs, public.bulk_user_import_items from public, anon, authenticated;
grant all on public.bulk_user_import_runs, public.bulk_user_import_items to service_role;

create or replace function public.start_bulk_user_import(p_file_name text, p_total_rows integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_run_id uuid;
  recent_runs integer;
begin
  if auth.uid() is null or public.current_side() is distinct from 'admin' then
    raise exception 'Only active administrators can start a bulk user import.'
      using errcode = '42501';
  end if;
  if p_total_rows is null or p_total_rows < 1 or p_total_rows > 500 then
    raise exception 'The import must contain between 1 and 500 rows.'
      using errcode = '22023';
  end if;
  if p_file_name is null or length(btrim(p_file_name)) = 0 then
    raise exception 'A file name is required.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select count(*) into recent_runs
  from public.bulk_user_import_runs run
  where run.admin_id = auth.uid()
    and run.created_at >= now() - interval '1 hour';
  if recent_runs >= 5 then
    raise exception 'Bulk import is limited to five runs per administrator per hour.'
      using errcode = '53300';
  end if;

  insert into public.bulk_user_import_runs (admin_id, file_name, total_rows)
  values (auth.uid(), left(btrim(p_file_name), 255), p_total_rows)
  returning id into created_run_id;
  return created_run_id;
end;
$$;

create or replace function public.claim_bulk_user_import_item(p_run_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_total_rows integer;
  claimed_item_count integer;
begin
  if auth.uid() is null or public.current_side() is distinct from 'admin' then
    raise exception 'Only active administrators can process a bulk user import.'
      using errcode = '42501';
  end if;
  select run.total_rows into run_total_rows
  from public.bulk_user_import_runs run
  where run.id = p_run_id and run.admin_id = auth.uid() and run.status = 'running'
  for update;
  if not found then
    raise exception 'The import run is unavailable.'
      using errcode = '42501';
  end if;
  if p_email is null or length(btrim(p_email)) > 254 then
    raise exception 'A valid email is required.'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.bulk_user_import_items item
    where item.run_id = p_run_id and item.email = lower(btrim(p_email))
  ) then
    return false;
  end if;

  select count(*) into claimed_item_count
  from public.bulk_user_import_items item
  where item.run_id = p_run_id;
  if claimed_item_count >= run_total_rows then
    raise exception 'The import already contains its maximum number of rows.'
      using errcode = '22023';
  end if;

  insert into public.bulk_user_import_items (run_id, email)
  values (p_run_id, lower(btrim(p_email)))
  on conflict (run_id, email) do nothing;
  return found;
end;
$$;

create or replace function public.record_bulk_user_import_item(
  p_run_id uuid,
  p_email text,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_side() is distinct from 'admin' then
    raise exception 'Only active administrators can update a bulk user import.'
      using errcode = '42501';
  end if;
  if p_status not in ('invited', 'failed', 'skipped') then
    raise exception 'Invalid import item status.'
      using errcode = '22023';
  end if;

  update public.bulk_user_import_items item
  set status = p_status, reason = left(p_reason, 1000), updated_at = now()
  from public.bulk_user_import_runs run
  where item.run_id = p_run_id
    and item.email = lower(btrim(p_email))
    and item.status = 'processing'
    and run.id = item.run_id
    and run.admin_id = auth.uid()
    and run.status = 'running';
  if not found then
    raise exception 'The import item could not be recorded.'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.finish_bulk_user_import(p_run_id uuid)
returns table (invited_count integer, failed_count integer, skipped_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_side() is distinct from 'admin' then
    raise exception 'Only active administrators can finish a bulk user import.'
      using errcode = '42501';
  end if;

  return query
  with item_counts as (
    select
      run.total_rows,
      count(item.run_id) filter (where item.status = 'invited')::integer as invited,
      count(item.run_id) filter (where item.status in ('failed', 'processing'))::integer as failed,
      count(item.run_id) filter (where item.status = 'skipped')::integer as skipped
    from public.bulk_user_import_runs run
    left join public.bulk_user_import_items item on item.run_id = run.id
    where run.id = p_run_id
    group by run.total_rows
  ),
  updated_run as (
    update public.bulk_user_import_runs run
    set invited_count = item_counts.invited,
        failed_count = greatest(item_counts.failed, item_counts.total_rows - item_counts.invited - item_counts.skipped),
        skipped_count = item_counts.skipped,
        status = 'completed',
        completed_at = now()
    from item_counts
    where run.id = p_run_id
      and run.admin_id = auth.uid()
      and run.status = 'running'
    returning run.invited_count, run.failed_count, run.skipped_count
  )
  select updated_run.invited_count, updated_run.failed_count, updated_run.skipped_count
  from updated_run;
  if not found then
    raise exception 'The import run could not be completed.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.start_bulk_user_import(text, integer) from public, anon;
revoke all on function public.claim_bulk_user_import_item(uuid, text) from public, anon;
revoke all on function public.record_bulk_user_import_item(uuid, text, text, text) from public, anon;
revoke all on function public.finish_bulk_user_import(uuid) from public, anon;
grant execute on function public.start_bulk_user_import(text, integer) to authenticated;
grant execute on function public.claim_bulk_user_import_item(uuid, text) to authenticated;
grant execute on function public.record_bulk_user_import_item(uuid, text, text, text) to authenticated;
grant execute on function public.finish_bulk_user_import(uuid) to authenticated;

commit;
