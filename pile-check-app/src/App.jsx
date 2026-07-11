import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import FormPage from './pages/FormPage';

export default function App() {
  const [session, setSession] = useState(undefined);

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
      <FormPage session={session} />
    </>
  );
}
