import type { ThemePalette } from '@/hooks/useClientTheme';

/**
 * Builds an SVG string of the Lost Sale Insights app logo
 * using the provided palette primary hex and glow tones.
 */
export function buildLogoSvgString(primaryHex: string, primaryGlowHex: string, accentHex = '#06b6d4'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="lsi-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c0818" />
      <stop offset="100%" stop-color="#171032" />
    </linearGradient>
    <linearGradient id="lsi-border" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryGlowHex}" stop-opacity="0.9" />
      <stop offset="60%" stop-color="${primaryHex}" stop-opacity="0.4" />
      <stop offset="100%" stop-color="${accentHex}" stop-opacity="0.75" />
    </linearGradient>
    <linearGradient id="facet-stock" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primaryHex}" stop-opacity="0.95" />
      <stop offset="100%" stop-color="${primaryGlowHex}" />
    </linearGradient>
    <linearGradient id="facet-growth" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentHex}" />
      <stop offset="50%" stop-color="${primaryGlowHex}" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
    <linearGradient id="facet-insight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryGlowHex}" />
      <stop offset="100%" stop-color="${primaryHex}" />
    </linearGradient>
    <radialGradient id="ambient-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${primaryHex}" stop-opacity="0.5" />
      <stop offset="60%" stop-color="${primaryHex}" stop-opacity="0.15" />
      <stop offset="100%" stop-color="${primaryHex}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="124" fill="url(#lsi-bg)" stroke="url(#lsi-border)" stroke-width="16" />
  <circle cx="256" cy="256" r="210" fill="url(#ambient-glow)" />
  <g>
    <polygon points="256,380 376,310 376,334 256,404 136,334 136,310" fill="${primaryHex}" opacity="0.3" />
    <path d="M 148 206 L 244 262 L 244 382 L 148 326 Z" fill="url(#facet-stock)" />
    <path d="M 164 242 L 228 278" stroke="#ffffff" stroke-width="4" stroke-opacity="0.5" stroke-linecap="round" />
    <path d="M 164 276 L 228 312" stroke="#ffffff" stroke-width="4" stroke-opacity="0.5" stroke-linecap="round" />
    <path d="M 164 310 L 228 346" stroke="#ffffff" stroke-width="4" stroke-opacity="0.5" stroke-linecap="round" />
    <path d="M 268 262 L 364 206 L 364 326 L 268 382 Z" fill="url(#facet-insight)" opacity="0.85" />
    <path d="M 284 346 L 348 310" stroke="${primaryGlowHex}" stroke-width="4" stroke-opacity="0.7" stroke-linecap="round" />
    <path d="M 284 312 L 348 276" stroke="${primaryGlowHex}" stroke-width="4" stroke-opacity="0.7" stroke-linecap="round" />
    <path d="M 256 142 L 352 198 L 256 254 L 160 198 Z" fill="url(#facet-insight)" opacity="0.9" />
    <path d="M 216 280 L 256 216 L 336 136" stroke="#ffffff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 216 280 L 256 216 L 336 136" stroke="url(#facet-growth)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
    <polygon points="360,112 308,124 332,148" fill="#ffffff" />
    <polygon points="360,112 308,124 332,148" fill="url(#facet-growth)" />
    <circle cx="256" cy="216" r="18" fill="#ffffff" />
    <circle cx="256" cy="216" r="11" fill="${primaryHex}" />
    <circle cx="256" cy="216" r="4.5" fill="#ffffff" />
    <path d="M 196 178 A 72 42 0 0 1 316 178" fill="none" stroke="${accentHex}" stroke-width="5" stroke-linecap="round" stroke-dasharray="7 9" opacity="0.9" />
    <path d="M 176 168 A 96 56 0 0 1 336 168" fill="none" stroke="${primaryGlowHex}" stroke-width="3.5" stroke-linecap="round" opacity="0.65" />
  </g>
</svg>`;
}

/**
 * Updates the browser favicon dynamically in real-time
 * so the browser tab icon always matches the active theme color!
 */
export function updateDynamicFavicon(palette: ThemePalette): void {
  try {
    if (typeof document === 'undefined') return;

    // Approximate glow hex from palette hslLight or hex
    const primaryHex = palette.hex || '#7c3aed';
    const glowHex = palette.hslDark?.glow
      ? `hsl(${palette.hslDark.glow})`
      : palette.hex;

    const svgString = buildLogoSvgString(primaryHex, glowHex);
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

    // Update or inject SVG favicon link
    let svgLink = document.querySelector('link[rel="icon"][type="image/svg+xml"]') as HTMLLinkElement | null;
    if (!svgLink) {
      svgLink = document.createElement('link');
      svgLink.rel = 'icon';
      svgLink.type = 'image/svg+xml';
      document.head.appendChild(svgLink);
    }
    svgLink.href = dataUri;

    // Also update any generic favicon link if present
    const standardLink = document.querySelector('link[rel="icon"]:not([type="image/svg+xml"])') as HTMLLinkElement | null;
    if (standardLink) {
      standardLink.href = dataUri;
    }
  } catch (err) {
    // Fail gracefully without interrupting UI
    console.debug('Dynamic favicon update skipped:', err);
  }
}
