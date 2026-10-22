// Final pile levels from the last pile mark, using the ACTUAL slope (PMC comment 21-Oct-2026).
//
// Slope 1:V = horizontal 1 : vertical V.
//   along-pile length per 1 vertical  = sqrt(V² + 1) / V      (vertical -> along pile)
//   vertical per 1 along-pile         = V / sqrt(V² + 1)      (along pile -> vertical)  = "factor f"
//   horizontal per 1 vertical         = 1 / V
//   horizontal per 1 along-pile       = 1 / sqrt(V² + 1)
//   tilt from vertical                = atan(1 / V)
// Example 1:5.12 -> sqrt(27.2144) = 5.2167; ×1.0189 ; ×0.9815 ; ×0.1917 ; 11.05°
//
// Levels (same as the RFI pile driving record, but f from the actual slope):
//   pile tip       = H.I - pile mark × f        (pile mark = length along the pile from the toe to the H.I datum)
//   pile top       = pile tip + L × f           (L  = pile length supplied, piles.length_m)
//   coating bottom = pile top - Lc × f          (Lc = coating length supplied, piles.coating_length_m)
//   coating embedment below seabed = seabed - coating bottom   (criterion ≥ tol_coating_embed_m, default 2.000 m)
//
// f is ROUNDED TO 3 DECIMALS before use (same as the site pile driving record form, 22-Oct-2026):
//   1:5.27 -> 0.982469 -> f = 0.982
// and each product length × f is rounded to 3 decimals as on the form: tip = H.I - ROUND(mark×f,3),
//   top = tip + ROUND(L×f,3), coating bottom = top - ROUND(Lc×f,3)  (matches a hand calculation)

/** Slope factors for 1:V. V null / ≤0 / non-finite = vertical (f = 1). */
export function slopeFactors(V) {
  if (V == null || !Number.isFinite(V) || V <= 0) {
    return { V: null, hyp: null, alongPerVert: 1, vertPerAlong: 1, horizPerVert: 0, horizPerAlong: 0, tiltDeg: 0 };
  }
  const hyp = Math.sqrt(V * V + 1);
  return {
    V,
    hyp,
    alongPerVert: hyp / V,
    vertPerAlong: V / hyp,
    horizPerVert: 1 / V,
    horizPerAlong: 1 / hyp,
    tiltDeg: Math.atan(1 / V) * 180 / Math.PI,
  };
}

/** Factor used in the level calculation: V/√(V²+1) rounded to 3 decimals (as the record form). */
// +1e-9 so an exact .xxx5 stored as .xxx4999… still rounds half-up like Excel ROUND()
export const roundF = (f) => Math.round(f * 1000 + 1e-9) / 1000;

/** Actual slope 1:V from an as-built record's results (slope, else tiltDeg). */
export function slopeFromResults(res) {
  if (!res) return null;
  const v = Number(res.slope);
  if (Number.isFinite(v) && v > 0) return v;
  const t = Number(res.tiltDeg);
  if (Number.isFinite(t) && t > 0) return 1 / Math.tan(t * Math.PI / 180);
  return null;
}

const isNum = (x) => x != null && x !== '' && Number.isFinite(Number(x));

/** Compute final levels. Inputs in metres / mPD. Returns null until H.I and mark are given. */
export function computePileLevels({ hi, mark, seabed, V, L, Lc, embedMin = 2.0 }) {
  if (!isNum(hi) || !isNum(mark)) return null;
  const fx = slopeFactors(V == null ? null : Number(V));
  const f = roundF(fx.vertPerAlong);   // 3-decimal factor, as the record form
  // hand method of the record form: every product (length × f) rounded to 3 decimals, then added
  const r3 = (x) => Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 1000) / 1000;
  const tip = r3(Number(hi) - r3(Number(mark) * f));
  const top = isNum(L) ? r3(tip + r3(Number(L) * f)) : null;
  const coatingBottom = top != null && isNum(Lc) ? r3(top - r3(Number(Lc) * f)) : null;
  const embed = coatingBottom != null && isNum(seabed) ? Number(seabed) - coatingBottom : null;
  return {
    factors: fx,
    f,
    tip,
    top,
    coatingBottom,
    embed,                                         // + = coating bottom below seabed
    embedCheck: embed == null ? null : embed >= embedMin - 1e-9 ? 'OK' : 'NOT OK',
    embedMin,
  };
}
