import { supabase } from './supabase';

const BUCKET = 'record-photos';
const MAX_DIM = 1600;
const JPEG_QUALITY = 0.8;

export const PHOTO_TYPES = [
  { value: 'pile', label: 'เข็ม Pile' },
  { value: 'ts_screen', label: 'จอกล้อง TS screen' },
  { value: 'other', label: 'อื่นๆ Other' },
];

// Canvas-based resize + re-encode, no dependency. Kept separate from the
// network calls below so a phase-2 offline queue can compress up front and
// store the blob locally, then call uploadPhoto() later once online.
export async function compressPhoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('compress failed'))), 'image/jpeg', JPEG_QUALITY);
  });
}

// Uploads an already-compressed blob and inserts its record_photos row.
// `photoId`, when passed (offline sync retries), becomes both the storage
// object name and the record_photos row id, and the writes become upserts —
// so re-running this after a partial failure overwrites the same rows
// instead of duplicating them.
export async function uploadPhoto({ recordId, blob, photoType, photoId }) {
  const id = photoId ?? crypto.randomUUID();
  const path = `${recordId}/${id}.jpg`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from('record_photos')
    .upsert({ id, record_id: recordId, storage_path: path, photo_type: photoType })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deletePhoto(photo) {
  await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  const { error } = await supabase.from('record_photos').delete().eq('id', photo.id);
  if (error) throw error;
}

export function photoUrl(storagePath) {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

// Fetches a record's photos plus each uploader's email (record_photos.created_by
// references auth.users, not profiles, so PostgREST can't embed it — resolved
// with a second lightweight query against the public-read profiles table).
export async function fetchPhotos(recordId) {
  const { data, error } = await supabase.from('record_photos')
    .select('id, storage_path, photo_type, created_at, created_by')
    .eq('record_id', recordId)
    .order('created_at');
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.created_by))];
  if (ids.length === 0) return rows;
  const { data: profs } = await supabase.from('profiles').select('id, email').in('id', ids);
  const emailById = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email]));
  return rows.map((r) => ({ ...r, uploader_email: emailById[r.created_by] ?? null }));
}
