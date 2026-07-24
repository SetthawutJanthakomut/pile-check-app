import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import { useDataRefresh } from '../lib/dataRefresh';

const TRACKED_TABLES = ['piles', 'benchmarks', 'asbuilt_records', 'project_settings', 'profiles'];
const TABLE_LABEL_KEY = {
  piles: 'history.table.piles',
  benchmarks: 'history.table.benchmarks',
  asbuilt_records: 'history.table.asbuilt_records',
  project_settings: 'history.table.project_settings',
  profiles: 'history.table.profiles',
};

function formatValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// old_data is the full pre-change row snapshot — shown as a plain key: value
// list. Per-table field labels are intentionally not implemented here.
function HistoryDetailModal({ row, tableLabel, userLabel, onClose }) {
  const { t } = useTranslation();
  const entries = Object.entries(row.old_data || {});
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{tableLabel} · {row.row_id}</h2>
            <p className="hint">
              {t(`history.action.${row.action}`)} · {row.changed_at ? new Date(row.changed_at).toLocaleString() : '—'} · {userLabel}
            </p>
          </div>
          <button className="link" onClick={onClose}>{t('history.modal.closeBtn')}</button>
        </div>
        {entries.length === 0 ? (
          <p className="hint">{t('history.modal.emptyLabel')}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table mono">
              <tbody>
                {entries.map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td>{formatValue(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState(null);
  const [emailById, setEmailById] = useState({});
  const [userOptions, setUserOptions] = useState([]);
  const [filterTable, setFilterTable] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  // Users who appear in record_history at all — independent of the current
  // filters, so the dropdown doesn't shrink as filters narrow the table.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('record_history').select('changed_by');
      const ids = [...new Set((data ?? []).map((r) => r.changed_by).filter(Boolean))];
      if (ids.length === 0) { setUserOptions([]); return; }
      const { data: profs } = await supabase.from('profiles').select('id, email').in('id', ids);
      const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email]));
      setEmailById(byId);
      setUserOptions(ids.map((id) => ({ id, label: byId[id] ?? id })).sort((a, b) => a.label.localeCompare(b.label)));
    })();
  }, []);

  const load = useCallback(async () => {
    let q = supabase.from('record_history').select('*').order('changed_at', { ascending: false });
    if (filterTable) q = q.eq('table_name', filterTable);
    if (filterUser) q = q.eq('changed_by', filterUser);
    if (dateFrom) q = q.gte('changed_at', dateFrom);
    if (dateTo) q = q.lte('changed_at', `${dateTo}T23:59:59.999`);
    const { data, error } = await q;
    if (error) { setToast({ type: 'err', msg: error.message }); return; }
    setRows(data ?? []);
  }, [filterTable, filterUser, dateFrom, dateTo]);

  const { version, reportStart, reportEnd } = useDataRefresh();
  const { loading } = useAutoRefresh(load, { version, onStart: reportStart, onEnd: reportEnd });

  const columns = useMemo(() => [
    {
      key: '_view', label: '', type: 'readonly', width: 50,
      render: (_v, row) => <button className="link" onClick={() => setSelectedRow(row)}>{t('history.viewBtn')}</button>,
    },
    {
      key: 'changed_at', label: t('history.col.changedAt'), type: 'readonly', width: 160,
      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      key: 'table_name', label: t('history.col.table'), type: 'readonly', width: 140,
      render: (v) => (TABLE_LABEL_KEY[v] ? t(TABLE_LABEL_KEY[v]) : v),
    },
    { key: 'row_id', label: t('history.col.rowId'), type: 'readonly', width: 220 },
    {
      key: 'action', label: t('history.col.action'), type: 'readonly', width: 90,
      render: (v) => <span className={v === 'delete' ? 'check-bad' : 'check-ok'}>{t(`history.action.${v}`)}</span>,
    },
    {
      key: 'changed_by', label: t('history.col.changedBy'), type: 'readonly', width: 220,
      render: (v) => emailById[v] ?? v ?? '—',
    },
  ], [t, emailById]);

  return (
    <div className="page-wide">
      <div className="page-toolbar">
        <h1>{t('history.pageTitle')}</h1>
        <select value={filterTable} onChange={(e) => setFilterTable(e.target.value)}>
          <option value="">{t('history.filter.allTables')}</option>
          {TRACKED_TABLES.map((tbl) => <option key={tbl} value={tbl}>{t(TABLE_LABEL_KEY[tbl])}</option>)}
        </select>
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
          <option value="">{t('history.filter.allUsers')}</option>
          {userOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
        <label className="hint">
          {t('history.filter.from')}
          {' '}
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="hint">
          {t('history.filter.to')}
          {' '}
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
      </div>
      {loading ? <p className="hint">{t('history.loadingLabel')}</p> : (
        rows.length === 0 ? <p className="hint">{t('history.emptyLabel')}</p> : (
          <DataTable columns={columns} rows={rows} readOnly />
        )
      )}
      {selectedRow && (
        <HistoryDetailModal
          row={selectedRow}
          tableLabel={TABLE_LABEL_KEY[selectedRow.table_name] ? t(TABLE_LABEL_KEY[selectedRow.table_name]) : selectedRow.table_name}
          userLabel={emailById[selectedRow.changed_by] ?? selectedRow.changed_by ?? '—'}
          onClose={() => setSelectedRow(null)}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
