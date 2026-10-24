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

// ---- duplicate guard: a new / edited record must not be an exact copy of a saved one ----
const numOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[, ]+/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const sameNum = (a, b) => {
  const x = numOrNull(a), y = numOrNull(b);
  if (x === null || y === null) return x === y;
  return Math.abs(x - y) < 1e-9;
};
const samePt = (a, b) => sameNum(a?.n, b?.n) && sameNum(a?.e, b?.e) && sameNum(a?.el, b?.el);

/**
 * True when the form values are EXACTLY the same survey as a saved record:
 * same STN, same BS, BS measured N/E, P1 / P2 / P3 N E Z and seabed.
 * (Time, surveyor, note, share and photos are not compared.)
 * `v` has the shape of recordToFormValues(); stationId null/'' = a new station -> never a duplicate.
 */
export function isSameSurvey(v, record) {
  if (!v || !record) return false;
  const r = recordToFormValues(record);
  if (!v.stationId || String(v.stationId) !== String(r.stationId)) return false;
  if (String(v.backsightId ?? '') !== String(r.backsightId ?? '')) return false;
  return sameNum(v.bsN, r.bsN) && sameNum(v.bsE, r.bsE)
    && samePt(v.p1, r.p1) && samePt(v.p2, r.p2) && samePt(v.p3, r.p3)
    && sameNum(v.seabed, r.seabed);
}

/** First saved record that the form values exactly duplicate (excludeId = the record being edited). */
export function findDuplicate(v, records, excludeId = null) {
  return (records || []).find((r) => r && r.id !== excludeId && isSameSurvey(v, r)) || null;
}
