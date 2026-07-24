-- Generic audit trail: logs the pre-change row for updates/deletes on the
-- tracked tables via one reusable SECURITY DEFINER trigger function.
create table record_history (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id text not null,          -- store as text since PK types differ
  action text not null check (action in ('update','delete')),
  old_data jsonb not null,       -- full row snapshot BEFORE the change
  changed_by uuid references auth.users,
  changed_at timestamptz not null default now()
);
create index on record_history (table_name, row_id);
create index on record_history (changed_at desc);

alter table record_history enable row level security;
-- read: any approved admin/recorder can view history (read-only page)
create policy "history read" on record_history for select to authenticated
  using (exists (select 1 from profiles p where p.id=auth.uid()
    and p.status='approved' and p.role in ('admin','recorder')));
-- no insert/update/delete policy for normal users — only the trigger
-- (SECURITY DEFINER) writes to this table.

-- ONE generic trigger function, reused by every tracked table:
create or replace function log_row_history()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into record_history (table_name, row_id, action, old_data, changed_by)
  values (
    TG_TABLE_NAME,
    case TG_TABLE_NAME
      -- project_settings has no `id` column; its PK is `key`.
      when 'project_settings' then OLD.key
      else OLD.id::text
    end,
    lower(TG_OP),
    to_jsonb(OLD),
    auth.uid()
  );
  return OLD;
end $$;

-- attach to each tracked table, before update and before delete:
create trigger trg_history_piles
  before update or delete on piles
  for each row execute function log_row_history();
create trigger trg_history_benchmarks
  before update or delete on benchmarks
  for each row execute function log_row_history();
create trigger trg_history_asbuilt_records
  before update or delete on asbuilt_records
  for each row execute function log_row_history();
create trigger trg_history_project_settings
  before update or delete on project_settings
  for each row execute function log_row_history();
create trigger trg_history_profiles
  before update or delete on profiles
  for each row execute function log_row_history();
