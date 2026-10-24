// Run: node tests/pileLevel.test.js
// Final pile levels with the actual slope (PMC comment 21-Oct-2026).
import { slopeFactors, computePileLevels, slopeFromResults, roundF } from '../src/lib/pileLevelCalc.js';

let fail = 0;
const eq = (name, got, exp, eps = 1e-6) => {
  const ok = typeof exp === 'number' ? Math.abs(got - exp) <= eps : got === exp;
  console.log(`${ok ? 'ok ' : 'FAIL'}  ${name}: ${got}${ok ? '' : ` (expected ${exp})`}`);
  if (!ok) fail++;
};

// worked example 1:5.12
const fx = slopeFactors(5.12);
eq('1:5.12 inclined side', fx.hyp, 5.2167, 5e-5);
eq('1:5.12 vertical -> along', fx.alongPerVert, 1.0189, 5e-5);
eq('1:5.12 along -> vertical', fx.vertPerAlong, 0.9815, 5e-5);
eq('1:5.12 along -> horizontal', fx.horizPerAlong, 0.1917, 5e-5);
eq('1:5.12 tilt deg', fx.tiltDeg, 11.05, 5e-3);
eq('vertical f = 1', slopeFactors(null).vertPerAlong, 1);

// RFI TP4-5 (design factor 0.981): tip -28.942, top +8.532, coating bottom -9.322, sinking 2.775
const V981 = 0.981 / Math.sqrt(1 - 0.981 ** 2);
const r = computePileLevels({ hi: 6.5, mark: 36.128, seabed: -6.547, V: V981, L: 38.2, Lc: 18.2 });
eq('TP4-5 tip', r.tip, -28.942, 1e-3);
eq('TP4-5 top', r.top, 8.532, 1e-3);
eq('TP4-5 coating bottom', r.coatingBottom, -9.322, 1e-3);
eq('TP4-5 embedment', r.embed, 2.775, 1e-3);
eq('TP4-5 check', r.embedCheck, 'OK');

// actual slope
const f = Math.round(5.227 / Math.sqrt(5.227 ** 2 + 1) * 1000) / 1000;   // 3-decimal factor
const a = computePileLevels({ hi: 6.5, mark: 36.128, seabed: -6.547, V: 5.227, L: 38.2, Lc: 18.2 });
eq('actual f', a.f, f, 1e-12);
const r3 = (x) => Math.round(x * 1000) / 1000;
eq('actual tip', a.tip, r3(6.5 - r3(36.128 * f)), 1e-9);
eq('actual top', a.top, r3(a.tip + r3(38.2 * f)), 1e-9);

// TP1-1 record form (1:5.27, mark 36.372, H.I 6.5, L 38.2, Lc 18.2): f 0.982, tip -29.217, top +8.295, coating -9.577
const c = computePileLevels({ hi: 6.5, mark: 36.372, seabed: -5.862, V: 5.27, L: 38.2, Lc: 18.2 });
eq('TP1-1 f rounded', c.f, 0.982);
eq('roundF half-up like Excel (0.9825 -> 0.983)', roundF(0.9825), 0.983);
eq('roundF 0.98153 -> 0.982', roundF(0.981526), 0.982);
eq('TP1-1 tip', c.tip, -29.217, 5e-4);
eq('TP1-1 top', c.top, 8.295, 5e-4);
eq('TP1-1 coating bottom', c.coatingBottom, -9.577, 5e-4);

// hand method: 1:5.27, mark 36.300 -> tip -29.147 (36.300×0.982 = 35.6466 -> 35.647), top = -29.147 + 37.512 = 8.365
const h = computePileLevels({ hi: 6.5, mark: 36.3, seabed: -6, V: 5.27, L: 38.2, Lc: 18.2 });
eq('hand-method tip', h.tip, -29.147, 1e-9);
eq('hand-method top (not 8.366)', h.top, 8.365, 1e-9);
eq('hand-method coating', h.coatingBottom, -9.507, 1e-9);

// slope taken to 3 decimals: 1:5.2664 and 1:5.266 give the same result
eq('V rounded to 3 dp', computePileLevels({ hi: 6.5, mark: 36.3, V: 5.2664, L: 38.2, Lc: 18.2 }).factors.V, 5.266);

const b = computePileLevels({ hi: 6.5, mark: 36.077, seabed: -7.789, V: 5.2, L: 38.2, Lc: 18.2 });
eq('short coating NOT OK', b.embedCheck, 'NOT OK');
eq('null until H.I + mark', computePileLevels({ hi: null, mark: 36, V: 5 }), null);

eq('slope from results', slopeFromResults({ slope: 5.2 }), 5.2);
eq('slope from tilt', slopeFromResults({ tiltDeg: 45 }), 1, 1e-12);
eq('slope none', slopeFromResults(null), null);

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); }
console.log('\nall pile-level tests passed');
