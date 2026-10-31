import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Save, AlertTriangle, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { parseStockRows, type StockLevelRow } from '@/lib/stockImport';
import { formatISTDateTime } from '@/lib/dateUtils';

interface Stored { rows: StockLevelRow[]; uploaded_by: string; uploaded_at: string; file: string }

export const StockLevelsImport = ({ adminId, canSave, userName }: { adminId?: string; canSave: boolean; userName: string }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ rows: StockLevelRow[]; errors: string[]; file: string } | null>(null);
  const [current, setCurrent] = useState<Stored | null>(null);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!adminId) return;
    supabase.from('app_settings').select('value').eq('admin_id', adminId).eq('key', 'stock_levels').maybeSingle()
      .then(({ data }) => data?.value && setCurrent(data.value as unknown as Stored));
  }, [adminId]);

  const onFile = async (f: File) => {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const sheet = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
      setPreview({ ...parseStockRows(sheet), file: f.name });
    } catch {
      toast.error('Could not read this file. Use Excel (.xlsx/.xls) or CSV.');
    }
  };

  const save = async () => {
    if (!preview || !adminId) return;
    setSaving(true);
    const value: Stored = { rows: preview.rows, uploaded_by: userName, uploaded_at: new Date().toISOString(), file: preview.file };
    const { data: existing } = await supabase.from('app_settings').select('id').eq('admin_id', adminId).eq('key', 'stock_levels').maybeSingle();
    const res = existing
      ? await supabase.from('app_settings').update({ value: value as any }).eq('id', existing.id)
      : await supabase.from('app_settings').insert({ admin_id: adminId, key: 'stock_levels', value: value as any });
    if (res.error) { setSaving(false); return toast.error('Save failed: ' + res.error.message); }
    // Also push quantities into warehouse stock so shop staff and the queue see them.
    const sb = supabase as any;
    const { data: ex } = await sb.from('stock_items').select('id,item,size,location').eq('admin_id', adminId).limit(5000);
    const { updates, inserts } = planStockMerge(preview.rows, ex || []);
    let failed = 0;
    for (const u of updates) {
      const { error } = await sb.from('stock_items').update({ quantity: u.quantity, updated_by_name: userName }).eq('id', u.id);
      if (error) failed++;
    }
    if (inserts.length) {
      const { error } = await sb.from('stock_items').insert(inserts.map((r) => ({
        admin_id: adminId, item: r.item || '', size: r.size || '', category: r.category || '', location: r.location || '',
        quantity: r.quantity, min_qty: 0, updated_by_name: userName,
      })));
      if (error) failed += inserts.length;
    }
    setSaving(false);
    setCurrent(value); setPreview(null);
    if (failed) toast.warning(`Saved, but ${failed} lines could not update warehouse stock`);
    else toast.success(`${value.rows.length} lines saved · ${updates.length} updated, ${inserts.length} new in Stock`);
  };

  const shown = useMemo(() => {
    const rows = preview?.rows ?? current?.rows ?? [];
    const s = q.toLowerCase();
    return s ? rows.filter((r) => `${r.item} ${r.size} ${r.category} ${r.location}`.toLowerCase().includes(s)) : rows;
  }, [preview, current, q]);
  const total = shown.reduce((a, r) => a + r.quantity, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-5 w-5 text-primary" /> Stock levels</CardTitle>
        <CardDescription>
          Upload an Excel/CSV sheet or a Tally "Stock Summary" export. Columns: Item, Size, Category/Group, Quantity, Godown/Location.
          {current && !preview && <> Last upload: {current.file} by {current.uploaded_by}, {formatISTDateTime(current.uploaded_at)}.</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="min-h-[48px]" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Choose file</Button>
          {preview && (
            <>
              <Button className="min-h-[48px]" disabled={!canSave || saving || preview.rows.length === 0} onClick={save}>
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : `Save ${preview.rows.length} lines`}
              </Button>
              <Button variant="ghost" className="min-h-[48px]" onClick={() => setPreview(null)}>Cancel</Button>
            </>
          )}
        </div>
        {preview && !canSave && <p className="text-sm text-muted-foreground">Preview only — an admin must save stock uploads.</p>}
        {preview && preview.errors.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-1 max-h-32 overflow-auto">
            <p className="font-semibold flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" /> {preview.errors.length} rows skipped</p>
            {preview.errors.slice(0, 20).map((e) => <p key={e}>{e}</p>)}
          </div>
        )}
        {(preview || current) && (
          <>
            <Input placeholder="Search item, size, location…" value={q} onChange={(e) => setQ(e.target.value)} />
            <p className="text-sm text-muted-foreground">{shown.length} lines · {total.toLocaleString('en-IN')} units {preview && '(preview)'}</p>
            <div className="max-h-80 overflow-auto rounded-lg border divide-y">
              {shown.slice(0, 300).map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-3 min-h-[52px]">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.item || r.size}{r.item && r.size ? ` · ${r.size}` : ''}</p>
                    <p className="text-xs text-muted-foreground truncate">{[r.category, r.location].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className={`font-bold tabular-nums ${r.quantity === 0 ? 'text-destructive' : 'text-primary'}`}>{r.quantity}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
