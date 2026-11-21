import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Package, CheckCircle2, Truck, TrendingUp } from 'lucide-react';

type Counts = { requests: number; packed: number; moved: number; lost: number };

/** Live 30-day totals shown at the top of the Dashboard (data access follows each user's permissions). */
export function LiveStatCards() {
  const [c, setC] = useState<Counts | null>(null);
  useEffect(() => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
    const req = () => supabase.from('stock_requirements').select('id', { count: 'exact', head: true }).gte('created_at', since);
    Promise.all([
      count(req()),
      count(req().not('packed_at', 'is', null)),
      count(req().not('moved_at', 'is', null)),
      count(supabase.from('goods_damaged_entries').select('id', { count: 'exact', head: true }).gte('created_at', since)),
    ]).then(([requests, packed, moved, lost]) => setC({ requests, packed, moved, lost })).catch(() => setC(null));
  }, []);

  const items = [
    { label: 'Requests', value: c?.requests, icon: Package, tone: 'bg-primary/15 text-primary' },
    { label: 'Packed', value: c?.packed, icon: CheckCircle2, tone: 'bg-accent/30 text-accent-foreground' },
    { label: 'Moved', value: c?.moved, icon: Truck, tone: 'bg-secondary text-secondary-foreground' },
    { label: 'Lost sales', value: c?.lost, icon: TrendingUp, tone: 'bg-destructive/15 text-destructive' },
  ];
  return (
    <section className="mb-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Last 30 days</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="rounded-2xl p-4">
            <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
            <p className="text-3xl font-bold tabular-nums">{value ?? '–'}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
