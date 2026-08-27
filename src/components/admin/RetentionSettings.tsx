import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Archive } from 'lucide-react';
import { useAdminSetting } from '@/hooks/useAdminSetting';
import { SettingsAuditLog } from '@/components/admin/SettingsAuditLog';

interface RetentionPolicy {
  months: number; // 0 = keep forever
  purge_audit_logs: boolean;
}

const KEY = 'retention_policy';
const DEFAULT: RetentionPolicy = { months: 0, purge_audit_logs: false };
const normalize = (raw: any): RetentionPolicy => ({
  months: Math.max(0, Math.min(120, Number(raw?.months || 0))),
  purge_audit_logs: !!raw?.purge_audit_logs,
});

export const RetentionSettings = () => {
  const { value, loading, save, canEdit, reload } = useAdminSetting<RetentionPolicy>(KEY, DEFAULT, normalize);
  const [months, setMonths] = useState<string | null>(null);
  const [purgeAudit, setPurgeAudit] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const curMonths = months ?? String(value.months);
  const curPurge = purgeAudit ?? value.purge_audit_logs;

  const handleSave = async () => {
    try {
      setSaving(true);
      await save({ months: parseInt(curMonths, 10), purge_audit_logs: curPurge }, 'Retention policy updated');
      setMonths(null); setPurgeAudit(null);
      toast.success('Retention policy saved. The nightly purge will apply it automatically.');
    } catch (e) {
      toast.error((e as Error).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Archive className="h-4 w-4 text-primary" /> Data retention
        </CardTitle>
        <CardDescription>
          Automatically delete old visit entries, images, voice notes, evidence and follow-ups after the chosen period. Runs nightly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Keep data for</Label>
            <Select value={curMonths} onValueChange={setMonths} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Forever (no auto-delete)</SelectItem>
                <SelectItem value="3">3 months</SelectItem>
                <SelectItem value="6">6 months</SelectItem>
                <SelectItem value="12">12 months</SelectItem>
                <SelectItem value="24">24 months</SelectItem>
                <SelectItem value="36">36 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Also purge audit logs</p>
              <p className="text-xs text-muted-foreground">Remove audit trail older than the same period.</p>
            </div>
            <Switch checked={curPurge} onCheckedChange={setPurgeAudit} disabled={!canEdit || curMonths === '0'} />
          </div>
        </div>
        {curMonths !== '0' && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Entries older than {curMonths} months will be permanently deleted, including their photos and voice notes. This cannot be undone.
          </p>
        )}
        {canEdit && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? 'Saving…' : 'Save retention policy'}
          </Button>
        )}
        <SettingsAuditLog settingKey={KEY} onRollback={(v) => save(normalize(v), 'Rolled back retention policy')} onRolledBack={reload} />
      </CardContent>
    </Card>
  );
};
