import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ResultReadout from './ResultReadout';
import PhotoStrip from './PhotoGallery';
import { exportRecordsToExcel } from '../lib/exportExcel';
import { fmt } from '../lib/format';
import { crossCheckDiff } from '../lib/calculations';
import { MOVED_KEY } from '../lib/statusLabels';
import { effectivePrimary } from '../lib/primary';
import { fetchPhotos } from '../lib/photos';
import { fetchReportInputs } from '../reports/fetchReportData';
import { printPileReport } from '../reports/printPileReport';
import { savePileReportImage } from '../reports/savePileReportImage';
import { canEditRecord, canDeleteRecord } from '../lib/recordActions';

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

// Edit/Delete for a single card's displayed record — same guard the Records
// table row actions use, and the same onEditRecord/onDeleteRecord handlers
// RecordsTable already wires up (which also close/adjust this modal).
function CardActions({ record, session, role, onEditRecord, onDeleteRecord }) {
  const { t } = useTranslation();
  const canEdit = canEditRecord(record, session, role);
  const canDelete = canDeleteRecord(record, session);
  if (!canEdit && !canDelete) return null;
  return (
    <div className="card-actions">
      {canEdit && <button className="link" onClick={() => onEditRecord(record.id)}>{t('records.modal.editBtn')}</button>}
      {canDelete && <button className="link danger" onClick={() => onDeleteRecord(record)}>{t('records.modal.deleteBtn')}</button>}
    </div>
  );
}

function CrossCheckBadge({ cc, tol }) {
  const { t } = useTranslation();
  if (!cc || tol == null) return null;
  const pass = cc.maxDiff <= tol;
  return (
    <div className={`crosscheck-badge ${pass ? 'pass' : 'fail'}`}>
      {pass
        ? t('records.modal.crossCheckPass', { diff: fmt(cc.maxDiff, 3) })
        : t('records.modal.crossCheckFail', { diff: fmt(cc.maxDiff, 3), tol: fmt(tol, 3) })}
    </div>
  );
}

