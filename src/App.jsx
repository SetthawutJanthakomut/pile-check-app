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
  const [page, setPage] = useState('form');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <Login />;

  return (
    <>
      <header className="topbar">
        <span className="brand-mark">⌖</span>
        <strong>Pile Check</strong>
        <span className="topbar-user">{session.user.email}</span>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
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
      {page === 'form' && <FormPage session={session} />}
      {page === 'piles' && <PilesTable session={session} />}
      {page === 'benchmarks' && <BenchmarksTable session={session} />}
      {page === 'records' && <RecordsTable session={session} />}
    </>
  );
}
