import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { supabase } from './lib/supabase';
import { localdb } from './lib/localdb';
import { syncPending } from './lib/sync';
import Login from './pages/Login';
import FormPage from './pages/FormPage';
import PilesTable from './pages/PilesTable';
import BenchmarksTable from './pages/BenchmarksTable';
import RecordsTable from './pages/RecordsTable';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';

const PAGES = [
  { key: 'form', label: 'Form · แบบฟอร์ม' },
  { key: 'piles', label: 'Design Piles · เข็มออกแบบ' },
  { key: 'benchmarks', label: 'Benchmarks · หมุดอ้างอิง' },
  { key: 'records', label: 'Records · บันทึก' },
  { key: 'settings', label: 'Settings · ตั้งค่า', adminOnly: true },
  { key: 'users', label: 'Users · จัดการผู้ใช้', adminOnly: true },
];

export default function App() {
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState(null);
  const [page, setPage] = useState('form');
  const [showLogin, setShowLogin] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncedToast, setSyncedToast] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = liveQuery(() => localdb.pending_records.count()).subscribe({ next: setPendingCount });
    return () => sub.unsubscribe();
  }, []);

  // Sync queued offline records on app start and whenever the browser
  // regains connectivity.
  useEffect(() => {
    async function runSync() {
      const before = await localdb.pending_records.count();
      if (before === 0) return;
      await syncPending();
      const after = await localdb.pending_records.count();
      if (after === 0) {
        setSyncedToast(true);
        setTimeout(() => setSyncedToast(false), 4000);
      }
    }
    runSync();
    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, []);

  useEffect(() => {
    if (!session) { setRole(null); setStatus(null); return; }
    supabase.from('profiles').select('role, status').eq('id', session.user.id).single()
      .then(({ data }) => {
        setStatus(data?.status ?? null);
        // Role is only effective once the profile is approved.
        setRole(data?.status === 'approved' ? (data?.role ?? null) : null);
      });
  }, [session]);

  if (session === undefined) return null;

  if (session && status === 'pending') {
    return (
      <div className="modal-backdrop">
        <div className="login-card">
          <div className="brand">
            <span className="brand-mark">⌖</span>
            <h1>Pile Check</h1>
          </div>
          <p className="hint" style={{ textAlign: 'center', fontSize: 15 }}>
            Waiting for admin approval · รอผู้ดูแลอนุมัติ
          </p>
          <button className="btn-save" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <span className="brand-mark">⌖</span>
        <strong>Pile Check</strong>
        <span className="topbar-user">
          {session ? `${session.user.email} · ${role ?? '…'}` : ''}
        </span>
        {pendingCount > 0 && (
          <span className="pending-indicator">⏳ {pendingCount} pending · รอซิงค์</span>
        )}
        {session ? (
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        ) : (
          <button className="link" onClick={() => setShowLogin(true)}>Sign in</button>
        )}
      </header>
      <nav className="subnav">
        {PAGES.filter((p) => !p.adminOnly || role === 'admin').map((p) => (
          <button
            key={p.key}
            className={page === p.key ? 'active' : ''}
            onClick={() => setPage(p.key)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <div style={{ display: page === 'form' ? '' : 'none' }}>
        <FormPage
          session={session}
          role={role}
          active={page === 'form'}
          editRecord={editRecord}
          onCancelEdit={() => setEditRecord(null)}
          onEditSaved={() => { setEditRecord(null); setPage('records'); }}
        />
      </div>
      <div style={{ display: page === 'piles' ? '' : 'none' }}><PilesTable role={role} /></div>
      <div style={{ display: page === 'benchmarks' ? '' : 'none' }}><BenchmarksTable role={role} /></div>
      <div style={{ display: page === 'records' ? '' : 'none' }}>
        <RecordsTable
          session={session}
          role={role}
          onEdit={(record) => { setEditRecord(record); setPage('form'); }}
        />
      </div>
      {role === 'admin' && (
        <div style={{ display: page === 'settings' ? '' : 'none' }}><SettingsPage /></div>
      )}
      {role === 'admin' && (
        <div style={{ display: page === 'users' ? '' : 'none' }}><UsersPage session={session} /></div>
      )}
      {showLogin && (
        <div className="modal-backdrop" onClick={() => setShowLogin(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Login onClose={() => setShowLogin(false)} />
          </div>
        </div>
      )}
      {syncedToast && <div className="toast ok">Synced · ซิงค์สำเร็จ</div>}
    </>
  );
}
