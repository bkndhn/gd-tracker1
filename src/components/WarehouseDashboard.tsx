import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemedSearchInput } from '@/components/ThemedSearchInput';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRequirements, type StockRequirement, type RequirementStatus } from '@/hooks/useRequirements';
import {
  Clock,
  PackageCheck,
  Truck,
  CheckCircle2,
  Layers,
  Store,
  Search,
  Filter,
  Package,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react';
import { formatISTShort } from '@/lib/dateUtils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';

const STAGE_COLORS = ['hsl(38 92% 50%)', 'hsl(217 91% 60%)', 'hsl(262 83% 58%)', 'hsl(152 69% 40%)', 'hsl(0 72% 51%)'];
const hrs = (a?: string | null, b?: string | null) =>
  a && b ? Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600000) : null;
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const fmtH = (h: number | null) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)}m` : h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`);

const statusConfig: Record<RequirementStatus, { label: string; badgeClass: string; icon: any }> = {
  requested: {
    label: 'Requested',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    icon: Clock,
  },
  packed: {
    label: 'Packed & Staged',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    icon: PackageCheck,
  },
  moved: {
    label: 'In Transit',
    badgeClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
    icon: Truck,
  },
  received: {
    label: 'Delivered',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Cancelled',
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
    icon: Clock,
  },
};

