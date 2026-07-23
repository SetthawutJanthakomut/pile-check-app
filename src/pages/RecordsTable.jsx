import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { liveQuery } from 'dexie';
import { supabase } from '../lib/supabase';
import { localdb } from '../lib/localdb';
import DataTable, { useFrozenColumns, FreezeColumnsMenu } from '../components/DataTable';
import { exportRecordsToExcel } from '../lib/exportExcel';
import RecordDetailModal from '../components/RecordDetailModal';
import { effectivePrimary } from '../lib/primary';
import { crossCheckDiff, posCheckFor } from '../lib/calculations';
import { DIR_KEY, CHECK_KEY, MARGIN_KEY } from '../lib/statusLabels';
import { useRecordActions, canEditRecord, canDeleteRecord } from '../lib/recordActions';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import { useDataRefresh } from '../lib/dataRefresh';

const UNASSIGNED = '__unassigned__';

function fmtDateTime(measuredAt, measuredTime) {
  const t = measuredTime ? new Date(measuredTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  return `${measuredAt ?? '—'} ${t}`.trim();
}

// Exported so other read paths (e.g. the Plan tab's popover) can hand the
// same column set to exportRecordsToExcel / RecordDetailModal.
export function getColumns(t) {
  return [
    { key: 'no', label: t('records.col.no'), type: 'readonly', width: 44, render: (v) => v ?? '—' },
    { key: 'pile_no', label: t('records.col.pileNo'), type: 'readonly', width: 90 },
    { key: 'pile_stage', label: t('records.col.stage'), type: 'readonly', width: 80, render: (v) => (v ? t(`common.stage.${v}Short`) : '—') },
    { key: 'note', label: t('records.col.note'), type: 'readonly', width: 160 },
    {
      key: '_datetime', label: t('records.col.measured'), type: 'readonly', width: 140,
      render: (_v, row) => fmtDateTime(row.measured_at, row.measured_time),
    },
    { key: 'surveyor', label: t('records.col.surveyor'), type: 'text', width: 140 },
    { key: 'stn_name', label: t('records.col.stn'), type: 'readonly', width: 80 },
    { key: 'p1n', label: t('records.col.p1n'), type: 'readonly' }, { key: 'p1e', label: t('records.col.p1e'), type: 'readonly' }, { key: 'p1el', label: t('records.col.p1el'), type: 'readonly' },
    { key: 'p2n', label: t('records.col.p2n'), type: 'readonly' }, { key: 'p2e', label: t('records.col.p2e'), type: 'readonly' }, { key: 'p2el', label: t('records.col.p2el'), type: 'readonly' },
    { key: 'p3n', label: t('records.col.p3n'), type: 'readonly' }, { key: 'p3e', label: t('records.col.p3e'), type: 'readonly' }, { key: 'p3el', label: t('records.col.p3el'), type: 'readonly' },
    { key: 'measured_seabed', label: t('records.col.measSeabed'), type: 'readonly' },
    { key: 'axisAz', label: t('records.col.axisAz'), type: 'readonly' },
    { key: 'slope', label: t('records.col.slope'), type: 'readonly' },
    { key: 'tiltDeg', label: t('records.col.tiltDeg'), type: 'readonly' },
    { key: 'azStnP1', label: t('records.col.azStnP1'), type: 'readonly' },
    { key: 'centerN', label: t('records.col.centerN'), type: 'readonly' },
    { key: 'centerE', label: t('records.col.centerE'), type: 'readonly' },
    { key: 'asbuiltN', label: t('records.col.asbuiltN'), type: 'readonly' },
    { key: 'asbuiltE', label: t('records.col.asbuiltE'), type: 'readonly' },
    { key: 'diffN', label: t('records.col.diffN'), type: 'readonly' },
    { key: 'dirN', label: t('records.col.dirN'), type: 'readonly', width: 90, render: (v) => (DIR_KEY[v] ? t(DIR_KEY[v]) : (v ?? '—')) },
    { key: 'diffE', label: t('records.col.diffE'), type: 'readonly' },
    { key: 'dirE', label: t('records.col.dirE'), type: 'readonly', width: 90, render: (v) => (DIR_KEY[v] ? t(DIR_KEY[v]) : (v ?? '—')) },
    { key: 'totalDev', label: t('records.col.totalDev'), type: 'readonly' },
    { key: 'posCheck', label: t('records.col.posCheck'), type: 'readonly', verdict: true, width: 80, render: (v) => (CHECK_KEY[v] ? t(CHECK_KEY[v]) : (v ?? '—')) },
    { key: 'residual', label: t('records.col.residual'), type: 'readonly' },
    { key: 'p3Check', label: t('records.col.p3Check'), type: 'readonly', verdict: true, width: 80, render: (v) => (CHECK_KEY[v] ? t(CHECK_KEY[v]) : (v ?? '—')) },
    { key: 'designTilt', label: t('records.col.designTilt'), type: 'readonly' },
    { key: 'tiltDiff', label: t('records.col.tiltDiff'), type: 'readonly' },
    { key: 'slopeCheck', label: t('records.col.slopeCheck'), type: 'readonly', verdict: true, width: 90, render: (v) => (CHECK_KEY[v] ? t(CHECK_KEY[v]) : (v ?? '—')) },
    { key: 'designBatterAz', label: t('records.col.designBatterAz'), type: 'readonly' },
    { key: 'asbuiltBatterAz', label: t('records.col.asbuiltBatterAz'), type: 'readonly' },
    { key: 'diffBatterAz', label: t('records.col.diffBatterAz'), type: 'readonly' },
    { key: 'toeN', label: t('records.col.toeN'), type: 'readonly' },
    { key: 'toeE', label: t('records.col.toeE'), type: 'readonly' },
    { key: 'toeZ', label: t('records.col.toeZ'), type: 'readonly' },
    { key: 'coatingBottomEl', label: t('records.col.coatingBottomEl'), type: 'readonly' },
    { key: 'seabedUsed', label: t('records.col.seabedUsed'), type: 'readonly' },
    { key: 'marginToSeabed', label: t('records.col.marginToSeabed'), type: 'readonly' },
    { key: 'marginLabel', label: t('records.col.marginLabel'), type: 'readonly', width: 110, render: (v) => (MARGIN_KEY[v] ? t(MARGIN_KEY[v]) : (v ?? '—')) },
    { key: 'seabedDiff', label: t('records.col.seabedDiff'), type: 'readonly' },
    { key: 'is_shared', label: t('records.col.isShared'), type: 'boolean', width: 70 },
  ];
}

const DEFAULT_FROZEN_KEYS = ['_view', 'pile_no'];

export default function RecordsTable({ session, role, onEdit }) {
  const { t } = useTranslation();
  const columns = useMemo(() => getColumns(t), [t]);
  const freezeCandidates = useMemo(() => [
    { key: '_view', label: t('records.viewBtn') },
    { key: 'no', label: t('records.col.no') },
    { key: 'pile_no', label: t('records.col.pileNo') },
    { key: 'pile_stage', label: t('records.col.stage') },
    { key: 'note', label: t('records.col.note') },
    { key: '_datetime', label: t('records.col.measured') },
    { key: 'surveyor', label: t('records.col.surveyor') },
    { key: 'stn_name', label: t('records.col.stn') },
  ], [t]);
  const [records, setRecords] = useState([]);
  const [toast, setToast] = useState(null);
  const [filterPile, setFilterPile] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [zoneFilters, setZoneFilters] = useState(() => new Set());
  const [selectedRow, setSelectedRow] = useState(null);
  const [pending, setPending] = useState([]);
  const [tolCrossCheckM, setTolCrossCheckM] = useState(0.03);
  const [tolPositionM, setTolPositionM] = useState(0.075);
  const [photoCounts, setPhotoCounts] = useState({});
  const [frozenKeys, toggleFrozen, resetFrozen] = useFrozenColumns('recordsTable.frozenCols', DEFAULT_FROZEN_KEYS);

  useEffect(() => {
    const sub = liveQuery(() => localdb.pending_records.toArray()).subscribe({ next: setPending });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('project_settings').select('key, value').in('key', ['tol_cross_check_m', 'tol_position_m']);
      (data ?? []).forEach((r) => {
        if (r.key === 'tol_cross_check_m' && r.value != null) setTolCrossCheckM(r.value);
        if (r.key === 'tol_position_m' && r.value != null) setTolPositionM(r.value);
      });
    })();
  }, []);

  // Lightweight aggregate for the "📷 N" row indicator — just record_id per
  // photo, counted client-side (record_photos is public-read).
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('record_photos').select('record_id');
      const counts = {};
      (data ?? []).forEach((r) => { counts[r.record_id] = (counts[r.record_id] ?? 0) + 1; });
      setPhotoCounts(counts);
    })();
  }, []);

  const fetchRecords = useCallback(() => {
    let q = supabase
      .from('asbuilt_records')
      .select('*, piles(pile_no, zone), station:benchmarks!station_id(name), survey_points(point_no, northing, easting, elevation)')
      .order('measured_at', { ascending: false });
    if (mineOnly && session) q = q.eq('created_by', session.user.id);
    return q;
  }, [mineOnly, session?.user?.id]);

  const reload = useCallback(async () => {
    const { data, error } = await fetchRecords();
    if (error) { setToast({ type: 'err', msg: error.message }); return; }
    setRecords(data ?? []);
  }, [fetchRecords]);

  const { version, reportStart, reportEnd } = useDataRefresh();
  const { loading } = useAutoRefresh(reload, { version, onStart: reportStart, onEnd: reportEnd });

  const filtered = useMemo(() => records.filter((r) =>
    !filterPile || (r.piles?.pile_no || '').toLowerCase().includes(filterPile.toLowerCase())), [records, filterPile]);

  const pendingFiltered = useMemo(() => pending.filter((item) =>
    !filterPile || (item.pileNo || '').toLowerCase().includes(filterPile.toLowerCase())), [pending, filterPile]);

  const zones = useMemo(() => {
    const set = new Set();
    let hasUnassigned = false;
    records.forEach((r) => { const z = r.piles?.zone; if (z) set.add(z); else hasUnassigned = true; });
    const sorted = [...set].sort();
    if (hasUnassigned) sorted.push(UNASSIGNED);
    return sorted;
  }, [records]);

  function toggleZoneFilter(z) {
    setZoneFilters((prev) => {
      const next = new Set(prev);
      if (next.has(z)) next.delete(z); else next.add(z);
      return next;
    });
  }

  const rows = useMemo(() => {
    const serverRows = filtered.map((r, i) => {
      const pts = {};
      (r.survey_points || []).forEach((p) => { pts[p.point_no] = p; });
      const res = r.results || {};
      return {
        id: r.id,
        no: i + 1,
        pile_no: r.piles?.pile_no ?? '—',
        zone: r.piles?.zone,
        measured_at: r.measured_at,
        measured_time: r.measured_time,
        surveyor: r.surveyor,
        stn_name: r.station?.name ?? '—',
        p1n: pts[1]?.northing, p1e: pts[1]?.easting, p1el: pts[1]?.elevation,
        p2n: pts[2]?.northing, p2e: pts[2]?.easting, p2el: pts[2]?.elevation,
        p3n: pts[3]?.northing, p3e: pts[3]?.easting, p3el: pts[3]?.elevation,
        measured_seabed: r.measured_seabed,
        is_shared: r.is_shared,
        is_primary: r.is_primary,
        created_by: r.created_by,
        pile_stage: r.pile_stage,
        note: r.note,
        ...res,
        // Re-evaluate against the LIVE tolerance rather than trusting the cached
        // res.posCheck, which reflects whatever tolerance was set at save time.
        posCheck: res.totalDev != null ? posCheckFor(res.totalDev, tolPositionM) : res.posCheck,
      };
    });

    // Records still sitting in the offline queue — not in Supabase yet,
    // so they're read straight from pending_records and clearly badged.
    const pendingRows = pendingFiltered.map((item) => {
      const pts = {};
      (item.points || []).forEach((p) => { pts[p.point_no] = p; });
      const res = item.record.results || {};
      return {
        id: item.uuid,
        no: '⏳',
        pile_no: item.pileNo,
        measured_at: item.createdAt?.slice(0, 10),
        measured_time: item.createdAt,
        surveyor: item.record.surveyor,
        stn_name: item.newStation?.name ?? '—',
        p1n: pts[1]?.northing, p1e: pts[1]?.easting, p1el: pts[1]?.elevation,
        p2n: pts[2]?.northing, p2e: pts[2]?.easting, p2el: pts[2]?.elevation,
        p3n: pts[3]?.northing, p3e: pts[3]?.easting, p3el: pts[3]?.elevation,
        measured_seabed: item.record.measured_seabed,
        is_shared: item.record.is_shared,
        is_primary: false,
        created_by: null,
        pile_stage: item.record.pile_stage,
        note: item.record.note,
        _pending: true,
        ...res,
        posCheck: res.totalDev != null ? posCheckFor(res.totalDev, tolPositionM) : res.posCheck,
      };
    });

    // Group piles' stages adjacently: primary sort by pile_no, secondary by
    // measured time descending (matches the newest-first default, and puts
    // หลังตอก ahead of ก่อนตอก since it's measured later on the same pile).
    const combined = [...pendingRows, ...serverRows];
    combined.sort((a, b) => {
      const pileCmp = String(a.pile_no).localeCompare(String(b.pile_no), undefined, { numeric: true, sensitivity: 'base' });
      if (pileCmp !== 0) return pileCmp;
      const at = a.measured_time ? new Date(a.measured_time).getTime() : -Infinity;
      const bt = b.measured_time ? new Date(b.measured_time).getTime() : -Infinity;
      return bt - at;
    });
    if (zoneFilters.size === 0) return combined;
    return combined.filter((r) => zoneFilters.has(r.zone || UNASSIGNED));
  }, [filtered, pendingFiltered, tolPositionM, zoneFilters]);

  // Group flattened rows by pile_no + pile_stage so the detail modal can show
  // before+after side by side, and multiple same-pile+stage surveys can be
  // cross-checked against each other.
  const rowsByPile = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!map[r.pile_no]) map[r.pile_no] = {};
      if (!map[r.pile_no][r.pile_stage]) map[r.pile_no][r.pile_stage] = [];
      map[r.pile_no][r.pile_stage].push(r);
    });
    return map;
  }, [rows]);

  // Flatten to one row per (pile_no, pile_stage): the row shows the effective
  // primary record's values, tagged with a `_multi` summary (count + worst
  // cross-check diff) when 2+ records exist for that pile+stage.
  const flatRows = useMemo(() => {
    const out = [];
    const seen = new Set();
    rows.forEach((r) => {
      const key = `${r.pile_no}||${r.pile_stage}`;
      if (seen.has(key)) return;
      seen.add(key);
      const members = rowsByPile[r.pile_no]?.[r.pile_stage] || [r];
      if (members.length < 2) {
        out.push({ ...members[0], _multi: null });
        return;
      }
      const primary = effectivePrimary(members);
      let maxDiff = 0;
      members.forEach((m) => {
        if (m.id === primary.id) return;
        maxDiff = Math.max(maxDiff, crossCheckDiff(primary, m));
      });
      out.push({ ...primary, _multi: { count: members.length, maxDiff } });
    });

    let counter = 0;
    return out.map((row) => {
      if (row._pending) return { ...row, no: '⏳' };
      counter += 1;
      return { ...row, no: counter };
    });
  }, [rows, rowsByPile]);

  async function handleSave(rowId, key, value) {
    const { error } = await supabase.from('asbuilt_records').update({ [key]: value }).eq('id', rowId);
    if (error) throw new Error(error.message);
    setRecords((rs) => rs.map((r) => (r.id === rowId ? { ...r, [key]: value } : r)));
  }

  const stageShort = { before: t('common.stage.beforeShort'), after: t('common.stage.afterShort') };
  const { handleEdit, handleDelete } = useRecordActions({ records, setRecords, onEdit, setToast, stageLabels: stageShort });

  // Modal-specific wrappers around the shared edit/delete handlers above —
  // same logic, plus closing/adjusting the detail modal since it's not
  // visible from the table's row-actions callers.
  function handleModalEdit(id) {
    handleEdit(id);
    setSelectedRow(null);
  }

  async function handleModalDelete(deletedRow) {
    const ok = await handleDelete(deletedRow);
    if (!ok) return;
    if (deletedRow.pile_stage !== selectedRow?.pile_stage) return;
    const pileGroup = rowsByPile[deletedRow.pile_no] || {};
    const remainingSameStage = (pileGroup[deletedRow.pile_stage] || []).filter((m) => m.id !== deletedRow.id);
    if (remainingSameStage.length > 0) return;
    const otherStage = deletedRow.pile_stage === 'before' ? 'after' : 'before';
    const otherMembers = pileGroup[otherStage] || [];
    setSelectedRow(otherMembers.length > 0 ? otherMembers[0] : null);
  }

  async function handleSetPrimary(recId) {
    const { error } = await supabase.rpc('set_primary_record', { rec_id: recId });
    if (error) { setToast({ type: 'err', msg: error.message }); setTimeout(() => setToast(null), 4000); return; }
    const { data, error: fErr } = await fetchRecords();
    if (!fErr) setRecords(data ?? []);
  }

  const viewColumns = [
    {
      key: '_view', label: '', type: 'readonly', width: 50,
      render: (_v, row) => (
        <>
          {row._pending && <span className="pending-badge">{t('records.pendingBadge')}</span>}
          {photoCounts[row.id] > 0 && <span className="photo-badge">📷 {photoCounts[row.id]}</span>}
          <button className="link" onClick={() => setSelectedRow(row)}>{t('records.viewBtn')}</button>
        </>
      ),
    },
    ...columns.map((col) => {
      if (col.key !== 'pile_no') return col;
      return {
        ...col,
        render: (v, row) => (
          <>
            {v}
            {row._multi && (
              <span
                className={`multi-badge${row._multi.maxDiff > tolCrossCheckM ? ' warn' : ''}`}
                title={t('records.multiSurveyTooltip', { count: row._multi.count })}
              >
                {' '}ⓘ {row._multi.count}{row._multi.maxDiff > tolCrossCheckM ? ' ⚠' : ''}
              </span>
            )}
          </>
        ),
      };
    }),
  ];

  return (
    <div className="page-wide">
      <div className="page-toolbar">
        <h1>{t('records.pageTitle')}</h1>
        <input
          className="filter-input"
          placeholder={t('records.filterPlaceholder')}
          value={filterPile}
          onChange={(e) => setFilterPile(e.target.value)}
        />
        {session && (
          <label className="share-toggle">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            <span>{t('records.mineOnlyLabel')}</span>
          </label>
        )}
        <button className="btn-secondary" disabled={!flatRows.length} onClick={() => exportRecordsToExcel(columns, flatRows)}>
          {t('records.exportExcelBtn')}
        </button>
        <FreezeColumnsMenu
          candidates={freezeCandidates}
          frozenKeys={frozenKeys}
          onToggle={toggleFrozen}
          onReset={resetFrozen}
        />
      </div>
      {zones.length > 0 && (
        <div className="zone-filter">
          <span className="zone-filter-label">{t('records.filterByZoneLabel')}</span>
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              className={`zone-pill${zoneFilters.has(z) ? ' active' : ''}`}
              onClick={() => toggleZoneFilter(z)}
            >
              {z === UNASSIGNED ? t('records.unassignedZone') : z}
            </button>
          ))}
        </div>
      )}
      {loading ? <p className="hint">{t('plan.loading')}</p> : (
        <DataTable
          columns={viewColumns}
          rows={flatRows}
          onSave={handleSave}
          frozenKeys={frozenKeys}
          actionsLabel={t('records.actionsLabel')}
          renderRowActions={(row) => (
            <>
              {canEditRecord(row, session, role) && <button className="link" onClick={() => handleEdit(row.id)}>{t('records.editBtn')}</button>}
              {canDeleteRecord(row, session) && <button className="link danger" onClick={() => handleDelete(row)}>{t('records.deleteBtn')}</button>}
            </>
          )}
        />
      )}
      {selectedRow && (
        <RecordDetailModal
          row={selectedRow}
          group={rowsByPile[selectedRow.pile_no]}
          tolCrossCheckM={tolCrossCheckM}
          tolPositionM={tolPositionM}
          columns={columns}
          canSetPrimary={role === 'admin' || role === 'recorder'}
          onSetPrimary={handleSetPrimary}
          session={session}
          role={role}
          onEditRecord={handleModalEdit}
          onDeleteRecord={handleModalDelete}
          onClose={() => setSelectedRow(null)}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
