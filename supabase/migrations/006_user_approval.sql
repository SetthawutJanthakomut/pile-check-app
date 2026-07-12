-- User approval workflow: new signups default to pending/viewer and cannot
-- write anything until an admin approves them.

-- add approval status to profiles
alter table profiles add column status text not null default 'pending'
  check (status in ('pending','approved'));
-- existing users are already trusted: mark them approved
update profiles set status = 'approved';
-- new signups default to pending + role viewer
alter table profiles alter column role set default 'viewer';

-- extend the migration-005 SECURITY DEFINER helper so admin actions also
-- require the admin's own profile to be approved
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'approved');
$$;

create or replace function is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved');
$$;

-- tighten write policies so PENDING users cannot write anything:

-- asbuilt_records insert/update/delete now require approved + role admin/recorder
drop policy if exists "rec insert" on asbuilt_records;
create policy "rec insert" on asbuilt_records for insert to authenticated
  with check (created_by = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid()
                and p.status = 'approved'
                and p.role in ('admin','recorder')));

drop policy if exists "rec update" on asbuilt_records;
create policy "rec update" on asbuilt_records for update to authenticated
  using (created_by = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid()
                and p.status = 'approved'
                and p.role in ('admin','recorder')));

drop policy if exists "rec delete" on asbuilt_records;
create policy "rec delete" on asbuilt_records for delete to authenticated
  using (created_by = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid()
                and p.status = 'approved'
                and p.role in ('admin','recorder')));

-- piles/benchmarks admin-write policies already route through is_admin(),
-- which now requires status='approved' too.

-- benchmarks free-entry insert (recorder role, from the Form's new-station
-- flow) also needs the approved condition.
drop policy if exists "bm insert recorder" on benchmarks;
create policy "bm insert recorder" on benchmarks for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid()
              and p.status = 'approved'
              and p.role in ('admin','recorder')));
