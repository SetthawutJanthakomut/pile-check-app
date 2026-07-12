import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(outDir, { recursive: true });

const NAVY = '#0f1d2b';
const ORANGE = '#e8590c';

// Crosshair/target mark (matches the "⌖" topbar brand-mark), as an SVG group
// centered at (0,0) with the given radius for the circle.
function crosshairMark(r, strokeWidth) {
  const tick = r * 0.55;
  return `
    <g stroke="${ORANGE}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round">
      <circle cx="0" cy="0" r="${r}" />
      <line x1="0" y1="${-(r + tick)}" x2="0" y2="${-(r - tick * 0.35)}" />
      <line x1="0" y1="${r + tick}" x2="0" y2="${r - tick * 0.35}" />
      <line x1="${-(r + tick)}" y1="0" x2="${-(r - tick * 0.35)}" y2="0" />
      <line x1="${r + tick}" y1="0" x2="${r - tick * 0.35}" y2="0" />
      <circle cx="0" cy="0" r="${strokeWidth * 0.9}" fill="${ORANGE}" stroke="none" />
    </g>
  `;
}

// Standard icon: rounded-square navy background, mark sized generously.
function standardSvg(size) {
  const r = size * 0.28;
  const sw = size * 0.045;
  const corner = size * 0.22;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${corner}" fill="${NAVY}" />
      <g transform="translate(${size / 2}, ${size / 2})">
        ${crosshairMark(r, sw)}
      </g>
    </svg>
  `;
}

// Maskable icon: full-bleed square background (OS applies its own mask shape),
// mark kept within the ~80% safe-zone circle.
function maskableSvg(size) {
  const r = size * 0.2;
  const sw = size * 0.035;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${NAVY}" />
      <g transform="translate(${size / 2}, ${size / 2})">
        ${crosshairMark(r, sw)}
      </g>
    </svg>
  `;
}

const targets = [
  { name: 'icon-192.png', svg: standardSvg(192) },
  { name: 'icon-512.png', svg: standardSvg(512) },
  { name: 'icon-512-maskable.png', svg: maskableSvg(512) },
];

for (const { name, svg } of targets) {
  const outPath = path.join(outDir, name);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log('wrote', outPath);
}
