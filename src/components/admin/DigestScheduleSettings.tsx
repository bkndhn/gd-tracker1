import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CalendarClock } from 'lucide-react';
import { useDigestSchedule, WEEKDAYS, type DigestSchedule } from '@/hooks/useDigestSchedule';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Colombo', 'Asia/Singapore', 'Europe/London', 'UTC'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export const DigestScheduleSettings = () => {
  const { schedule, loading, save, canEdit } = useDigestSchedule();
  const [draft, setDraft] = useState<DigestSchedule>(schedule);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(schedule); }, [schedule]);

  if (!canEdit) return null;

  const commit = async () => {
    try {
      setSaving(true);
      await save(draft, 'Weekly digest schedule updated');
      toast.success('Digest schedule saved');
    } catch (e) {
      toast.error((e as Error).message || 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" /> Weekly digest schedule
        </CardTitle>
        <CardDescription>
          Choose the day and time your weekly Top 3 Fixes + Stock &amp; Size Gap digest is emailed and posted in-app.
          The scheduler checks hourly and delivers within your selected hour.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Day</Label>
                <Select value={String(draft.weekday)} onValueChange={v => setDraft(d => ({ ...d, weekday: Number(v) }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((w, i) => <SelectItem key={w} value={String(i)}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hour</Label>
                <Select value={String(draft.hour)} onValueChange={v => setDraft(d => ({ ...d, hour: Number(v) }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {HOURS.map(h => <SelectItem key={h} value={String(h)}>{pad(h)}:00</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Minute</Label>
                <Select value={String(draft.minute)} onValueChange={v => setDraft(d => ({ ...d, minute: Number(v) }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MINUTES.map(m => <SelectItem key={m} value={String(m)}>:{pad(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Timezone</Label>
                <Select value={draft.timezone} onValueChange={v => setDraft(d => ({ ...d, timezone: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={draft.emailEnabled}
                  onCheckedChange={v => setDraft(d => ({ ...d, emailEnabled: v }))}
                />
                <Label className="text-xs">Email me the digest</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={draft.inAppEnabled}
                  onCheckedChange={v => setDraft(d => ({ ...d, inAppEnabled: v }))}
                />
                <Label className="text-xs">Show in-app notification</Label>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Next delivery: {WEEKDAYS[draft.weekday]} at {pad(draft.hour)}:{pad(draft.minute)} ({draft.timezone})
            </p>

            <Button size="sm" onClick={commit} disabled={saving}>
              {saving ? 'Saving…' : 'Save schedule'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
