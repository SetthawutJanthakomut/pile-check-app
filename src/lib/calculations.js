// ============================================================
// calculations.js — ported 1:1 from the verified Excel workbook
// (AsBuilt_Pile_Check_Template.xlsx). Test set: pile P4-25.
// All angles in degrees, distances in metres.
// Convention: GO labels are CORRECTION directions (back to design).
// ============================================================

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Survey azimuth (deg, 0-360 from north, clockwise) of vector A->B.
 *  Same as Excel: MOD(ATAN2(Na-Nb, Ea-Eb)*180/PI()+180, 360) with A,B swapped. */
export function azimuth(fromN, fromE, toN, toE) {
  // Excel formula used ATAN2(N_from - N_to, E_from - E_to) + 180,
  // which equals the azimuth from `from` to `to`.
  const a = Math.atan2(fromE - toE, fromN - toN) * R2D + 180;
  return ((a % 360) + 360) % 360;
}

/** Parse incline text: 'VERT.' -> null ratio (vertical), 'BATT. (1:8)' -> 8 */
export function parseIncline(text) {
  if (!text) return { vertical: true, ratio: null };
  if (/vert/i.test(text)) return { vertical: true, ratio: null };
  const m = text.match(/1\s*:\s*([\d.]+)/);
  return m ? { vertical: false, ratio: parseFloat(m[1]) } : { vertical: true, ratio: null };
}

/** Spec Table 4-1 "deviation in rake in direction of rake" for a rake 1:V,
 *  returned as N of 1:N. Table keys are tabulated rakes (4, 6, 8 ...).
 *  Rakes between two tabulated values: N interpolated linearly
 *  (agreed 19-Oct-2026: 1:4.5 -> 28.75, 1:5 -> 32.5). Outside the table: clamped. */
export function rakeTolRatio(V, table) {
  if (V == null || !table) return null;
  const pts = Object.entries(table)
    .map(([k, v]) => [Number(k), Number(v)])
    .filter(([k, v]) => Number.isFinite(k) && Number.isFinite(v) && v > 0)
    .sort((a, b) => a[0] - b[0]);
  if (!pts.length) return null;
  if (V <= pts[0][0]) return pts[0][1];
  if (V >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (V <= x1) return y0 + ((y1 - y0) * (V - x0)) / (x1 - x0);
  }
  return null;
}

/** Build the tolerance object from project_settings rows ({ key: value }). */
export function buildTol(m = {}) {
  const n = (v, d) => (v == null || v === '' || !Number.isFinite(Number(v)) ? d : Number(v));
  return {
    positionM: n(m.tol_position_m, 0.075),
    tiltDeg: n(m.tol_tilt_deg, 1.0),            // legacy - no longer used for the verdict
    residualM: n(m.tol_residual_m, 0.02),
    bsM: n(m.tol_bs_m, 0.01),
    coatingEmbedM: n(m.tol_coating_embed_m, 2.0),
    crossCheckM: n(m.tol_cross_check_m, 0.03),
    perpRatio: n(m.tol_perp_ratio, 75),         // Table 4-1: verticality / perpendicular to rake
    rakeRatios: {                               // Table 4-1: in direction of rake
      4: n(m.tol_rake_1to4, 25),
      6: n(m.tol_rake_1to6, 40),
      8: n(m.tol_rake_1to8, 50),
    },
  };
}

/** 1:N value of a deviation (m per m). Capped so it stays JSON-safe. */
export function devRatio(d) {
  if (d == null) return null;
  const a = Math.abs(d);
  return a < 1e-5 ? 99999 : Math.min(1 / a, 99999);
}

