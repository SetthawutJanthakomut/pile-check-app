import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login({ onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    if (error) {
      console.log('Supabase auth error:', error); // TEMP DEBUG - remove after diagnosing login issue
      setErr(error.message);
    }
    else if (mode === 'signup') setErr('Check your email to confirm, then sign in.');
    else onClose?.();
  }

  return (
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
          <div className="pw-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="pw-toggle" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'Hide · ซ่อน' : 'Show · แสดง'}
            </button>
          </div>
        </label>
        {err && <p className="form-err">{err}</p>}
        <button className="btn-save" disabled={busy}>
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? 'New user? Create account' : 'Have an account? Sign in'}
      </button>
      <button className="link" onClick={onClose}>Close · ปิด</button>
    </div>
  );
}
