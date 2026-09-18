import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

type TableName =
  | 'goods_damaged_entries'
  | 'profiles'
  | 'shops'
  | 'categories'
  | 'sizes'
  | 'customer_types'
  | 'gd_entry_images'
  | 'app_settings'
  | 'stock_requirements'
  | 'custom_fields'
  | 'custom_field_options';

interface UseRealtimeSyncOptions {
  tables: TableName[];
  onProfileDeleted?: (userId: string) => void;
  onProfilePaused?: (userId: string, adminId?: string | null) => void;
  enabled?: boolean;
}

export const useRealtimeSync = ({
  tables,
  onProfileDeleted,
  onProfilePaused,
  enabled = true,
}: UseRealtimeSyncOptions) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const invalidateQueries = useCallback((table: string) => {
    switch (table) {
      case 'goods_damaged_entries':
        queryClient.invalidateQueries({ queryKey: ['dashboard-entries'] });
        queryClient.invalidateQueries({ queryKey: ['reports-data'] });
        window.dispatchEvent(new CustomEvent('gd:entry_updated'));
        break;
      case 'stock_requirements':
        queryClient.invalidateQueries({ queryKey: ['stock-requirements'] });
        window.dispatchEvent(new CustomEvent('gd:requirement_updated', { detail: { realtime: true } }));
        break;
      case 'custom_fields':
      case 'custom_field_options':
        queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
        window.dispatchEvent(new CustomEvent('gd:custom_fields_updated'));
        break;
      case 'profiles':
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
        break;
      case 'shops':
        queryClient.invalidateQueries({ queryKey: ['shops'] });
        queryClient.invalidateQueries({ queryKey: ['cached-data'] });
        break;
      case 'categories':
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        queryClient.invalidateQueries({ queryKey: ['cached-data'] });
        break;
      case 'sizes':
        queryClient.invalidateQueries({ queryKey: ['sizes'] });
        queryClient.invalidateQueries({ queryKey: ['cached-data'] });
        break;
      case 'customer_types':
        queryClient.invalidateQueries({ queryKey: ['customer-types'] });
        queryClient.invalidateQueries({ queryKey: ['cached-data'] });
        break;
      case 'gd_entry_images':
        queryClient.invalidateQueries({ queryKey: ['dashboard-entries'] });
        queryClient.invalidateQueries({ queryKey: ['reports-data'] });
        break;
      case 'app_settings':
        queryClient.invalidateQueries({ queryKey: ['app-settings'] });
        break;
      default:
        queryClient.invalidateQueries();
    }
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `rt_sync_${Math.random().toString(36).substring(2, 9)}`;
    let channel: any = null;

    try {
      channel = supabase.channel(channelName, {
        config: { broadcast: { self: true } },
      });

      tables.forEach((table) => {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload: any) => {
            if (import.meta.env.DEV) console.log(`Realtime update on ${table}:`, payload.eventType);
            
            if (table === 'profiles') {
              if (payload.eventType === 'DELETE') {
                const deletedId = (payload.old as any)?.id;
                if (deletedId && onProfileDeleted) onProfileDeleted(deletedId);
              } else if (payload.eventType === 'UPDATE') {
                const updatedProfile = payload.new as any;
                if (updatedProfile?.deleted_at && onProfileDeleted) {
                  onProfileDeleted(updatedProfile.id);
                }
                if (updatedProfile?.status === 'paused' && onProfilePaused) {
                  onProfilePaused(updatedProfile.id, updatedProfile.admin_id);
                }
              }
            }
            
            invalidateQueries(table);
          }
        );
      });

      channel.subscribe();
      channelRef.current = channel;
    } catch (err) {
      if (import.meta.env.DEV) console.error('useRealtimeSync error', err);
    }

    return () => {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {}
        channelRef.current = null;
      }
    };
  }, [enabled, tables.join(','), invalidateQueries, onProfileDeleted, onProfilePaused]);

  const refresh = useCallback(() => {
    tables.forEach((table) => invalidateQueries(table));
  }, [tables, invalidateQueries]);

  return { refresh };
};

// Hook for force logout when user is deleted or paused
export const useForceLogoutOnDelete = (
  currentUserId: string | undefined,
  currentAdminId: string | null | undefined,
  signOut: () => Promise<{ error: any }>
) => {
  const handleProfileDeleted = useCallback(
    async (deletedUserId: string) => {
      if (currentUserId && deletedUserId === currentUserId) {
        toast.error('Your account has been removed.');
        await signOut();
        window.location.href = '/';
      }
    },
    [currentUserId, signOut]
  );

  const handleProfilePaused = useCallback(
    async (pausedUserId: string, pausedAdminId?: string | null) => {
      if (!currentUserId) return;
      
      // Force logout if:
      // 1. Current user is directly paused
      // 2. Current user's admin is paused (sub-user of paused admin)
      const isCurrentUser = pausedUserId === currentUserId;
      const isMyAdmin = pausedUserId === currentAdminId;
      // Also handle: current user is a sub-user whose admin_id matches the paused user
      const isPausedAdminOfMe = currentAdminId && pausedUserId === currentAdminId;
      
      if (isCurrentUser || isMyAdmin || isPausedAdminOfMe) {
        toast.error('Your account has been paused. Please contact the administrator.', { duration: 8000 });
        await signOut();
        window.location.href = '/';
      }
    },
    [currentUserId, currentAdminId, signOut]
  );

  return { handleProfileDeleted, handleProfilePaused };
};