export const WarehouseDashboard = () => {
  const { requirements, loading } = useRequirements();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Metrics from real requirements
  const pendingRequests = requirements.filter(r => r.status === 'requested');
  const packedOrders = requirements.filter(r => r.status === 'packed');
  const inTransitMoved = requirements.filter(r => r.status === 'moved');
  const completedReceived = requirements.filter(r => r.status === 'received');

  const rejected = requirements.filter(r => r.status === 'rejected');
  const funnel = [
    { name: 'Requested', value: requirements.length },
    { name: 'Packed', value: requirements.filter(r => r.packed_at).length },
    { name: 'Moved', value: requirements.filter(r => r.moved_at).length },
    { name: 'Received', value: completedReceived.length },
  ];
  const statusPie = [
    { name: 'Pending', value: pendingRequests.length },
    { name: 'Packed', value: packedOrders.length },
    { name: 'Moved', value: inTransitMoved.length },
    { name: 'Received', value: completedReceived.length },
    { name: 'Cancelled', value: rejected.length },
  ].filter(d => d.value > 0);
  const byShop = useMemo(() => {
    const m = new Map<string, number>();
    requirements.forEach(r => m.set(r.shop_name || 'Shop', (m.get(r.shop_name || 'Shop') || 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [requirements]);
  const topPeople = (key: 'requested_by_name' | 'packed_by_name' | 'moved_by_name') => {
    const m = new Map<string, number>();
    requirements.forEach(r => { const n = r[key]; if (n) m.set(n, (m.get(n) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  };
  const tPack = avg(requirements.map(r => hrs(r.created_at, r.packed_at)));
  const tMove = avg(requirements.map(r => hrs(r.packed_at, r.moved_at)));
  const tRecv = avg(requirements.map(r => hrs(r.moved_at, r.received_at)));
  const tTotal = avg(requirements.map(r => hrs(r.created_at, r.received_at)));

  // Filtered requirements list
  const filteredRequirements = useMemo(() => {
    return requirements.filter(r => {
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchSearch =
        !searchTerm.trim() ||
        r.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.shop_name && r.shop_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.note && r.note.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.requested_by_name && r.requested_by_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.packed_by_name && r.packed_by_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.moved_by_name && r.moved_by_name.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [requirements, searchTerm, statusFilter]);

  return (
    <div className="space-y-4">
      {/* 4 Stage KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <Clock className="h-4 w-4" /> Pending Requests
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {pendingRequests.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-[11px] text-muted-foreground">Awaiting packing</span>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
              <PackageCheck className="h-4 w-4" /> Packed & Staged
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {packedOrders.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-[11px] text-muted-foreground">Ready for transit</span>
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-400">
              <Truck className="h-4 w-4" /> In Transit (Moved)
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {inTransitMoved.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-[11px] text-muted-foreground">En route to shops</span>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Completed Delivered
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {completedReceived.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-[11px] text-muted-foreground">Received by shop</span>
          </CardContent>
        </Card>
      </div>

      {requirements.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {[['Request → Packed', tPack], ['Packed → Moved', tMove], ['Moved → Received', tRecv], ['Total turnaround', tTotal]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Avg {l as string}</p>
                <p className="text-lg font-bold text-foreground">{fmtH(v as number | null)}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <Card><CardHeader className="p-3 pb-0"><CardTitle className="text-sm">Fulfilment funnel</CardTitle></CardHeader>
              <CardContent className="p-2 h-52"><ResponsiveContainer><BarChart data={funnel}><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={28} /><Tooltip /><Bar dataKey="value" radius={[6, 6, 0, 0]}>{funnel.map((_, i) => <Cell key={i} fill={STAGE_COLORS[i]} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
            <Card><CardHeader className="p-3 pb-0"><CardTitle className="text-sm">Current status</CardTitle></CardHeader>
              <CardContent className="p-2 h-52"><ResponsiveContainer><PieChart><Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} label={{ fontSize: 11 }}>{statusPie.map(d => <Cell key={d.name} fill={STAGE_COLORS[['Pending','Packed','Moved','Received','Cancelled'].indexOf(d.name)]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card>
            <Card><CardHeader className="p-3 pb-0"><CardTitle className="text-sm">Requests by shop</CardTitle></CardHeader>
              <CardContent className="p-2 h-52"><ResponsiveContainer><BarChart data={byShop} layout="vertical"><XAxis type="number" allowDecimals={false} fontSize={11} /><YAxis type="category" dataKey="name" width={80} fontSize={11} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {([['Top requesters', 'requested_by_name', User], ['Top packers', 'packed_by_name', PackageCheck], ['Top movers', 'moved_by_name', Truck]] as const).map(([title, key, Icon]) => (
              <div key={key} className="rounded-xl border bg-card p-3">
                <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Icon className="h-4 w-4 text-primary" />{title}</p>
                {topPeople(key).length === 0 ? <p className="text-xs text-muted-foreground">No data yet</p> :
                  topPeople(key).map(([n, c]) => (
                    <div key={n} className="flex justify-between text-xs py-1"><span className="truncate">{n}</span><span className="font-bold">{c}</span></div>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Live Requirement Status & Fulfillment Feed */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Layers className="h-5 w-5 text-primary" /> Requirement Requests & Fulfillment Status
              </CardTitle>
              <CardDescription>
                Live status tracking for sizes requested by shops with pack, move, and delivery audit trails.
              </CardDescription>
            </div>
            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-full sm:w-60">
                <ThemedSearchInput
                  placeholder="Search shop, size, staff..."
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                  className="h-9 text-xs"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-11 sm:h-9 text-xs">
                  <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="requested">Pending (Requested)</SelectItem>
                  <SelectItem value="packed">Packed</SelectItem>
                  <SelectItem value="moved">In Transit (Moved)</SelectItem>
                  <SelectItem value="received">Delivered</SelectItem>
                  <SelectItem value="rejected">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-lg bg-muted/60 animate-pulse" />
              ))}
            </div>
          ) : filteredRequirements.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed rounded-lg bg-muted/10">
              <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <h3 className="font-semibold text-sm text-foreground">No requirement requests found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try clearing the search or status filter to see more requests.'
                  : 'Shop staff can request required sizes from the Requirements tab.'}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px] pr-2">
              <div className="space-y-3">
                {filteredRequirements.map(req => {
                  const statusInfo = statusConfig[req.status] || statusConfig.requested;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div
                      key={req.id}
                      className="group rounded-xl border border-border/70 p-3 sm:p-4 bg-card hover:bg-muted/20 hover:border-border transition-all shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Size, Quantity & Shop Badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm sm:text-base text-foreground">
                              Size {req.size}
                            </span>
                            <Badge variant="outline" className="font-semibold px-2 py-0 text-xs">
                              × {req.quantity} pcs
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`gap-1 text-xs capitalize ${statusInfo.badgeClass}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusInfo.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1 font-medium ml-1">
                              <Store className="h-3.5 w-3.5 text-primary" />
                              {req.shop_name || 'Shop'}
                            </span>
                          </div>

                          {/* Progress Audit Trail */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1.5">
                            {([
                              ['Requested', req.requested_by_name || 'Staff', req.created_at, 0],
                              ['Packed', req.packed_by_name, req.packed_at, 1],
                              ['Moved', req.moved_by_name, req.moved_at, 2],
                              ['Received', req.received_by_name, req.received_at, 3],
                            ] as const).map(([label, who, at, i]) => (
                              <div key={label} className={`rounded-lg border px-2 py-1.5 text-[11px] leading-tight ${at ? 'bg-muted/40' : 'opacity-50 border-dashed'}`}>
                                <div className="flex items-center gap-1 font-semibold" style={{ color: at ? STAGE_COLORS[i] : undefined }}>
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STAGE_COLORS[i] }} />{label}
                                </div>
                                <div className="text-foreground truncate">{who || 'Pending'}</div>
                                <div className="text-muted-foreground">{at ? formatISTShort(at) : '—'}</div>
                              </div>
                            ))}
                          </div>
                          {req.status === 'rejected' && (
                            <p className="text-[11px] text-destructive">Cancelled by {req.rejected_by_name || 'staff'}{req.reject_reason ? ` — ${req.reject_reason}` : ''}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {req.category ? `${req.category} · ` : ''}Urgency: {req.urgency}{req.packed_qty != null ? ` · Packed qty ${req.packed_qty}` : ''}{hrs(req.created_at, req.received_at) !== null ? ` · Turnaround ${fmtH(hrs(req.created_at, req.received_at))}` : ''}
                          </p>
                        </div>
                        </div>

                        {/* Optional notes */}
                        {req.note && (
                          <div className="sm:text-right shrink-0">
                            <span className="inline-block text-xs bg-muted/60 border rounded-md px-2.5 py-1 text-muted-foreground max-w-xs truncate" title={req.note}>
                              {req.note}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
