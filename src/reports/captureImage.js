import { toPng } from 'html-to-image';

export function sanitizeForFilename(s) {
  return String(s ?? 'record').replace(/[^a-zA-Z0-9-]+/g, '_');
}

const PIXEL_RATIO = 2;

// Draws a captured PNG onto a larger canvas: a uniform `paddingPx` border on
// all sides, plus an optional centered footer line beneath the content —
// both applied only to the exported PNG, never the on-screen node.
function frameImage(dataUrl, { paddingPx, background, footerText }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const footerFontPx = 12 * PIXEL_RATIO;
      const footerHeight = footerText ? Math.round(footerFontPx * 2.2) : 0;
      const canvas = document.createElement('canvas');
      canvas.width = img.width + paddingPx * 2;
      canvas.height = img.height + paddingPx * 2 + footerHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, paddingPx, paddingPx);
      if (footerText) {
        ctx.fillStyle = '#46586b';
        ctx.font = `${footerFontPx}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(footerText, canvas.width / 2, img.height + paddingPx * 2 + footerHeight / 2);
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Rasterizes a DOM node to a PNG (2x pixel ratio) and triggers a download.
// Some mobile browsers ignore the <a download> attribute — falls back to
// opening the PNG in a new tab so the user can long-press-save it instead.
// `padding` (css px) and `footerText` are applied to the exported PNG only —
// the on-screen node is never touched.
export async function captureNodeAsPng(node, filename, { padding = 0, background = '#ffffff', footerText } = {}) {
  const dataUrl = await toPng(node, { pixelRatio: PIXEL_RATIO, backgroundColor: background });
  const finalUrl = (padding > 0 || footerText)
    ? await frameImage(dataUrl, { paddingPx: padding * PIXEL_RATIO, background, footerText })
    : dataUrl;

  if ('download' in document.createElement('a')) {
    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(finalUrl, '_blank');
  }
}
