import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRequirements, type StockRequirement, type RequirementStatus } from '@/hooks/useRequirements';
import { RequirementsReport } from '@/components/RequirementsReport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PackagePlus, Filter, Search, Truck, PackageCheck, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_TONE: Record<string, string> = {
  requested: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  packed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  moved: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  received: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-destructive/15 text-destructive',
};

export const RequirementsPanel = () => {
  const { profile, user } = useAuth();
  const p = profile as any;
  const role = p?.role as string | undefined;
  const isWarehouse = role === 'warehouse';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isManager = role === 'manager';

  const { requirements, visibleShops, loading, saving, createRequirement, updateStatus } = useRequirements();

  const [sizes, setSizes] = useState<{ id: string; size: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // form
  const [form, setForm] = useState({
    shop_id: p?.shop_id || '',
    size: '',
    category: '',
    quantity: 1,
    urgency: 'normal',
    note: '',
  });

  // filters
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RequirementStatus>('all');
  const [shopFilter, setShopFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // action dialog
  const [action, setAction] = useState<{ req: StockRequirement; to: RequirementStatus } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionQty, setActionQty] = useState<number | ''>('');

  useEffect(() => {
    (async () => {
      const [sizeRes, catRes] = await Promise.all([
        supabase.from('sizes').select('id, size').is('deleted_at', null).order('size'),
        supabase.from('categories').select('id, name').is('deleted_at', null).order('name'),
      ]);
      if (!sizeRes.error) setSizes((sizeRes.data || []) as any);
      if (!catRes.error) setCategories((catRes.data || []) as any);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 86400000 : null;
    return requirements.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (shopFilter !== 'all' && r.shop_id !== shopFilter) return false;
      if (urgencyFilter !== 'all' && r.urgency !== urgencyFilter) return false;
      const t = new Date(r.created_at).getTime();
      if (from && t < from) return false;
      if (to && t > to) return false;
      if (q) {
        const hay = [
          r.shop_name, r.size, r.category, r.requested_by_name, r.packed_by_name,
          r.moved_by_name, r.received_by_name, r.status, r.urgency, r.note, r.reject_reason,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requirements, search, statusFilter, shopFilter, urgencyFilter, fromDate, toDate]);

  const selectedRows = useMemo(
    () => filtered.filter(r => selectedIds.has(r.id)),
    [filtered, selectedIds],
  );

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filtered.map(r => r.id)) : new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const submit = async () => {
    if (!form.shop_id) return toast.error('Choose a shop');
    if (!form.size.trim()) return toast.error('Enter the size you need');
    if (!form.quantity || form.quantity < 1) return toast.error('Enter a quantity');
    const ok = await createRequirement({
      shop_id: form.shop_id,
      size: form.size.trim(),
      category: form.category || null,
      quantity: Number(form.quantity),
      urgency: form.urgency,
      note: form.note.trim() || null,
    });
    if (ok) setForm(f => ({ ...f, size: '', category: '', quantity: 1, urgency: 'normal', note: '' }));
  };

  const openAction = (req: StockRequirement, to: RequirementStatus) => {
    setAction({ req, to });
    setActionNote('');
    setActionQty(to === 'packed' ? req.quantity : '');
  };

  const confirmAction = async () => {
    if (!action) return;
    if (action.to === 'rejected' && !actionNote.trim()) return toast.error('Add a reason');
    const ok = await updateStatus(action.req, action.to, {
      packed_qty: actionQty === '' ? null : Number(actionQty),
      note: actionNote.trim() || null,
    });
    if (ok) setAction(null);
  };

  const canFulfil = (r: StockRequirement) => isWarehouse || isAdmin;
  const canReceive = (r: StockRequirement) =>
    isAdmin || isManager || (r.requested_by === user?.id) || (p?.shop_id && r.shop_id === p.shop_id);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="raise">Raise</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        {/* ---------- Raise ---------- */}
        <TabsContent value="raise" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <PackagePlus className="h-5 w-5 text-primary" /> Request stock from the warehouse
              </CardTitle>
              <CardDescription>Tell the warehouse which size you need and where to send it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Shop</Label>
                  <Select value={form.shop_id} onValueChange={v => setForm({ ...form, shop_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                    <SelectContent>
                      {visibleShops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Input
                    list="requirement-sizes"
                    value={form.size}
                    onChange={e => setForm({ ...form, size: e.target.value })}
                    placeholder="e.g. 42"
                  />
                  <datalist id="requirement-sizes">
                    {sizes.map(s => <option key={s.id} value={s.size} />)}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category || 'none'} onValueChange={v => setForm({ ...form, category: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" min={1} value={form.quantity}
                      onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Urgency</Label>
                    <Select value={form.urgency} onValueChange={v => setForm({ ...form, urgency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                  placeholder="Anything the warehouse should know" />
              </div>
              <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Sending…' : 'Send requirement'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Queue ---------- */}
        <TabsContent value="queue" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ClipboardList className="h-5 w-5 text-primary" /> Requirements ({filtered.length})
                </CardTitle>
                <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Filter className="h-4 w-4" /> Filters
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search shop, size, staff, status…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                <CollapsibleContent className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['all', 'requested', 'packed', 'moved', 'received', 'rejected'].map(s => (
                          <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Shop</Label>
                    <Select value={shopFilter} onValueChange={setShopFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All shops</SelectItem>
                        {visibleShops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Urgency</Label>
                    <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setStatusFilter('all'); setShopFilter('all'); setUrgencyFilter('all');
                      setFromDate(''); setToDate(''); setSearch('');
                    }}>Clear filters</Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading requirements…</div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No requirements yet.</div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={v => toggleAll(!!v)}
                    />
                    Select all ({selectedIds.size} ticked)
                  </label>

                  {filtered.map(r => (
                    <div key={r.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <Checkbox
                          className="mt-1"
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={v => toggleOne(r.id, !!v)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">Size {r.size} × {r.quantity}</span>
                            <Badge className={STATUS_TONE[r.status]} variant="secondary">{r.status}</Badge>
                            {r.urgency === 'urgent' && <Badge variant="destructive">urgent</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.shop_name || '—'} · {r.category || 'no category'} · asked by {r.requested_by_name || '—'} on {format(new Date(r.created_at), 'dd MMM HH:mm')}
                          </p>
                          {r.note && <p className="mt-1 text-sm">{r.note}</p>}
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {r.packed_at && <p>Packed by {r.packed_by_name} · {format(new Date(r.packed_at), 'dd MMM HH:mm')}{r.packed_qty != null ? ` · ${r.packed_qty} pcs` : ''}</p>}
                            {r.moved_at && <p>Moved by {r.moved_by_name} · {format(new Date(r.moved_at), 'dd MMM HH:mm')}</p>}
                            {r.received_at && <p>Received by {r.received_by_name} · {format(new Date(r.received_at), 'dd MMM HH:mm')}</p>}
                            {r.rejected_at && <p className="text-destructive">Rejected by {r.rejected_by_name} · {r.reject_reason}</p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {r.status === 'requested' && canFulfil(r) && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => openAction(r, 'packed')}>
                              <PackageCheck className="h-3.5 w-3.5" /> Packed
                            </Button>
                          )}
                          {r.status === 'packed' && canFulfil(r) && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => openAction(r, 'moved')}>
                              <Truck className="h-3.5 w-3.5" /> Moved
                            </Button>
                          )}
                          {r.status === 'moved' && canReceive(r) && (
                            <Button size="sm" className="gap-1" onClick={() => openAction(r, 'received')}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Received
                            </Button>
                          )}
                          {(r.status === 'requested' || r.status === 'packed') && canFulfil(r) && (
                            <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => openAction(r, 'rejected')}>
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Report ---------- */}
        <TabsContent value="report" className="mt-4">
          <RequirementsReport rows={filtered} selected={selectedRows} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!action} onOpenChange={o => !o && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">Mark as {action?.to}</DialogTitle>
            <DialogDescription>
              Size {action?.req.size} × {action?.req.quantity} for {action?.req.shop_name || 'this shop'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {action?.to === 'packed' && (
              <div className="space-y-2">
                <Label>Packed quantity</Label>
                <Input type="number" min={0} value={actionQty}
                  onChange={e => setActionQty(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            )}
            {action?.to !== 'received' && (
              <div className="space-y-2">
                <Label>{action?.to === 'rejected' ? 'Reason' : 'Note (optional)'}</Label>
                <Textarea rows={2} value={actionNote} onChange={e => setActionNote(e.target.value)} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
              <Button onClick={confirmAction}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
