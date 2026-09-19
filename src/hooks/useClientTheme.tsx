import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { updateDynamicFavicon } from '@/utils/dynamicFavicon';

export interface ThemeTokens {
  primary: string;
  glow: string;
  ring: string;
  gradient: string;
  background: string;
  bgGradient: string;
  card: string;
  border: string;
  muted: string;
  accent: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  description: string;
  hex: string;
  hslLight: ThemeTokens;
  hslDark: ThemeTokens;
}

export const THEME_PALETTES: Record<string, ThemePalette> = {
  purple: {
    id: 'purple',
    name: 'Vibrant Purple',
    description: 'Modern luxury purple with glowing indigo accents',
    hex: '#7c3aed',
    hslLight: {
      primary: '262 83% 58%',
      glow: '262 83% 68%',
      ring: '262 83% 58%',
      gradient: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(220 90% 60%))',
      background: '240 100% 98%',
      bgGradient: 'linear-gradient(180deg, hsl(240 100% 98%), hsl(260 100% 96%))',
      card: '0 0% 100%',
      border: '240 30% 90%',
      muted: '240 20% 96%',
      accent: '180 85% 55%',
    },
    hslDark: {
      primary: '262 83% 65%',
      glow: '262 83% 75%',
      ring: '262 83% 65%',
      gradient: 'linear-gradient(135deg, hsl(262 83% 65%), hsl(220 90% 65%))',
      background: '260 60% 8%',
      bgGradient: 'linear-gradient(180deg, hsl(260 60% 8%), hsl(260 50% 12%))',
      card: '260 50% 12%',
      border: '260 40% 20%',
      muted: '260 40% 18%',
      accent: '180 85% 60%',
    },
  },
  blue: {
    id: 'blue',
    name: 'Ocean Blue',
    description: 'Classic professional sapphire blue with cyan highlights',
    hex: '#2563eb',
    hslLight: {
      primary: '221 83% 53%',
      glow: '221 83% 65%',
      ring: '221 83% 53%',
      gradient: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(199 89% 48%))',
      background: '215 100% 98%',
      bgGradient: 'linear-gradient(180deg, hsl(215 100% 98%), hsl(225 100% 96%))',
      card: '0 0% 100%',
      border: '215 30% 90%',
      muted: '215 20% 96%',
      accent: '199 89% 48%',
    },
    hslDark: {
      primary: '217 91% 60%',
      glow: '217 91% 72%',
      ring: '217 91% 60%',
      gradient: 'linear-gradient(135deg, hsl(217 91% 60%), hsl(199 89% 58%))',
      background: '222 55% 7%',
      bgGradient: 'linear-gradient(180deg, hsl(222 55% 7%), hsl(222 45% 11%))',
      card: '222 45% 11%',
      border: '222 35% 19%',
      muted: '222 35% 16%',
      accent: '199 89% 58%',
    },
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Forest',
    description: 'Rich emerald green suited for retail growth and wealth',
    hex: '#059669',
    hslLight: {
      primary: '160 84% 39%',
      glow: '160 84% 50%',
      ring: '160 84% 39%',
      gradient: 'linear-gradient(135deg, hsl(160 84% 39%), hsl(172 66% 50%))',
      background: '155 80% 98%',
      bgGradient: 'linear-gradient(180deg, hsl(155 80% 98%), hsl(165 70% 96%))',
      card: '0 0% 100%',
      border: '160 30% 90%',
      muted: '160 20% 95%',
      accent: '172 66% 45%',
    },
    hslDark: {
      primary: '158 64% 52%',
      glow: '158 64% 65%',
      ring: '158 64% 52%',
      gradient: 'linear-gradient(135deg, hsl(158 64% 52%), hsl(172 66% 60%))',
      background: '162 50% 6%',
      bgGradient: 'linear-gradient(180deg, hsl(162 50% 6%), hsl(162 40% 10%))',
      card: '162 40% 10%',
      border: '162 30% 18%',
      muted: '162 30% 15%',
      accent: '172 66% 55%',
    },
  },
  rose: {
    id: 'rose',
    name: 'Crimson Rose',
    description: 'Bold magenta rose for boutique, fashion and lifestyle',
    hex: '#e11d48',
    hslLight: {
      primary: '350 89% 60%',
      glow: '350 89% 70%',
      ring: '350 89% 60%',
      gradient: 'linear-gradient(135deg, hsl(350 89% 60%), hsl(330 85% 60%))',
      background: '350 80% 99%',
      bgGradient: 'linear-gradient(180deg, hsl(350 80% 99%), hsl(340 70% 97%))',
      card: '0 0% 100%',
      border: '350 30% 91%',
      muted: '350 20% 96%',
      accent: '330 85% 60%',
    },
    hslDark: {
      primary: '350 89% 65%',
      glow: '350 89% 75%',
      ring: '350 89% 65%',
      gradient: 'linear-gradient(135deg, hsl(350 89% 65%), hsl(330 85% 65%))',
      background: '352 50% 7%',
      bgGradient: 'linear-gradient(180deg, hsl(352 50% 7%), hsl(352 40% 11%))',
      card: '352 40% 11%',
      border: '352 30% 19%',
      muted: '352 30% 16%',
      accent: '330 85% 65%',
    },
  },
  amber: {
    id: 'amber',
    name: 'Warm Amber',
    description: 'Energetic warm gold amber with fiery orange tones',
    hex: '#d97706',
    hslLight: {
      primary: '38 92% 50%',
      glow: '38 92% 60%',
      ring: '38 92% 50%',
      gradient: 'linear-gradient(135deg, hsl(38 92% 50%), hsl(25 95% 55%))',
      background: '40 80% 98%',
      bgGradient: 'linear-gradient(180deg, hsl(40 80% 98%), hsl(30 70% 96%))',
      card: '0 0% 100%',
      border: '38 30% 90%',
      muted: '38 20% 95%',
      accent: '25 95% 55%',
    },
    hslDark: {
      primary: '38 92% 55%',
      glow: '38 92% 65%',
      ring: '38 92% 55%',
      gradient: 'linear-gradient(135deg, hsl(38 92% 55%), hsl(25 95% 60%))',
      background: '28 40% 7%',
      bgGradient: 'linear-gradient(180deg, hsl(28 40% 7%), hsl(28 32% 11%))',
      card: '28 32% 11%',
      border: '28 25% 18%',
      muted: '28 25% 15%',
      accent: '25 95% 60%',
    },
  },
  indigo: {
    id: 'indigo',
    name: 'Deep Indigo',
    description: 'High-tech deep indigo with electric violet glow',
    hex: '#4f46e5',
    hslLight: {
      primary: '243 75% 59%',
      glow: '243 75% 69%',
      ring: '243 75% 59%',
      gradient: 'linear-gradient(135deg, hsl(243 75% 59%), hsl(262 83% 58%))',
      background: '240 80% 98%',
      bgGradient: 'linear-gradient(180deg, hsl(240 80% 98%), hsl(245 70% 96%))',
      card: '0 0% 100%',
      border: '243 30% 90%',
      muted: '243 20% 96%',
      accent: '262 83% 58%',
    },
    hslDark: {
      primary: '243 75% 65%',
      glow: '243 75% 75%',
      ring: '243 75% 65%',
      gradient: 'linear-gradient(135deg, hsl(243 75% 65%), hsl(262 83% 65%))',
      background: '245 50% 7%',
      bgGradient: 'linear-gradient(180deg, hsl(245 50% 7%), hsl(245 40% 11%))',
      card: '245 40% 11%',
      border: '245 30% 19%',
      muted: '245 30% 16%',
      accent: '262 83% 65%',
    },
  },
  teal: {
    id: 'teal',
    name: 'Vibrant Teal',
    description: 'Clean modern teal for clean and refreshing interfaces',
    hex: '#0d9488',
    hslLight: {
      primary: '173 80% 40%',
      glow: '173 80% 50%',
      ring: '173 80% 40%',
      gradient: 'linear-gradient(135deg, hsl(173 80% 40%), hsl(190 90% 45%))',
      background: '175 70% 98%',
      bgGradient: 'linear-gradient(180deg, hsl(175 70% 98%), hsl(185 60% 96%))',
      card: '0 0% 100%',
      border: '173 30% 90%',
      muted: '173 20% 95%',
      accent: '190 90% 45%',
    },
    hslDark: {
      primary: '173 80% 50%',
      glow: '173 80% 60%',
      ring: '173 80% 50%',
      gradient: 'linear-gradient(135deg, hsl(173 80% 50%), hsl(190 90% 55%))',
      background: '178 50% 6%',
      bgGradient: 'linear-gradient(180deg, hsl(178 50% 6%), hsl(178 40% 10%))',
      card: '178 40% 10%',
      border: '178 30% 18%',
      muted: '178 30% 15%',
      accent: '190 90% 55%',
    },
  },
  slate: {
    id: 'slate',
    name: 'Executive Slate',
    description: 'Minimalist neutral slate for ultra-clean corporate workflows',
    hex: '#475569',
    hslLight: {
      primary: '215 25% 27%',
      glow: '215 25% 40%',
      ring: '215 25% 27%',
      gradient: 'linear-gradient(135deg, hsl(215 25% 27%), hsl(215 16% 47%))',
      background: '215 20% 98%',
      bgGradient: 'linear-gradient(180deg, hsl(215 20% 99%), hsl(215 15% 96%))',
      card: '0 0% 100%',
      border: '215 15% 90%',
      muted: '215 15% 95%',
      accent: '215 16% 47%',
    },
    hslDark: {
      primary: '215 20% 65%',
      glow: '215 20% 75%',
      ring: '215 20% 65%',
      gradient: 'linear-gradient(135deg, hsl(215 20% 65%), hsl(215 25% 75%))',
      background: '220 22% 8%',
      bgGradient: 'linear-gradient(180deg, hsl(220 22% 8%), hsl(220 18% 12%))',
      card: '220 18% 12%',
      border: '220 15% 18%',
      muted: '220 15% 15%',
      accent: '215 25% 75%',
    },
  },
};

