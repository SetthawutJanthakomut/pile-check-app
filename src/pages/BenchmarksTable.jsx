import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';
import { num } from '../lib/format';
import { CSV_COLUMNS, parseCsv, exportBenchmarksToCsv } from '../lib/benchmarksCsv';

const COLUMNS = [
  { key: 'name', label: 'Name · ชื่อหมุด', type: 'text', width: 120 },
  { key: 'northing', label: 'Northing · พิกัด N', type: 'number' },
  { key: 'easting', label: 'Easting · พิกัด E', type: 'number' },
  { key: 'elevation', label: 'Elevation · ระดับ', type: 'number' },
  { key: 'type', label: 'Type · ประเภท', type: 'select', options: ['BM', 'STN', 'TP'], width: 80 },
  { key: 'active', label: 'Active · ใช้งาน', type: 'boolean', width: 70 },
  { key: 'note', label: 'Note · หมายเหตุ', type: 'text', width: 180 },
];

export default function BenchmarksTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('benchmarks').select('*').order('name');
      if (error) setToast({ type: 'err', msg: error.message });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

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
    if (!window.confirm(`Delete benchmark ${row.name}? / ลบหมุด ${row.name}?`)) return;
    const { data, error } = await supabase.from('benchmarks').delete().eq('id', row.id).select();
    if (error) {
      if (error.code === '23503') {
        flashToast({ type: 'err', msg: 'This benchmark has saved records and cannot be deleted · หมุดนี้มีบันทึกแล้ว ไม่สามารถลบได้' });
      } else {
        flashToast({ type: 'err', msg: error.message });
      }
      return;
    }
    if (!data || data.length === 0) {
      flashToast({ type: 'err', msg: 'Can only delete benchmarks you created · ลบได้เฉพาะหมุดที่คุณสร้างเท่านั้น' });
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    flashToast({ type: 'ok', msg: `Deleted ${row.name} · ลบ ${row.name} แล้ว` });
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const table = parseCsv(text);
    if (table.length < 2) { setImportMsg('Empty file · ไฟล์ว่างเปล่า'); e.target.value = ''; return; }

    const headers = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const colKeys = new Set(CSV_COLUMNS);
    const colByKey = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));

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
      setImportMsg(`0 inserted, ${skipped} skipped · เพิ่ม 0 ข้าม ${skipped} แถว`);
      e.target.value = '';
      return;
    }

    setImporting(true);
    const { data, error } = await supabase.from('benchmarks').insert(toInsert).select();
    setImporting(false);
    e.target.value = '';
    if (error) { setImportMsg(`Import failed · นำเข้าไม่สำเร็จ: ${error.message}`); return; }
    setRows((rs) => [...rs, ...data].sort((a, b) => a.name.localeCompare(b.name)));
    setImportMsg(`${data.length} inserted, ${skipped} skipped · เพิ่ม ${data.length} ข้าม ${skipped} แถว`);
  }

  return (
    <div className="page-wide">
      <div className="page-toolbar">
        <h1>Benchmarks · หมุดอ้างอิง</h1>
        <button className="btn-secondary" onClick={addRow}>+ Add row · เพิ่มแถว</button>
        <button className="btn-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
          {importing ? 'Importing…' : 'Import CSV · นำเข้า CSV'}
        </button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleImport} />
        <button className="btn-secondary" disabled={!rows.length} onClick={() => exportBenchmarksToCsv(rows)}>
          Export CSV · ส่งออก CSV
        </button>
        {importMsg && <div className="import-msg">{importMsg}</div>}
      </div>
      {loading ? <p className="hint">Loading… · กำลังโหลด</p> : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          onSave={handleSave}
          actionsLabel="Delete · ลบ"
          renderRowActions={(row) => (
            <button className="link danger" onClick={() => handleDelete(row)}>Delete · ลบ</button>
          )}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
