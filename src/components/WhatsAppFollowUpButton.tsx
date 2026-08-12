import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send } from 'lucide-react';
import {
  buildFollowUpLinkFromText, buildFollowUpMessageWithTemplates, isValidPhone, matchTemplateKey,
  normalizePhone, TEMPLATE_LABELS, type FollowUpContext, type TemplateKey,
} from '@/lib/whatsappFollowUp';
import { useFollowUpTemplates } from '@/hooks/useFollowUpTemplates';

interface Props {
  context: FollowUpContext;
  compact?: boolean;
  /** Optional spike note surfaced by anomaly alerts for this shop/reason */
  anomalyNote?: string;
}

/** Opens WhatsApp with a smart, editable follow-up message for a lost-sale log. */
export const WhatsAppFollowUpButton = ({ context, compact = true, anomalyNote }: Props) => {
  const [open, setOpen] = useState(false);
  const { settings } = useFollowUpTemplates();
  const [templateKey, setTemplateKey] = useState<TemplateKey>(() => matchTemplateKey(context));

  const noteLine = settings.includeAnomalyNote ? anomalyNote : undefined;

  const suggested = useMemo(() => {
    const base = buildFollowUpMessageWithTemplates(context, settings.templates, templateKey, noteLine);
    return settings.signature ? `${base}\n${settings.signature}` : base;
  }, [context, settings, templateKey, noteLine]);

  const [text, setText] = useState(suggested);

  useEffect(() => { if (open) setText(suggested); }, [suggested, open]);

  if (!isValidPhone(context.phone)) return null;

  const send = () => {
    window.open(buildFollowUpLinkFromText(context.phone, text), '_blank', 'noopener,noreferrer');
    setOpen(false);
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-green-600" />
              WhatsApp follow-up
            </DialogTitle>
            <DialogDescription>
              Sending to +91 {normalizePhone(context.phone)} — edit the suggested reply before opening WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
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
        </DialogContent>
      </Dialog>
    </>
  );
};
