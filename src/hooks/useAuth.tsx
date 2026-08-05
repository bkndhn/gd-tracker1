
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cacheClear } from '@/lib/offlineDb';
import { Database } from '@/types/database';
import { toast } from 'sonner';
import { logAudit } from '@/utils/auditLog';

type Profile = Database['public']['Tables']['profiles']['Row'];

const PROFILE_CACHE_KEY = 'user_profile';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const fetchSuperAdminEmail = async (): Promise<string | null> => {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'super_admin')
      .limit(1)
      .maybeSingle();
    return (data as any)?.email || null;
  } catch {
    return null;
  }
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          localStorage.removeItem(PROFILE_CACHE_KEY);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, retryCount = 0) => {
    try {
      const cachedProfileStr = localStorage.getItem(PROFILE_CACHE_KEY);
      const now = Date.now();

      if (cachedProfileStr) {
        const cachedProfile = JSON.parse(cachedProfileStr);
        if (now - cachedProfile.lastFetched < CACHE_DURATION && cachedProfile.id === userId) {
          setProfile(cachedProfile.data);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.message?.includes('JWT') || error.message?.includes('unauthorized') || error.code === 'PGRST301') {
          if (import.meta.env.DEV) console.error('Auth error fetching profile:', error);
          await signOut();
          return;
        }
        
        if (retryCount < 3) {
          if (import.meta.env.DEV) console.log(`Profile fetch attempt ${retryCount + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return fetchProfile(userId, retryCount + 1);
        }
        
        if (import.meta.env.DEV) console.error('Error fetching profile after retries:', error);
        throw error;
      }

      if (data.deleted_at) {
        await signOut();
        return;
      }

      const profileData = data as any;
      if (profileData.status === 'paused') {
        const saEmail = await fetchSuperAdminEmail();
        const contactMsg = saEmail
          ? `Your account has been paused. Please contact the administrator at ${saEmail}.`
          : 'Your account has been paused. Please contact the administrator.';
        toast.error(contactMsg, { duration: 8000 });
        await signOut();
        return;
      }

      if (profileData.role !== 'admin' && profileData.role !== 'super_admin' && profileData.admin_id) {
        const { data: adminData } = await supabase
          .from('profiles')
          .select('status, deleted_at')
          .eq('id', profileData.admin_id)
          .single();
        
        if (adminData && (adminData as any).status === 'paused') {
          const saEmail = await fetchSuperAdminEmail();
          const contactMsg = saEmail
            ? `Your organization has been paused. Please contact the administrator at ${saEmail}.`
            : 'Your organization has been paused. Please contact the administrator.';
          toast.error(contactMsg, { duration: 8000 });
          await signOut();
          return;
        }

        if (adminData && (adminData as any).deleted_at) {
          toast.error('Your organization account has been removed. Please contact the administrator.');
          await signOut();
          return;
        }
      }

      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() } as any)
        .eq('id', userId);

      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        data,
        lastFetched: now,
        id: userId
      }));

      setProfile(data as Profile);
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error fetching profile:', error);
      if (error?.message?.includes('JWT') || error?.message?.includes('unauthorized')) {
        await signOut();
      }
    } finally {
      setLoading(false);
    }
  };

  const checkUserStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('deleted_at, status')
        .eq('id', user.id)
        .single();

      const profileData = data as any;
      if (error || !data || profileData.deleted_at || profileData.status === 'paused') {
        if (profileData?.status === 'paused') {
          const saEmail = await fetchSuperAdminEmail();
          const contactMsg = saEmail
            ? `Your account has been paused. Please contact the administrator at ${saEmail}.`
            : 'Your account has been paused. Please contact the administrator.';
          toast.error(contactMsg, { duration: 8000 });
        }
        await signOut();
      }
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error checking user status:', error);
      if (error.message?.includes('JWT') || error.message?.includes('unauthorized')) {
        await signOut();
      }
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    await logAudit({ action: 'logout' });
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem('gd_app_data');
    void cacheClear();
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const refreshProfile = async () => {
    if (!user) return;
    localStorage.removeItem(PROFILE_CACHE_KEY);
    await fetchProfile(user.id);
  };

  return {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    refreshProfile,
    checkUserStatus,
    isSuperAdmin: profile?.role === 'super_admin',
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'manager',
    userShopId: profile?.shop_id,
    adminId: profile?.admin_id,
  };
};
