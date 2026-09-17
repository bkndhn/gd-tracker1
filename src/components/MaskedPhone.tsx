import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logAudit } from '@/utils/auditLog';
import { toast } from 'sonner';

interface MaskedPhoneProps {
  phone: string;
  countryCode?: string;
  context?: string; // e.g., 'follow_up_table', 'reminder_list', 'customer_profile'
  showWhatsAppBtn?: boolean;
  onTimelineClick?: (phone: string) => void;
  className?: string;
}

/**
 * Bank-Grade Customer PII Phone Masking Component
 *
 * Masks customer phone numbers by default (e.g. +91 98••• ••210) to prevent
 * internal staff from harvesting or stealing proprietary client phone lists.
 * Managers and Admins can unmask on demand, which logs an audit entry.
 */
export const MaskedPhone = ({
  phone,
  countryCode = '+91',
  context = 'general',
  showWhatsAppBtn = false,
  onTimelineClick,
  className = '',
}: MaskedPhoneProps) => {
  const { profile } = useAuth();
  const [unmasked, setUnmasked] = useState(false);
  const remaskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const role = (profile as any)?.role;
  const canUnmask = role === 'admin' || role === 'super_admin' || role === 'manager';

  // Clean numeric digits
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const displayDigits = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

  // Format masked representation: e.g. 98••• ••210
  const getMaskedDisplay = () => {
    if (!displayDigits || displayDigits.length < 5) return phone || '—';
    const firstTwo = displayDigits.slice(0, 2);
    const lastThree = displayDigits.slice(-3);
    return `${countryCode} ${firstTwo}••• ••${lastThree}`;
  };

  const getFullDisplay = () => {
    if (!displayDigits) return phone || '—';
    return `${countryCode} ${displayDigits}`;
  };

  const toggleUnmask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canUnmask) {
      toast.error('Only Managers and Admins are authorized to unmask customer phone numbers.');
      return;
    }

    if (!unmasked) {
      // Unmasking: log audit trail
      logAudit({
        action: 'pii_unmask',
        targetType: 'customer_phone',
        targetId: cleanPhone.slice(-4), // Store only last 4 in audit details
        details: {
          context,
          phone_suffix: cleanPhone.slice(-4),
        },
      });

      setUnmasked(true);

      // Auto re-mask after 30 seconds for security
      if (remaskTimerRef.current) clearTimeout(remaskTimerRef.current);
      remaskTimerRef.current = setTimeout(() => {
        setUnmasked(false);
      }, 30_000);
    } else {
      setUnmasked(false);
      if (remaskTimerRef.current) clearTimeout(remaskTimerRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (remaskTimerRef.current) clearTimeout(remaskTimerRef.current);
    };
  }, []);

  const openWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cleanPhone) return;
    const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${waNumber}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`inline-flex items-center gap-1.5 font-mono text-xs ${className}`}>
      {onTimelineClick ? (
        <button
          type="button"
          onClick={() => onTimelineClick(cleanPhone)}
          className="hover:underline underline-offset-2 font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
          title="View customer timeline"
        >
          {unmasked ? getFullDisplay() : getMaskedDisplay()}
        </button>
      ) : (
        <span className="font-medium text-foreground select-all">
          {unmasked ? getFullDisplay() : getMaskedDisplay()}
        </span>
      )}

      {canUnmask && (
        <button
          type="button"
          onClick={toggleUnmask}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={unmasked ? 'Hide phone number' : 'Unmask phone number (Logs audit event)'}
          aria-label={unmasked ? 'Hide phone number' : 'Unmask phone number'}
        >
          {unmasked ? (
            <EyeOff className="h-3 w-3 text-amber-500" />
          ) : (
            <Eye className="h-3 w-3 text-muted-foreground/70 hover:text-foreground" />
          )}
        </button>
      )}

      {showWhatsAppBtn && cleanPhone && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 p-0"
          onClick={openWhatsApp}
          title="Direct WhatsApp"
        >
          <MessageSquare className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};
