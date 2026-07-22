import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileDown, ArrowUp, ArrowDown, Save } from 'lucide-react';

interface CustomField {
  id: string;
  name: string;
  display_order: number;
  is_standard?: boolean;
  standard_key?: string | null;
}

interface ExportConfig {
  pdf: string[];   // ordered field IDs
  excel: string[]; // ordered field IDs
}

const DEFAULT_CONFIG: ExportConfig = { pdf: [], excel: [] };

export const ExportSettings = () => {
  const { profile } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [config, setConfig] = useState<ExportConfig>(DEFAULT_CONFIG);
  const [settingId, setSettingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const adminId = (profile as any)?.admin_id || profile?.id;

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const [fieldsRes, settingRes] = await Promise.all([
        (supabase.from('custom_fields') as any)
          .select('id, name, display_order, is_standard, standard_key')
          .is('deleted_at', null)
          .order('display_order'),
        supabase
          .from('app_settings')
          .select('*')
          .eq('key', 'export_field_config')
          .eq('admin_id', adminId)
          .maybeSingle(),
      ]);

      if (fieldsRes.error) throw fieldsRes.error;
      setFields(fieldsRes.data || []);

      if (settingRes.data) {
        setSettingId(settingRes.data.id);
        const value = settingRes.data.value as any;
        setConfig({
          pdf: Array.isArray(value?.pdf) ? value.pdf : [],
          excel: Array.isArray(value?.excel) ? value.excel : [],
        });
      } else {
        // Default: include all fields in original order
        const allIds = (fieldsRes.data || []).map((f: CustomField) => f.id);
        setConfig({ pdf: allIds, excel: allIds });
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load export settings');
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  const toggle = (target: 'pdf' | 'excel', fieldId: string) => {
    setConfig(prev => {
      const has = prev[target].includes(fieldId);
      return {
        ...prev,
        [target]: has ? prev[target].filter(id => id !== fieldId) : [...prev[target], fieldId],
      };
    });
  };

  const move = (target: 'pdf' | 'excel', fieldId: string, dir: -1 | 1) => {
    setConfig(prev => {
      const list = [...prev[target]];
      const idx = list.indexOf(fieldId);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= list.length) return prev;
      [list[idx], list[swap]] = [list[swap], list[idx]];
      return { ...prev, [target]: list };
    });
  };

  const save = async () => {
    if (!adminId) return;
    setSaving(true);
    try {
      if (settingId) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: config as any, updated_at: new Date().toISOString() })
          .eq('id', settingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('app_settings')
          .insert({ key: 'export_field_config', value: config as any, admin_id: adminId })
          .select()
          .single();
        if (error) throw error;
        if (data) setSettingId(data.id);
      }
      toast.success('Export settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const renderList = (target: 'pdf' | 'excel') => {
    const selected = config[target];
    const unselected = fields.filter(f => !selected.includes(f.id));
    const orderedSelected = selected
      .map(id => fields.find(f => f.id === id))
      .filter((f): f is CustomField => Boolean(f));
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase">Included (in order)</Label>
          {orderedSelected.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No fields selected</p>
          )}
          {orderedSelected.map((f, i) => (
            <div key={f.id} className="flex items-center justify-between p-2 border rounded-md bg-card">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                <Checkbox checked onCheckedChange={() => toggle(target, f.id)} />
                <span className="text-sm truncate">{f.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(target, f.id, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(target, f.id, 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {unselected.length > 0 && (
          <div className="space-y-1 pt-2">
            <Label className="text-xs text-muted-foreground uppercase">Available</Label>
            {unselected.map(f => (
              <div key={f.id} className="flex items-center gap-2 p-2 border rounded-md border-dashed">
                <Checkbox checked={false} onCheckedChange={() => toggle(target, f.id)} />
                <span className="text-sm truncate">{f.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileDown className="h-5 w-5" />
          Export Settings
        </CardTitle>
        <CardDescription>
          Choose which fields appear in PDF and Excel exports and in what order.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold mb-2">PDF Export</h3>
            {renderList('pdf')}
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Excel Export</h3>
            {renderList('excel')}
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Export Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};
