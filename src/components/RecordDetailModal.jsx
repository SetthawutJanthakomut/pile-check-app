import ResultReadout from './ResultReadout';
import { exportRecordsToExcel } from '../lib/exportExcel';
import { fmt } from '../lib/format';

function fmtWhen(row) {
  const t = row.measured_time
    ? new Date(row.measured_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  return `${row.measured_at ?? '—'} ${t}`.trim();
}

// `row` is a flattened record from RecordsTable's `rows` (same shape passed to DataTable/export),
// which already spreads the record's stored `results` jsonb onto itself.
// `pair` (optional) is { before, after } — the same-pile flattened rows for both driving stages.
// When both are present, the modal renders two side-by-side readout cards instead of one.
export default function RecordDetailModal({ row, pair, columns, onClose }) {
  const both = pair && pair.before && pair.after;

  if (!both) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>{row.pile_no}</h2>
              <p className="hint">{row.surveyor} · {fmtWhen(row)}</p>
            </div>
            <button className="link" onClick={onClose}>Close · ปิด</button>
          </div>
          <ResultReadout results={row} p1El={row.p1el} stage={row.pile_stage} note={row.note} />
          <button className="btn-secondary" onClick={() => exportRecordsToExcel(columns, [row])}>
            Export this record · ส่งออกระเบียนนี้
          </button>
        </div>
      </div>
    );
  }

  const { before, after } = pair;
  const moveN = after.asbuiltN - before.asbuiltN;
  const moveE = after.asbuiltE - before.asbuiltE;
  const moveTotal = Math.sqrt(moveN * moveN + moveE * moveE);
  const dirN = moveN < 0 ? 'moved SOUTH · ขยับไปทางใต้' : 'moved NORTH · ขยับไปทางเหนือ';
  const dirE = moveE < 0 ? 'moved WEST · ขยับไปทางตก' : 'moved EAST · ขยับไปทางออก';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{row.pile_no}</h2>
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
            <p className="hint">{before.surveyor} · {fmtWhen(before)}</p>
            <ResultReadout results={before} p1El={before.p1el} stage="before" note={before.note} />
          </div>
          <div className="card modal-column">
            <p className="hint">{after.surveyor} · {fmtWhen(after)}</p>
            <ResultReadout results={after} p1El={after.p1el} stage="after" note={after.note} />
          </div>
        </div>
        <button className="btn-secondary" onClick={() => exportRecordsToExcel(columns, [before, after])}>
          Export both records · ส่งออกทั้งสองระเบียน
        </button>
      </div>
    </div>
  );
}
