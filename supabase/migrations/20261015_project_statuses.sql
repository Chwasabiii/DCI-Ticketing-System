begin;

update public.projects
set status = case
  when lower(status) = 'planned' then 'planned'
  when lower(status) = 'completed' then 'completed'
  else 'ongoing'
end;

alter table public.projects
  alter column status set default 'planned',
  add constraint projects_status_check
    check (status in ('planned', 'ongoing', 'completed'));

commit;
