import { ReactNode, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Package } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationBell } from './NotificationBell';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { WhatsNew } from './WhatsNew';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useSessionTracking } from '@/hooks/useSessionTracking';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { profile, signOut, isSuperAdmin, isAdmin, isManager } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSessionTimeout = useCallback(async () => {
    toast.info('Session expired due to inactivity. Please sign in again.', { duration: 6000 });
    await signOut();
  }, [signOut]);

  useSessionTimeout(handleSessionTimeout, !!profile);

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
    if (isSuperAdmin) return { label: 'Super Admin', className: 'bg-destructive text-destructive-foreground' };
    if (isAdmin) return { label: 'Admin', className: 'bg-primary text-primary-foreground' };
    if (isManager) return { label: 'Manager', className: 'bg-accent text-accent-foreground' };
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
            
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-shrink-0">
              <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-20 sm:max-w-none">
                  {profile?.name}
                </span>
                {roleBadge && (
                  <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full flex-shrink-0 shadow-sm ${roleBadge.className}`}>
                    {roleBadge.label}
                  </span>
                )}
              </div>
              
              <LanguageToggle />

              <ThemeToggle />
              
              <NotificationBell />
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-1 sm:gap-2 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
        <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-secondary opacity-70" />
      </nav>
      
      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-4 lg:px-8 w-full min-w-0">
        {children}
      </main>

      <DeleteConfirmationDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={handleSignOut}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        loading={loggingOut}
      />
    </div>
  );
};
