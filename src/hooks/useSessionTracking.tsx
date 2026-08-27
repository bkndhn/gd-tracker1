import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const DEVICE_KEY = 'lsi_device_id';

export const getDeviceId = (): string => {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
};

const deviceLabel = (): string => {
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad/i.test(ua);
  const browser = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : 'Browser';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Device';
  return `${browser} on ${os}${mobile ? ' (mobile)' : ''}`;
};

/**
 * Registers the current device in `user_sessions`, keeps last_active fresh,
 * and signs the user out if the device was revoked remotely.
 */
export const useSessionTracking = () => {
  const { profile, signOut } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;
    const deviceId = getDeviceId();
    const adminId = (profile as any).role === 'admin' || (profile as any).role === 'super_admin'
      ? profile.id
      : (profile as any).admin_id;

    const beat = async () => {
      try {
        const { data } = await (supabase.from('user_sessions') as any).upsert(
          {
            user_id: profile.id,
            admin_id: adminId,
            device_id: deviceId,
            device_label: deviceLabel(),
            user_agent: navigator.userAgent.slice(0, 300),
            last_active_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,device_id' },
        ).select('revoked_at').maybeSingle();

        if (data?.revoked_at) {
          toast.error('This device was signed out by an administrator.', { duration: 8000 });
          await signOut();
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('session tracking', e);
      }
    };

    void beat();
    const id = setInterval(beat, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);
};
