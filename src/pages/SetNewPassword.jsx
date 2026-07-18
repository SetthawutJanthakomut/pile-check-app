import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SetNewPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) {
      setErr('Password must be at least 6 characters · รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== confirm) {
      setErr('Passwords do not match · รหัสผ่านไม่ตรงกัน');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone?.();
  }

  return (
    <div className="login-card">
      <div className="brand">
        <span className="brand-mark">⌖</span>
        <h1>Set new password · ตั้งรหัสผ่านใหม่</h1>
      </div>
      <form onSubmit={submit}>
        <label className="field"><span>New password · รหัสผ่านใหม่</span>
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
        <label className="field"><span>Confirm password · ยืนยันรหัสผ่าน</span>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {err && <p className="form-err">{err}</p>}
        <button className="btn-save" disabled={busy}>{busy ? '…' : 'Set password · ตั้งรหัสผ่าน'}</button>
      </form>
    </div>
  );
}
