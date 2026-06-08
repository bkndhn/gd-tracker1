import { useState, useEffect } from 'react';
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
import { Plus, Edit, Trash2, Settings2, Eye, EyeOff, Asterisk } from 'lucide-react';

const FIELD_TYPES = [
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

interface CustomField {
  id: string;
  admin_id: string;
  name: string;
  is_visible: boolean;
  is_mandatory: boolean;
  display_order: number;
  field_type?: string;
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

  // Add field state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('dropdown');
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);

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

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase.from('custom_fields') as any)
        .select('*')
        .is('deleted_at', null)
        .order('display_order');

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
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error fetching custom fields:', error);
      toast.error('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateField = async () => {
    if (!newFieldName.trim()) return;
    try {
      const { error } = await (supabase.from('custom_fields') as any)
        .insert({
          name: newFieldName.trim(),
          field_type: newFieldType,
          admin_id: (profile as any)?.admin_id || profile?.id,
          display_order: fields.length,
        });
      if (error) throw error;
      toast.success('Custom field created');
      setNewFieldName('');
      setNewFieldType('dropdown');
      setIsAddFieldOpen(false);
      fetchFields();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create field');
    }
  };

  const handleEditField = async () => {
    if (!editingField || !editFieldName.trim()) return;
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
      toast.success(`${field.name} is now ${!field.is_visible ? 'visible' : 'hidden'} in GD form`);
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
    try {
      const currentOptions = options[managingField.id] || [];
      const { error } = await (supabase.from('custom_field_options') as any)
        .insert({
          custom_field_id: managingField.id,
          value: newOptionValue.trim(),
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

  if (loading) {
    return <div className="flex justify-center items-center h-32">Loading custom fields...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Custom Fields
              </CardTitle>
              <CardDescription>
                Create custom dropdown fields that appear in the GD form for your users
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddFieldOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No custom fields yet. Click "Add Field" to create one.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{field.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {FIELD_TYPES.find(t => t.value === (field.field_type || 'dropdown'))?.label || field.field_type}
                      </Badge>
                      {(field.field_type || 'dropdown') === 'dropdown' && (
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
                    <div className="flex items-center gap-2">
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
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 border border-primary/20 hover:border-primary hover:bg-primary/10"
                        onClick={() => {
                          setEditingField(field);
                          setEditFieldName(field.name);
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

                  {/* Options list */}
                  <div className="pl-4 border-l-2 border-muted space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder={`Add option to "${field.name}"`}
                        value={managingField?.id === field.id ? newOptionValue : ''}
                        onChange={(e) => {
                          setManagingField(field);
                          setNewOptionValue(e.target.value);
                        }}
                        onFocus={() => setManagingField(field)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && managingField?.id === field.id) {
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
                        disabled={managingField?.id !== field.id || !newOptionValue.trim()}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(options[field.id] || []).map((opt) => (
                        <div key={opt.id} className="flex items-center justify-between p-1.5 bg-muted/50 rounded text-sm">
                          <span>{opt.value}</span>
                          <div className="flex gap-1">
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Field Dialog */}
      <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>Create a new dropdown field for the GD form</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field Name</Label>
              <Input
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g., Color, Brand, Material"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateField()}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsAddFieldOpen(false); setNewFieldName(''); }}>Cancel</Button>
              <Button onClick={handleCreateField} disabled={!newFieldName.trim()}>Create Field</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={isEditFieldOpen} onOpenChange={(open) => { if (!open) { setIsEditFieldOpen(false); setEditingField(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>Update the field name</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editFieldName}
              onChange={(e) => setEditFieldName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEditField()}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsEditFieldOpen(false); setEditingField(null); }}>Cancel</Button>
              <Button onClick={handleEditField} disabled={!editFieldName.trim()}>Save</Button>
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
        description={`This will remove "${deleteField?.name}" and all its options from the GD form.`}
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
