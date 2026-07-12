-- profiles table with role
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  role text not null default 'recorder'
    check (role in ('admin','recorder','viewer')),
  created_at timestamptz default now()
);
alter table profiles enable row level security;
-- everyone (even anon) can read profiles; only admin can change roles
create policy "profiles read" on profiles for select using (true);
create policy "profiles admin write" on profiles for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role='admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role='admin'));
-- auto-create a profile row on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- PUBLIC READ (anon) on all data tables:
drop policy if exists "piles read" on piles;
create policy "piles public read" on piles for select using (true);
drop policy if exists "bm read" on benchmarks;
create policy "bm public read" on benchmarks for select using (true);
drop policy if exists "rec read" on asbuilt_records;
create policy "rec public read" on asbuilt_records for select using (true);
drop policy if exists "pt read" on survey_points;
create policy "pt public read" on survey_points for select using (true);
create policy "settings public read" on project_settings for select using (true);

-- piles/benchmarks: only ADMIN may insert/update/delete
drop policy if exists "piles insert" on piles;
drop policy if exists "piles update" on piles;
drop policy if exists "piles delete" on piles;
create policy "piles admin write" on piles for all to authenticated
  using (exists (select 1 from profiles p where p.id=auth.uid() and p.role='admin'))
  with check (exists (select 1 from profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "bm insert" on benchmarks;
drop policy if exists "bm update" on benchmarks;
drop policy if exists "bm delete" on benchmarks;
create policy "bm admin write" on benchmarks for all to authenticated
  using (exists (select 1 from profiles p where p.id=auth.uid() and p.role='admin'))
  with check (exists (select 1 from profiles p where p.id=auth.uid() and p.role='admin'));

-- asbuilt_records: admin or recorder may insert their own; edit own only
drop policy if exists "rec insert" on asbuilt_records;
create policy "rec insert" on asbuilt_records for insert to authenticated
  with check (created_by = auth.uid()
    and exists (select 1 from profiles p where p.id=auth.uid()
                and p.role in ('admin','recorder')));
