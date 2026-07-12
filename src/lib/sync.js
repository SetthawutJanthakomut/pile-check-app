import { localdb } from './localdb';
import { supabase } from './supabase';

export function isNetworkError(err) {
  if (!err) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = String(err.message || err);
  return /fetch|network/i.test(msg);
}

export async function queueRecord(item) {
  await localdb.pending_records.put(item);
}

// Idempotent: uses the client-generated uuid as the row id (upsert), so a
// retry after a partial failure re-writes the same rows instead of duplicating.
export async function pushOne(item) {
  if (item.newStation) {
    const { error } = await supabase.from('benchmarks').upsert(item.newStation);
    if (error) throw error;
  }
  const { error: recErr } = await supabase.from('asbuilt_records').upsert({ id: item.uuid, ...item.record });
  if (recErr) throw recErr;
  const { error: ptErr } = await supabase.from('survey_points')
    .upsert(item.points.map((p) => ({ ...p, record_id: item.uuid })), { onConflict: 'record_id,point_no' });
  if (ptErr) throw ptErr;
}

// Pushes queued records one by one, removing each on success. Stops as soon
// as a network error is hit (assume still offline); other errors are logged
// and that record stays queued while the rest are attempted.
export async function syncPending() {
  const items = await localdb.pending_records.toArray();
  let synced = 0;
  for (const item of items) {
    try {
      await pushOne(item);
      await localdb.pending_records.delete(item.uuid);
      synced++;
    } catch (err) {
      if (isNetworkError(err)) break;
      console.error('Sync failed for record', item.uuid, err);
    }
  }
  return synced;
}
