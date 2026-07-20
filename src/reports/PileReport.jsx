import { fmt } from '../lib/format';
import { bsCheck, parseIncline, posCheckFor } from '../lib/calculations';
import DeviationPlanView from '../components/DeviationPlanView';

const STAGE_LABEL = {
  before: 'Before driving · ก่อนตอก',
  after: 'After driving · หลังตอก',
};

function fmtDateDMY(dateStr) {
  if (!dateStr) return '—';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMeasuredAt(measuredAt, measuredTime) {
  const t = measuredTime
    ? new Date(measuredTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  return `${measuredAt ?? '—'} ${t}`.trim();
}

function fmtGenerated(d) {
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}

// Survey points keep whatever precision was recorded (3-4 decimals) instead of
// the report's usual fixed-3-decimal fmt().
function fmtRaw(v) {
  return v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 4 });
}

const POINT_LABEL = {
  1: 'Point 1 — Top · จุดสูงสุด',
  3: 'Point 3 — Mid · จุดกลาง (cross-check)',
  2: 'Point 2 — Bottom · จุดต่ำสุด',
};

/**
 * record:    full asbuilt_records row (results jsonb spread as record.results, plus
 *            bs_measured_n/e, note, pile_stage, measured_at, measured_time, surveyor, id)
 * pile:      full piles row (design fields)
 * station:   benchmark row for station_id | null
 * backsight: benchmark row for backsight_id | null
 * tol:       { positionM, tiltDeg, residualM, bsM, coatingEmbedM, crossCheckM } — current settings
 * siblingAsbuilt: { asbuiltN, asbuiltE } of the other driving stage for this pile | null
 * crossCheck: { count, maxDiff } of other surveys of the SAME pile+stage | null
 */
