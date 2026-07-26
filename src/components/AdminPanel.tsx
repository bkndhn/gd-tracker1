import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/types/database';

import { UserManagement } from '@/components/admin/UserManagement';
import { WhatsAppSettings } from '@/components/admin/WhatsAppSettings';
import { CustomFieldManagement } from '@/components/admin/CustomFieldManagement';
import { ExportSettings } from '@/components/admin/ExportSettings';

type Shop = Database['public']['Tables']['shops']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export const AdminPanel = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('gd_app_data');

      const [shopsRes, profilesRes] = await Promise.all([
        supabase.from('shops').select('*').is('deleted_at', null).order('name'),
        supabase.from('profiles').select('*').is('deleted_at', null).order('name'),
      ]);

      if (shopsRes.error) throw shopsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setShops(shopsRes.data);
      setProfiles(profilesRes.data as Profile[]);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading admin panel...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WhatsAppSettings />
        <ShopManagement shops={shops} onRefresh={fetchData} />
      </div>

      <UserManagement shops={shops} profiles={profiles} onRefresh={fetchData} />

      <CustomFieldManagement />

      <ExportSettings />
    </div>
  );
};
