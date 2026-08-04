import { useState } from 'react';
import { CloudOff, RefreshCw, Clock, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useOfflineSync } from '@/hooks/useOfflineSync';

const timeAgo = (ts: number) => {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

/**
 * Persistent connectivity strip: Offline / Syncing / Queued, plus a sheet
 * listing every queued entry with retry & discard controls.
 */
export const OfflineStatusBar = () => {
  const {
    isOnline,
    isSyncing,
    items,
    pendingCount,
    failedCount,
    manualSync,
    retryItem,
    discardItem,
  } = useOfflineSync();
  const [open, setOpen] = useState(false);

  if (isOnline && items.length === 0) return null;

  const tone = !isOnline
    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30'
    : failedCount > 0
      ? 'bg-destructive/10 text-destructive border-destructive/30'
      : 'bg-primary/10 text-primary border-primary/30';

  const label = !isOnline
    ? pendingCount > 0
      ? `Offline · ${pendingCount} waiting to send`
      : 'Offline · changes save on this device'
    : isSyncing
      ? `Syncing ${pendingCount || ''}`.trim()
      : failedCount > 0
        ? `${failedCount} entr${failedCount === 1 ? 'y' : 'ies'} failed to send`
        : `${pendingCount} queued`;

  return (
    <div className={`flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs ${tone}`}>
      <div className="flex min-w-0 items-center gap-2">
        {!isOnline ? (
          <CloudOff className="h-3.5 w-3.5 shrink-0" />
        ) : isSyncing ? (
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : failedCount > 0 ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Clock className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate font-medium">{label}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {items.length > 0 && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                View
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Outbox</SheetTitle>
                <SheetDescription>
                  Entries saved on this device. They send automatically when you are back online.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {timeAgo(item.createdAt)}
                          {item.images.length > 0 && ` · ${item.images.length} image(s)`}
                          {item.voiceNote && ' · voice note'}
                        </p>
                        {item.lastError && (
                          <p className="mt-1 text-xs text-destructive">{item.lastError}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs capitalize text-muted-foreground">
                        {item.status === 'sending' ? 'Sending…' : item.status}
                      </span>
                    </div>
                    {item.status === 'failed' && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => retryItem(item.id)}>
                          Retry
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => discardItem(item.id)}>
                          Discard
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Check className="h-4 w-4" /> Everything is synced.
                  </p>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}
        {isOnline && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={manualSync} disabled={isSyncing}>
            Sync now
          </Button>
        )}
      </div>
    </div>
  );
};
