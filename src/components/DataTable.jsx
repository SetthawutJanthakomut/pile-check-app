import { useState } from 'react';
import { fmt, verdictClass } from '../lib/format';

/**
 * Reusable spreadsheet-style grid.
 *
 * columns: [{ key, label, type: 'text'|'number'|'readonly'|'boolean'|'select',
 *             width, decimals, options, verdict, render(value,row) }]
 * rows: array of plain objects, each with an `id`.
 * onSave(rowId, key, value): async — persists a single field. Throw to trigger revert + toast.
 * renderRowActions(row): optional — trailing actions cell (e.g. delete button).
 */
export default function DataTable({ columns, rows, onSave, renderRowActions, actionsLabel }) {
  const [editing, setEditing] = useState(null); // { rowId, key }
  const [editValue, setEditValue] = useState('');
  const [overrides, setOverrides] = useState({}); // `${rowId}:${key}` -> optimistic value
  const [savingCell, setSavingCell] = useState(null);
  const [savedCell, setSavedCell] = useState(null);
  const [toast, setToast] = useState(null);

  const cellKey = (rowId, key) => `${rowId}:${key}`;

  function valueOf(row, col) {
    const ck = cellKey(row.id, col.key);
    return ck in overrides ? overrides[ck] : row[col.key];
  }

  function startEdit(row, col) {
    if (col.type === 'readonly' || col.type === 'boolean' || col.type === 'select') return;
    const v = valueOf(row, col);
    setEditValue(v == null ? '' : String(v));
    setEditing({ rowId: row.id, key: col.key });
  }

  function cancelEdit() {
    setEditing(null);
    setEditValue('');
  }

  async function save(row, col, newVal) {
    const ck = cellKey(row.id, col.key);
    setOverrides((o) => ({ ...o, [ck]: newVal }));
    setSavingCell(ck);
    try {
      await onSave(row.id, col.key, newVal);
      setSavedCell(ck);
      setTimeout(() => setSavedCell((c) => (c === ck ? null : c)), 1500);
    } catch (err) {
      setOverrides((o) => {
        const n = { ...o };
        delete n[ck];
        return n;
      });
      setToast({ type: 'err', msg: err?.message || 'Save failed · บันทึกไม่สำเร็จ' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSavingCell((c) => (c === ck ? null : c));
    }
  }

  async function commitEdit(row, col) {
    if (!editing || editing.rowId !== row.id || editing.key !== col.key) return;
    let newVal;
    if (col.type === 'number') {
      const cleaned = editValue.replace(/[, ]+/g, '').trim();
      if (cleaned === '') {
        newVal = null;
      } else {
        const n = Number(cleaned);
        if (Number.isNaN(n)) {
          cancelEdit();
          return;
        }
        newVal = n;
      }
    } else {
      newVal = editValue.trim() === '' ? null : editValue;
    }
    cancelEdit();
    if (newVal === (row[col.key] ?? null)) return;
    await save(row, col, newVal);
  }

  return (
    <div className="table-wrap">
      <table className="data-table mono">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
            {renderRowActions && <th className="dt-actions-head">{actionsLabel || ''}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => {
                const ck = cellKey(row.id, col.key);
                const value = valueOf(row, col);
                const isNum = col.type === 'number';
                const isEditing = editing && editing.rowId === row.id && editing.key === col.key;

                if (col.render) {
                  return (
                    <td key={col.key} className={isNum ? 'mono' : undefined}>
                      {col.render(value, row)}
                    </td>
                  );
                }

                if (col.type === 'boolean') {
                  return (
                    <td key={col.key} className="dt-cell-bool">
                      <input type="checkbox" checked={!!value} onChange={() => save(row, col, !value)} />
                    </td>
                  );
                }

                if (col.type === 'select') {
                  return (
                    <td key={col.key}>
                      <select value={value ?? ''} onChange={(e) => save(row, col, e.target.value)}>
                        {col.options.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </td>
                  );
                }

                if (col.type === 'readonly') {
                  const vc = col.verdict ? verdictClass(value) : '';
                  return (
                    <td key={col.key} className={`${isNum ? 'mono' : ''} ${vc ? `check-${vc}` : ''}`.trim()}>
                      {isNum ? fmt(value, col.decimals ?? 3) : (value ?? '—')}
                    </td>
                  );
                }

                return (
                  <td
                    key={col.key}
                    className={`dt-cell ${isNum ? 'mono' : ''}`.trim()}
                    onClick={() => !isEditing && startEdit(row, col)}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        className="dt-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(row, col)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    ) : (
                      <>
                        {isNum ? fmt(value, col.decimals ?? 3) : (value ?? '—')}
                        {savingCell === ck && <span className="dt-status saving">…</span>}
                        {savedCell === ck && <span className="dt-status saved">✓</span>}
                      </>
                    )}
                  </td>
                );
              })}
              {renderRowActions && <td className="dt-actions-cell">{renderRowActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
