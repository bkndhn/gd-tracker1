import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Package, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Detect recovery mode. Supabase may deliver the session as:
  //  - hash tokens (#access_token=...), possibly already consumed by detectSessionInUrl
  //  - a PKCE code (?code=...)
  //  - a token_hash / OTP link (?token_hash=...&type=recovery)
  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setIsRecovery(true);
        setSessionReady(true);
        setError('');
      }
    });

    const init = async () => {
      const hash = window.location.hash || '';
      const search = new URLSearchParams(window.location.search);

      const errDesc = search.get('error_description') || new URLSearchParams(hash.replace('#', '')).get('error_description');
      if (errDesc) {
        setIsRecovery(true);
        setError(decodeURIComponent(errDesc).includes('expired')
          ? 'Reset link expired. Please request a new one.'
          : 'Reset link is invalid. Please request a new one.');
        return;
      }

      if (hash.includes('access_token')) {
        setIsRecovery(true);
        await setupSessionFromHash(hash);
        return;
      }

      const code = search.get('code');
      if (code) {
        setIsRecovery(true);
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setError('Reset link is invalid or expired. Please request a new one.');
          return;
        }
        window.history.replaceState(null, '', window.location.pathname);
        setSessionReady(true);
        return;
      }

      const tokenHash = search.get('token_hash');
      if (tokenHash) {
        setIsRecovery(true);
        const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
        if (cancelled) return;
        if (error) {
          setError('Reset link is invalid or expired. Please request a new one.');
          return;
        }
        window.history.replaceState(null, '', window.location.pathname);
        setSessionReady(true);
        return;
      }

      // Hash may already have been consumed by the Supabase client on load.
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        setIsRecovery(true);
        setSessionReady(true);
      }
    };

    init();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setupSessionFromHash = async (hash: string) => {
    try {
      const params = new URLSearchParams(hash.replace('#', ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        setError('Reset link is invalid. Please request a new one.');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        if (error.message.includes('expired')) {
          setError('Reset link expired. Please request a new one.');
        } else {
          setError('Reset link is invalid. Please request a new one.');
        }
        return;
      }

      window.history.replaceState(null, '', window.location.pathname);
      setSessionReady(true);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error setting up session:', err);
      setError('Reset link is invalid. Please request a new one.');
    }
  };


  // Handle Forgot Password - send reset email
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!email) {
        setError('Please enter your email');
        return;
      }

      // Use the Vercel production URL for password reset redirects
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast.success('Reset link sent to your email.');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  // Handle Reset Password - update password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      
      // Clear URL hash
      window.history.replaceState(null, '', window.location.pathname);
      
      // Sign out to ensure clean slate
      await supabase.auth.signOut();
      
      // Redirect to login
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">
            {isRecovery ? 'Reset Password' : 'Forgot Password'}
          </CardTitle>
          <CardDescription className="text-center">
            {isRecovery
              ? 'Enter your new password below'
              : 'Enter your email to receive a password reset link'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {/* Mode 1: Forgot Password Form */}
          {!isRecovery && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          )}

          {/* Mode 2: Reset Password Form */}
          {isRecovery && (
            <>
              {!sessionReady && !error && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Verifying reset link...</p>
                </div>
              )}

              {sessionReady && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <PasswordInput
                      id="newPassword"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum 8 characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <PasswordInput
                      id="confirmPassword"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              )}

              {error && (
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => {
                    setIsRecovery(false);
                    setError('');
                    window.history.replaceState(null, '', window.location.pathname);
                  }}
                >
                  Request New Reset Link
                </Button>
              )}
            </>
          )}

          {/* Back to login link */}
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => navigate('/')}
              className="text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
