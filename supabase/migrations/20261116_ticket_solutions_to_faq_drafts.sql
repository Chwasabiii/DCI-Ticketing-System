begin;

alter table public.faq_entries
  add column if not exists source_ticket_id bigint references public.tickets(id) on delete set null;

create unique index if not exists faq_entries_source_ticket_uidx
  on public.faq_entries(source_ticket_id)
  where source_ticket_id is not null;

drop policy if exists "faqs admin write" on public.faq_entries;
drop policy if exists "faqs admin and service team write" on public.faq_entries;
create policy "faqs admin and service team write"
  on public.faq_entries for all to authenticated
  using (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and service_team_id = (
        select p.service_team_id from public.profiles p
        join public.service_teams st on st.id = p.service_team_id
        where p.id = auth.uid()
          and p.status = 'active'
          and st.is_active
          and st.slug in ('it-support', 'cost-control', 'software-csr')
      )
    )
  )
  with check (
    public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and service_team_id = (
        select p.service_team_id from public.profiles p
        join public.service_teams st on st.id = p.service_team_id
        where p.id = auth.uid()
          and p.status = 'active'
          and st.is_active
          and st.slug in ('it-support', 'cost-control', 'software-csr')
      )
    )
  );

commit;
