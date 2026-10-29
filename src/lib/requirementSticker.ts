import QRCode from 'qrcode';
import type { StockRequirement } from '@/hooks/useRequirements';

/** Code encoded in the sticker QR; matched by matchScannedRequirement. */
export const stickerCode = (r: Pick<StockRequirement, 'id'>) => `REQ-${r.id}`;

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function printRequirementStickers(rows: StockRequirement[]) {
  if (!rows.length) return;
  const w = window.open('', '_blank', 'width=420,height=600');
  if (!w) return;
  const labels = await Promise.all(rows.map(async r => {
    const req = await QRCode.toDataURL(stickerCode(r), { margin: 1, width: 220 });
    const size = await QRCode.toDataURL(r.size || '-', { margin: 1, width: 120 });
    return `<div class="l"><img class="q" src="${req}"/><div class="t">
      <b>${esc(r.size || '-')}</b> × ${r.quantity}<br/>${esc((r as any).category || '')}
      <br/><small>${esc(r.shop_name || '')}</small><br/><code>${r.id.slice(0, 8).toUpperCase()}</code>
      <img class="s" src="${size}"/><small>size</small></div></div>`;
  }));
  w.document.write(`<html><head><title>Stock stickers</title><style>
    body{font-family:sans-serif;margin:0}.l{display:flex;gap:8px;border:1px dashed #999;padding:8px;margin:6px;page-break-inside:avoid;width:90mm}
    .q{width:38mm;height:38mm}.s{width:14mm;height:14mm;display:block;margin-top:4px}.t{font-size:12px;line-height:1.35}b{font-size:18px}
  </style></head><body>${labels.join('')}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}
