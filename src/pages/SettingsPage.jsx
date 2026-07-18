import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';

const LABELS = {
  tol_position_m: 'Position tolerance (m) · ค่าเผื่อตำแหน่ง (ม.)',
  tol_tilt_deg: 'Tilt tolerance (°) · ค่าเผื่อความเอียง (องศา)',
  tol_residual_m: 'Residual tolerance (m) · ค่าเผื่อระยะเบี่ยงเบน P3 (ม.)',
  tol_bs_m: 'Backsight tolerance (m) · ค่าเผื่อหมุดหลัง (ม.)',
  tol_coating_embed_m: 'Coating embed below seabed (m) · ระยะสีจมใต้ท้องทะเลขั้นต่ำ (ม.)',
};

const COLUMNS = [
  { key: 'label', label: 'Setting · การตั้งค่า', type: 'readonly', width: 260 },
  { key: 'value', label: 'Value · ค่า', type: 'number', decimals: 4, width: 110 },
  { key: 'description', label: 'Description · คำอธิบาย', type: 'readonly' },
];

export default function SettingsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('project_settings').select('*').order('key');
      if (error) setToast({ type: 'err', msg: error.message });
      setRows((data ?? []).map((r) => ({ id: r.key, ...r, label: LABELS[r.key] ?? r.key })));
      setLoading(false);
    })();
  }, []);

  async function handleSave(rowId, key, value) {
    const { error } = await supabase.from('project_settings').update({ [key]: value }).eq('key', rowId);
    if (error) throw new Error(error.message);
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, [key]: value } : r)));
  }

  return (
    <div className="page-wide">
      <div className="page-toolbar">
        <h1>Settings · ตั้งค่า</h1>
      </div>
      {loading ? <p className="hint">Loading… · กำลังโหลด</p> : (
        <DataTable columns={COLUMNS} rows={rows} onSave={handleSave} />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
