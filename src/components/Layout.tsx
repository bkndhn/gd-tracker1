import { ReactNode, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Package, User, Moon, Sun, Languages, Download, CheckCircle2, Lock, Bell } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';
import { NotificationBell } from './NotificationBell';
import { NotificationPromptBanner } from './NotificationPromptBanner';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { WhatsNew } from './WhatsNew';
import { ScreenLockOverlay } from './ScreenLockOverlay';
import { isScreenLocked } from '@/utils/screenLockSecurity';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useSessionTracking } from '@/hooks/useSessionTracking';
import { useClientTheme } from '@/hooks/useClientTheme';
import { useTheme } from '@/hooks/useTheme';
import { LANGUAGES, useTranslation } from '@/i18n';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  useClientTheme();
  const { profile, signOut, isSuperAdmin, isAdmin, isManager } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useTranslation();
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  const [isLocked, setIsLocked] = useState(() => isScreenLocked());

  const handleSessionLock = useCallback(() => {
    setIsLocked(true);
  }, []);

  const { lockNow } = useSessionTimeout(handleSessionLock, !!profile);
  useSessionTracking();

  const handleSignOut = async () => {
    setLoggingOut(true);
    const { error } = await signOut();
    if (error) {
      toast.error('Error signing out');
    } else {
      toast.success('Signed out successfully');
    }
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  };

  const getRoleBadge = () => {
    if (isSuperAdmin) return { label: t('role.superAdmin'), className: 'bg-destructive text-destructive-foreground' };
    if (isAdmin) return { label: t('role.admin'), className: 'bg-primary text-primary-foreground' };
    if (isManager) return { label: t('role.manager'), className: 'bg-accent text-accent-foreground' };
    return null;
  };

  const roleBadge = getRoleBadge();

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <nav className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/70 w-full shadow-[0_1px_0_0_hsl(var(--border))]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 min-w-0">
            <div className="flex items-center min-w-0 flex-shrink-0">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 ring-1 ring-primary/20">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              </div>
              <span className="ml-2 text-lg sm:text-xl font-bold text-gradient-primary truncate tracking-tight">
                <span className="sm:hidden">LSI</span>
                <span className="hidden sm:inline">Lost Sale Insights</span>
              </span>
            </div>
            
            {/* Desktop Action Cluster */}
            <div className="hidden sm:flex items-center space-x-2 lg:space-x-3 min-w-0 flex-shrink-0">
              <div className="flex items-center space-x-1.5 min-w-0">
                <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-28 sm:max-w-none font-medium">
                  {profile?.name}
                </span>
                {roleBadge && (
                  <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full flex-shrink-0 shadow-sm ${roleBadge.className}`}>
                    {roleBadge.label}
                  </span>
                )}
              </div>
              
              <LanguageToggle />
              <ThemeToggle />
              <NotificationBell />
              <WhatsNew />
              
              {!isInstalled && canInstall && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => promptInstall()}
                  className="hidden lg:flex items-center gap-1.5 text-xs h-9 border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Install App</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-1.5 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors h-9"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>

            {/* Mobile Action Cluster - Compact & Zero-Overflow */}
            <div className="flex sm:hidden items-center space-x-1 min-w-0 flex-shrink-0">
              <NotificationBell />
              <WhatsNew />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-border/80 bg-muted/40 hover:bg-muted focus:ring-1 focus:ring-primary/40 shrink-0"
                    aria-label="User profile and settings"
                  >
                    <User className="h-4 w-4 text-foreground/80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-xl border-border/80 z-50">
                  <DropdownMenuLabel className="font-normal px-2 py-1.5">
                    <p className="text-sm font-semibold truncate text-foreground">{profile?.name || 'User'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {roleBadge && (
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${roleBadge.className}`}>
                          {roleBadge.label}
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {!isInstalled && (
                    <>
                      <DropdownMenuItem
                        onClick={() => promptInstall()}
                        className="flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer text-primary focus:text-primary focus:bg-primary/10"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold">
                          <Download className="h-4 w-4" />
                          Install App on Phone
                        </span>
                        <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-0 font-bold">
                          PWA
                        </Badge>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {isInstalled && (
                    <>
                      <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          App Installed
                        </span>
                        <span className="text-[10px] font-mono opacity-70">PWA Active</span>
                      </div>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  <DropdownMenuItem
                    onClick={toggleTheme}
                    className="flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium">
                      {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-blue-500" />}
                      Appearance
                    </span>
                    <Badge variant="outline" className="text-[10px] capitalize font-mono">
                      {theme}
                    </Badge>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setLang(lang === 'en' ? 'ta' : lang === 'ta' ? 'hi' : 'en')}
                    className="flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium">
                      <Languages className="h-4 w-4 text-primary" />
                      {t('nav.language')}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {LANGUAGES.find(l => l.code === lang)?.native || 'English'}
                    </Badge>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setShowNotificationSettings(true)}
                    className="flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Bell className="h-4 w-4 text-primary" />
                      Alert Settings
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Push &amp; Sound
                    </Badge>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={lockNow}
                    className="flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Lock Screen
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      Privacy
                    </Badge>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setShowLogoutConfirm(true)}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('nav.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-secondary opacity-70" />
      </nav>

      <NotificationPromptBanner />
      
      <main className="max-w-7xl mx-auto py-3 sm:py-6 px-3 sm:px-4 lg:px-8 w-full min-w-0 pb-28 md:pb-8">
        {children}
      </main>

      <NotificationSettingsModal
        open={showNotificationSettings}
        onOpenChange={setShowNotificationSettings}
      />

      <DeleteConfirmationDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={handleSignOut}
        title={t('nav.signOut')}
        description="Are you sure you want to sign out?"
        loading={loggingOut}
      />

      {isLocked && profile && (
        <ScreenLockOverlay
          onUnlock={() => setIsLocked(false)}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
};
