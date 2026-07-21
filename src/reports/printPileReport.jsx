import { renderToStaticMarkup } from 'react-dom/server';
import PileReport from './PileReport';
import PhotoReportPage from './PhotoReportPage';
import reportCss from './report.css?raw';

const PHOTOS_PER_PAGE = 4;

// Purely additive on top of report.css (which stays untouched — the base,
// no-photos case renders exactly as before). Doesn't touch the `body`/`.page`
// rules report.css itself defines; instead a new `.report-pages` wrapper
// (only present when photos are attached) takes over the centering/stacking
// so page 1's own markup and styling stay byte-for-byte identical either way.
const PHOTO_PAGES_CSS = `
.report-pages{display:flex; flex-direction:column; align-items:center}
.photo-page{margin-top:24px}
.photo-grid{display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:14px; padding:16px 4px}
.photo-cell{border:1px solid var(--line); border-radius:4px; padding:8px; display:flex; flex-direction:column; gap:6px}
.photo-cell img{width:100%; height:280px; object-fit:cover; border-radius:2px}
.photo-cell figcaption{font-size:9px; color:var(--muted); text-align:center}
@media print{
  .photo-page{page-break-before:always; margin-top:0}
}
`;

function renderPhotoPages(photos) {
  if (!photos || photos.length === 0) return '';
  const chunks = [];
  for (let i = 0; i < photos.length; i += PHOTOS_PER_PAGE) chunks.push(photos.slice(i, i + PHOTOS_PER_PAGE));
  return chunks.map((chunk, i) => renderToStaticMarkup(
    <PhotoReportPage photos={chunk} pageNo={i + 1} pageCount={chunks.length} />,
  )).join('');
}

// Renders PileReport to static markup in a new window and triggers the browser
// print dialog — no PDF library, so Thai text and the mockup's exact CSS survive.
export function printPileReport({ photos, ...props }) {
  const reportHtml = renderToStaticMarkup(<PileReport {...props} />);
  const bodyHtml = photos?.length
    ? `<div class="report-pages">${reportHtml}${renderPhotoPages(photos)}</div>`
    : reportHtml;
  const win = window.open('', '_blank');
  if (!win) {
    window.alert('Popup blocked — allow popups for this site to print the report. · ป็อปอัปถูกบล็อก กรุณาอนุญาตเพื่อพิมพ์รายงาน');
    return;
  }

  const extraStyleTag = photos?.length ? `<style>${PHOTO_PAGES_CSS}</style>` : '';
  win.document.write(`<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>As-Built Pile Report — ${props.pile?.pile_no ?? ''}</title>
<style>${reportCss}</style>${extraStyleTag}
</head>
<body>${bodyHtml}</body>
</html>`);
  win.document.close();

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
  };
  // Google Fonts load over the network; wait for them so the print preview matches
  // the mockup, but cap the wait since fonts.ready can hang while offline (the app
  // is a PWA and this dialog must still work without a connection).
  win.document.fonts?.ready.then(doPrint).catch(doPrint);
  setTimeout(doPrint, 1200);
}
