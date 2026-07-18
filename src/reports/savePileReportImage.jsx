import { renderToStaticMarkup } from 'react-dom/server';
import { toPng } from 'html-to-image';
import PileReport from './PileReport';
import reportCss from './report.css?raw';

const PAGE_WIDTH_PX = 794; // A4 width at 96dpi, matches report.css's `.page { width:210mm }`

function sanitizeForFilename(s) {
  return String(s ?? 'record').replace(/[^a-zA-Z0-9-]+/g, '_');
}

// Renders the SAME PileReport markup used for printing into a hidden same-origin
// iframe — its own document, so report.css's generic class names (.page, .grid,
// .band, ...) never collide with the app's own CSS — then rasterizes it with
// html-to-image and triggers a download.
export async function savePileReportImage(props) {
  const bodyHtml = renderToStaticMarkup(<PileReport {...props} />);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = `${PAGE_WIDTH_PX}px`;
  iframe.style.height = '1200px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(`<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<style>${reportCss}</style>
</head>
<body>${bodyHtml}</body>
</html>`);
    doc.close();

    // Same cap as printPileReport: fonts.ready can hang while offline.
    await Promise.race([
      (doc.fonts?.ready ?? Promise.resolve()).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);

    const node = doc.body.querySelector('.page');
    const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' });

    const { record, pile } = props;
    const date = record.measured_at ?? new Date().toISOString().slice(0, 10);
    const filename = `PileReport_${sanitizeForFilename(pile.pile_no)}_${sanitizeForFilename(record.pile_stage)}_${date}.png`;

    if ('download' in document.createElement('a')) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      // Some mobile browsers ignore the download attribute — open the PNG directly
      // so the user can long-press-save it instead.
      window.open(dataUrl, '_blank');
    }
  } finally {
    iframe.remove();
  }
}
