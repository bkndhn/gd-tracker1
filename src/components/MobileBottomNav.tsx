
import { useMemo } from 'react';
import { BarChart3, Plus, Settings, FileText, Shield, MessageCircle, ClipboardList, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/i18n';

type ActiveTab = 'gd' | 'dashboard' | 'admin' | 'reports' | 'followups' | 'requirements' | 'super_admin';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isAdmin: boolean;
  isManager?: boolean;
  isSuperAdmin?: boolean;
  showRequirements?: boolean;
  isWarehouse?: boolean;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: LucideIcon;
}

const TAB_THEMES: Record<ActiveTab, { gradient: string; glow: string; iconColor: string }> = {
  gd: {
    gradient: 'from-blue-600 to-indigo-600',
    glow: 'shadow-blue-500/30',
    iconColor: 'text-blue-500',
  },
  requirements: {
    gradient: 'from-amber-500 to-orange-500',
    glow: 'shadow-amber-500/30',
    iconColor: 'text-amber-500',
  },
  dashboard: {
    gradient: 'from-indigo-600 to-violet-600',
    glow: 'shadow-indigo-500/30',
    iconColor: 'text-indigo-500',
  },
  reports: {
    gradient: 'from-teal-600 to-emerald-600',
    glow: 'shadow-teal-500/30',
    iconColor: 'text-teal-500',
  },
  followups: {
    gradient: 'from-violet-600 to-purple-600',
    glow: 'shadow-purple-500/30',
    iconColor: 'text-purple-500',
  },
  admin: {
    gradient: 'from-purple-600 to-rose-600',
    glow: 'shadow-rose-500/30',
    iconColor: 'text-purple-500',
  },
  super_admin: {
    gradient: 'from-indigo-600 to-blue-600',
    glow: 'shadow-indigo-500/30',
    iconColor: 'text-indigo-500',
  },
};

export const MobileBottomNav = ({
  activeTab,
  setActiveTab,
  isAdmin,
  isManager,
  isSuperAdmin,
  showRequirements,
  isWarehouse,
}: MobileBottomNavProps) => {
  const { t } = useTranslation();

  const items = useMemo<NavItem[]>(() => {
    if (isSuperAdmin) {
      return [{ id: 'super_admin', label: t('role.superAdmin'), icon: Shield }];
    }

    const list: NavItem[] = [];

    if (!isWarehouse) {
      list.push({ id: 'gd', label: t('nav.log'), icon: Plus });
    }

    if (showRequirements) {
      list.push({ id: 'requirements', label: t('nav.stock'), icon: ClipboardList });
    }

    if (isAdmin || isManager) {
      list.push({ id: 'dashboard', label: t('nav.dash'), icon: BarChart3 });
    }

    if (isAdmin || isManager || isWarehouse) {
      list.push({ id: 'reports', label: t('nav.reports'), icon: FileText });
    }

    if (isAdmin || isManager) {
      list.push({ id: 'followups', label: t('nav.follow'), icon: MessageCircle });
    }

    if (isAdmin) {
      list.push({ id: 'admin', label: t('nav.admin'), icon: Settings });
    }

    return list;
  }, [isSuperAdmin, isWarehouse, showRequirements, isAdmin, isManager, t]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] max-w-lg select-none pointer-events-auto"
    >
      <div className="flex items-center justify-between gap-1 p-1 sm:p-1.5 px-1.5 sm:px-2 rounded-2xl sm:rounded-full bg-card/92 dark:bg-card/95 backdrop-blur-2xl border border-border/80 shadow-[0_14px_36px_-6px_rgba(0,0,0,0.22),0_4px_12px_-2px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:ring-white/10 transition-all">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const theme = TAB_THEMES[item.id] || TAB_THEMES.gd;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 sm:py-1.5 px-0.5 sm:px-1 rounded-xl sm:rounded-full transition-all duration-200 active:scale-95 focus:outline-none ${
                isActive
                  ? `bg-gradient-to-r ${theme.gradient} text-white shadow-md ${theme.glow} font-semibold`
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-normal'
              }`}
            >
              <Icon className={`h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0 ${isActive ? 'stroke-[2.5] text-white' : 'stroke-[1.75]'}`} />
              <span className="text-[9px] sm:text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-full text-center px-0.5">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
