import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ExportJobsProvider } from "@/hooks/useExportJobs";
import { ExportJobsPanel } from "@/components/ExportJobsPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { I18nProvider } from "@/i18n";
import { ClientThemeSync } from "@/hooks/useClientTheme";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import Index from "./pages/Index";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Create QueryClient outside component to avoid hook timing issues
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 15, // 15 minutes - data stays fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache
      retry: 1,
      refetchOnWindowFocus: false, // Prevent refetch on tab switch
      refetchOnReconnect: false, // Prevent refetch on reconnect
    },
  },
});

const App: React.FC = () => {
  return (
    <ErrorBoundary boundary="root">
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
        <TooltipProvider>
          {/* Universal status bar fill for standalone mobile PWAs (iOS & Android notches) */}
          <div
            className="fixed top-0 left-0 right-0 z-50 bg-primary pointer-events-none transition-colors duration-200"
            style={{ height: 'env(safe-area-inset-top, 0px)' }}
            aria-hidden="true"
          />
          <ClientThemeSync />
          <PWAInstallPrompt />
          <ExportJobsProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<ErrorBoundary boundary="index"><Index /></ErrorBoundary>} />
                <Route path="/reset-password" element={<ErrorBoundary boundary="reset-password"><ResetPassword /></ErrorBoundary>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            <ExportJobsPanel />
          </ExportJobsProvider>
        </TooltipProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
