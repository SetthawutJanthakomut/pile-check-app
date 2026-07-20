import { useState } from 'react';
import ResultReadout from './ResultReadout';
import { exportRecordsToExcel } from '../lib/exportExcel';
import { fmt } from '../lib/format';
import { crossCheckDiff } from '../lib/calculations';
import { effectivePrimary } from '../lib/primary';
import { fetchReportInputs } from '../reports/fetchReportData';
import { printPileReport } from '../reports/printPileReport';
import { savePileReportImage } from '../reports/savePileReportImage';

function fmtWhen(row) {
  const t = row.measured_time
    ? new Date(row.measured_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  return `${row.measured_at ?? '—'} ${t}`.trim();
}

// Cross-check within a pile+stage group: diff between the effective primary
// and every other member, worst case wins. null when there's nothing to compare.
function crossCheckInfo(members) {
  if (!members || members.length < 2) return null;
  const primary = effectivePrimary(members);
  let maxDiff = 0;
  members.forEach((m) => {
    if (m.id === primary.id) return;
    maxDiff = Math.max(maxDiff, crossCheckDiff(primary, m));
  });
  return { count: members.length - 1, maxDiff };
}

function CrossCheckBadge({ cc, tol }) {
  if (!cc || tol == null) return null;
  const pass = cc.maxDiff <= tol;
  return (
    <div className={`crosscheck-badge ${pass ? 'pass' : 'fail'}`}>
      {pass
        ? `✓ surveys agree, max diff ${fmt(cc.maxDiff, 3)} m`
        : `⚠ Surveys disagree — max diff ${fmt(cc.maxDiff, 3)} m > tolerance ${fmt(tol, 3)} m · ผลวัดไม่ตรงกัน อาจพิมพ์ตัวเลขผิด`}
    </div>
  );
}

// Condensed list of the non-primary records for a pile+stage, shown below the
// primary's ResultReadout so admins/recorders can inspect and re-designate
// primary without leaving the modal.
function OtherSurveys({ members, primary, tol, canSetPrimary, onSetPrimary }) {
  const others = (members || []).filter((m) => m.id !== primary.id);
  if (others.length === 0) return null;
  return (
    <div className="card other-surveys">
      <h4>Other surveys of this pile+stage · การวัดอื่นของเข็มนี้</h4>
      {others.map((m) => {
        const diff = crossCheckDiff(primary, m);
        return (
          <div key={m.id} className="other-survey-row">
            <span>{m.surveyor || '—'} · {fmtWhen(m)}</span>
            <span>N {fmt(m.asbuiltN)} E {fmt(m.asbuiltE)}</span>
            <span className={diff > tol ? 'diff-warn' : ''}>diff {fmt(diff, 3)} m</span>
            {canSetPrimary && (
              <button className="link" onClick={() => onSetPrimary?.(m.id)}>Set as primary · ตั้งเป็นค่าหลัก</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// `row` is the clicked table row — only its pile_no/pile_stage identify which
// group to show. The modal always displays a group's EFFECTIVE PRIMARY record
// (see lib/primary.js), so the on-screen data, PDF/PNG report, and the flat
// table row always agree — never printing something different from what's
// on screen.
// `group` is { before: Row[], after: Row[] } — all rows for this pile_no, grouped by stage.
// `tolCrossCheckM` is the max allowed diff between two surveys of the same pile+stage.
// `tolPositionM` is the live position tolerance — passed through to ResultReadout so its
// OK/OVER verdict matches the current Settings value instead of the cached save-time one.
export default function RecordDetailModal({ row, group, tolCrossCheckM, tolPositionM, columns, canSetPrimary, onSetPrimary, onClose }) {
  const [printing, setPrinting] = useState(null);
  const [printError, setPrintError] = useState(null);
  const [saving, setSaving] = useState(null);
  const [saveError, setSaveError] = useState(null);

  async function handlePrint(recordRow, siblingAsbuilt, crossCheck) {
    setPrinting(recordRow.id);
    setPrintError(null);
    try {
      const { record, pile, station, backsight, tol } = await fetchReportInputs(recordRow.id);
      printPileReport({ record, pile, station, backsight, tol, siblingAsbuilt, crossCheck });
    } catch (err) {
      setPrintError(err.message);
    } finally {
      setPrinting(null);
    }
  }

  async function handleSaveImage(recordRow, siblingAsbuilt, crossCheck) {
    setSaving(recordRow.id);
    setSaveError(null);
    try {
      const { record, pile, station, backsight, tol } = await fetchReportInputs(recordRow.id);
      await savePileReportImage({ record, pile, station, backsight, tol, siblingAsbuilt, crossCheck });
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(null);
    }
  }

  const beforeGroup = group?.before || [];
  const afterGroup = group?.after || [];
  const both = beforeGroup.length > 0 && afterGroup.length > 0;

  if (!both) {
    const stageGroup = group?.[row.pile_stage] || [row];
    const primary = effectivePrimary(stageGroup) || row;
    const cc = crossCheckInfo(stageGroup);

    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>{primary.pile_no}</h2>
              <p className="hint">{primary.surveyor} · {fmtWhen(primary)}</p>
              <CrossCheckBadge cc={cc} tol={tolCrossCheckM} />
            </div>
            <button className="link" onClick={onClose}>Close · ปิด</button>
          </div>
          <ResultReadout results={primary} p1El={primary.p1el} tol={tolPositionM != null ? { positionM: tolPositionM } : undefined} stage={primary.pile_stage} note={primary.note} />
          <OtherSurveys members={stageGroup} primary={primary} tol={tolCrossCheckM} canSetPrimary={canSetPrimary} onSetPrimary={onSetPrimary} />
          <button className="btn-secondary" onClick={() => exportRecordsToExcel(columns, [primary])}>
            Export this record · ส่งออกระเบียนนี้
          </button>
          <button className="btn-secondary" disabled={printing === primary.id} onClick={() => handlePrint(primary, null, cc)}>
            {printing === primary.id ? 'Preparing… · กำลังเตรียม' : 'PDF report · รายงาน PDF'}
          </button>
          <button className="btn-secondary" disabled={saving === primary.id} onClick={() => handleSaveImage(primary, null, cc)}>
            {saving === primary.id ? 'Preparing… · กำลังเตรียม' : 'Save image · บันทึกรูป'}
          </button>
          {printError && <p className="form-err">{printError}</p>}
          {saveError && <p className="form-err">{saveError}</p>}
        </div>
      </div>
    );
  }

  const beforePrimary = effectivePrimary(beforeGroup);
  const afterPrimary = effectivePrimary(afterGroup);
  const ccBefore = crossCheckInfo(beforeGroup);
  const ccAfter = crossCheckInfo(afterGroup);
  const moveN = afterPrimary.asbuiltN - beforePrimary.asbuiltN;
  const moveE = afterPrimary.asbuiltE - beforePrimary.asbuiltE;
  const moveTotal = Math.sqrt(moveN * moveN + moveE * moveE);
  const dirN = moveN < 0 ? 'moved SOUTH · ขยับไปทางใต้' : 'moved NORTH · ขยับไปทางเหนือ';
  const dirE = moveE < 0 ? 'moved WEST · ขยับไปทางตก' : 'moved EAST · ขยับไปทางออก';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{beforePrimary.pile_no}</h2>
            <p className="hint">Before + after driving · ก่อนและหลังตอก</p>
          </div>
          <button className="link" onClick={onClose}>Close · ปิด</button>
        </div>
        <div className="card movement-summary">
          <div className="stage-tag">Head moved during driving · หัวเข็มขยับตอนตอก</div>
          <div className="readout-grid">
            <div><span>Move N</span>{fmt(moveN)} <b>{dirN}</b></div>
            <div><span>Move E</span>{fmt(moveE)} <b>{dirE}</b></div>
            <div><span>Move Total</span>{fmt(moveTotal)}</div>
          </div>
        </div>
        <div className="modal-columns">
          <div className="card modal-column">
            <p className="hint">{beforePrimary.surveyor} · {fmtWhen(beforePrimary)}</p>
            <CrossCheckBadge cc={ccBefore} tol={tolCrossCheckM} />
            <ResultReadout results={beforePrimary} p1El={beforePrimary.p1el} tol={tolPositionM != null ? { positionM: tolPositionM } : undefined} stage="before" note={beforePrimary.note} />
            <OtherSurveys members={beforeGroup} primary={beforePrimary} tol={tolCrossCheckM} canSetPrimary={canSetPrimary} onSetPrimary={onSetPrimary} />
            <button className="btn-secondary" disabled={printing === beforePrimary.id}
              onClick={() => handlePrint(beforePrimary, { asbuiltN: afterPrimary.asbuiltN, asbuiltE: afterPrimary.asbuiltE }, ccBefore)}>
              {printing === beforePrimary.id ? 'Preparing… · กำลังเตรียม' : 'PDF report · รายงาน PDF'}
            </button>
            <button className="btn-secondary" disabled={saving === beforePrimary.id}
              onClick={() => handleSaveImage(beforePrimary, { asbuiltN: afterPrimary.asbuiltN, asbuiltE: afterPrimary.asbuiltE }, ccBefore)}>
              {saving === beforePrimary.id ? 'Preparing… · กำลังเตรียม' : 'Save image · บันทึกรูป'}
            </button>
          </div>
          <div className="card modal-column">
            <p className="hint">{afterPrimary.surveyor} · {fmtWhen(afterPrimary)}</p>
            <CrossCheckBadge cc={ccAfter} tol={tolCrossCheckM} />
            <ResultReadout results={afterPrimary} p1El={afterPrimary.p1el} tol={tolPositionM != null ? { positionM: tolPositionM } : undefined} stage="after" note={afterPrimary.note} />
            <OtherSurveys members={afterGroup} primary={afterPrimary} tol={tolCrossCheckM} canSetPrimary={canSetPrimary} onSetPrimary={onSetPrimary} />
            <button className="btn-secondary" disabled={printing === afterPrimary.id}
              onClick={() => handlePrint(afterPrimary, { asbuiltN: beforePrimary.asbuiltN, asbuiltE: beforePrimary.asbuiltE }, ccAfter)}>
              {printing === afterPrimary.id ? 'Preparing… · กำลังเตรียม' : 'PDF report · รายงาน PDF'}
            </button>
            <button className="btn-secondary" disabled={saving === afterPrimary.id}
              onClick={() => handleSaveImage(afterPrimary, { asbuiltN: beforePrimary.asbuiltN, asbuiltE: beforePrimary.asbuiltE }, ccAfter)}>
              {saving === afterPrimary.id ? 'Preparing… · กำลังเตรียม' : 'Save image · บันทึกรูป'}
            </button>
          </div>
        </div>
        {printError && <p className="form-err">{printError}</p>}
        {saveError && <p className="form-err">{saveError}</p>}
        <button className="btn-secondary" onClick={() => exportRecordsToExcel(columns, [beforePrimary, afterPrimary])}>
          Export both records · ส่งออกทั้งสองระเบียน
        </button>
      </div>
    </div>
  );
}
