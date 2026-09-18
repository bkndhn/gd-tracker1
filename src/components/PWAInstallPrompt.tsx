import React from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { X, Download, Share, PlusSquare, Check } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export const PWAInstallPrompt: React.FC = () => {
  const {
    isInstalled,
    isIOS,
    promptInstall,
    initialPromptVisible,
    dismissInitialPrompt,
    iosModalOpen,
    setIosModalOpen,
  } = usePWAInstall();

  if (isInstalled) return null;

  return (
    <>
      {/* Floating Initial Banner for Non-Installed Phones */}
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
                onClick={promptInstall}
                className="h-8 px-3 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                {isIOS ? 'How to Add' : 'Install'}
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

      {/* iOS Step-by-Step Installation Dialog */}
      <Dialog open={iosModalOpen} onOpenChange={setIosModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-6 sm:max-w-md">
          <DialogHeader className="text-left space-y-2">
            <div className="mb-1">
              <AppLogo variant="icon" size="lg" animated />
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold">
              Install on iPhone or iPad
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Follow these simple steps in Safari to add Lost Sale Insights to your Home Screen:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 my-2">
            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/50 border border-border/50">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              <div className="text-xs text-foreground leading-relaxed">
                Tap the <span className="font-semibold inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background border text-primary"><Share className="h-3 w-3" /> Share</span> button at the bottom of Safari.
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/50 border border-border/50">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </span>
              <div className="text-xs text-foreground leading-relaxed">
                Scroll down and tap <span className="font-semibold inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background border"><PlusSquare className="h-3 w-3 text-foreground" /> Add to Home Screen</span>.
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/50 border border-border/50">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </span>
              <div className="text-xs text-foreground leading-relaxed">
                Tap <span className="font-semibold text-primary">Add</span> in the top right corner. The app icon will appear on your phone home screen!
              </div>
            </div>
          </div>

          <Button
            onClick={() => setIosModalOpen(false)}
            className="w-full rounded-xl mt-2 font-medium"
          >
            Got It
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
