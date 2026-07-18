import { supabase } from '../lib/supabase';

// Pulls everything PileReport needs that isn't already on RecordsTable's flattened
// row: full pile design fields, station/backsight benchmark rows, and the live
// tolerance settings (historical tolerances aren't stored on the record itself).
export async function fetchReportInputs(recordId) {
  const [{ data: record, error: recErr }, { data: settingsRows, error: setErr }] = await Promise.all([
    supabase
      .from('asbuilt_records')
      .select('*, piles(*), station:benchmarks!station_id(*), backsight:benchmarks!backsight_id(*), survey_points(point_no, northing, easting, elevation)')
      .eq('id', recordId)
      .single(),
    supabase.from('project_settings').select('*'),
  ]);
  if (recErr) throw recErr;
  if (setErr) throw setErr;

  const m = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));
  const tol = {
    positionM: m.tol_position_m ?? 0.075,
    tiltDeg: m.tol_tilt_deg ?? 1.0,
    residualM: m.tol_residual_m ?? 0.02,
    bsM: m.tol_bs_m ?? 0.01,
    coatingEmbedM: m.tol_coating_embed_m ?? 2.0,
    crossCheckM: m.tol_cross_check_m ?? 0.03,
  };

  return { record, pile: record.piles, station: record.station, backsight: record.backsight, tol };
}
