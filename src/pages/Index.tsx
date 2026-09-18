
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { MainApp } from '@/components/MainApp';
import { EmailVerificationPending } from '@/components/EmailVerificationPending';
import { AppLogo } from '@/components/AppLogo';

const Index = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <AppLogo
          size="splash"
          animated
          showText
          subtitle="Lost Sale Insights & Warehouse Fulfillment"
          className="flex-col text-center items-center"
        />
        <div className="mt-8 flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
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
