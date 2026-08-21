import { useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AnomalyAlert, dismissAnomaly } from '@/hooks/useAnomalyAlerts';

interface Props {
  alerts: AnomalyAlert[];
}

const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const money = (n: number) => `Rs ${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;

export const AnomalyAlertsPanel = ({ alerts }: Props) => {
  const [selected, setSelected] = useState<AnomalyAlert | null>(null);

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <TrendingUp className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No unusual activity</p>
        <p className="text-xs">Spikes and drops by shop, reason or size will appear here</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="max-h-[300px]">
        <div className="divide-y">
          {alerts.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-full shrink-0 ${
                    a.severity === 'high' ? 'bg-destructive/10' : 'bg-primary/10'
                  }`}
                >
                  {a.direction === 'drop' ? (
                    <TrendingDown
                      className={`h-4 w-4 ${a.severity === 'high' ? 'text-destructive' : 'text-primary'}`}
                    />
                  ) : (
                    <AlertTriangle
                      className={`h-4 w-4 ${a.severity === 'high' ? 'text-destructive' : 'text-primary'}`}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.shopName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.actual} vs {a.expected} expected · {fmt(a.windowStart)}–{fmt(a.windowEnd)}
                  </p>
                  {a.valueDelta !== 0 && (
                    <p className="text-xs font-medium mt-0.5">
                      {a.valueDelta > 0 ? '+' : '−'}{money(a.valueDelta)} lost value vs usual
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={e => {
                    e.stopPropagation();
                    dismissAnomaly(a.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {selected.title}
                </DialogTitle>
                <DialogDescription>
                  {selected.shopName} · {fmt(selected.windowStart)}–{fmt(selected.windowEnd)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Actual</p>
                  <p className="text-xl font-semibold">{selected.actual}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="text-xl font-semibold">{selected.expected}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Lost value</p>
                  <p className="text-xl font-semibold">{money(selected.valueAtStake)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Severity</p>
                  <Badge
                    variant={selected.severity === 'high' ? 'destructive' : 'secondary'}
                    className="mt-1 capitalize"
                  >
                    {selected.severity}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Matching visits ({selected.entries.length})</p>
                <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
                  {selected.entries.map(e => (
                    <div key={e.id} className="p-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium truncate">{e.reason}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                      </div>
                      {e.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{e.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  dismissAnomaly(selected.id);
                  setSelected(null);
                }}
              >
                Dismiss alert
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
