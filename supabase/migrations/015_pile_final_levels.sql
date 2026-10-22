-- 015: final pile levels from the last pile mark with the ACTUAL slope (PMC comment 21-Oct-2026).
-- One row per pile (unique pile_id). The app asks before overwriting an existing row.
create table if not exists public.pile_final_levels (
  id uuid primary key default gen_random_uuid(),
  pile_id uuid not null unique references public.piles(id) on delete cascade,
  hi numeric not null,                 -- H.I datum level (mPD)
  pile_mark numeric not null,          -- last pile mark, along the pile (m)
  seabed numeric,                      -- seabed level used (mPD)
  slope_v numeric,                     -- actual slope 1:V used (null = vertical / design)
  slope_source text not null default 'actual' check (slope_source in ('actual', 'design')),
  slope_record_id uuid references public.asbuilt_records(id) on delete set null,  -- TS 'after' record the slope came from
  slope_measured_time timestamptz,
  factor numeric not null,             -- along pile -> vertical, V / sqrt(V²+1)
  length_m numeric,                    -- L used
  coating_length_m numeric,            -- Lc used
  pile_tip numeric not null,
  pile_top numeric,
  coating_bottom numeric,
  coating_embed numeric,               -- seabed - coating bottom (+ = below seabed)
  note text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.pile_final_levels enable row level security;

drop policy if exists "pfl public read" on public.pile_final_levels;
create policy "pfl public read" on public.pile_final_levels for select using (true);

-- approved admin / recorder may insert and overwrite (any row: the site team shares one record per pile)
drop policy if exists "pfl write" on public.pile_final_levels;
create policy "pfl write" on public.pile_final_levels for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role in ('admin', 'recorder')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role in ('admin', 'recorder')));

-- audit trail (same as piles / asbuilt_records)
drop trigger if exists trg_history_pile_final_levels on public.pile_final_levels;
create trigger trg_history_pile_final_levels
  after insert or update or delete on public.pile_final_levels
  for each row execute function public.log_row_history();
