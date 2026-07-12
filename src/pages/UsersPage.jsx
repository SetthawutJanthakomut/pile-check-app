import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const ROLES = ['viewer', 'recorder', 'admin'];

export default function UsersPage({ session }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const myId = session?.user?.id;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at');
    if (error) flashToast({ type: 'err', msg: error.message });
    const sorted = (data ?? []).slice().sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return 0;
    });
    setRows(sorted);
    setLoading(false);
  }

  function flashToast(t) {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  }

  async function setStatus(id, status) {
    if (id === myId) return;
    const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
    if (error) { flashToast({ type: 'err', msg: error.message }); return; }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function setRole(id, role) {
    if (id === myId) return;
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) { flashToast({ type: 'err', msg: error.message }); return; }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, role } : r)));
  }

  return (
    <div className="page-wide">
      <div className="page-toolbar">
        <h1>Users · จัดการผู้ใช้</h1>
      </div>
      {loading ? <p className="hint">Loading… · กำลังโหลด</p> : (
        <div className="table-wrap">
          <table className="data-table mono">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role · บทบาท</th>
                <th>Status · สถานะ</th>
                <th>Created · สร้างเมื่อ</th>
                <th className="dt-actions-head">Actions · การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelf = r.id === myId;
                return (
                  <tr key={r.id}>
                    <td>{r.email}{isSelf ? ' (you)' : ''}</td>
                    <td>
                      <select
                        value={r.role}
                        disabled={isSelf}
                        onChange={(e) => setRole(r.id, e.target.value)}
                      >
                        {ROLES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className={r.status === 'pending' ? 'check-bad' : 'check-ok'}>{r.status}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td className="dt-actions-cell">
                      {r.status === 'pending' ? (
                        <button className="link" onClick={() => setStatus(r.id, 'approved')}>Approve · อนุมัติ</button>
                      ) : (
                        !isSelf && <button className="link danger" onClick={() => setStatus(r.id, 'pending')}>Revoke · ระงับ</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
