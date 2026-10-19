import { buildTol } from '../lib/calculations';
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
  const tol = buildTol(m);

  return { record, pile: record.piles, station: record.station, backsight: record.backsight, tol };
}
