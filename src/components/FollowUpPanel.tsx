import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  BellRing, IndianRupee, MessageCircle, Target, TrendingUp, Trophy, User, Sparkles, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFollowUps, OUTCOME_LABELS, type FollowUpOutcome, type FollowUpRow } from '@/hooks/useFollowUps';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

const outcomeTone: Record<FollowUpOutcome, string> = {
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  no_reply: 'bg-muted text-muted-foreground',
  replied: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
  converted: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  lost: 'bg-destructive/10 text-destructive border-destructive/30',
};

/** WhatsApp delivery state (sent / delivered / read) for one follow-up message. */
const DeliveryChip = ({ row }: { row: FollowUpRow }) => {
  const state = row.delivery_status || 'queued';
  const map: Record<string, { label: string; cls: string; title: string }> = {
    queued: { label: '○ queued', cls: 'text-muted-foreground', title: 'Waiting for WhatsApp confirmation' },
    sent: { label: '✓ sent', cls: 'text-muted-foreground', title: `Sent ${fmtDate(row.sent_at)}` },
    delivered: { label: '✓✓ delivered', cls: 'text-muted-foreground', title: `Delivered ${fmtDate(row.delivered_at)}` },
    read: { label: '✓✓ read', cls: 'text-sky-600', title: `Read ${fmtDate(row.read_at)}` },
    failed: { label: '! failed', cls: 'text-destructive', title: row.delivery_error || 'Delivery failed' },
  };
  const m = map[state] || map.queued;
  return <span className={`text-[11px] font-medium ${m.cls}`} title={m.title}>{m.label}</span>;
};


const StatCard = ({ icon: Icon, label, value, sub }: any) => (
  <Card className="premium-card">
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent>
  </Card>
);

