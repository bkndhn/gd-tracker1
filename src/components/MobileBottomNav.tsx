import { BarChart3, Plus, Settings, FileText, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

type ActiveTab = 'gd' | 'dashboard' | 'admin' | 'reports' | 'super_admin';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isAdmin: boolean;
  isManager?: boolean;
  isSuperAdmin?: boolean;
}

interface NavItem {
  key: ActiveTab;
  label: string;
  Icon: typeof Plus;
}

const NavButton = ({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect: () => void;
}) => {
  const { Icon, label } = item;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={() => {
        if (!active && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(8);
        }
        onSelect();
      }}
      className="group flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1 focus:outline-none"
    >
      {/* Material 3 active indicator pill */}
      <span
        className={cn(
          'md-ripple relative flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-200 md-emphasized',
          active ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
        )}
      >
        {active && (
          <span className="md-pill absolute inset-0 rounded-full bg-primary/15" aria-hidden />
        )}
        <Icon
          className={cn(
            'relative h-[22px] w-[22px] transition-transform duration-200 md-emphasized',
            active ? 'scale-110' : 'scale-100 group-active:scale-95'
          )}
          strokeWidth={active ? 2.4 : 2}
        />
      </span>
      <span
        className={cn(
          'text-[11px] leading-none tracking-wide transition-colors duration-200',
          active ? 'font-semibold text-primary' : 'font-medium text-muted-foreground'
        )}
      >
        {label}
      </span>
    </button>
  );
};

export const MobileBottomNav = ({
  activeTab,
  setActiveTab,
  isAdmin,
  isManager,
  isSuperAdmin,
}: MobileBottomNavProps) => {
  const items: NavItem[] = isSuperAdmin
    ? [{ key: 'super_admin', label: 'Console', Icon: Shield }]
    : [
        { key: 'gd', label: 'Entry', Icon: Plus },
        ...(isAdmin || isManager
          ? ([
              { key: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
              { key: 'reports', label: 'Reports', Icon: FileText },
            ] as NavItem[])
          : []),
        ...(isAdmin ? ([{ key: 'admin', label: 'Admin', Icon: Settings }] as NavItem[]) : []),
      ];

  return (
    <nav
      role="tablist"
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-card/95 backdrop-blur-xl elev-2 pb-safe"
    >
      <div className="flex items-stretch justify-around px-1">
        {items.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={activeTab === item.key}
            onSelect={() => setActiveTab(item.key)}
          />
        ))}
      </div>
    </nav>
  );
};
