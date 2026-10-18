begin;

create or replace function public.log_ticket_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  discipline_label text;
  assignee_label text;
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_events (ticket_id, actor_id, event_type, to_status)
    values (new.id, auth.uid(), 'submitted', new.status::text);
  else
    if new.status is distinct from old.status then
      insert into public.ticket_events (ticket_id, actor_id, event_type, from_status, to_status)
      values (new.id, auth.uid(), 'status_changed', old.status::text, new.status::text);
    end if;
    if new.discipline_id is distinct from old.discipline_id then
      select d.name into discipline_label
      from public.disciplines d
      where d.id = new.discipline_id;
      insert into public.ticket_events (ticket_id, actor_id, event_type, note)
      values (
        new.id,
        auth.uid(),
        'routed',
        case when new.discipline_id is null then 'Discipline cleared'
             else 'Routed to ' || coalesce(discipline_label, 'a discipline')
        end
      );
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      select coalesce(nullif(btrim(p.full_name), ''), p.email)
        into assignee_label
      from public.profiles p
      where p.id = new.assigned_to;
      insert into public.ticket_events (ticket_id, actor_id, event_type, note)
      values (
        new.id,
        auth.uid(),
        'assigned',
        case when new.assigned_to is null then 'Assignee cleared'
             else 'Assigned to ' || coalesce(assignee_label, 'a teammate')
        end
      );
    end if;
  end if;
  return new;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Supabase Realtime publication is missing';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_events'
  ) then
    execute 'alter publication supabase_realtime add table public.ticket_events';
  end if;
end
$$;

commit;
