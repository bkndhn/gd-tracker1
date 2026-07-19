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
import { Database } from '@/types/database';
import { sanitizeNotes, isValidUUID } from '@/utils/security';
import { useFieldLabels } from '@/hooks/useFieldLabels';

type CustomerType = Database['public']['Tables']['customer_types']['Row'];

interface CustomField {
  id: string;
  name: string;
  is_visible: boolean;
  is_mandatory: boolean;
  display_order: number;
  field_type?: string;
}

interface CustomFieldOption {
  id: string;
  custom_field_id: string;
  value: string;
}

interface FieldVisibility {
  category: boolean;
  size: boolean;
  customer_type: boolean;
  shops: boolean;
}

export const DamagedGoodsForm = () => {
  const { profile } = useAuth();
  const { labels } = useFieldLabels();
  const { categories, sizes, shops, loading: dataLoading } = useCachedData();
  const { isOnline, pendingCount, saveOfflineEntry } = useOfflineSync();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(false);
  const [userShop, setUserShop] = useState<any>(null);
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldOptions, setCustomFieldOptions] = useState<Record<string, CustomFieldOption[]>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [voiceNoteFile, setVoiceNoteFile] = useState<File | null>(null);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [fieldVisibility, setFieldVisibility] = useState<FieldVisibility>({ category: true, size: true, customer_type: true, shops: true });
  const [maxImagesPerEntry, setMaxImagesPerEntry] = useState(10);
  const [maxImagesTotal, setMaxImagesTotal] = useState<number | null>(null);
  const [currentImageCount, setCurrentImageCount] = useState(0);
  const [maxEntries, setMaxEntries] = useState<number | null>(null);
  const [currentEntryCount, setCurrentEntryCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [formKey, setFormKey] = useState(0);
  
  const [formData, setFormData] = useState({
    category_id: 'none',
    size_id: 'none',
    shop_id: profile?.shop_id || 'none',
    customer_type_id: ''
  });

  const adminId = (profile as any)?.admin_id || profile?.id;

  // Fetch settings and limits
  const fetchSettings = useCallback(async () => {
    if (!adminId) return;
    try {
      const [waRes, fvRes] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', 'whatsapp_redirect_enabled').eq('admin_id', adminId).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'field_visibility').eq('admin_id', adminId).maybeSingle(),
      ]);
      
      if (waRes.data) {
        const val = waRes.data.value as { enabled?: boolean };
        setWhatsappEnabled(val.enabled ?? false);
      }
      if (fvRes.data) {
        const val = fvRes.data.value as Record<string, boolean>;
        setFieldVisibility({
          category: val.category ?? true,
          size: val.size ?? true,
          customer_type: val.customer_type ?? true,
          shops: val.shops ?? true,
        });
      }

      // Fetch admin's limits
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

      // Count current entries and images
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
      const [ctRes, cfRes] = await Promise.all([
        supabase.from('customer_types').select('*').is('deleted_at', null).order('name'),
        (supabase.from('custom_fields') as any).select('*').is('deleted_at', null).eq('is_visible', true).order('display_order'),
      ]);
      if (ctRes.data) setCustomerTypes(ctRes.data);
      if (cfRes.data && cfRes.data.length > 0) {
        setCustomFields(cfRes.data);
        const fieldIds = cfRes.data.map((f: CustomField) => f.id);
        const { data: optData } = await (supabase.from('custom_field_options') as any)
          .select('*')
          .in('custom_field_id', fieldIds)
          .is('deleted_at', null)
          .order('display_order');
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
    if (profile?.shop_id) {
      setFormData(prev => ({
        ...prev,
        shop_id: profile.shop_id || 'none',
        category_id: prev.category_id !== 'none' ? prev.category_id : (profile as any).default_category_id || 'none',
        size_id: prev.size_id !== 'none' ? prev.size_id : (profile as any).default_size_id || 'none'
      }));
      if (shops.length > 0) {
        const shop = shops.find(s => s.id === profile.shop_id);
        if (shop) setUserShop(shop);
      }
    }
  }, [profile, shops]);

  useEffect(() => {
    const notesInput = document.querySelector('textarea#notes') as HTMLTextAreaElement;
    if (notesInput && !dataLoading) {
      setTimeout(() => notesInput.focus(), 100);
    }
  }, [dataLoading]);

  const uploadImages = async (entryId: string) => {
    if (selectedImages.length === 0) return;
    const tenantPrefix = adminId || profile?.id;
    const uploadPromises = selectedImages.map(async (file, index) => {
      // Path MUST start with admin_id so storage RLS (tenant-folder check) passes for everyone.
      const fileName = `${tenantPrefix}/${entryId}/${Date.now()}-${index}-${file.name}`;
      const { data, error } = await supabase.storage.from('gd-entry-images').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
      if (error) throw error;
      const { data: signedData } = await supabase.storage.from('gd-entry-images').createSignedUrl(data.path, 3600);
      const imageUrl = signedData?.signedUrl || data.path;
      const { error: dbError } = await supabase.from('gd_entry_images').insert({
        gd_entry_id: entryId,
        image_url: imageUrl,
        image_name: file.name,
        file_size: file.size
      });
      if (dbError) throw dbError;
      return imageUrl;
    });
    await Promise.all(uploadPromises);
  };

  const uploadVoiceNote = async (entryId: string): Promise<string | null> => {
    if (!voiceNoteFile) return null;
    const tenantPrefix = adminId || profile?.id;
    const fileName = `${tenantPrefix}/${entryId}/${Date.now()}-${voiceNoteFile.name}`;
    const { data, error } = await supabase.storage
      .from('gd-voice-notes')
      .upload(fileName, voiceNoteFile, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: signedData } = await supabase.storage.from('gd-voice-notes').createSignedUrl(data.path, 3600);
    return signedData?.signedUrl || data.path;
  };

  const buildWhatsAppMessage = () => {
    const categoryName = categories.find(c => c.id === formData.category_id)?.name || '';
    const sizeName = sizes.find(s => s.id === formData.size_id)?.size || '';
    const shopName = userShop?.name || shops.find(s => s.id === formData.shop_id)?.name || '';
    const ctName = customerTypes.find(ct => ct.id === formData.customer_type_id)?.name || '';
    
    let msg = `📋 *GD Report*\n`;
    msg += `👤 ${profile?.name || ''}\n`;
    if (shopName) msg += `🏪 Shop: ${shopName}\n`;
    if (categoryName && fieldVisibility.category) msg += `📦 Category: ${categoryName}\n`;
    if (sizeName && fieldVisibility.size) msg += `📏 Size: ${sizeName}\n`;
    if (ctName && fieldVisibility.customer_type) msg += `👥 Customer: ${ctName}\n`;
    
    // Custom field values
    customFields.forEach(field => {
      const val = customFieldValues[field.id];
      if (!val) return;
      const type = field.field_type || 'dropdown';
      if (type === 'dropdown') {
        const opts = customFieldOptions[field.id] || [];
        const opt = opts.find(o => o.id === val);
        if (opt) msg += `🏷️ ${field.name}: ${opt.value}\n`;
      } else {
        msg += `🏷️ ${field.name}: ${val}\n`;
      }
    });
    
    if (notes.trim()) msg += `📝 Notes: ${notes.trim()}\n`;
    msg += `📅 ${new Date().toLocaleDateString()}`;
    
    return encodeURIComponent(msg);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const hasNotes = notes.trim().length > 0;
    const hasVoiceNote = voiceNoteFile !== null;

    // Validate visible required fields
    const missingFields: string[] = [];
    if (fieldVisibility.category && formData.category_id === 'none') missingFields.push('Category');
    if (fieldVisibility.size && formData.size_id === 'none') missingFields.push('Size');
    if (fieldVisibility.shops && formData.shop_id === 'none') missingFields.push('Shop');
    if (!fieldVisibility.shops && !profile.shop_id) missingFields.push('Shop (not assigned)');
    if (fieldVisibility.customer_type && !formData.customer_type_id) missingFields.push('Customer Type');

    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    // Validate mandatory custom fields
    const missingCustomFields = customFields
      .filter(f => f.is_mandatory && !customFieldValues[f.id])
      .map(f => f.name);
    if (missingCustomFields.length > 0) {
      toast.error(`Please fill in: ${missingCustomFields.join(', ')}`);
      return;
    }

    // Validate UUIDs
    const uuidsToCheck = [formData.shop_id];
    if (fieldVisibility.category && formData.category_id !== 'none') uuidsToCheck.push(formData.category_id);
    if (fieldVisibility.size && formData.size_id !== 'none') uuidsToCheck.push(formData.size_id);
    if (formData.customer_type_id) uuidsToCheck.push(formData.customer_type_id);
    
    if (uuidsToCheck.some(id => !isValidUUID(id))) {
      toast.error('Invalid form data. Please refresh and try again.');
      return;
    }

    if (!hasNotes && !hasVoiceNote) {
      toast.error('Please provide either Notes or Voice Note');
      return;
    }

    // Check entry limit
    if (maxEntries !== null && currentEntryCount >= maxEntries) {
      toast.error(`Entry limit reached (${maxEntries}). Contact your administrator to increase the limit.`);
      return;
    }

    // Check image limit per entry
    if (selectedImages.length > maxImagesPerEntry) {
      toast.error(`Maximum ${maxImagesPerEntry} images per entry allowed.`);
      return;
    }

    // Check total image limit for tenant
    if (maxImagesTotal !== null && (currentImageCount + selectedImages.length) > maxImagesTotal) {
      toast.error(`Total image limit reached (${maxImagesTotal}). Contact your administrator.`);
      return;
    }

    setLoading(true);

    const sanitizedNotes = sanitizeNotes(notes.trim(), 1000);

    const entryData: any = {
      shop_id: formData.shop_id,
      employee_id: profile.id,
      employee_name: profile.name,
      notes: sanitizedNotes || 'Voice note attached',
      admin_id: adminId,
    };
    
    // Only include visible fields
    if (fieldVisibility.category && formData.category_id !== 'none') {
      entryData.category_id = formData.category_id;
    } else {
      entryData.category_id = categories.length > 0 ? categories[0].id : formData.category_id;
    }
    if (fieldVisibility.size && formData.size_id !== 'none') {
      entryData.size_id = formData.size_id;
    } else {
      entryData.size_id = sizes.length > 0 ? sizes[0].id : formData.size_id;
    }
    if (fieldVisibility.customer_type && formData.customer_type_id) {
      entryData.customer_type_id = formData.customer_type_id;
    }

    try {
      if (!isOnline) {
        const saved = await saveOfflineEntry(entryData, selectedImages);
        if (saved) {
          resetForm();
        }
        return;
      }

      const { data: createdEntry, error: entryError } = await supabase
        .from('goods_damaged_entries')
        .insert(entryData)
        .select()
        .single();

      if (entryError) throw entryError;

      let voiceNoteUrl: string | null = null;
      if (voiceNoteFile) {
        voiceNoteUrl = await uploadVoiceNote(createdEntry.id);
        if (voiceNoteUrl) {
          await supabase.from('goods_damaged_entries').update({ voice_note_url: voiceNoteUrl }).eq('id', createdEntry.id);
        }
      }

      if (selectedImages.length > 0) {
        await uploadImages(createdEntry.id);
      }

      // Save custom field values (dropdown -> option_id, others -> value text)
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

      // WhatsApp deep share
      if (whatsappEnabled) {
        const msg = buildWhatsAppMessage();
        const whatsappUrl = `https://wa.me/?text=${msg}`;
        toast.success('Opening WhatsApp to share...');
        setTimeout(() => window.open(whatsappUrl, '_blank'), 800);
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
    setFormData({
      category_id: 'none',
      size_id: 'none',
      shop_id: profile?.shop_id || 'none',
      customer_type_id: ''
    });
    setNotes('');
    setSelectedImages([]);
    setVoiceNoteFile(null);
    setCustomFieldValues({});
    setFormKey(k => k + 1);
    // Clear any cached file inputs so the next entry starts fresh
    document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(el => {
      try { el.value = ''; } catch {}
    });
    setTimeout(() => {
      const notesInput = document.querySelector('textarea#notes') as HTMLTextAreaElement;
      if (notesInput) notesInput.focus();
    }, 100);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  if (dataLoading) {
    return <div className="flex justify-center items-center h-64">Loading form data...</div>;
  }

  const entryLimitReached = maxEntries !== null && currentEntryCount >= maxEntries;

  // Determine effective shop - either from form (if shops visible) or profile assignment
  const effectiveShopId = fieldVisibility.shops ? formData.shop_id : (profile?.shop_id || 'none');

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Report GD</span>
          <div className="flex items-center gap-2 text-sm font-normal">
            {entryLimitReached && (
              <span className="text-destructive flex items-center gap-1">
                Entry limit reached
              </span>
            )}
            {maxEntries !== null && !entryLimitReached && (
              <span className="text-muted-foreground">
                {currentEntryCount}/{maxEntries}
              </span>
            )}
            {!isOnline && (
              <span className="text-orange-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                Offline Mode
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-blue-500">{pendingCount} pending</span>
            )}
          </div>
        </CardTitle>
        <CardDescription>Fill out this form to report GD in your store</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fieldVisibility.category && (
              <div className="space-y-2">
                <Label htmlFor="category">{labels.category} *</Label>
                <Select value={formData.category_id} onValueChange={value => handleInputChange('category_id', value)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a category</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {fieldVisibility.size && (
              <div className="space-y-2">
                <Label htmlFor="size">{labels.size} *</Label>
                <Select value={formData.size_id} onValueChange={value => handleInputChange('size_id', value)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a size</SelectItem>
                    {sizes.map(size => (
                      <SelectItem key={size.id} value={size.id}>{size.size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Shop field - visible or auto-assigned */}
          {fieldVisibility.shops ? (
            <div className="space-y-2">
              <Label htmlFor="shop">{labels.shops} *</Label>
              {profile?.shop_id ? (
                <>
                  <Input value={userShop?.name || 'Loading shop...'} disabled className="bg-muted cursor-not-allowed" />
                  <p className="text-sm text-muted-foreground">Shop is automatically assigned based on your profile</p>
                </>
              ) : (
                <Select value={formData.shop_id} onValueChange={value => handleInputChange('shop_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a shop" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a shop</SelectItem>
                    {shops.map(shop => (
                      <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{labels.shops}</Label>
              <Input value={userShop?.name || (profile?.shop_id ? 'Loading...' : 'Auto-assigned')} disabled className="bg-muted cursor-not-allowed" />
            </div>
          )}

          {fieldVisibility.customer_type && (
            <div className="space-y-3">
              <Label>{labels.customer_type} *</Label>
              <RadioGroup value={formData.customer_type_id} onValueChange={value => handleInputChange('customer_type_id', value)} required>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customerTypes.map(type => (
                    <div key={type.id} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-accent cursor-pointer">
                      <RadioGroupItem value={type.id} id={type.id} />
                      <Label htmlFor={type.id} className="cursor-pointer flex-1">{type.name}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              {customerTypes.length === 0 && <p className="text-sm text-muted-foreground">No customer types available. Please contact admin.</p>}
            </div>
          )}

          {/* Custom Fields */}
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
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
                    </SelectTrigger>
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
                      <div key={opt.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.id} id={`cf-${field.id}-${opt.id}`} />
                        <Label htmlFor={`cf-${field.id}-${opt.id}`} className="font-normal cursor-pointer">{opt.value}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
                {type === 'textarea' && (
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={`Enter ${field.name.toLowerCase()}`}
                  />
                )}
                {type !== 'dropdown' && type !== 'radio' && type !== 'textarea' && (
                  <input
                    type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text'}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
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
