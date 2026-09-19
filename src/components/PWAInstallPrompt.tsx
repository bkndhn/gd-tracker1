import React, { useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { X, Download, Share, PlusSquare, MoreVertical, Smartphone, Monitor, CheckCircle2, Sparkles } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export const PWAInstallPrompt: React.FC = () => {
  const {
    isInstalled,
    isIOS,
    isAndroid,
    hasNativePrompt,
    promptInstall,
    initialPromptVisible,
    dismissInitialPrompt,
    installModalOpen,
    setInstallModalOpen,
  } = usePWAInstall();

  // Active guide tab: default to detected platform
  const defaultTab = isIOS ? 'ios' : isAndroid ? 'android' : 'android';
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  if (isInstalled) return null;

  return (
    <>
      {/* Floating Initial Banner for Non-Installed Phones & Browsers */}
      {initialPromptVisible && (
        <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto md:bottom-6 md:right-6 md:left-auto md:w-96 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-card/95 dark:bg-card/95 backdrop-blur-xl border border-border/80 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.28)] ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <AppLogo variant="icon" size="md" animated />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  Install Lost Sale Insights
                </h4>
                <p className="text-[11px] text-muted-foreground truncate">
                  Fast 0ms load • Works 100% offline
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                onClick={() => promptInstall()}
                className="h-8 px-3 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm gap-1"
              >
                <Download className="h-3 w-3" />
                <span>Install</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={dismissInitialPrompt}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Dismiss install prompt"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Step-by-Step Installation Modal */}
      <Dialog open={installModalOpen} onOpenChange={setInstallModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-5 sm:max-w-md">
          <DialogHeader className="text-left space-y-2">
            <div className="flex items-center justify-between">
              <AppLogo variant="icon" size="lg" animated />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-3 w-3" /> PWA Ready
              </span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              Install Lost Sale Insights
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Install as a standalone app on your device for instant offline access and real-time push alerts.
            </DialogDescription>
          </DialogHeader>

          {/* Quick One-Click Install if browser prompt is ready */}
          {hasNativePrompt && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-2 my-1">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">Direct Installation Available</p>
                <p className="text-[11px] text-muted-foreground truncate">Click to install with 1 tap</p>
              </div>
              <Button
                size="sm"
                onClick={() => promptInstall()}
                className="h-8 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shrink-0"
              >
                Install Now
              </Button>
            </div>
          )}

          {/* Platform Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3 h-8 p-0.5 rounded-lg bg-muted/60">
              <TabsTrigger value="android" className="text-[11px] rounded-md gap-1 h-7">
                <Smartphone className="h-3 w-3" /> Android
              </TabsTrigger>
              <TabsTrigger value="ios" className="text-[11px] rounded-md gap-1 h-7">
                <Share className="h-3 w-3" /> iPhone / iPad
              </TabsTrigger>
              <TabsTrigger value="desktop" className="text-[11px] rounded-md gap-1 h-7">
                <Monitor className="h-3 w-3" /> PC / Mac
              </TabsTrigger>
            </TabsList>

            {/* Android / Chrome Guide */}
            <TabsContent value="android" className="space-y-2.5 mt-3">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  1
                </span>
                <div className="text-xs text-foreground leading-relaxed">
                  Tap the <span className="font-semibold inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-background border text-foreground"><MoreVertical className="h-3 w-3" /> 3 dots menu</span> at top-right in Chrome.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  2
                </span>
                <div className="text-xs text-foreground leading-relaxed">
                  Tap <span className="font-semibold text-primary inline-flex items-center gap-1 px-1 py-0.2 rounded bg-background border"><Download className="h-3 w-3" /> Install app</span> (or <span className="font-medium text-foreground">Add to Home screen</span>).
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  3
                </span>
                <div className="text-xs text-foreground leading-relaxed">
                  Tap <span className="font-semibold text-primary">Install</span> to confirm. The app icon will appear directly on your home screen and app drawer!
                </div>
              </div>
            </TabsContent>

            {/* iPhone / iPad Guide */}
            <TabsContent value="ios" className="space-y-2.5 mt-3">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  1
                </span>
                <div className="text-xs text-foreground leading-relaxed">
                  Open in <span className="font-semibold text-foreground">Safari</span> and tap the <span className="font-semibold inline-flex items-center gap-1 px-1 py-0.2 rounded bg-background border text-primary"><Share className="h-3 w-3" /> Share</span> icon at the bottom.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  2
                </span>
                <div className="text-xs text-foreground leading-relaxed">
                  Scroll down the share sheet and tap <span className="font-semibold inline-flex items-center gap-1 px-1 py-0.2 rounded bg-background border text-foreground"><PlusSquare className="h-3 w-3" /> Add to Home Screen</span>.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  3
                </span>
                <div className="text-xs text-foreground leading-relaxed">
                  Tap <span className="font-semibold text-primary">Add</span> in the top right corner. The app will open full-screen like a native iOS app.
                </div>
              </div>
            </TabsContent>

            {/* Desktop / PC Guide */}
            <TabsContent value="desktop" className="space-y-2.5 mt-3">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  1
                </span>
                <div className="text-xs text-foreground leading-relaxed">
                  In Chrome or Edge, look at the right end of the address bar for the <span className="font-semibold inline-flex items-center gap-1 px-1 py-0.2 rounded bg-background border text-primary"><Download className="h-3 w-3" /> Install icon</span>.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  2
                </span>
                <div className="text-xs text-foreground leading-relaxed">
                  Alternatively, click browser menu (⋮) → <span className="font-semibold text-primary">Install Lost Sale Insights</span>.
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Button
            onClick={() => setInstallModalOpen(false)}
            className="w-full rounded-xl mt-3 font-medium h-9 text-xs"
          >
            Got It
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
