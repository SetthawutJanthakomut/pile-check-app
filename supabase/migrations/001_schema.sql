-- ============================================================
-- Pile Check App — Phase 1 schema
-- Local Plant coordinates as primary; UTM columns reserved.
-- Permission model: everyone reads shared data; each user edits
-- only their own records; drafts stay private until shared.
-- ============================================================

-- ---------- Design piles ----------
create table piles (
  id uuid primary key default gen_random_uuid(),
  pile_no text unique not null,
  pile_size text,                          -- e.g. 'Φ1219.2x19t'
  dia_mm numeric not null,                 -- numeric diameter, used for radius offset
  pile_top_level numeric,                  -- design cut-off elevation (ELEV. at PCO)
  sea_bed_level numeric,                   -- design seabed
  pile_toe_level numeric,
  length_m numeric,
  incline text not null default 'VERT.',   -- 'VERT.' | 'BATT. (1:8)' | 'BATT. (1:6)' ...
  coordinate_pn numeric not null,          -- Local Plant North
  coordinate_pe numeric not null,          -- Local Plant East
  utm_n numeric,                           -- reserved (nullable)
  utm_e numeric,
  coating_length_m numeric,
  batter_bearing_deg numeric,              -- null for VERT.; use 360 for due north
  note text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Benchmarks / control points ----------
create table benchmarks (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  northing numeric not null,
  easting numeric not null,
  elevation numeric,
  type text not null default 'BM',         -- 'BM' | 'STN' | 'TP'
  active boolean not null default true,
  note text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- As-built records (one per measurement session) ----------
create table asbuilt_records (
  id uuid primary key default gen_random_uuid(),
  pile_id uuid not null references piles,
  station_id uuid references benchmarks,
  backsight_id uuid references benchmarks,
  bs_measured_n numeric,                   -- BS shot for setup check
  bs_measured_e numeric,
  measured_seabed numeric,                 -- null = fall back to design sea_bed_level
  surveyor text,
  measured_at date not null default current_date,
  is_shared boolean not null default false,  -- false = private draft
  results jsonb,                           -- cached output of calculations.js
  created_by uuid not null references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Survey points (1=Top, 2=Bottom, 3=Mid; extensible) ----------
create table survey_points (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references asbuilt_records on delete cascade,
  point_no int not null check (point_no between 1 and 9),
  northing numeric not null,
  easting numeric not null,
  elevation numeric not null,
  note text,
  unique (record_id, point_no)
);

-- ---------- Project settings (tolerances) ----------
create table project_settings (
  key text primary key,
  value numeric not null,
  description text
);

insert into project_settings (key, value, description) values
  ('tol_position_m', 0.075, 'Max total N-E deviation at design cut-off level'),
  ('tol_tilt_deg',   1.0,   'Max angle-from-vertical difference vs design'),
  ('tol_residual_m', 0.020, 'Max perpendicular distance of P3 off line P1-P2'),
  ('tol_bs_m',       0.010, 'Max diff between measured BS and known coordinates');

-- ---------- updated_at trigger ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger asbuilt_records_updated_at
  before update on asbuilt_records
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table piles            enable row level security;
alter table benchmarks       enable row level security;
alter table asbuilt_records  enable row level security;
alter table survey_points    enable row level security;
alter table project_settings enable row level security;

-- Reference data: every signed-in user can read; any signed-in user
-- can add; only the creator can edit/delete their own rows.
create policy "piles read"   on piles      for select to authenticated using (true);
create policy "piles insert" on piles      for insert to authenticated with check (created_by = auth.uid());
create policy "piles update" on piles      for update to authenticated using (created_by = auth.uid());
create policy "piles delete" on piles      for delete to authenticated using (created_by = auth.uid());

create policy "bm read"   on benchmarks for select to authenticated using (true);
create policy "bm insert" on benchmarks for insert to authenticated with check (created_by = auth.uid());
create policy "bm update" on benchmarks for update to authenticated using (created_by = auth.uid());
create policy "bm delete" on benchmarks for delete to authenticated using (created_by = auth.uid());

-- Records: see your own (drafts included) + everyone's shared ones;
-- write only your own.
create policy "rec read"   on asbuilt_records for select to authenticated
  using (created_by = auth.uid() or is_shared = true);
create policy "rec insert" on asbuilt_records for insert to authenticated
  with check (created_by = auth.uid());
create policy "rec update" on asbuilt_records for update to authenticated
  using (created_by = auth.uid());
create policy "rec delete" on asbuilt_records for delete to authenticated
  using (created_by = auth.uid());

-- Points follow their record's visibility/ownership.
create policy "pt read" on survey_points for select to authenticated
  using (exists (select 1 from asbuilt_records r
                 where r.id = record_id
                   and (r.created_by = auth.uid() or r.is_shared = true)));
create policy "pt write" on survey_points for all to authenticated
  using (exists (select 1 from asbuilt_records r
                 where r.id = record_id and r.created_by = auth.uid()))
  with check (exists (select 1 from asbuilt_records r
                      where r.id = record_id and r.created_by = auth.uid()));

create policy "settings read" on project_settings for select to authenticated using (true);

-- ---------- Demo seed (P4-25 verification set; delete in production) ----------
insert into piles (pile_no, pile_size, dia_mm, pile_top_level, sea_bed_level,
                   length_m, incline, coordinate_pn, coordinate_pe,
                   coating_length_m, batter_bearing_deg, note)
values ('P4-25', 'Φ800', 800, 3.525, -15.82, 35.10, 'BATT. (1:8)',
        1397964.794, 733028.0029, 30.0, 135.351,
        'Test row (UTM, from original workbook) — delete in production');

insert into benchmarks (name, northing, easting, elevation, type, note) values
  ('STN1', 1397831.047, 733112.184, 3.675, 'STN', 'demo station (UTM)'),
  ('STN2', 1397769.808, 733171.379, 3.364, 'STN', 'demo station (UTM)'),
  ('BS1',  1397885.144, 733040.763, 3.294, 'BM',  'demo backsight (UTM)');
