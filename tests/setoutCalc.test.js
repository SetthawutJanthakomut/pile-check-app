// Run: node tests/setoutCalc.test.js
// BATTERED fixture: worked example, docs/Raked-Pile Setout — Calculation
// Method.md section 11 (pile MD-1-1, Level A Zt=+5.650, Level B Zt=-5.000).
import { rakedPileSetout, verticalPileSetout, toDMS } from '../src/lib/setoutCalc.js';

let fails = 0;
const near = (got, exp, tol, label) => {
  const ok = Math.abs(got - exp) < tol;
  if (!ok) { fails++; console.error(`FAIL ${label}: got ${got}, expected ${exp}`); }
  else console.log(`ok  ${label} = ${got}`);
};
const dmsEq = (got, exp, label) => {
  const gotStr = toDMS(got);
  const ok = gotStr === exp;
  if (!ok) { fails++; console.error(`FAIL ${label}: got ${gotStr}, expected ${exp}`); }
  else console.log(`ok  ${label} = ${gotStr}`);
};

// ---------------- BATTERED: worked example (section 11) ----------------
const setup = {
  N_S: 10050.000, E_S: 10600.000, Z_I: 3.000 + 1.600, // Z_I = Z_S + HI = 4.600
  N_B: 10050.000, E_B: 10400.000,
};
const pile = { N_A: 9982.195, E_A: 10480.755, Z_A: 5.650, Dia: 1.2192, V: 5, Az_r_deg: 45.0 };

function checkLevel(label, Zt, expected) {
  const out = rakedPileSetout({ ...pile, Zt, ...setup });
  for (const [key, exp] of Object.entries(expected)) {
    const pt = out[key];
    near(pt.N, exp.N, 0.001, `${label} ${key} N`);
    near(pt.E, exp.E, 0.001, `${label} ${key} E`);
    near(pt.HD, exp.HD, 0.001, `${label} ${key} HD`);
    near(pt.SD, exp.SD, 0.001, `${label} ${key} SD`);
    dmsEq(pt.Az, exp.Az, `${label} ${key} Az`);
    dmsEq(pt.ZA, exp.ZA, `${label} ${key} ZA`);
  }
}

checkLevel('Level A', 5.650, {
  centre: { N: 9982.195, E: 10480.755, Az: '240°22\'36"', HD: 137.175, SD: 137.179, ZA: '89°33\'41"' },
  left: { N: 9981.663, E: 10481.054, Az: '240°07\'18"', HD: 137.180, SD: 137.184, ZA: '89°33\'41"' },
  right: { N: 9982.730, E: 10480.461, Az: '240°37\'54"', HD: 137.167, SD: 137.171, ZA: '89°33\'41"' },
});

checkLevel('Level B', -5.000, {
  centre: { N: 9983.701, E: 10482.261, Az: '240°36\'58"', HD: 135.122, SD: 135.463, ZA: '94°03\'50"' },
  left: { N: 9983.169, E: 10482.560, Az: '240°21\'26"', HD: 135.125, SD: 135.465, ZA: '94°03\'50"' },
  right: { N: 9984.236, E: 10481.967, Az: '240°52\'30"', HD: 135.117, SD: 135.457, ZA: '94°03\'50"' },
});

// ---------------- VERTICAL: level-independence + symmetry ----------------
const vSetup = {
  N_A: 10000, E_A: 10000, Dia: 1.2,
  N_S: 10100, E_S: 10000, Z_I: 5.0,
  N_B: 10100, E_B: 9800,
};
const vA = verticalPileSetout({ ...vSetup, Zt: 2.0 });
const vB = verticalPileSetout({ ...vSetup, Zt: -3.0 });

near(vA.left.HD, vA.right.HD, 1e-9, 'vertical left/right HD equal (same level)');

for (const key of ['centre', 'left', 'right']) {
  near(vA[key].N, vB[key].N, 1e-9, `vertical ${key} N identical across Zt`);
  near(vA[key].E, vB[key].E, 1e-9, `vertical ${key} E identical across Zt`);
  near(vA[key].Az, vB[key].Az, 1e-9, `vertical ${key} Az identical across Zt`);
  near(vA[key].HD, vB[key].HD, 1e-9, `vertical ${key} HD identical across Zt`);
}

if (Math.abs(vA.centre.ZA - vB.centre.ZA) < 1e-6) {
  fails++; console.error(`FAIL vertical Zenith should differ between levels: ${vA.centre.ZA} vs ${vB.centre.ZA}`);
} else console.log(`ok  vertical Zenith differs across Zt: ${vA.centre.ZA} vs ${vB.centre.ZA}`);

console.log(fails === 0 ? '\nALL TESTS PASSED ✓' : `\n${fails} TEST(S) FAILED ✗`);
process.exit(fails === 0 ? 0 : 1);
