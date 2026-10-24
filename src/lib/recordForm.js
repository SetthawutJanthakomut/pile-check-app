// Map a saved asbuilt record (with joined survey_points) to the Form's input values.
// Used by "Load all values" on the Form page (copy a saved survey into a NEW record).
const str = (v) => (v == null ? '' : String(v));

/** survey_points[] -> { [point_no]: point } */
export function recordPoints(r) {
  const m = {};
  (r?.survey_points || []).forEach((p) => { m[p.point_no] = p; });
  return m;
}

const toPt = (p) => (p ? { n: str(p.northing), e: str(p.easting), el: str(p.elevation) } : { n: '', e: '', el: '' });

/** Form values from a record: STN/BS ids, BS measured N/E, P1 top / P2 bottom / P3 mid (N, E, Z), seabed. */
export function recordToFormValues(r) {
  const pts = recordPoints(r);
  return {
    stationId: r?.station_id ?? '',
    backsightId: r?.backsight_id ?? '',
    bsN: str(r?.bs_measured_n),
    bsE: str(r?.bs_measured_e),
    p1: toPt(pts[1]),
    p2: toPt(pts[2]),
    p3: toPt(pts[3]),
    seabed: str(r?.measured_seabed),
  };
}
