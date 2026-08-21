import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSpreadsheet, FileText, Info, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import {
  entriesForFix,
  formatINR,
  type InsightEntry,
  type TopFix,
} from '@/lib/lostSaleInsights';
import { buildFixDrilldownTable, exportTableToExcel, exportTableToPDF } from '@/lib/insightExports';
import { useExportTemplate } from '@/hooks/useExportTemplate';
import { useEvidenceCounts } from '@/hooks/useEntryEvidence';
import { EvidenceDialog } from '@/components/EvidenceDialog';

interface FixDrilldownDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fix: TopFix | null;
  entries: InsightEntry[];
  windowStart?: Date;
  windowEnd?: Date;
}

const ALL = '__all__';

export const FixDrilldownDialog = ({
  open, onOpenChange, fix, entries, windowStart, windowEnd,
}: FixDrilldownDialogProps) => {
  const [shop, setShop] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');
  const [wholeHistory, setWholeHistory] = useState(false);
  const [evidenceEntry, setEvidenceEntry] = useState<InsightEntry | null>(null);
  const { template } = useExportTemplate();

  const base = useMemo(() => {
    if (!fix) return [];
    return entriesForFix(
      entries,
      fix,
      wholeHistory ? undefined : windowStart,
      wholeHistory ? undefined : windowEnd,
    );
  }, [entries, fix, windowStart, windowEnd, wholeHistory]);

  const shops = useMemo(
    () => Array.from(new Set(base.map(e => e.shops?.name).filter(Boolean) as string[])).sort(),
    [base],
  );
  const categories = useMemo(
    () => Array.from(new Set(base.map(e => e.categories?.name).filter(Boolean) as string[])).sort(),
    [base],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return base.filter(e => {
      if (shop !== ALL && (e.shops?.name || '') !== shop) return false;
      if (category !== ALL && (e.categories?.name || '') !== category) return false;
      if (!q) return true;
      return [e.shops?.name, e.categories?.name, e.sizes?.size, e.customer_types?.name, e.employee_name]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [base, shop, category, search]);

  const evidenceCounts = useEvidenceCounts(filtered.map(e => e.id));

  if (!fix) return null;

  const table = buildFixDrilldownTable(fix, filtered);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">{fix.headline}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{fix.action}</p>

          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> Why this ranks here — score {fix.score}
            </p>
            <div className="space-y-1.5">
              {fix.breakdown.map(part => (
                <div key={part.key} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium">{part.label}</span>
                  <span className="text-muted-foreground">{part.explanation}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round(part.normalized * 100)}% × {part.weight} = {Math.round(part.contribution)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={shop} onValueChange={setShop}>
              <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Shop" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All shops</SelectItem>
                {shops.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue placeholder="Reason" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All reasons</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search visits"
              className="h-9 w-[160px] text-xs"
            />
            <Button
              size="sm"
              variant={wholeHistory ? 'default' : 'outline'}
              className="h-9 text-xs"
              onClick={() => setWholeHistory(v => !v)}
            >
              {wholeHistory ? 'All time' : 'This week'}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" className="h-9 gap-1 text-xs" onClick={() => exportTableToExcel(table, template)}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-1 text-xs" onClick={() => exportTableToPDF(table, template)}>
                <FileText className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{filtered.length} visits</Badge>
            <Badge variant="secondary">{Math.round(fix.share * 100)}% of lost visits</Badge>
            {fix.estimatedValue > 0 && <Badge variant="secondary">~{formatINR(fix.estimatedValue)} recoverable</Badge>}
          </div>

          <ScrollArea className="max-h-[45vh] w-full rounded-md border">
            <div className="min-w-[620px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Shop</TableHead>
                    <TableHead className="text-xs">Reason</TableHead>
                    <TableHead className="text-xs">Size</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Reporter</TableHead>
                    <TableHead className="text-xs">Evidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{format(new Date(e.created_at), 'dd MMM, HH:mm')}</TableCell>
                      <TableCell className="text-xs">{e.shops?.name || '—'}</TableCell>
                      <TableCell className="text-xs">{e.categories?.name || '—'}</TableCell>
                      <TableCell className="text-xs">{e.sizes?.size || '—'}</TableCell>
                      <TableCell className="text-xs">{e.customer_types?.name || '—'}</TableCell>
                      <TableCell className="text-xs">{e.employee_name || '—'}</TableCell>
                      <TableCell className="text-xs">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => setEvidenceEntry(e)}
                        >
                          <Paperclip className="h-3 w-3" />
                          {evidenceCounts[e.id] ? `${evidenceCounts[e.id]} file(s)` : 'Attach'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                        No visits match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>

        <EvidenceDialog
          open={!!evidenceEntry}
          onOpenChange={v => !v && setEvidenceEntry(null)}
          entryId={evidenceEntry?.id || null}
          title={evidenceEntry ? `${evidenceEntry.shops?.name || 'Visit'} · ${format(new Date(evidenceEntry.created_at), 'dd MMM')}` : undefined}
        />
      </DialogContent>
    </Dialog>
  );
};
