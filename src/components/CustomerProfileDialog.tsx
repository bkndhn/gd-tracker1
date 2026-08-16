import { useState, type ReactNode } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { User, Phone, TrendingUp, CalendarDays, MessageCircle, Store } from 'lucide-react';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { OUTCOME_LABELS } from '@/hooks/useFollowUps';

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const tagTone: Record<string, string> = {
  'Repeat visitor': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  'Price-sensitive': 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  'Size / stock gap': 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  'Service issue': 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  'Recovered before': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  'Never replies': 'bg-muted text-muted-foreground',
};

interface Props {
  phone: string;
  customerName?: string | null;
  trigger?: ReactNode;
}

/** Full customer timeline: every visit and follow-up for one phone number. */
export const CustomerProfileDialog = ({ phone, customerName, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const { profile, loading } = useCustomerProfile(phone, open);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Customer profile">
            <User className="h-4 w-4 text-primary" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            {customerName || 'Customer'} · {phone}
          </DialogTitle>
          <DialogDescription>Every visit and follow-up recorded for this number.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-muted" />)}
          </div>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">No history found for this number.</p>
        ) : (
          <ScrollArea className="flex-1 pr-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Visits</p>
                <p className="text-lg font-semibold">{profile.visits.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Follow-ups</p>
                <p className="text-lg font-semibold">{profile.followUps.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Converted</p>
                <p className="text-lg font-semibold text-emerald-600">{profile.convertedCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Lifetime recovered</p>
                <p className="text-lg font-semibold text-emerald-600">{inr(profile.lifetimeRecovered)}</p>
              </div>
            </div>

            {profile.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.tags.map(t => (
                  <Badge key={t} variant="outline" className={`text-[10px] ${tagTone[t] || ''}`}>{t}</Badge>
                ))}
              </div>
            )}

            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              First seen {fmt(profile.firstSeen)} · Last seen {fmt(profile.lastSeen)}
            </p>

            <Separator className="my-4" />

            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Store className="h-4 w-4 text-primary" /> Visits
            </h4>
            {profile.visits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits logged.</p>
            ) : (
              <div className="space-y-2">
                {profile.visits.map(v => (
                  <div key={v.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{v.shopName || 'Unknown shop'}</p>
                      <span className="text-xs text-muted-foreground">{fmt(v.created_at)}</span>
                    </div>
                    {v.reason && <p className="mt-1 text-xs text-amber-600">Reason: {v.reason}</p>}
                    {Object.keys(v.fields).length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Object.entries(v.fields).map(([k, val]) => `${k}: ${val}`).join(' · ')}
                      </p>
                    )}
                    {v.notes && <p className="mt-1 line-clamp-2 text-xs">{v.notes}</p>}
                    {v.employee_name && <p className="mt-1 text-[11px] text-muted-foreground">Logged by {v.employee_name}</p>}
                  </div>
                ))}
              </div>
            )}

            <Separator className="my-4" />

            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <MessageCircle className="h-4 w-4 text-primary" /> Follow-ups
            </h4>
            {profile.followUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups sent yet.</p>
            ) : (
              <div className="space-y-2 pb-2">
                {profile.followUps.map(f => (
                  <div key={f.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">{OUTCOME_LABELS[f.outcome] || f.outcome}</Badge>
                      <span className="text-xs text-muted-foreground">{fmt(f.sent_at)}</span>
                    </div>
                    {f.message && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.message}</p>}
                    <p className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                      {f.sent_by_name && <span>By {f.sent_by_name}</span>}
                      {f.delivery_status && <span>{f.delivery_status}</span>}
                      {f.recovered_amount > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <TrendingUp className="h-3 w-3" /> {inr(f.recovered_amount)}
                        </span>
                      )}
                    </p>
                    {f.outcome_note && <p className="mt-1 text-xs">{f.outcome_note}</p>}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
