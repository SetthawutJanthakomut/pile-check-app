-- Note + before/after driving stage on as-built records.
alter table asbuilt_records add column note text;
alter table asbuilt_records add column pile_stage text
  check (pile_stage in ('before','after'));

-- Allow admin/recorder to insert benchmarks (needed for the Form's
-- free-entry station: typing an unknown STN auto-creates a benchmark row).
create policy "bm insert recorder" on benchmarks for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid()
              and p.role in ('admin','recorder')));

-- Admin-only write access to project_settings (Settings page tolerances).
create policy "settings admin write" on project_settings for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
