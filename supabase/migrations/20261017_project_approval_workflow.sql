begin;

alter table public.projects
  add column if not exists pm_user_id uuid references public.profiles(id) on delete set null;

create table if not exists public.project_approvers (
  project_id bigint not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.project_approvers enable row level security;

create policy "project approvers read"
  on public.project_approvers for select to authenticated
  using (public.current_side() is not null);

create policy "project approvers admin write"
  on public.project_approvers for all to authenticated
  using (public.current_side() = 'admin')
  with check (public.current_side() = 'admin');

alter table public.tickets
  add column if not exists request_type text not null default 'general'
    check (request_type in ('general', 'access_request', 'incident_report')),
  add column if not exists approval_status text not null default 'not_required'
    check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approval_comment text;

create or replace function public.can_approve_project_ticket(p_ticket_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets t
    join public.projects p on p.id = t.project_id
    join public.profiles actor on actor.id = auth.uid() and actor.status = 'active'
    where t.id = p_ticket_id
      and (t.approval_status = 'pending' or t.reviewed_by = auth.uid())
      and (
        p.pm_user_id = auth.uid()
        or exists (
          select 1
          from public.project_approvers pa
          where pa.project_id = p.id and pa.user_id = auth.uid()
        )
      )
  )
$$;

revoke all on function public.can_approve_project_ticket(bigint) from public;
grant execute on function public.can_approve_project_ticket(bigint) to authenticated;

create policy "tickets project approver read"
  on public.tickets for select to authenticated
  using (public.can_approve_project_ticket(id));

create or replace function public.guard_project_ticket_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.project_id is null then
      new.approval_status := 'not_required';
    else
      if not exists (
        select 1 from public.projects p
        where p.id = new.project_id
          and (
              exists (
                select 1 from public.profiles pm
                where pm.id = p.pm_user_id and pm.status = 'active'
              )
              or exists (
                select 1 from public.project_approvers pa
                join public.profiles approver on approver.id = pa.user_id
                where pa.project_id = p.id and approver.status = 'active'
              )
            )
      ) then
        raise exception 'This project has no assigned PM or approvers yet.';
      end if;
      new.approval_status := 'pending';
    end if;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.approval_comment := null;
    return new;
  end if;

  if current_setting('pmsg.reviewing_ticket_approval', true) is distinct from 'on'
     and (
       new.approval_status is distinct from old.approval_status
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.approval_comment is distinct from old.approval_comment
     ) then
    raise exception 'Ticket approval must be recorded through the approval workflow.';
  end if;

  if old.approval_status in ('pending', 'rejected')
     and (
       new.status is distinct from old.status
       or new.assigned_to is distinct from old.assigned_to
       or new.discipline_id is distinct from old.discipline_id
     ) then
    raise exception 'This ticket cannot be routed or worked until project approval is complete.';
  end if;
  if new.project_id is distinct from old.project_id then
    raise exception 'The project cannot be changed after a ticket is submitted.';
  end if;

  return new;
end
$$;

drop trigger if exists tickets_guard_project_approval on public.tickets;
create trigger tickets_guard_project_approval
  before insert or update on public.tickets
  for each row execute function public.guard_project_ticket_approval();

create or replace function public.review_project_ticket(
  p_ticket_id bigint,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_approval text;
  clean_comment text := nullif(btrim(p_comment), '');
begin
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approve or reject.';
  end if;
  if p_decision = 'rejected' and clean_comment is null then
    raise exception 'Enter a reason when rejecting a ticket.';
  end if;
  if length(coalesce(clean_comment, '')) > 2000 then
    raise exception 'Approval comments must be 2000 characters or fewer.';
  end if;
  if not public.can_approve_project_ticket(p_ticket_id) then
    raise exception 'You are not an active approver for this project.';
  end if;

  select t.approval_status into current_approval
  from public.tickets t
  where t.id = p_ticket_id
  for update;

  if current_approval is distinct from 'pending' then
    raise exception 'This ticket is no longer awaiting project approval.';
  end if;

  perform pg_catalog.set_config('pmsg.reviewing_ticket_approval', 'on', true);
  update public.tickets
  set approval_status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      approval_comment = clean_comment
  where id = p_ticket_id;

  insert into public.ticket_events (ticket_id, actor_id, event_type, note)
  values (
    p_ticket_id,
    auth.uid(),
    'approval_changed',
    pg_catalog.concat(pg_catalog.upper(pg_catalog.left(p_decision, 1)), pg_catalog.substr(p_decision, 2),
                      case when clean_comment is null then '' else ': ' || clean_comment end)
  );
end
$$;

revoke all on function public.review_project_ticket(bigint, text, text) from public;
grant execute on function public.review_project_ticket(bigint, text, text) to authenticated;

create or replace function public.set_project_approvers(
  p_project_id bigint,
  p_pm_user_id uuid,
  p_approver_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_side() is distinct from 'admin' then
    raise exception 'Only active administrators can assign project approvers.';
  end if;
  if p_pm_user_id is null and coalesce(pg_catalog.cardinality(p_approver_ids), 0) = 0 then
    raise exception 'Assign a PM or at least one project approver.';
  end if;
  if p_pm_user_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = p_pm_user_id and p.status = 'active'
  ) then
    raise exception 'Choose an active profile as the project PM.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_approver_ids, '{}'::uuid[])) requested(user_id)
    where not exists (
      select 1 from public.profiles p
      where p.id = requested.user_id and p.status = 'active'
    )
  ) then
    raise exception 'Choose only active profiles as project approvers.';
  end if;

  update public.projects set pm_user_id = p_pm_user_id where id = p_project_id;
  if not found then
    raise exception 'Project not found.';
  end if;

  delete from public.project_approvers where project_id = p_project_id;
  insert into public.project_approvers (project_id, user_id)
  select p_project_id, approver_id
  from (
    select distinct requested.user_id as approver_id
    from unnest(coalesce(p_approver_ids, '{}'::uuid[])) requested(user_id)
  ) selected
  where selected.approver_id is distinct from p_pm_user_id;
end
$$;

revoke all on function public.set_project_approvers(bigint, uuid, uuid[]) from public;
grant execute on function public.set_project_approvers(bigint, uuid, uuid[]) to authenticated;

drop policy if exists "attachments read" on public.attachments;
create policy "attachments read"
  on public.attachments for select to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and (
        t.requester_id = auth.uid()
        or public.current_side() in ('employee', 'admin')
        or public.can_approve_project_ticket(t.id)
      )
  ));

drop policy if exists "attachments bucket read" on storage.objects;
create policy "attachments bucket read" on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (
          t.requester_id = auth.uid()
          or public.current_side() in ('employee', 'admin')
          or public.can_approve_project_ticket(t.id)
        )
    )
  );

commit;
