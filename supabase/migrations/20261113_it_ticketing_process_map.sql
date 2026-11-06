begin;

alter table public.tickets
  add column if not exists service_category text not null default 'other_services';

alter table public.tickets
  drop constraint if exists tickets_request_type_check;

alter table public.tickets
  drop constraint if exists tickets_service_category_check;

alter table public.tickets
  alter column request_type set default 'service_request',
  add constraint tickets_request_type_check
    -- Keep the old value valid for existing rows; the UI presents it as Service request.
    check (request_type in ('service_request', 'access_request', 'incident_report', 'general')),
  add constraint tickets_service_category_check
    check (service_category in ('hardware', 'software', 'network', 'microsoft', 'security', 'other_services'));

create index if not exists tickets_service_category_idx on public.tickets(service_category);

commit;
