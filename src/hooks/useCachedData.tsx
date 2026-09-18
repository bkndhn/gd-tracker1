
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet } from '@/lib/offlineDb';
import { useAuth } from '@/hooks/useAuth';

interface CachedData {
  categories: any[];
  sizes: any[];
  shops: any[];
  lastFetched: number;
}

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export const useCachedData = () => {
  const { adminId, isSuperAdmin, profile } = useAuth();
  const effectiveAdminId = adminId || (profile as any)?.admin_id || profile?.id;
  const [categories, setCategories] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const CACHE_KEY = `gd_app_data_${effectiveAdminId || 'all'}`;
  const IDB_KEY = `reference:lookups:${effectiveAdminId || 'all'}`;

  const loadData = useCallback(async () => {
    try {
      // Check cache first
      const cachedDataStr = localStorage.getItem(CACHE_KEY);
      const now = Date.now();

      if (cachedDataStr) {
        const cachedData: CachedData = JSON.parse(cachedDataStr);
        if (now - cachedData.lastFetched < CACHE_DURATION) {
          setCategories(cachedData.categories);
          setSizes(cachedData.sizes);
          setShops(cachedData.shops);
          setLoading(false);
          return;
        }
      }

      // Offline: serve the durable IndexedDB copy
      if (!navigator.onLine) {
        const offline = await cacheGet<CachedData>(IDB_KEY);
        if (offline) {
          setCategories(offline.value.categories);
          setSizes(offline.value.sizes);
          setShops(offline.value.shops);
          setLoading(false);
          return;
        }
      }

      let shopsQuery = supabase.from('shops').select('*').is('deleted_at', null).order('name');
      if (!isSuperAdmin && effectiveAdminId) {
        shopsQuery = shopsQuery.eq('admin_id', effectiveAdminId);
      }

      // Fetch from Supabase if cache is expired or doesn't exist
      const [categoriesRes, sizesRes, shopsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
        shopsQuery,
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (sizesRes.error) throw sizesRes.error;
      if (shopsRes.error) throw shopsRes.error;

      const newData: CachedData = {
        categories: categoriesRes.data,
        sizes: sizesRes.data,
        shops: shopsRes.data,
        lastFetched: now,
      };

      // Cache the data
      localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
      void cacheSet(IDB_KEY, newData);

      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
      setShops(shopsRes.data);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error loading data:', error);
      const offline = await cacheGet<CachedData>(IDB_KEY);
      if (offline) {
        setCategories(offline.value.categories);
        setSizes(offline.value.sizes);
        setShops(offline.value.shops);
      }
    } finally {
      setLoading(false);
    }
  }, [CACHE_KEY, IDB_KEY, effectiveAdminId, isSuperAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshCache = () => {
    localStorage.removeItem(CACHE_KEY);
    loadData();
  };

  return {
    categories,
    sizes,
    shops,
    loading,
    refreshCache,
  };
};
