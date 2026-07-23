import { useCallback, useEffect, useRef, useState } from 'react';

const INTERVAL_MS = 60000;

/**
 * Runs `fetchFn` once immediately (and again whenever its identity changes —
 * e.g. a filter it closes over), then every 60s while the tab is visible and
 * online. Skips a tick while offline or `paused`; resumes with an immediate
 * refresh when the tab regains visibility. A rising `version` (e.g. from a
 * global "refresh all" button) also triggers a refresh, skipped/paused under
 * the same guards. `onStart`/`onEnd(success)` report activity to a shared
 * indicator (e.g. the top-bar refresh button + timestamp).
 */
export function useAutoRefresh(fetchFn, { paused = false, version, onStart, onEnd } = {}) {
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const run = useCallback(async (isInitial) => {
    if (isInitial) setLoading(true);
    onStartRef.current?.();
    let ok = false;
    try {
      await fetchRef.current();
      ok = true;
    } finally {
      if (isInitial) setLoading(false);
      onEndRef.current?.(ok);
    }
  }, []);

  const guardedRefresh = useCallback(() => {
    if (pausedRef.current || !navigator.onLine || document.visibilityState !== 'visible') return;
    run(false);
  }, [run]);

  useEffect(() => {
    run(true);
    const id = setInterval(guardedRefresh, INTERVAL_MS);
    document.addEventListener('visibilitychange', guardedRefresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', guardedRefresh);
    };
  }, [fetchFn, run, guardedRefresh]);

  // Skips the version's initial value so mounting doesn't double-fetch.
  const skipNextVersionRef = useRef(true);
  useEffect(() => {
    if (skipNextVersionRef.current) { skipNextVersionRef.current = false; return; }
    if (version === undefined || pausedRef.current) return;
    run(false);
  }, [version, run]);

  return { loading };
}
