// Run: node tests/tolerance.test.js
// Spec Table 4-1 verticality / rake checks (agreed 19-Oct-2026: interpolate N linearly).
import { computeAll, rakeTolRatio, buildTol, posCheckFor } from '../src/lib/calculations.js';

let fail = 0;
const eq = (name, got, exp, eps = 1e-6) => {
  const ok = typeof exp === 'number' ? Math.abs(got - exp) <= eps : got === exp;
  console.log(`${ok ? 'ok ' : 'FAIL'}  ${name}: ${got}${ok ? '' : ` (expected ${exp})`}`);
  if (!ok) fail++;
};

const T = { 4: 25, 6: 40, 8: 50 };
eq('1:4 -> 25', rakeTolRatio(4, T), 25);
eq('1:4.5 -> 28.75', rakeTolRatio(4.5, T), 28.75);
eq('1:5 -> 32.5', rakeTolRatio(5, T), 32.5);
eq('1:6 -> 40', rakeTolRatio(6, T), 40);
eq('1:8 -> 50', rakeTolRatio(8, T), 50);
eq('1:3 clamps to 25', rakeTolRatio(3, T), 25);
eq('1:10 clamps to 50', rakeTolRatio(10, T), 50);

const tol = buildTol({ tol_position_m: 0.15, tol_perp_ratio: 75, tol_rake_1to4: 25, tol_rake_1to6: 40, tol_rake_1to8: 50 });
const D2R = Math.PI / 180;
function run(incline, designAz, slope, az) {
  const p1 = { n: 1000, e: 2000, el: 10 };
  const d = 1;                                 // 1 m horizontal
  const p2 = { n: p1.n + d * Math.cos(az * D2R), e: p1.e + d * Math.sin(az * D2R), el: p1.el - slope * d };
  return computeAll({
    design: { pn: 1000, pe: 2000, cutoff: 6.5, diaMm: 1016, incline, batterAzDeg: designAz },
    stn: { n: 900, e: 1900 }, p1, p2, tol,
  });
}

// TP1-4 as built: 1:5.4253 @ 224.916 vs design 1:5 @ 225 -> in rake 1:64 (limit 1:32.5) OK, perp OK
let o = run('BATT. (1:5)', 225, 5.42529948365083, 224.915865288777);
eq('TP1-4 devRakeRatio', Math.round(o.devRakeRatio), 64, 0);
eq('TP1-4 tolRakeRatio', o.tolRakeRatio, 32.5);
eq('TP1-4 rakeCheck', o.rakeCheck, 'OK');
eq('TP1-4 perpCheck', o.perpCheck, 'OK');
eq('TP1-4 slopeCheck (was OVER with 0.764 deg)', o.slopeCheck, 'OK');

// rake too flat: 1:4.5 actual on 1:5 design -> dev = 0.2222-0.2 = 0.0222 = 1:45 OK ; 1:4.2 -> 0.0381 = 1:26 OVER
eq('1:5 built 1:4.5 OK', run('BATT. (1:5)', 90, 4.5, 90).rakeCheck, 'OK');
eq('1:5 built 1:4.2 OVER', run('BATT. (1:5)', 90, 4.2, 90).rakeCheck, 'OVER');

// perpendicular: 1:5 pile twisted 4 deg -> 0.2*sin4 = 0.01395 = 1:72 OVER ; 3 deg -> 1:96 OK
eq('twist 4deg perp OVER', run('BATT. (1:5)', 90, 5, 94).perpCheck, 'OVER');
eq('twist 3deg perp OK', run('BATT. (1:5)', 90, 5, 93).perpCheck, 'OK');

// azimuth 0 (toe due north) must be checked too (old code skipped it)
o = run('BATT. (1:4.5)', 0, 4.5, 358);
eq('Az 0 diffBatterAz', o.diffBatterAz, -2, 1e-6);
eq('Az 0 perpCheck present', o.perpCheck, 'OK');
eq('1:4.5 tolRakeRatio', o.tolRakeRatio, 28.75);

// vertical: lean 1:80 OK, 1:70 OVER
eq('vertical 1:80 OK', run('VERT.', null, 80, 45).slopeCheck, 'OK');
eq('vertical 1:70 OVER', run('VERT.', null, 70, 45).slopeCheck, 'OVER');
eq('vertical no rake check', run('VERT.', null, 80, 45).rakeCheck, null);

// ITP B.2: position +/-150 mm, N and E separately (not the vector)
eq('TP1-4 dN -0.102 dE -0.129 (total 0.165) -> OK', posCheckFor({ diffN: -0.102, diffE: -0.129, totalDev: 0.165 }, 0.15), 'OK');
eq('dN 0.151 -> OVER', posCheckFor({ diffN: 0.151, diffE: 0, totalDev: 0.151 }, 0.15), 'OVER');
eq('dE -0.20 -> OVER', posCheckFor({ diffN: 0.01, diffE: -0.2, totalDev: 0.2 }, 0.15), 'OVER');
eq('exactly 0.150 -> OK', posCheckFor({ diffN: 0.15, diffE: -0.15, totalDev: 0.212 }, 0.15), 'OK');

if (fail) { console.error(`\n${fail} FAILED`); process.exit(1); }
console.log('\nall tolerance tests passed');
