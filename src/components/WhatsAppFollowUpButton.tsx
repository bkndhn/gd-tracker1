import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildFollowUpLinkFromText, buildFollowUpMessageWithTemplates, isValidPhone, matchTemplateKey,
  normalizePhone, TEMPLATE_LABELS, TEMPLATE_LOCALE_LABELS,
  type FollowUpContext, type TemplateKey, type TemplateLocale,
} from '@/lib/whatsappFollowUp';
import { useFollowUpTemplates } from '@/hooks/useFollowUpTemplates';
import { useLogFollowUp, OUTCOME_LABELS, type FollowUpOutcome } from '@/hooks/useFollowUps';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  context: FollowUpContext;
  compact?: boolean;
  /** Optional spike note surfaced by anomaly alerts for this shop/reason */
  anomalyNote?: string;
  entryId?: string | null;
  shopId?: string | null;
}

/** Opens WhatsApp with a smart, editable follow-up message and tracks the outcome. */
export const WhatsAppFollowUpButton = ({ context, compact = true, anomalyNote, entryId, shopId }: Props) => {
  const [open, setOpen] = useState(false);
  const { settings } = useFollowUpTemplates();
  const logFollowUp = useLogFollowUp();
  const [templateKey, setTemplateKey] = useState<TemplateKey>(() => matchTemplateKey(context));
  const [locale, setLocale] = useState<TemplateLocale>(settings.locale);
  const [step, setStep] = useState<'compose' | 'outcome'>('compose');
  const [logId, setLogId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<FollowUpOutcome>('pending');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { setLocale(settings.locale); }, [settings.locale]);

  const noteLine = settings.includeAnomalyNote ? anomalyNote : undefined;

  const suggested = useMemo(() => {
    const set = settings.templatesByLocale?.[locale] || settings.templates;
    const base = buildFollowUpMessageWithTemplates(context, set, templateKey, noteLine);
    return settings.signature ? `${base}\n${settings.signature}` : base;
  }, [context, settings, templateKey, noteLine, locale]);

  const [text, setText] = useState(suggested);

  useEffect(() => { if (open && step === 'compose') setText(suggested); }, [suggested, open, step]);

  if (!isValidPhone(context.phone)) return null;

  const send = async () => {
    window.open(buildFollowUpLinkFromText(context.phone, text), '_blank', 'noopener,noreferrer');
    const id = await logFollowUp({
      entryId,
      shopId,
      shopName: context.shopName,
      phone: normalizePhone(context.phone),
      reasonLabel: context.reason,
      templateKey,
      message: text,
      reminderDays: settings.reminderDays,
    });
    setLogId(id);
    setStep('outcome');
  };

  const saveOutcome = async () => {
    if (!logId) { setOpen(false); return; }
    const { error } = await (supabase.from('follow_ups') as any)
      .update({
        outcome,
        recovered_amount: outcome === 'converted' ? Number(amount || 0) : 0,
        outcome_note: note || null,
        outcome_at: new Date().toISOString(),
        next_reminder_at: outcome === 'pending'
          ? new Date(Date.now() + settings.reminderDays * 86400000).toISOString()
          : null,
      })
      .eq('id', logId);
    if (error) toast.error('Could not save outcome');
    else toast.success('Follow-up outcome saved');
    close();
  };

  const close = () => {
    setOpen(false);
    setTimeout(() => { setStep('compose'); setLogId(null); setOutcome('pending'); setAmount(''); setNote(''); }, 200);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
        className="text-green-600 hover:text-green-700 hover:bg-green-500/10"
        title={`Follow up on WhatsApp (${normalizePhone(context.phone)})`}
        onClick={() => { setTemplateKey(matchTemplateKey(context)); setOpen(true); }}
      >
        <MessageCircle className="h-4 w-4" />
        {!compact && <span className="ml-2">Follow up</span>}
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-green-600" />
              {step === 'compose' ? 'WhatsApp follow-up' : 'What happened?'}
            </DialogTitle>
            <DialogDescription>
              {step === 'compose'
                ? `Sending to +91 ${normalizePhone(context.phone)} — edit the suggested reply before opening WhatsApp.`
                : 'Record the outcome so recovered revenue and reminders stay accurate.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'compose' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Smart reply template</Label>
                  <Select value={templateKey} onValueChange={(v) => setTemplateKey(v as TemplateKey)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map(k => (
                        <SelectItem key={k} value={k}>{TEMPLATE_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Language</Label>
                  <Select value={locale} onValueChange={(v) => setLocale(v as TemplateLocale)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TEMPLATE_LOCALE_LABELS) as TemplateLocale[]).map(l => (
                        <SelectItem key={l} value={l}>{TEMPLATE_LOCALE_LABELS[l]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[200px] text-sm"
              />

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setText(suggested)}>Reset</Button>
                <Button onClick={send} className="bg-green-600 hover:bg-green-700 text-white">
                  <Send className="h-4 w-4 mr-2" /> Open WhatsApp
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Outcome</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v as FollowUpOutcome)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OUTCOME_LABELS) as FollowUpOutcome[]).map(k => (
                      <SelectItem key={k} value={k}>{OUTCOME_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {outcome === 'converted' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Recovered sale amount (₹)</Label>
                  <Input
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="e.g. 2500"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Note (optional)</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[70px] text-sm" />
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={close}>Decide later</Button>
                <Button onClick={saveOutcome}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Save outcome
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
