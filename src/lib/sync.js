import { localdb } from './localdb';
import { supabase } from './supabase';
import { uploadPhoto } from './photos';

export function isNetworkError(err) {
  if (!err) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = String(err.message || err);
  return /fetch|network/i.test(msg);
}

export async function queueRecord(item) {
  await localdb.pending_records.put(item);
}

// Stores a queued record's compressed photo blobs, keyed to the record's
// client uuid, so they can be uploaded once the record itself has synced.
export async function queuePhotos(recordUuid, photos) {
  await localdb.pending_photos.bulkAdd(photos.map((p) => ({
    uuid: p.tempId,
    recordUuid,
    blob: p.blob,
    photoType: p.photoType,
    createdAt: new Date().toISOString(),
  })));
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

// Uploads whatever pending_photos are still queued for one already-synced
// record. Each photo is independent: a bad one is logged and left queued for
// the next sync instead of blocking its siblings. Stops early on a network
// error since the rest would fail the same way while still offline.
export async function syncPendingPhotos(recordUuid) {
  const photos = await localdb.pending_photos.where('recordUuid').equals(recordUuid).toArray();
  for (const p of photos) {
    try {
      await uploadPhoto({ recordId: recordUuid, blob: p.blob, photoType: p.photoType, photoId: p.uuid });
      await localdb.pending_photos.delete(p.uuid);
    } catch (err) {
      if (isNetworkError(err)) return;
      console.error('Photo sync failed', p.uuid, err);
    }
  }
}

// Pushes queued records one by one, removing each on success. Stops as soon
// as a network error is hit (assume still offline); other errors are logged
// and that record stays queued while the rest are attempted.
export async function syncPending() {
  const items = await localdb.pending_records.toArray();
  const queuedIds = new Set(items.map((i) => i.uuid));

  // Photos whose record finished syncing in an earlier, interrupted run
  // (the record's gone from pending_records, but its photos are still here).
  const allPhotos = await localdb.pending_photos.toArray();
  const orphanRecordIds = [...new Set(allPhotos.map((p) => p.recordUuid))].filter((id) => !queuedIds.has(id));
  for (const id of orphanRecordIds) await syncPendingPhotos(id);

  let synced = 0;
  for (const item of items) {
    try {
      await pushOne(item);
      await localdb.pending_records.delete(item.uuid);
      synced++;
      await syncPendingPhotos(item.uuid);
    } catch (err) {
      if (isNetworkError(err)) break;
      console.error('Sync failed for record', item.uuid, err);
    }
  }
  return synced;
}
