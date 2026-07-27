// ============================================================
// setoutCalc.js — raked-pile 3-D set-out geometry, ported from
// docs/Raked-Pile Setout — Calculation Method.md, section 9
// (Python reference `raked_pile_setout`). Separate from and
// independent of calculations.js (the as-built module) except
// for reusing parseIncline() to read a pile's incline text.
// All angles in degrees, distances in metres. Az clockwise from
// grid North: Az = atan2(dE, dN) — see doc section 1 "Excel gotcha".
// ============================================================

import { parseIncline } from './calculations.js';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

const normAz = (deg) => ((deg % 360) + 360) % 360;

// 3-vectors as [N, E, Up] plain arrays — mirrors the (N,E,Up) tuples
// used throughout the spec's Python reference.
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize3 = (a) => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Decimal degrees -> "D°MM'SS\"" per doc section 7. */
export function toDMS(decDeg) {
  const sign = decDeg < 0 ? '-' : '';
  const T = Math.round(Math.abs(decDeg) * 3600);
  const D = Math.floor(T / 3600);
  const M = Math.floor((T % 3600) / 60);
  const S = T % 60;
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${sign}${D}°${pad2(M)}'${pad2(S)}"`;
}

/** Station observation of target (N,E) at level Zt — doc section 6. */
function observation(N, E, N_S, E_S, Z_I, Zt, Az_BS) {
  const dN = N - N_S, dE = E - E_S;
  const HD = Math.hypot(dN, dE);
  const Az = normAz(Math.atan2(dE, dN) * R2D);
  const dz = Zt - Z_I;
  return {
    N, E, Az,
    Turn: normAz(Az - Az_BS),
    HD,
    SD: Math.hypot(HD, dz),
    ZA: 90 - Math.atan2(dz, HD) * R2D,
  };
}

/**
 * BATTERED pile — full oblique-cylinder tangent-plane method, doc
 * sections 5 & 9. Position genuinely differs by level.
 */
export function rakedPileSetout({ N_A, E_A, Z_A, Dia, V, Az_r_deg, Zt, N_S, E_S, Z_I, N_B, E_B }) {
  const rho = Dia / 2;
  const th = Math.atan(1 / V);
  const AzR = Az_r_deg * D2R;
  const a = [Math.sin(th) * Math.cos(AzR), Math.sin(th) * Math.sin(AzR), -Math.cos(th)];
  const A = [N_A, E_A, Z_A];
  const S = [N_S, E_S, Z_I];
  const w = sub3(A, S);
  const e1 = normalize3(cross3(a, [0, 0, 1]));
  const e2 = cross3(a, e1);
  const p = dot3(e1, w), q = dot3(e2, w);
  const R = Math.hypot(p, q);
  const delta = Math.atan2(q, p);
  const Az_BS = normAz(Math.atan2(E_B - E_S, N_B - N_S) * R2D);
  const observe = (N, E) => observation(N, E, N_S, E_S, Z_I, Zt, Az_BS);

  const out = {};
  for (const [key, k] of [['left', -1], ['right', 1]]) {
    const psi = delta + k * Math.acos(rho / R);
    const n = add3(scale3(e1, Math.cos(psi)), scale3(e2, Math.sin(psi)));
    const X0 = sub3(A, scale3(n, rho));
    const t = (Zt - X0[2]) / a[2];
    const P = add3(X0, scale3(a, t));
    out[key] = observe(P[0], P[1]);
  }
  const sh = (Z_A - Zt) / V;
  out.centre = observe(N_A + sh * Math.cos(AzR), E_A + sh * Math.sin(AzR));
  return out;
}

/**
 * VERTICAL pile — degenerate symmetric-circle case (doc section 12,
 * note 2). No rake, so centre and left/right positions never depend
 * on Zt: left/right are the centre offset by +-rho perpendicular to
 * the station->centre sightline, at equal H-dist. Zenith/SD still use
 * the given Zt via the observation's Delta-z to the instrument.
 */
export function verticalPileSetout({ N_A, E_A, Dia, Zt, N_S, E_S, Z_I, N_B, E_B }) {
  const rho = Dia / 2;
  const Az_BS = normAz(Math.atan2(E_B - E_S, N_B - N_S) * R2D);
  const observe = (N, E) => observation(N, E, N_S, E_S, Z_I, Zt, Az_BS);
  const azSC = normAz(Math.atan2(E_A - E_S, N_A - N_S) * R2D);
  const leftAz = (azSC - 90) * D2R;
  const rightAz = (azSC + 90) * D2R;
  return {
    centre: observe(N_A, E_A),
    left: observe(N_A + rho * Math.cos(leftAz), E_A + rho * Math.sin(leftAz)),
    right: observe(N_A + rho * Math.cos(rightAz), E_A + rho * Math.sin(rightAz)),
  };
}

/**
 * Dispatcher for the page: reads a pile row's incline text via
 * parseIncline() and routes to the vertical or battered formula.
 * pile: { coordinate_pn, coordinate_pe, pile_top_level, dia_mm, incline, batter_bearing_deg }
 * setup: { N_S, E_S, Z_I, N_B, E_B }
 */
export function computeSetout(pile, Zt, setup) {
  const inc = parseIncline(pile.incline);
  const N_A = pile.coordinate_pn, E_A = pile.coordinate_pe, Z_A = pile.pile_top_level;
  const Dia = pile.dia_mm / 1000;
  if (inc.vertical) {
    return verticalPileSetout({ N_A, E_A, Dia, Zt, ...setup });
  }
  return rakedPileSetout({ N_A, E_A, Z_A, Dia, V: inc.ratio, Az_r_deg: pile.batter_bearing_deg, Zt, ...setup });
}
