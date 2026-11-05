begin;

-- Turn off the old routing and project approval triggers while preserving their
-- tables and historical ticket values.
drop trigger if exists tickets_auto_route_before_insert on public.tickets;
drop trigger if exists tickets_zz_auto_route_audit on public.tickets;
drop trigger if exists tickets_auto_route_after_approval on public.tickets;
drop trigger if exists tickets_guard_project_approval on public.tickets;

update public.ticket_routing_rules set is_active = false;

drop policy if exists "tickets project approver read" on public.tickets;
drop policy if exists "project approvers read" on public.project_approvers;
drop policy if exists "project approvers admin write" on public.project_approvers;
drop policy if exists "routing rules admin read" on public.ticket_routing_rules;
revoke all on public.ticket_routing_rules, public.projects, public.departments,
  public.disciplines, public.categories, public.project_approvers from anon, authenticated;

drop function if exists public.find_similar_open_tickets(text, text, bigint);
create function public.find_similar_open_tickets(
  p_title text,
  p_description text default null
)
returns table (
  id bigint,
  ticket_no text,
  title text,
  status public.ticket_status,
  relevance real
)
language sql
stable
security definer
set search_path = ''
as $$
  with search_query as (
    select plainto_tsquery(
      'simple',
      concat_ws(' ', left(coalesce(p_title, ''), 200), left(coalesce(p_description, ''), 1000))
    ) as terms
  )
  select ticket.id,
         ticket.ticket_no,
         ticket.title,
         ticket.status,
         ts_rank(
           to_tsvector('simple', coalesce(ticket.title, '') || ' ' || coalesce(ticket.description, '')),
           search_query.terms
         )
  from public.tickets ticket
  cross join search_query
  where auth.uid() is not null
    and public.current_side() is not null
    and numnode(search_query.terms) > 0
    and ticket.status in ('open', 'under_review', 'assigned', 'in_progress', 'waiting_for_info')
    and public.can_view_ticket(ticket.id)
    and to_tsvector('simple', coalesce(ticket.title, '') || ' ' || coalesce(ticket.description, ''))
        @@ search_query.terms
    and ts_rank(
          to_tsvector('simple', coalesce(ticket.title, '') || ' ' || coalesce(ticket.description, '')),
          search_query.terms
        ) >= 0.025
  order by ts_rank(
    to_tsvector('simple', coalesce(ticket.title, '') || ' ' || coalesce(ticket.description, '')),
    search_query.terms
  ) desc, ticket.created_at desc
  limit 5
$$;
revoke all on function public.find_similar_open_tickets(text, text) from public, anon;
grant execute on function public.find_similar_open_tickets(text, text) to authenticated;

create or replace function public.can_view_ticket(p_ticket_id bigint)
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
      and public.current_side() is not null
      and (
        t.requester_id = auth.uid()
        or public.current_side() = 'admin'
        or (
          public.current_side() = 'employee'
          and (not t.is_confidential or t.assigned_to = auth.uid())
        )
      )
  )
$$;

drop policy if exists "attachments read" on public.attachments;
create policy "attachments read"
  on public.attachments for select to authenticated
  using (public.can_view_ticket(ticket_id));

drop policy if exists "attachments bucket read" on storage.objects;
create policy "attachments bucket read" on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and public.can_view_ticket((storage.foldername(name))[1]::bigint)
  );

drop policy if exists "tickets update" on public.tickets;
create policy "tickets update"
  on public.tickets for update to authenticated
  using (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and (not is_confidential or assigned_to = auth.uid())
      and exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Personnel')
      )
    )
  )
  with check (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and (not is_confidential or assigned_to = auth.uid())
      and exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.name in ('Coordinator', 'Personnel')
      )
    )
  );

create or replace function public.guard_ticket_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_side public.user_side := public.current_side();
  can_route boolean;
  can_work boolean;
  only_client_close_fields boolean;
  only_route_fields boolean;
  only_work_fields boolean;
