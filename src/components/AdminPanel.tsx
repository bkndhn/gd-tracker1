import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/types/database';
import { ShopManagement } from '@/components/admin/ShopManagement';
import { CategoryManagement } from '@/components/admin/CategoryManagement';
import { SizeManagement } from '@/components/admin/SizeManagement';
import { CustomerTypeManagement } from '@/components/admin/CustomerTypeManagement';
import { UserManagement } from '@/components/admin/UserManagement';
import { WhatsAppSettings } from '@/components/admin/WhatsAppSettings';
import { FieldVisibilitySettings } from '@/components/admin/FieldVisibilitySettings';
import { CustomFieldManagement } from '@/components/admin/CustomFieldManagement';
import { ScheduledEmailReports } from '@/components/admin/ScheduledEmailReports';

type Shop = Database['public']['Tables']['shops']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];
type CustomerType = Database['public']['Tables']['customer_types']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export const AdminPanel = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('gd_app_data');
      
      const [shopsRes, categoriesRes, sizesRes, customerTypesRes, profilesRes] = await Promise.all([
        supabase.from('shops').select('*').is('deleted_at', null).order('name'),
        supabase.from('categories').select('*').is('deleted_at', null).order('name'),
        supabase.from('sizes').select('*').is('deleted_at', null).order('size'),
        supabase.from('customer_types').select('*').is('deleted_at', null).order('name'),
        supabase.from('profiles').select('*').is('deleted_at', null).order('name'),
      ]);

      if (shopsRes.error) throw shopsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (sizesRes.error) throw sizesRes.error;
      if (customerTypesRes.error) throw customerTypesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setShops(shopsRes.data);
      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
      setCustomerTypes(customerTypesRes.data);
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
      {/* Settings Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WhatsAppSettings />
        <FieldVisibilitySettings />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <ShopManagement shops={shops} onRefresh={fetchData} />
        <CategoryManagement categories={categories} onRefresh={fetchData} />
        <SizeManagement sizes={sizes} onRefresh={fetchData} />
        <CustomerTypeManagement customerTypes={customerTypes} onRefresh={fetchData} />
      </div>
      
      <UserManagement shops={shops} profiles={profiles} onRefresh={fetchData} />
      
      <CustomFieldManagement />
    </div>
  );
};
