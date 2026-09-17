import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ThemePalette {
  id: string;
  name: string;
  description: string;
  hex: string;
  hslLight: {
    primary: string;
    glow: string;
    ring: string;
    gradient: string;
  };
  hslDark: {
    primary: string;
    glow: string;
    ring: string;
    gradient: string;
  };
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
    },
    hslDark: {
      primary: '262 83% 65%',
      glow: '262 83% 75%',
      ring: '262 83% 65%',
      gradient: 'linear-gradient(135deg, hsl(262 83% 65%), hsl(220 90% 65%))',
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
    },
    hslDark: {
      primary: '217 91% 60%',
      glow: '217 91% 72%',
      ring: '217 91% 60%',
      gradient: 'linear-gradient(135deg, hsl(217 91% 60%), hsl(199 89% 58%))',
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
    },
    hslDark: {
      primary: '158 64% 52%',
      glow: '158 64% 65%',
      ring: '158 64% 52%',
      gradient: 'linear-gradient(135deg, hsl(158 64% 52%), hsl(172 66% 60%))',
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
    },
    hslDark: {
      primary: '350 89% 65%',
      glow: '350 89% 75%',
      ring: '350 89% 65%',
      gradient: 'linear-gradient(135deg, hsl(350 89% 65%), hsl(330 85% 65%))',
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
    },
    hslDark: {
      primary: '38 92% 55%',
      glow: '38 92% 65%',
      ring: '38 92% 55%',
      gradient: 'linear-gradient(135deg, hsl(38 92% 55%), hsl(25 95% 60%))',
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
    },
    hslDark: {
      primary: '243 75% 65%',
      glow: '243 75% 75%',
      ring: '243 75% 65%',
      gradient: 'linear-gradient(135deg, hsl(243 75% 65%), hsl(262 83% 65%))',
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
    },
    hslDark: {
      primary: '173 80% 50%',
      glow: '173 80% 60%',
      ring: '173 80% 50%',
      gradient: 'linear-gradient(135deg, hsl(173 80% 50%), hsl(190 90% 55%))',
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
    },
    hslDark: {
      primary: '215 20% 65%',
      glow: '215 20% 75%',
      ring: '215 20% 65%',
      gradient: 'linear-gradient(135deg, hsl(215 20% 65%), hsl(215 25% 75%))',
    },
  },
};

export const applyThemeToDom = (themeId: string) => {
  const palette = THEME_PALETTES[themeId] || THEME_PALETTES.purple;
  const isDark = document.documentElement.classList.contains('dark');
  const root = document.documentElement;
  const vals = isDark ? palette.hslDark : palette.hslLight;

  root.style.setProperty('--primary', vals.primary);
  root.style.setProperty('--ring', vals.ring);
  root.style.setProperty('--primary-glow', vals.glow);
  root.style.setProperty('--sidebar-primary', vals.primary);
  root.style.setProperty('--gradient-primary', vals.gradient);

  // Update browser address/notification/status bar meta tags dynamically
  let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = palette.hex;

  let metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  if (!metaApple) {
    metaApple = document.createElement('meta');
    metaApple.name = 'apple-mobile-web-app-status-bar-style';
    document.head.appendChild(metaApple);
  }
  metaApple.content = isDark ? 'black-translucent' : 'default';

  let metaNav = document.querySelector('meta[name="msapplication-navbutton-color"]') as HTMLMetaElement | null;
  if (!metaNav) {
    metaNav = document.createElement('meta');
    metaNav.name = 'msapplication-navbutton-color';
    document.head.appendChild(metaNav);
  }
  metaNav.content = palette.hex;
};

export const useClientTheme = () => {
  const { profile } = useAuth();
  const p = profile as any;
  const tenantId = p?.role === 'admin' || p?.role === 'super_admin' ? p?.id : p?.admin_id;

  const storageKey = tenantId ? `gd_client_theme_${tenantId}` : 'gd_client_theme_default';

  const [currentTheme, setCurrentThemeState] = useState<string>(() => {
    const cached = localStorage.getItem(storageKey);
    return cached || p?.theme_color || 'purple';
  });
  const [saving, setSaving] = useState(false);

  // Sync theme when profile or tenant changes
  useEffect(() => {
    if (p?.theme_color && p.theme_color !== currentTheme) {
      setCurrentThemeState(p.theme_color);
      localStorage.setItem(storageKey, p.theme_color);
    }
  }, [p?.theme_color, storageKey]);

  // Apply to DOM and mobile browser status bar whenever currentTheme changes or dark mode changes
  useEffect(() => {
    applyThemeToDom(currentTheme);

    const observer = new MutationObserver(() => {
      applyThemeToDom(currentTheme);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [currentTheme]);

  const updateTheme = useCallback(
    async (newThemeId: string) => {
      if (!THEME_PALETTES[newThemeId]) return;
      setCurrentThemeState(newThemeId);
      localStorage.setItem(storageKey, newThemeId);
      applyThemeToDom(newThemeId);

      if (!tenantId) return;

      setSaving(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ theme_color: newThemeId } as any)
          .eq('id', tenantId);

        if (error) {
          // If column is pending migration, show local success with note
          if (error.message?.includes('column') || error.code === '42703') {
            toast.success(`Theme updated locally to ${THEME_PALETTES[newThemeId].name}`);
            return;
          }
          throw error;
        }
        toast.success(`App theme updated to ${THEME_PALETTES[newThemeId].name}`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to persist theme to cloud');
      } finally {
        setSaving(false);
      }
    },
    [tenantId, storageKey]
  );

  return {
    currentTheme,
    palette: THEME_PALETTES[currentTheme] || THEME_PALETTES.purple,
    allPalettes: Object.values(THEME_PALETTES),
    updateTheme,
    saving,
  };
};
