-- Photo attachments for as-built records.
-- Phase 1 (this migration): online upload only. Offline queueing and PDF
-- photo pages are phase 2 — not built yet.

create table record_photos (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references asbuilt_records on delete cascade,
  storage_path text not null,
  photo_type text not null default 'pile'
    check (photo_type in ('pile','ts_screen','other')),
  created_by uuid not null references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

alter table record_photos enable row level security;

create policy "photos read" on record_photos for select using (true);

create policy "photos write" on record_photos for all to authenticated
  using (created_by = auth.uid()
    and exists (select 1 from profiles p where p.id=auth.uid()
      and p.status='approved' and p.role in ('admin','recorder')))
  with check (created_by = auth.uid()
    and exists (select 1 from profiles p where p.id=auth.uid()
      and p.status='approved' and p.role in ('admin','recorder')));

-- ============================================================
-- Storage: bucket "record-photos" — public read, authenticated write.
-- ============================================================
-- The insert below usually works fine from the SQL editor (it runs as the
-- `postgres` role, which owns storage.buckets in a standard Supabase
-- project). If it errors with a permissions message, create the bucket
-- from the dashboard instead:
--   Storage (left sidebar) -> "New bucket" -> name it exactly
--   "record-photos" -> toggle "Public bucket" ON -> Save.
-- Bucket creation and the policies below are independent — if you made the
-- bucket via the dashboard, just run the two `create policy ... on
-- storage.objects` statements that follow.
insert into storage.buckets (id, name, public)
values ('record-photos', 'record-photos', true)
on conflict (id) do nothing;

-- Anyone (including anon) can view photos — matches the app's public-read
-- policy on every other data table.
create policy "record-photos public read" on storage.objects for select
  using (bucket_id = 'record-photos');

-- Only approved admin/recorder accounts may upload.
create policy "record-photos upload" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'record-photos'
    and exists (select 1 from profiles p where p.id = auth.uid()
      and p.status = 'approved' and p.role in ('admin','recorder'))
  );

-- Delete is scoped to whoever owns the matching record_photos row (the
-- object's path is stored there as storage_path), so a photo can only be
-- removed by the same user who could delete its record_photos row.
create policy "record-photos delete own" on storage.objects for delete
  to authenticated using (
    bucket_id = 'record-photos'
    and exists (
      select 1 from record_photos rp
      where rp.storage_path = storage.objects.name
        and rp.created_by = auth.uid()
    )
  );
