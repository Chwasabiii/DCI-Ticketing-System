begin;

-- Full-text matching stays inside the caller's ticket visibility boundary.
create index if not exists tickets_search_text_idx
  on public.tickets using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  );

create or replace function public.find_similar_open_tickets(
  p_title text,
  p_description text default null,
  p_project_id bigint default null
)
returns table (
  id bigint,
  ticket_no text,
  title text,
  status public.ticket_status,
  project_name text,
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
         project.name,
         ts_rank(
           to_tsvector('simple', coalesce(ticket.title, '') || ' ' || coalesce(ticket.description, '')),
           search_query.terms
         ) * case when p_project_id is not null and ticket.project_id = p_project_id then 1.25 else 1 end
  from public.tickets ticket
  left join public.projects project on project.id = ticket.project_id
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
  order by (p_project_id is not null and ticket.project_id = p_project_id) desc,
           ts_rank(
             to_tsvector('simple', coalesce(ticket.title, '') || ' ' || coalesce(ticket.description, '')),
             search_query.terms
           ) desc,
           ticket.created_at desc
  limit 5
$$;
revoke all on function public.find_similar_open_tickets(text, text, bigint) from public, anon;
grant execute on function public.find_similar_open_tickets(text, text, bigint) to authenticated;

create table if not exists public.ticket_links (
  ticket_id bigint not null references public.tickets(id) on delete cascade,
  related_ticket_id bigint not null references public.tickets(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (ticket_id, related_ticket_id),
  constraint ticket_links_ordered_pair check (ticket_id < related_ticket_id)
);

create index if not exists ticket_links_related_ticket_idx
  on public.ticket_links(related_ticket_id);

alter table public.ticket_links enable row level security;
grant select, insert, delete on public.ticket_links to authenticated;

drop policy if exists "ticket links read visible pairs" on public.ticket_links;
create policy "ticket links read visible pairs"
  on public.ticket_links for select to authenticated
  using (public.can_view_ticket(ticket_id) and public.can_view_ticket(related_ticket_id));

drop policy if exists "ticket links staff insert visible pairs" on public.ticket_links;
create policy "ticket links staff insert visible pairs"
  on public.ticket_links for insert to authenticated
  with check (
    public.current_side() in ('employee', 'admin')
    and created_by = auth.uid()
    and ticket_id < related_ticket_id
    and public.can_view_ticket(ticket_id)
    and public.can_view_ticket(related_ticket_id)
  );

drop policy if exists "ticket links staff delete visible pairs" on public.ticket_links;
create policy "ticket links staff delete visible pairs"
  on public.ticket_links for delete to authenticated
  using (
    public.current_side() in ('employee', 'admin')
    and public.can_view_ticket(ticket_id)
    and public.can_view_ticket(related_ticket_id)
  );

commit;
