import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { fetchCustomValueIndex } from '@/hooks/useEntryCustomValues';
import { formatISTDateTime } from '@/lib/dateUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: 'pdf' | 'excel';
  /** Ordered field IDs selected for this export target */
  fieldIds: string[];
  fieldNames: Record<string, string>;
}

interface PreviewRow {
  date: string;
  reporter: string;
  values: Record<string, string>;
  notes: string;
}

export const ExportPreviewDialog = ({ open, onOpenChange, target, fieldIds, fieldNames }: Props) => {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data: entries, error } = await supabase
          .from('goods_damaged_entries')
          .select('id, created_at, employee_name, notes')
          .order('created_at', { ascending: false })
          .limit(5);
        if (error) throw error;

        const index = await fetchCustomValueIndex((entries || []).map(e => e.id));
        if (cancelled) return;

        setRows(
          (entries || []).map(e => ({
            date: formatISTDateTime(e.created_at),
            reporter: e.employee_name || '—',
            notes: e.notes || '',
            values: index.valuesByEntry[e.id] || {},
          }))
        );
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Export Preview
            <Badge variant="secondary" className="uppercase">{target}</Badge>
          </DialogTitle>
          <DialogDescription>
            Columns appear exactly in this order in the generated {target === 'pdf' ? 'PDF' : 'Excel'} file.
            Showing your 5 most recent entries as sample data.
          </DialogDescription>
        </DialogHeader>

        {fieldIds.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">
            No fields selected for this export.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">DATE</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">REPORTER</th>
                  {fieldIds.map(id => (
                    <th key={id} className="text-left px-3 py-2 font-semibold whitespace-nowrap uppercase">
                      {fieldNames[id] || 'Field'}
                    </th>
                  ))}
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">NOTES</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={fieldIds.length + 3} className="px-3 py-6 text-center text-muted-foreground">Loading preview…</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={fieldIds.length + 3} className="px-3 py-6 text-center text-muted-foreground">No entries yet — headers shown above.</td></tr>
                )}
                {!loading && rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.reporter}</td>
                    {fieldIds.map(id => (
                      <td key={id} className="px-3 py-2 whitespace-nowrap">{r.values[id] || '—'}</td>
                    ))}
                    <td className="px-3 py-2 max-w-[240px] truncate">{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
