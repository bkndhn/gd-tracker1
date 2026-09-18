import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/types/database';

import { UserManagement } from '@/components/admin/UserManagement';
import { ShopManagement } from '@/components/admin/ShopManagement';
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
import { ThemeSettings } from '@/components/admin/ThemeSettings';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemedSearchInput } from '@/components/ThemedSearchInput';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n';
import {
  Wand2,
  Search,
  X,
  Users,
  SlidersHorizontal,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Building2,
} from 'lucide-react';

type Shop = Database['public']['Tables']['shops']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

type AdminTab = 'team' | 'fields' | 'whatsapp' | 'scoring' | 'security';

interface SettingSection {
  id: string;
  tab: AdminTab;
  tabLabel: string;
  title: string;
  description: string;
  keywords: string[];
  render: () => React.ReactNode;
}

export const AdminPanel = () => {
  const { t } = useTranslation();
  const [shops, setShops] = useState<Shop[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('team');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Section catalog for instant search and categorization
  const sections: SettingSection[] = useMemo(
    () => [
      {
        id: 'usage-metering',
        tab: 'team',
        tabLabel: 'Team & Shops',
        title: 'Plan & Resource Quotas',
        description: 'Resource usage metering, plan limits, shops quota, custom fields quota, and users',
        keywords: ['usage', 'metering', 'limits', 'quota', 'plan', 'tier', 'shops limit', 'custom fields', 'entries', 'users', 'billing'],
        render: () => <UsageMetering key="usage" />,
      },
      {
        id: 'shop-management',
        tab: 'team',
        tabLabel: 'Team & Shops',
        title: 'Shops & Outlets Management',
        description: 'Manage authorized physical shops, track max shops quota, and view assigned staff count',
        keywords: ['shops', 'stores', 'branches', 'locations', 'outlets', 'branch', 'store quota', 'max shops', 'shop limit'],
        render: () => <ShopManagement key="shops" onRefresh={fetchData} />,
      },
      {
        id: 'user-management',
        tab: 'team',
        tabLabel: 'Team & Shops',
        title: 'User & Staff Management',
        description: 'Manage team members, roles, shop store assignments, password reset, and access permissions',
        keywords: ['users', 'staff', 'team', 'roles', 'admin', 'manager', 'warehouse', 'password', 'invite', 'accounts', 'permissions', 'assignment'],
        render: () => <UserManagement key="users" shops={shops} profiles={profiles} onRefresh={fetchData} />,
      },
      {
        id: 'custom-fields',
        tab: 'fields',
        tabLabel: 'Forms & Fields',
        title: 'Custom Field Management',
        description: 'Configure visit log questions, custom dropdown options, single/multi-selects, and quota safeguards',
        keywords: ['custom fields', 'fields', 'dropdown', 'options', 'tags', 'categories', 'form builder', 'text fields', 'single select', 'multi select', 'loophole'],
        render: () => <CustomFieldManagement key="custom-fields" />,
      },
      {
        id: 'requirement-settings',
        tab: 'fields',
        tabLabel: 'Forms & Fields',
        title: 'Requirement & Stock Workflow Settings',
        description: 'Configure order size options, requirement presets, and shop fulfillment workflow controls',
        keywords: ['requirements', 'stock', 'sizes', 'workflow', 'pack', 'move', 'fulfill', 'inventory settings', 'orders', 'warehouse'],
        render: () => <RequirementSettings key="req-settings" />,
      },
      {
        id: 'whatsapp-settings',
        tab: 'whatsapp',
        tabLabel: 'WhatsApp Integration',
        title: 'WhatsApp Cloud API Configuration',
        description: 'Meta WhatsApp Cloud API credentials, Phone Number ID, business account, and message templates',
        keywords: ['whatsapp', 'meta', 'cloud api', 'token', 'phone number id', 'credentials', 'templates', 'waba', 'facebook'],
        render: () => <WhatsAppSettings key="wa-settings" />,
      },
      {
        id: 'whatsapp-followup',
        tab: 'whatsapp',
        tabLabel: 'WhatsApp Integration',
        title: 'Automated WhatsApp Follow-Ups',
        description: 'Automated visit follow-up scheduling, message delays, reminder templates, and customer outreach',
        keywords: ['follow up', 'automated messages', 'followup schedule', 'visit message', 'customer reminder', 'timing', 'delay'],
        render: () => <WhatsAppFollowUpSettings key="wa-followup" />,
      },
      {
        id: 'whatsapp-intake',
        tab: 'whatsapp',
        tabLabel: 'WhatsApp Integration',
        title: 'WhatsApp Intake & Chatbot Settings',
        description: 'Inbound message processing, automated conversational intake rules, and auto-reply logic',
        keywords: ['intake', 'inbound', 'auto reply', 'chatbot', 'incoming messages', 'bot', 'conversation'],
        render: () => <WhatsAppIntakeSettings key="wa-intake" />,
      },
      {
        id: 'whatsapp-webhook',
        tab: 'whatsapp',
        tabLabel: 'WhatsApp Integration',
        title: 'WhatsApp Webhook Monitor & Logs',
        description: 'Real-time webhook delivery logs, health monitoring, event payloads, and verification',
        keywords: ['webhook', 'monitor', 'delivery', 'events', 'payload', 'ping', 'callback', 'logs', 'meta webhook'],
        render: () => <WhatsAppWebhookMonitor key="wa-webhook" />,
      },
      {
        id: 'scoring-model',
        tab: 'scoring',
        tabLabel: 'Scoring & Reports',
        title: 'Customer Scoring Model',
        description: 'Customer conversion scoring weights, lead qualification rules, purchasing intent, and thresholds',
        keywords: ['scoring', 'lead score', 'customer score', 'weights', 'conversion', 'intent', 'algorithm', 'qualification'],
        render: () => <ScoringModelSettings key="scoring" />,
      },
      {
        id: 'digest-schedule',
        tab: 'scoring',
        tabLabel: 'Scoring & Reports',
        title: 'Digest Schedule & Automated Reports',
        description: 'Automated daily or weekly summary digests delivered to management and staff',
        keywords: ['digest', 'schedule', 'daily summary', 'weekly report', 'notifications', 'email report', 'executive digest'],
        render: () => <DigestScheduleSettings key="digest" />,
      },
      {
        id: 'export-settings',
        tab: 'scoring',
        tabLabel: 'Scoring & Reports',
        title: 'Export Settings & Defaults',
        description: 'Global CSV and PDF export preferences, date formats, encoding, and download parameters',
        keywords: ['export', 'csv', 'pdf', 'download', 'format', 'date format', 'encoding', 'defaults'],
        render: () => <ExportSettings key="export-settings" />,
      },
      {
        id: 'export-templates',
        tab: 'scoring',
        tabLabel: 'Scoring & Reports',
        title: 'Export Column Templates',
        description: 'Customizable export field mappings, column selections, and tailored report layouts',
        keywords: ['template', 'columns', 'mapping', 'report layout', 'fields export', 'custom columns'],
        render: () => <ExportTemplateSettings key="export-templates" />,
      },
      {
        id: 'data-privacy',
        tab: 'security',
        tabLabel: 'Privacy & System',
        title: 'Customer Data Privacy & Masking',
        description: 'GDPR/DPDP compliance controls, customer phone number masking, and access audit logging',
        keywords: ['privacy', 'masking', 'gdpr', 'dpdp', 'pii', 'phone masking', 'anonymization', 'compliance', 'security'],
        render: () => <CustomerDataPrivacy key="privacy" />,
      },
      {
        id: 'retention-settings',
        tab: 'security',
        tabLabel: 'Privacy & System',
        title: 'Data Retention & Auto-Purge',
        description: 'Visit log retention periods, automated purge policies, and storage lifecycle management',
        keywords: ['retention', 'purge', 'archive', 'data lifecycle', 'delete old logs', 'cleanup', 'storage'],
        render: () => <RetentionSettings key="retention" />,
      },
      {
        id: 'sessions-panel',
        tab: 'security',
        tabLabel: 'Privacy & System',
        title: 'Active Sessions & Device Security',
        description: 'View active concurrent user logins, revoke suspicious devices, and audit sessions',
        keywords: ['sessions', 'devices', 'login', 'security', 'concurrent', 'revoke', 'ip address', 'auth', 'tokens'],
        render: () => <SessionsPanel key="sessions" />,
      },
      {
        id: 'theme-settings',
        tab: 'security',
        tabLabel: 'Privacy & System',
        title: 'Client Theme & Notification Bar Color',
        description: 'Customize your organization brand theme color and sync with the mobile status/notification bar',
        keywords: ['theme', 'color', 'brand', 'notification bar', 'status bar', 'palette', 'purple', 'blue', 'emerald', 'rose', 'appearance', 'branding'],
        render: () => <ThemeSettings key="theme-settings" />,
      },
      {
        id: 'ops-health',
        tab: 'security',
        tabLabel: 'Privacy & System',
        title: 'Operational Health & Background Services',
        description: 'System operational status, Supabase connectivity, edge functions, and service diagnostics',
        keywords: ['health', 'ops', 'services', 'uptime', 'database', 'status', 'diagnostics', 'system health'],
        render: () => <OpsHealthPanel key="ops-health" />,
      },
    ],
    [shops, profiles]
  );

  // Filtered sections when searching
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return sections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.description.toLowerCase().includes(q) ||
        sec.tabLabel.toLowerCase().includes(q) ||
        sec.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [searchQuery, sections]);

  // Tab definitions with counts and vibrant themed active styles
  const tabDefs = [
    {
      id: 'team',
      label: 'Team & Shops',
      icon: Users,
      count: 3,
      activeClass: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-indigo-500/20',
      iconClass: 'text-indigo-500 group-data-[state=active]:text-white',
    },
    {
      id: 'fields',
      label: 'Forms & Fields',
      icon: SlidersHorizontal,
      count: 2,
      activeClass: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-cyan-500/20',
      iconClass: 'text-cyan-500 group-data-[state=active]:text-white',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: MessageSquare,
      count: 4,
      activeClass: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/20',
      iconClass: 'text-emerald-500 group-data-[state=active]:text-white',
    },
    {
      id: 'scoring',
      label: 'Scoring & Reports',
      icon: BarChart3,
      count: 4,
      activeClass: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/20',
      iconClass: 'text-amber-500 group-data-[state=active]:text-white',
    },
    {
      id: 'security',
      label: 'Privacy & System',
      icon: ShieldCheck,
      count: 5,
      activeClass: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/20',
      iconClass: 'text-purple-500 group-data-[state=active]:text-white',
    },
  ] as const;

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner with Guided Setup */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t('admin.title')}</h1>
              <p className="text-xs text-muted-foreground">
                {t('admin.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setWizardOpen(true)}
          className="gap-2 shrink-0 border-primary/30 hover:bg-primary/5 text-xs font-medium"
        >
          <Wand2 className="h-3.5 w-3.5 text-primary" /> {t('admin.guidedSetup')}
        </Button>
      </div>

      <OnboardingWizard
        open={wizardOpen}
        onOpenChange={(v) => {
          setWizardOpen(v);
          if (!v) fetchData();
        }}
      />

      {/* Sticky Search Bar */}
      <div className="sticky top-2 z-20 p-2 rounded-xl bg-background/90 backdrop-blur-md border shadow-sm">
        <ThemedSearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search all settings (e.g. shops, custom fields, whatsapp, users, scoring, retention, privacy)..."
          shortcut="/"
        />
      </div>

      {/* Search Results View OR Tabbed View */}
      {searchQuery.trim() !== '' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Search Results:</span>
              <Badge variant="secondary" className="text-xs font-mono">
                {filteredSections.length} found for "{searchQuery}"
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="text-xs text-muted-foreground hover:text-foreground h-8"
            >
              Clear Search & Show Tabs
            </Button>
          </div>

          {filteredSections.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <div className="max-w-sm mx-auto space-y-3">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="font-semibold text-sm">No settings matching "{searchQuery}"</p>
                <p className="text-xs text-muted-foreground">
                  Try searching for keywords like "shops", "quota", "whatsapp", "users", "export", or "privacy".
                </p>
                <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="mt-2 text-xs">
                  View All Tabs
                </Button>
              </div>
            </Card>
          ) : (
            filteredSections.map((sec) => (
              <div key={sec.id} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Badge variant="outline" className="text-xs bg-muted/50 border-primary/20 text-primary font-medium">
                    {sec.tabLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">• {sec.title}</span>
                </div>
                {sec.render()}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Organized Tabs View */
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)} className="space-y-6">
          {/* Scrollable responsive tabs list */}
          <div className="overflow-x-auto no-scrollbar pb-1">
            <TabsList className="w-full inline-flex sm:grid sm:grid-cols-5 h-auto p-1.5 gap-1.5 bg-muted/60 border rounded-xl min-w-max sm:min-w-0">
              {tabDefs.map(({ id, label, icon: Icon, count, activeClass, iconClass }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className={`group flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${activeClass} data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50`}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${iconClass}`} />
                  <span className="font-medium tracking-tight">{label}</span>
                  <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted-foreground/15 group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white font-bold transition-all">
                    {count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Tab 1: Team & Shops */}
          <TabsContent value="team" className="space-y-6 mt-0">
            {/* 1. Plan & Resource Quotas */}
            <UsageMetering />

            {/* 2. Shop & Outlet Management */}
            <ShopManagement onRefresh={fetchData} />

            {/* 3. User & Staff Management */}
            <UserManagement shops={shops} profiles={profiles} onRefresh={fetchData} />
          </TabsContent>

          {/* Tab 2: Forms & Fields */}
          <TabsContent value="fields" className="space-y-6 mt-0">
            {/* 1. Custom Field Management with Quotas */}
            <CustomFieldManagement />

            {/* 2. Requirement & Stock Workflow Settings */}
            <RequirementSettings />
          </TabsContent>

          {/* Tab 3: WhatsApp Integration */}
          <TabsContent value="whatsapp" className="space-y-6 mt-0">
            {/* 1. Cloud API credentials */}
            <WhatsAppSettings />

            {/* 2. Automated Follow-Ups */}
            <WhatsAppFollowUpSettings />

            {/* 3. Inbound Intake */}
            <WhatsAppIntakeSettings />

            {/* 4. Real-time Webhook Monitor */}
            <WhatsAppWebhookMonitor />
          </TabsContent>

          {/* Tab 4: Scoring & Reports */}
          <TabsContent value="scoring" className="space-y-6 mt-0">
            {/* 1. Scoring Model */}
            <ScoringModelSettings />

            {/* 2. Digest Schedule */}
            <DigestScheduleSettings />

            {/* 3. Export Preferences */}
            <ExportSettings />

            {/* 4. Column Templates */}
            <ExportTemplateSettings />
          </TabsContent>

          {/* Tab 5: Privacy & System */}
          <TabsContent value="security" className="space-y-6 mt-0">
            {/* 1. Client Theme & Notification Bar Color */}
            <ThemeSettings />

            {/* 2. Customer Data Privacy & Masking */}
            <CustomerDataPrivacy />

            {/* 2. Data Retention & Purge */}
            <RetentionSettings />

            {/* 3. Active Sessions */}
            <SessionsPanel />

            {/* 4. Operational Health */}
            <OpsHealthPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
