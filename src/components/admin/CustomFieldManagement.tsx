import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Settings2, EyeOff, Asterisk, ArrowUp, ArrowDown, Copy, Layers } from 'lucide-react';

const FIELD_TYPES = [
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'radio', label: 'Radio' },
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

const HAS_OPTIONS = (t?: string) => (t || 'dropdown') === 'dropdown' || t === 'radio';

/** Labels longer than this are hard to read in the form. */
const MAX_FIELD_NAME = 40;
const WARN_FIELD_NAME = 24;

/** Live preview of how the field will look in the form. */
const FieldPreview = ({
  name,
  type,
  mandatory,
  options,
  scope = 'visit',
}: {
  name: string;
  type: string;
  mandatory: boolean;
  options: string[];
  scope?: 'visit' | 'requirement';
}) => {
  const label = name.trim() || 'Field label';
  return (
    <div className="rounded-lg border bg-muted/30 p-3 min-w-0 overflow-hidden">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Preview in {scope === 'requirement' ? 'requirement form' : 'visit form'}
      </p>
      <div className="space-y-1.5 min-w-0">
        <p className="break-words text-sm font-medium leading-snug min-w-0">
          <span className="line-clamp-2">{label}</span>
          {mandatory ? (
            <span className="ml-1 text-destructive">*</span>
          ) : (
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          )}
        </p>
        {type === 'radio' ? (
          <div className="space-y-1">
            {(options.length ? options : ['Option A', 'Option B']).slice(0, 3).map((o) => (
              <div key={o} className="flex items-center gap-2 text-sm min-w-0">
                <span className="h-3 w-3 shrink-0 rounded-full border" />
                <span className="truncate">{o}</span>
              </div>
            ))}
          </div>
        ) : type === 'textarea' ? (
          <div className="h-14 rounded-md border bg-background px-2 py-1 text-sm text-muted-foreground">
            Type here…
          </div>
        ) : (
          <div className="flex h-9 items-center rounded-md border bg-background px-2 text-sm text-muted-foreground">
            {type === 'dropdown'
              ? options[0] || 'Select an option'
              : type === 'date'
                ? 'dd/mm/yyyy'
                : type === 'number'
                  ? '0'
                  : type === 'email'
                    ? 'name@example.com'
                    : type === 'phone'
                      ? '+91 00000 00000'
                      : 'Type here…'}
          </div>
        )}
      </div>
    </div>
  );
};

interface CustomField {
  id: string;
  admin_id: string;
  name: string;
  is_visible: boolean;
  is_mandatory: boolean;
  display_order: number;
  field_type?: string;
  scope?: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomFieldOption {
  id: string;
  custom_field_id: string;
  value: string;
  display_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export const CustomFieldManagement = () => {
  const { profile } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [options, setOptions] = useState<Record<string, CustomFieldOption[]>>({});
  const [loading, setLoading] = useState(true);

  // Scope: visit form vs requirement / stock form
  const [activeScope, setActiveScope] = useState<'visit' | 'requirement'>('visit');

  // Add field state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('dropdown');
  const [newFieldMandatory, setNewFieldMandatory] = useState(false);
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);

  // Reuse field state
  const [isReuseDialogOpen, setIsReuseDialogOpen] = useState(false);
  const [selectedReuseFieldId, setSelectedReuseFieldId] = useState('');
  const [reusing, setReusing] = useState(false);

  // Edit field state
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [editFieldName, setEditFieldName] = useState('');
  const [editFieldType, setEditFieldType] = useState('dropdown');
  const [isEditFieldOpen, setIsEditFieldOpen] = useState(false);

  // Delete field state
  const [deleteField, setDeleteField] = useState<CustomField | null>(null);
  const [isDeletingField, setIsDeletingField] = useState(false);

  // Manage options state
  const [managingField, setManagingField] = useState<CustomField | null>(null);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [editingOption, setEditingOption] = useState<CustomFieldOption | null>(null);
  const [editOptionValue, setEditOptionValue] = useState('');
  const [isEditOptionOpen, setIsEditOptionOpen] = useState(false);
  const [deleteOption, setDeleteOption] = useState<CustomFieldOption | null>(null);
  const [isDeletingOption, setIsDeletingOption] = useState(false);

  // Plan limits & loophole protection
  const [customFieldsEnabled, setCustomFieldsEnabled] = useState(true);
  const [maxCustomFields, setMaxCustomFields] = useState<number | null>(5);
  const [maxOptionsPerField, setMaxOptionsPerField] = useState<number | null>(20);
  const [maxShops, setMaxShops] = useState<number | null>(5);

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);

