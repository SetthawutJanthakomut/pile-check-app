-- Extend the audit trail (011_audit_trail.sql) to also log INSERT events,
-- so rows created by Recorders show up in History too, not just updates/deletes.

alter table record_history drop constraint record_history_action_check;
alter table record_history add constraint record_history_action_check
  check (action in ('insert','update','delete'));

create or replace function log_row_history()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if TG_OP = 'INSERT' then
    insert into record_history (table_name, row_id, action, old_data, changed_by)
    values (
      TG_TABLE_NAME,
      case TG_TABLE_NAME
        -- project_settings has no `id` column; its PK is `key`.
        when 'project_settings' then NEW.key
        else NEW.id::text
      end,
      lower(TG_OP),
      -- no prior row on insert, so old_data holds the as-inserted row instead
      to_jsonb(NEW),
      auth.uid()
    );
    return NEW;
  end if;

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

-- re-attach to each tracked table, now also firing before insert:
drop trigger trg_history_piles on piles;
create trigger trg_history_piles
  before insert or update or delete on piles
  for each row execute function log_row_history();

drop trigger trg_history_benchmarks on benchmarks;
create trigger trg_history_benchmarks
  before insert or update or delete on benchmarks
  for each row execute function log_row_history();

drop trigger trg_history_asbuilt_records on asbuilt_records;
create trigger trg_history_asbuilt_records
  before insert or update or delete on asbuilt_records
  for each row execute function log_row_history();

drop trigger trg_history_project_settings on project_settings;
create trigger trg_history_project_settings
  before insert or update or delete on project_settings
  for each row execute function log_row_history();

drop trigger trg_history_profiles on profiles;
create trigger trg_history_profiles
  before insert or update or delete on profiles
  for each row execute function log_row_history();
