import ResultReadout from './ResultReadout';
import { exportRecordsToExcel } from '../lib/exportExcel';

// `row` is a flattened record from RecordsTable's `rows` (same shape passed to DataTable/export),
// which already spreads the record's stored `results` jsonb onto itself.
export default function RecordDetailModal({ row, columns, onClose }) {
  const t = row.measured_time
    ? new Date(row.measured_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{row.pile_no}</h2>
            <p className="hint">{row.surveyor} · {`${row.measured_at ?? '—'} ${t}`.trim()}</p>
          </div>
          <button className="link" onClick={onClose}>Close · ปิด</button>
        </div>
        <ResultReadout results={row} p1El={row.p1el} />
        <button className="btn-secondary" onClick={() => exportRecordsToExcel(columns, [row])}>
          Export this record · ส่งออกระเบียนนี้
        </button>
      </div>
    </div>
  );
}
