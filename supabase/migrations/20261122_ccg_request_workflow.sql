begin;

alter table public.tickets
  add column if not exists ccg_request_type text,
  add column if not exists ccg_request_scope text,
  add column if not exists ccg_procurement_in_scope boolean;

alter table public.tickets
  drop constraint if exists tickets_ccg_request_type_check,
  add constraint tickets_ccg_request_type_check
    check (ccg_request_type is null or ccg_request_type in ('unit_rate', 'vendor_list', 'tor_contracts')),
  drop constraint if exists tickets_ccg_request_scope_check,
  add constraint tickets_ccg_request_scope_check
    check (ccg_request_scope is null or ccg_request_scope in ('whole_boq', 'per_material'));

drop policy if exists "tickets insert" on public.tickets;
create policy "tickets insert"
  on public.tickets for insert to authenticated
  with check (
    public.current_side() = 'client'
    and requester_id = auth.uid()
    and assigned_to is null
    and status = 'open'
    and exists (
      select 1 from public.service_teams team
      where team.id = service_team_id
        and team.is_active and team.is_in_scope
        and team.slug in ('it-support', 'cost-control')
        and (
          (team.slug = 'it-support' and ccg_request_type is null and ccg_request_scope is null)
          or (team.slug = 'cost-control'
            and ccg_procurement_in_scope is false
            and ccg_request_type in ('unit_rate', 'vendor_list', 'tor_contracts')
            and ((ccg_request_type = 'unit_rate' and ccg_request_scope in ('whole_boq', 'per_material'))
              or (ccg_request_type <> 'unit_rate' and ccg_request_scope is null)))
        )
    )
  );

commit;
