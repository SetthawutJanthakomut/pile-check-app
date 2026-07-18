// Run: node tests/calculations.test.js
// Every expected value below was read from the verified Excel workbook
// (LibreOffice-recalculated) and cross-checked against the original file.
import { computeAll, bsCheck } from '../src/lib/calculations.js';

const input = {
  design: {
    pn: 1397964.794, pe: 733028.0029, cutoff: 3.525, diaMm: 800,
    incline: 'BATT. (1:8)', batterAzDeg: 135.351, lengthM: 35.10,
    coatingLengthM: 30.0, seaBedLevel: -15.82,
  },
  stn: { n: 1397831.047, e: 733112.184 },
  p1: { n: 1397964.848, e: 733027.269, el: 5.714 },
  p2: { n: 1397964.583, e: 733027.566, el: 2.377 },
  p3: { n: 1397964.7235, e: 733027.4175, el: 4.0455 },
  measuredSeabed: -16.50,
  tol: { positionM: 0.075, tiltDeg: 1.0, residualM: 0.020, coatingEmbedM: 2.0 },
};

const expected = {
  axisAz: 131.741125680699,
  slope: 8.38362826510793,
  tiltDeg: 6.8021081330885,
  azStnP1: 327.599296853563,
  centerN: 1397965.18572854,
  centerE: 733027.054665137,
  dy: 2.189,
  dx: 0.261104134245845,
  asbuiltN: 1397965.01189426,
  asbuiltE: 733027.249490729,
  diffN: 0.217894257744774,
  diffE: -0.75340927077923,
  totalDev: 0.784285303224685,
  residual: 0.00797508964104839,
  designTilt: 7.1250163489018,
  tiltDiff: -0.322908215813303,
  diffBatterAz: -3.60987431930064,
  toeN: 1397962.41796464,
  toeE: 733030.156649588,
  toeZ: -29.1389363964132,
  coatingBottomEl: -24.0748345268489,
  marginToSeabed: -7.57483452684885,
  coatingEmbedM: 7.57483452684885,
  seabedDiff: -0.68,
};

const expectedLabels = {
  dirN: 'GO SOUTH', dirE: 'GO EAST',
  posCheck: 'OVER', p3Check: 'OK', slopeCheck: 'OK',
  marginLabel: 'Below seabed', seabedDiffLabel: 'Deeper (scour)',
  seabedSource: 'measured', coatingCheck: 'OK',
};

const out = computeAll(input);
let fails = 0;

for (const [k, v] of Object.entries(expected)) {
  const got = out[k];
  const ok = Math.abs(got - v) < 1e-6;
  if (!ok) { fails++; console.error(`FAIL ${k}: got ${got}, expected ${v}`); }
  else console.log(`ok  ${k} = ${got}`);
}
for (const [k, v] of Object.entries(expectedLabels)) {
  const ok = out[k] === v;
  if (!ok) { fails++; console.error(`FAIL ${k}: got ${out[k]}, expected ${v}`); }
  else console.log(`ok  ${k} = ${out[k]}`);
}

// seabed fallback: no measured value -> design seabed, margin -8.2548
const out2 = computeAll({ ...input, measuredSeabed: null });
if (Math.abs(out2.marginToSeabed - (-8.25483452684885)) > 1e-6 || out2.seabedSource !== 'design') {
  fails++; console.error(`FAIL seabed fallback: ${out2.marginToSeabed} ${out2.seabedSource}`);
} else console.log(`ok  seabed fallback margin = ${out2.marginToSeabed} (${out2.seabedSource})`);

// vertical pile: no batter az required
const out3 = computeAll({
  ...input,
  design: { ...input.design, incline: 'VERT.', batterAzDeg: null },
});
if (out3.designTilt !== 0 || out3.diffBatterAz !== null) {
  fails++; console.error('FAIL vertical pile handling');
} else console.log('ok  vertical pile: designTilt=0, diffBatterAz=null');

// coating embedment check: tighter tolerance flips OK -> OVER
const out4 = computeAll({ ...input, tol: { ...input.tol, coatingEmbedM: 8.0 } });
if (out4.coatingCheck !== 'OVER') {
  fails++; console.error(`FAIL coatingCheck (tol=8.0): got ${out4.coatingCheck}, expected OVER`);
} else console.log(`ok  coatingCheck (tol=8.0) = ${out4.coatingCheck}`);

// BS check
const bs = bsCheck({ n: 1397885.144, e: 733040.763 }, { n: 1397885.144, e: 733040.763 }, 0.010);
if (!bs.pass || bs.diff !== 0) { fails++; console.error('FAIL bsCheck'); }
else console.log('ok  bsCheck TRUE at diff 0');

console.log(fails === 0 ? '\nALL TESTS PASSED ✓' : `\n${fails} TEST(S) FAILED ✗`);
process.exit(fails === 0 ? 0 : 1);
