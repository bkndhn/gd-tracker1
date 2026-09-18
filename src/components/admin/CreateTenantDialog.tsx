import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { logAudit } from '@/utils/auditLog';
import { THEME_PALETTES } from '@/hooks/useClientTheme';
import {
  Shield,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Building,
  Building2,
  Mail,
  Hash,
  Sliders,
  Sparkles,
  ClipboardList,
  Layers,
  Palette,
  CheckCircle2,
  Lock,
  UserPlus
} from 'lucide-react';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://jlmkvvhmtpuplnpunbhc.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbWt2dmhtdHB1cGxucHVuYmhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NzI4MzYsImV4cCI6MjA5NTQ0ODgzNn0.Se-a_ZydTdV6EIt5X6IUumJhJBS7wr3fcCVrVqUdqbs";

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function generateRandomPassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 4; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

export const CreateTenantDialog: React.FC<CreateTenantDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    tempPassword: string;
    tenantId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pwdCopied, setPwdCopied] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState(() => generateRandomPassword());
  const [mustChangePassword, setMustChangePassword] = useState(true);

  // Limits
  const [maxShops, setMaxShops] = useState(5);
  const [maxUsers, setMaxUsers] = useState(10);
  const [maxWarehouseUsers, setMaxWarehouseUsers] = useState<number | ''>(3);
  const [maxEntries, setMaxEntries] = useState<number | ''>('');
  const [maxImagesPerEntry, setMaxImagesPerEntry] = useState(10);
  const [maxImagesTotal, setMaxImagesTotal] = useState<number | ''>('');

  // Permissions & Features
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiDaily, setAiDaily] = useState<number | ''>('');
  const [aiMonthly, setAiMonthly] = useState<number | ''>('');
  const [aiLifetime, setAiLifetime] = useState<number | ''>('');

  const [reqEnabled, setReqEnabled] = useState(true);
  const [maxReqMonthly, setMaxReqMonthly] = useState<number | ''>('');

  const [customFieldsEnabled, setCustomFieldsEnabled] = useState(true);
  const [maxCustomFields, setMaxCustomFields] = useState<number | ''>(5);
  const [maxOptionsPerField, setMaxOptionsPerField] = useState<number | ''>(20);

  // Theme
  const [themeColor, setThemeColor] = useState('indigo');

  const handleRegeneratePassword = () => {
    setTempPassword(generateRandomPassword());
    toast.info('New temporary password generated');
  };

  const handleCopyPasswordDirect = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setPwdCopied(true);
    toast.success('Temporary password copied!');
    setTimeout(() => setPwdCopied(false), 2000);
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setTempPassword(generateRandomPassword());
    setMustChangePassword(true);
    setMaxShops(5);
    setMaxUsers(10);
    setMaxWarehouseUsers(3);
    setMaxEntries('');
    setMaxImagesPerEntry(10);
    setMaxImagesTotal('');
    setAiEnabled(true);
    setAiDaily('');
    setAiMonthly('');
    setAiLifetime('');
    setReqEnabled(true);
    setMaxReqMonthly('');
    setCustomFieldsEnabled(true);
    setMaxCustomFields(5);
    setMaxOptionsPerField(20);
    setThemeColor('indigo');
    setCreatedCredentials(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleCopyCredentials = async () => {
    if (!createdCredentials) return;
    const text = `Tenant Workspace Credentials\n---------------------------\nWorkspace: ${createdCredentials.name}\nLogin URL: ${window.location.origin}\nEmail: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.tempPassword}\n\nNote: You will be prompted to set your permanent password upon first login.`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      toast.error('Please enter a tenant workspace or organization name');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      toast.error('Please provide a valid administrator email');
      return;
    }

    if (!tempPassword || tempPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      // 1. Create a dedicated non-persisting client so the Super Admin's active session is untouched
      const secondaryClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      // 2. Sign up the new tenant admin user
      const { data: authData, error: signUpError } = await secondaryClient.auth.signUp({
        email: trimmedEmail,
        password: tempPassword,
        options: {
          data: {
            name: trimmedName,
            role: 'admin',
            must_change_password: mustChangePassword,
            is_temp_password: true,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user?.id) {
        throw new Error('Failed to register user in authentication service');
      }

      const newUserId = authData.user.id;

      // 3. Configure all tenant limits and permissions on the profile row
      const profilePayload = {
        name: trimmedName,
        role: 'admin',
        admin_id: newUserId, // Root tenant self-reference
        status: 'active',
        max_shops: maxShops ? Number(maxShops) : 5,
        max_users: maxUsers ? Number(maxUsers) : 10,
        max_warehouse_users: maxWarehouseUsers === '' ? null : Number(maxWarehouseUsers),
        max_entries: maxEntries === '' ? null : Number(maxEntries),
        max_images_per_entry: maxImagesPerEntry ? Number(maxImagesPerEntry) : 10,
        max_images_total: maxImagesTotal === '' ? null : Number(maxImagesTotal),
        ai_enabled: aiEnabled,
        ai_daily_limit: aiDaily === '' ? null : Number(aiDaily),
        ai_monthly_limit: aiMonthly === '' ? null : Number(aiMonthly),
        ai_lifetime_limit: aiLifetime === '' ? null : Number(aiLifetime),
        requirements_enabled: reqEnabled,
        max_requirements_monthly: maxReqMonthly === '' ? null : Number(maxReqMonthly),
        custom_fields_enabled: customFieldsEnabled,
        max_custom_fields: maxCustomFields === '' ? null : Number(maxCustomFields),
        max_options_per_field: maxOptionsPerField === '' ? null : Number(maxOptionsPerField),
        theme_color: themeColor,
        must_change_password: mustChangePassword,
      };

      // Poll briefly for profile creation by trigger or update directly
      let updated = false;
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', newUserId)
          .maybeSingle();

        if (existing) {
          const { error: updateErr } = await (supabase.from('profiles') as any)
            .update(profilePayload)
            .eq('id', newUserId);
          if (!updateErr) {
            updated = true;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 250));
      }

      if (!updated) {
        // Direct upsert if trigger was delayed
        await (supabase.from('profiles') as any).upsert({
          id: newUserId,
          user_id: trimmedEmail,
          email: trimmedEmail,
          ...profilePayload,
        });
      }

      // 4. Log audit action
      await logAudit({
        action: 'create_tenant',
        details: {
          tenant_name: trimmedName,
          email: trimmedEmail,
          new_tenant_id: newUserId,
          max_shops: maxShops,
          max_users: maxUsers,
          theme_color: themeColor,
          must_change_password: mustChangePassword,
        },
      });

      // 5. Present credentials modal
      setCreatedCredentials({
        name: trimmedName,
        email: trimmedEmail,
        tempPassword,
        tenantId: newUserId,
      });

      toast.success(`Tenant "${trimmedName}" created successfully!`);
      onSuccess();
    } catch (err: any) {
      console.error('Tenant creation error:', err);
      toast.error(err.message || 'Failed to create tenant workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => (!loading ? (val ? onOpenChange(true) : handleClose()) : null)}>
      <DialogContent className="w-[96vw] max-w-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 shadow-2xl bg-card">
        {/* Sticky Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/30 shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg sm:text-xl font-bold truncate">
                {createdCredentials ? 'Tenant Provisioned Successfully' : 'Create New Tenant'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {createdCredentials
                  ? 'The workspace is active. Copy credentials to share with the admin.'
                  : 'Configure quotas, limits, brand theme, and temporary credentials.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {createdCredentials ? (
          /* Success Screen */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 overscroll-contain space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Tenant Workspace Ready for Login</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-card/90 rounded-xl p-3.5 sm:p-4 border border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Workspace / Brand</span>
                  <span className="font-semibold text-foreground text-sm">{createdCredentials.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Administrator Email</span>
                  <span className="font-semibold text-foreground text-sm font-mono break-all">{createdCredentials.email}</span>
                </div>
                <div className="sm:col-span-2 pt-2 border-t border-border/60">
                  <span className="text-muted-foreground block text-[11px] mb-1">Temporary Password</span>
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-muted/60 rounded-lg font-mono text-sm font-bold tracking-wide border">
                    <span className="select-all break-all">{createdCredentials.tempPassword}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 shrink-0 text-xs"
                      onClick={handleCopyCredentials}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-start gap-2 pt-1">
                <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>First-Time Login Policy:</strong> The tenant administrator is mandatory prompted to set a permanent password upon logging in before they can access the workspace.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                variant="default"
                className="flex-1 gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-500/20"
                onClick={handleCopyCredentials}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy Full Credentials & Login URL
              </Button>
              <Button
                variant="outline"
                className="sm:w-28"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 overscroll-contain">
              <Tabs defaultValue="basics" className="w-full">
                {/* Colorful, Proper Responsive Tabs */}
                <TabsList className="w-full flex items-center gap-1.5 p-1.5 bg-muted/50 border border-border/60 rounded-2xl overflow-x-auto no-scrollbar mb-5 shrink-0">
                  <TabsTrigger
                    value="basics"
                    className="group flex-1 min-w-[125px] sm:min-w-0 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-indigo-500/25"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-indigo-500 group-data-[state=active]:text-white shrink-0 transition-colors" />
                    <span className="truncate">Account & Auth</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="limits"
                    className="group flex-1 min-w-[125px] sm:min-w-0 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/25"
                  >
                    <Sliders className="h-3.5 w-3.5 text-violet-500 group-data-[state=active]:text-white shrink-0 transition-colors" />
                    <span className="truncate">Resource Limits</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="features"
                    className="group flex-1 min-w-[125px] sm:min-w-0 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/25"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500 group-data-[state=active]:text-white shrink-0 transition-colors" />
                    <span className="truncate">Features & Theme</span>
                  </TabsTrigger>
                </TabsList>

              {/* Tab 1: Basics & Temporary Credentials */}
              <TabsContent value="basics" className="space-y-4 focus-visible:outline-none">
                <div className="space-y-1.5">
                  <Label htmlFor="tenant-name" className="text-xs font-semibold flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-primary" />
                    Tenant Workspace / Brand Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="tenant-name"
                    placeholder="e.g. Metro Fashion Brands"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenant-email" className="text-xs font-semibold flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    Administrator Email Address <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="tenant-email"
                    type="email"
                    placeholder="admin@tenantbrand.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 text-sm font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="temp-password" className="text-xs font-semibold flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      Temporary Password <span className="text-rose-500">*</span>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRegeneratePassword}
                      className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <RefreshCw className="h-3 w-3" /> Regenerate
                    </Button>
                  </div>

                  <div className="relative flex items-center">
                    <Input
                      id="temp-password"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="font-mono text-sm tracking-wider pr-16 h-10 select-all"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyPasswordDirect}
                      className="absolute right-1 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                      title="Copy password"
                    >
                      {pwdCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Auto-generated high-entropy temporary password. You can copy it or share credentials after creation.
                  </p>
                </div>

                <Card className="border-border/60 bg-muted/30 rounded-2xl overflow-hidden mt-3">
                  <CardContent className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground">Mandatory First Login Password Change</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-primary/40 text-primary font-bold">Recommended</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Requires the tenant admin to change their temporary password immediately upon their first sign-in before accessing the dashboard.
                      </p>
                    </div>
                    <Switch
                      checked={mustChangePassword}
                      onCheckedChange={setMustChangePassword}
                      className="shrink-0"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Resource Limits */}
              <TabsContent value="limits" className="space-y-4 focus-visible:outline-none">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 p-3 rounded-xl border bg-muted/20">
                    <Label htmlFor="max-shops" className="text-xs font-semibold flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-indigo-500" /> Max Shops Quota
                    </Label>
                    <Input
                      id="max-shops"
                      type="number"
                      min={1}
                      value={maxShops}
                      onChange={(e) => setMaxShops(Number(e.target.value) || 1)}
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Maximum physical branches allowed.</p>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl border bg-muted/20">
                    <Label htmlFor="max-users" className="text-xs font-semibold flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-sky-500" /> Max Users / Staff
                    </Label>
                    <Input
                      id="max-users"
                      type="number"
                      min={1}
                      value={maxUsers}
                      onChange={(e) => setMaxUsers(Number(e.target.value) || 1)}
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Maximum staff accounts allowed.</p>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl border bg-muted/20">
                    <Label htmlFor="max-warehouse" className="text-xs font-semibold flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-amber-500" /> Max Warehouse Staff
                    </Label>
                    <Input
                      id="max-warehouse"
                      type="number"
                      min={0}
                      placeholder="e.g. 3"
                      value={maxWarehouseUsers}
                      onChange={(e) => setMaxWarehouseUsers(e.target.value === '' ? '' : Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Fulfillment staff quota.</p>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl border bg-muted/20">
                    <Label htmlFor="max-entries" className="text-xs font-semibold flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-purple-500" /> Max Visits / Entries
                    </Label>
                    <Input
                      id="max-entries"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={maxEntries}
                      onChange={(e) => setMaxEntries(e.target.value === '' ? '' : Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Leave blank for unlimited.</p>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl border bg-muted/20">
                    <Label htmlFor="max-img-entry" className="text-xs font-semibold flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-teal-500" /> Max Images / Entry
                    </Label>
                    <Input
                      id="max-img-entry"
                      type="number"
                      min={1}
                      max={30}
                      value={maxImagesPerEntry}
                      onChange={(e) => setMaxImagesPerEntry(Number(e.target.value) || 10)}
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Photos per visit (default 10).</p>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl border bg-muted/20">
                    <Label htmlFor="max-img-total" className="text-xs font-semibold flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-rose-500" /> Max Total Images
                    </Label>
                    <Input
                      id="max-img-total"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={maxImagesTotal}
                      onChange={(e) => setMaxImagesTotal(e.target.value === '' ? '' : Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Total storage image ceiling.</p>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Features & Theme */}
              <TabsContent value="features" className="space-y-4 focus-visible:outline-none">
                {/* AI Features */}
                <div className="p-3.5 sm:p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-semibold block truncate">AI Insights & Voice Transcription</span>
                        <p className="text-[11px] text-muted-foreground truncate">Voice note transcription and smart anomaly reports.</p>
                      </div>
                    </div>
                    <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} className="shrink-0" />
                  </div>

                  {aiEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground font-medium">Daily Limit</Label>
                        <Input
                          className="h-9 text-xs"
                          type="number"
                          placeholder="Unlimited"
                          value={aiDaily}
                          onChange={(e) => setAiDaily(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground font-medium">Monthly Limit</Label>
                        <Input
                          className="h-9 text-xs"
                          type="number"
                          placeholder="Unlimited"
                          value={aiMonthly}
                          onChange={(e) => setAiMonthly(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground font-medium">Lifetime Limit</Label>
                        <Input
                          className="h-9 text-xs"
                          type="number"
                          placeholder="Unlimited"
                          value={aiLifetime}
                          onChange={(e) => setAiLifetime(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Requirements Module */}
                <div className="p-3.5 sm:p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-semibold block truncate">Stock Requirements Module</span>
                        <p className="text-[11px] text-muted-foreground truncate">Fulfillment workflow between shops and warehouse.</p>
                      </div>
                    </div>
                    <Switch checked={reqEnabled} onCheckedChange={setReqEnabled} className="shrink-0" />
                  </div>

                  {reqEnabled && (
                    <div className="pt-2 border-t space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground font-medium">Max Requirements / Month (Blank = Unlimited)</Label>
                      <Input
                        className="h-9 text-xs w-full sm:w-56"
                        type="number"
                        placeholder="Unlimited"
                        value={maxReqMonthly}
                        onChange={(e) => setMaxReqMonthly(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>

                {/* Custom Fields */}
                <div className="p-3.5 sm:p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-semibold block truncate">Dynamic Custom Fields</span>
                        <p className="text-[11px] text-muted-foreground truncate">Create unlimited dropdowns, text, phone and number fields.</p>
                      </div>
                    </div>
                    <Switch checked={customFieldsEnabled} onCheckedChange={setCustomFieldsEnabled} className="shrink-0" />
                  </div>

                  {customFieldsEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground font-medium">Max Custom Fields</Label>
                        <Input
                          className="h-9 text-xs"
                          type="number"
                          value={maxCustomFields}
                          onChange={(e) => setMaxCustomFields(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground font-medium">Max Options per Field</Label>
                        <Input
                          className="h-9 text-xs"
                          type="number"
                          value={maxOptionsPerField}
                          onChange={(e) => setMaxOptionsPerField(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Brand Theme */}
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-primary" /> Workspace Brand Theme
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.values(THEME_PALETTES).map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => setThemeColor(pal.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition-all ${
                          themeColor === pal.id
                            ? 'border-primary ring-2 ring-primary/20 bg-primary/10 font-bold shadow-sm'
                            : 'border-border/60 hover:bg-muted/40'
                        }`}
                      >
                        <span
                          className="h-4 w-4 rounded-full shrink-0 shadow-sm border border-black/10"
                          style={{ backgroundColor: pal.hex }}
                        />
                        <span className="truncate">{pal.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sticky Dedicated Footer (Never clipped on mobile!) */}
          <div className="p-3.5 sm:p-4 border-t border-border/60 bg-card/95 backdrop-blur-md shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="h-10 sm:h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 sm:h-9 gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-500/20 font-semibold"
            >
              {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
              Create Tenant Workspace
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
