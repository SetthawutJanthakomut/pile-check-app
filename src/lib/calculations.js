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

/**
 * Full pipeline. Inputs:
 *  design: { pn, pe, cutoff, diaMm, incline, batterAzDeg|null, lengthM|null,
 *            coatingLengthM|null, seaBedLevel|null }
 *  stn:    { n, e }
 *  p1,p2:  { n, e, el }   (P1 = top, P2 = bottom)
 *  p3:     { n, e, el } | null
 *  measuredSeabed: number | null   (null -> fall back to design.seaBedLevel)
 *  tol:    { positionM, tiltDeg, residualM }
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
  out.posCheck = out.totalDev <= tol.positionM ? 'OK' : 'OVER';       // AK

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
  out.tiltDiff = out.tiltDeg - out.designTilt;                        // AO
  out.slopeCheck = Math.abs(out.tiltDiff) <= tol.tiltDeg ? 'OK' : 'OVER'; // AP

  // --- batter azimuth (meaningful for battered piles only) ---
  out.asbuiltBatterAz = out.axisAz;                                   // AR
  if (design.batterAzDeg != null && design.batterAzDeg !== 0) {
    out.designBatterAz = design.batterAzDeg;                          // AQ
    out.diffBatterAz = normDiff(out.asbuiltBatterAz - out.designBatterAz); // AS
  } else {
    out.designBatterAz = null;
    out.diffBatterAz = null;
  }

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
