
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
      className="md:hidden fixed bottom-3 inset-x-3 z-50 max-w-lg mx-auto select-none pointer-events-auto"
    >
      <div className="flex items-center justify-between gap-1 p-1.5 rounded-2xl bg-card/90 dark:bg-card/95 backdrop-blur-xl border border-border/80 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/5 transition-all">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 active:scale-95 focus:outline-none ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30 font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-normal'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-full text-center">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
