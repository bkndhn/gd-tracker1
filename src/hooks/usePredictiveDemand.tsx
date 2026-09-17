import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useRequirements, type StockRequirement } from './useRequirements';
import type { InsightEntry } from '@/lib/lostSaleInsights';
import {
  computePredictiveDemand,
  buildPurchaseOrderSheet,
  type PredictiveDemandItem,
  type PredictiveSummary,
  type WarehouseInventoryItem,
} from '@/lib/predictiveDemand';
import { toast } from 'sonner';

export const usePredictiveDemand = (initialEntries?: InsightEntry[]) => {
  const { adminId, userShopId, profile } = useAuth();
  const { requirements, createRequirement } = useRequirements();
  const [entries, setEntries] = useState<InsightEntry[]>(initialEntries || []);
  const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Tunable forecasting options
  const [windowDays, setWindowDays] = useState<number>(30);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(5);
  const [safetyDays, setSafetyDays] = useState<number>(3);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Load entries if not passed as prop
  useEffect(() => {
    if (initialEntries && initialEntries.length > 0) {
      setEntries(initialEntries);
      return;
    }

    if (!adminId) return;

    let cancelled = false;
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('goods_damaged_entries')
          .select('id, created_at, shop_id, shops(name), categories(name), sizes(size), customer_types(name), employee_name')
          .eq('admin_id', adminId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error) throw error;
        if (!cancelled && data) {
          setEntries(data as any);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Failed to load predictive entries', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEntries();
    return () => {
      cancelled = true;
    };
  }, [adminId, initialEntries]);

  // Load warehouse inventory
  useEffect(() => {
    if (!adminId) return;

    let cancelled = false;
    const fetchInventory = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'warehouse_inventory')
          .eq('admin_id', adminId)
          .maybeSingle();

        if (!cancelled && data?.value && Array.isArray(data.value)) {
          setInventory(data.value as unknown as WarehouseInventoryItem[]);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Failed to load warehouse inventory', err);
      }
    };

    fetchInventory();
    return () => {
      cancelled = true;
    };
  }, [adminId]);

  // Compute prediction results
  const result = useMemo(() => {
    return computePredictiveDemand(entries, requirements, inventory, {
      windowDays,
      supplierLeadTimeDays: leadTimeDays,
      safetyStockDays: safetyDays,
    });
  }, [entries, requirements, inventory, windowDays, leadTimeDays, safetyDays]);

  // Filtered list
  const filteredItems = useMemo(() => {
    return result.items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
      return true;
    });
  }, [result.items, categoryFilter, severityFilter]);

  // Categories list for filtering
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    result.items.forEach((i) => set.add(i.category));
    return Array.from(set).sort();
  }, [result.items]);

  // 1-Click Action: Create stock requirement from predicted item
  const raiseRestockRequirement = useCallback(
    async (item: PredictiveDemandItem, targetShopId?: string) => {
      const shopToUse = targetShopId || userShopId;
      if (!shopToUse) {
        toast.error('Please specify a shop destination for the stock requirement.');
        return false;
      }

      const orderQty = Math.max(1, item.recommendedReorderQty || 1);
      const isUrgent = item.severity === 'CRITICAL';

      const success = await createRequirement({
        shop_id: shopToUse,
        size: item.size,
        quantity: orderQty,
        category: item.category,
        urgency: isUrgent ? 'urgent' : 'medium',
        note: `AI Predictive Auto-Restock: ${item.recentRequests} requests in ${windowDays}d (${item.dailyVelocity}/day). Runway: ${item.depletionRunwayDays}d.`,
      });

      if (success) {
        toast.success(`Raised restock requirement for ${item.category} Size ${item.size} (${orderQty} pcs)`);
      }
      return success;
    },
    [userShopId, createRequirement, windowDays]
  );

  return {
    loading,
    items: filteredItems,
    allItems: result.items,
    summary: result.summary,
    availableCategories,
    windowDays,
    setWindowDays,
    leadTimeDays,
    setLeadTimeDays,
    safetyDays,
    setSafetyDays,
    categoryFilter,
    setCategoryFilter,
    severityFilter,
    setSeverityFilter,
    raiseRestockRequirement,
    buildPurchaseOrderSheet: (targetItems?: PredictiveDemandItem[]) =>
      buildPurchaseOrderSheet(targetItems || filteredItems, windowDays),
  };
};
