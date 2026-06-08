import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PendingEntry {
  id: string;
  formData: any;
  images: File[];
  timestamp: number;
}

const DB_NAME = 'gd_offline_db';
const STORE_NAME = 'pending_entries';
const DB_VERSION = 1;

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize IndexedDB
  const openDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }, []);

  // Save entry to IndexedDB
  const saveOfflineEntry = useCallback(async (formData: any, images: File[]) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const entry: PendingEntry = {
        id: `offline_${Date.now()}_${Math.random()}`,
        formData,
        images,
        timestamp: Date.now(),
      };
      
      await store.add(entry);
      await updatePendingCount();
      toast.info('Entry saved offline. Will sync when online.');
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error saving offline entry:', error);
      toast.error('Failed to save entry offline');
      return false;
    }
  }, [openDB]);

  // Get all pending entries
  const getPendingEntries = useCallback(async (): Promise<PendingEntry[]> => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error getting pending entries:', error);
      return [];
    }
  }, [openDB]);

  // Delete synced entry
  const deleteEntry = useCallback(async (id: string) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await store.delete(id);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error deleting entry:', error);
    }
  }, [openDB]);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const entries = await getPendingEntries();
    setPendingCount(entries.length);
  }, [getPendingEntries]);

  // Sync pending entries
  const syncPendingEntries = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    
    const entries = await getPendingEntries();
    if (entries.length === 0) return;

    setIsSyncing(true);
    toast.info(`Syncing ${entries.length} pending entry/entries...`);

    let successCount = 0;
    let failCount = 0;

    for (const entry of entries) {
      try {
        // Create GD entry
        const { data: entryData, error: entryError } = await supabase
          .from('goods_damaged_entries')
          .insert(entry.formData)
          .select()
          .single();

        if (entryError) throw entryError;

        // Upload images if any
        if (entry.images.length > 0) {
          const tenantPrefix = entryData.admin_id || entry.formData?.admin_id;
          const uploadPromises = entry.images.map(async (file, index) => {
            const fileName = `${tenantPrefix}/${entryData.id}/${Date.now()}-${index}-${file.name}`;
            const { data, error } = await supabase.storage
              .from('gd-entry-images')
              .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (error) throw error;

            const { data: signedData } = await supabase.storage
              .from('gd-entry-images')
              .createSignedUrl(data.path, 3600);

            await supabase.from('gd_entry_images').insert({
              gd_entry_id: entryData.id,
              image_url: signedData?.signedUrl || data.path,
              image_name: file.name,
              file_size: file.size
            });
          });

          await Promise.all(uploadPromises);
        }

        // Delete from IndexedDB
        await deleteEntry(entry.id);
        successCount++;

      } catch (error) {
        if (import.meta.env.DEV) console.error('Error syncing entry:', error);
        failCount++;
      }
    }

    setIsSyncing(false);
    await updatePendingCount();

    if (successCount > 0) {
      toast.success(`Synced ${successCount} entry/entries successfully!`);
    }
    if (failCount > 0) {
      toast.error(`Failed to sync ${failCount} entry/entries`);
    }
  }, [isOnline, isSyncing, getPendingEntries, deleteEntry, updatePendingCount]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing pending entries...');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Entries will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      syncPendingEntries();
    }
  }, [isOnline, pendingCount, isSyncing, syncPendingEntries]);

  // Initial pending count
  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    saveOfflineEntry,
    syncPendingEntries,
  };
};
