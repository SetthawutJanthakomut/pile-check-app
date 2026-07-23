import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

export default function SetNewPassword({ onDone }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) {
      setErr(t('login.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setErr(t('login.passwordMismatch'));
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
        <h1>{t('login.setNewPasswordTitle')}</h1>
      </div>
      <form onSubmit={submit}>
        <label className="field"><span>{t('login.newPasswordLabel')}</span>
          <div className="pw-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="pw-toggle" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? t('login.hidePassword') : t('login.showPassword')}
            </button>
          </div>
        </label>
        <label className="field"><span>{t('login.confirmPasswordLabel')}</span>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {err && <p className="form-err">{err}</p>}
        <button className="btn-save" disabled={busy}>{busy ? '…' : t('login.setPasswordBtn')}</button>
      </form>
    </div>
  );
}
