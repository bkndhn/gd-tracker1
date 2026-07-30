import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Mail, Send, ServerCog } from 'lucide-react';
import { captureException } from '@/lib/errorTracking';

interface Props {
  /** ISO strings for the active report window, if any */
  from?: string;
  to?: string;
  /** Ordered custom field ids to use as columns */
  fieldIds?: string[];
  /** Row count currently in view, for the helper copy */
  rowCount?: number;
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Hands the whole export off to an edge function: it queries, builds the file
 * server-side and emails it as an attachment. Nothing is rendered or held in
 * browser memory, so report size is no longer bound by the device.
 */
export const ServerExportDialog = ({ from, to, fieldIds, rowCount }: Props) => {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [extra, setExtra] = useState('');
  const [sending, setSending] = useState(false);

  const recipients = extra
    .split(/[,;\s]+/)
    .map(r => r.trim())
    .filter(Boolean);
  const invalid = recipients.filter(r => !emailRe.test(r));

  const send = async () => {
    if (invalid.length) {
      toast.error(`Invalid email: ${invalid[0]}`);
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-report-email', {
        body: { from, to, fieldIds, recipients, format },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const rows = (data as any)?.rows ?? 0;
      toast.success(`Report emailed — ${rows} rows sent to ${(data as any)?.recipients?.length || 1} recipient(s)`);
      setOpen(false);
      setExtra('');
    } catch (e: any) {
      void captureException(e, { kind: 'server-export' });
      toast.error(e?.message || 'Could not generate the report');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <Mail className="h-4 w-4" />
          <span className="hidden sm:inline">Email full report</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-primary" /> Server-side export
          </DialogTitle>
          <DialogDescription>
            Built on the server and delivered by email — use this for very large reports that would be slow to
            generate in the browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="flex justify-between py-0.5">
              <span>Date range</span>
              <strong className="text-foreground">
                {from || to
                  ? `${from ? new Date(from).toLocaleDateString('en-GB') : 'start'} – ${to ? new Date(to).toLocaleDateString('en-GB') : 'today'}`
                  : 'All time'}
              </strong>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Columns</span>
              <strong className="text-foreground">{fieldIds?.length ?? 0} fields + reporter & notes</strong>
            </div>
            {typeof rowCount === 'number' && (
              <div className="flex justify-between py-0.5">
                <span>Rows in view</span>
                <strong className="text-foreground">{rowCount}</strong>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>File format</Label>
            <Select value={format} onValueChange={v => setFormat(v as 'xlsx' | 'csv')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Additional recipients (optional)</Label>
            <Input
              placeholder="ops@company.com, owner@company.com"
              value={extra}
              maxLength={400}
              onChange={e => setExtra(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your own address is always included. Up to 10 recipients.
            </p>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {recipients.map(r => (
                  <Badge key={r} variant={emailRe.test(r) ? 'secondary' : 'destructive'} className="text-[10px]">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button size="sm" onClick={send} disabled={sending || invalid.length > 0} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Generating…' : 'Generate & email'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
