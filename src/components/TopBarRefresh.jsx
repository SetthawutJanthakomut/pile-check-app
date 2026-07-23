import { useTranslation } from 'react-i18next';
import { useDataRefresh } from '../lib/dataRefresh';

function formatHM(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Global "refresh all data pages" control, shown in the top bar next to
// Sign in / the user email so it's reachable from every page.
export default function TopBarRefresh() {
  const { t } = useTranslation();
  const { lastUpdated, refreshing, offlineHint, bump } = useDataRefresh();
  return (
    <span className="topbar-refresh">
      <button type="button" className="link" disabled={refreshing} onClick={bump}>
        {refreshing ? '⏳' : '🔄'} {t('common.topbar.refresh')}
      </button>
      {offlineHint ? (
        <span className="topbar-refresh-time topbar-refresh-offline">{t('common.topbar.offline')}</span>
      ) : lastUpdated ? (
        <span className="topbar-refresh-time">{t('common.topbar.updatedAt', { time: formatHM(lastUpdated) })}</span>
      ) : null}
    </span>
  );
}
