import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fmt, verdictClass } from '../lib/format';

const MOBILE_FREEZE_CAP_RATIO = 0.45;

/**
 * Persists a user's frozen-column choice (by key) to localStorage.
 * candidateKeys/defaultKeys are the freezable column keys, in table order.
 */
export function useFrozenColumns(storageKey, defaultKeys) {
  const [frozenKeys, setFrozenKeys] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore malformed storage */ }
    return defaultKeys;
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(frozenKeys)); } catch { /* ignore quota/denied */ }
  }, [storageKey, frozenKeys]);

  const toggle = useCallback((key) => {
    setFrozenKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  }, []);

  const reset = useCallback(() => setFrozenKeys(defaultKeys), [defaultKeys]);

  return [frozenKeys, toggle, reset];
}

/**
 * Small "Columns · คอลัมน์" button + popover for toggling which columns are frozen.
 * candidates: [{ key, label }] in table order.
 */
export function FreezeColumnsMenu({ candidates, frozenKeys, onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="freeze-menu">
      <button type="button" className="btn-secondary" onClick={() => setOpen((o) => !o)}>
        Columns · คอลัมน์
      </button>
      {open && (
        <>
          <div className="freeze-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="freeze-menu-popover">
            {candidates.map((c) => (
              <label key={c.key} className="freeze-menu-row">
                <input type="checkbox" checked={frozenKeys.includes(c.key)} onChange={() => onToggle(c.key)} />
                <span>{c.label}</span>
                <span className="freeze-menu-hint">Freeze · ตรึง</span>
              </label>
            ))}
            <button type="button" className="link" onClick={() => { onReset(); setOpen(false); }}>
              Reset · ค่าเริ่มต้น
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Reusable spreadsheet-style grid.
 *
 * columns: [{ key, label, type: 'text'|'number'|'readonly'|'boolean'|'select',
 *             width, decimals, options, verdict, render(value,row) }]
 * rows: array of plain objects, each with an `id`.
 * onSave(rowId, key, value): async — persists a single field. Throw to trigger revert + toast.
 * renderRowActions(row): optional — trailing actions cell (e.g. delete button).
 * readOnly: when true, cells are not editable (view-only grid).
 * frozenKeys: optional — column keys to pin with `position: sticky` while scrolling
 *             horizontally. Cumulative offsets are measured from actual rendered
 *             widths, so leading unfrozen columns don't need to be listed. On small
 *             screens the leftmost frozen columns are kept only up to 45% of the
 *             viewport width; the rest fall back to unfrozen.
 */
export default function DataTable({ columns, rows, onSave, renderRowActions, actionsLabel, readOnly = false, frozenKeys = [] }) {
  const [editing, setEditing] = useState(null); // { rowId, key }
  const [editValue, setEditValue] = useState('');
  const [overrides, setOverrides] = useState({}); // `${rowId}:${key}` -> optimistic value
  const [savingCell, setSavingCell] = useState(null);
  const [savedCell, setSavedCell] = useState(null);
  const [toast, setToast] = useState(null);
  const headRowRef = useRef(null);
  const [colWidths, setColWidths] = useState({});
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    if (!frozenKeys.length) return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [frozenKeys.length]);

  useLayoutEffect(() => {
    if (!frozenKeys.length) return undefined;
    const row = headRowRef.current;
    if (!row) return undefined;
    const ths = Array.from(row.querySelectorAll('th[data-col-key]'));
    const measure = () => {
      const widths = {};
      ths.forEach((th) => { widths[th.dataset.colKey] = th.getBoundingClientRect().width; });
      setColWidths(widths);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ths.forEach((th) => ro.observe(th));
    return () => ro.disconnect();
  }, [frozenKeys.length, columns]);

  // Cap total frozen width to MOBILE_FREEZE_CAP_RATIO of the viewport so the
  // scrollable data area always keeps most of the screen on small devices.
  const frozenLayout = useMemo(() => {
    const left = {};
    if (!frozenKeys.length) return { left, edgeKey: null };
    const capPx = viewportWidth * MOBILE_FREEZE_CAP_RATIO;
    const frozenSet = new Set(frozenKeys);
    let cum = 0;
    let edgeKey = null;
    for (const col of columns) {
      if (!frozenSet.has(col.key)) continue;
      const w = colWidths[col.key] ?? 0;
      if (cum + w > capPx) break;
      left[col.key] = cum;
      cum += w;
      edgeKey = col.key;
    }
    return { left, edgeKey };
  }, [frozenKeys, columns, colWidths, viewportWidth]);

  function frozenProps(key) {
    if (!(key in frozenLayout.left)) return { className: '', style: undefined };
    const className = `dt-frozen${frozenLayout.edgeKey === key ? ' dt-frozen-edge' : ''}`;
    return { className, style: { position: 'sticky', left: frozenLayout.left[key] } };
  }

  const cellKey = (rowId, key) => `${rowId}:${key}`;

  function valueOf(row, col) {
    const ck = cellKey(row.id, col.key);
    return ck in overrides ? overrides[ck] : row[col.key];
  }

  function startEdit(row, col) {
    if (readOnly || col.type === 'readonly' || col.type === 'boolean' || col.type === 'select') return;
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
          <tr ref={headRowRef}>
            {columns.map((col) => {
              const fp = frozenProps(col.key);
              return (
                <th
                  key={col.key}
                  data-col-key={col.key}
                  className={fp.className || undefined}
                  style={{ ...(col.width ? { width: col.width } : undefined), ...fp.style }}
                >
                  {col.label}
                </th>
              );
            })}
            {renderRowActions && <th className="dt-actions-head">{actionsLabel || ''}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => {
                const ck = cellKey(row.id, col.key);
                const value = valueOf(row, col);
                const isNum = col.type === 'number' || (col.type === 'readonly' && typeof value === 'number');
                const isEditing = editing && editing.rowId === row.id && editing.key === col.key;
                const fp = frozenProps(col.key);

                if (col.render) {
                  return (
                    <td key={col.key} className={`${isNum ? 'mono' : ''} ${fp.className}`.trim()} style={fp.style}>
                      {col.render(value, row)}
                    </td>
                  );
                }

                if (col.type === 'boolean') {
                  return (
                    <td key={col.key} className={`dt-cell-bool ${fp.className}`.trim()} style={fp.style}>
                      <input type="checkbox" checked={!!value} disabled={readOnly} onChange={() => save(row, col, !value)} />
                    </td>
                  );
                }

                if (col.type === 'select') {
                  return (
                    <td key={col.key} className={fp.className || undefined} style={fp.style}>
                      <select value={value ?? ''} disabled={readOnly} onChange={(e) => save(row, col, e.target.value)}>
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
                    <td key={col.key} className={`${isNum ? 'mono' : ''} ${vc ? `check-${vc}` : ''} ${fp.className}`.trim()} style={fp.style}>
                      {isNum ? fmt(value, col.decimals ?? 3) : (value ?? '—')}
                    </td>
                  );
                }

                return (
                  <td
                    key={col.key}
                    className={`dt-cell ${isNum ? 'mono' : ''} ${fp.className}`.trim()}
                    style={fp.style}
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
