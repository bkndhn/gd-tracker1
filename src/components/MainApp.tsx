
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRealtimeSync, useForceLogoutOnDelete } from '@/hooks/useRealtimeSync';
import { Layout } from '@/components/Layout';
import { LostVisitForm } from '@/components/LostVisitForm';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { OfflineStatusBar } from '@/components/OfflineStatusBar';

import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { Button } from '@/components/ui/button';
import { BarChart3, Plus, Settings, FileText, Shield, MessageCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OnboardingWizard, hasCompletedOnboarding } from '@/components/OnboardingWizard';
import { FeatureTour } from '@/components/FeatureTour';
import { identifySession, addBreadcrumb } from '@/lib/errorTracking';
import { supabase } from '@/integrations/supabase/client';
import { useRequirementsAccess } from '@/hooks/useRequirementsAccess';
import { ClipboardList } from 'lucide-react';
import { PageSkeleton } from '@/components/PageSkeleton';

// Lazy load heavy components with prefetch helpers for instant nav
const importDashboard = () => import('@/components/Dashboard').then(m => ({ default: m.Dashboard }));
const importReports = () => import('@/components/ReportsPanel').then(m => ({ default: m.ReportsPanel }));
const importAdmin = () => import('@/components/AdminPanel').then(m => ({ default: m.AdminPanel }));
const importFollowUps = () => import('@/components/FollowUpPanel').then(m => ({ default: m.FollowUpPanel }));
const importSuperAdmin = () => import('@/components/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard }));
const Dashboard = React.lazy(importDashboard);
const ReportsPanel = React.lazy(importReports);
const AdminPanel = React.lazy(importAdmin);
const FollowUpPanel = React.lazy(importFollowUps);
const importRequirements = () => import('@/components/RequirementsPanel').then(m => ({ default: m.RequirementsPanel }));
const SuperAdminDashboard = React.lazy(importSuperAdmin);
const RequirementsPanel = React.lazy(importRequirements);

type ActiveTab = 'gd' | 'dashboard' | 'admin' | 'reports' | 'followups' | 'requirements' | 'super_admin';

export const MainApp = () => {
  const { isSuperAdmin, isAdmin, isManager, profile, user, signOut, adminId } = useAuth();
  const { permission } = usePushNotifications();
  const isWarehouse = (profile as any)?.role === 'warehouse';
  const { enabled: requirementsEnabled } = useRequirementsAccess();
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    isSuperAdmin ? 'super_admin' : (isAdmin || isManager) ? 'dashboard' : 'gd'
  );
  const notesInputRef = useRef<HTMLTextAreaElement>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Track all visited tabs to keep them mounted in DOM for instant (0ms) navigation
  const [visitedTabs, setVisitedTabs] = useState<Set<ActiveTab>>(() => new Set([activeTab]));

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Force logout handler
  const { handleProfileDeleted, handleProfilePaused } = useForceLogoutOnDelete(user?.id, adminId, signOut);

  // Enable realtime sync for instant updates across all pages
  useRealtimeSync({
    tables: ['goods_damaged_entries', 'profiles', 'shops', 'categories', 'sizes', 'customer_types', 'gd_entry_images', 'app_settings'],
    onProfileDeleted: handleProfileDeleted,
    onProfilePaused: handleProfilePaused,
    enabled: !!user,
  });

  // Bind crash reports + release-health sessions to the signed-in user
  useEffect(() => {
    if (user?.id) void identifySession(user.id, adminId || null);
  }, [user?.id, adminId]);

  // First-run setup: offer the wizard to admins whose tenant has no options yet
  useEffect(() => {
    if (!isAdmin || isSuperAdmin || !user?.id) return;
    if (hasCompletedOnboarding(user.id)) return;
    let cancelled = false;

    (async () => {
      const { count, error } = await (supabase.from('custom_field_options') as any)
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);
      if (!cancelled && !error && (count ?? 0) === 0) setOnboardingOpen(true);
    })();

    return () => { cancelled = true; };
  }, [isAdmin, isSuperAdmin, user?.id]);

  // Update active tab when user role changes
  useEffect(() => {
    if (isSuperAdmin) {
      // Super admin only has super_admin tab - no profile
      if (activeTab !== 'super_admin') {
        setActiveTab('super_admin');
      }
    } else if (!isAdmin && !isManager && activeTab !== 'gd' && activeTab !== 'requirements') {
      setActiveTab('gd');
    }
    if (isWarehouse && activeTab !== 'requirements' && requirementsEnabled) {
      setActiveTab('requirements');
    }
    if (isManager && !isAdmin && activeTab === 'admin') {
      setActiveTab('dashboard');
    }
  }, [isAdmin, isManager, isSuperAdmin, activeTab, isWarehouse, requirementsEnabled]);

  // Auto-focus notes input when switching to the log-visit tab
  useEffect(() => {
    addBreadcrumb('navigation', `tab:${activeTab}`);
    if (activeTab === 'gd') {
      setTimeout(() => {
        const notesInput = document.querySelector('textarea#notes') as HTMLTextAreaElement;
        if (notesInput) notesInput.focus();
      }, 100);
    }
  }, [activeTab]);

  // Prefetch all panels right after first paint so clicks are instantaneous
  useEffect(() => {
    const idle = (cb: () => void) => (window as any).requestIdleCallback?.(cb) ?? setTimeout(cb, 400);
    idle(() => {
      importDashboard();
      importReports();
      importRequirements();
      if (isAdmin) importAdmin();
      if (isAdmin || isManager) importFollowUps();
      if (isSuperAdmin) importSuperAdmin();
    });
  }, [isAdmin, isManager, isSuperAdmin]);

  const renderTab = (tab: ActiveTab) => {
    switch (tab) {
      case 'super_admin':
        return isSuperAdmin ? (
          <ErrorBoundary boundary="SuperAdminDashboard">
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <SuperAdminDashboard />
            </Suspense>
          </ErrorBoundary>
        ) : <div className="text-center text-muted-foreground">Access denied</div>;
      case 'gd':
        return !isSuperAdmin ? (
          <ErrorBoundary boundary="gd-form">
            <LostVisitForm />
          </ErrorBoundary>
        ) : <div className="text-center text-muted-foreground">Access denied</div>;
      case 'dashboard':
        return (isAdmin || isManager) && !isSuperAdmin ? (
          <ErrorBoundary boundary="Dashboard">
            <Suspense fallback={<PageSkeleton variant="dashboard" />}>
              <Dashboard />
            </Suspense>
          </ErrorBoundary>
        ) : <div className="text-center text-muted-foreground">Access denied</div>;
      case 'admin':
        return isAdmin && !isSuperAdmin ? (
          <ErrorBoundary boundary="AdminPanel">
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <AdminPanel />
            </Suspense>
          </ErrorBoundary>
        ) : <div className="text-center text-muted-foreground">Access denied</div>;
      case 'followups':
        return (isAdmin || isManager) && !isSuperAdmin ? (
          <ErrorBoundary boundary="FollowUpPanel">
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <FollowUpPanel />
            </Suspense>
          </ErrorBoundary>
        ) : <div className="text-center text-muted-foreground">Access denied</div>;
      case 'requirements':
        return requirementsEnabled && !isSuperAdmin ? (
          <ErrorBoundary boundary="RequirementsPanel">
            <Suspense fallback={<PageSkeleton variant="requirements" />}>
              <RequirementsPanel />
            </Suspense>
          </ErrorBoundary>
        ) : <div className="text-center text-muted-foreground">Access denied</div>;
      case 'reports':
        return (isAdmin || isManager || isWarehouse) && !isSuperAdmin ? (
          <ErrorBoundary boundary="ReportsPanel">
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <ReportsPanel defaultTab={isWarehouse ? 'requirements' : 'visits'} />
            </Suspense>
          </ErrorBoundary>
        ) : <div className="text-center text-muted-foreground">Access denied</div>;
      default:
        return isSuperAdmin ? (
          <ErrorBoundary boundary="SuperAdminDashboard">
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <SuperAdminDashboard />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary boundary="gd-form">
            <LostVisitForm />
          </ErrorBoundary>
        );
    }
  };

  if (!user) return null;

  return (
    <>
      <PWAInstallPrompt />
      <FeatureTour />
      <OnboardingWizard open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      <div className="sticky top-0 z-40"><OfflineStatusBar /></div>
      <Layout>
        <div className="space-y-4 sm:space-y-6 pb-20 md:pb-6 w-full min-w-0">

          {/* Desktop Navigation */}
          <div className="hidden md:flex flex-wrap gap-1 p-1 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm overflow-x-auto">
            {/* Super Admin: only SA tab, no profile */}
            {isSuperAdmin && (
              <Button
                variant={activeTab === 'super_admin' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('super_admin')}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <Shield className="h-4 w-4" />
                Super Admin
              </Button>
            )}

            {/* Regular user tabs */}
            {!isSuperAdmin && (
              <>
                {!isWarehouse && (
                  <Button variant={activeTab === 'gd' ? 'default' : 'ghost'} onClick={() => setActiveTab('gd')}
                    className="flex items-center gap-2 flex-shrink-0">
                    <Plus className="h-4 w-4" />Log Visit
                  </Button>
                )}
                {requirementsEnabled && (
                  <Button variant={activeTab === 'requirements' ? 'default' : 'ghost'} onClick={() => setActiveTab('requirements')}
                    onMouseEnter={() => importRequirements()} onFocus={() => importRequirements()}
                    className="flex items-center gap-2 flex-shrink-0">
                    <ClipboardList className="h-4 w-4" />Requirements
                  </Button>
                )}
                {(isAdmin || isManager) && (
                  <Button variant={activeTab === 'dashboard' ? 'default' : 'ghost'} onClick={() => setActiveTab('dashboard')}
                    onMouseEnter={() => importDashboard()} onFocus={() => importDashboard()}
                    className="flex items-center gap-2 flex-shrink-0">
                    <BarChart3 className="h-4 w-4" />Dashboard
                  </Button>
                )}
                {(isAdmin || isManager || isWarehouse) && (
                  <Button variant={activeTab === 'reports' ? 'default' : 'ghost'} onClick={() => setActiveTab('reports')}
                    onMouseEnter={() => importReports()} onFocus={() => importReports()}
                    className="flex items-center gap-2 flex-shrink-0">
                    <FileText className="h-4 w-4" />Reports
                  </Button>
                )}
                {(isAdmin || isManager) && (
                  <Button variant={activeTab === 'followups' ? 'default' : 'ghost'} onClick={() => setActiveTab('followups')}
                    onMouseEnter={() => importFollowUps()} onFocus={() => importFollowUps()}
                    className="flex items-center gap-2 flex-shrink-0">
                    <MessageCircle className="h-4 w-4" />Follow-ups
                  </Button>
                )}
                {isAdmin && (
                  <Button variant={activeTab === 'admin' ? 'default' : 'ghost'} onClick={() => setActiveTab('admin')}
                    onMouseEnter={() => importAdmin()} onFocus={() => importAdmin()}
                    className="flex items-center gap-2 flex-shrink-0">
                    <Settings className="h-4 w-4" />Admin Panel
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="w-full min-w-0">
            {Array.from(visitedTabs).map(tab => {
              const isCurrent = activeTab === tab;
              return (
                <div
                  key={tab}
                  className={isCurrent ? 'block w-full min-w-0 animate-in fade-in-50 duration-150' : 'hidden'}
                  aria-hidden={!isCurrent}
                >
                  {renderTab(tab)}
                </div>
              );
            })}
          </div>
        </div>

        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={isAdmin}
          isManager={isManager}
          isSuperAdmin={isSuperAdmin}
          showRequirements={requirementsEnabled}
          isWarehouse={isWarehouse}
        />
      </Layout>
    </>
  );
};