export const applyThemeToDom = (themeId: string) => {
  const palette = THEME_PALETTES[themeId] || THEME_PALETTES.purple;
  const isDark = document.documentElement.classList.contains('dark');
  const root = document.documentElement;
  const vals = isDark ? palette.hslDark : palette.hslLight;

  // 1. Primary brand colors & focus rings
  root.style.setProperty('--primary', vals.primary);
  root.style.setProperty('--ring', vals.ring);
  root.style.setProperty('--primary-glow', vals.glow);
  root.style.setProperty('--sidebar-primary', vals.primary);
  root.style.setProperty('--gradient-primary', vals.gradient);

  // 2. Comprehensive theme-coordinated background, card, border & muted surfaces
  root.style.setProperty('--background', vals.background);
  root.style.setProperty('--gradient-background', vals.bgGradient);
  root.style.setProperty('--card', vals.card);
  root.style.setProperty('--popover', vals.card);
  root.style.setProperty('--border', vals.border);
  root.style.setProperty('--muted', vals.muted);
  root.style.setProperty('--accent', vals.accent);

  // 3. Themed shadow glows
  root.style.setProperty('--shadow-primary', `0 10px 40px -10px hsl(${vals.primary} / 0.5)`);
  root.style.setProperty('--shadow-glow', `0 0 60px hsl(${vals.glow} / 0.35)`);

  const themeHex = palette.hex;

  // 4. Clean up any leftover blob manifest so PWA installation is always valid
  try {
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (manifestLink && (manifestLink.getAttribute('href')?.startsWith('blob:') || manifestLink.href.startsWith('blob:'))) {
      manifestLink.setAttribute('href', '/manifest.json');
    }
  } catch {}

  // 5. Android & Mobile Chrome/Safari/Edge status bar theme-color
  try {
    document.querySelectorAll('meta[name="theme-color"][media]').forEach((el) => el.remove());
    document.querySelectorAll('meta[name="color-scheme"]').forEach((el) => el.remove());
  } catch {}

  let metaTheme = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute('content', themeHex);
  metaTheme.content = themeHex;

  // 6. Apple iOS Safari Status Bar Style
  let metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  if (!metaApple) {
    metaApple = document.createElement('meta');
    metaApple.name = 'apple-mobile-web-app-status-bar-style';
    document.head.appendChild(metaApple);
  }
  metaApple.setAttribute('content', 'black-translucent');
  metaApple.content = 'black-translucent';

  // 7. Mobile web app capable tags
  let metaAppleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]') as HTMLMetaElement | null;
  if (!metaAppleCapable) {
    metaAppleCapable = document.createElement('meta');
    metaAppleCapable.name = 'apple-mobile-web-app-capable';
    metaAppleCapable.setAttribute('content', 'yes');
    document.head.appendChild(metaAppleCapable);
  }

  let metaMobileCapable = document.querySelector('meta[name="mobile-web-app-capable"]') as HTMLMetaElement | null;
  if (!metaMobileCapable) {
    metaMobileCapable = document.createElement('meta');
    metaMobileCapable.name = 'mobile-web-app-capable';
    metaMobileCapable.setAttribute('content', 'yes');
    document.head.appendChild(metaMobileCapable);
  }

  // 8. Windows Phone / older Edge status bar
  let metaNav = document.querySelector('meta[name="msapplication-navbutton-color"]') as HTMLMetaElement | null;
  if (!metaNav) {
    metaNav = document.createElement('meta');
    metaNav.name = 'msapplication-navbutton-color';
    document.head.appendChild(metaNav);
  }
  metaNav.setAttribute('content', themeHex);
  metaNav.content = themeHex;

  // 9. Store for synchronous 0ms paint on next cold reload
  try {
    localStorage.setItem('gd_brand_theme', themeId);
    localStorage.setItem('gd_applied_theme_hex', themeHex);
  } catch {}

  // 10. Dynamically update browser tab favicon with theme-adaptive SVG logo
  updateDynamicFavicon(palette);
};

