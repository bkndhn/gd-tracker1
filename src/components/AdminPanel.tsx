import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/types/database';

import { UserManagement } from '@/components/admin/UserManagement';
import { WhatsAppSettings } from '@/components/admin/WhatsAppSettings';
import { WhatsAppFollowUpSettings } from '@/components/admin/WhatsAppFollowUpSettings';
import { WhatsAppIntakeSettings } from '@/components/admin/WhatsAppIntakeSettings';
import { WhatsAppWebhookMonitor } from '@/components/admin/WhatsAppWebhookMonitor';
import { CustomFieldManagement } from '@/components/admin/CustomFieldManagement';
import { RequirementSettings } from '@/components/admin/RequirementSettings';
import { ExportSettings } from '@/components/admin/ExportSettings';
import { ScoringModelSettings } from '@/components/admin/ScoringModelSettings';
import { DigestScheduleSettings } from '@/components/admin/DigestScheduleSettings';
import { ExportTemplateSettings } from '@/components/admin/ExportTemplateSettings';
import { RetentionSettings } from '@/components/admin/RetentionSettings';
import { CustomerDataPrivacy } from '@/components/admin/CustomerDataPrivacy';
import { SessionsPanel } from '@/components/admin/SessionsPanel';
import { UsageMetering } from '@/components/admin/UsageMetering';
import { OpsHealthPanel } from '@/components/admin/OpsHealthPanel';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2 } from 'lucide-react';

type Shop = Database['public']['Tables']['shops']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export const AdminPanel = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

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
      <Card className="premium-card">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4 text-primary" /> Guided setup
            </CardTitle>
            <CardDescription>
              Re-run the setup wizard to rename your fields, seed options and invite your team.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
            Open wizard
          </Button>
        </CardHeader>
        <CardContent className="hidden" />
      </Card>

      <OnboardingWizard
        open={wizardOpen}
        onOpenChange={(v) => { setWizardOpen(v); if (!v) fetchData(); }}
      />

      {/* Plan & Usage Metering - visible to all users */}
      <UsageMetering />

      <WhatsAppSettings />

      <WhatsAppFollowUpSettings />

      <WhatsAppIntakeSettings />
      <WhatsAppWebhookMonitor />


      <OpsHealthPanel />

      <UserManagement shops={shops} profiles={profiles} onRefresh={fetchData} />

      <CustomFieldManagement />

      <RequirementSettings />


      <ScoringModelSettings />

      <DigestScheduleSettings />

      <RetentionSettings />

      <CustomerDataPrivacy />

      <SessionsPanel />

      <ExportTemplateSettings />

      <ExportSettings />
    </div>
  );
};
