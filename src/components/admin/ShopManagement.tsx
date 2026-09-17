import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { toast } from 'sonner';
import { Store, Plus, Edit, Trash2, Users, AlertTriangle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

interface ShopItem {
  id: string;
  name: string;
  created_at: string;
  admin_id: string | null;
  deleted_at: string | null;
}

interface ShopManagementProps {
  onRefresh?: () => void;
}

export const ShopManagement = ({ onRefresh }: ShopManagementProps) => {
  const { profile } = useAuth();
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [maxShops, setMaxShops] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});

  // Add shop dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit shop dialog
  const [editingShop, setEditingShop] = useState<ShopItem | null>(null);
  const [editName, setEditName] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Delete confirmation
  const [deletingShop, setDeletingShop] = useState<ShopItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const role = (profile as any)?.role;
  const adminId = role === 'admin' || role === 'super_admin' ? profile?.id : (profile as any)?.admin_id;

  const fetchShopData = useCallback(async () => {
    if (!adminId) return;
    try {
      setLoading(true);
      const [shopsRes, profRes, profilesRes] = await Promise.all([
        supabase
          .from('shops')
          .select('*')
          .eq('admin_id', adminId)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('profiles')
          .select('max_shops')
          .eq('id', adminId)
          .single(),
        supabase
          .from('profiles')
          .select('shop_id')
          .eq('admin_id', adminId)
          .is('deleted_at', null),
      ]);

      if (shopsRes.error) throw shopsRes.error;
      const loadedShops = (shopsRes.data || []) as ShopItem[];
      setShops(loadedShops);
      setMaxShops((profRes.data as any)?.max_shops ?? 5);

      const counts: Record<string, number> = {};
      (profilesRes.data || []).forEach((p: any) => {
        if (p.shop_id) counts[p.shop_id] = (counts[p.shop_id] || 0) + 1;
      });
      setStaffCounts(counts);
    } catch (e: any) {
      if (import.meta.env.DEV) console.error('fetchShopData error', e);
      toast.error('Failed to load shops');
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    fetchShopData();
  }, [fetchShopData]);

  const isLimitReached = maxShops !== null && shops.length >= maxShops;

  const handleAddShop = async () => {
    const trimmed = newShopName.trim();
    if (!trimmed) {
      toast.error('Shop name is required');
      return;
    }

    if (isLimitReached) {
      toast.error(`Shop limit reached (${shops.length}/${maxShops}). Contact Super Admin to increase your limit.`);
      return;
    }

    if (shops.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('A shop with this name already exists');
      return;
    }

    setSaving(true);
    try {
      // 1. Insert into shops table
      const { data: newShop, error } = await supabase
        .from('shops')
        .insert({
          name: trimmed,
          admin_id: adminId,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // 2. Synchronize with standard shop custom field if present
      try {
        const { data: standardShopField } = await (supabase.from('custom_fields') as any)
          .select('id')
          .eq('standard_key', 'shop')
          .is('deleted_at', null)
          .maybeSingle();

        if (standardShopField && newShop) {
          await (supabase.from('custom_field_options') as any).insert({
            custom_field_id: standardShopField.id,
            value: trimmed,
            legacy_id: (newShop as any).id,
            legacy_table: 'shops',
          });
        }
      } catch (optErr) {
        if (import.meta.env.DEV) console.warn('Could not sync custom_field_options for new shop', optErr);
      }

      toast.success(`Shop "${trimmed}" created successfully`);
      setNewShopName('');
      setIsAddOpen(false);
      fetchShopData();
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create shop');
    } finally {
      setSaving(false);
    }
  };

  const handleEditShop = async () => {
    if (!editingShop) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error('Shop name is required');
      return;
    }

    if (shops.some(s => s.id !== editingShop.id && s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Another shop already has this name');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('shops')
        .update({ name: trimmed } as any)
        .eq('id', editingShop.id);

      if (error) throw error;

      // Synchronize name in standard custom_field_options
      try {
        await (supabase.from('custom_field_options') as any)
          .update({ value: trimmed })
          .eq('legacy_id', editingShop.id);
      } catch {}

      toast.success('Shop renamed successfully');
      setIsEditOpen(false);
      setEditingShop(null);
      fetchShopData();
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to rename shop');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShop = async () => {
    if (!deletingShop) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('shops')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', deletingShop.id);

      if (error) throw error;

      // Soft delete standard option
      try {
        await (supabase.from('custom_field_options') as any)
          .update({ deleted_at: new Date().toISOString() })
          .eq('legacy_id', deletingShop.id);
      } catch {}

      toast.success(`Shop "${deletingShop.name}" deleted`);
      setDeletingShop(null);
      fetchShopData();
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete shop');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="premium-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" /> Shop & Branch Locations
                </CardTitle>
                <Badge
                  variant={isLimitReached ? 'destructive' : 'secondary'}
                  className="font-medium text-xs"
                >
                  {shops.length} / {maxShops !== null ? maxShops : '∞'} used
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Configure authorized shop branches for user assignment and requirement fulfillment.
              </CardDescription>
            </div>

            <Button
              size="sm"
              onClick={() => {
                if (isLimitReached) {
                  toast.error(`Shop limit reached (${shops.length}/${maxShops}). Upgrade plan to add more shops.`);
                  return;
                }
                setNewShopName('');
                setIsAddOpen(true);
              }}
              className="gap-1.5 shrink-0"
            >
              <Plus className="h-4 w-4" /> Add Shop
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLimitReached && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Shop quota reached ({shops.length}/{maxShops}):</strong> You cannot add additional shops or branches without upgrading your plan limits with the Super Admin.
              </span>
            </div>
          )}

          {loading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded-md bg-muted/60 animate-pulse" />
              ))}
            </div>
          ) : shops.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg bg-muted/10">
              <Store className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-medium text-sm">No shops created yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Add your first retail shop or branch location to begin assigning staff and tracking stock requirements.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                className="mt-3 gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Create Shop
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop Name</TableHead>
                    <TableHead>Assigned Team</TableHead>
                    <TableHead className="hidden sm:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shops.map(shop => {
                    const count = staffCounts[shop.id] || 0;
                    return (
                      <TableRow key={shop.id}>
                        <TableCell className="font-semibold text-sm">
                          <span className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-primary/70 shrink-0" />
                            {shop.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {count} member{count === 1 ? '' : 's'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {format(new Date(shop.created_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setEditingShop(shop);
                                setEditName(shop.name);
                                setIsEditOpen(true);
                              }}
                              title="Rename Shop"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeletingShop(shop)}
                              title="Delete Shop"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Shop Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Shop Location</DialogTitle>
            <DialogDescription>
              Create an authorized branch location. Available quota: {shops.length} / {maxShops ?? '∞'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Shop / Branch Name *</Label>
              <Input
                placeholder="e.g. Downtown Mall, City Center Branch"
                value={newShopName}
                onChange={e => setNewShopName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddShop()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddShop} disabled={saving || isLimitReached}>
                {saving ? 'Creating…' : 'Create Shop'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Shop Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Shop</DialogTitle>
            <DialogDescription>Update the display name of this branch location.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Shop Name *</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditShop()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button onClick={handleEditShop} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Shop Confirmation */}
      <DeleteConfirmationDialog
        open={!!deletingShop}
        onOpenChange={open => !open && setDeletingShop(null)}
        onConfirm={handleDeleteShop}
        title="Delete Shop"
        itemName={deletingShop?.name}
        description={`Are you sure you want to delete "${deletingShop?.name}"? Staff assigned to this shop will need to be reassigned.`}
        loading={isDeleting}
      />
    </div>
  );
};
