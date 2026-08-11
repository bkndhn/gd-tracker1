import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send } from 'lucide-react';
import {
  buildFollowUpMessage, isValidPhone, normalizePhone, toWaNumber, type FollowUpContext,
} from '@/lib/whatsappFollowUp';

interface Props {
  context: FollowUpContext;
  compact?: boolean;
}

/** Opens WhatsApp with a smart, editable follow-up message for a lost-sale log. */
export const WhatsAppFollowUpButton = ({ context, compact = true }: Props) => {
  const [open, setOpen] = useState(false);
  const defaultText = useMemo(() => buildFollowUpMessage(context), [context]);
  const [text, setText] = useState(defaultText);

  if (!isValidPhone(context.phone)) return null;

  const send = () => {
    window.open(`https://wa.me/${toWaNumber(context.phone)}?text=${encodeURIComponent(text)}`, '_blank');
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
        onClick={() => { setText(defaultText); setOpen(true); }}
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

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[220px] text-sm"
          />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setText(defaultText)}>Reset</Button>
            <Button onClick={send} className="bg-green-600 hover:bg-green-700 text-white">
              <Send className="h-4 w-4 mr-2" /> Open WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
