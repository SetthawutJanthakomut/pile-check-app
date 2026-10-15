-- 013_fix_audit_and_bm_write.sql  (comprehensive repair)
-- Symptoms seen in production: HTTP 400 on GET/PATCH profiles AND PATCH benchmarks.
-- A 400 on a plain profiles read is the signature of RLS *infinite recursion*
-- (a profiles policy that itself queries profiles). benchmarks policies that do
-- `select ... from profiles` then fail too. This script brings profiles/benchmarks
-- RLS back to the known-good design (policies route through SECURITY DEFINER
-- helpers, which bypass RLS and cannot recurse) and also repairs the audit trail
-- so INSERTs are allowed. Idempotent — safe to run (and re-run) in the SQL Editor.

begin;

-- ---------------------------------------------------------------------------
-- A) SECURITY DEFINER helpers (bypass RLS on profiles -> no recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_writer()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status = 'approved' and role in ('admin','recorder')
  );
$$;

-- ---------------------------------------------------------------------------
-- B) profiles: drop ALL existing policies (clears any recursive one), recreate
--    non-recursive canonical set.
-- ---------------------------------------------------------------------------
do $$ declare r record; begin
  for r in select policyname from pg_policies
           where schemaname='public' and tablename='profiles' loop
    execute format('drop policy if exists %I on public.profiles;', r.policyname);
  end loop;
end $$;

-- read: any authenticated/anon may read profiles (needed so the policy helpers
-- and the Users page work without recursion). Matches prior "profiles read".
create policy "profiles read" on public.profiles
  for select using (true);

-- write: admins only (role changes / approvals happen on the Users page).
create policy "profiles admin write" on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- C) benchmarks: drop ALL existing policies, recreate via the DEFINER helpers
--    (no inline `select from profiles`, so nothing can recurse).
-- ---------------------------------------------------------------------------
do $$ declare r record; begin
  for r in select policyname from pg_policies
           where schemaname='public' and tablename='benchmarks' loop
    execute format('drop policy if exists %I on public.benchmarks;', r.policyname);
  end loop;
end $$;

create policy "bm public read" on public.benchmarks
  for select using (true);

create policy "bm admin write" on public.benchmarks
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- recorders may create new stations (from the Form's "+ add new station")
create policy "bm insert recorder" on public.benchmarks
  for insert to authenticated
  with check (public.is_writer());

-- ---------------------------------------------------------------------------
-- D) audit trail: allow 'insert' action + log INSERT + (re)attach triggers
-- ---------------------------------------------------------------------------
alter table public.record_history drop constraint if exists record_history_action_check;
alter table public.record_history add constraint record_history_action_check
  check (action in ('insert','update','delete'));

-- NOTE: do NOT reference OLD.key / NEW.id directly — PL/pgSQL resolves record
-- fields at plan time, so OLD.key errors (42703) on any table without a `key`
-- column. Extract the pk from jsonb instead (->> returns NULL if absent).
create or replace function public.log_row_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  snap jsonb := to_jsonb(case when TG_OP = 'DELETE' then OLD else NEW end);
  rid  text  := coalesce(snap->>'id', snap->>'key');
begin
  insert into record_history (table_name, row_id, action, old_data, changed_by)
  values (TG_TABLE_NAME, rid, lower(TG_OP), snap, auth.uid());
  return case when TG_OP = 'DELETE' then OLD else NEW end;
end $$;

do $$ declare tbl text; begin
  foreach tbl in array array['piles','benchmarks','asbuilt_records','project_settings','profiles']
  loop
    execute format('drop trigger if exists trg_history_%1$s on public.%1$s;', tbl);
    execute format(
      'create trigger trg_history_%1$s before insert or update or delete on public.%1$s '
      || 'for each row execute function public.log_row_history();', tbl);
  end loop;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- DIAGNOSTIC (run separately to confirm):
--   select policyname, cmd, qual, with_check from pg_policies where tablename='profiles';
--   select policyname, cmd, qual, with_check from pg_policies where tablename='benchmarks';
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conname='record_history_action_check';
-- A quick end-to-end test (replace the id with a real benchmark id):
--   update public.benchmarks set note = note where id = '<some-id>';   -- should affect 1 row, no 400
-- ---------------------------------------------------------------------------
