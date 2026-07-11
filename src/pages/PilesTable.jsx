import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';
import { num } from '../lib/format';
import { CSV_COLUMNS, parseCsv, exportPilesToCsv } from '../lib/pilesCsv';

const COLUMNS = [
  { key: 'pile_no', label: 'Pile No. · เลขเข็ม', type: 'text', width: 100 },
  { key: 'pile_size', label: 'Size · ขนาด', type: 'text', width: 110 },
  { key: 'dia_mm', label: 'Dia (mm) · เส้นผ่านศูนย์กลาง', type: 'number', decimals: 1, width: 90 },
  { key: 'pile_top_level', label: 'Top Level · ระดับหัวเข็ม', type: 'number' },
  { key: 'sea_bed_level', label: 'Seabed Level · ระดับท้องทะเล', type: 'number' },
  { key: 'pile_toe_level', label: 'Toe Level · ระดับปลายเข็ม', type: 'number' },
  { key: 'length_m', label: 'Length (m) · ความยาว', type: 'number' },
  { key: 'incline', label: 'Incline · ความเอียง', type: 'text', width: 120 },
  { key: 'coordinate_pn', label: 'PN · พิกัด N', type: 'number' },
  { key: 'coordinate_pe', label: 'PE · พิกัด E', type: 'number' },
  { key: 'coating_length_m', label: 'Coating (m) · ความยาวเคลือบ', type: 'number' },
  { key: 'batter_bearing_deg', label: 'Batter Az (°) · ทิศเอียง', type: 'number', decimals: 2 },
  { key: 'note', label: 'Note · หมายเหตุ', type: 'text', width: 160 },
];

export default function PilesTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('piles').select('*').order('pile_no');
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
    const { error } = await supabase.from('piles').update({ [key]: value }).eq('id', rowId);
    if (error) throw new Error(error.message);
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, [key]: value } : r)));
  }

  async function addRow() {
    const placeholder = `NEW-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase
      .from('piles')
      .insert({ pile_no: placeholder, dia_mm: 0, coordinate_pn: 0, coordinate_pe: 0 })
      .select()
      .single();
    if (error) { flashToast({ type: 'err', msg: error.message }); return; }
    setRows((rs) => [...rs, data]);
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete pile ${row.pile_no}? / ลบเข็ม ${row.pile_no}?`)) return;
    const { data, error } = await supabase.from('piles').delete().eq('id', row.id).select();
    if (error) {
      if (error.code === '23503') {
        flashToast({ type: 'err', msg: 'This pile has saved records and cannot be deleted · เข็มนี้มีบันทึกแล้ว ไม่สามารถลบได้' });
      } else {
        flashToast({ type: 'err', msg: error.message });
      }
      return;
    }
    if (!data || data.length === 0) {
      flashToast({ type: 'err', msg: 'Can only delete piles you created · ลบได้เฉพาะเข็มที่คุณสร้างเท่านั้น' });
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    flashToast({ type: 'ok', msg: `Deleted ${row.pile_no} · ลบ ${row.pile_no} แล้ว` });
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
        obj[h] = col.type === 'number' ? num(cell) : (cell === '' ? null : cell);
      });
      return obj;
    }).filter((o) => o.pile_no);

    const existing = new Set(rows.map((r) => r.pile_no));
    const toInsert = parsed.filter((o) => !existing.has(o.pile_no));
    const skipped = parsed.length - toInsert.length;

    if (toInsert.length === 0) {
      setImportMsg(`0 inserted, ${skipped} skipped · เพิ่ม 0 ข้าม ${skipped} แถว`);
      e.target.value = '';
      return;
    }

    setImporting(true);
    const { data, error } = await supabase.from('piles').insert(toInsert).select();
    setImporting(false);
    e.target.value = '';
    if (error) { setImportMsg(`Import failed · นำเข้าไม่สำเร็จ: ${error.message}`); return; }
    setRows((rs) => [...rs, ...data].sort((a, b) => a.pile_no.localeCompare(b.pile_no)));
    setImportMsg(`${data.length} inserted, ${skipped} skipped · เพิ่ม ${data.length} ข้าม ${skipped} แถว`);
  }

  return (
    <div className="page-wide">
      <div className="page-toolbar">
        <h1>Design Piles · เข็มออกแบบ</h1>
        <button className="btn-secondary" onClick={addRow}>+ Add row · เพิ่มแถว</button>
        <button className="btn-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
          {importing ? 'Importing…' : 'Import CSV · นำเข้า CSV'}
        </button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleImport} />
        <button className="btn-secondary" disabled={!rows.length} onClick={() => exportPilesToCsv(rows)}>
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