begin
  if current_setting('pmsg.recording_first_response', true) = 'on'
     and (to_jsonb(new) - array['first_response_at','updated_at']) = (to_jsonb(old) - array['first_response_at','updated_at'])
     and new.first_response_at is not null then
    return new;
  end if;
  if actor_side = 'admin' then return new; end if;
  if actor_side is null then raise exception 'An active account is required to update tickets.'; end if;

  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'Coordinator'
  ) into can_route;
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'Personnel'
  ) into can_work;

  only_client_close_fields :=
    (to_jsonb(new) - array['status','closed_at','updated_at'])
      = (to_jsonb(old) - array['status','closed_at','updated_at']);
  if actor_side = 'client'
     and old.requester_id = auth.uid()
     and old.status = 'resolved'
     and new.status = 'closed'
     and only_client_close_fields then
    return new;
  end if;

  only_route_fields :=
    (to_jsonb(new) - array['priority','assigned_to','due_date','status','resolved_at','updated_at'])
      = (to_jsonb(old) - array['priority','assigned_to','due_date','status','resolved_at','updated_at']);
  if actor_side = 'employee' and can_route and only_route_fields
     and new.status not in ('resolved', 'closed', 'rejected') then
    return new;
  end if;

  only_work_fields :=
    (to_jsonb(new) - array['status','resolution_notes','resolved_at','updated_at'])
      = (to_jsonb(old) - array['status','resolution_notes','resolved_at','updated_at']);
  if actor_side = 'employee' and can_work and only_work_fields then
    return new;
  end if;

  raise exception 'You do not have permission to change these ticket fields.' using errcode = '42501';
end;
$$;

drop function if exists public.route_ticket_on_submission();
drop function if exists public.record_automatic_ticket_route();
drop function if exists public.route_ticket_after_project_approval();
drop function if exists public.guard_project_ticket_approval();
drop function if exists public.review_project_ticket(bigint, text, text);
drop function if exists public.set_project_approvers(bigint, uuid, uuid[]);
drop function if exists public.project_has_active_approver(bigint);
drop function if exists public.can_approve_project_ticket(bigint);

-- Keep SLA alerts working without the removed approval status or discipline role.
create or replace function public.escalate_breached_ticket_slas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  with breached as (
    select t.id as ticket_id, t.ticket_no, t.priority::text as priority,
      t.created_at, t.first_response_at, t.resolved_at, t.status::text as status,
      p.first_response_hours, p.resolution_hours
    from public.tickets t
    join public.ticket_sla_policies p on p.priority = t.priority::text
    where t.priority::text in ('high', 'urgent')
      and t.status::text <> 'rejected'
  ),
  breaches as (
    select b.*, breach.kind, breach.deadline
    from breached b
    cross join lateral (
      values
        ('first_response', b.created_at + make_interval(hours => b.first_response_hours)),
        ('resolution', b.created_at + make_interval(hours => b.resolution_hours))
    ) as breach(kind, deadline)
    where
      (breach.kind = 'first_response' and (
        (b.first_response_at is null and now() >= breach.deadline)
        or b.first_response_at > breach.deadline
      ))
      or
      (breach.kind = 'resolution' and (
        (b.resolved_at is null and b.status not in ('resolved', 'closed') and now() >= breach.deadline)
        or (b.resolved_at is not null and b.resolved_at > breach.deadline)
      ))
  ),
  recipients as (
    select distinct ur.user_id
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles profile on profile.id = ur.user_id
    where r.name = 'Manager'
      and profile.user_side in ('employee', 'admin')
      and profile.status = 'active'
  ),
  inserted as (
    insert into public.notifications (user_id, ticket_id, type, message, dedupe_key)
    select recipient.user_id, breach.ticket_id, 'ticket_sla_escalated',
      'Escalation: ' || coalesce(breach.priority, 'high') || '-priority ticket '
        || coalesce(breach.ticket_no, '#' || breach.ticket_id::text)
        || ' missed its ' || replace(breach.kind, '_', ' ') || ' SLA.',
      'sla-escalation:' || breach.ticket_id::text || ':' || breach.kind
    from breaches breach
    cross join recipients recipient
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;
revoke all on function public.escalate_breached_ticket_slas() from public, anon, authenticated;
grant execute on function public.escalate_breached_ticket_slas() to postgres;

commit;