      const adminId = (profile as any)?.admin_id || profile?.id;
      if (adminId) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('max_shops, custom_fields_enabled, max_custom_fields, max_options_per_field' as any)
          .eq('id', adminId)
          .single();
        if (profData) {
          const p = profData as any;
          setCustomFieldsEnabled(p.custom_fields_enabled !== false);
          setMaxCustomFields(p.max_custom_fields ?? 5);
          setMaxOptionsPerField(p.max_options_per_field ?? 20);
          setMaxShops(p.max_shops ?? 5);
        }
      }

      let fieldsQuery = (supabase.from('custom_fields') as any)
        .select('*')
        .is('deleted_at', null)
        .order('display_order');

      if (adminId) {
        fieldsQuery = fieldsQuery.eq('admin_id', adminId);
      }

      const { data, error } = await fieldsQuery;

      if (error) throw error;
      setFields(data || []);

      // Fetch options for all fields
      if (data && data.length > 0) {
        const fieldIds = data.map((f: CustomField) => f.id);
        const { data: optionsData, error: optionsError } = await (supabase.from('custom_field_options') as any)
          .select('*')
          .in('custom_field_id', fieldIds)
          .is('deleted_at', null)
          .order('display_order');

        if (optionsError) throw optionsError;

        const grouped: Record<string, CustomFieldOption[]> = {};
        (optionsData || []).forEach((opt: CustomFieldOption) => {
          if (!grouped[opt.custom_field_id]) grouped[opt.custom_field_id] = [];
          grouped[opt.custom_field_id].push(opt);
        });
        setOptions(grouped);
      } else {
        setOptions({});
      }
      try {
        window.dispatchEvent(new CustomEvent('gd:custom_fields_updated'));
      } catch {}
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error fetching custom fields:', error);
      toast.error('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  };

  const scopedFields = useMemo(() => {
    return fields.filter(f => (f.scope || 'visit') === activeScope);
  }, [fields, activeScope]);

  const visitFields = useMemo(() => {
    return fields.filter(f => (f.scope || 'visit') === 'visit');
  }, [fields]);

  const requirementFields = useMemo(() => {
    return fields.filter(f => f.scope === 'requirement');
  }, [fields]);

  const validateName = (name: string, excludeId?: string): string | null => {
    const v = name.trim();
    if (!v) return 'Field name is required.';
    if (v.length > MAX_FIELD_NAME) return `Keep it under ${MAX_FIELD_NAME} characters (currently ${v.length}).`;
    if (scopedFields.some((f) => f.id !== excludeId && f.name.trim().toLowerCase() === v.toLowerCase()))
      return `Another ${activeScope === 'requirement' ? 'requirement' : 'visit'} field already uses this name.`;
    return null;
  };

  /** Non-blocking guidance shown under the input. */
  const nameHint = (name: string): string | null => {
    const v = name.trim();
    if (v.length > WARN_FIELD_NAME) return 'Long labels wrap onto two lines on mobile — shorter is clearer.';
    return null;
  };

  const newFieldError = validateName(newFieldName);
  const editFieldError = editingField ? validateName(editFieldName, editingField.id) : null;

  const handleCreateField = async () => {
    if (!customFieldsEnabled) {
      toast.error('Custom fields are not enabled for your plan. Please contact Super Admin to unlock custom fields.');
      return;
    }
    const nonStandardCount = fields.filter(f => !(f as any).is_standard).length;
    if (maxCustomFields !== null && nonStandardCount >= maxCustomFields) {
      toast.error(`Custom field limit reached (${nonStandardCount}/${maxCustomFields}). Contact Super Admin to upgrade your plan.`);
      return;
    }
    if (newFieldError) {
      toast.error(newFieldError);
      return;
    }
    try {
      const { error } = await (supabase.from('custom_fields') as any)
        .insert({
          name: newFieldName.trim(),
          field_type: newFieldType,
          is_mandatory: newFieldMandatory,
          admin_id: (profile as any)?.admin_id || profile?.id,
          display_order: scopedFields.length,
          scope: activeScope,
        });
      if (error) throw error;
      toast.success(`${activeScope === 'requirement' ? 'Requirement' : 'Visit'} custom field created`);
      setNewFieldName('');
      setNewFieldType('dropdown');
      setNewFieldMandatory(false);
      setIsAddFieldOpen(false);
      fetchFields();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create field');
    }
  };

  const handleReuseField = async () => {
    if (!selectedReuseFieldId) return;
    const sourceField = fields.find(f => f.id === selectedReuseFieldId);
    if (!sourceField) return;

    const existingReqField = requirementFields.find(
      f => f.name.trim().toLowerCase() === sourceField.name.trim().toLowerCase()
    );

    try {
      setReusing(true);
      const sourceOptions = options[sourceField.id] || [];

      if (existingReqField) {
        // Sync new options into existing requirement field
        const existingOpts = (options[existingReqField.id] || []).map(o => o.value.trim().toLowerCase());
        const newOptsToCopy = sourceOptions.filter(o => !existingOpts.includes(o.value.trim().toLowerCase()));

        if (newOptsToCopy.length === 0) {
          toast.info(`"${sourceField.name}" is already in requirements with all options synced.`);
          setIsReuseDialogOpen(false);
          setSelectedReuseFieldId('');
          return;
        }

        const startIdx = (options[existingReqField.id] || []).length;
        const toInsert = newOptsToCopy.map((opt, idx) => ({
          custom_field_id: existingReqField.id,
          value: opt.value,
          display_order: startIdx + idx,
        }));
        const { error: optError } = await (supabase.from('custom_field_options') as any).insert(toInsert);
        if (optError) throw optError;

        toast.success(`Synced ${newOptsToCopy.length} option(s) to "${existingReqField.name}" in requirements`);
        setIsReuseDialogOpen(false);
        setSelectedReuseFieldId('');
        fetchFields();
        return;
      }

      // Create new requirement field
      const { data: newField, error: fieldError } = await (supabase.from('custom_fields') as any)
        .insert({
          name: sourceField.name,
          field_type: sourceField.field_type || 'dropdown',
          is_mandatory: false,
          is_visible: true,
          admin_id: (profile as any)?.admin_id || profile?.id,
          display_order: requirementFields.length,
          scope: 'requirement',
        })
        .select()
        .single();

      if (fieldError) throw fieldError;

      // Copy options if any
      if (sourceOptions.length > 0 && newField?.id) {
        const toInsert = sourceOptions.map((opt, idx) => ({
          custom_field_id: newField.id,
          value: opt.value,
          display_order: idx,
        }));
        const { error: optError } = await (supabase.from('custom_field_options') as any).insert(toInsert);
        if (optError) throw optError;
      }

      toast.success(`Reused "${sourceField.name}" for requirements with ${sourceOptions.length} option(s)`);
      setIsReuseDialogOpen(false);
      setSelectedReuseFieldId('');
      fetchFields();
    } catch (e: any) {
      toast.error(e.message || 'Failed to copy field');
    } finally {
      setReusing(false);
    }
  };

  const handleEditField = async () => {
    if (!editingField) return;
    if (editFieldError) {
      toast.error(editFieldError);
      return;
    }
    try {
      const { error } = await (supabase.from('custom_fields') as any)
        .update({ name: editFieldName.trim(), field_type: editFieldType })
        .eq('id', editingField.id);
      if (error) throw error;
      toast.success('Field updated');
      setIsEditFieldOpen(false);
      setEditingField(null);
      fetchFields();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update field');
    }
  };

  const handleDeleteField = async () => {
    if (!deleteField) return;
    setIsDeletingField(true);
    try {
      const { error } = await (supabase.from('custom_fields') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteField.id);
      if (error) throw error;
      toast.success('Field deleted');
      setDeleteField(null);
      fetchFields();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete field');
    } finally {
      setIsDeletingField(false);
    }
  };

  const handleToggleVisibility = async (field: CustomField) => {
    try {
      const { error } = await (supabase.from('custom_fields') as any)
        .update({ is_visible: !field.is_visible })
        .eq('id', field.id);
      if (error) throw error;
      toast.success(`${field.name} is now ${!field.is_visible ? 'visible' : 'hidden'} in form`);
      fetchFields();
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle visibility');
    }
  };

  const handleToggleMandatory = async (field: CustomField) => {
    try {
      const { error } = await (supabase.from('custom_fields') as any)
        .update({ is_mandatory: !field.is_mandatory })
        .eq('id', field.id);
      if (error) throw error;
      toast.success(`${field.name} is now ${!field.is_mandatory ? 'mandatory' : 'optional'}`);
      fetchFields();
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle mandatory');
    }
  };

  // Options management
  const handleAddOption = async () => {
    if (!managingField || !newOptionValue.trim()) return;
    const trimmed = newOptionValue.trim();
    const currentOptions = options[managingField.id] || [];

    if (currentOptions.some(o => o.value.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This option already exists');
      return;
    }

    const isShopField = (managingField as any).standard_key === 'shop' || managingField.name.toLowerCase() === 'shop';
    if (isShopField && maxShops !== null && currentOptions.length >= maxShops) {
      toast.error(`Shop limit reached (${currentOptions.length}/${maxShops}). You cannot add more shops. Contact Super Admin to increase your limit.`);
      return;
    }

    if (maxOptionsPerField !== null && currentOptions.length >= maxOptionsPerField) {
      toast.error(`Maximum option limit reached (${maxOptionsPerField} per field). Contact Super Admin to increase limits.`);
      return;
    }

    try {
      const { error } = await (supabase.from('custom_field_options') as any)
        .insert({
          custom_field_id: managingField.id,
          value: trimmed,
          display_order: currentOptions.length,
        });
      if (error) throw error;
      toast.success('Option added');
      setNewOptionValue('');
      fetchFields();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add option');
    }
  };

  const handleEditOption = async () => {
    if (!editingOption || !editOptionValue.trim()) return;
    try {
      const { error } = await (supabase.from('custom_field_options') as any)
        .update({ value: editOptionValue.trim() })
        .eq('id', editingOption.id);
      if (error) throw error;
      toast.success('Option updated');
      setIsEditOptionOpen(false);
      setEditingOption(null);
      fetchFields();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update option');
    }
  };

  const handleDeleteOption = async () => {
    if (!deleteOption) return;
    setIsDeletingOption(true);
    try {
      const { error } = await (supabase.from('custom_field_options') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteOption.id);
      if (error) throw error;
      toast.success('Option deleted');
      setDeleteOption(null);
      fetchFields();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete option');
    } finally {
      setIsDeletingOption(false);
    }
  };

  const handleMoveField = async (field: CustomField, direction: -1 | 1) => {
    const sorted = [...scopedFields].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex(f => f.id === field.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    try {
      await (supabase.from('custom_fields') as any).update({ display_order: -1 }).eq('id', a.id);
      await (supabase.from('custom_fields') as any).update({ display_order: a.display_order }).eq('id', b.id);
      await (supabase.from('custom_fields') as any).update({ display_order: b.display_order }).eq('id', a.id);
      fetchFields();
    } catch (e: any) {
      toast.error(e.message || 'Failed to reorder');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-32">Loading custom fields...</div>;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader className="px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Settings2 className="h-5 w-5 shrink-0" />
                Custom Fields Management
              </CardTitle>
              <CardDescription>
                {activeScope === 'visit'
                  ? 'Configure custom fields that appear in the Log Non-Purchase Visit form'
                  : 'Configure custom fields that appear when shop staff raise stock requirements'}
              </CardDescription>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant={!customFieldsEnabled ? 'destructive' : 'outline'} className="text-xs font-normal">
                  {!customFieldsEnabled ? 'Custom fields disabled on current plan' : `Custom fields: ${fields.filter(f => !(f as any).is_standard).length} / ${maxCustomFields ?? '∞'}`}
                </Badge>
                {customFieldsEnabled && maxOptionsPerField && (
                  <Badge variant="secondary" className="text-xs font-normal text-muted-foreground">
                    Max {maxOptionsPerField} options/field
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {activeScope === 'requirement' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!customFieldsEnabled}
                  onClick={() => {
                    setSelectedReuseFieldId('');
                    setIsReuseDialogOpen(true);
                  }}
                  className="w-full sm:w-auto"
                >
                  <Copy className="h-4 w-4 mr-1 text-primary" />
                  Reuse from Visit Form
                </Button>
              )}
              <Button
                onClick={() => {
                  if (!customFieldsEnabled) {
                    toast.error('Custom fields are not enabled on your plan.');
                    return;
                  }
                  const nonStandardCount = fields.filter(f => !(f as any).is_standard).length;
                  if (maxCustomFields !== null && nonStandardCount >= maxCustomFields) {
                    toast.error(`Custom field limit reached (${nonStandardCount}/${maxCustomFields}). Contact Super Admin to upgrade.`);
                    return;
                  }
                  setIsAddFieldOpen(true);
                }}
                disabled={!customFieldsEnabled || (maxCustomFields !== null && fields.filter(f => !(f as any).is_standard).length >= maxCustomFields)}
                size="sm"
                className="w-full sm:w-auto shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                {activeScope === 'requirement' ? 'Add Requirement Field' : 'Add Visit Field'}
              </Button>
            </div>
          </div>

          {/* Scope selection tabs */}
          <div className="flex items-center gap-2 pt-4 border-b">
            <button
              onClick={() => setActiveScope('visit')}
              className={`flex items-center gap-2 pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeScope === 'visit'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="h-4 w-4" />
              Visit Form Fields
              <Badge variant={activeScope === 'visit' ? 'default' : 'secondary'} className="text-xs ml-1">
                {visitFields.length}
              </Badge>
            </button>
            <button
              onClick={() => setActiveScope('requirement')}
              className={`flex items-center gap-2 pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeScope === 'requirement'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings2 className="h-4 w-4" />
              Requirement / Stock Fields
              <Badge variant={activeScope === 'requirement' ? 'default' : 'secondary'} className="text-xs ml-1">
                {requirementFields.length}
              </Badge>
            </button>
          </div>
        </CardHeader>

        <CardContent className="px-3 sm:px-6">
          {scopedFields.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg">
              <p className="text-muted-foreground mb-3">
                No custom fields for {activeScope === 'requirement' ? 'requirements' : 'visit form'} yet.
              </p>
              <div className="flex items-center justify-center gap-2">
                {activeScope === 'requirement' && visitFields.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setIsReuseDialogOpen(true)}>
                    <Copy className="h-4 w-4 mr-1" /> Reuse from Visit Form
                  </Button>
                )}
                <Button size="sm" onClick={() => setIsAddFieldOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Field
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {scopedFields.map((field) => (
                <div key={field.id} className="border rounded-lg p-3 sm:p-4 space-y-3 min-w-0">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium break-words min-w-0">{field.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {FIELD_TYPES.find(t => t.value === (field.field_type || 'dropdown'))?.label || field.field_type}
                      </Badge>
                      {HAS_OPTIONS(field.field_type) && (
                        <Badge variant="secondary" className="text-xs">
                          {(options[field.id] || []).length} options
                        </Badge>
                      )}
                      {field.is_mandatory && (
                        <Badge variant="destructive" className="text-xs">
                          <Asterisk className="h-3 w-3 mr-0.5" />
                          Required
                        </Badge>
                      )}
                      {!field.is_visible && (
                        <Badge variant="outline" className="text-xs">
                          <EyeOff className="h-3 w-3 mr-0.5" />
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap lg:shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`visible-${field.id}`} className="text-xs text-muted-foreground">Show</Label>
                        <Switch
                          id={`visible-${field.id}`}
                          checked={field.is_visible}
                          onCheckedChange={() => handleToggleVisibility(field)}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`mandatory-${field.id}`} className="text-xs text-muted-foreground">Required</Label>
                        <Switch
                          id={`mandatory-${field.id}`}
                          checked={field.is_mandatory}
                          onCheckedChange={() => handleToggleMandatory(field)}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Move up"
                        onClick={() => handleMoveField(field, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Move down"
                        onClick={() => handleMoveField(field, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 border border-primary/20 hover:border-primary hover:bg-primary/10"
                        onClick={() => {
                          setEditingField(field);
                          setEditFieldName(field.name);
                          setEditFieldType(field.field_type || 'dropdown');
                          setIsEditFieldOpen(true);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 border border-destructive/20 hover:border-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteField(field)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Options list (dropdown + radio) */}
                  {HAS_OPTIONS(field.field_type) && (() => {
                    const isShopField = (field as any).standard_key === 'shop' || field.name.toLowerCase() === 'shop';
                    const optLimit = isShopField ? maxShops : maxOptionsPerField;
                    const optCount = (options[field.id] || []).length;
                    const isOptLimitReached = optLimit !== null && optCount >= optLimit;
                    return (
                    <div className="pl-4 border-l-2 border-muted space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Selectable Options ({optCount}{optLimit ? ` / ${optLimit}` : ''})</span>
                        {isOptLimitReached && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {isShopField ? 'Shop limit reached' : 'Option cap reached'}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder={isOptLimitReached ? `${isShopField ? 'Shop' : 'Option'} cap reached` : `Add option to "${field.name}"`}
                          disabled={isOptLimitReached}
                          value={managingField?.id === field.id ? newOptionValue : ''}
                          onChange={(e) => {
                            setManagingField(field);
                            setNewOptionValue(e.target.value);
                          }}
                          onFocus={() => setManagingField(field)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && managingField?.id === field.id && !isOptLimitReached) {
                              handleAddOption();
                            }
                          }}
                          className="h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setManagingField(field);
                            handleAddOption();
                          }}
                          disabled={isOptLimitReached || managingField?.id !== field.id || !newOptionValue.trim()}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {(options[field.id] || []).map((opt) => (
                          <div key={opt.id} className="flex items-center justify-between gap-2 p-1.5 bg-muted/50 rounded text-sm min-w-0">
                            <span className="truncate min-w-0">{opt.value}</span>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  setEditingOption(opt);
                                  setEditOptionValue(opt.value);
                                  setIsEditOptionOpen(true);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6"
                                onClick={() => setDeleteOption(opt)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {(options[field.id] || []).length === 0 && (
                          <p className="text-xs text-muted-foreground py-1">No options yet</p>
                        )}
                      </div>
                    </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reuse Field Dialog */}
      <Dialog open={isReuseDialogOpen} onOpenChange={setIsReuseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reuse Field from Visit Form</DialogTitle>
            <DialogDescription>
              Copy a field configuration and all its options from the Visit Form into Requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 min-w-0">
            {visitFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visit form fields available to copy.</p>
            ) : (
              <div className="space-y-2">
                <Label>Select Visit Field to Copy</Label>
                <Select value={selectedReuseFieldId} onValueChange={setSelectedReuseFieldId}>
                  <SelectTrigger><SelectValue placeholder="Choose a field to copy" /></SelectTrigger>
                  <SelectContent>
                    {visitFields.map(f => {
                      const alreadyCopied = requirementFields.some(
                        rf => rf.name.trim().toLowerCase() === f.name.trim().toLowerCase()
                      );
                      const optCount = (options[f.id] || []).length;
                      return (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} ({f.field_type || 'dropdown'}{optCount > 0 ? `, ${optCount} options` : ''})
                          {alreadyCopied ? ' · in requirements (sync)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedReuseFieldId && (() => {
                  const src = visitFields.find(f => f.id === selectedReuseFieldId);
                  const isExisting = requirementFields.some(rf => rf.name.trim().toLowerCase() === src?.name.trim().toLowerCase());
                  return (
                    <div className="mt-3 p-3 bg-muted/40 rounded-lg text-sm space-y-1 border">
                      <p className="font-medium">
                        Field: {src?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Type: {src?.field_type || 'dropdown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Available options: {(options[selectedReuseFieldId] || []).length} items
                      </p>
                      {isExisting && (
                        <p className="text-xs text-primary font-medium pt-1">
                          ✓ This field exists in requirements. Clicking below will sync any new/missing options to it!
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsReuseDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleReuseField} disabled={!selectedReuseFieldId || reusing}>
                {reusing ? 'Processing...' : (() => {
                  const src = visitFields.find(f => f.id === selectedReuseFieldId);
                  const isExisting = requirementFields.some(rf => rf.name.trim().toLowerCase() === src?.name.trim().toLowerCase());
                  return isExisting ? 'Sync Options to Requirements' : 'Copy to Requirements';
                })()}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Field Dialog */}
      <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeScope === 'requirement' ? 'Add Requirement Field' : 'Add Custom Field'}
            </DialogTitle>
            <DialogDescription>
              {activeScope === 'requirement'
                ? 'Create a new custom field for shop stock requirements'
                : 'Create a new field for the visit form'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 min-w-0">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <Label>Field Name</Label>
                <span className={`text-xs ${newFieldName.trim().length > MAX_FIELD_NAME ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {newFieldName.trim().length}/{MAX_FIELD_NAME}
                </span>
              </div>
              <Input
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value.slice(0, MAX_FIELD_NAME + 10))}
                placeholder={activeScope === 'requirement' ? 'e.g., Fabric / Material, Priority Reason' : 'e.g., Color, Brand, Material'}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateField()}
              />
              {newFieldName.trim() && newFieldError && (
                <p className="text-xs text-destructive">{newFieldError}</p>
              )}
              {!newFieldError && nameHint(newFieldName) && (
                <p className="text-xs text-muted-foreground">{nameHint(newFieldName)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select value={newFieldType} onValueChange={setNewFieldType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <Label htmlFor="new-mandatory" className="text-sm">Required field</Label>
                <p className="text-xs text-muted-foreground">
                  {newFieldMandatory
                    ? 'Users cannot submit until this is filled.'
                    : 'Users can leave this blank when raising a request or visit.'}
                </p>
              </div>
              <Switch id="new-mandatory" checked={newFieldMandatory} onCheckedChange={setNewFieldMandatory} />
            </div>
            {HAS_OPTIONS(newFieldType) && (
              <p className="text-xs text-muted-foreground">
                Add the selectable options after creating the field.
              </p>
            )}
            <FieldPreview
              name={newFieldName}
              type={newFieldType}
              mandatory={newFieldMandatory}
              options={[]}
              scope={activeScope}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsAddFieldOpen(false); setNewFieldName(''); setNewFieldType('dropdown'); setNewFieldMandatory(false); }}>Cancel</Button>
              <Button onClick={handleCreateField} disabled={!!newFieldError}>Create Field</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={isEditFieldOpen} onOpenChange={(open) => { if (!open) { setIsEditFieldOpen(false); setEditingField(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>Update the field and check the preview before saving</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 min-w-0">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <Label>Field Name</Label>
                <span className={`text-xs ${editFieldName.trim().length > MAX_FIELD_NAME ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {editFieldName.trim().length}/{MAX_FIELD_NAME}
                </span>
              </div>
              <Input
                value={editFieldName}
                onChange={(e) => setEditFieldName(e.target.value.slice(0, MAX_FIELD_NAME + 10))}
                onKeyPress={(e) => e.key === 'Enter' && handleEditField()}
              />
              {editFieldError && <p className="text-xs text-destructive">{editFieldError}</p>}
              {!editFieldError && nameHint(editFieldName) && (
                <p className="text-xs text-muted-foreground">{nameHint(editFieldName)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select value={editFieldType} onValueChange={setEditFieldType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {editingField && HAS_OPTIONS(editingField.field_type) && !HAS_OPTIONS(editFieldType) && (
                <p className="text-xs text-destructive">
                  Changing away from a choice type hides the existing options from the form.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This field is currently{' '}
              <span className="font-medium">{editingField?.is_mandatory ? 'required' : 'optional'}</span> — toggle
              "Required" in the list to change it.
            </p>
            <FieldPreview
              name={editFieldName}
              type={editFieldType}
              mandatory={!!editingField?.is_mandatory}
              options={(options[editingField?.id || ''] || []).map((o) => o.value)}
              scope={(editingField?.scope as any) || 'visit'}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsEditFieldOpen(false); setEditingField(null); }}>Cancel</Button>
              <Button onClick={handleEditField} disabled={!!editFieldError}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Option Dialog */}
      <Dialog open={isEditOptionOpen} onOpenChange={(open) => { if (!open) { setIsEditOptionOpen(false); setEditingOption(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Option</DialogTitle>
            <DialogDescription>Update the option value</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editOptionValue}
              onChange={(e) => setEditOptionValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEditOption()}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsEditOptionOpen(false); setEditingOption(null); }}>Cancel</Button>
              <Button onClick={handleEditOption} disabled={!editOptionValue.trim()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Field Confirmation */}
      <DeleteConfirmationDialog
        open={!!deleteField}
        onOpenChange={(open) => !open && setDeleteField(null)}
        onConfirm={handleDeleteField}
        title="Delete Custom Field"
        itemName={deleteField?.name}
        description={`This will remove "${deleteField?.name}" and all its options from the ${deleteField?.scope === 'requirement' ? 'requirements' : 'visit'} form.`}
        loading={isDeletingField}
      />

      {/* Delete Option Confirmation */}
      <DeleteConfirmationDialog
        open={!!deleteOption}
        onOpenChange={(open) => !open && setDeleteOption(null)}
        onConfirm={handleDeleteOption}
        title="Delete Option"
        itemName={deleteOption?.value}
        loading={isDeletingOption}
      />
    </div>
  );
};
