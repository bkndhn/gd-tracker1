import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_LABELS, FieldLabels } from '@/hooks/useFieldLabels';

interface FieldVisibility {
  category: boolean;
  size: boolean;
  customer_type: boolean;
  shops: boolean;
}

const DEFAULT_VISIBILITY: FieldVisibility = {
  category: true,
  size: true,
  customer_type: true,
  shops: true,
};

export const FieldVisibilitySettings = () => {
  const { profile } = useAuth();
  const [visibility, setVisibility] = useState<FieldVisibility>(DEFAULT_VISIBILITY);
  const [labels, setLabels] = useState<FieldLabels>(DEFAULT_LABELS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingId, setSettingId] = useState<string | null>(null);

  const adminId = (profile as any)?.role === 'admin' ? profile?.id : (profile as any)?.admin_id;

  const fetchSettings = useCallback(async () => {
    if (!adminId) return;
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'field_visibility')
        .eq('admin_id', adminId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingId(data.id);
        const value = data.value as any;
        setVisibility({
          category: value.category ?? true,
          size: value.size ?? true,
          customer_type: value.customer_type ?? true,
          shops: value.shops ?? true,
        });
        const l = value.labels || {};
        setLabels({
          category: l.category || DEFAULT_LABELS.category,
          size: l.size || DEFAULT_LABELS.size,
          customer_type: l.customer_type || DEFAULT_LABELS.customer_type,
          shops: l.shops || DEFAULT_LABELS.shops,
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching field visibility:', error);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const persist = async (nextVisibility: FieldVisibility, nextLabels: FieldLabels) => {
    if (!adminId) return;
    const payload = { ...nextVisibility, labels: nextLabels } as any;
    if (settingId) {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: payload, updated_at: new Date().toISOString() })
        .eq('id', settingId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({ key: 'field_visibility', value: payload, admin_id: adminId })
        .select()
        .single();
      if (error) throw error;
      if (data) setSettingId(data.id);
    }
  };

  const handleToggle = async (field: keyof FieldVisibility, newValue: boolean) => {
    const updated = { ...visibility, [field]: newValue };
    setVisibility(updated);
    try {
      await persist(updated, labels);
      toast.success(`${labels[field]} ${newValue ? 'shown' : 'hidden'}`);
    } catch (error: any) {
      setVisibility(visibility);
      toast.error(error.message || 'Failed to update setting');
    }
  };

  const handleLabelChange = (field: keyof FieldLabels, val: string) => {
    setLabels({ ...labels, [field]: val });
  };

  const handleSaveLabels = async () => {
    setSaving(true);
    try {
      const cleaned: FieldLabels = {
        category: labels.category.trim() || DEFAULT_LABELS.category,
        size: labels.size.trim() || DEFAULT_LABELS.size,
        customer_type: labels.customer_type.trim() || DEFAULT_LABELS.customer_type,
        shops: labels.shops.trim() || DEFAULT_LABELS.shops,
      };
      setLabels(cleaned);
      await persist(visibility, cleaned);
      toast.success('Field labels saved — reflected everywhere');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save labels');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const fields: { key: keyof FieldVisibility; desc: string }[] = [
    { key: 'category', desc: 'Show in GD form' },
    { key: 'size', desc: 'Show in GD form' },
    { key: 'customer_type', desc: 'Show in GD form' },
    { key: 'shops', desc: 'Show in GD form (else auto-assigned)' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          GD Field Visibility & Labels
        </CardTitle>
        <CardDescription>
          Toggle visibility and rename each field. Labels appear everywhere (form, reports, dashboard).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <div key={f.key} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end border rounded-md p-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">{DEFAULT_LABELS[f.key]}</Label>
              <Input
                value={labels[f.key]}
                onChange={(e) => handleLabelChange(f.key, e.target.value)}
                placeholder={DEFAULT_LABELS[f.key]}
              />
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{visibility[f.key] ? 'Visible' : 'Hidden'}</span>
              <Switch
                checked={visibility[f.key]}
                onCheckedChange={(v) => handleToggle(f.key, v)}
              />
            </div>
          </div>
        ))}
        <Button onClick={handleSaveLabels} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Labels'}
        </Button>
      </CardContent>
    </Card>
  );
};
