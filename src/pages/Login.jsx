import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login({ onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('signin');
  const [err, setErr] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next) {
    setMode(next); setErr(null); setNotice(null);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null); setNotice(null);
    if (mode === 'reset') {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      setBusy(false);
      // Always show the same message, whether or not the email exists.
      setNotice('Reset link sent — check your email · ส่งลิงก์แล้ว โปรดเช็คอีเมล');
      return;
    }
    const fn = mode === 'signin'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) {
      console.log('Supabase auth error:', error); // TEMP DEBUG - remove after diagnosing login issue
      setErr(error.message);
    }
    else if (mode === 'signup') setNotice('Registered! 1) Confirm via the email we sent 2) Then WAIT for admin approval before you can use the system · สมัครแล้ว! 1) ยืนยันอีเมลตามลิงก์ที่ส่งไป 2) จากนั้นรอผู้ดูแลอนุมัติ จึงจะใช้งานได้');
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
        {mode !== 'reset' && (
          <>
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
            {mode === 'signin' && (
              <button type="button" className="link" onClick={() => switchMode('reset')}>
                Forgot password? · ลืมรหัสผ่าน
              </button>
            )}
          </>
        )}
        {err && <p className="form-err">{err}</p>}
        {notice && <p className="hint">{notice}</p>}
        <button className="btn-save" disabled={busy}>
          {busy ? '…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link · ส่งลิงก์รีเซ็ต'}
        </button>
      </form>
      {mode === 'reset' ? (
        <button className="link" onClick={() => switchMode('signin')}>
          Back to sign in · กลับไปเข้าสู่ระบบ
        </button>
      ) : (
        <button className="link" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'New user? Create account' : 'Have an account? Sign in'}
        </button>
      )}
      <button className="link" onClick={onClose}>Close · ปิด</button>
    </div>
  );
}
