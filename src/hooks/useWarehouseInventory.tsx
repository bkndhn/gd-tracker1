import { useCallback, useMemo } from 'react';
import { useAdminSetting } from '@/hooks/useAdminSetting';
import { toast } from 'sonner';

export interface InventoryItem {
  id: string;
  size: string;
  category: string;
  on_hand: number;
  min_threshold: number;
  location?: string;
  updated_at?: string;
}

const DEFAULT_SIZES = ['36', '38', '40', '42', '44', 'S', 'M', 'L', 'XL', 'XXL'];

const SEED_INVENTORY: InventoryItem[] = DEFAULT_SIZES.map((sz, idx) => ({
  id: `inv-${sz}`,
  size: sz,
  category: 'General',
  on_hand: [15, 8, 20, 4, 12, 18, 5, 25, 6, 10][idx] ?? 10,
  min_threshold: [5, 5, 10, 5, 5, 10, 10, 10, 5, 5][idx] ?? 5,
  location: 'Main Warehouse - Bay A',
  updated_at: new Date().toISOString(),
}));

export const useWarehouseInventory = () => {
  const {
    value: inventory,
    save: saveInventory,
    loading,
    canEdit,
  } = useAdminSetting<InventoryItem[]>('warehouse_inventory', SEED_INVENTORY, (raw) => {
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return SEED_INVENTORY;
  });

  const lowStockItems = useMemo(() => {
    return inventory.filter(item => item.on_hand <= item.min_threshold);
  }, [inventory]);

  const outOfStockItems = useMemo(() => {
    return inventory.filter(item => item.on_hand <= 0);
  }, [inventory]);

  const hasReplenishmentAlert = lowStockItems.length > 0;

  const adjustStock = useCallback(async (
    itemId: string,
    delta: number,
    newThreshold?: number,
    note?: string
  ) => {
    const updated = inventory.map(item => {
      if (item.id !== itemId) return item;
      const nextStock = Math.max(0, item.on_hand + delta);
      return {
        ...item,
        on_hand: nextStock,
        min_threshold: newThreshold !== undefined ? Math.max(0, newThreshold) : item.min_threshold,
        updated_at: new Date().toISOString(),
      };
    });

    try {
      await saveInventory(updated, note || `Adjusted stock for item ${itemId} by ${delta}`);
      toast.success('Inventory updated');
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Failed to update inventory');
      return false;
    }
  }, [inventory, saveInventory]);

  const setStockExact = useCallback(async (
    itemId: string,
    exactQty: number,
    newThreshold?: number,
    note?: string
  ) => {
    const updated = inventory.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        on_hand: Math.max(0, exactQty),
        min_threshold: newThreshold !== undefined ? Math.max(0, newThreshold) : item.min_threshold,
        updated_at: new Date().toISOString(),
      };
    });

    try {
      await saveInventory(updated, note || `Set stock for item ${itemId} to ${exactQty}`);
      toast.success('Inventory level updated');
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Failed to update inventory');
      return false;
    }
  }, [inventory, saveInventory]);

  const deductPackedStock = useCallback(async (size: string, category: string | null, qty: number) => {
    const normSize = size.trim().toLowerCase();
    const normCat = (category || 'general').trim().toLowerCase();

    // Find match by size and optional category, or fallback to size
    let target = inventory.find(i => 
      i.size.trim().toLowerCase() === normSize && 
      i.category.trim().toLowerCase() === normCat
    );
    if (!target) {
      target = inventory.find(i => i.size.trim().toLowerCase() === normSize);
    }

    if (target) {
      const nextStock = Math.max(0, target.on_hand - qty);
      const updated = inventory.map(item => {
        if (item.id !== target!.id) return item;
        return {
          ...item,
          on_hand: nextStock,
          updated_at: new Date().toISOString(),
        };
      });
      try {
        await saveInventory(updated, `Deducted ${qty} packed units for size ${size}`);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Failed to deduct packed stock', e);
      }
    }
  }, [inventory, saveInventory]);

  const addInventoryItem = useCallback(async (item: Omit<InventoryItem, 'id' | 'updated_at'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      updated_at: new Date().toISOString(),
    };
    const updated = [...inventory, newItem];
    try {
      await saveInventory(updated, `Added inventory item for size ${item.size}`);
      toast.success(`Size ${item.size} added to warehouse inventory`);
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Failed to add inventory item');
      return false;
    }
  }, [inventory, saveInventory]);

  return {
    inventory,
    lowStockItems,
    outOfStockItems,
    hasReplenishmentAlert,
    loading,
    canEdit,
    adjustStock,
    setStockExact,
    deductPackedStock,
    addInventoryItem,
    refresh: () => {},
  };
};
