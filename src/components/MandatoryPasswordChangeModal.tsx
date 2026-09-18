import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePassword } from '@/utils/passwordPolicy';
import { toast } from 'sonner';
import { AppLogo } from '@/components/AppLogo';
import { KeyRound, ShieldCheck, ArrowRight } from 'lucide-react';

export const MandatoryPasswordChangeModal: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if mandatory password change is required
  const mustChange = Boolean(
    user?.user_metadata?.must_change_password ||
    (profile as any)?.must_change_password ||
    user?.user_metadata?.is_temp_password
  );

  if (!mustChange || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast.error(validation.errors[0] || 'Password does not meet security requirements');
      return;
    }

    setLoading(true);
    try {
      // 1. Update Auth user password & clear temporary metadata
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          must_change_password: false,
          is_temp_password: false,
          password_changed_at: new Date().toISOString(),
        },
      });

      if (authError) throw authError;

      // 2. Clear must_change_password flag in profile table
      const { error: profileError } = await (supabase.from('profiles') as any)
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) {
        console.warn('Profile flag update warning:', profileError);
      }

      await refreshProfile();
      toast.success('Your permanent password has been set! Welcome to your tenant workspace.', {
        duration: 5000,
      });
    } catch (err: any) {
      console.error('Password change error:', err);
      toast.error(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent
        className="max-w-md p-6 sm:p-8 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-col items-center text-center space-y-3">
          <AppLogo size="lg" animated />
          <div className="space-y-1">
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
              <KeyRound className="h-5 w-5 text-primary shrink-0" />
              Set Permanent Password
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1">
              Your account was created by the administrator with a temporary password.
              To secure your tenant organization, you must set a permanent password to continue.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="new-temp-password">New Password</Label>
            <PasswordInput
              id="new-temp-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Create strong permanent password"
              autoComplete="new-password"
              disabled={loading}
              autoFocus
            />
            <PasswordStrengthIndicator password={newPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-temp-password">Confirm Password</Label>
            <PasswordInput
              id="confirm-temp-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type your password"
              autoComplete="new-password"
              disabled={loading}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-destructive">Passwords do not match</p>
            )}
          </div>

          <div className="rounded-lg bg-muted/60 p-3 border text-xs text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Once updated, this permanent password will be your official login for all future sessions and sub-user management.
            </span>
          </div>

          <Button
            type="submit"
            className="w-full gap-2 shadow-md"
            disabled={loading || !newPassword || newPassword !== confirmPassword}
          >
            {loading ? 'Securing Account...' : 'Set Password & Access Dashboard'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