/** Follow-up outcome tracking, recovered revenue, reminders, timelines and leaderboards. */
export const FollowUpPanel = () => {
  const { isAdmin } = useAuth();
  const {
    rows, loading, reload, updateOutcome, snoozeReminder, saveTarget,
    stats, dueReminders, shopLeaderboard, staffLeaderboard, timelineFor, targets, monthKey,
  } = useFollowUps();

  const [editing, setEditing] = useState<FollowUpRow | null>(null);
  const [outcome, setOutcome] = useState<FollowUpOutcome>('pending');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [timelinePhone, setTimelinePhone] = useState<string | null>(null);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [digestBusy, setDigestBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('shops').select('id,name').is('deleted_at', null).order('name');
      setShops((data as any) || []);
    })();
  }, []);

  const openEdit = (r: FollowUpRow) => {
    setEditing(r);
    setOutcome(r.outcome);
    setAmount(r.recovered_amount ? String(r.recovered_amount) : '');
    setNote(r.outcome_note || '');
  };

  const commit = async () => {
    if (!editing) return;
    try {
      await updateOutcome(editing.id, {
        outcome,
        recovered_amount: outcome === 'converted' ? Number(amount || 0) : 0,
        outcome_note: note || undefined,
        next_reminder_at: outcome === 'pending' ? new Date(Date.now() + 3 * 86400000).toISOString() : null,
      });
      toast.success('Outcome updated');
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    }
  };

  const timeline = useMemo(() => (timelinePhone ? timelineFor(timelinePhone) : []), [timelinePhone, timelineFor]);

  const sendDigest = async () => {
    try {
      setDigestBusy(true);
      const { data, error } = await supabase.functions.invoke('ai-weekly-digest', { body: {} });
      if (error) throw error;
      toast.success((data as any)?.message || 'Weekly digest sent');
    } catch (e: any) {
      toast.error(e.message || 'Could not send digest');
    } finally {
      setDigestBusy(false);
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={MessageCircle} label="Follow-ups sent" value={stats.total} sub={`${stats.pending} awaiting reply`} />
        <StatCard icon={TrendingUp} label="Conversion rate" value={`${stats.conversionRate.toFixed(1)}%`} sub={`${stats.convertedCount} converted`} />
        <StatCard icon={IndianRupee} label="Recovered revenue" value={inr(stats.recovered)} sub={`avg ${inr(stats.avgRecovered)}`} />
        <StatCard icon={BellRing} label="Reminders due" value={dueReminders.length} sub="pending, past due date" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
        {isAdmin && (
          <Button size="sm" onClick={sendDigest} disabled={digestBusy}>
            <Sparkles className="h-4 w-4 mr-2" /> {digestBusy ? 'Generating…' : 'Send AI weekly digest'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="reminders">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="log">Audit trail</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboards</TabsTrigger>
          {isAdmin && <TabsTrigger value="targets">Targets</TabsTrigger>}
        </TabsList>

        <TabsContent value="reminders" className="mt-3">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-base">Follow-ups needing another nudge</CardTitle>
              <CardDescription>Automatically scheduled after each message; snooze or close them here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {dueReminders.length === 0 && <p className="text-sm text-muted-foreground">Nothing due. Great work.</p>}
              {dueReminders.map(r => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">+91 {r.phone} · {r.shop_name || 'Unknown shop'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.reason_label || 'No reason'} · sent {fmtDate(r.sent_at)} by {r.sent_by_name || 'staff'} · stage {r.reminder_stage + 1} · <DeliveryChip row={r} />
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => snoozeReminder(r.id, 3)}>Snooze 3d</Button>
                  <Button size="sm" onClick={() => openEdit(r)}>Set outcome</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-3">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-base">Who messaged whom</CardTitle>
              <CardDescription>Every WhatsApp follow-up sent from this organisation.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Sent</th>
                      <th className="p-2 text-left">Customer</th>
                      <th className="p-2 text-left">Shop</th>
                      <th className="p-2 text-left">By</th>
                      <th className="p-2 text-left">Outcome</th>
                      <th className="p-2 text-right">Recovered</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2 whitespace-nowrap">{fmtDate(r.sent_at)}</td>
                        <td className="p-2 whitespace-nowrap">
                          <button className="underline underline-offset-2" onClick={() => setTimelinePhone(r.phone)}>
                            +91 {r.phone}
                          </button>
                        </td>
                        <td className="p-2 truncate max-w-[160px]">{r.shop_name || '—'}</td>
                        <td className="p-2 truncate max-w-[140px]">{r.sent_by_name || '—'}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={outcomeTone[r.outcome]}>{OUTCOME_LABELS[r.outcome]}</Badge>
                            <DeliveryChip row={r} />
                          </div>
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">{r.recovered_amount ? inr(r.recovered_amount) : '—'}</td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No follow-ups yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Shops</CardTitle>
              <CardDescription>Recovered revenue vs this month's target.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {shopLeaderboard.map((s, i) => (
                <div key={s.shop + i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{i + 1}. {s.shop}</span>
                    <span className="text-sm font-semibold">{inr(s.recovered)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.sent} sent · {s.converted} converted ({s.conversionRate.toFixed(0)}%)
                    {s.targetRecovered > 0 && ` · target ${inr(s.targetRecovered)} (${Math.min(100, (s.recovered / s.targetRecovered) * 100).toFixed(0)}%)`}
                  </p>
                  {s.targetRecovered > 0 && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.min(100, (s.recovered / s.targetRecovered) * 100)}%` }} />
                    </div>
                  )}
                </div>
              ))}
              {shopLeaderboard.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Staff</CardTitle>
              <CardDescription>Who is recovering the most lost sales.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {staffLeaderboard.map((s, i) => (
                <div key={s.name + i} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{i + 1}. {s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.sent} sent · {s.converted} converted</p>
                  </div>
                  <span className="text-sm font-semibold">{inr(s.recovered)}</span>
                </div>
              ))}
              {staffLeaderboard.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="targets" className="mt-3">
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Monthly shop targets</CardTitle>
                <CardDescription>Set follow-up and recovery goals for {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {shops.map(shop => {
                  const t = targets.find(t => t.shop_id === shop.id && String(t.period_month).slice(0, 7) === monthKey.slice(0, 7));
                  return (
                    <TargetRow
                      key={shop.id}
                      shop={shop}
                      followups={t?.target_followups ?? 0}
                      recovered={Number(t?.target_recovered ?? 0)}
                      onSave={(f, r) => saveTarget(shop.id, monthKey, f, r).then(() => toast.success(`${shop.name} target saved`))}
                    />
                  );
                })}
                {shops.length === 0 && <p className="text-sm text-muted-foreground">Add shops first.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Outcome editor */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Follow-up outcome</DialogTitle>
            <DialogDescription>+91 {editing?.phone} · {editing?.shop_name || 'Unknown shop'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as FollowUpOutcome)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(OUTCOME_LABELS) as FollowUpOutcome[]).map(k => (
                    <SelectItem key={k} value={k}>{OUTCOME_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {outcome === 'converted' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Recovered sale amount (₹)</Label>
                <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[70px] text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={commit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer timeline */}
      <Dialog open={!!timelinePhone} onOpenChange={(v) => !v && setTimelinePhone(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Customer timeline · +91 {timelinePhone}</DialogTitle>
            <DialogDescription>Every visit follow-up recorded for this customer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {timeline.map(t => (
              <div key={t.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{fmtDate(t.sent_at)} · {t.shop_name || 'Unknown shop'}</span>
                  <Badge variant="outline" className={outcomeTone[t.outcome]}>{OUTCOME_LABELS[t.outcome]}</Badge>
                </div>
                {t.reason_label && <p className="text-sm mt-1">Reason: {t.reason_label}</p>}
                {t.recovered_amount > 0 && <p className="text-sm text-emerald-600">Recovered {inr(t.recovered_amount)}</p>}
                {t.message && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">{t.message}</p>}
              </div>
            ))}
            {timeline.length === 0 && <p className="text-sm text-muted-foreground">No history.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TargetRow = ({ shop, followups, recovered, onSave }: {
  shop: { id: string; name: string };
  followups: number;
  recovered: number;
  onSave: (f: number, r: number) => void;
}) => {
  const [f, setF] = useState(String(followups));
  const [r, setR] = useState(String(recovered));
  useEffect(() => { setF(String(followups)); setR(String(recovered)); }, [followups, recovered]);
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end rounded-lg border p-3">
      <div className="min-w-0">
        <Label className="text-xs">Shop</Label>
        <p className="text-sm font-medium truncate">{shop.name}</p>
      </div>
      <div>
        <Label className="text-xs">Follow-ups</Label>
        <Input className="w-28" inputMode="numeric" value={f} onChange={(e) => setF(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div>
        <Label className="text-xs">Recovered ₹</Label>
        <Input className="w-32" inputMode="numeric" value={r} onChange={(e) => setR(e.target.value.replace(/[^0-9.]/g, ''))} />
      </div>
      <Button size="sm" onClick={() => onSave(Number(f || 0), Number(r || 0))}>Save</Button>
    </div>
  );
};
