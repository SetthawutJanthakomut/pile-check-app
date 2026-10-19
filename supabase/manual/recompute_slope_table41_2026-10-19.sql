-- Pile Check: recompute verticality / rake verdict per Spec Table 4-1 (19-Oct-2026)
--   vertical pile : lean 1/slope                 <= 1/tol_perp_ratio (1:75)
--   raked pile    : in rake  = lean*cos(dAz) - 1/V  <= 1/N(V)  N: 1:4 25, 1:6 40, 1:8 50, linear between (1:4.5 28.75, 1:5 32.5)
--                   perp     = lean*sin(dAz)        <= 1/tol_perp_ratio
--   Same formulas as src/lib/calculations.js computeAll(). Only slope-verdict keys are touched.
--   Also fixes designBatterAz/diffBatterAz for piles with design azimuth 0 deg (old code skipped them).
-- Re-runnable. Backup: backup.asbuilt_results_20261019 (first run only).
create schema if not exists backup;
create table if not exists backup.asbuilt_results_20261019 as select id, results from public.asbuilt_records;

with s as (
  select max(value) filter (where key='tol_perp_ratio')::float8 perp,
         max(value) filter (where key='tol_rake_1to4')::float8 r4,
         max(value) filter (where key='tol_rake_1to6')::float8 r6,
         max(value) filter (where key='tol_rake_1to8')::float8 r8
  from public.project_settings),
b as (
  select ar.id, p.batter_bearing_deg::float8 baz,
         case when (ar.results->>'slope') is null then 0 else 1/(ar.results->>'slope')::float8 end lean,
         (ar.results->>'axisAz')::float8 axaz,
         case when p.incline is null or p.incline ~* 'vert' then null
              else substring(p.incline from '1\s*:\s*([0-9.]+)')::float8 end v
  from public.asbuilt_records ar join public.piles p on p.id = ar.pile_id
  where ar.results ? 'axisAz'),
c as (
  select b.*, s.perp,
         case when v is null then null when v <= 4 then s.r4
              when v <= 6 then s.r4 + (s.r6 - s.r4) * (v - 4) / 2
              when v <= 8 then s.r6 + (s.r8 - s.r6) * (v - 6) / 2 else s.r8 end tolrake,
         case when v is not null and baz is not null
              then (((axaz - baz + 540)::numeric % 360) - 180)::float8 end daz
  from b, s),
d as (
  select c.*,
         case when v is null then null else lean * cos(radians(coalesce(daz, 0))) - 1 / v end devrake,
         case when v is null then lean when daz is null then null else lean * sin(radians(daz)) end devperp
  from c),
e as (
  select d.*,
         case when devrake is null then null when abs(devrake) <= 1/tolrake + 1e-12 then 'OK' else 'OVER' end rchk,
         case when devperp is null then null when abs(devperp) <= 1/perp + 1e-12 then 'OK' else 'OVER' end pchk
  from d)
update public.asbuilt_records ar
   set results = ar.results || jsonb_build_object(
         'designBatterAz', case when e.v is not null then e.baz end,
         'diffBatterAz',   e.daz,
         'devRake',        e.devrake,
         'devPerp',        e.devperp,
         'devRakeRatio',   case when e.devrake is null then null when abs(e.devrake) < 1e-5 then 99999 else least(1/abs(e.devrake), 99999) end,
         'devPerpRatio',   case when e.devperp is null then null when abs(e.devperp) < 1e-5 then 99999 else least(1/abs(e.devperp), 99999) end,
         'tolRakeRatio',   e.tolrake,
         'tolPerpRatio',   e.perp,
         'rakeCheck',      e.rchk,
         'perpCheck',      e.pchk,
         'slopeCheck',     case when e.rchk = 'OVER' or e.pchk = 'OVER' then 'OVER'
                                when e.rchk is null and e.pchk is null then null else 'OK' end)
  from e
 where ar.id = e.id;

-- check
select p.zone, ar.pile_stage, ar.results->>'slopeCheck' slope_chk, count(*)
  from public.asbuilt_records ar join public.piles p on p.id = ar.pile_id
 group by 1,2,3 order by 1,2,3;
-- undo:
--   update public.asbuilt_records ar set results = b.results from backup.asbuilt_results_20261019 b where ar.id = b.id;
