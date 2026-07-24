import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { useTranslation } from 'react-i18next';
import { supabase } from './lib/supabase';
import { localdb } from './lib/localdb';
import { syncPending } from './lib/sync';
import Login from './pages/Login';
import SetNewPassword from './pages/SetNewPassword';
import FormPage from './pages/FormPage';
import PilesTable from './pages/PilesTable';
import BenchmarksTable from './pages/BenchmarksTable';
import RecordsTable from './pages/RecordsTable';
import PlanView from './pages/PlanView';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import HistoryPage from './pages/HistoryPage';
import TopBarRefresh from './components/TopBarRefresh';
import { DataRefreshProvider } from './lib/dataRefresh';

const PAGES = [
  { key: 'form', labelKey: 'nav.form' },
  { key: 'plan', labelKey: 'nav.plan' },
  { key: 'piles', labelKey: 'nav.designPiles' },
  { key: 'benchmarks', labelKey: 'nav.benchmarks' },
  { key: 'records', labelKey: 'nav.records' },
  { key: 'settings', labelKey: 'nav.settings', adminOnly: true },
  { key: 'users', labelKey: 'nav.users', adminOnly: true },
  { key: 'history', labelKey: 'nav.history', adminOnly: true },
];

// Compact TH/EN toggle shown in the top bar, next to the user email / Sign
// out / Refresh controls — persists the choice via i18n.js's localStorage sync.
function LangToggle() {
  const { i18n } = useTranslation();
  return (
    <span className="lang-toggle">
      <button
        type="button"
        className={i18n.resolvedLanguage === 'th' ? 'active' : ''}
        onClick={() => i18n.changeLanguage('th')}
      >
        TH
      </button>
      {' / '}
      <button
        type="button"
        className={i18n.resolvedLanguage === 'en' ? 'active' : ''}
        onClick={() => i18n.changeLanguage('en')}
      >
        EN
      </button>
    </span>
  );
}

export default function App() {
  return (
    <DataRefreshProvider>
      <AppInner />
    </DataRefreshProvider>
  );
}

function AppInner() {
  const { t } = useTranslation();
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState(null);
  const [page, setPage] = useState('form');
  const [showLogin, setShowLogin] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
  const [syncedToast, setSyncedToast] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [pwUpdatedToast, setPwUpdatedToast] = useState(false);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setShowSetPassword(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = liveQuery(() => localdb.pending_records.count()).subscribe({ next: setPendingCount });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = liveQuery(() => localdb.pending_photos.count()).subscribe({ next: setPendingPhotoCount });
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

  useEffect(() => {
    if (role !== 'admin') { setPendingUsersCount(0); return; }
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count }) => setPendingUsersCount(count ?? 0));
  }, [role]);

  if (session === undefined) return null;

  if (showSetPassword) {
    return (
      <div className="modal-backdrop">
        <SetNewPassword
          onDone={() => {
            setShowSetPassword(false);
            setPwUpdatedToast(true);
            setTimeout(() => setPwUpdatedToast(false), 4000);
          }}
        />
      </div>
    );
  }

  if (session && status === 'pending') {
    return (
      <div className="modal-backdrop">
        <div className="login-card">
          <div className="brand">
            <span className="brand-mark">⌖</span>
            <h1>{t('common.app.brand')}</h1>
          </div>
          <p className="hint" style={{ textAlign: 'center', fontSize: 15 }}>
            {t('common.app.pendingApproval')}
          </p>
          <p className="hint" style={{ textAlign: 'center', fontSize: 13 }}>
            {t('common.app.pendingApprovalContact')}
          </p>
          <button className="btn-save" onClick={() => supabase.auth.signOut()}>{t('common.app.signOut')}</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <span className="brand-mark">⌖</span>
        <strong>{t('common.app.brand')}</strong>
        <a
          className="link topbar-link-icon"
          href="/methodology.html"
          target="_blank"
          rel="noopener"
          title={t('nav.methodology')}
          aria-label={t('nav.methodology')}
        >
          <span className="topbar-mobile-icon" aria-hidden="true">📖</span>
          <span className="topbar-label">{t('nav.methodology')}</span>
        </a>
        <span className="topbar-user">
          {session ? `${session.user.email} · ${role ?? '…'}` : ''}
        </span>
        {(pendingCount > 0 || pendingPhotoCount > 0) && (
          <span className="pending-indicator">
            ⏳ {t('common.app.pendingRecords', { count: pendingCount })}{pendingPhotoCount > 0 ? ` · ${t('common.app.pendingPhotos', { count: pendingPhotoCount })}` : ''} · {t('common.app.waitingSync')}
          </span>
        )}
        <TopBarRefresh />
        <LangToggle />
        {session ? (
          <button
            className="link topbar-link-icon"
            onClick={() => supabase.auth.signOut()}
            title={t('common.app.signOut')}
            aria-label={t('common.app.signOut')}
          >
            <span className="topbar-mobile-icon" aria-hidden="true">⏻</span>
            <span className="topbar-label">{t('common.app.signOut')}</span>
          </button>
        ) : (
          <button className="link" onClick={() => setShowLogin(true)}>{t('common.app.signIn')}</button>
        )}
      </header>
      <nav className="subnav">
        {PAGES.filter((p) => !p.adminOnly || role === 'admin').map((p) => (
          <button
            key={p.key}
            className={page === p.key ? 'active' : ''}
            onClick={() => setPage(p.key)}
          >
            {t(p.labelKey)}
            {p.key === 'users' && pendingUsersCount > 0 && (
              <span className="nav-badge">{pendingUsersCount}</span>
            )}
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
      <div style={{ display: page === 'plan' ? '' : 'none' }}>
        <PlanView
          session={session}
          role={role}
          onEdit={(record) => { setEditRecord(record); setPage('form'); }}
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
      {role === 'admin' && (
        <div style={{ display: page === 'history' ? '' : 'none' }}><HistoryPage /></div>
      )}
      {showLogin && (
        <div className="modal-backdrop" onClick={() => setShowLogin(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Login onClose={() => setShowLogin(false)} />
          </div>
        </div>
      )}
      {syncedToast && <div className="toast ok">{t('common.app.toastSynced')}</div>}
      {pwUpdatedToast && <div className="toast ok">{t('common.app.toastPasswordUpdated')}</div>}
    </>
  );
}