export interface RoleThemes {
  admin?: string;
  manager?: string;
  warehouse?: string;
  user?: string;
}

export const useClientTheme = () => {
  const { profile } = useAuth();
  const p = profile as any;
  const role = p?.role || 'user';
  const isSuperAdmin = role === 'super_admin';
  const tenantId = role === 'admin' || isSuperAdmin ? p?.id : p?.admin_id;

  const GLOBAL_BRAND_KEY = 'gd_brand_theme';
  const storageKey = tenantId ? `gd_client_theme_${tenantId}` : 'gd_client_theme_default';
  const roleStorageKey = tenantId ? `gd_client_role_themes_${tenantId}` : 'gd_client_role_themes_default';

  // Overall client organization theme:
  // Priority: 1. Locally chosen active brand theme -> 2. Profile's saved theme_color -> 3. Default
  const [overallTheme, setOverallTheme] = useState<string>(() => {
    const localBrand = localStorage.getItem(GLOBAL_BRAND_KEY);
    if (localBrand && THEME_PALETTES[localBrand]) return localBrand;
    const cached = localStorage.getItem(storageKey);
    if (cached && THEME_PALETTES[cached]) return cached;
    if (p?.theme_color && THEME_PALETTES[p.theme_color]) return p.theme_color;
    return isSuperAdmin ? 'indigo' : 'purple';
  });

  // Role-specific theme overrides for this tenant
  const [roleThemes, setRoleThemes] = useState<RoleThemes>(() => {
    try {
      const cached = localStorage.getItem(roleStorageKey);
      if (cached) return JSON.parse(cached);
    } catch {}
    return p?.role_themes || {};
  });

  const [saving, setSaving] = useState(false);

  // Determine the active theme for the current user's role
  const effectiveTheme = useMemo(() => {
    if (isSuperAdmin) return overallTheme || 'indigo';
    // If a specific role theme is set for this client, apply it
    if (roleThemes && roleThemes[role as keyof RoleThemes]) {
      return roleThemes[role as keyof RoleThemes]!;
    }
    // Otherwise fallback to overall client brand theme
    return overallTheme || 'purple';
  }, [role, roleThemes, overallTheme, isSuperAdmin]);

  // Initial sync from profile when server has a theme and client has not explicitly selected one
  useEffect(() => {
    if (p?.theme_color && THEME_PALETTES[p.theme_color]) {
      const localBrand = localStorage.getItem(GLOBAL_BRAND_KEY);
      if (!localBrand) {
        setOverallTheme(p.theme_color);
        localStorage.setItem(GLOBAL_BRAND_KEY, p.theme_color);
        localStorage.setItem(storageKey, p.theme_color);
      }
    }
    if (p?.role_themes && JSON.stringify(p.role_themes) !== JSON.stringify(roleThemes)) {
      setRoleThemes(p.role_themes);
      localStorage.setItem(roleStorageKey, JSON.stringify(p.role_themes));
    }
  }, [p?.theme_color, p?.role_themes, storageKey, roleStorageKey]);

  // Apply active theme to DOM and mobile status bar
  useEffect(() => {
    applyThemeToDom(effectiveTheme);

    const observer = new MutationObserver(() => {
      applyThemeToDom(effectiveTheme);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const handleModeChange = () => {
      applyThemeToDom(effectiveTheme);
    };
    const handleBrandChange = (e: any) => {
      const t = e.detail?.theme;
      if (t && THEME_PALETTES[t]) {
        setOverallTheme(t);
        applyThemeToDom(t);
      }
    };

    window.addEventListener('gd:theme_mode_changed', handleModeChange);
    window.addEventListener('gd:brand_theme_changed', handleBrandChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('gd:theme_mode_changed', handleModeChange);
      window.removeEventListener('gd:brand_theme_changed', handleBrandChange);
    };
  }, [effectiveTheme]);

  // Update overall client theme
  const updateTheme = useCallback(
    async (newThemeId: string) => {
      if (!THEME_PALETTES[newThemeId]) return;
      const pal = THEME_PALETTES[newThemeId];

      setOverallTheme(newThemeId);
      localStorage.setItem(GLOBAL_BRAND_KEY, newThemeId);
      localStorage.setItem(storageKey, newThemeId);
      localStorage.setItem('gd_applied_theme_hex', pal.hex);

      // Keep cached profile in sync so useAuth won't revert
      try {
        const cachedStr = localStorage.getItem('user_profile');
        if (cachedStr) {
          const parsed = JSON.parse(cachedStr);
          if (parsed?.data) {
            parsed.data.theme_color = newThemeId;
            localStorage.setItem('user_profile', JSON.stringify(parsed));
          }
        }
      } catch {}

      if (p) {
        p.theme_color = newThemeId;
      }

      applyThemeToDom(newThemeId);
      window.dispatchEvent(new CustomEvent('gd:brand_theme_changed', { detail: { theme: newThemeId } }));

      if (!tenantId) {
        toast.success(`Theme updated to ${pal.name}`);
        return;
      }

      setSaving(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ theme_color: newThemeId } as any)
          .eq('id', tenantId);

        if (error) {
          if (error.message?.includes('column') || error.code === '42703') {
            toast.success(`Theme updated locally to ${pal.name}`);
            return;
          }
          throw error;
        }
        toast.success(`App theme updated to ${pal.name}`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to persist theme to cloud');
      } finally {
        setSaving(false);
      }
    },
    [tenantId, storageKey, p]
  );

  // Update or clear role-specific theme
  const updateRoleTheme = useCallback(
    async (targetRole: keyof RoleThemes, newThemeId: string | null) => {
      const updated: RoleThemes = { ...roleThemes };
      if (!newThemeId) {
        delete updated[targetRole];
      } else {
        updated[targetRole] = newThemeId;
      }

      setRoleThemes(updated);
      localStorage.setItem(roleStorageKey, JSON.stringify(updated));

      if (role === targetRole) {
        applyThemeToDom(newThemeId || overallTheme);
      }

      if (!tenantId) return;

      setSaving(true);
      try {
        const { error } = await (supabase.from('profiles') as any)
          .update({ role_themes: updated })
          .eq('id', tenantId);

        if (error) {
          // Soft fail for column migration
          toast.success(
            newThemeId
              ? `${targetRole.toUpperCase()} theme set to ${THEME_PALETTES[newThemeId]?.name || newThemeId}`
              : `${targetRole.toUpperCase()} theme reset to default`
          );
          return;
        }
        toast.success(
          newThemeId
            ? `${targetRole.toUpperCase()} theme set to ${THEME_PALETTES[newThemeId]?.name || newThemeId}`
            : `${targetRole.toUpperCase()} theme reset to default`
        );
      } catch (err: any) {
        toast.error(err.message || 'Failed to update role theme');
      } finally {
        setSaving(false);
      }
    },
    [roleThemes, role, overallTheme, tenantId, roleStorageKey]
  );

  return {
    currentTheme: effectiveTheme,
    overallTheme,
    roleThemes,
    activeTheme: effectiveTheme,
    palette: THEME_PALETTES[effectiveTheme] || THEME_PALETTES.purple,
    allPalettes: Object.values(THEME_PALETTES),
    updateTheme,
    updateRoleTheme,
    saving,
  };
};

/**
 * Global component mounted at root level (App.tsx) to ensure
 * the tenant's brand theme and mobile status bar are continuously
 * synced across all pages (even on loading, login, 404 screens).
 */
export const ClientThemeSync: React.FC = () => {
  useClientTheme();
  return null;
};
