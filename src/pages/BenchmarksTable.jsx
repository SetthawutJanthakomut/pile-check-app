import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';
import { num } from '../lib/format';
import { CSV_COLUMNS, parseCsv, exportBenchmarksToCsv } from '../lib/benchmarksCsv';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import { useDataRefresh } from '../lib/dataRefresh';

function getColumns(t) {
  return [
    { key: 'name', label: t('benchmarks.col.name'), type: 'text', width: 120 },
    { key: 'northing', label: t('benchmarks.col.northing'), type: 'number' },
    { key: 'easting', label: t('benchmarks.col.easting'), type: 'number' },
    { key: 'elevation', label: t('benchmarks.col.elevation'), type: 'number' },
    { key: 'type', label: t('benchmarks.col.type'), type: 'select', options: ['BM', 'STN', 'TP'], width: 80 },
    { key: 'active', label: t('benchmarks.col.active'), type: 'boolean', width: 70 },
    { key: 'note', label: t('benchmarks.col.note'), type: 'text', width: 180 },
  ];
}

export default function BenchmarksTable({ role }) {
  const { t } = useTranslation();
  const columns = useMemo(() => getColumns(t), [t]);
  const canWrite = role === 'admin';
  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('benchmarks').select('*').order('name');
    if (error) { setToast({ type: 'err', msg: error.message }); return; }
    setRows(data ?? []);
  }, []);

  const { version, reportStart, reportEnd } = useDataRefresh();
  const { loading } = useAutoRefresh(reload, { paused: importing, version, onStart: reportStart, onEnd: reportEnd });

  function flashToast(t) {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSave(rowId, key, value) {
    const { error } = await supabase.from('benchmarks').update({ [key]: value }).eq('id', rowId);
    if (error) throw new Error(error.message);
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, [key]: value } : r)));
  }

  async function addRow() {
    const placeholder = `NEW-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase
      .from('benchmarks')
      .insert({ name: placeholder, northing: 0, easting: 0 })
      .select()
      .single();
    if (error) { flashToast({ type: 'err', msg: error.message }); return; }
    setRows((rs) => [...rs, data]);
  }

  async function handleDelete(row) {
    if (!window.confirm(t('benchmarks.confirmDelete', { name: row.name }))) return;
    const { data, error } = await supabase.from('benchmarks').delete().eq('id', row.id).select();
    if (error) {
      if (error.code === '23503') {
        flashToast({ type: 'err', msg: t('benchmarks.hasRecordsCannotDelete') });
      } else {
        flashToast({ type: 'err', msg: error.message });
      }
      return;
    }
    if (!data || data.length === 0) {
      flashToast({ type: 'err', msg: t('benchmarks.onlyOwnDelete') });
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    flashToast({ type: 'ok', msg: t('benchmarks.deletedToast', { name: row.name }) });
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const table = parseCsv(text);
    if (table.length < 2) { setImportMsg(t('benchmarks.emptyFileMsg')); e.target.value = ''; return; }

    const headers = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const colKeys = new Set(CSV_COLUMNS);
    const colByKey = Object.fromEntries(getColumns(t).map((c) => [c.key, c]));

    const parsed = table.slice(1).map((cells) => {
      const obj = {};
      headers.forEach((h, i) => {
        if (!colKeys.has(h)) return;
        const col = colByKey[h];
        const cell = (cells[i] ?? '').trim();
        if (col.type === 'number') obj[h] = num(cell);
        else if (col.type === 'boolean') obj[h] = /^(true|1|yes)$/i.test(cell);
        else obj[h] = cell === '' ? null : cell;
      });
      return obj;
    }).filter((o) => o.name);

    const existing = new Set(rows.map((r) => r.name));
    const toInsert = parsed.filter((o) => !existing.has(o.name));
    const skipped = parsed.length - toInsert.length;

    if (toInsert.length === 0) {
      setImportMsg(t('benchmarks.importResultMsg', { n: 0, skipped }));
      e.target.value = '';
      return;
    }

    setImporting(true);
    const { data, error } = await supabase.from('benchmarks').insert(toInsert).select();
    setImporting(false);
    e.target.value = '';
    if (error) { setImportMsg(`${t('benchmarks.importFailedMsg')}: ${error.message}`); return; }
    setRows((rs) => [...rs, ...data].sort((a, b) => a.name.localeCompare(b.name)));
    setImportMsg(t('benchmarks.importResultMsg', { n: data.length, skipped }));
  }

  return (
    <div className="page-wide">
      <div className="page-toolbar">
        <h1>{t('benchmarks.pageTitle')}</h1>
        {canWrite && <button className="btn-secondary" onClick={addRow}>{t('benchmarks.addRowBtn')}</button>}
        {canWrite && (
          <button className="btn-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? t('benchmarks.importingBtn') : t('benchmarks.importCsvBtn')}
          </button>
        )}
        {canWrite && <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleImport} />}
        <button className="btn-secondary" disabled={!rows.length} onClick={() => exportBenchmarksToCsv(rows)}>
          {t('benchmarks.exportCsvBtn')}
        </button>
        {importMsg && <div className="import-msg">{importMsg}</div>}
      </div>
      {loading ? <p className="hint">{t('plan.loading')}</p> : (
        <DataTable
          columns={columns}
          rows={rows}
          onSave={handleSave}
          readOnly={!canWrite}
          actionsLabel={canWrite ? t('benchmarks.deleteBtn') : undefined}
          renderRowActions={canWrite ? (row) => (
            <button className="link danger" onClick={() => handleDelete(row)}>{t('benchmarks.deleteBtn')}</button>
          ) : undefined}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
