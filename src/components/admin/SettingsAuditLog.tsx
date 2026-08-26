import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { History, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

export interface SettingsAuditRow {
  id: string;
  setting_key: string;
  changed_by_name: string | null;
  old_value: any;
  new_value: any;
  note: string | null;
  created_at: string;
}

interface DiffLine {
  path: string;
  from: string;
  to: string;
}

const flatten = (value: any, prefix = ''): Record<string, string> => {
  if (value === null || value === undefined) return prefix ? { [prefix]: '—' } : {};
  if (typeof value !== 'object') return { [prefix || 'value']: String(value) };
  const out: Record<string, string> = {};
  Object.entries(value).forEach(([k, v]) => {
    Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
  });
  return out;
};

export function diffValues(oldValue: any, newValue: any): DiffLine[] {
  const a = flatten(oldValue);
  const b = flatten(newValue);
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  return keys
    .filter(k => (a[k] ?? '—') !== (b[k] ?? '—'))
    .map(k => ({ path: k, from: a[k] ?? '—', to: b[k] ?? '—' }));
}

interface SettingsAuditLogProps {
  settingKey: string;
  /** Called after a rollback so the owning panel can refresh its value */
  onRolledBack?: () => void;
  /** Persist a rolled-back value (usually the setting hook's save) */
  onRollback: (value: any) => Promise<unknown>;
  limit?: number;
}

/** Who changed a setting, when, with a field-level diff and one-tap rollback. */
export const SettingsAuditLog = ({ settingKey, onRollback, onRolledBack, limit = 20 }: SettingsAuditLogProps) => {
  const { profile } = useAuth();
  const [rows, setRows] = useState<SettingsAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const role = (profile as any)?.role;
  const adminId = role === 'admin' || role === 'super_admin' ? profile?.id : (profile as any)?.admin_id;

  const load = useCallback(async () => {
    if (!adminId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase.from('settings_audit_log') as any)
        .select('*')
        .eq('admin_id', adminId)
        .eq('setting_key', settingKey)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      setRows((data || []) as SettingsAuditRow[]);
    } catch (e) {
      if (import.meta.env.DEV) console.error('SettingsAuditLog load', e);
    } finally {
      setLoading(false);
    }
  }, [adminId, settingKey, limit]);

  useEffect(() => { load(); }, [load]);

  const rollback = async (row: SettingsAuditRow) => {
    const target = row.old_value ?? null;
    if (target === null) { toast.error('No previous value to restore'); return; }
    try {
      setBusyId(row.id);
      await onRollback(target);
      toast.success('Rolled back to the previous values');
      await load();
      onRolledBack?.();
    } catch (e) {
      toast.error((e as Error).message || 'Rollback failed');
    } finally {
      setBusyId(null);
    }
  };

  if (!adminId) return null;

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <History className="h-4 w-4 text-primary" /> Change history
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No changes recorded yet.</p>
      ) : (
        <ScrollArea className="max-h-72 w-full pr-2">
          <div className="space-y-2">
            {rows.map(row => {
              const diff = diffValues(row.old_value, row.new_value);
              return (
                <div key={row.id} className="rounded-lg border p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-medium">{row.changed_by_name || 'Unknown user'}</span>
                      <span className="text-muted-foreground">
                        {' '}· {format(new Date(row.created_at), 'dd MMM yyyy, HH:mm')}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      disabled={busyId === row.id || row.old_value == null}
                      onClick={() => rollback(row)}
                    >
                      <RotateCcw className="h-3 w-3" /> Roll back
                    </Button>
                  </div>
                  {row.note && <p className="mt-1 text-[11px] text-muted-foreground">{row.note}</p>}
                  {diff.length === 0 ? (
                    <Badge variant="secondary" className="mt-2 text-[10px]">No field changes</Badge>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded-md border">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="p-1.5 text-left font-medium">Field</th>
                            <th className="p-1.5 text-left font-medium">Before</th>
                            <th className="p-1.5 text-left font-medium">After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diff.map(d => (
                            <tr key={d.path} className="border-t">
                              <td className="p-1.5 font-medium">{d.path}</td>
                              <td className="p-1.5 text-destructive line-through">{d.from}</td>
                              <td className="p-1.5 text-emerald-600 dark:text-emerald-400">{d.to}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
