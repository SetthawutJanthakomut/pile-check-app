import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { ROLE_KEY } from '../lib/statusLabels';

const ROLES = ['viewer', 'recorder', 'admin'];
const STATUS_KEY = { pending: 'users.status.pending', approved: 'users.status.approved' };

export default function UsersPage({ session }) {
  const { t } = useTranslation();
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
        <h1>{t('users.pageTitle')}</h1>
      </div>
      {loading ? <p className="hint">{t('users.loadingLabel')}</p> : (
        <div className="table-wrap">
          <table className="data-table mono">
            <thead>
              <tr>
                <th>{t('users.col.email')}</th>
                <th>{t('users.col.role')}</th>
                <th>{t('users.col.status')}</th>
                <th>{t('users.col.created')}</th>
                <th className="dt-actions-head">{t('users.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelf = r.id === myId;
                return (
                  <tr key={r.id}>
                    <td>{r.email}{isSelf ? ` ${t('users.youSuffix')}` : ''}</td>
                    <td>
                      <select
                        value={r.role}
                        disabled={isSelf}
                        onChange={(e) => setRole(r.id, e.target.value)}
                      >
                        {ROLES.map((opt) => <option key={opt} value={opt}>{t(ROLE_KEY[opt])}</option>)}
                      </select>
                    </td>
                    <td className={r.status === 'pending' ? 'check-bad' : 'check-ok'}>{STATUS_KEY[r.status] ? t(STATUS_KEY[r.status]) : r.status}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td className="dt-actions-cell">
                      {r.status === 'pending' ? (
                        <button className="link" onClick={() => setStatus(r.id, 'approved')}>{t('users.approveBtn')}</button>
                      ) : (
                        !isSelf && <button className="link danger" onClick={() => setStatus(r.id, 'pending')}>{t('users.revokeBtn')}</button>
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
