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
  BellRing, IndianRupee, MessageCircle, Target, TrendingUp, Trophy, User, Sparkles, RefreshCw, Clock, FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFollowUps, OUTCOME_LABELS, type FollowUpOutcome, type FollowUpRow } from '@/hooks/useFollowUps';
import { RecoveryAttributionPanel } from '@/components/RecoveryAttributionPanel';
import { ShopRecoveryDrilldown } from '@/components/ShopRecoveryDrilldown';
import { SettingsAuditLog } from '@/components/admin/SettingsAuditLog';
import { useAdminSetting } from '@/hooks/useAdminSetting';
import {
  RESET_LABELS, normalizeReset, periodStart, periodLabel, type LeaderboardReset,
} from '@/lib/leaderboardPeriod';
import { formatISTShort } from '@/lib/dateUtils';
import { MaskedPhone } from '@/components/MaskedPhone';


const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) =>
  d ? formatISTShort(d) : '—';

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
  const { isAdmin, adminId, isSuperAdmin, profile } = useAuth();
  const effectiveAdminId = adminId || (profile as any)?.admin_id || profile?.id;
  const {
    rows, loading, reload, updateOutcome, snoozeReminder, saveTarget,
    stats, dueReminders, timelineFor, targets, monthKey,
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
      let shopsQuery = supabase.from('shops').select('id,name').is('deleted_at', null).order('name');
      if (!isSuperAdmin && effectiveAdminId) {
        shopsQuery = shopsQuery.eq('admin_id', effectiveAdminId);
      }
      const { data } = await shopsQuery;
      setShops((data as any) || []);
    })();
  }, [effectiveAdminId, isSuperAdmin]);

  // Leaderboard reset rule (per tenant) + the window it produces.
  const { value: resetRule, save: saveReset, canEdit: canEditReset } =
    useAdminSetting<LeaderboardReset>('leaderboard_reset', 'monthly', normalizeReset);
  const [drillShop, setDrillShop] = useState<{ key: string; name: string } | null>(null);

  const windowStart = useMemo(() => periodStart(resetRule), [resetRule]);
  const windowRows = useMemo(
    () => rows.filter(r => new Date(r.sent_at).getTime() >= windowStart),
    [rows, windowStart],
  );
  const shopKey = (r: FollowUpRow) => r.shop_id || r.shop_name || 'unknown';

  const periodShopBoard = useMemo(() => {
    const map = new Map<string, { key: string; shopId: string | null; shop: string; sent: number; converted: number; recovered: number }>();
    windowRows.forEach(r => {
      const key = shopKey(r);
      const cur = map.get(key) || { key, shopId: r.shop_id, shop: r.shop_name || 'Unknown shop', sent: 0, converted: 0, recovered: 0 };
      cur.sent += 1;
      if (r.outcome === 'converted') { cur.converted += 1; cur.recovered += Number(r.recovered_amount || 0); }
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map(v => {
        const t = targets.find(t => t.shop_id === v.shopId && String(t.period_month).slice(0, 7) === monthKey.slice(0, 7));
        return {
          ...v,
          conversionRate: v.sent ? (v.converted / v.sent) * 100 : 0,
          targetRecovered: Number(t?.target_recovered ?? 0),
        };
      })
      .sort((a, b) => b.recovered - a.recovered || b.converted - a.converted);
  }, [windowRows, targets, monthKey]);

  const periodStaffBoard = useMemo(() => {
    const map = new Map<string, { name: string; sent: number; converted: number; recovered: number }>();
    windowRows.forEach(r => {
      const cur = map.get(r.sent_by) || { name: r.sent_by_name || 'Unknown', sent: 0, converted: 0, recovered: 0 };
      cur.sent += 1;
      if (r.outcome === 'converted') { cur.converted += 1; cur.recovered += Number(r.recovered_amount || 0); }
      map.set(r.sent_by, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.recovered - a.recovered || b.converted - a.converted);
  }, [windowRows]);

  const drillRows = useMemo(
    () => (drillShop ? windowRows.filter(r => shopKey(r) === drillShop.key) : []),
    [drillShop, windowRows],
  );
  const drillTarget = periodShopBoard.find(s => s.key === drillShop?.key)?.targetRecovered ?? 0;


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

      <Tabs defaultValue="attribution" className="space-y-4">
        <div className="overflow-x-auto no-scrollbar pb-1">
          <TabsList className="w-full inline-flex sm:grid sm:grid-cols-5 h-auto p-1.5 gap-1.5 bg-muted/60 border rounded-xl min-w-max sm:min-w-0">
            <TabsTrigger
              value="attribution"
              className="group flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/20 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50"
            >
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500 group-data-[state=active]:text-white transition-colors" />
              <span>Revenue attribution</span>
            </TabsTrigger>
            <TabsTrigger
              value="reminders"
              className="group flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/20 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50"
            >
              <Clock className="h-4 w-4 shrink-0 text-amber-500 group-data-[state=active]:text-white transition-colors" />
              <span>Reminders</span>
              {dueReminders.length > 0 && (
                <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white font-bold">
                  {dueReminders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="group flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/20 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50"
            >
              <Trophy className="h-4 w-4 shrink-0 text-violet-500 group-data-[state=active]:text-white transition-colors" />
              <span>Leaderboards</span>
            </TabsTrigger>
            <TabsTrigger
              value="log"
              className="group flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-500/20 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50"
            >
              <FileText className="h-4 w-4 shrink-0 text-blue-500 group-data-[state=active]:text-white transition-colors" />
              <span>Audit trail</span>
              <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted-foreground/15 text-foreground group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white font-bold">
                {rows.length}
              </span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="targets"
                className="group flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-rose-500/20 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50"
              >
                <Target className="h-4 w-4 shrink-0 text-rose-500 group-data-[state=active]:text-white transition-colors" />
                <span>Targets</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="attribution" className="mt-3">
          <RecoveryAttributionPanel rows={rows} targets={targets} monthKey={monthKey} />
        </TabsContent>


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
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      <MaskedPhone phone={r.phone} context="reminder_list" showWhatsAppBtn />
                      <span className="text-muted-foreground">·</span>
                      <span className="truncate">{r.shop_name || 'Unknown shop'}</span>
                    </div>
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
                          <MaskedPhone
                            phone={r.phone}
                            context="follow_up_audit_trail"
                            onTimelineClick={(p) => setTimelinePhone(p)}
                            showWhatsAppBtn
                          />
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

        <TabsContent value="leaderboard" className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{periodLabel(resetRule)}</span> · {windowRows.length} follow-ups
            </p>
            {canEditReset && (
              <Select
                value={resetRule}
                onValueChange={(v) => saveReset(v as LeaderboardReset).then(() => toast.success('Leaderboard period updated'))}
              >
                <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RESET_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Shops</CardTitle>
              <CardDescription>Recovered revenue vs this month's target. Tap a shop for the breakdown.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {periodShopBoard.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setDrillShop({ key: s.key, name: s.shop })}
                  className="w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
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
                </button>
              ))}
              {periodShopBoard.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Staff</CardTitle>
              <CardDescription>Who is recovering the most lost sales.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {periodStaffBoard.map((s, i) => (
                <div key={s.name + i} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{i + 1}. {s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.sent} sent · {s.converted} converted</p>
                  </div>
                  <span className="text-sm font-semibold">{inr(s.recovered)}</span>
                </div>
              ))}
              {periodStaffBoard.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            </CardContent>
          </Card>
          </div>
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
                      onSave={(f, r) => saveTarget(shop.id, monthKey, f, r, shop.name).then(() => toast.success(`${shop.name} target saved`))}
                    />
                  );
                })}
                {shops.length === 0 && <p className="text-sm text-muted-foreground">Add shops first.</p>}

                {/* Who changed which shop target, and when */}
                <SettingsAuditLog
                  settingKey="shop_targets"
                  onRollback={(v: any) =>
                    saveTarget(v.shopId, v.month, Number(v.target_followups || 0), Number(v.target_recovered || 0), v.shopName)
                  }
                />

                {/* Leaderboard reset rule history */}
                <SettingsAuditLog
                  settingKey="leaderboard_reset"
                  onRollback={(v: any) => saveReset(normalizeReset(v))}
                />
              </CardContent>
            </Card>

          </TabsContent>
        )}
      </Tabs>

      <ShopRecoveryDrilldown
        open={!!drillShop}
        onOpenChange={(v) => !v && setDrillShop(null)}
        shopName={drillShop?.name || ''}
        periodLabel={periodLabel(resetRule)}
        rows={drillRows}
        targetRecovered={drillTarget}
      />



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
