begin;

alter table public.faq_entries
  add column if not exists service_team_id bigint references public.service_teams(id) on delete set null;

drop policy if exists "faqs read published" on public.faq_entries;
create policy "faqs read published"
  on public.faq_entries for select to authenticated
  using (
    is_published
    or public.current_side() = 'admin'
    or (
      public.current_side() = 'employee'
      and service_team_id = (
        select p.service_team_id from public.profiles p
        where p.id = auth.uid() and p.status = 'active'
      )
    )
  );

drop policy if exists "faqs admin write" on public.faq_entries;
create policy "faqs admin write"
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
          and st.slug in ('it-support', 'cost-control')
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
          and st.slug in ('it-support', 'cost-control')
      )
    )
  );

commit;
