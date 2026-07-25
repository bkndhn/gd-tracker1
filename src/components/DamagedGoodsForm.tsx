import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCachedData } from '@/hooks/useCachedData';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { WhatsAppInputBar } from '@/components/WhatsAppInputBar';
import { toast } from 'sonner';
import { sanitizeNotes } from '@/utils/security';

interface CustomField {
  id: string;
  name: string;
  is_visible: boolean;
  is_mandatory: boolean;
  display_order: number;
  field_type?: string;
  is_standard?: boolean;
  standard_key?: string | null;
}

interface CustomFieldOption {
  id: string;
  custom_field_id: string;
  value: string;
  legacy_id?: string | null;
  legacy_table?: string | null;
}

export const DamagedGoodsForm = () => {
  const { profile } = useAuth();
  const { shops, loading: dataLoading } = useCachedData();
  const { isOnline, pendingCount, saveOfflineEntry } = useOfflineSync();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [userShop, setUserShop] = useState<any>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldOptions, setCustomFieldOptions] = useState<Record<string, CustomFieldOption[]>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [voiceNoteFile, setVoiceNoteFile] = useState<File | null>(null);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [maxImagesPerEntry, setMaxImagesPerEntry] = useState(10);
  const [maxImagesTotal, setMaxImagesTotal] = useState<number | null>(null);
  const [currentImageCount, setCurrentImageCount] = useState(0);
  const [maxEntries, setMaxEntries] = useState<number | null>(null);
  const [currentEntryCount, setCurrentEntryCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [formKey, setFormKey] = useState(0);
  const [shopFallbackId, setShopFallbackId] = useState<string>('none');

  const adminId = (profile as any)?.admin_id || profile?.id;

  const fetchSettings = useCallback(async () => {
    if (!adminId) return;
    try {
      const waRes = await supabase
        .from('app_settings').select('value')
        .eq('key', 'whatsapp_redirect_enabled').eq('admin_id', adminId).maybeSingle();
      if (waRes.data) {
        const val = waRes.data.value as { enabled?: boolean };
        setWhatsappEnabled(val.enabled ?? false);
      }

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('max_entries, max_images_per_entry, max_images_total')
        .eq('id', adminId)
        .single();
      if (adminProfile) {
        setMaxEntries((adminProfile as any).max_entries ?? null);
        setMaxImagesPerEntry((adminProfile as any).max_images_per_entry ?? 10);
        setMaxImagesTotal((adminProfile as any).max_images_total ?? null);
      }

      const [entryCountRes, imageCountRes] = await Promise.all([
        supabase.from('goods_damaged_entries').select('id', { count: 'exact', head: true }).eq('admin_id', adminId),
        supabase.from('gd_entry_images').select('id', { count: 'exact', head: true }),
      ]);
      setCurrentEntryCount(entryCountRes.count || 0);
      setCurrentImageCount(imageCountRes.count || 0);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching settings:', error);
    }
  }, [adminId]);

  useEffect(() => {
    const fetchFormData = async () => {
      const cfRes = await (supabase.from('custom_fields') as any)
        .select('*').is('deleted_at', null).eq('is_visible', true).order('display_order');
      if (cfRes.data && cfRes.data.length > 0) {
        setCustomFields(cfRes.data);
        const fieldIds = cfRes.data.map((f: CustomField) => f.id);
        const { data: optData } = await (supabase.from('custom_field_options') as any)
          .select('*').in('custom_field_id', fieldIds).is('deleted_at', null).order('display_order');
        if (optData) {
          const grouped: Record<string, CustomFieldOption[]> = {};
          optData.forEach((opt: CustomFieldOption) => {
            if (!grouped[opt.custom_field_id]) grouped[opt.custom_field_id] = [];
            grouped[opt.custom_field_id].push(opt);
          });
          setCustomFieldOptions(grouped);
        }
      }
    };
    fetchFormData();
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (profile?.shop_id && shops.length > 0) {
      const shop = shops.find(s => s.id === profile.shop_id);
      if (shop) setUserShop(shop);
    }
  }, [profile, shops]);

  useEffect(() => {
    const notesInput = document.querySelector('textarea#notes') as HTMLTextAreaElement;
    if (notesInput && !dataLoading) setTimeout(() => notesInput.focus(), 100);
  }, [dataLoading]);

  const uploadImages = async (entryId: string) => {
    if (selectedImages.length === 0) return;
    const tenantPrefix = adminId || profile?.id;
    await Promise.all(selectedImages.map(async (file, index) => {
      const fileName = `${tenantPrefix}/${entryId}/${Date.now()}-${index}-${file.name}`;
      const { data, error } = await supabase.storage.from('gd-entry-images').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: signedData } = await supabase.storage.from('gd-entry-images').createSignedUrl(data.path, 3600);
      const imageUrl = signedData?.signedUrl || data.path;
      const { error: dbError } = await supabase.from('gd_entry_images').insert({
        gd_entry_id: entryId, image_url: imageUrl, image_name: file.name, file_size: file.size,
      });
      if (dbError) throw dbError;
    }));
  };

  const uploadVoiceNote = async (entryId: string): Promise<string | null> => {
    if (!voiceNoteFile) return null;
    const tenantPrefix = adminId || profile?.id;
    const fileName = `${tenantPrefix}/${entryId}/${Date.now()}-${voiceNoteFile.name}`;
    const { data, error } = await supabase.storage.from('gd-voice-notes').upload(fileName, voiceNoteFile, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: signedData } = await supabase.storage.from('gd-voice-notes').createSignedUrl(data.path, 3600);
    return signedData?.signedUrl || data.path;
  };

  const buildWhatsAppMessage = () => {
    let msg = `📋 *GD Report*\n`;
    msg += `👤 ${profile?.name || ''}\n`;
    const shopName = userShop?.name || shops.find(s => s.id === profile?.shop_id)?.name || '';
    if (shopName) msg += `🏪 ${shopName}\n`;
    customFields.forEach(field => {
      const val = customFieldValues[field.id];
      if (!val) return;
      const type = field.field_type || 'dropdown';
      if (type === 'dropdown' || type === 'radio') {
        const opts = customFieldOptions[field.id] || [];
        const opt = opts.find(o => o.id === val);
        if (opt) msg += `🏷️ ${field.name}: ${opt.value}\n`;
      } else {
        msg += `🏷️ ${field.name}: ${val}\n`;
      }
    });
    if (notes.trim()) msg += `📝 ${notes.trim()}\n`;
    msg += `📅 ${new Date().toLocaleDateString()}`;
    return encodeURIComponent(msg);
  };

  // Resolve a standard field selection back to its legacy UUID (for backward-compat columns)
  const resolveLegacyId = (standardKey: string): string | null => {
    const field = customFields.find(f => f.is_standard && f.standard_key === standardKey);
    if (!field) return null;
    const selected = customFieldValues[field.id];
    if (!selected) return null;
    const opt = (customFieldOptions[field.id] || []).find(o => o.id === selected);
    return opt?.legacy_id || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!notes.trim() && !voiceNoteFile) {
      toast.error('Please provide either notes or a voice note');
      return;
    }

    const missing = customFields.filter(f => f.is_mandatory && !customFieldValues[f.id]).map(f => f.name);
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(', ')}`);
      return;
    }

    const effectiveShopId = profile.shop_id || resolveLegacyId('shop') || (shopFallbackId !== 'none' ? shopFallbackId : null);
    if (!effectiveShopId) {
      toast.error('Please select a shop');
      return;
    }

    if (maxEntries !== null && currentEntryCount >= maxEntries) {
      toast.error(`Entry limit reached (${maxEntries}).`);
      return;
    }
    if (selectedImages.length > maxImagesPerEntry) {
      toast.error(`Maximum ${maxImagesPerEntry} images per entry allowed.`);
      return;
    }
    if (maxImagesTotal !== null && (currentImageCount + selectedImages.length) > maxImagesTotal) {
      toast.error(`Total image limit reached (${maxImagesTotal}).`);
      return;
    }

    setLoading(true);
    const sanitizedNotes = sanitizeNotes(notes.trim(), 1000);

    // Custom fields are the single source of truth; only shop_id stays on the
    // entry row because branch-level RLS depends on it.
    const entryData: any = {
      shop_id: effectiveShopId,
      employee_id: profile.id,
      employee_name: profile.name,
      notes: sanitizedNotes || 'Voice note attached',
      admin_id: adminId,
    };


    try {
      if (!isOnline) {
        const saved = await saveOfflineEntry(entryData, selectedImages);
        if (saved) resetForm();
        return;
      }

      const { data: createdEntry, error: entryError } = await supabase
        .from('goods_damaged_entries').insert(entryData).select().single();
      if (entryError) throw entryError;

      let voiceNoteUrl: string | null = null;
      if (voiceNoteFile) {
        voiceNoteUrl = await uploadVoiceNote(createdEntry.id);
        if (voiceNoteUrl) {
          await supabase.from('goods_damaged_entries').update({ voice_note_url: voiceNoteUrl }).eq('id', createdEntry.id);
        }
      }
      if (selectedImages.length > 0) await uploadImages(createdEntry.id);

      const customValueInserts = Object.entries(customFieldValues)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([fieldId, v]) => {
          const field = customFields.find(f => f.id === fieldId);
          const type = field?.field_type || 'dropdown';
          if (type === 'dropdown' || type === 'radio') {
            return { gd_entry_id: createdEntry.id, custom_field_id: fieldId, custom_field_option_id: v };
          }
          return { gd_entry_id: createdEntry.id, custom_field_id: fieldId, value: v };
        });

      if (customValueInserts.length > 0) {
        const { error: cvError } = await (supabase.from('gd_entry_custom_values') as any).insert(customValueInserts);
        if (cvError && import.meta.env.DEV) console.error('Error saving custom field values:', cvError);
      }

      const successParts = [];
      if (selectedImages.length > 0) successParts.push(`${selectedImages.length} image(s)`);
      if (voiceNoteUrl) successParts.push('voice note');
      toast.success(successParts.length > 0
        ? `GD entry created with ${successParts.join(' and ')}!`
        : 'GD entry created successfully!'
      );

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'NEW_GD_ENTRY',
          title: 'New GD Entry',
          body: `${profile.name} reported GD in ${userShop?.name || 'a shop'}`,
          url: '/'
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['dashboard-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['reports-data'] });

      if (whatsappEnabled) {
        const msg = buildWhatsAppMessage();
        setTimeout(() => window.open(`https://wa.me/?text=${msg}`, '_blank'), 800);
      }

      setCurrentEntryCount(prev => prev + 1);
      resetForm();
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error creating entry:', error);
      toast.error(error.message || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNotes('');
    setSelectedImages([]);
    setVoiceNoteFile(null);
    setCustomFieldValues({});
    setShopFallbackId('none');
    setFormKey(k => k + 1);
    document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(el => { try { el.value = ''; } catch {} });
    setTimeout(() => {
      const notesInput = document.querySelector('textarea#notes') as HTMLTextAreaElement;
      if (notesInput) notesInput.focus();
    }, 100);
  };

  if (dataLoading) {
    return <div className="flex justify-center items-center h-64">Loading form data...</div>;
  }

  const entryLimitReached = maxEntries !== null && currentEntryCount >= maxEntries;
  const hasShopField = customFields.some(f => f.is_standard && f.standard_key === 'shop');

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Report GD</span>
          <div className="flex items-center gap-2 text-sm font-normal">
            {entryLimitReached && <span className="text-destructive">Entry limit reached</span>}
            {maxEntries !== null && !entryLimitReached && (
              <span className="text-muted-foreground">{currentEntryCount}/{maxEntries}</span>
            )}
            {!isOnline && (
              <span className="text-orange-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>Offline
              </span>
            )}
            {pendingCount > 0 && <span className="text-blue-500">{pendingCount} pending</span>}
          </div>
        </CardTitle>
        <CardDescription>Fill out this form to report GD in your store</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {profile?.shop_id ? (
            <div className="space-y-2">
              <Label>Shop</Label>
              <Input value={userShop?.name || 'Loading shop...'} disabled className="bg-muted cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">Shop is automatically assigned based on your profile</p>
            </div>
          ) : !hasShopField ? (
            <div className="space-y-2">
              <Label>Shop *</Label>
              <Select value={shopFallbackId} onValueChange={setShopFallbackId}>
                <SelectTrigger><SelectValue placeholder="Select a shop" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a shop</SelectItem>
                  {shops.map(shop => (
                    <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {customFields.map((field) => {
            const type = field.field_type || 'dropdown';
            const fieldOptions = customFieldOptions[field.id] || [];
            const value = customFieldValues[field.id] || '';
            const setValue = (v: string) => setCustomFieldValues(prev => ({ ...prev, [field.id]: v }));
            if ((type === 'dropdown' || type === 'radio') && fieldOptions.length === 0) return null;
            return (
              <div key={field.id} className="space-y-2">
                <Label>{field.name} {field.is_mandatory && '*'}</Label>
                {type === 'dropdown' && (
                  <Select value={value} onValueChange={setValue}>
                    <SelectTrigger><SelectValue placeholder={`Select ${field.name.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {type === 'radio' && (
                  <RadioGroup value={value} onValueChange={setValue} className="flex flex-wrap gap-3">
                    {fieldOptions.map((opt) => (
                      <div key={opt.id} className="flex items-center space-x-2 border rounded-md px-3 py-2 hover:bg-accent">
                        <RadioGroupItem value={opt.id} id={`cf-${field.id}-${opt.id}`} />
                        <Label htmlFor={`cf-${field.id}-${opt.id}`} className="font-normal cursor-pointer">{opt.value}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
                {type === 'textarea' && (
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={value} onChange={(e) => setValue(e.target.value)}
                    placeholder={`Enter ${field.name.toLowerCase()}`}
                  />
                )}
                {type !== 'dropdown' && type !== 'radio' && type !== 'textarea' && (
                  <input
                    type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text'}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={value} onChange={(e) => setValue(e.target.value)}
                    placeholder={`Enter ${field.name.toLowerCase()}`}
                  />
                )}
              </div>
            );
          })}

          <div className="space-y-2">
            <Label>Notes / Voice / Images {!voiceNoteFile && !notes.trim() && '*'}</Label>
            <WhatsAppInputBar
              key={formKey}
              notes={notes}
              onNotesChange={setNotes}
              onImagesChange={setSelectedImages}
              onVoiceNoteChange={setVoiceNoteFile}
              voiceNoteFile={voiceNoteFile}
              maxImages={maxImagesPerEntry}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || entryLimitReached}>
            {loading ? 'Submitting...' : entryLimitReached ? 'Entry Limit Reached' : 'Submit Report'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
