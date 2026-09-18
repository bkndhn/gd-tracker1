import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to generate SVG string with customizable primary and glow colors
export function getAppLogoSvg(primary = '#7c3aed', primaryGlow = '#a78bfa', accent = '#06b6d4', size = 512) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="lsi-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d091a" />
      <stop offset="50%" stop-color="#140e2b" />
      <stop offset="100%" stop-color="#090514" />
    </linearGradient>

    <!-- Border Glow -->
    <linearGradient id="lsi-border" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryGlow}" stop-opacity="0.8" />
      <stop offset="50%" stop-color="${primary}" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.6" />
    </linearGradient>

    <!-- Facet 1: Warehouse Stock Base (Left Prism) -->
    <linearGradient id="facet-stock" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="${primaryGlow}" stop-opacity="1" />
    </linearGradient>

    <!-- Facet 2: Recovery Velocity (Right Arrow) -->
    <linearGradient id="facet-growth" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}" />
      <stop offset="50%" stop-color="${primaryGlow}" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>

    <!-- Facet 3: Lost Sales Discovery (Top Diamond) -->
    <linearGradient id="facet-insight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryGlow}" />
      <stop offset="100%" stop-color="${primary}" />
    </linearGradient>

    <!-- Glow Filter -->
    <filter id="lsi-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <radialGradient id="ambient-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.45" />
      <stop offset="60%" stop-color="${primary}" stop-opacity="0.15" />
      <stop offset="100%" stop-color="${primary}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Outer Rounded Squircle Canvas -->
  <rect x="16" y="16" width="480" height="480" rx="120" fill="url(#lsi-bg)" stroke="url(#lsi-border)" stroke-width="8" />

  <!-- Ambient Light Halo -->
  <circle cx="256" cy="256" r="210" fill="url(#ambient-glow)" />

  <!-- The Unified LSI Emblem (Fused Warehouse Stock Cube + Ascending Recovery Arrow + Insight Aperture) -->
  <g transform="translate(0, 0)">
    <!-- Isometric Cube Shadow / Base Plate -->
    <polygon points="256,380 376,310 376,334 256,404 136,334 136,310" fill="${primary}" opacity="0.25" />

    <!-- Left Facet: Stock Inventory Vault / Warehouse Foundation -->
    <path d="M 148 206 L 244 262 L 244 382 L 148 326 Z" fill="url(#facet-stock)" opacity="0.95" />
    
    <!-- Left Facet Inner Detail: Inventory shelves / stock levels -->
    <path d="M 164 242 L 228 278" stroke="#ffffff" stroke-width="3.5" stroke-opacity="0.4" stroke-linecap="round" />
    <path d="M 164 276 L 228 312" stroke="#ffffff" stroke-width="3.5" stroke-opacity="0.4" stroke-linecap="round" />
    <path d="M 164 310 L 228 346" stroke="#ffffff" stroke-width="3.5" stroke-opacity="0.4" stroke-linecap="round" />

    <!-- Right Facet: The Ascending Recovery Vector -->
    <path d="M 268 262 L 364 206 L 364 326 L 268 382 Z" fill="url(#facet-insight)" opacity="0.85" />
    
    <!-- Right Facet Inner Detail: Upward pulse trajectory -->
    <path d="M 284 346 L 348 310" stroke="${primaryGlow}" stroke-width="3.5" stroke-opacity="0.6" stroke-linecap="round" />
    <path d="M 284 312 L 348 276" stroke="${primaryGlow}" stroke-width="3.5" stroke-opacity="0.6" stroke-linecap="round" />

    <!-- Top Facet: Insight Radar Surface -->
    <path d="M 256 142 L 352 198 L 256 254 L 160 198 Z" fill="url(#facet-insight)" opacity="0.9" />

    <!-- Core Dynamic Breakthrough Arrow (Lost Sales Converted to Growth) -->
    <path d="M 216 280 L 256 216 L 336 136" stroke="#ffffff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" filter="url(#lsi-glow)" />
    <path d="M 216 280 L 256 216 L 336 136" stroke="url(#facet-growth)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
    
    <!-- Arrowhead -->
    <polygon points="360,112 308,124 332,148" fill="#ffffff" filter="url(#lsi-glow)" />
    <polygon points="360,112 308,124 332,148" fill="url(#facet-growth)" />

    <!-- Central Insight Node (Luminous Focal Eye) -->
    <circle cx="256" cy="216" r="16" fill="#ffffff" filter="url(#lsi-glow)" />
    <circle cx="256" cy="216" r="10" fill="${primary}" />
    <circle cx="256" cy="216" r="4" fill="#ffffff" />

    <!-- Subtle Radar Arc / Insight Horizon -->
    <path d="M 196 178 A 72 42 0 0 1 316 178" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 8" opacity="0.85" />
    <path d="M 176 168 A 96 56 0 0 1 336 168" fill="none" stroke="${primaryGlow}" stroke-width="2.5" stroke-linecap="round" opacity="0.6" />
  </g>
</svg>`;
}

async function buildAssets() {
  const { chromium } = await import('@playwright/test');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  const page = await browser.newPage();

  const svgContent = getAppLogoSvg('#7c3aed', '#a78bfa', '#06b6d4', 512);

  // Ensure public/lovable-uploads exists
  const uploadDir = path.join(rootDir, 'public', 'lovable-uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Write public/favicon.svg
  const svgPath = path.join(rootDir, 'public', 'favicon.svg');
  fs.writeFileSync(svgPath, svgContent, 'utf-8');
  console.log('Wrote public/favicon.svg');

  // Render PNGs at various sizes
  const sizes = [
    { size: 512, out: path.join(rootDir, 'public', 'icon-512.png') },
    { size: 192, out: path.join(rootDir, 'public', 'icon-192.png') },
    { size: 64, out: path.join(rootDir, 'public', 'favicon.png') },
    { size: 32, out: path.join(rootDir, 'public', 'favicon-32.png') },
    { size: 192, out: path.join(rootDir, 'public', 'lovable-uploads', 'd9731f6e-4026-4be4-aaf0-1a401d8ba7be.png') }
  ];

  for (const { size, out } of sizes) {
    const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;">
  ${getAppLogoSvg('#7c3aed', '#a78bfa', '#06b6d4', size)}
</body>
</html>`;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html);
    await page.screenshot({ path: out, omitBackground: true });
    console.log(`Generated ${path.basename(out)} (${size}x${size})`);
  }

  await browser.close();

  // Pack 32x32 png into standard favicon.ico
  const png32Buffer = fs.readFileSync(path.join(rootDir, 'public', 'favicon-32.png'));
  const icoHeader = Buffer.from([0, 0, 1, 0, 1, 0]);
  const icoEntry = Buffer.alloc(16);
  icoEntry.writeUInt8(32, 0); // width
  icoEntry.writeUInt8(32, 1); // height
  icoEntry.writeUInt8(0, 2);  // color palette
  icoEntry.writeUInt8(0, 3);  // reserved
  icoEntry.writeUInt16LE(1, 4); // color planes
  icoEntry.writeUInt16LE(32, 6); // bits per pixel
  icoEntry.writeUInt32LE(png32Buffer.length, 8); // image data size
  icoEntry.writeUInt32LE(22, 12); // image data offset (6 + 16)
  const icoBuffer = Buffer.concat([icoHeader, icoEntry, png32Buffer]);
  fs.writeFileSync(path.join(rootDir, 'public', 'favicon.ico'), icoBuffer);
  console.log('Generated favicon.ico (32x32)');

  console.log('All branding assets successfully created!');
}

buildAssets().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
