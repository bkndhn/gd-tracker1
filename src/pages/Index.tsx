
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { MainApp } from '@/components/MainApp';
import { EmailVerificationPending } from '@/components/EmailVerificationPending';

const Index = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/15 animate-ping absolute inset-0" />
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25 z-10">
            <span className="text-xl font-black text-primary-foreground tracking-wider">GD</span>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center gap-2">
          <h2 className="text-base font-semibold text-foreground tracking-wide">GD Tracker</h2>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthForm />;

  // Check email verification - skip for sub-users created by admin (they won't have email_confirmed_at but are trusted)
  const isEmailVerified = user.email_confirmed_at != null;
  const isSubUser = user.app_metadata?.admin_id != null;
  
  if (!isEmailVerified && !isSubUser) {
    return <EmailVerificationPending email={user.email || ''} onSignOut={signOut} />;
  }

  return <MainApp />;
};

export default Index;
