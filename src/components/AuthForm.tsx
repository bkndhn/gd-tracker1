
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Package, AlertCircle } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/utils/auditLog';
import { validatePassword } from '@/utils/passwordPolicy';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import {
  checkRateLimit,
  recordRateLimitAttempt,
  getRateLimitCooldown,
  type RateLimitAction,
} from '@/utils/rateLimiter';

export const AuthForm = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  // Persistent rate limiting state
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const { signIn, signUp, resetPassword } = useAuth();

  const currentAction: RateLimitAction = isForgotPassword
    ? 'auth:forgot-password'
    : isSignUp
    ? 'auth:signup'
    : 'auth:signin';

  const userIdentifier = formData.email.trim().toLowerCase() || 'anonymous';

  // Live cooldown timer that survives page reloads
  useEffect(() => {
    const updateCooldown = () => {
      const remaining = getRateLimitCooldown(currentAction, userIdentifier);
      setCooldownSeconds(remaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [currentAction, userIdentifier]);

  // Fetch signup visibility setting
  useEffect(() => {
    const fetchSignupSetting = async () => {
      try {
        const { data } = await (supabase.from('app_settings') as any)
          .select('value')
          .eq('key', 'signup_enabled')
          .is('admin_id', null)
          .maybeSingle();
        setSignupEnabled(data?.value === true || data?.value === 'true');
      } catch {
        setSignupEnabled(true); // default to enabled if fetch fails
      }
    };
    fetchSignupSetting();
  }, []);

  const isLocked = cooldownSeconds > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Enforce rate limit check before contacting backend
    const check = checkRateLimit(currentAction, userIdentifier);
    if (!check.allowed) {
      toast.error(check.message || `Too many attempts. Please wait ${check.retryAfterSeconds}s.`);
      setCooldownSeconds(check.retryAfterSeconds);
      return;
    }

    setLoading(true);

    try {
      if (isForgotPassword) {
        if (!formData.email) {
          toast.error('Please enter your email');
          return;
        }
        const { error } = await resetPassword(formData.email);
        if (error) {
          recordRateLimitAttempt(currentAction, userIdentifier, false);
          throw error;
        }
        recordRateLimitAttempt(currentAction, userIdentifier, true);
        toast.success('Password reset email sent! Please check your inbox.');
        setIsForgotPassword(false);
        setFormData({ ...formData, email: '' });
      } else if (isSignUp) {
        const pwValidation = validatePassword(formData.password);
        if (!pwValidation.isValid) {
          toast.error('Password does not meet requirements: ' + pwValidation.errors.join(', '));
          return;
        }
        const { error } = await signUp(formData.email, formData.password, formData.name);
        if (error) {
          recordRateLimitAttempt(currentAction, userIdentifier, false);
          throw error;
        }
        recordRateLimitAttempt(currentAction, userIdentifier, true);
        setSignupSuccess(true);
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          const res = recordRateLimitAttempt(currentAction, userIdentifier, false);
          if (!res.allowed) {
            setCooldownSeconds(res.retryAfterSeconds);
            toast.error(`Too many failed sign-in attempts. Locked for ${res.retryAfterSeconds}s.`);
          }
          throw error;
        }
        recordRateLimitAttempt(currentAction, userIdentifier, true);
        toast.success('Signed in successfully!');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Show success message after admin signup
  if (signupSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-amber-500" />
            </div>
            <CardTitle className="text-2xl text-center">Account Pending Activation</CardTitle>
            <CardDescription className="text-center">
              Your admin account has been created successfully! Please check your email to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Important:</strong> Your account is currently paused and pending activation by the Super Admin. 
                You will be able to log in once your account has been activated.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSignupSuccess(false);
                setIsSignUp(false);
                setFormData({ email: '', password: '', name: '' });
              }}
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <AppLogo size="xl" />
          </div>
          <CardTitle className="text-2xl text-center">
            {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Admin Account' : 'Sign In'}
          </CardTitle>
          <CardDescription className="text-center">
            {isForgotPassword
              ? 'Enter your email to receive a password reset link'
              : isSignUp
              ? 'Register as an admin. Your account will need activation.'
              : 'Enter your email and password to sign in'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {!isSignUp && (
                    <a
                      href="/reset-password"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </a>
                  )}
                </div>
                <PasswordInput
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
                {isSignUp && <PasswordStrengthIndicator password={formData.password} />}
              </div>
            )}

            {isSignUp && !isForgotPassword && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p>✓ Admin accounts require Super Admin activation</p>
                <p>✓ Sub-users are created from within your dashboard</p>
              </div>
            )}

            {isLocked && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                Too many failed attempts. Try again in {cooldownSeconds}s.
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || isLocked}>
              {loading ? 'Loading...' : isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 flex justify-center">
            {isForgotPassword ? (
              <Button
                variant="link"
                onClick={() => {
                  setIsForgotPassword(false);
                  setFormData({ ...formData, email: '' });
                }}
                className="text-sm"
              >
                Back to sign in
              </Button>
            ) : signupEnabled ? (
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-medium text-primary hover:underline"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up as Admin"}
              </button>
            ) : !isSignUp ? null : (
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-sm font-medium text-primary hover:underline"
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
