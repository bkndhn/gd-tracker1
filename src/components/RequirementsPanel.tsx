import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRequirements, type StockRequirement, type RequirementStatus } from '@/hooks/useRequirements';
import { useTranslation } from '@/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemedSearchInput } from '@/components/ThemedSearchInput';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  PackagePlus, Filter, Search, Truck, PackageCheck, CheckCircle2, XCircle,
  ClipboardList, Warehouse, Printer, Download, FileText, FileSpreadsheet, User, RotateCcw,
  Sparkles, Settings2, Plus,
} from 'lucide-react';
import { formatISTDateTime, formatISTShort } from '@/lib/dateUtils';
import {
  directPrintFulfillmentSheet,
  exportFulfillmentSheetToExcel,
  exportFulfillmentSheetToPDF,
  exportFulfillmentSheetToCSV,
} from '@/lib/manualFulfillmentSheet';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { PredictiveReorderPanel } from './PredictiveReorderPanel';

const STATUS_TONE: Record<string, string> = {
  requested: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  packed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  moved: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  received: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-destructive/15 text-destructive',
};

export const RequirementsPanel = ({ isActive }: { isActive?: boolean } = {}) => {
  const { t } = useTranslation();
  const { profile, user, adminId } = useAuth();
  const { notifyNewRequirement, notifyDispatched, notifyReceived } = usePushNotifications();
  const p = profile as any;
  const effectiveAdminId = adminId || p?.admin_id || profile?.id;
  const role = p?.role as string | undefined;
  const isWarehouse = role === 'warehouse';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isManager = role === 'manager';

  const { requirements, visibleShops, loading, saving, createRequirement, updateStatus, undoStatus } = useRequirements();

  const [undoTarget, setUndoTarget] = useState<StockRequirement | null>(null);
  const [undoReason, setUndoReason] = useState('');

  const [reqCustomFields, setReqCustomFields] = useState<any[]>([]);
  const [reqCustomOptions, setReqCustomOptions] = useState<Record<string, any[]>>({});
  const [customFormValues, setCustomFormValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [customInputToggles, setCustomInputToggles] = useState<Record<string, boolean>>({});
  const [seedingStandardFields, setSeedingStandardFields] = useState(false);
  const [requirementCustomValues, setRequirementCustomValues] = useState<Record<string, Record<string, string>>>({});

  // Standard fixed fields: Shop & Note (all other fields are purely dynamic from custom fields)
  const [form, setForm] = useState({
    shop_id: p?.shop_id || '',
    note: '',
  });

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

  const fetchMeta = useCallback(async () => {
    try {
      let cfQuery = (supabase.from('custom_fields') as any)
        .select('*')
        .eq('scope', 'requirement')
        .is('deleted_at', null)
        .order('display_order');

      if (effectiveAdminId) {
        cfQuery = cfQuery.eq('admin_id', effectiveAdminId);
      }

      const [cfRes, cvRes] = await Promise.all([
        cfQuery,
        (supabase.from('gd_entry_custom_values') as any)
          .select('*')
          .not('requirement_id', 'is', null),
      ]);

      if (cfRes?.data) {
        // Only exclude fixed top-level native fields (shop, note) - all other fields come dynamically from custom fields
        const NATIVE_FIXED_FIELDS = new Set([
          'shop', 'shops', 'store', 'stores', 'branch', 'branches', 'shop name', 'note', 'notes',
        ]);
        const validFields = cfRes.data.filter(
          (f: any) => !NATIVE_FIXED_FIELDS.has(f.name.trim().toLowerCase())
        );
        setReqCustomFields(validFields);
        const cfIds = validFields.map((f: any) => f.id);
        if (cfIds.length > 0) {
          const { data: optData } = await (supabase.from('custom_field_options') as any)
            .select('*')
            .in('custom_field_id', cfIds)
            .is('deleted_at', null)
            .order('display_order');
          const map: Record<string, any[]> = {};
          (optData || []).forEach((o: any) => {
            if (!map[o.custom_field_id]) map[o.custom_field_id] = [];
            map[o.custom_field_id].push(o);
          });
          setReqCustomOptions(map);
        } else {
          setReqCustomOptions({});
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
    } catch (e) {
      if (import.meta.env.DEV) console.error('fetchMeta error in RequirementsPanel', e);
    }
  }, []);

  useEffect(() => {
    fetchMeta();
    const handleUpdate = () => { fetchMeta(); };
    window.addEventListener('focus', handleUpdate);
    window.addEventListener('gd:custom_fields_updated', handleUpdate);
    window.addEventListener('gd:requirement_updated', handleUpdate);
    return () => {
      window.removeEventListener('focus', handleUpdate);
      window.removeEventListener('gd:custom_fields_updated', handleUpdate);
      window.removeEventListener('gd:requirement_updated', handleUpdate);
    };
  }, [fetchMeta]);

  // Refetch whenever the requirements tab becomes active
  useEffect(() => {
    if (isActive) {
      fetchMeta();
    }
  }, [isActive, fetchMeta]);

  // Dynamic requirement fields strictly filtered by is_visible !== false and ordered by display_order
  const visibleRequirementFields = useMemo(() => {
    return reqCustomFields
      .filter(f => f.is_visible !== false)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [reqCustomFields]);

  // Set intelligent initial defaults for quantity / urgency custom fields
  useEffect(() => {
    if (visibleRequirementFields.length === 0) return;
    setCustomFormValues(prev => {
      let changed = false;
      const next = { ...prev };
      visibleRequirementFields.forEach(f => {
        const name = f.name.trim().toLowerCase();
        if (next[f.id] === undefined || next[f.id] === '') {
          if (name.includes('quantity') || name === 'qty') {
            next[f.id] = '1';
            changed = true;
          } else if (name.includes('urgency') || name.includes('priority')) {
            const opts = reqCustomOptions[f.id] || [];
            const normalOpt = opts.find((o: any) => o.value.toLowerCase().includes('normal'));
            if (normalOpt) {
              next[f.id] = normalOpt.value;
              changed = true;
            }
          }
        }
      });
      return changed ? next : prev;
    });
  }, [visibleRequirementFields, reqCustomOptions]);

  // 1-click seeding of standard fields for convenience if a tenant hasn't configured any yet
  const initializeStandardRequirementFields = async () => {
    try {
      setSeedingStandardFields(true);
      const adminId = (p as any)?.admin_id || p?.id;
      if (!adminId) {
        toast.error('No admin context available');
        return;
      }

      // 1. Category (Dropdown)
      const { data: catField } = await (supabase.from('custom_fields') as any).insert({
        admin_id: adminId,
        name: 'Category',
        field_type: 'dropdown',
        is_mandatory: false,
        is_visible: true,
        display_order: 0,
        scope: 'requirement',
      }).select().single();

      if (catField?.id) {
        await (supabase.from('custom_field_options') as any).insert([
          { custom_field_id: catField.id, value: 'Shirt', display_order: 0 },
          { custom_field_id: catField.id, value: 'T-Shirt', display_order: 1 },
          { custom_field_id: catField.id, value: 'Jeans', display_order: 2 },
          { custom_field_id: catField.id, value: 'Trousers', display_order: 3 },
          { custom_field_id: catField.id, value: 'Kurti', display_order: 4 },
        ]);
      }

      // 2. Size (Dropdown with quick-selection)
      const { data: sizeField } = await (supabase.from('custom_fields') as any).insert({
        admin_id: adminId,
        name: 'Size',
        field_type: 'dropdown',
        is_mandatory: true,
        is_visible: true,
        display_order: 1,
        scope: 'requirement',
      }).select().single();

      if (sizeField?.id) {
        await (supabase.from('custom_field_options') as any).insert([
          { custom_field_id: sizeField.id, value: 'S', display_order: 0 },
          { custom_field_id: sizeField.id, value: 'M', display_order: 1 },
          { custom_field_id: sizeField.id, value: 'L', display_order: 2 },
          { custom_field_id: sizeField.id, value: 'XL', display_order: 3 },
          { custom_field_id: sizeField.id, value: 'XXL', display_order: 4 },
          { custom_field_id: sizeField.id, value: '36', display_order: 5 },
          { custom_field_id: sizeField.id, value: '38', display_order: 6 },
          { custom_field_id: sizeField.id, value: '40', display_order: 7 },
          { custom_field_id: sizeField.id, value: '42', display_order: 8 },
          { custom_field_id: sizeField.id, value: '44', display_order: 9 },
        ]);
      }

      // 3. Quantity (Number)
      await (supabase.from('custom_fields') as any).insert({
        admin_id: adminId,
        name: 'Quantity',
        field_type: 'number',
        is_mandatory: true,
        is_visible: true,
        display_order: 2,
        scope: 'requirement',
      });

      // 4. Urgency (Dropdown)
      const { data: urgField } = await (supabase.from('custom_fields') as any).insert({
        admin_id: adminId,
        name: 'Urgency',
        field_type: 'dropdown',
        is_mandatory: false,
        is_visible: true,
        display_order: 3,
        scope: 'requirement',
      }).select().single();

      if (urgField?.id) {
        await (supabase.from('custom_field_options') as any).insert([
          { custom_field_id: urgField.id, value: 'Normal', display_order: 0 },
          { custom_field_id: urgField.id, value: 'Urgent', display_order: 1 },
        ]);
      }

      toast.success('Initialized standard requirement fields!');
      await fetchMeta();
    } catch (e: any) {
      toast.error(e.message || 'Failed to initialize requirement fields');
    } finally {
      setSeedingStandardFields(false);
    }
  };

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

  const handleExportCSV = (scope: 'filtered' | 'selected' | 'all') => {
    const targetRows = scope === 'selected' && selectedRows.length > 0
      ? selectedRows
      : scope === 'all'
      ? requirements
      : filtered;
    if (targetRows.length === 0) {
      toast.error('No requirements to export');
      return;
    }
    exportFulfillmentSheetToCSV({
      rows: targetRows,
      scopeLabel: scope === 'selected' ? `Selected (${targetRows.length})` : scope === 'all' ? 'All Available' : 'Filtered Queue',
    });
    toast.success(`Exported ${targetRows.length} items to CSV`);
  };

  const handleConfirmUndo = async () => {
    if (!undoTarget) return;
    const ok = await undoStatus(undoTarget, undoReason.trim() || undefined);
    if (ok) {
      setUndoTarget(null);
      setUndoReason('');
    }
  };

  const submit = async () => {
    if (!form.shop_id) return toast.error('Choose a shop');

    // Validate mandatory custom fields
    const errors: Record<string, string> = {};
    for (const field of visibleRequirementFields) {
      const val = customFormValues[field.id];
      if (field.is_mandatory && (!val || !String(val).trim())) {
        errors[field.id] = `${field.name} is required`;
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstMsg = Object.values(errors)[0];
      return toast.error(firstMsg);
    }

    // Resolve Size from custom fields
    let resolvedSize = 'Standard';
    const sizeField = visibleRequirementFields.find(f => {
      const n = f.name.trim().toLowerCase();
      return n === 'size' || n.includes('size');
    });
    if (sizeField && customFormValues[sizeField.id]) {
      const rawVal = customFormValues[sizeField.id];
      const opt = (reqCustomOptions[sizeField.id] || []).find((o: any) => o.id === rawVal || o.value === rawVal);
      resolvedSize = opt ? opt.value : String(rawVal).trim();
    }

    // Resolve Quantity from custom fields
    let resolvedQuantity = 1;
    const qtyField = visibleRequirementFields.find(f => {
      const n = f.name.trim().toLowerCase();
      return n === 'quantity' || n === 'qty' || n.includes('quantity') || n.includes('qty');
    });
    if (qtyField && customFormValues[qtyField.id]) {
      const num = Number(customFormValues[qtyField.id]);
      if (!isNaN(num) && num > 0) resolvedQuantity = num;
    }

    // Resolve Urgency from custom fields
    let resolvedUrgency: 'normal' | 'urgent' = 'normal';
    const urgencyField = visibleRequirementFields.find(f => {
      const n = f.name.trim().toLowerCase();
      return n === 'urgency' || n === 'priority' || n.includes('urgency') || n.includes('priority');
    });
    if (urgencyField && customFormValues[urgencyField.id]) {
      const rawVal = customFormValues[urgencyField.id];
      const opt = (reqCustomOptions[urgencyField.id] || []).find((o: any) => o.id === rawVal || o.value === rawVal);
      const str = (opt ? opt.value : String(rawVal)).toLowerCase();
      if (str.includes('urgent') || str.includes('high') || str.includes('rush') || str.includes('critical')) {
        resolvedUrgency = 'urgent';
      }
    }

    // Resolve Category from custom fields
    let resolvedCategory: string | null = null;
    const catField = visibleRequirementFields.find(f => {
      const n = f.name.trim().toLowerCase();
      return n === 'category' || n === 'item' || n.includes('category') || n.includes('item type');
    });
    if (catField && customFormValues[catField.id]) {
      const rawVal = customFormValues[catField.id];
      const opt = (reqCustomOptions[catField.id] || []).find((o: any) => o.id === rawVal || o.value === rawVal);
      resolvedCategory = opt ? opt.value : String(rawVal).trim();
    }

    // Prepare human-readable values for custom_values mapping
    const finalCustomValues: Record<string, string> = {};
    Object.entries(customFormValues).forEach(([fId, val]) => {
      if (!val || !String(val).trim()) return;
      const f = reqCustomFields.find(field => field.id === fId);
      const type = f?.field_type || 'dropdown';
      if (type === 'dropdown' || type === 'radio') {
        const opt = (reqCustomOptions[fId] || []).find((o: any) => o.id === val || o.value === val);
        finalCustomValues[fId] = opt ? opt.value : String(val);
      } else {
        finalCustomValues[fId] = String(val);
      }
    });

    const ok = await createRequirement({
      shop_id: form.shop_id,
      size: resolvedSize,
      category: resolvedCategory,
      quantity: resolvedQuantity,
      urgency: resolvedUrgency,
      note: form.note.trim() || null,
      custom_values: finalCustomValues,
    });

    if (ok) {
      notifyNewRequirement({
        size: resolvedSize,
        quantity: resolvedQuantity,
        shop_name: visibleShops.find(s => s.id === form.shop_id)?.name,
        urgency: resolvedUrgency,
      });
      setForm(f => ({
        ...f,
        note: '',
      }));
      setCustomFormValues({});
      setFieldErrors({});
      setCustomInputToggles({});
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
    if (ok) {
      if (action.to === 'moved') {
        notifyDispatched({ count: 1, shop_name: action.req.shop_name });
      } else if (action.to === 'received') {
        notifyReceived({ size: action.req.size, shop_name: action.req.shop_name });
      }
      setAction(null);
    }
  };

  const canFulfil = (r: StockRequirement) => isWarehouse || isAdmin;
  const canReceive = (r: StockRequirement) =>
    isAdmin || isManager || (r.requested_by === user?.id) || (p?.shop_id && r.shop_id === p.shop_id);

  const defaultTab = isWarehouse ? 'queue' : 'raise';

  return (
    <div className="space-y-4">
      <Tabs defaultValue={defaultTab} className="w-full">
        <div className="w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 scroll-px-2">
          <TabsList className="w-full sm:w-auto inline-flex sm:flex items-center p-1.5 bg-muted/60 border rounded-xl gap-1 sm:gap-1.5 h-auto no-scrollbar min-w-max sm:min-w-0">
            <TabsTrigger
              value="raise"
              className="flex-1 sm:flex-initial shrink-0 group flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3.5 text-xs sm:text-sm font-medium rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-indigo-500/20 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50 whitespace-nowrap"
            >
              <PackagePlus className="h-4 w-4 shrink-0 text-indigo-500 group-data-[state=active]:text-white transition-colors" />
              <span className="font-semibold whitespace-nowrap">{t('req.raise')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="queue"
              className="flex-1 sm:flex-initial shrink-0 group flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3.5 text-xs sm:text-sm font-medium rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/20 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50 whitespace-nowrap"
            >
              <ClipboardList className="h-4 w-4 shrink-0 text-amber-500 group-data-[state=active]:text-white transition-colors" />
              <span className="font-semibold whitespace-nowrap">{t('req.queue')}</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white font-bold shrink-0">
                {filtered.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="predictive"
              className="flex-1 sm:flex-initial shrink-0 group flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3.5 text-xs sm:text-sm font-medium rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/20 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-violet-500 group-data-[state=active]:text-white transition-colors" />
              <span className="font-semibold whitespace-nowrap">AI Demand</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ---------- Raise ---------- */}
        <TabsContent value="raise" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <PackagePlus className="h-5 w-5 text-primary" /> {t('req.requestStock')}
              </CardTitle>
              <CardDescription>Select the shop and the required size.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* 1. Shop auto-select or select dropdown */}
                {p?.shop_id ? (
                  <div className="space-y-2">
                    <Label>{t('common.shop')}</Label>
                    <Input
                      value={userShop?.name || t('common.loading')}
                      disabled
                      className="bg-muted cursor-not-allowed font-medium text-sm"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                      {t('form.shopAuto')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>{t('common.shop')} *</Label>
                    <Select value={form.shop_id} onValueChange={v => setForm({ ...form, shop_id: v })}>
                      <SelectTrigger><SelectValue placeholder={t('form.selectShop')} /></SelectTrigger>
                      <SelectContent>
                        {visibleShops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* 2. Dynamic Requirement Custom Fields (Configured in Admin -> Custom Fields -> Requirement / Stock Fields) */}
              {visibleRequirementFields.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 pt-1">
                  {visibleRequirementFields.map((field) => {
                    const type = field.field_type || 'dropdown';
                    const fieldOptions = reqCustomOptions[field.id] || [];
                    const value = customFormValues[field.id] || '';
                    const error = fieldErrors[field.id];
                    const isCustomMode = customInputToggles[field.id] || false;

                    const setValue = (v: string) => {
                      setCustomFormValues(prev => ({ ...prev, [field.id]: v }));
                      if (fieldErrors[field.id]) {
                        setFieldErrors(prev => {
                          const next = { ...prev };
                          delete next[field.id];
                          return next;
                        });
                      }
                    };

                    const toggleCustomMode = (custom: boolean) => {
                      setCustomInputToggles(prev => ({ ...prev, [field.id]: custom }));
                      if (custom) {
                        setCustomFormValues(prev => ({ ...prev, [field.id]: '' }));
                      }
                    };

                    return (
                      <div key={field.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className={error ? 'text-destructive' : undefined}>
                            {field.name} {field.is_mandatory && <span className="text-destructive">*</span>}
                            {!field.is_mandatory && <span className="text-muted-foreground text-xs font-normal ml-1">(Optional)</span>}
                          </Label>

                          {type === 'dropdown' && fieldOptions.length > 0 && (
                            isCustomMode ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-primary hover:text-primary/80 px-1"
                                onClick={() => toggleCustomMode(false)}
                              >
                                Choose from list
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-muted-foreground hover:text-foreground px-1"
                                onClick={() => toggleCustomMode(true)}
                              >
                                + Type custom
                              </Button>
                            )
                          )}
                        </div>

                        {/* Dropdown with fast chips */}
                        {type === 'dropdown' && (
                          isCustomMode || fieldOptions.length === 0 ? (
                            <Input
                              value={value}
                              onChange={e => setValue(e.target.value)}
                              placeholder={`Enter custom ${field.name.toLowerCase()}`}
                              className={error ? 'border-destructive' : ''}
                            />
                          ) : (
                            <div className="space-y-2">
                              <Select
                                value={value}
                                onValueChange={v => {
                                  if (v === '__custom__') {
                                    toggleCustomMode(true);
                                  } else {
                                    setValue(v);
                                  }
                                }}
                              >
                                <SelectTrigger className={error ? 'border-destructive' : ''}>
                                  <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {fieldOptions.map((opt) => (
                                    <SelectItem key={opt.id} value={opt.value}>
                                      {opt.value}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="__custom__" className="text-primary font-medium">
                                    + Other / Type custom...
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Quick-select chips if options <= 12 */}
                              {fieldOptions.length > 0 && fieldOptions.length <= 12 && (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {fieldOptions.map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => {
                                        toggleCustomMode(false);
                                        setValue(opt.value);
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                                        value === opt.value
                                          ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary'
                                          : 'bg-muted/40 hover:bg-muted text-foreground border-border/80 hover:border-primary/40'
                                      }`}
                                    >
                                      {opt.value}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        )}

                        {/* Radio buttons */}
                        {type === 'radio' && (
                          <RadioGroup value={value} onValueChange={setValue} className="flex flex-wrap gap-2 pt-1">
                            {fieldOptions.map((opt) => (
                              <div key={opt.id} className={`flex items-center space-x-2 border rounded-md px-3 py-2 hover:bg-accent ${error ? 'border-destructive' : ''}`}>
                                <RadioGroupItem value={opt.value} id={`cf-${field.id}-${opt.id}`} />
                                <Label htmlFor={`cf-${field.id}-${opt.id}`} className="font-normal cursor-pointer text-xs sm:text-sm">{opt.value}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}

                        {/* Number input */}
                        {type === 'number' && (
                          <Input
                            type="number"
                            min={1}
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder={`Enter ${field.name.toLowerCase()}`}
                            className={error ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Textarea */}
                        {type === 'textarea' && (
                          <Textarea
                            rows={2}
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder={`Enter ${field.name.toLowerCase()}`}
                            className={error ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Date */}
                        {type === 'date' && (
                          <Input
                            type="date"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            className={error ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Phone */}
                        {type === 'phone' && (
                          <Input
                            type="tel"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder="10-digit mobile number"
                            className={error ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Email */}
                        {type === 'email' && (
                          <Input
                            type="email"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder="name@example.com"
                            className={error ? 'border-destructive' : ''}
                          />
                        )}

                        {/* Standard text input */}
                        {type !== 'dropdown' && type !== 'radio' && type !== 'number' && type !== 'textarea' && type !== 'date' && type !== 'phone' && type !== 'email' && (
                          <Input
                            type="text"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder={`Enter ${field.name.toLowerCase()}`}
                            className={error ? 'border-destructive' : ''}
                          />
                        )}

                        {error && <p className="text-xs text-destructive">{error}</p>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed text-center bg-muted/20 space-y-3">
                  <PackagePlus className="h-10 w-10 mx-auto text-muted-foreground/60" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-foreground">No Stock Fields Configured Yet</h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      All stock request fields are dynamically customizable. Configure your fields in <strong>Admin → Custom Fields → Requirement / Stock Fields</strong>, or click below to populate standard fields.
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={initializeStandardRequirementFields}
                      disabled={seedingStandardFields}
                      className="gap-1.5 text-xs font-semibold shadow-xs"
                    >
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      {seedingStandardFields ? 'Initializing…' : 'Initialize Standard Stock Fields'}
                    </Button>
                  )}
                </div>
              )}

              {/* 3. Note (Fixed Standard Field at Bottom) */}
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
                      <DropdownMenuItem onClick={() => handleExportCSV('filtered')}>
                        <Download className="h-4 w-4 mr-2 text-primary" /> Export CSV (Filtered)
                      </DropdownMenuItem>
                      {selectedIds.size > 0 && (
                        <DropdownMenuItem onClick={() => handleExportCSV('selected')}>
                          <Download className="h-4 w-4 mr-2 text-primary" /> Export CSV (Selected {selectedIds.size})
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
              <div className="mt-2">
                <ThemedSearchInput
                  placeholder="Search shop, size, staff, status…"
                  value={search}
                  onValueChange={setSearch}
                  shortcut="/"
                />
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
                    <div key={r.id} className="rounded-xl border bg-card p-3.5 space-y-2.5 shadow-xs transition-shadow hover:shadow-sm">
                      {/* Top Header: Checkbox + Size × Qty + Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <Checkbox
                            className="mt-0.5"
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={v => toggleOne(r.id, !!v)}
                          />
                          <span className="font-bold text-sm sm:text-base text-foreground whitespace-nowrap">
                            {r.size && r.size !== 'Standard' && r.size !== '—'
                              ? `Size ${r.size} × ${r.quantity}`
                              : `${r.quantity} Unit(s)`}
                          </span>
                          <Badge className={STATUS_TONE[r.status]} variant="secondary">
                            {r.status}
                          </Badge>
                          {r.urgency === 'urgent' && <Badge variant="destructive">urgent</Badge>}
                        </div>
                        <Badge variant="outline" className="text-[11px] gap-1 px-2 py-0.5 font-medium bg-muted/40 shrink-0">
                          <User className="h-3 w-3 text-muted-foreground" /> {r.requested_by_name || 'Staff'}
                        </Badge>
                      </div>

                      {/* Full-width Details Block - 100% width, no vertical single-word wrapping! */}
                      <div className="w-full text-xs space-y-1 pt-0.5">
                        <p className="text-muted-foreground leading-relaxed">
                          <strong className="text-foreground font-semibold">{r.shop_name || 'Unassigned Shop'}</strong>
                          {r.category && r.category !== '—' && (
                            <>
                              {' · '}
                              <span className="text-foreground font-medium">{r.category}</span>
                            </>
                          )}
                          {' · '}
                          <span>Asked on {formatISTDateTime(r.created_at)}</span>
                        </p>
                        {r.note && (
                          <div className="p-2 rounded-md bg-muted/40 border border-border/60 text-xs text-foreground font-medium">
                            <span className="text-muted-foreground font-normal">Note: </span>{r.note}
                          </div>
                        )}
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {r.packed_at && <p className="text-blue-600 dark:text-blue-400">✓ Packed by {r.packed_by_name} · {formatISTDateTime(r.packed_at)}{r.packed_qty != null ? ` · ${r.packed_qty} pcs` : ''}</p>}
                          {r.moved_at && <p className="text-violet-600 dark:text-violet-400">✓ Moved by {r.moved_by_name} · {formatISTDateTime(r.moved_at)}{r.moved_note ? ` · ${r.moved_note}` : ''}</p>}
                          {r.received_at && <p className="text-emerald-600 dark:text-emerald-400">✓ Received by {r.received_by_name} · {formatISTDateTime(r.received_at)}</p>}
                          {r.rejected_at && <p className="text-destructive font-medium">✕ Rejected by {r.rejected_by_name} · {r.reject_reason}</p>}
                        </div>
                        {requirementCustomValues[r.id] && Object.keys(requirementCustomValues[r.id]).length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
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

                      {/* Footer Action Row: Packed, Moved, Received, Reject, Undo */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                        <div className="flex flex-wrap gap-1.5">
                          {r.status === 'requested' && canFulfil(r) && (
                            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openAction(r, 'packed')}>
                              <PackageCheck className="h-3.5 w-3.5 text-blue-600" /> Packed
                            </Button>
                          )}
                          {r.status === 'packed' && canFulfil(r) && (
                            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openAction(r, 'moved')}>
                              <Truck className="h-3.5 w-3.5 text-violet-600" /> Moved
                            </Button>
                          )}
                          {r.status === 'moved' && canReceive(r) && (
                            <Button size="sm" className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openAction(r, 'received')}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Received
                            </Button>
                          )}
                          {(r.status === 'requested' || r.status === 'packed') && canFulfil(r) && (
                            <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive hover:bg-destructive/10" onClick={() => openAction(r, 'rejected')}>
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          )}
                        </div>

                        {/* Admin & Manager Undo Button */}
                        {r.status !== 'requested' && (isAdmin || isManager) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs text-muted-foreground hover:text-foreground h-8"
                            onClick={() => setUndoTarget(r)}
                            title="Undo this status (revert back to requested)"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                            <span>Undo Status</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="predictive" className="mt-4">
          <PredictiveReorderPanel />
        </TabsContent>
      </Tabs>

      {/* Workflow Confirmation Dialog */}
      <Dialog open={!!action} onOpenChange={o => !o && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 capitalize">
              {action?.to === 'packed' && <PackageCheck className="h-5 w-5 text-blue-600" />}
              {action?.to === 'moved' && <Truck className="h-5 w-5 text-violet-600" />}
              {action?.to === 'received' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              {action?.to === 'rejected' && <XCircle className="h-5 w-5 text-destructive" />}
              Confirm: Mark as {action?.to.toUpperCase()}?
            </DialogTitle>
            <DialogDescription>
              Please verify requirement details before confirming this status update.
            </DialogDescription>
          </DialogHeader>

          {action && (
            <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between items-center font-semibold text-foreground text-sm">
                <span>Size {action.req.size} × {action.req.quantity}</span>
                <span className="text-primary">{action.req.shop_name || 'Unassigned'}</span>
              </div>
              <p className="text-muted-foreground">
                Category: <span className="text-foreground">{action.req.category || 'General'}</span> · Asked by: <span className="text-foreground">{action.req.requested_by_name || 'Staff'}</span>
              </p>
              <p className="text-muted-foreground">
                Requested on {formatISTDateTime(action.req.created_at)}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {action?.to === 'packed' && (
              <div className="space-y-2">
                <Label>Packed quantity</Label>
                <Input type="number" min={1} value={actionQty}
                  onChange={e => setActionQty(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            )}
            {action?.to !== 'received' && (
              <div className="space-y-2">
                <Label>{action?.to === 'rejected' ? 'Rejection Reason *' : 'Dispatch / Action Note (optional)'}</Label>
                <Textarea
                  rows={2}
                  value={actionNote}
                  placeholder={action?.to === 'rejected' ? 'Why is this request rejected?' : 'Add optional note...'}
                  onChange={e => setActionNote(e.target.value)}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
              <Button
                variant={action?.to === 'rejected' ? 'destructive' : 'default'}
                onClick={confirmAction}
              >
                Yes, Mark as {action?.to}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Undo Confirmation Dialog */}
      <Dialog open={!!undoTarget} onOpenChange={o => !o && setUndoTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="h-5 w-5" /> Undo Status / Revert to Requested
            </DialogTitle>
            <DialogDescription>
              Revert this requirement back to &quot;Requested&quot; status. All fulfillment timestamps for this cycle will be reset and returned to the active queue.
            </DialogDescription>
          </DialogHeader>

          {undoTarget && (
            <div className="rounded-xl border bg-amber-500/10 border-amber-500/20 p-3 text-xs space-y-1">
              <div className="flex justify-between items-center font-semibold text-foreground text-sm">
                <span>Size {undoTarget.size} × {undoTarget.quantity}</span>
                <span className="font-semibold">{undoTarget.shop_name}</span>
              </div>
              <p className="text-muted-foreground">
                Current Status: <strong className="uppercase text-amber-700 dark:text-amber-300">{undoTarget.status}</strong>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Reason for Undo (Optional)</Label>
              <Input
                placeholder="e.g. Marked packed by mistake"
                value={undoReason}
                onChange={e => setUndoReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setUndoTarget(null)}>Cancel</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleConfirmUndo}
              >
                Yes, Revert to Requested
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
