import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fn = mode === 'signin'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) setErr(error.message);
    else if (mode === 'signup') setErr('Check your email to confirm, then sign in.');
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark">⌖</span>
          <h1>Pile Check</h1>
          <p>As-built pile check by total station</p>
        </div>
        <form onSubmit={submit}>
          <label className="field"><span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span>Password</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {err && <p className="form-err">{err}</p>}
          <button className="btn-save" disabled={busy}>
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'New user? Create account' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