export default function PileReport({ record, pile, station, backsight, tol, siblingAsbuilt, crossCheck }) {
  const results = record.results;
  const inc = parseIncline(pile.incline);
  const isBattered = results.designBatterAz != null;
  // Re-evaluate against the LIVE tolerance rather than trusting the cached
  // results.posCheck, which reflects whatever tolerance was set at save time.
  const posCheck = posCheckFor(results.totalDev, tol.positionM);

  const surveyPoints = {};
  (record.survey_points ?? []).forEach((p) => { surveyPoints[p.point_no] = p; });

  const bsPresent = record.bs_measured_n != null && record.bs_measured_e != null && backsight != null;
  const bsResult = bsPresent
    ? bsCheck({ n: record.bs_measured_n, e: record.bs_measured_e }, { n: backsight.northing, e: backsight.easting }, tol.bsM)
    : null;

  const hasP3 = results.residual != null;
  const hasCoating = results.coatingBottomEl != null;
  const hasHeadMove = siblingAsbuilt != null;
  const moveTotal = hasHeadMove
    ? Math.hypot(results.asbuiltN - siblingAsbuilt.asbuiltN, results.asbuiltE - siblingAsbuilt.asbuiltE)
    : null;

  const year = (record.measured_at ?? '').slice(0, 4) || new Date().getFullYear();
  const reportNo = `PCR-${year}-${record.id.slice(0, 8).toUpperCase()}`;
  const generatedAt = fmtGenerated(new Date());
  const host = typeof window !== 'undefined' ? window.location.host : '';

  return (
    <div className="page">
      <header>
        <div>
          <h1><span className="mark">⌖</span> AS-BUILT PILE REPORT</h1>
          <div className="sub">Pile position check by Total Station · รายงานตรวจสอบตำแหน่งเสาเข็ม</div>
        </div>
        <div className="meta">
          Report No. : <span className="mono">{reportNo}</span><br />
          Date : <span className="mono">{fmtDateDMY(record.measured_at)}</span><br />
          Page 1 / 1
        </div>
      </header>

      <div className="projline">
        <span><b>Project :</b> GULF MTP LNG RECEIVING TERMINAL PROJECT - Marine Works</span>
        <span style={{ color: 'var(--muted)' }}>Contractor : ____________ &nbsp;·&nbsp; Consultant : ____________</span>
      </div>

      <div className="band">1. PILE INFORMATION (DESIGN)</div>
      <div className="grid g4">
        <div><div className="lbl">Pile No.</div><div className="val mono">{pile.pile_no}</div></div>
        <div><div className="lbl">Diameter</div><div className="val mono">{pile.dia_mm != null ? `${Number(pile.dia_mm).toLocaleString('en-US')} mm` : '—'}</div></div>
        <div><div className="lbl">Design N (PN)</div><div className="val mono">{fmt(pile.coordinate_pn)}</div></div>
        <div><div className="lbl">Cut-off EL.</div><div className="val mono">{fmt(pile.pile_top_level)}</div></div>
        <div><div className="lbl">Incline</div><div className="val mono">{pile.incline}</div></div>
        <div><div className="lbl">Length</div><div className="val mono">{pile.length_m != null ? `${fmt(pile.length_m, 2)} m` : '—'}</div></div>
        <div><div className="lbl">Design E (PE)</div><div className="val mono">{fmt(pile.coordinate_pe)}</div></div>
        <div><div className="lbl">Pile Tip Design · ปลายเข็มตามแบบ</div><div className="val mono">{fmt(pile.pile_toe_level)}</div></div>
        {isBattered && (
          <div><div className="lbl">Batter Az. <span style={{ fontWeight: 400 }}>(battered piles only · เฉพาะเข็มเอียง)</span></div>
            <div className="val mono">{fmt(results.designBatterAz)}°</div></div>
        )}
      </div>

      <div className="band">2. SURVEY SETUP</div>
      <div className="grid g4">
        <div><div className="lbl">Station (STN)</div><div className="val mono">{station?.name ?? '—'}</div></div>
        {bsPresent && (
          <div><div className="lbl">Backsight check <span style={{ fontWeight: 400 }}>(shown only if checked · แสดงเมื่อมีการเช็คเท่านั้น)</span></div>
            <div className="val mono" style={{ color: bsResult.pass ? 'var(--pass)' : 'var(--fail)' }}>
              {bsResult.pass ? 'TRUE' : 'FALSE'} <span className="rem" style={{ fontSize: '8.5px', color: 'var(--muted)' }}>diff {fmt(bsResult.diff, 4)} m / tol {fmt(tol.bsM, 3)} m</span>
            </div></div>
        )}
        <div><div className="lbl">Stage · ช่วง</div><div className="val">{STAGE_LABEL[record.pile_stage] ?? record.pile_stage ?? '—'}</div></div>
        <div><div className="lbl">Surveyed by</div><div className="val" style={{ fontSize: '10px' }}>{record.surveyor}</div></div>
        <div><div className="lbl">Measured at</div><div className="val mono">{fmtMeasuredAt(record.measured_at, record.measured_time)}</div></div>
        <div style={{ gridColumn: 'span 3' }}><div className="lbl">Method</div>
          <div className="val" style={{ fontSize: '9.5px', fontWeight: 400 }}>Edge bisection (mean of left/right pan) at 2 points on pile surface + Point-3 mid cross-check</div></div>
        {crossCheck && crossCheck.count > 0 && (
          <div style={{ gridColumn: 'span 3' }}><div className="lbl">Cross-check · เทียบกับผู้สำรวจอื่น</div>
            <div className="val" style={{ fontSize: '9.5px', fontWeight: 400, color: crossCheck.maxDiff <= tol.crossCheckM ? 'var(--pass)' : 'var(--fail)' }}>
              Cross-checked against {crossCheck.count} other survey(s): max diff {fmt(crossCheck.maxDiff, 3)} m — {crossCheck.maxDiff <= tol.crossCheckM ? 'OK' : 'CHECK'}
            </div></div>
        )}
      </div>
      <table className="pts">
        <tbody>
          <tr>
            <th>Survey points (on pile surface) · จุดวัดบนผิวเข็ม</th>
            <th className="r">Northing</th>
            <th className="r">Easting</th>
            <th className="r">Elev.</th>
          </tr>
          {[1, 3, 2].filter((n) => surveyPoints[n]).map((n) => (
            <tr key={n}>
              <td>{POINT_LABEL[n]}</td>
              <td className="r mono">{fmtRaw(surveyPoints[n].northing)}</td>
              <td className="r mono">{fmtRaw(surveyPoints[n].easting)}</td>
              <td className="r mono">{fmtRaw(surveyPoints[n].elevation)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="band">3. AS-BUILT RESULT @ DESIGN CUT-OFF LEVEL ({fmt(pile.pile_top_level)})</div>
      <div className="results">
        <table>
          <tbody>
            <tr><th>Item</th><th className="r">Value</th><th>Remark</th></tr>
            <tr><td>As-built Northing</td><td className="r mono"><b>{fmt(results.asbuiltN)}</b></td><td></td></tr>
            <tr><td>As-built Easting</td><td className="r mono"><b>{fmt(results.asbuiltE)}</b></td><td></td></tr>
            <tr><td>Diff Northing</td><td className="r mono"><b>{fmt(results.diffN)}</b></td><td><span className="go">{results.dirN}</span></td></tr>
            <tr><td>Diff Easting</td><td className="r mono"><b>{fmt(results.diffE)}</b></td><td><span className="go">{results.dirE}</span></td></tr>
            <tr><td>Total deviation</td><td className="r mono"><b>{fmt(results.totalDev)}</b></td><td className="rem">tolerance {fmt(tol.positionM, 3)} m</td></tr>
            <tr><td>Actual slope</td><td className="r mono"><b>1 : {fmt(results.slope, 2)}</b></td><td className="rem">design {inc.vertical ? 'VERT' : `1 : ${inc.ratio}`}</td></tr>
            <tr><td>Tilt diff from design</td><td className="r mono"><b>{fmt(results.tiltDiff)}°</b></td><td className="rem">tolerance {fmt(tol.tiltDeg, 1)}°</td></tr>
            {hasP3 && (
              <tr><td>P3 residual (cross-check)</td><td className="r mono"><b>{fmt(results.residual, 4)}</b></td><td className="rem">tolerance {fmt(tol.residualM, 3)} m</td></tr>
            )}
            {hasHeadMove && (
              <tr><td>Head moved during driving</td><td className="r mono"><b>{fmt(moveTotal)}</b></td><td className="rem">before → after</td></tr>
            )}
          </tbody>
        </table>
        <div className="side">
          <div className="stamps">
            <div className={`stamp ${posCheck === 'OK' ? 'pass' : 'fail'}`}>
              <b>{posCheck}</b>
              <small>POSITION {fmt(results.totalDev)} {posCheck === 'OK' ? '≤' : '>'} {fmt(tol.positionM, 3)} m</small>
            </div>
            <div className={`stamp ${results.slopeCheck === 'OK' ? 'pass' : 'fail'}`}>
              <b>SLOPE {results.slopeCheck}</b>
              <small>1:{fmt(results.slope, 2)} vs {inc.vertical ? 'VERT' : `1:${inc.ratio}`}</small>
            </div>
            {hasP3 && (
              <div className={`stamp ${results.p3Check === 'OK' ? 'pass' : 'fail'}`}>
                <b>P3 {results.p3Check}</b>
                <small>residual {fmt(results.residual, 4)} m</small>
              </div>
            )}
            {bsPresent && (
              <div className={`stamp ${bsResult.pass ? 'pass' : 'fail'}`}>
                <b>BS {bsResult.pass ? 'TRUE' : 'FALSE'}</b>
                <small>{bsResult.pass ? 'setup verified' : 're-setup station'}</small>
              </div>
            )}
          </div>
          <div className="sketch">
            <DeviationPlanView
              diffN={results.diffN}
              diffE={results.diffE}
              totalDev={results.totalDev}
              tolerance={tol.positionM}
              posCheck={posCheck}
            />
          </div>
        </div>
      </div>

      <div className="band">
        4. PILE TOE{hasCoating ? ' & COATING' : ''} (extended along actual axis){hasCoating ? ` — coating must embed ≥ ${fmt(tol.coatingEmbedM, 3)} m below seabed` : ''}
      </div>
      <div className={`grid ${hasCoating ? 'g6' : 'g3'}`}>
        <div><div className="lbl">Toe N</div><div className="val mono">{fmt(results.toeN)}</div></div>
        <div><div className="lbl">Toe E</div><div className="val mono">{fmt(results.toeE)}</div></div>
        <div><div className="lbl">Toe Z</div><div className="val mono">{fmt(results.toeZ)}</div></div>
        {hasCoating && (
          <>
            <div><div className="lbl">Coating bottom EL.</div><div className="val mono">{fmt(results.coatingBottomEl)}</div></div>
            <div><div className="lbl">Seabed ({results.seabedSource})</div><div className="val mono">{fmt(results.seabedUsed)}</div></div>
            <div><div className="lbl">Margin to seabed <span style={{ fontWeight: 400 }}>(req ≤ −{fmt(tol.coatingEmbedM, 3)})</span></div>
              <div className="val mono" style={{ color: results.coatingCheck === 'OK' ? 'var(--pass)' : 'var(--fail)' }}>
                <b>{fmt(results.marginToSeabed)}</b> {results.coatingCheck === 'OK' ? '✔ OK' : '✘ OVER'}
              </div></div>
          </>
        )}
      </div>

      <div className="notes">
        <b>Notes / หมายเหตุ :</b>
        {record.note ? <div style={{ padding: '4px 0' }}>{record.note}</div> : (
          <>
            <div className="nline"></div>
            <div className="nline"></div>
          </>
        )}
      </div>

      <div className="band">5. APPROVAL</div>
      <div className="sig">
        <div className="sigbox"><div className="who">Surveyed by · ผู้สำรวจ</div>
          <div className="sline"></div><div className="nm">( {record.surveyor} )</div><div className="dt">Date : {record.measured_at ?? '—'}</div></div>
        <div className="sigbox"><div className="who">Checked by · ผู้ตรวจสอบ</div>
          <div className="sline"></div><div className="nm">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div><div className="dt">Date :</div></div>
        <div className="sigbox"><div className="who">Approved by · ผู้อนุมัติ</div>
          <div className="sline"></div><div className="nm">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div><div className="dt">Date :</div></div>
      </div>

      <footer>
        <span>Generated by Pile Check · {host} · {generatedAt}</span>
        <span>Tolerances : position {fmt(tol.positionM, 3)} m · tilt {fmt(tol.tiltDeg, 1)}° · P3 residual {fmt(tol.residualM, 3)} m · BS {fmt(tol.bsM, 3)} m · coating embed ≥ {fmt(tol.coatingEmbedM, 3)} m below seabed</span>
      </footer>
    </div>
  );
}
