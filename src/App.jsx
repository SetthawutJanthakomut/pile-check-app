import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import FormPage from './pages/FormPage';
import PilesTable from './pages/PilesTable';
import BenchmarksTable from './pages/BenchmarksTable';
import RecordsTable from './pages/RecordsTable';

const PAGES = [
  { key: 'form', label: 'Form · แบบฟอร์ม' },
  { key: 'piles', label: 'Design Piles · เข็มออกแบบ' },
  { key: 'benchmarks', label: 'Benchmarks · หมุดอ้างอิง' },
  { key: 'records', label: 'Records · บันทึก' },
];

export default function App() {
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState(null);
  const [page, setPage] = useState('form');
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setRole(null); return; }
    supabase.from('profiles').select('role').eq('id', session.user.id).single()
      .then(({ data }) => setRole(data?.role ?? null));
  }, [session]);

  if (session === undefined) return null;

  return (
    <>
      <header className="topbar">
        <span className="brand-mark">⌖</span>
        <strong>Pile Check</strong>
        <span className="topbar-user">
          {session ? `${session.user.email} · ${role ?? '…'}` : ''}
        </span>
        {session ? (
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        ) : (
          <button className="link" onClick={() => setShowLogin(true)}>Sign in</button>
        )}
      </header>
      <nav className="subnav">
        {PAGES.map((p) => (
          <button
            key={p.key}
            className={page === p.key ? 'active' : ''}
            onClick={() => setPage(p.key)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <div style={{ display: page === 'form' ? '' : 'none' }}><FormPage session={session} role={role} /></div>
      <div style={{ display: page === 'piles' ? '' : 'none' }}><PilesTable role={role} /></div>
      <div style={{ display: page === 'benchmarks' ? '' : 'none' }}><BenchmarksTable role={role} /></div>
      <div style={{ display: page === 'records' ? '' : 'none' }}><RecordsTable session={session} /></div>
      {showLogin && (
        <div className="modal-backdrop" onClick={() => setShowLogin(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Login onClose={() => setShowLogin(false)} />
          </div>
        </div>
      )}
    </>
  );
}
