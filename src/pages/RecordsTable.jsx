import { useCallback, useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { supabase } from '../lib/supabase';
import { localdb } from '../lib/localdb';
import DataTable, { useFrozenColumns, FreezeColumnsMenu } from '../components/DataTable';
import { exportRecordsToExcel } from '../lib/exportExcel';
import RecordDetailModal from '../components/RecordDetailModal';
import { effectivePrimary } from '../lib/primary';
import { crossCheckDiff, posCheckFor } from '../lib/calculations';

const STAGE_SHORT = { before: 'ก่อนตอก', after: 'หลังตอก' };

function fmtDateTime(measuredAt, measuredTime) {
  const t = measuredTime ? new Date(measuredTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  return `${measuredAt ?? '—'} ${t}`.trim();
}

// Exported so other read paths (e.g. the Plan tab's popover) can hand the
// same column set to exportRecordsToExcel / RecordDetailModal.
export const COLUMNS = [
  { key: 'no', label: 'No.', type: 'readonly', width: 44, render: (v) => v ?? '—' },
  { key: 'pile_no', label: 'Pile No. · เลขเข็ม', type: 'readonly', width: 90 },
  { key: 'pile_stage', label: 'Stage · ระยะ', type: 'readonly', width: 80, render: (v) => STAGE_SHORT[v] ?? '—' },
  { key: 'note', label: 'Note · หมายเหตุ', type: 'readonly', width: 160 },
  {
    key: '_datetime', label: 'Measured · วันเวลา', type: 'readonly', width: 140,
    render: (_v, row) => fmtDateTime(row.measured_at, row.measured_time),
  },
  { key: 'surveyor', label: 'Surveyor · ผู้สำรวจ', type: 'text', width: 140 },
  { key: 'stn_name', label: 'STN · จุดตั้งกล้อง', type: 'readonly', width: 80 },
  { key: 'p1n', label: 'P1 N', type: 'readonly' }, { key: 'p1e', label: 'P1 E', type: 'readonly' }, { key: 'p1el', label: 'P1 El.', type: 'readonly' },
  { key: 'p2n', label: 'P2 N', type: 'readonly' }, { key: 'p2e', label: 'P2 E', type: 'readonly' }, { key: 'p2el', label: 'P2 El.', type: 'readonly' },
  { key: 'p3n', label: 'P3 N', type: 'readonly' }, { key: 'p3e', label: 'P3 E', type: 'readonly' }, { key: 'p3el', label: 'P3 El.', type: 'readonly' },
  { key: 'measured_seabed', label: 'Meas. Seabed · ท้องทะเลวัด', type: 'readonly' },
  { key: 'axisAz', label: 'Axis Az · แนวแกน', type: 'readonly' },
  { key: 'slope', label: 'Slope · ความชัน', type: 'readonly' },
  { key: 'tiltDeg', label: 'Tilt (°) · เอียง', type: 'readonly' },
  { key: 'azStnP1', label: 'Az STN→P1', type: 'readonly' },
  { key: 'centerN', label: 'Center N', type: 'readonly' },
  { key: 'centerE', label: 'Center E', type: 'readonly' },
  { key: 'asbuiltN', label: 'As-built N', type: 'readonly' },
  { key: 'asbuiltE', label: 'As-built E', type: 'readonly' },
  { key: 'diffN', label: 'Diff N', type: 'readonly' },
  { key: 'dirN', label: 'Dir N', type: 'readonly', width: 90 },
  { key: 'diffE', label: 'Diff E', type: 'readonly' },
  { key: 'dirE', label: 'Dir E', type: 'readonly', width: 90 },
  { key: 'totalDev', label: 'Total Dev · เบี่ยงเบนรวม', type: 'readonly' },
  { key: 'posCheck', label: 'Pos Check', type: 'readonly', verdict: true, width: 80 },
  { key: 'residual', label: 'Residual (P3)', type: 'readonly' },
  { key: 'p3Check', label: 'P3 Check', type: 'readonly', verdict: true, width: 80 },
  { key: 'designTilt', label: 'Design Tilt (°)', type: 'readonly' },
  { key: 'tiltDiff', label: 'Tilt Diff (°)', type: 'readonly' },
  { key: 'slopeCheck', label: 'Slope Check', type: 'readonly', verdict: true, width: 90 },
  { key: 'designBatterAz', label: 'Design Batter Az', type: 'readonly' },
  { key: 'asbuiltBatterAz', label: 'As-built Batter Az', type: 'readonly' },
  { key: 'diffBatterAz', label: 'Diff Batter Az', type: 'readonly' },
  { key: 'toeN', label: 'Toe N', type: 'readonly' },
  { key: 'toeE', label: 'Toe E', type: 'readonly' },
  { key: 'toeZ', label: 'Toe Z', type: 'readonly' },
  { key: 'coatingBottomEl', label: 'Coating Bottom El.', type: 'readonly' },
  { key: 'seabedUsed', label: 'Seabed Used', type: 'readonly' },
  { key: 'marginToSeabed', label: 'Margin to Seabed', type: 'readonly' },
  { key: 'marginLabel', label: 'Margin Label', type: 'readonly', width: 110 },
  { key: 'seabedDiff', label: 'Seabed Diff', type: 'readonly' },
  { key: 'is_shared', label: 'Shared · แชร์', type: 'boolean', width: 70 },
];

const FREEZE_CANDIDATES = [
  { key: '_view', label: 'View' },
  { key: 'no', label: 'No.' },
  { key: 'pile_no', label: 'Pile No.' },
  { key: 'pile_stage', label: 'Stage' },
  { key: 'note', label: 'Note' },
  { key: '_datetime', label: 'Measured' },
  { key: 'surveyor', label: 'Surveyor' },
  { key: 'stn_name', label: 'STN' },
];
const DEFAULT_FROZEN_KEYS = ['_view', 'pile_no'];

export default function RecordsTable({ session, role, onEdit }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filterPile, setFilterPile] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [pending, setPending] = useState([]);
  const [tolCrossCheckM, setTolCrossCheckM] = useState(0.03);
  const [tolPositionM, setTolPositionM] = useState(0.075);
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

  const fetchRecords = useCallback(() => {
    let q = supabase
      .from('asbuilt_records')
      .select('*, piles(pile_no), station:benchmarks!station_id(name), survey_points(point_no, northing, easting, elevation)')
      .order('measured_at', { ascending: false });
    if (mineOnly && session) q = q.eq('created_by', session.user.id);
    return q;
  }, [mineOnly, session?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await fetchRecords();
      if (cancelled) return;
      if (error) setToast({ type: 'err', msg: error.message });
      setRecords(data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchRecords]);

  const filtered = useMemo(() => records.filter((r) =>
    !filterPile || (r.piles?.pile_no || '').toLowerCase().includes(filterPile.toLowerCase())), [records, filterPile]);

  const pendingFiltered = useMemo(() => pending.filter((item) =>
    !filterPile || (item.pileNo || '').toLowerCase().includes(filterPile.toLowerCase())), [pending, filterPile]);

  const rows = useMemo(() => {
    const serverRows = filtered.map((r, i) => {
      const pts = {};
      (r.survey_points || []).forEach((p) => { pts[p.point_no] = p; });
      const res = r.results || {};
      return {
        id: r.id,
        no: i + 1,
        pile_no: r.piles?.pile_no ?? '—',
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
    return combined;
  }, [filtered, pendingFiltered, tolPositionM]);

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

  function handleEdit(id) {
    const full = records.find((r) => r.id === id);
    if (full) onEdit?.(full);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this record? · ลบระเบียนนี้?')) return;
    const { error } = await supabase.from('asbuilt_records').delete().eq('id', id);
    if (error) { setToast({ type: 'err', msg: error.message }); setTimeout(() => setToast(null), 4000); return; }
    setRecords((rs) => rs.filter((r) => r.id !== id));
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
          {row._pending && <span className="pending-badge">⏳ pending sync · รอซิงค์</span>}
          <button className="link" onClick={() => setSelectedRow(row)}>View</button>
        </>
      ),
    },
    ...COLUMNS.map((col) => {
      if (col.key !== 'pile_no') return col;
      return {
        ...col,
        render: (v, row) => (
          <>
            {v}
            {row._multi && (
              <span
                className={`multi-badge${row._multi.maxDiff > tolCrossCheckM ? ' warn' : ''}`}
                title={`${row._multi.count} surveys of this pile — click View for details · มี ${row._multi.count} การวัด กดดูรายละเอียด`}
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
        <h1>AsBuilt Records · บันทึกเข็มจริง</h1>
        <input
          className="filter-input"
          placeholder="Filter pile no. · ค้นหาเลขเข็ม"
          value={filterPile}
          onChange={(e) => setFilterPile(e.target.value)}
        />
        {session && (
          <label className="share-toggle">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            <span>Mine only · เฉพาะของฉัน</span>
          </label>
        )}
        <button className="btn-secondary" disabled={!flatRows.length} onClick={() => exportRecordsToExcel(COLUMNS, flatRows)}>
          Export Excel · ส่งออกเอ็กเซล
        </button>
        <FreezeColumnsMenu
          candidates={FREEZE_CANDIDATES}
          frozenKeys={frozenKeys}
          onToggle={toggleFrozen}
          onReset={resetFrozen}
        />
      </div>
      {loading ? <p className="hint">Loading… · กำลังโหลด</p> : (
        <DataTable
          columns={viewColumns}
          rows={flatRows}
          onSave={handleSave}
          frozenKeys={frozenKeys}
          actionsLabel="Actions · การกระทำ"
          renderRowActions={(row) => {
            const mine = session && row.created_by === session.user.id;
            const canEdit = mine && (role === 'admin' || role === 'recorder');
            return (
              <>
                {canEdit && <button className="link" onClick={() => handleEdit(row.id)}>Edit · แก้ไข</button>}
                {mine && <button className="link danger" onClick={() => handleDelete(row.id)}>Delete · ลบ</button>}
              </>
            );
          }}
        />
      )}
      {selectedRow && (
        <RecordDetailModal
          row={selectedRow}
          group={rowsByPile[selectedRow.pile_no]}
          tolCrossCheckM={tolCrossCheckM}
          tolPositionM={tolPositionM}
          columns={COLUMNS}
          canSetPrimary={role === 'admin' || role === 'recorder'}
          onSetPrimary={handleSetPrimary}
          onClose={() => setSelectedRow(null)}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