/** Normalize angle difference into (-180, 180]. */
export function normDiff(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

/** Perpendicular 3-D distance of P3 from the line through P1-P2 (cross product). */
export function residualP3(p1, p2, p3) {
  const dN = p2.n - p1.n, dE = p2.e - p1.e, dZ = p2.el - p1.el;
  const vN = p3.n - p1.n, vE = p3.e - p1.e, vZ = p3.el - p1.el;
  const cx = vE * dZ - vZ * dE;
  const cy = vZ * dN - vN * dZ;
  const cz = vN * dE - vE * dN;
  return Math.hypot(cx, cy, cz) / Math.hypot(dN, dE, dZ);
}

/** BS setup check: distance between measured BS shot and its known coordinates. */
export function bsCheck(measured, known, tol) {
  const diff = Math.hypot(measured.n - known.n, measured.e - known.e);
  return { diff, pass: diff <= tol };
}

/** Planar distance between two as-built positions — cross-check between two
 *  surveys of the same pile+stage (e.g. by different surveyors). */
export function crossCheckDiff(a, b) {
  return Math.hypot(a.asbuiltN - b.asbuiltN, a.asbuiltE - b.asbuiltE);
}

/** Position check verdict for a given deviation + tolerance. Exported so display
 *  components can re-evaluate against the LIVE project tolerance instead of
 *  trusting `results.posCheck`, which is cached at save time and goes stale
 *  the moment someone edits the tolerance in Settings afterward. */
export function posCheckFor(r, tolPositionM) {
  // ITP GMTP-CAZ-QC-ITP-020 item B.2: "Coordinate deviation: +/-150 mm measured at the cut-off level"
  // -> N and E are checked SEPARATELY (|dN| <= tol AND |dE| <= tol), not the total vector (since 20-Oct-2026).
  // Accepts a results-like object { diffN, diffE, totalDev }; a bare number is treated as legacy total.
  if (r == null || tolPositionM == null) return null;
  const eps = 1e-12;
  if (typeof r === 'number') return r <= tolPositionM + eps ? 'OK' : 'OVER';
  if (r.diffN != null && r.diffE != null) {
    return Math.abs(r.diffN) <= tolPositionM + eps && Math.abs(r.diffE) <= tolPositionM + eps ? 'OK' : 'OVER';
  }
  return r.totalDev != null ? (r.totalDev <= tolPositionM + eps ? 'OK' : 'OVER') : null;
}

/**
 * Full pipeline. Inputs:
 *  design: { pn, pe, cutoff, diaMm, incline, batterAzDeg|null, lengthM|null,
 *            coatingLengthM|null, seaBedLevel|null }
 *  stn:    { n, e }
 *  p1,p2:  { n, e, el }   (P1 = top, P2 = bottom)
 *  p3:     { n, e, el } | null
 *  measuredSeabed: number | null   (null -> fall back to design.seaBedLevel)
 *  tol:    { positionM, residualM, perpRatio, rakeRatios, ... }  (see buildTol)
 */
export function computeAll({ design, stn, p1, p2, p3 = null, measuredSeabed = null, tol }) {
  const out = {};

  // --- actual axis ---
  out.axisAz = azimuth(p1.n, p1.e, p2.n, p2.e);                       // V
  const dH = Math.hypot(p1.e - p2.e, p1.n - p2.n);
  out.slope = (p1.el - p2.el) / dH;                                   // W (1:x)
  out.tiltDeg = Math.atan(1 / out.slope) * R2D;                       // X
  out.azStnP1 = azimuth(stn.n, stn.e, p1.n, p1.e);                    // Y

  // --- center of pile top (radius offset along STN->P1 line) ---
  const r = (design.diaMm * 0.001) / 2;
  out.centerN = p1.n + r * Math.cos(out.azStnP1 * D2R);               // Z
  out.centerE = p1.e + r * Math.sin(out.azStnP1 * D2R);               // AA

  // --- slide along actual axis to design cut-off level ---
  out.dy = p1.el - design.cutoff;                                     // AB
  out.dx = out.dy * Math.tan(out.tiltDeg * D2R);                      // AC
  out.asbuiltN = out.centerN + out.dx * Math.cos(out.axisAz * D2R);   // AD
  out.asbuiltE = out.centerE + out.dx * Math.sin(out.axisAz * D2R);   // AE
  out.asbuiltEl = design.cutoff;

  // --- deviation from design + correction directions ---
  out.diffN = out.asbuiltN - design.pn;                               // AF
  out.dirN = out.diffN < 0 ? 'GO NORTH' : 'GO SOUTH';                 // AG
  out.diffE = out.asbuiltE - design.pe;                               // AH
  out.dirE = out.diffE < 0 ? 'GO EAST' : 'GO WEST';                   // AI
  out.totalDev = Math.hypot(out.diffN, out.diffE);                    // AJ
  out.posCheck = posCheckFor(out, tol.positionM);                     // AK (ITP B.2: N and E separately)

  // --- Point-3 cross-check ---
  if (p3 && p3.n != null) {
    out.residual = residualP3(p1, p2, p3);                            // AL
    out.p3Check = out.residual <= tol.residualM ? 'OK' : 'CHECK!';    // AM
  } else {
    out.residual = null;
    out.p3Check = null;
  }

  // --- slope vs design ---
  const inc = parseIncline(design.incline);
  out.designTilt = inc.vertical ? 0 : Math.atan(1 / inc.ratio) * R2D; // AN
  out.tiltDiff = out.tiltDeg - out.designTilt;                        // AO (info)

  // --- batter azimuth (battered piles only; 0 deg = toe due north is valid) ---
  out.asbuiltBatterAz = out.axisAz;                                   // AR
  if (!inc.vertical && design.batterAzDeg != null && Number.isFinite(Number(design.batterAzDeg))) {
    out.designBatterAz = Number(design.batterAzDeg);                  // AQ
    out.diffBatterAz = normDiff(out.asbuiltBatterAz - out.designBatterAz); // AS
  } else {
    out.designBatterAz = null;
    out.diffBatterAz = null;
  }

  // --- verticality / rake check, Spec Table 4-1 (deviation as 1:N, per m vertical) ---
  //  vertical pile : lean of the axis                       vs 1:perpRatio (1:75)
  //  raked pile    : in direction of rake = lean*cos(dAz) - 1/V  vs 1:N(V) (1:4 25, 1:6 40, 1:8 50, interpolated)
  //                  perpendicular        = lean*sin(dAz)        vs 1:perpRatio (1:75)
  const lean = 1 / out.slope;                                         // horizontal m per 1 m vertical
  const perpTol = tol.perpRatio ?? (tol.tiltDeg ? 1 / Math.tan(tol.tiltDeg * D2R) : 75);
  out.tolPerpRatio = perpTol;
  if (inc.vertical) {
    out.devRake = null;
    out.tolRakeRatio = null;
    out.devPerp = lean;
  } else {
    const dAz = (out.diffBatterAz ?? 0) * D2R;
    out.devRake = lean * Math.cos(dAz) - 1 / inc.ratio;               // + = flatter than design
    out.devPerp = out.diffBatterAz == null ? null : lean * Math.sin(dAz);
    out.tolRakeRatio = rakeTolRatio(inc.ratio, tol.rakeRatios) ?? perpTol;
  }
  out.devRakeRatio = devRatio(out.devRake);
  out.devPerpRatio = devRatio(out.devPerp);
  out.rakeCheck = out.devRake == null ? null : Math.abs(out.devRake) <= 1 / out.tolRakeRatio + 1e-12 ? 'OK' : 'OVER';
  out.perpCheck = out.devPerp == null ? null : Math.abs(out.devPerp) <= 1 / out.tolPerpRatio + 1e-12 ? 'OK' : 'OVER';
  const sc = [out.rakeCheck, out.perpCheck].filter(Boolean);
  out.slopeCheck = sc.length ? (sc.every((c) => c === 'OK') ? 'OK' : 'OVER') : null; // AP

  // --- pile toe: from CENTER at top, extended ALONG the actual axis ---
  if (design.lengthM != null) {
    const L = design.lengthM;
    const horiz = L * Math.sin(out.tiltDeg * D2R);
    out.toeN = out.centerN + horiz * Math.cos(out.axisAz * D2R);      // AT
    out.toeE = out.centerE + horiz * Math.sin(out.axisAz * D2R);      // AU
    out.toeZ = p1.el - L * Math.cos(out.tiltDeg * D2R);               // AV
  } else {
    out.toeN = out.toeE = out.toeZ = null;
  }

  // --- toe level deviation ---
  if (design.pileToeLevel != null && out.toeZ != null) {
    out.toeZDiff = out.toeZ - design.pileToeLevel;
    out.toeZCheck = Math.abs(out.toeZDiff) <= tol.positionM ? 'OK' : 'OVER';
  } else {
    out.toeZDiff = null;
    out.toeZCheck = null;
  }

  // --- toe deviation from design toe ---
  if (design.toePn != null && design.toePe != null && out.toeN != null) {
    out.toeDiffN = out.toeN - design.toePn;
    out.toeDiffE = out.toeE - design.toePe;
    out.toeDirN = out.toeDiffN < 0 ? 'GO NORTH' : 'GO SOUTH';
    out.toeDirE = out.toeDiffE < 0 ? 'GO EAST' : 'GO WEST';
    out.toeTotalDev = Math.hypot(out.toeDiffN, out.toeDiffE);
  } else {
    out.toeDiffN = out.toeDiffE = out.toeDirN = out.toeDirE = out.toeTotalDev = null;
  }

  // --- coating: measured down ALONG the inclined axis ---
  if (design.coatingLengthM != null && design.coatingLengthM !== 0) {
    out.coatingBottomEl = p1.el - design.coatingLengthM * Math.cos(out.tiltDeg * D2R); // AX
    const seabed = measuredSeabed != null ? measuredSeabed : design.seaBedLevel;
    out.seabedUsed = seabed ?? null;
    out.seabedSource = measuredSeabed != null ? 'measured' : 'design';
    out.marginToSeabed = seabed != null ? out.coatingBottomEl - seabed : null;         // AY
    out.marginLabel = out.marginToSeabed == null ? null
      : out.marginToSeabed <= 0 ? 'Below seabed' : 'Above seabed';
  } else {
    out.coatingBottomEl = out.marginToSeabed = out.seabedUsed = null;
    out.marginLabel = out.seabedSource = null;
  }

  // --- coating embedment below seabed check ---
  if (out.marginToSeabed != null && tol.coatingEmbedM != null) {
    out.coatingCheck = out.marginToSeabed <= -tol.coatingEmbedM ? 'OK' : 'OVER';
    out.coatingEmbedM = Math.abs(Math.min(out.marginToSeabed, 0));
  } else {
    out.coatingCheck = null;
  }

  // --- seabed re-survey comparison ---
  if (measuredSeabed != null && design.seaBedLevel != null) {
    out.seabedDiff = measuredSeabed - design.seaBedLevel;
    out.seabedDiffLabel = out.seabedDiff < 0 ? 'Deeper (scour)' : 'Shallower (silting)';
  } else {
    out.seabedDiff = null;
    out.seabedDiffLabel = null;
  }

  return out;
}
