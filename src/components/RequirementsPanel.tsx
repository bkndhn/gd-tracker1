import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRequirements, type StockRequirement, type RequirementStatus } from '@/hooks/useRequirements';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PackagePlus, Filter, Search, Truck, PackageCheck, CheckCircle2, XCircle,
  ClipboardList, Warehouse, Printer, Download, FileText, FileSpreadsheet, User,
} from 'lucide-react';
import { formatISTDateTime, formatISTShort } from '@/lib/dateUtils';
import {
  directPrintFulfillmentSheet,
  exportFulfillmentSheetToExcel,
  exportFulfillmentSheetToPDF,
} from '@/lib/manualFulfillmentSheet';
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
  const [reqCustomFields, setReqCustomFields] = useState<any[]>([]);
  const [reqCustomOptions, setReqCustomOptions] = useState<Record<string, any[]>>({});
  const [customFormValues, setCustomFormValues] = useState<Record<string, string>>({});
  const [requirementCustomValues, setRequirementCustomValues] = useState<Record<string, Record<string, string>>>({});

  // form
  const [form, setForm] = useState({
    shop_id: p?.shop_id || '',
    size: '',
    category: '',
    quantity: 1,
    urgency: 'normal',
    note: '',
  });

  const [isCustomSize, setIsCustomSize] = useState(false);

  // User's assigned shop (matches LostVisitForm pattern)
  const userShop = useMemo(() => {
    if (!p?.shop_id) return null;
    return visibleShops.find(s => s.id === p.shop_id) || null;
  }, [p?.shop_id, visibleShops]);

  // Auto-select shop based on user profile or single shop
  useEffect(() => {
    if (p?.shop_id) {
      setForm(f => ({ ...f, shop_id: p.shop_id }));
    } else if (!form.shop_id && visibleShops.length === 1) {
      setForm(f => ({ ...f, shop_id: visibleShops[0].id }));
    }
  }, [p?.shop_id, visibleShops]);

  // If only 1 category exists, auto-select it
  useEffect(() => {
    if (categories.length === 1 && !form.category) {
      setForm(f => ({ ...f, category: categories[0].name }));
    }
  }, [categories]);

  // Quick-select sizes
  const quickSizes = useMemo(() => {
    if (sizes.length > 0) return sizes.map(s => s.size);
    return ['36', '38', '40', '42', '44', 'S', 'M', 'L', 'XL', 'XXL'];
  }, [sizes]);

  // filters
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RequirementStatus>('all');
  const [shopFilter, setShopFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [requestedByFilter, setRequestedByFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // action dialog
  const [action, setAction] = useState<{ req: StockRequirement; to: RequirementStatus } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionQty, setActionQty] = useState<number | ''>('');

  useEffect(() => {
    (async () => {
      const [sizeRes, catRes, cfRes, cvRes] = await Promise.all([
        supabase.from('sizes').select('id, size').is('deleted_at', null).order('size'),
        supabase.from('categories').select('id, name').is('deleted_at', null).order('name'),
        (supabase.from('custom_fields') as any).select('*').eq('scope', 'requirement').is('deleted_at', null).order('display_order'),
        (supabase.from('gd_entry_custom_values') as any).select('*').not('requirement_id', 'is', null),
      ]);
      if (!sizeRes.error) setSizes((sizeRes.data || []) as any);
      if (!catRes.error) setCategories((catRes.data || []) as any);

      if (cfRes?.data && cfRes.data.length > 0) {
        // Exclude standard or core fields (e.g. Shop, Size, Quantity) so they never create duplicate form inputs
        const CORE_REQ_FIELDS = new Set([
          'shop', 'shops', 'store', 'stores', 'branch', 'branches', 'shop name',
          'size', 'sizes', 'quantity', 'urgency', 'note', 'notes', 'category', 'categories',
        ]);
        const validFields = cfRes.data.filter(
          (f: any) => !f.is_standard && !CORE_REQ_FIELDS.has(f.name.trim().toLowerCase())
        );
        setReqCustomFields(validFields);
        const cfIds = validFields.map((f: any) => f.id);
        if (cfIds.length > 0) {
          const { data: optData } = await (supabase.from('custom_field_options') as any)
            .select('*')
            .in('custom_field_id', cfIds)
            .is('deleted_at', null);
          const map: Record<string, any[]> = {};
          (optData || []).forEach((o: any) => {
            if (!map[o.custom_field_id]) map[o.custom_field_id] = [];
            map[o.custom_field_id].push(o);
          });
          setReqCustomOptions(map);
        }
      }

      if (cvRes?.data && cvRes.data.length > 0) {
        const byReq: Record<string, Record<string, string>> = {};
        cvRes.data.forEach((row: any) => {
          if (!byReq[row.requirement_id]) byReq[row.requirement_id] = {};
          byReq[row.requirement_id][row.custom_field_id] = row.value;
        });
        setRequirementCustomValues(byReq);
      }
    })();
  }, []);

  const uniqueRequesters = useMemo(() => {
    const names = new Set<string>();
    requirements.forEach(r => {
      if (r.requested_by_name) names.add(r.requested_by_name);
    });
    return Array.from(names).sort();
  }, [requirements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 86400000 : null;
    return requirements.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (shopFilter !== 'all' && r.shop_id !== shopFilter) return false;
      if (urgencyFilter !== 'all' && r.urgency !== urgencyFilter) return false;
      if (requestedByFilter !== 'all' && r.requested_by_name !== requestedByFilter) return false;
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
  }, [requirements, search, statusFilter, shopFilter, urgencyFilter, requestedByFilter, fromDate, toDate]);

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

  // Warehouse manual fulfillment export & print actions
  const handlePrint = (scope: 'filtered' | 'selected' | 'all') => {
    const targetRows = scope === 'selected' && selectedRows.length > 0
      ? selectedRows
      : scope === 'all'
      ? requirements
      : filtered;
    if (targetRows.length === 0) {
      toast.error('No requirements to print');
      return;
    }
    directPrintFulfillmentSheet({
      rows: targetRows,
      scopeLabel: scope === 'selected' ? `Selected (${targetRows.length})` : scope === 'all' ? 'All Available' : 'Filtered Queue',
    });
  };

  const handleExportExcel = (scope: 'filtered' | 'selected' | 'all') => {
    const targetRows = scope === 'selected' && selectedRows.length > 0
      ? selectedRows
      : scope === 'all'
      ? requirements
      : filtered;
    if (targetRows.length === 0) {
      toast.error('No requirements to export');
      return;
    }
    exportFulfillmentSheetToExcel({
      rows: targetRows,
      scopeLabel: scope === 'selected' ? `Selected (${targetRows.length})` : scope === 'all' ? 'All Available' : 'Filtered Queue',
    });
    toast.success(`Exported ${targetRows.length} items to Excel`);
  };

  const handleExportPDF = (scope: 'filtered' | 'selected' | 'all') => {
    const targetRows = scope === 'selected' && selectedRows.length > 0
      ? selectedRows
      : scope === 'all'
      ? requirements
      : filtered;
    if (targetRows.length === 0) {
      toast.error('No requirements to export');
      return;
    }
    exportFulfillmentSheetToPDF({
      rows: targetRows,
      scopeLabel: scope === 'selected' ? `Selected (${targetRows.length})` : scope === 'all' ? 'All Available' : 'Filtered Queue',
    });
  };

  const submit = async () => {
    if (!form.shop_id) return toast.error('Choose a shop');
    if (!form.size.trim()) return toast.error('Enter the size you need');
    if (!form.quantity || form.quantity < 1) return toast.error('Enter a quantity');

    for (const cf of reqCustomFields) {
      if (cf.is_mandatory && !customFormValues[cf.id]?.trim()) {
        return toast.error(`Please provide ${cf.name}`);
      }
    }

    const ok = await createRequirement({
      shop_id: form.shop_id,
      size: form.size.trim(),
      category: form.category || null,
      quantity: Number(form.quantity),
      urgency: form.urgency,
      note: form.note.trim() || null,
      custom_values: customFormValues,
    });
    if (ok) {
      setForm(f => ({ ...f, size: '', category: '', quantity: 1, urgency: 'normal', note: '' }));
      setCustomFormValues({});
    }
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

  const defaultTab = isWarehouse ? 'queue' : 'raise';

  return (
    <div className="space-y-4">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="raise">Raise</TabsTrigger>
          <TabsTrigger value="queue">Queue ({filtered.length})</TabsTrigger>
        </TabsList>

        {/* ---------- Raise ---------- */}
        <TabsContent value="raise" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <PackagePlus className="h-5 w-5 text-primary" /> Request stock from shop
              </CardTitle>
              <CardDescription>Select the shop and the required size.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Shop auto-select or select dropdown */}
                {p?.shop_id ? (
                  <div className="space-y-2">
                    <Label>Shop</Label>
                    <Input
                      value={userShop?.name || 'Loading shop...'}
                      disabled
                      className="bg-muted cursor-not-allowed font-medium text-sm"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                      Shop automatically assigned from your profile
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Shop *</Label>
                    <Select value={form.shop_id} onValueChange={v => setForm({ ...form, shop_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                      <SelectContent>
                        {visibleShops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Quantity */}
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: Math.max(1, Number(e.target.value)) })}
                  />
                </div>

                {/* Size dropdown with quick chips and custom input option */}
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Size *</Label>
                    {isCustomSize ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-primary hover:text-primary/80 px-1"
                        onClick={() => setIsCustomSize(false)}
                      >
                        Choose from list
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-foreground px-1"
                        onClick={() => setIsCustomSize(true)}
                      >
                        + Type custom size
                      </Button>
                    )}
                  </div>

                  {isCustomSize ? (
                    <Input
                      value={form.size}
                      onChange={e => setForm({ ...form, size: e.target.value })}
                      placeholder="Type custom size (e.g. 42 / Large)"
                      autoFocus
                    />
                  ) : (
                    <Select
                      value={form.size}
                      onValueChange={v => {
                        if (v === '__custom__') {
                          setIsCustomSize(true);
                          setForm({ ...form, size: '' });
                        } else {
                          setForm({ ...form, size: v });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select size from list" /></SelectTrigger>
                      <SelectContent>
                        {sizes.map(s => (
                          <SelectItem key={s.id} value={s.size}>
                            Size {s.size}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="text-primary font-medium">
                          + Other / Enter custom size...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {/* Quick-select size chips for ultra-fast selection */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {quickSizes.slice(0, 10).map(sz => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          setIsCustomSize(false);
                          setForm(f => ({ ...f, size: sz }));
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                          form.size === sz
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary'
                            : 'bg-muted/40 hover:bg-muted text-foreground border-border/80 hover:border-primary/40'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Requirement Custom Fields */}
              {reqCustomFields.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 pt-3 border-t">
                  {reqCustomFields.map((cf) => {
                    const opts = reqCustomOptions[cf.id] || [];
                    const val = customFormValues[cf.id] || '';
                    return (
                      <div key={cf.id} className="space-y-2">
                        <Label>
                          {cf.name}
                          {cf.is_mandatory && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {cf.field_type === 'dropdown' ? (
                          <Select value={val} onValueChange={(v) => setCustomFormValues({ ...customFormValues, [cf.id]: v })}>
                            <SelectTrigger><SelectValue placeholder={`Select ${cf.name}`} /></SelectTrigger>
                            <SelectContent>
                              {opts.map((o) => (
                                <SelectItem key={o.id} value={o.value}>{o.value}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : cf.field_type === 'number' ? (
                          <Input
                            type="number"
                            value={val}
                            onChange={(e) => setCustomFormValues({ ...customFormValues, [cf.id]: e.target.value })}
                            placeholder={`Enter ${cf.name}`}
                          />
                        ) : cf.field_type === 'textarea' ? (
                          <Textarea
                            rows={2}
                            value={val}
                            onChange={(e) => setCustomFormValues({ ...customFormValues, [cf.id]: e.target.value })}
                            placeholder={`Enter ${cf.name}`}
                          />
                        ) : (
                          <Input
                            type={cf.field_type === 'date' ? 'date' : 'text'}
                            value={val}
                            onChange={(e) => setCustomFormValues({ ...customFormValues, [cf.id]: e.target.value })}
                            placeholder={`Enter ${cf.name}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <Label>Note (Optional)</Label>
                <Textarea
                  rows={2}
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  placeholder="Add any specific instructions or notes"
                />
              </div>
              <Button onClick={submit} disabled={saving} className="w-full sm:w-auto gap-2">
                <PackagePlus className="h-4 w-4" />
                {saving ? 'Requesting…' : 'Request Stock'}
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5 text-xs font-semibold shadow-sm"
                    onClick={() => handlePrint(selectedIds.size > 0 ? 'selected' : 'filtered')}
                    title="Direct Print picking checklist with physical tick mark boxes"
                  >
                    <Printer className="h-4 w-4 text-primary" /> Print Checklist
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
                        <Download className="h-4 w-4 text-primary" /> Export / Print
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="text-xs font-semibold">Physical Manual Checklist</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handlePrint('filtered')}>
                        <Printer className="h-4 w-4 mr-2 text-primary" /> Direct Print ({filtered.length} items)
                      </DropdownMenuItem>
                      {selectedIds.size > 0 && (
                        <DropdownMenuItem onClick={() => handlePrint('selected')}>
                          <Printer className="h-4 w-4 mr-2 text-violet-600" /> Direct Print Selected ({selectedIds.size})
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleExportPDF('filtered')}>
                        <FileText className="h-4 w-4 mr-2 text-red-600" /> Export PDF (Filtered)
                      </DropdownMenuItem>
                      {selectedIds.size > 0 && (
                        <DropdownMenuItem onClick={() => handleExportPDF('selected')}>
                          <FileText className="h-4 w-4 mr-2 text-red-600" /> Export PDF (Selected {selectedIds.size})
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleExportExcel('filtered')}>
                        <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Export Excel (Filtered)
                      </DropdownMenuItem>
                      {selectedIds.size > 0 && (
                        <DropdownMenuItem onClick={() => handleExportExcel('selected')}>
                          <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Export Excel (Selected {selectedIds.size})
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleExportExcel('all')}>
                        <Download className="h-4 w-4 mr-2 text-muted-foreground" /> Export All Available ({requirements.length})
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        <Filter className="h-4 w-4" /> Filters
                      </Button>
                    </CollapsibleTrigger>
                  </Collapsible>
                </div>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search shop, size, staff, status…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              {/* Strict role-isolated context badge */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border text-xs text-muted-foreground mt-2">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />
                <span>
                  {isAdmin
                    ? 'Admin Access: Viewing requirements across all branches.'
                    : isWarehouse
                    ? `Warehouse Access: Showing fulfillment queue from ${p?.warehouse_all_shops ? 'all branches' : `${visibleShops.length} assigned branch(es)`}.`
                    : isManager
                    ? `Manager Access: Strictly isolated to ${userShop?.name || 'your assigned store'}.`
                    : `Staff Access: Strictly isolated to ${userShop?.name ? `${userShop.name} store` : 'your store'} and your requests.`}
                </span>
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
                    <Label className="text-xs">Who Requested</Label>
                    <Select value={requestedByFilter} onValueChange={setRequestedByFilter}>
                      <SelectTrigger><SelectValue placeholder="All Requesters" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Requesters ({requirements.length})</SelectItem>
                        {uniqueRequesters.map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
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
                      setRequestedByFilter('all'); setFromDate(''); setToDate(''); setSearch('');
                    }}>Clear filters</Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="space-y-3 py-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 rounded-lg border border-border/50 bg-muted/40 p-3 space-y-2 animate-pulse">
                      <div className="h-4 w-1/3 bg-muted rounded" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                    </div>
                  ))}
                </div>
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
                            <Badge variant="outline" className="text-[11px] gap-1 px-2 py-0.5 font-medium bg-muted/40">
                              <User className="h-3 w-3 text-muted-foreground" /> {r.requested_by_name || 'Staff'}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.shop_name || '—'} · {r.category || 'no category'} · asked by <strong>{r.requested_by_name || 'Staff'}</strong> on {formatISTDateTime(r.created_at)}
                          </p>
                          {r.note && <p className="mt-1 text-sm">{r.note}</p>}
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {r.packed_at && <p>Packed by {r.packed_by_name} · {formatISTDateTime(r.packed_at)}{r.packed_qty != null ? ` · ${r.packed_qty} pcs` : ''}</p>}
                            {r.moved_at && <p>Moved by {r.moved_by_name} · {formatISTDateTime(r.moved_at)}{r.moved_note ? ` · ${r.moved_note}` : ''}</p>}
                            {r.received_at && <p>Received by {r.received_by_name} · {formatISTDateTime(r.received_at)}</p>}
                            {r.rejected_at && <p className="text-destructive">Rejected by {r.rejected_by_name} · {r.reject_reason}</p>}
                          </div>
                          {requirementCustomValues[r.id] && Object.keys(requirementCustomValues[r.id]).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {Object.entries(requirementCustomValues[r.id]).map(([cfId, val]) => {
                                const cf = reqCustomFields.find(f => f.id === cfId);
                                return (
                                  <Badge key={cfId} variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/40">
                                    {cf ? cf.name : 'Detail'}: {val}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
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
