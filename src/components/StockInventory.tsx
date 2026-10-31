import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Boxes, Minus, Plus, QrCode, Trash2, Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export interface StockItem {
  id: string; admin_id: string; item: string; size: string; category: string;
  location: string; quantity: number; min_qty: number; updated_by_name: string | null; updated_at: string;
}

export const stockItemCode = (s: Pick<StockItem, 'id'>) => `STK-${s.id}`;
export const isLowStock = (s: Pick<StockItem, 'quantity' | 'min_qty'>) => s.quantity <= Math.max(0, s.min_qty);

const db = () => (supabase as any).from('stock_items');
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function printItemStickers(rows: StockItem[]) {
  const w = window.open('', '_blank', 'width=420,height=600');
  if (!w) return;
  const labels = await Promise.all(rows.map(async r => {
    const qr = await QRCode.toDataURL(stockItemCode(r), { margin: 1, width: 220 });
    return `<div class="l"><img src="${qr}"/><div><b>${esc(r.item || r.size)}</b><br/>Size: ${esc(r.size || '-')}<br/>${esc(r.category)}<br/><small>${esc(r.location)}</small><br/><code>${r.id.slice(0, 8).toUpperCase()}</code></div></div>`;
  }));
  w.document.write(`<html><head><title>Item stickers</title><style>body{font-family:sans-serif;margin:0}.l{display:flex;gap:8px;border:1px dashed #999;padding:8px;margin:6px;width:90mm;page-break-inside:avoid;font-size:12px}img{width:36mm;height:36mm}b{font-size:16px}</style></head><body>${labels.join('')}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}

interface Props { adminId?: string; canEdit: boolean; userName: string; onRequest?: (s: StockItem) => void }

export const StockInventory = ({ adminId, canEdit, userName, onRequest }: Props) => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [draft, setDraft] = useState({ item: '', size: '', category: '', location: '', quantity: '', min_qty: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!adminId) return;
    const { data, error } = await db().select('*').eq('admin_id', adminId).order('item').limit(1000);
    if (error) toast.error('Could not load stock: ' + error.message); else setItems(data || []);
  }, [adminId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!adminId) return;
    const ch = supabase.channel(`stock-items-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items', filter: `admin_id=eq.${adminId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [adminId, load]);

  const shown = useMemo(() => {
    const s = q.toLowerCase();
    return items.filter(r => (!lowOnly || isLowStock(r)) && (!s || `${r.item} ${r.size} ${r.category} ${r.location}`.toLowerCase().includes(s)));
  }, [items, q, lowOnly]);
  const lowCount = items.filter(isLowStock).length;
  const total = items.reduce((a, r) => a + r.quantity, 0);

  const setQty = async (r: StockItem, qty: number) => {
    const quantity = Math.max(0, qty);
    setItems(prev => prev.map(x => x.id === r.id ? { ...x, quantity } : x));
    const { error } = await db().update({ quantity, updated_by_name: userName }).eq('id', r.id);
    if (error) { toast.error('Update failed: ' + error.message); load(); }
  };

  const add = async () => {
    if (!adminId || (!draft.item.trim() && !draft.size.trim())) return toast.error('Enter an item name or size');
    setAdding(true);
    const { error } = await db().insert({
      admin_id: adminId, item: draft.item.trim(), size: draft.size.trim(), category: draft.category.trim(),
      location: draft.location.trim(), quantity: Math.max(0, parseInt(draft.quantity) || 0),
      min_qty: Math.max(0, parseInt(draft.min_qty) || 0), updated_by_name: userName,
    });
    setAdding(false);
    if (error) return toast.error('Could not add: ' + error.message);
    setDraft({ item: '', size: '', category: '', location: '', quantity: '', min_qty: '' });
    toast.success('Item added'); load();
  };

  const remove = async (r: StockItem) => {
    if (!confirm(`Remove ${r.item || r.size} from stock?`)) return;
    const { error } = await db().delete().eq('id', r.id);
    if (error) toast.error(error.message); else setItems(prev => prev.filter(x => x.id !== r.id));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-5 w-5 text-primary" /> Warehouse stock</CardTitle>
        <CardDescription>
          {canEdit ? 'Tap + / − or type a number to update stock. Print a QR sticker for each shelf item.' : 'See what the warehouse has before raising a request.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Items</p><p className="text-xl font-bold">{items.length}</p></div>
          <div className="rounded-xl border bg-accent/30 p-3"><p className="text-xs text-muted-foreground">Units</p><p className="text-xl font-bold">{total.toLocaleString('en-IN')}</p></div>
          <button onClick={() => setLowOnly(v => !v)} className={`rounded-xl border p-3 text-left ${lowOnly ? 'bg-destructive/15 border-destructive' : 'bg-destructive/5'}`}>
            <p className="text-xs text-muted-foreground">Low / out</p><p className="text-xl font-bold text-destructive">{lowCount}</p>
          </button>
        </div>

        {canEdit && (
          <div className="rounded-xl border p-3 space-y-2">
            <p className="text-sm font-semibold">Add item</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Item name" value={draft.item} onChange={e => setDraft({ ...draft, item: e.target.value })} />
              <Input placeholder="Size" value={draft.size} onChange={e => setDraft({ ...draft, size: e.target.value })} />
              <Input placeholder="Category" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} />
              <Input placeholder="Location / rack" value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} />
              <Input type="number" inputMode="numeric" placeholder="Quantity" value={draft.quantity} onChange={e => setDraft({ ...draft, quantity: e.target.value })} />
              <Input type="number" inputMode="numeric" placeholder="Low stock at" value={draft.min_qty} onChange={e => setDraft({ ...draft, min_qty: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 min-h-[48px]" disabled={adding} onClick={add}><Plus className="h-4 w-4 mr-1" /> Add</Button>
              {items.length > 0 && <Button variant="outline" className="min-h-[48px]" onClick={() => printItemStickers(shown)}><QrCode className="h-4 w-4 mr-1" /> Print all</Button>}
            </div>
          </div>
        )}

        <Input placeholder="Search item, size, category, rack…" value={q} onChange={e => setQ(e.target.value)} />
        {shown.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{items.length ? 'No matching items.' : 'No stock added yet.'}</p>}
        <div className="space-y-2">
          {shown.slice(0, 300).map(r => {
            const low = isLowStock(r);
            return (
              <div key={r.id} className={`rounded-xl border p-3 ${low ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.item || r.size}{r.item && r.size ? ` · ${r.size}` : ''}</p>
                    <p className="text-xs text-muted-foreground truncate">{[r.category, r.location].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  {low ? <Badge variant="destructive" className="shrink-0"><AlertTriangle className="h-3 w-3 mr-1" />{r.quantity === 0 ? 'Out' : 'Low'}</Badge>
                    : <Badge variant="secondary" className="shrink-0">In stock</Badge>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {canEdit ? (
                    <>
                      <Button size="icon" variant="outline" className="h-11 w-11" aria-label="Decrease" onClick={() => setQty(r, r.quantity - 1)}><Minus className="h-4 w-4" /></Button>
                      <Input type="number" inputMode="numeric" className="w-20 text-center font-bold" defaultValue={r.quantity} key={r.quantity}
                        onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== r.quantity) setQty(r, v); }} />
                      <Button size="icon" variant="outline" className="h-11 w-11" aria-label="Increase" onClick={() => setQty(r, r.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                      <div className="flex-1" />
                      <Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Print QR sticker" onClick={() => printItemStickers([r])}><QrCode className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-11 w-11 text-destructive" aria-label="Remove" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-bold tabular-nums text-primary">{r.quantity}</span><span className="text-xs text-muted-foreground">available</span>
                      <div className="flex-1" />
                      {onRequest && <Button className="min-h-[44px]" onClick={() => onRequest(r)}><Send className="h-4 w-4 mr-1" /> Request</Button>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
