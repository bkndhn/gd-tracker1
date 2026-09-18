import React from 'react';
import { cn } from '@/lib/utils';

export interface AppLogoProps {
  /** Variant of the logo display */
  variant?: 'icon' | 'full' | 'compact' | 'badge' | 'search-badge';
  /** Preset size of the emblem */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'splash';
  /** Explicit pixel size override */
  pixelSize?: number;
  /** Whether to show a pulse/halo glow animation */
  animated?: boolean;
  /** Whether to render title typography alongside icon (when variant is full or compact) */
  showText?: boolean;
  /** Optional subtitle or description under the title */
  subtitle?: string;
  /** Custom badge text (defaults to 'LSI') */
  badgeText?: string;
  /** Additional container styling */
  className?: string;
  /** Optional click handler */
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: { box: 18, radius: 4 },
  sm: { box: 24, radius: 6 },
  md: { box: 34, radius: 9 },
  lg: { box: 48, radius: 13 },
  xl: { box: 64, radius: 17 },
  splash: { box: 96, radius: 26 },
};

export const AppLogo: React.FC<AppLogoProps> = ({
  variant = 'icon',
  size = 'md',
  pixelSize,
  animated = false,
  showText = false,
  subtitle,
  badgeText = 'LSI',
  className,
  onClick,
}) => {
  const currentSize = pixelSize || SIZE_MAP[size].box;
  const cornerRadius = Math.round(currentSize * 0.26);

  // SVG Unique IDs to prevent collision across multiple instances
  const idPrefix = React.useId().replace(/:/g, '');
  const bgGradId = `${idPrefix}-bg`;
  const borderGradId = `${idPrefix}-border`;
  const stockGradId = `${idPrefix}-stock`;
  const growthGradId = `${idPrefix}-growth`;
  const insightGradId = `${idPrefix}-insight`;
  const haloGradId = `${idPrefix}-halo`;

  const emblem = (
    <div
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 select-none',
        animated && 'group'
      )}
      style={{ width: currentSize, height: currentSize }}
    >
      {/* Animated ambient pulsing glow for splash/hero variants */}
      {animated && (
        <div
          className="absolute inset-0 rounded-2xl bg-primary/25 blur-xl animate-pulse -z-10 scale-125"
          aria-hidden="true"
        />
      )}

      <svg
        viewBox="0 0 512 512"
        width={currentSize}
        height={currentSize}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
        role="img"
        aria-label="Lost Sale Insights Emblem"
      >
        <defs>
          {/* Background dynamic squircle */}
          <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--card))" />
            <stop offset="100%" stopColor="hsl(var(--background))" />
          </linearGradient>

          {/* Glowing Border using active theme primary and glow */}
          <linearGradient id={borderGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary-glow, var(--primary)))" stopOpacity="0.9" />
            <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--accent, var(--primary)))" stopOpacity="0.75" />
          </linearGradient>

          {/* Left Facet: Stock Inventory Vault / Warehouse Foundation */}
          <linearGradient id={stockGradId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(var(--primary-glow, var(--primary)))" />
          </linearGradient>

          {/* Right Facet: The Ascending Recovery Vector */}
          <linearGradient id={growthGradId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--accent, 180 85% 55%))" />
            <stop offset="50%" stopColor="hsl(var(--primary-glow, var(--primary)))" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          {/* Top Facet: Insight Radar Surface */}
          <linearGradient id={insightGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary-glow, var(--primary)))" />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
          </linearGradient>

          {/* Ambient center aura */}
          <radialGradient id={haloGradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Squircle container badge */}
        <rect
          x="16"
          y="16"
          width="480"
          height="480"
          rx="124"
          fill={`url(#${bgGradId})`}
          stroke={`url(#${borderGradId})`}
          strokeWidth="16"
        />

        {/* Ambient Halo */}
        <circle cx="256" cy="256" r="210" fill={`url(#${haloGradId})`} />

        {/* Unified Isometric Mark */}
        <g>
          {/* Base shadow plate */}
          <polygon
            points="256,380 376,310 376,334 256,404 136,334 136,310"
            fill="hsl(var(--primary))"
            opacity="0.3"
          />

          {/* Left Facet: Stock Inventory Vault / Warehouse Foundation */}
          <path d="M 148 206 L 244 262 L 244 382 L 148 326 Z" fill={`url(#${stockGradId})`} />
          
          {/* Stock inventory level shelves */}
          <path d="M 164 242 L 228 278" stroke="#ffffff" strokeWidth="4" strokeOpacity="0.5" strokeLinecap="round" />
          <path d="M 164 276 L 228 312" stroke="#ffffff" strokeWidth="4" strokeOpacity="0.5" strokeLinecap="round" />
          <path d="M 164 310 L 228 346" stroke="#ffffff" strokeWidth="4" strokeOpacity="0.5" strokeLinecap="round" />

          {/* Right Facet: Recovery Vector Facet */}
          <path d="M 268 262 L 364 206 L 364 326 L 268 382 Z" fill={`url(#${insightGradId})`} opacity="0.85" />
          
          {/* Upward pulse lines */}
          <path d="M 284 346 L 348 310" stroke="hsl(var(--primary-glow, var(--primary)))" strokeWidth="4" strokeOpacity="0.7" strokeLinecap="round" />
          <path d="M 284 312 L 348 276" stroke="hsl(var(--primary-glow, var(--primary)))" strokeWidth="4" strokeOpacity="0.7" strokeLinecap="round" />

          {/* Top Facet: Insight Radar Surface */}
          <path d="M 256 142 L 352 198 L 256 254 L 160 198 Z" fill={`url(#${insightGradId})`} opacity="0.9" />

          {/* Core Dynamic Breakthrough Arrow (Lost Sales Converted to Captured Growth) */}
          <path
            d="M 216 280 L 256 216 L 336 136"
            stroke="#ffffff"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 216 280 L 256 216 L 336 136"
            stroke={`url(#${growthGradId})`}
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Arrowhead */}
          <polygon points="360,112 308,124 332,148" fill="#ffffff" />
          <polygon points="360,112 308,124 332,148" fill={`url(#${growthGradId})`} />

          {/* Central Insight Node (Luminous Focal Aperture) */}
          <circle cx="256" cy="216" r="18" fill="#ffffff" />
          <circle cx="256" cy="216" r="11" fill="hsl(var(--primary))" />
          <circle cx="256" cy="216" r="4.5" fill="#ffffff" />

          {/* Radar Horizon Arcs */}
          <path
            d="M 196 178 A 72 42 0 0 1 316 178"
            fill="none"
            stroke="hsl(var(--accent, 180 85% 55%))"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="7 9"
            opacity="0.9"
          />
          <path
            d="M 176 168 A 96 56 0 0 1 336 168"
            fill="none"
            stroke="hsl(var(--primary-glow, var(--primary)))"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.65"
          />
        </g>
      </svg>
    </div>
  );

  // Micro search-badge variant
  if (variant === 'search-badge') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary select-none shrink-0',
          className
        )}
      >
        {emblem}
        <span className="text-[10px] font-black tracking-wider uppercase opacity-90">LSI</span>
      </div>
    );
  }

  // Icon only
  if (variant === 'icon' && !showText) {
    return emblem;
  }

  // Full / Compact layout with brand typography
  return (
    <div
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2.5 sm:gap-3 min-w-0 select-none',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {emblem}

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              'font-extrabold tracking-tight truncate',
              size === 'splash' && 'text-2xl sm:text-3xl text-foreground',
              size === 'xl' && 'text-xl sm:text-2xl text-foreground',
              size === 'lg' && 'text-lg sm:text-xl text-foreground',
              (size === 'md' || size === 'sm' || size === 'xs') && 'text-base sm:text-lg text-foreground'
            )}
          >
            {variant === 'compact' ? (
              <span className="text-gradient-primary font-black">LSI</span>
            ) : (
              <>
                <span className="sm:hidden text-gradient-primary font-black">LSI</span>
                <span className="hidden sm:inline">
                  Lost Sale <span className="text-gradient-primary">Insights</span>
                </span>
              </>
            )}
          </span>

          {badgeText && (
            <span className="hidden md:inline-flex items-center px-1.5 py-0.2 text-[10px] font-black rounded uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 shrink-0">
              {badgeText}
            </span>
          )}
        </div>

        {subtitle && (
          <p
            className={cn(
              'text-muted-foreground truncate font-medium',
              size === 'splash' ? 'text-xs sm:text-sm mt-0.5' : 'text-[11px] sm:text-xs'
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