// Condensed list of the non-primary records for a pile+stage, shown below the
// primary's ResultReadout so admins/recorders can inspect and re-designate
// primary without leaving the modal.
function OtherSurveys({ members, primary, tol, canSetPrimary, onSetPrimary }) {
  const { t } = useTranslation();
  const others = (members || []).filter((m) => m.id !== primary.id);
  if (others.length === 0) return null;
  return (
    <div className="card other-surveys">
      <h4>{t('records.modal.otherSurveysTitle')}</h4>
      {others.map((m) => {
        const diff = crossCheckDiff(primary, m);
        return (
          <div key={m.id} className="other-survey-row">
            <span>{m.surveyor || '—'} · {fmtWhen(m)}</span>
            <span>N {fmt(m.asbuiltN)} E {fmt(m.asbuiltE)}</span>
            <span className={diff > tol ? 'diff-warn' : ''}>diff {fmt(diff, 3)} m</span>
            {canSetPrimary && (
              <button className="link" onClick={() => onSetPrimary?.(m.id)}>{t('records.modal.setPrimaryBtn')}</button>
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
export default function RecordDetailModal({ row, group, tolCrossCheckM, tolPositionM, columns, canSetPrimary, onSetPrimary, session, role, onEditRecord, onDeleteRecord, onClose }) {
  const { t } = useTranslation();
  const [printing, setPrinting] = useState(null);
  const [printError, setPrintError] = useState(null);
  const [saving, setSaving] = useState(null);
  const [saveError, setSaveError] = useState(null);

  async function handlePrint(recordRow, siblingAsbuilt, crossCheck, includePhotos) {
    setPrinting(recordRow.id);
    setPrintError(null);
    try {
      const { record, pile, station, backsight, tol } = await fetchReportInputs(recordRow.id);
      const photos = includePhotos ? await fetchPhotos(recordRow.id) : [];
      printPileReport({ record, pile, station, backsight, tol, siblingAsbuilt, crossCheck, photos });
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

  // Photo counts for the "Attach photos" checkboxes below — computed for
  // whichever primary record(s) this modal will render, so the checkbox can
  // be disabled up front for records with no photos. `_pending` (still-queued,
  // offline) records aren't on the server yet, so this correctly comes back 0.
  const singlePrimaryId = !both ? (effectivePrimary(group?.[row.pile_stage] || [row]) || row).id : null;
  const beforePrimaryId = both && beforeGroup.length ? effectivePrimary(beforeGroup)?.id : null;
  const afterPrimaryId = both && afterGroup.length ? effectivePrimary(afterGroup)?.id : null;
  const [photoCounts, setPhotoCounts] = useState({});
  const [attachPhotos, setAttachPhotos] = useState({});

  useEffect(() => {
    const ids = [singlePrimaryId, beforePrimaryId, afterPrimaryId].filter(Boolean);
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(ids.map(async (id) => {
        try { return [id, (await fetchPhotos(id)).length]; } catch { return [id, 0]; }
      }));
      if (!cancelled) setPhotoCounts(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [singlePrimaryId, beforePrimaryId, afterPrimaryId]);

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
            <div className="modal-header-actions">
              <CardActions record={primary} session={session} role={role} onEditRecord={onEditRecord} onDeleteRecord={onDeleteRecord} />
              <button className="link" onClick={onClose}>{t('records.modal.closeBtn')}</button>
            </div>
          </div>
          <ResultReadout results={primary} p1El={primary.p1el} tol={tolPositionM != null ? { positionM: tolPositionM } : undefined} stage={primary.pile_stage} note={primary.note} />
          <PhotoStrip recordId={primary.id} pending={primary._pending} />
          <OtherSurveys members={stageGroup} primary={primary} tol={tolCrossCheckM} canSetPrimary={canSetPrimary} onSetPrimary={onSetPrimary} />
          <button className="btn-secondary" onClick={() => exportRecordsToExcel(columns, [primary])}>
            {t('records.modal.exportRecordBtn')}
          </button>
          <label className="share-toggle">
            <input
              type="checkbox"
              checked={!!attachPhotos[primary.id]}
              disabled={!photoCounts[primary.id]}
              onChange={(e) => setAttachPhotos((m) => ({ ...m, [primary.id]: e.target.checked }))}
            />
            <span>{t('records.modal.attachPhotosLabel')}</span>
          </label>
          <button className="btn-secondary" disabled={printing === primary.id} onClick={() => handlePrint(primary, null, cc, attachPhotos[primary.id])}>
            {printing === primary.id ? t('records.modal.preparingBtn') : t('records.modal.pdfReportBtn')}
          </button>
          <button className="btn-secondary" disabled={saving === primary.id} onClick={() => handleSaveImage(primary, null, cc)}>
            {saving === primary.id ? t('records.modal.preparingBtn') : t('records.modal.saveImageBtn')}
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
  const dirN = t(moveN < 0 ? MOVED_KEY['moved SOUTH'] : MOVED_KEY['moved NORTH']);
  const dirE = t(moveE < 0 ? MOVED_KEY['moved WEST'] : MOVED_KEY['moved EAST']);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{beforePrimary.pile_no}</h2>
            <p className="hint">{t('records.modal.beforeAfterSubtitle')}</p>
          </div>
          <button className="link" onClick={onClose}>{t('records.modal.closeBtn')}</button>
        </div>
        <div className="card movement-summary">
          <div className="stage-tag">{t('records.modal.headMovedTag')}</div>
          <div className="readout-grid">
            <div><span>{t('records.modal.moveN')}</span>{fmt(moveN)} <b>{dirN}</b></div>
            <div><span>{t('records.modal.moveE')}</span>{fmt(moveE)} <b>{dirE}</b></div>
            <div><span>{t('records.modal.moveTotal')}</span>{fmt(moveTotal)}</div>
          </div>
        </div>
        <div className="modal-columns">
          <div className="card modal-column">
            <CardActions record={beforePrimary} session={session} role={role} onEditRecord={onEditRecord} onDeleteRecord={onDeleteRecord} />
            <p className="hint">{beforePrimary.surveyor} · {fmtWhen(beforePrimary)}</p>
            <CrossCheckBadge cc={ccBefore} tol={tolCrossCheckM} />
            <ResultReadout results={beforePrimary} p1El={beforePrimary.p1el} tol={tolPositionM != null ? { positionM: tolPositionM } : undefined} stage="before" note={beforePrimary.note} />
            <PhotoStrip recordId={beforePrimary.id} pending={beforePrimary._pending} />
            <OtherSurveys members={beforeGroup} primary={beforePrimary} tol={tolCrossCheckM} canSetPrimary={canSetPrimary} onSetPrimary={onSetPrimary} />
            <label className="share-toggle">
              <input
                type="checkbox"
                checked={!!attachPhotos[beforePrimary.id]}
                disabled={!photoCounts[beforePrimary.id]}
                onChange={(e) => setAttachPhotos((m) => ({ ...m, [beforePrimary.id]: e.target.checked }))}
              />
              <span>{t('records.modal.attachPhotosLabel')}</span>
            </label>
            <button className="btn-secondary" disabled={printing === beforePrimary.id}
              onClick={() => handlePrint(beforePrimary, { asbuiltN: afterPrimary.asbuiltN, asbuiltE: afterPrimary.asbuiltE }, ccBefore, attachPhotos[beforePrimary.id])}>
              {printing === beforePrimary.id ? t('records.modal.preparingBtn') : t('records.modal.pdfReportBtn')}
            </button>
            <button className="btn-secondary" disabled={saving === beforePrimary.id}
              onClick={() => handleSaveImage(beforePrimary, { asbuiltN: afterPrimary.asbuiltN, asbuiltE: afterPrimary.asbuiltE }, ccBefore)}>
              {saving === beforePrimary.id ? t('records.modal.preparingBtn') : t('records.modal.saveImageBtn')}
            </button>
          </div>
          <div className="card modal-column">
            <CardActions record={afterPrimary} session={session} role={role} onEditRecord={onEditRecord} onDeleteRecord={onDeleteRecord} />
            <p className="hint">{afterPrimary.surveyor} · {fmtWhen(afterPrimary)}</p>
            <CrossCheckBadge cc={ccAfter} tol={tolCrossCheckM} />
            <ResultReadout results={afterPrimary} p1El={afterPrimary.p1el} tol={tolPositionM != null ? { positionM: tolPositionM } : undefined} stage="after" note={afterPrimary.note} />
            <PhotoStrip recordId={afterPrimary.id} pending={afterPrimary._pending} />
            <OtherSurveys members={afterGroup} primary={afterPrimary} tol={tolCrossCheckM} canSetPrimary={canSetPrimary} onSetPrimary={onSetPrimary} />
            <label className="share-toggle">
              <input
                type="checkbox"
                checked={!!attachPhotos[afterPrimary.id]}
                disabled={!photoCounts[afterPrimary.id]}
                onChange={(e) => setAttachPhotos((m) => ({ ...m, [afterPrimary.id]: e.target.checked }))}
              />
              <span>{t('records.modal.attachPhotosLabel')}</span>
            </label>
            <button className="btn-secondary" disabled={printing === afterPrimary.id}
              onClick={() => handlePrint(afterPrimary, { asbuiltN: beforePrimary.asbuiltN, asbuiltE: beforePrimary.asbuiltE }, ccAfter, attachPhotos[afterPrimary.id])}>
              {printing === afterPrimary.id ? t('records.modal.preparingBtn') : t('records.modal.pdfReportBtn')}
            </button>
            <button className="btn-secondary" disabled={saving === afterPrimary.id}
              onClick={() => handleSaveImage(afterPrimary, { asbuiltN: beforePrimary.asbuiltN, asbuiltE: beforePrimary.asbuiltE }, ccAfter)}>
              {saving === afterPrimary.id ? t('records.modal.preparingBtn') : t('records.modal.saveImageBtn')}
            </button>
          </div>
        </div>
        {printError && <p className="form-err">{printError}</p>}
        {saveError && <p className="form-err">{saveError}</p>}
        <button className="btn-secondary" onClick={() => exportRecordsToExcel(columns, [beforePrimary, afterPrimary])}>
          {t('records.modal.exportBothBtn')}
        </button>
      </div>
    </div>
  );
}
