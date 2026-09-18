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
  Building2,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {createdCredentials ? 'Tenant Workspace Created' : 'Create New Tenant'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {createdCredentials
                  ? 'The tenant workspace is live. Provide these credentials to the tenant administrator.'
                  : 'Provision an isolated tenant with custom limits, permissions, theme and temporary password.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {createdCredentials ? (
          <div className="space-y-6 pt-2">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Tenant Workspace Ready for Login</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-background/80 rounded-xl p-4 border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Workspace Name</span>
                  <span className="font-semibold text-foreground text-sm">{createdCredentials.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Admin Login Email</span>
                  <span className="font-semibold text-foreground text-sm font-mono">{createdCredentials.email}</span>
                </div>
                <div className="sm:col-span-2 pt-2 border-t">
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
                <p>
                  <strong>First-Time Login Policy:</strong> The tenant administrator is required to set a permanent, secure password immediately upon their first login before they can access their dashboard.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="default"
                className="flex-1 gap-2"
                onClick={handleCopyCredentials}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy Full Credentials & Login URL
              </Button>
              <Button
                variant="outline"
                className="sm:w-32"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            <Tabs defaultValue="basics" className="w-full">
              <TabsList className="grid grid-cols-3 w-full mb-4">
                <TabsTrigger value="basics" className="text-xs">Account & Auth</TabsTrigger>
                <TabsTrigger value="limits" className="text-xs">Resource Limits</TabsTrigger>
                <TabsTrigger value="features" className="text-xs">Features & Theme</TabsTrigger>
              </TabsList>

              {/* Tab 1: Basics & Temporary Credentials */}
              <TabsContent value="basics" className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tenant-name" className="text-xs font-semibold">
                    Tenant Workspace / Brand Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="tenant-name"
                    placeholder="e.g. Metro Fashion Brands"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenant-email" className="text-xs font-semibold">
                    Administrator Email Address <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="tenant-email"
                    type="email"
                    placeholder="admin@tenantbrand.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temp-password" className="text-xs font-semibold flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      Temporary Password <span className="text-rose-500">*</span>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRegeneratePassword}
                      className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="h-3 w-3" /> Regenerate
                    </Button>
                  </div>
                  <Input
                    id="temp-password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="font-mono text-sm tracking-wide"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    A strong auto-generated password. You will receive a copy to share with the tenant.
                  </p>
                </div>

                <Card className="border-border/60 bg-muted/30">
                  <CardContent className="p-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">Mandatory First Login Password Change</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/40 text-primary">Required</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Forces the tenant admin to change their temporary password immediately after first sign-in.
                      </p>
                    </div>
                    <Switch
                      checked={mustChangePassword}
                      onCheckedChange={setMustChangePassword}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Resource Limits */}
              <TabsContent value="limits" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="max-shops" className="text-xs font-semibold flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-indigo-500" /> Max Shops Quota
                    </Label>
                    <Input
                      id="max-shops"
                      type="number"
                      min={1}
                      value={maxShops}
                      onChange={(e) => setMaxShops(Number(e.target.value) || 1)}
                    />
                    <p className="text-[11px] text-muted-foreground">Maximum physical branches/stores allowed.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="max-users" className="text-xs font-semibold flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-sky-500" /> Max Users / Staff
                    </Label>
                    <Input
                      id="max-users"
                      type="number"
                      min={1}
                      value={maxUsers}
                      onChange={(e) => setMaxUsers(Number(e.target.value) || 1)}
                    />
                    <p className="text-[11px] text-muted-foreground">Maximum staff accounts that can be created.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="max-warehouse" className="text-xs font-semibold">
                      Max Warehouse Staff
                    </Label>
                    <Input
                      id="max-warehouse"
                      type="number"
                      min={0}
                      placeholder="e.g. 3"
                      value={maxWarehouseUsers}
                      onChange={(e) => setMaxWarehouseUsers(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="max-entries" className="text-xs font-semibold">
                      Max Visits / Entries (Blank = Unlimited)
                    </Label>
                    <Input
                      id="max-entries"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={maxEntries}
                      onChange={(e) => setMaxEntries(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="max-img-entry" className="text-xs font-semibold">
                      Max Images Per Entry
                    </Label>
                    <Input
                      id="max-img-entry"
                      type="number"
                      min={1}
                      max={30}
                      value={maxImagesPerEntry}
                      onChange={(e) => setMaxImagesPerEntry(Number(e.target.value) || 10)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="max-img-total" className="text-xs font-semibold">
                      Max Total Images (Blank = Unlimited)
                    </Label>
                    <Input
                      id="max-img-total"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={maxImagesTotal}
                      onChange={(e) => setMaxImagesTotal(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Features & Theme */}
              <TabsContent value="features" className="space-y-4">
                {/* AI Features */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <div>
                        <span className="text-xs font-semibold">AI Insights & Voice Transcription</span>
                        <p className="text-[11px] text-muted-foreground">Voice note transcription and smart anomaly reports.</p>
                      </div>
                    </div>
                    <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                  </div>

                  {aiEnabled && (
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t text-xs">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Daily Limit</Label>
                        <Input
                          className="h-8 text-xs mt-1"
                          type="number"
                          placeholder="None"
                          value={aiDaily}
                          onChange={(e) => setAiDaily(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Monthly Limit</Label>
                        <Input
                          className="h-8 text-xs mt-1"
                          type="number"
                          placeholder="None"
                          value={aiMonthly}
                          onChange={(e) => setAiMonthly(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Lifetime</Label>
                        <Input
                          className="h-8 text-xs mt-1"
                          type="number"
                          placeholder="None"
                          value={aiLifetime}
                          onChange={(e) => setAiLifetime(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Requirements Module */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-amber-500" />
                      <div>
                        <span className="text-xs font-semibold">Stock Requirements Module</span>
                        <p className="text-[11px] text-muted-foreground">Fulfillment workflow between shops and warehouse.</p>
                      </div>
                    </div>
                    <Switch checked={reqEnabled} onCheckedChange={setReqEnabled} />
                  </div>

                  {reqEnabled && (
                    <div className="pt-1 border-t">
                      <Label className="text-[11px] text-muted-foreground">Max Requirements / Month (Blank = Unlimited)</Label>
                      <Input
                        className="h-8 text-xs mt-1 w-48"
                        type="number"
                        placeholder="Unlimited"
                        value={maxReqMonthly}
                        onChange={(e) => setMaxReqMonthly(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>

                {/* Custom Fields */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-teal-500" />
                      <div>
                        <span className="text-xs font-semibold">Dynamic Custom Fields</span>
                        <p className="text-[11px] text-muted-foreground">Create unlimited dropdowns, text, phone and number fields.</p>
                      </div>
                    </div>
                    <Switch checked={customFieldsEnabled} onCheckedChange={setCustomFieldsEnabled} />
                  </div>

                  {customFieldsEnabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t text-xs">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Max Custom Fields</Label>
                        <Input
                          className="h-8 text-xs mt-1"
                          type="number"
                          value={maxCustomFields}
                          onChange={(e) => setMaxCustomFields(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Max Options per Field</Label>
                        <Input
                          className="h-8 text-xs mt-1"
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
                    <Palette className="h-3.5 w-3.5 text-primary" /> Initial Workspace Brand Theme
                  </Label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.values(THEME_PALETTES).map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => setThemeColor(pal.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                          themeColor === pal.id
                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5 font-semibold'
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

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
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
