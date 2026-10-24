// Run: node tests/recordForm.test.js
// "Load all values" on the Form page: a saved record must come back as the exact N/E/Z of all 3 points.
import { recordToFormValues, recordPoints, isSameSurvey, findDuplicate } from '../src/lib/recordForm.js';

let fail = 0;
const eq = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  console.log(`${ok ? 'ok ' : 'FAIL'}  ${name}: ${JSON.stringify(got)}${ok ? '' : ` (expected ${JSON.stringify(exp)})`}`);
  if (!ok) fail++;
};

const rec = {
  station_id: 's1', backsight_id: 'b1', bs_measured_n: 10120.003, bs_measured_e: 10449.998, measured_seabed: -7.789,
  survey_points: [
    { point_no: 2, northing: 10166.9512, easting: 10486.3561, elevation: 2.104 },
    { point_no: 1, northing: 10167.3401, easting: 10486.9158, elevation: 6.5 },
    { point_no: 3, northing: 10167.145, easting: 10486.6352, elevation: 4.312 },
  ],
};
const v = recordToFormValues(rec);
eq('station / BS ids', [v.stationId, v.backsightId], ['s1', 'b1']);
eq('BS measured N/E', [v.bsN, v.bsE], ['10120.003', '10449.998']);
eq('P1 top N/E/Z (order of survey_points does not matter)', v.p1, { n: '10167.3401', e: '10486.9158', el: '6.5' });
eq('P2 bottom N/E/Z', v.p2, { n: '10166.9512', e: '10486.3561', el: '2.104' });
eq('P3 mid N/E/Z', v.p3, { n: '10167.145', e: '10486.6352', el: '4.312' });
eq('seabed keeps the minus sign', v.seabed, '-7.789');

const noP3 = recordToFormValues({ ...rec, survey_points: rec.survey_points.filter((p) => p.point_no !== 3), measured_seabed: null, bs_measured_n: null });
eq('missing P3 -> blank fields', noP3.p3, { n: '', e: '', el: '' });
eq('missing seabed / BS N -> blank', [noP3.seabed, noP3.bsN], ['', '']);
eq('zero values are kept (not blank)', recordToFormValues({ survey_points: [{ point_no: 1, northing: 0, easting: 0, elevation: 0 }] }).p1, { n: '0', e: '0', el: '0' });
eq('no survey_points', recordPoints({}), {});
eq('null record', recordToFormValues(null).p1, { n: '', e: '', el: '' });

// ---- duplicate guard (Save must be blocked when every value is identical to a saved record) ----
const same = recordToFormValues(rec);
eq('identical values -> duplicate', isSameSurvey(same, rec), true);
eq('typed numbers with comma / trailing zero still identical', isSameSurvey({ ...same, p1: { n: '10,167.34010', e: '10486.9158', el: '6.500' } }, rec), true);
eq('one Z differs by 1 mm -> not duplicate', isSameSurvey({ ...same, p2: { ...same.p2, el: '2.105' } }, rec), false);
eq('different STN -> not duplicate', isSameSurvey({ ...same, stationId: 's2' }, rec), false);
eq('different BS -> not duplicate', isSameSurvey({ ...same, backsightId: 'b9' }, rec), false);
eq('new station (no id) -> never duplicate', isSameSurvey({ ...same, stationId: null }, rec), false);
eq('seabed differs -> not duplicate', isSameSurvey({ ...same, seabed: '-7.788' }, rec), false);
eq('seabed blank vs saved value -> not duplicate', isSameSurvey({ ...same, seabed: '' }, rec), false);
eq('P3 typed but record has no P3 -> not duplicate', isSameSurvey(same, { ...rec, survey_points: rec.survey_points.filter((p) => p.point_no !== 3) }), false);
eq('both without P3 -> duplicate', isSameSurvey({ ...same, p3: { n: '', e: '', el: '' } }, { ...rec, survey_points: rec.survey_points.filter((p) => p.point_no !== 3) }), true);
const list = [{ ...rec, id: 'a', survey_points: [] }, { ...rec, id: 'b' }];
eq('findDuplicate returns the matching record', findDuplicate(same, list)?.id, 'b');
eq('findDuplicate skips the record being edited', findDuplicate(same, list, 'b'), null);
eq('findDuplicate with no records', findDuplicate(same, null), null);

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); }
console.log('\nall record-form tests passed');
