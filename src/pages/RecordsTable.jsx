import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';
import { exportRecordsToExcel } from '../lib/exportExcel';
import RecordDetailModal from '../components/RecordDetailModal';

const STAGE_SHORT = { before: 'ก่อนตอก', after: 'หลังตอก' };

function fmtDateTime(measuredAt, measuredTime) {
  const t = measuredTime ? new Date(measuredTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  return `${measuredAt ?? '—'} ${t}`.trim();
}

const COLUMNS = [
  { key: 'no', label: 'No.', type: 'readonly', width: 44 },
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
  { key: 'axisAz', label: 'Axis Az · แนวแกน', type: 'readonly', decimals: 2 },
  { key: 'slope', label: 'Slope · ความชัน', type: 'readonly', decimals: 3 },
  { key: 'tiltDeg', label: 'Tilt (°) · เอียง', type: 'readonly', decimals: 2 },
  { key: 'azStnP1', label: 'Az STN→P1', type: 'readonly', decimals: 2 },
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
  { key: 'residual', label: 'Residual (P3)', type: 'readonly', decimals: 4 },
  { key: 'p3Check', label: 'P3 Check', type: 'readonly', verdict: true, width: 80 },
  { key: 'designTilt', label: 'Design Tilt (°)', type: 'readonly', decimals: 2 },
  { key: 'tiltDiff', label: 'Tilt Diff (°)', type: 'readonly', decimals: 2 },
  { key: 'slopeCheck', label: 'Slope Check', type: 'readonly', verdict: true, width: 90 },
  { key: 'designBatterAz', label: 'Design Batter Az', type: 'readonly', decimals: 2 },
  { key: 'asbuiltBatterAz', label: 'As-built Batter Az', type: 'readonly', decimals: 2 },
  { key: 'diffBatterAz', label: 'Diff Batter Az', type: 'readonly', decimals: 2 },
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

export default function RecordsTable({ session }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filterPile, setFilterPile] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from('asbuilt_records')
        .select('*, piles(pile_no), station:benchmarks!station_id(name), survey_points(point_no, northing, easting, elevation)')
        .order('measured_at', { ascending: false });
      if (mineOnly && session) q = q.eq('created_by', session.user.id);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) setToast({ type: 'err', msg: error.message });
      setRecords(data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [mineOnly, session?.user?.id]);

  const filtered = useMemo(() => records.filter((r) =>
    !filterPile || (r.piles?.pile_no || '').toLowerCase().includes(filterPile.toLowerCase())), [records, filterPile]);

  const rows = useMemo(() => filtered.map((r, i) => {
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
      created_by: r.created_by,
      pile_stage: r.pile_stage,
      note: r.note,
      ...res,
    };
  }), [filtered]);

  // Group flattened rows by pile_no so the detail modal can show before+after side by side.
  const rowsByPile = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!map[r.pile_no]) map[r.pile_no] = {};
      map[r.pile_no][r.pile_stage] = r;
    });
    return map;
  }, [rows]);

  async function handleSave(rowId, key, value) {
    const { error } = await supabase.from('asbuilt_records').update({ [key]: value }).eq('id', rowId);
    if (error) throw new Error(error.message);
    setRecords((rs) => rs.map((r) => (r.id === rowId ? { ...r, [key]: value } : r)));
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this record? · ลบระเบียนนี้?')) return;
    const { error } = await supabase.from('asbuilt_records').delete().eq('id', id);
    if (error) { setToast({ type: 'err', msg: error.message }); setTimeout(() => setToast(null), 4000); return; }
    setRecords((rs) => rs.filter((r) => r.id !== id));
  }

  const viewColumns = [
    {
      key: '_view', label: '', type: 'readonly', width: 50,
      render: (_v, row) => <button className="link" onClick={() => setSelectedRow(row)}>View</button>,
    },
    ...COLUMNS,
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
        <button className="btn-secondary" disabled={!rows.length} onClick={() => exportRecordsToExcel(COLUMNS, rows)}>
          Export Excel · ส่งออกเอ็กเซล
        </button>
      </div>
      {loading ? <p className="hint">Loading… · กำลังโหลด</p> : (
        <DataTable
          columns={viewColumns}
          rows={rows}
          onSave={handleSave}
          actionsLabel="Delete · ลบ"
          renderRowActions={(row) => (
            session && row.created_by === session.user.id
              ? <button className="link danger" onClick={() => handleDelete(row.id)}>Delete · ลบ</button>
              : null
          )}
        />
      )}
      {selectedRow && (
        <RecordDetailModal
          row={selectedRow}
          pair={rowsByPile[selectedRow.pile_no]}
          columns={COLUMNS}
          onClose={() => setSelectedRow(null)}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
