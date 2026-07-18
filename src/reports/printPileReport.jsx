import { renderToStaticMarkup } from 'react-dom/server';
import PileReport from './PileReport';
import reportCss from './report.css?raw';

// Renders PileReport to static markup in a new window and triggers the browser
// print dialog — no PDF library, so Thai text and the mockup's exact CSS survive.
export function printPileReport(props) {
  const bodyHtml = renderToStaticMarkup(<PileReport {...props} />);
  const win = window.open('', '_blank');
  if (!win) {
    window.alert('Popup blocked — allow popups for this site to print the report. · ป็อปอัปถูกบล็อก กรุณาอนุญาตเพื่อพิมพ์รายงาน');
    return;
  }

  win.document.write(`<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>As-Built Pile Report — ${props.pile?.pile_no ?? ''}</title>
<style>${reportCss}</style>
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
