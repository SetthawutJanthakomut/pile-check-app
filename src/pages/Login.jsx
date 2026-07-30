import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

export default function Login({ onClose }) {
  const { t } = useTranslation();
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
      setNotice(t('login.resetLinkSent'));
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
    else if (mode === 'signup') setNotice(t('login.signupNotice'));
    else onClose?.();
  }

  return (
    <div className="login-card">
      <div className="brand">
        <span className="brand-mark">⌖</span>
        <h1>{t('common.app.brand')}</h1>
        <p>{t('login.tagline')}</p>
      </div>
      <form onSubmit={submit}>
        <label className="field"><span>{t('login.emailLabel')}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== 'reset' && (
          <>
            <label className="field"><span>{t('login.passwordLabel')}</span>
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
            {mode === 'signin' && (
              <button type="button" className="link" onClick={() => switchMode('reset')}>
                {t('login.forgotPassword')}
              </button>
            )}
          </>
        )}
        {err && <p className="form-err">{err}</p>}
        {notice && <p className="hint">{notice}</p>}
        <button className="btn-save" disabled={busy}>
          {busy ? '…' : mode === 'signin' ? t('login.signInBtn') : mode === 'signup' ? t('login.createAccountBtn') : t('login.sendResetBtn')}
        </button>
      </form>
      {mode === 'reset' ? (
        <button className="link" onClick={() => switchMode('signin')}>
          {t('login.backToSignIn')}
        </button>
      ) : (
        <button className="link" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? t('login.newUserPrompt') : t('login.haveAccountPrompt')}
        </button>
      )}
      <button className="link" onClick={onClose}>{t('login.close')}</button>
    </div>
  );
}
