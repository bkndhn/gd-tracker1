import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanLine, Keyboard } from 'lucide-react';
import type { StockRequirement } from '@/hooks/useRequirements';

/** Find the requirement a scanned code refers to: full id, short id (first 8 chars), or size code (oldest requested). */
export const matchScannedRequirement = (code: string, rows: StockRequirement[]): StockRequirement | null => {
  const c = code.trim().toLowerCase();
  if (!c) return null;
  const open = rows.filter(r => r.status === 'requested');
  const byId = open.find(r => r.id.toLowerCase() === c || r.id.toLowerCase().startsWith(c.replace(/^req-/, '')) && c.replace(/^req-/, '').length >= 6);
  if (byId) return byId;
  const bySize = open
    .filter(r => (r.size || '').toLowerCase() === c)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return bySize[0] || null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rows: StockRequirement[];
  onMatch: (req: StockRequirement) => Promise<boolean>;
}

const REGION_ID = 'req-scanner-region';

export const RequirementScanner = ({ open, onOpenChange, rows, onMatch }: Props) => {
  const scannerRef = useRef<any>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; t: number }>({ code: '', t: 0 });
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'err' | 'idle'; text: string }>({ tone: 'idle', text: 'Point the camera at a request QR or size barcode' });
  const [camError, setCamError] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const handleCode = async (code: string) => {
    const now = Date.now();
    if (busyRef.current || (lastRef.current.code === code && now - lastRef.current.t < 2500)) return;
    lastRef.current = { code, t: now };
    const req = matchScannedRequirement(code, rowsRef.current);
    if (!req) {
      setStatus({ tone: 'err', text: `No open request for "${code}"` });
      navigator.vibrate?.([60, 40, 60]);
      return;
    }
    busyRef.current = true;
    const ok = await onMatch(req);
    busyRef.current = false;
    if (ok) {
      navigator.vibrate?.(80);
      setStatus({ tone: 'ok', text: `Packed: ${req.size} × ${req.quantity} for ${req.shop_name || 'shop'}` });
    } else {
      setStatus({ tone: 'err', text: 'Could not mark as packed' });
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCamError(null);
    const start = async () => {
      await new Promise(r => setTimeout(r, 150));
      if (cancelled || !document.getElementById(REGION_ID)) return;
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const s = new Html5Qrcode(REGION_ID, { verbose: false } as any);
        scannerRef.current = s;
        await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 160 } }, (text) => handleCode(text), () => {});
      } catch (e: any) {
        if (!cancelled) setCamError(e?.message || 'Camera not available — type the code below');
      }
    };
    start();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (!s) return;
      try {
        if (s.isScanning) {
          Promise.resolve(s.stop()).then(() => { try { s.clear(); } catch { /* noop */ } }).catch(() => {});
        } else {
          try { s.clear(); } catch { /* noop */ }
        }
      } catch { /* scanner never started */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" /> Scan to pack</DialogTitle>
          <DialogDescription>Each successful scan marks the matching request as packed.</DialogDescription>
        </DialogHeader>
        <div id={REGION_ID} className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted" />
        {camError && <p className="text-xs text-destructive">{camError}</p>}
        <div className={`rounded-lg px-3 py-2 text-sm font-medium ${status.tone === 'ok' ? 'bg-primary/10 text-primary' : status.tone === 'err' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
          {status.text}
        </div>
        <form
          className="flex gap-2"
          onSubmit={e => { e.preventDefault(); if (manual.trim()) { lastRef.current = { code: '', t: 0 }; handleCode(manual.trim()); setManual(''); } }}
        >
          <div className="relative flex-1">
            <Keyboard className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={manual} onChange={e => setManual(e.target.value)} placeholder="Request ID or size code" className="pl-8 h-11" />
          </div>
          <Button type="submit" className="h-11">Pack</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
