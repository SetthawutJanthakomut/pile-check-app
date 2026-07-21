import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { localdb } from '../lib/localdb';
import { fetchPhotos, photoUrl, PHOTO_TYPES } from '../lib/photos';

function typeLabel(v) {
  return PHOTO_TYPES.find((t) => t.value === v)?.label ?? v;
}

// Read-only: thumbnail strip + lightbox for a saved record's photos. Adding
// or removing photos happens only in the Form's edit mode. `pending` marks a
// record that's still in the offline queue — its photos live as blobs in
// Dexie (not yet uploaded), so they're read from there instead of the network.
export default function PhotoStrip({ recordId, pending }) {
  const [photos, setPhotos] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    if (pending) return;
    let cancelled = false;
    if (!recordId) { setPhotos([]); return; }
    fetchPhotos(recordId).then((rows) => { if (!cancelled) setPhotos(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [recordId, pending]);

  useEffect(() => {
    if (!pending || !recordId) return;
    let urls = [];
    const sub = liveQuery(() => localdb.pending_photos.where('recordUuid').equals(recordId).toArray())
      .subscribe({
        next: (rows) => {
          urls.forEach((u) => URL.revokeObjectURL(u));
          urls = rows.map((r) => URL.createObjectURL(r.blob));
          setPhotos(rows.map((r, i) => ({
            id: r.uuid, storage_path: null, photo_type: r.photoType,
            created_at: r.createdAt, uploader_email: null, _localUrl: urls[i],
          })));
        },
      });
    return () => {
      sub.unsubscribe();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [pending, recordId]);

  if (photos.length === 0) return null;

  return (
    <div className="photo-strip">
      {pending && <span className="pending-badge">⏳ pending sync · รอซิงค์</span>}
      {photos.map((p, i) => (
        <button key={p.id} type="button" className="photo-strip-thumb" onClick={() => setLightboxIndex(i)}>
          <img src={p._localUrl ?? photoUrl(p.storage_path)} alt="" />
        </button>
      ))}
      {lightboxIndex != null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onChangeIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function Lightbox({ photos, index, onChangeIndex, onClose }) {
  const photo = photos[index];
  const touchX = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onChangeIndex((index - 1 + photos.length) % photos.length);
      else if (e.key === 'ArrowRight') onChangeIndex((index + 1) % photos.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onChangeIndex, onClose]);

  function handleTouchStart(e) { touchX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 40) return;
    onChangeIndex(dx > 0 ? (index - 1 + photos.length) % photos.length : (index + 1) % photos.length);
  }

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div
        className="lightbox-panel"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button type="button" className="lightbox-close" onClick={onClose}>✕</button>
        {photos.length > 1 && (
          <button type="button" className="lightbox-nav lightbox-prev"
            onClick={() => onChangeIndex((index - 1 + photos.length) % photos.length)}>‹</button>
        )}
        <img className="lightbox-img" src={photo._localUrl ?? photoUrl(photo.storage_path)} alt="" />
        {photos.length > 1 && (
          <button type="button" className="lightbox-nav lightbox-next"
            onClick={() => onChangeIndex((index + 1) % photos.length)}>›</button>
        )}
        <div className="lightbox-caption">
          {typeLabel(photo.photo_type)} · {photo.created_at ? new Date(photo.created_at).toLocaleString() : '—'} · {photo.uploader_email ?? '—'}
        </div>
      </div>
    </div>
  );
}
