import { photoUrl, PHOTO_TYPES } from '../lib/photos';

function typeLabel(v) {
  return PHOTO_TYPES.find((t) => t.value === v)?.label ?? v;
}

function fmtCaption(photo) {
  const when = photo.created_at ? new Date(photo.created_at).toLocaleString() : '—';
  return `${typeLabel(photo.photo_type)} · ${when} · ${photo.uploader_email ?? '—'}`;
}

// One 2x2 grid of photos per page. Chunked (rather than a single fixed grid)
// so records with more than 4 photos — the form allows up to 6 — still get
// every photo printed instead of silently dropping the rest.
export default function PhotoReportPage({ photos, pageNo, pageCount }) {
  return (
    <div className="page photo-page">
      <header>
        <div>
          <h1><span className="mark">⌖</span> AS-BUILT PILE REPORT — PHOTOS · รูปแนบ</h1>
        </div>
        <div className="meta">Photo page {pageNo} / {pageCount}</div>
      </header>
      <div className="photo-grid">
        {photos.map((p) => (
          <figure key={p.id} className="photo-cell">
            <img src={photoUrl(p.storage_path)} alt="" />
            <figcaption>{fmtCaption(p)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
