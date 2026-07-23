import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const DataRefreshContext = createContext(null);

// App-wide "refresh all data pages" coordination. `version` is bumped by the
// top-bar button; every page's useAutoRefresh watches it and refetches.
// `reportStart`/`reportEnd` let each page contribute to the shared
// refreshing/lastUpdated indicators (also fed by each page's own 60s tick).
export function DataRefreshProvider({ children }) {
  const [version, setVersion] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeCount, setActiveCount] = useState(0);
  const [offlineHint, setOfflineHint] = useState(false);

  const bump = useCallback(() => {
    if (!navigator.onLine) {
      setOfflineHint(true);
      setTimeout(() => setOfflineHint(false), 2500);
      return;
    }
    setVersion((v) => v + 1);
  }, []);

  const reportStart = useCallback(() => setActiveCount((c) => c + 1), []);
  const reportEnd = useCallback((success) => {
    setActiveCount((c) => Math.max(0, c - 1));
    if (success) setLastUpdated(new Date());
  }, []);

  const value = useMemo(
    () => ({ version, lastUpdated, refreshing: activeCount > 0, offlineHint, bump, reportStart, reportEnd }),
    [version, lastUpdated, activeCount, offlineHint, bump, reportStart, reportEnd],
  );

  return <DataRefreshContext.Provider value={value}>{children}</DataRefreshContext.Provider>;
}

export function useDataRefresh() {
  const ctx = useContext(DataRefreshContext);
  if (!ctx) throw new Error('useDataRefresh must be used within DataRefreshProvider');
  return ctx;
}
