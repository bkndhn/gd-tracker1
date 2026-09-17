import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { UserPlus, Edit, Trash2, Pause, Play, KeyRound } from 'lucide-react';
import { Database } from '@/types/database';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { PasswordInput } from '@/components/ui/password-input';
import { validatePassword } from '@/utils/passwordPolicy';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

type Profile = Database['public']['Tables']['profiles']['Row'] & {
  email?: string;
};
type Shop = Database['public']['Tables']['shops']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Size = Database['public']['Tables']['sizes']['Row'];

interface UserManagementProps {
  shops?: Shop[];
  profiles?: Profile[];
  onRefresh?: () => void;
}

export const UserManagement = ({ shops: propShops, profiles: propProfiles, onRefresh: propOnRefresh }: UserManagementProps = {}) => {
  const { user, profile: currentProfile, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>(propProfiles || []);
  const [shops, setShops] = useState<Shop[]>(propShops || []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(!propProfiles || !propShops);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [credentialsUser, setCredentialsUser] = useState<Profile | null>(null);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  // Create sub-user state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    shop_id: 'none',
    warehouse_all_shops: true,
    warehouse_shop_ids: [] as string[],
  });

  useEffect(() => {
    if (!propProfiles || !propShops) {
      fetchData();
    } else {
      fetchCategoriesAndSizes();
    }
  }, [propProfiles, propShops]);

  const fetchCategoriesAndSizes = useCallback(async () => {
    try {
      const [categoriesRes, sizesRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
      ]);
      if (categoriesRes.error) throw categoriesRes.error;
      if (sizesRes.error) throw sizesRes.error;
      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching categories and sizes:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');
      if (profilesError) throw profilesError;

      const [shopsRes, categoriesRes, sizesRes] = await Promise.all([
        supabase.from('shops').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('sizes').select('*').order('size'),
      ]);
      if (shopsRes.error) throw shopsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (sizesRes.error) throw sizesRes.error;

      setProfiles(profilesData as Profile[]);
      setShops(shopsRes.data);
      setCategories(categoriesRes.data);
      setSizes(sizesRes.data);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching data:', error);
      toast.error('Failed to load user management data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateSubUser = useCallback(async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Name, email, and password are required');
      return;
    }
    const pwValidation = validatePassword(newUser.password);
    if (!pwValidation.isValid) {
      toast.error('Password does not meet requirements: ' + pwValidation.errors.join(', '));
      return;
    }
    if (newUser.role !== 'warehouse' && newUser.shop_id === 'none') {
      toast.error('Please select a shop');
      return;
    }
    if (newUser.role === 'warehouse' && !newUser.warehouse_all_shops && newUser.warehouse_shop_ids.length === 0) {
      toast.error('Pick at least one shop for this warehouse staff member');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-sub-user', {
        body: {
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          shop_id: newUser.shop_id === 'none' ? null : newUser.shop_id,
          warehouse_all_shops: newUser.role === 'warehouse' ? newUser.warehouse_all_shops : false,
          warehouse_shop_ids: newUser.role === 'warehouse' && !newUser.warehouse_all_shops ? newUser.warehouse_shop_ids : [],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Sub-user "${newUser.name}" created successfully`);
      setIsCreateOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'user', shop_id: 'none', warehouse_all_shops: true, warehouse_shop_ids: [] });
      if (propOnRefresh) propOnRefresh();
      else fetchData();
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error creating sub-user:', error);
      toast.error(error.message || 'Failed to create sub-user');
    } finally {
      setCreating(false);
    }
  }, [newUser, propOnRefresh, fetchData]);

  const handleDelete = useCallback(async () => {
    if (!deleteUser) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', deleteUser.id);
      if (error) throw error;

      toast.success('User deleted successfully');
      setDeleteUser(null);
      if (propOnRefresh) propOnRefresh();
      else fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteUser, propOnRefresh, fetchData]);

  const handleToggleStatus = useCallback(async (targetUser: Profile) => {
    const currentStatus = (targetUser as any).status || 'active';
    const action = currentStatus === 'active' ? 'pause' : 'unpause';
    
    setTogglingStatus(targetUser.id);
    try {
      const { data, error } = await supabase.functions.invoke('update-sub-user', {
        body: { user_id: targetUser.id, action },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`User ${action === 'pause' ? 'paused' : 'activated'} successfully`);
      if (propOnRefresh) propOnRefresh();
      else fetchData();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} user`);
    } finally {
      setTogglingStatus(null);
    }
  }, [propOnRefresh, fetchData]);

  const handleSaveCredentials = useCallback(async (newEmail: string, newPassword: string) => {
    if (!credentialsUser) return;
    if (!newEmail && !newPassword) {
      toast.error('Provide at least an email or password to update');
      return;
    }

    try {
      const body: any = { user_id: credentialsUser.id };
      if (newEmail && newEmail !== credentialsUser.email) body.email = newEmail;
      if (newPassword) body.password = newPassword;

      if (!body.email && !body.password) {
        toast.info('No changes detected');
        return;
      }

      const { data, error } = await supabase.functions.invoke('update-sub-user', {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Credentials updated. User has been logged out and must log in with new credentials.');
      setIsCredentialsOpen(false);
      setCredentialsUser(null);
      if (propOnRefresh) propOnRefresh();
      else fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update credentials');
    }
  }, [credentialsUser, propOnRefresh, fetchData]);

  const handleEditUser = useCallback((user: Profile) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  }, []);

  const handleSaveUser = useCallback(async (userData: Partial<Profile>) => {
    if (!editingUser) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update(userData as any)
        .eq('id', editingUser.id);
      if (error) throw error;

      toast.success('User updated successfully');
      if (user && editingUser.id === user.id) await refreshProfile();
      setIsEditDialogOpen(false);
      setEditingUser(null);
      if (propOnRefresh) propOnRefresh();
      else fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    }
  }, [editingUser, user, refreshProfile, propOnRefresh, fetchData]);

  // Filter out the current user and super admins from the list
  const displayProfiles = useMemo(() => 
    profiles.filter(p => p.id !== currentProfile?.id && p.role !== 'super_admin'),
    [profiles, currentProfile?.id]
  );

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading user data...</div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 w-full min-w-0">
        <Card className="w-full min-w-0 overflow-hidden">
          <CardHeader className="px-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <UserPlus className="h-5 w-5 shrink-0" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage sub-users and their roles ({displayProfiles.length} users)
                </CardDescription>
              </div>
              <Button onClick={() => setIsCreateOpen(true)} className="flex items-center justify-center gap-2 w-full sm:w-auto shrink-0">
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="grid gap-4">
              {displayProfiles.map((p) => {
                const status = (p as any).status || 'active';
                const isPaused = status === 'paused';
                return (
                  <div key={p.id} className={`border rounded-lg p-3 sm:p-4 min-w-0 ${isPaused ? 'opacity-60 bg-muted/30' : ''}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {p.email || p.user_id}
                        </div>
                        <div className="mt-1 flex gap-2 flex-wrap">
                          <Badge variant="secondary">{p.role}</Badge>
                          <Badge variant={isPaused ? 'destructive' : 'default'}>
                            {status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap sm:shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={isPaused ? 'default' : 'outline'}
                              size="sm"
                              className="p-2"
                              disabled={togglingStatus === p.id}
                              onClick={() => handleToggleStatus(p)}
                            >
                              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>{isPaused ? 'Activate user' : 'Pause user'}</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="p-2" onClick={() => { setCredentialsUser(p); setIsCredentialsOpen(true); }}>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Change email/password</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => handleEditUser(p)} className="p-2">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit user</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="destructive" size="sm" onClick={() => setDeleteUser(p)} className="p-2">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete user</p></TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
              {displayProfiles.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No sub-users yet. Click "Add User" to create one.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Create Sub-User Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Sub-User</DialogTitle>
              <DialogDescription>
                Add a new user to your organization. They will be able to log in immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Enter name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <PasswordInput
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Min 8 chars, uppercase, number, special"
                />
                <PasswordStrengthIndicator password={newUser.password} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser({ ...newUser, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="warehouse">Warehouse staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newUser.role !== 'warehouse' ? (
                <div className="space-y-2">
                  <Label>Shop</Label>
                  <Select value={newUser.shop_id} onValueChange={v => setNewUser({ ...newUser, shop_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a shop</SelectItem>
                      {shops.map(shop => (
                        <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label>Handles all shops</Label>
                    <Switch checked={newUser.warehouse_all_shops}
                      onCheckedChange={v => setNewUser({ ...newUser, warehouse_all_shops: v })} />
                  </div>
                  {!newUser.warehouse_all_shops && (
                    <div className="max-h-40 space-y-2 overflow-y-auto pt-1">
                      {shops.map(shop => (
                        <label key={shop.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={newUser.warehouse_shop_ids.includes(shop.id)}
                            onCheckedChange={(c) => setNewUser({
                              ...newUser,
                              warehouse_shop_ids: c
                                ? [...newUser.warehouse_shop_ids, shop.id]
                                : newUser.warehouse_shop_ids.filter(id => id !== shop.id),
                            })}
                          />
                          {shop.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreateSubUser} disabled={creating} className="flex-1">
                  {creating ? 'Creating...' : 'Create User'}
                </Button>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information and assignments</DialogDescription>
            </DialogHeader>
            {editingUser && (
              <EditUserForm
                user={editingUser}
                shops={shops}
                categories={categories}
                sizes={sizes}
                onSave={handleSaveUser}
                onCancel={() => { setIsEditDialogOpen(false); setEditingUser(null); }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Change Credentials Dialog */}
        <Dialog open={isCredentialsOpen} onOpenChange={(open) => { setIsCredentialsOpen(open); if (!open) setCredentialsUser(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change Credentials
              </DialogTitle>
              <DialogDescription>
                Update email or password for <strong>{credentialsUser?.name}</strong>. The user will be forced to log out and must log in again with the new credentials.
              </DialogDescription>
            </DialogHeader>
            {credentialsUser && (
              <CredentialsForm
                currentEmail={credentialsUser.email || ''}
                onSave={handleSaveCredentials}
                onCancel={() => { setIsCredentialsOpen(false); setCredentialsUser(null); }}
              />
            )}
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog
          open={!!deleteUser}
          onOpenChange={(open) => !open && setDeleteUser(null)}
          onConfirm={handleDelete}
          title="Delete User"
          itemName={deleteUser?.name}
          description={`Are you sure you want to delete "${deleteUser?.name}"? This user will be logged out immediately.`}
          loading={isDeleting}
        />
      </div>
    </TooltipProvider>
  );
};

// Credentials form component
const CredentialsForm = ({ currentEmail, onSave, onCancel }: { currentEmail: string; onSave: (email: string, password: string) => void; onCancel: () => void }) => {
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    await onSave(email, password);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>New Email</Label>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
      </div>
      <div className="space-y-2">
        <Label>New Password <span className="text-xs text-muted-foreground">(leave blank to keep current)</span></Label>
        <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
      </div>
      <div className="p-3 bg-destructive/10 rounded-md text-sm text-destructive">
        ⚠️ The user will be immediately logged out and must log in with the new credentials.
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? 'Updating...' : 'Update Credentials'}
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};

interface EditUserFormProps {
  user: Profile;
  shops: Shop[];
  categories: Category[];
  sizes: Size[];
  onSave: (userData: Partial<Profile>) => void;
  onCancel: () => void;
}

const EditUserForm = ({ user, shops, categories, sizes, onSave, onCancel }: EditUserFormProps) => {
  const [formData, setFormData] = useState({
    name: user.name,
    role: user.role,
    shop_id: user.shop_id || 'none',
    default_category_id: user.default_category_id || 'none',
    default_size_id: user.default_size_id || 'none',
    warehouse_all_shops: (user as any).warehouse_all_shops ?? true,
    warehouse_shop_ids: ((user as any).warehouse_shop_ids || []) as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      warehouse_all_shops: formData.role === 'warehouse' ? formData.warehouse_all_shops : false,
      warehouse_shop_ids: formData.role === 'warehouse' && !formData.warehouse_all_shops ? formData.warehouse_shop_ids : [],
      shop_id: formData.shop_id === 'none' ? null : formData.shop_id,
      default_category_id: formData.default_category_id === 'none' ? null : formData.default_category_id,
      default_size_id: formData.default_size_id === 'none' ? null : formData.default_size_id
    } as any);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="warehouse">Warehouse staff</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {formData.role === 'warehouse' && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label>Handles all shops</Label>
            <Switch checked={formData.warehouse_all_shops}
              onCheckedChange={(v) => setFormData({ ...formData, warehouse_all_shops: v })} />
          </div>
          {!formData.warehouse_all_shops && (
            <div className="max-h-40 space-y-2 overflow-y-auto pt-1">
              {shops.map((shop) => (
                <label key={shop.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formData.warehouse_shop_ids.includes(shop.id)}
                    onCheckedChange={(c) => setFormData({
                      ...formData,
                      warehouse_shop_ids: c
                        ? [...formData.warehouse_shop_ids, shop.id]
                        : formData.warehouse_shop_ids.filter((id) => id !== shop.id),
                    })}
                  />
                  {shop.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="shop">Shop</Label>
        <Select value={formData.shop_id} onValueChange={(value) => setFormData({ ...formData, shop_id: value })}>
          <SelectTrigger><SelectValue placeholder="Select a shop" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Shop</SelectItem>
            {shops.map((shop) => (
              <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Default Category</Label>
        <Select value={formData.default_category_id} onValueChange={(value) => setFormData({ ...formData, default_category_id: value })}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Default</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Default Size</Label>
        <Select value={formData.default_size_id} onValueChange={(value) => setFormData({ ...formData, default_size_id: value })}>
          <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Default</SelectItem>
            {sizes.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">Save Changes</Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};
