import { fmt, num } from '../lib/format';
import { posCheckFor } from '../lib/calculations';
import DeviationPlanView from './DeviationPlanView';

const STAGE_LABEL = {
  before: 'Before driving · ก่อนตอก',
  after: 'After driving · หลังตอก',
};

// Read-only as-built summary panel. Shared by the live Form and the Records detail view.
// `tol` and `inc` are optional — when omitted, the tolerance/design-slope hints are left out.
// `stage` and `note` are optional — when omitted, the stage/note block is left out.
export default function ResultReadout({ results, p1El, tol, inc, stage, note }) {
  // Re-evaluate against the LIVE tolerance rather than trusting the cached
  // results.posCheck, which reflects whatever tolerance was set at save time.
  // Falls back to the cached verdict when no tolerance is loaded (tol omitted).
  const posCheck = tol ? posCheckFor(results.totalDev, tol.positionM) : results.posCheck;
  return (
    <section className="readout mono">
      {(stage || note) && (
        <div className="readout-notes">
          {stage && <div className="stage-tag">{STAGE_LABEL[stage] ?? stage}</div>}
          {note && <div className="note-text">{note}</div>}
        </div>
      )}
      <div className="readout-caption">{new Date().toLocaleString()}</div>
      <div className="readout-head">AS-BUILT @ DESIGN CUT-OFF ({fmt(results.asbuiltEl)})</div>
      <div className="readout-grid">
        <div><span>N</span>{fmt(results.asbuiltN)}</div>
        <div><span>E</span>{fmt(results.asbuiltE)}</div>
      </div>
      <div className="readout-grid">
        <div><span>Diff N</span>{fmt(results.diffN)} <b>{results.dirN}</b></div>
        <div><span>Diff E</span>{fmt(results.diffE)} <b>{results.dirE}</b></div>
      </div>
      <div className="verdict-row">
        <div className={`stamp big ${posCheck === 'OK' ? 'pass' : 'fail'}`}>
          {posCheck}
          <small>total {fmt(results.totalDev)} m{tol ? ` / tol ${tol.positionM}` : ''}</small>
        </div>
        <div className={`stamp ${results.slopeCheck === 'OK' ? 'pass' : 'fail'}`}>
          slope {results.slopeCheck}
          <small>1:{fmt(results.slope, 2)}{inc ? ` vs ${inc.vertical ? 'VERT' : `1:${inc.ratio}`}` : ''}</small>
        </div>
        {results.p3Check && (
          <div className={`stamp ${results.p3Check === 'OK' ? 'pass' : 'fail'}`}>
            P3 {results.p3Check}
            <small>res {fmt(results.residual, 4)} m</small>
          </div>
        )}
      </div>

      <div className="plan-view">
        <DeviationPlanView
          diffN={results.diffN}
          diffE={results.diffE}
          totalDev={results.totalDev}
          tolerance={tol?.positionM}
          posCheck={posCheck}
        />
      </div>

      <details className="more">
        <summary>Toe · Batter Az · Coating</summary>
        <div className="readout-head">AS-BUILT PILE TOP CENTER · จุดศูนย์กลางหัวเข็ม</div>
        <div className="readout-grid">
          <div><span>N</span>{fmt(results.centerN)}</div>
          <div><span>E</span>{fmt(results.centerE)}</div>
          <div><span>El.</span>{fmt(num(p1El))}</div>
        </div>
        <div className="readout-grid">
          <div><span>Toe N</span>{fmt(results.toeN)}</div>
          <div><span>Toe E</span>{fmt(results.toeE)}</div>
          <div><span>Toe Z</span>{fmt(results.toeZ)}</div>
        </div>
        {results.toeZDiff != null && (
          <div className="readout-grid">
            <div><span>Toe Z Diff · ต่างระดับปลายเข็ม</span>{fmt(results.toeZDiff)} <b>{results.toeZCheck}</b></div>
          </div>
        )}
        {results.toeDiffN != null && (
          <div className="readout-grid">
            <div><span>Toe Diff N · ต่างแนว N ที่ปลายเข็ม</span>{fmt(results.toeDiffN)} <b>{results.toeDirN}</b></div>
            <div><span>Toe Diff E · ต่างแนว E ที่ปลายเข็ม</span>{fmt(results.toeDiffE)} <b>{results.toeDirE}</b></div>
            <div><span>Toe total · รวมค่าเบี่ยงเบนปลายเข็ม</span>{fmt(results.toeTotalDev)}</div>
          </div>
        )}
        <div className="readout-grid">
          <div><span>Batter Az</span>{fmt(results.asbuiltBatterAz)}°</div>
          <div><span>Design</span>{results.designBatterAz == null ? '— (VERT)' : `${fmt(results.designBatterAz)}°`}</div>
          <div><span>Diff Az</span>{results.diffBatterAz == null ? '—' : `${fmt(results.diffBatterAz)}°`}</div>
        </div>
        {results.coatingBottomEl != null && (
          <div className="readout-grid">
            <div><span>Coat. bottom</span>{fmt(results.coatingBottomEl)}</div>
            <div><span>Seabed ({results.seabedSource})</span>{fmt(results.seabedUsed)}</div>
            <div>
              <span>Margin</span>{fmt(results.marginToSeabed)} <b>{results.marginLabel}</b>
              {results.coatingCheck && (
                <span className={`stamp ${results.coatingCheck === 'OK' ? 'pass' : 'fail'}`}>
                  {results.coatingCheck}
                </span>
              )}
            </div>
          </div>
        )}
        {results.seabedDiff != null && (
          <div className="readout-grid">
            <div><span>Seabed diff</span>{fmt(results.seabedDiff)} <b>{results.seabedDiffLabel}</b></div>
          </div>
        )}
      </details>
    </section>
  );
}
