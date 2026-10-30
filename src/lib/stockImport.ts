export interface StockLevelRow {
  item: string;
  category: string;
  size: string;
  quantity: number;
  location: string;
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

// Header aliases cover plain Excel sheets and Tally "Stock Summary" exports.
const ALIASES: Record<keyof StockLevelRow, string[]> = {
  item: ['item', 'itemname', 'product', 'productname', 'particulars', 'stockitem', 'name'],
  category: ['category', 'group', 'stockgroup', 'under'],
  size: ['size', 'variant', 'sizecode'],
  quantity: ['quantity', 'qty', 'closingquantity', 'closingqty', 'closingbalance', 'stock', 'balance', 'openingquantity'],
  location: ['location', 'godown', 'warehouse', 'shop', 'store'],
};

/** Parse sheet rows (first row = headers). Returns valid rows plus per-row errors. */
export function parseStockRows(sheet: unknown[][]): { rows: StockLevelRow[]; errors: string[] } {
  const errors: string[] = [];
  const headerIdx = sheet.findIndex((r) => r?.some((c) => ALIASES.item.includes(norm(c)) || ALIASES.quantity.includes(norm(c))));
  if (headerIdx < 0) return { rows: [], errors: ['No header row found (need an Item and Quantity column).'] };
  const header = sheet[headerIdx].map(norm);
  const col = (k: keyof StockLevelRow) => header.findIndex((h) => ALIASES[k].includes(h));
  const ci = { item: col('item'), category: col('category'), size: col('size'), quantity: col('quantity'), location: col('location') };
  if (ci.quantity < 0 || (ci.item < 0 && ci.size < 0)) {
    return { rows: [], errors: ['Missing required columns: Item (or Size) and Quantity.'] };
  }
  const rows: StockLevelRow[] = [];
  const seen = new Set<string>();
  sheet.slice(headerIdx + 1).forEach((r, i) => {
    if (!r || r.every((c) => String(c ?? '').trim() === '')) return;
    const line = headerIdx + i + 2;
    const get = (k: number) => (k >= 0 ? String(r[k] ?? '').trim() : '');
    const item = get(ci.item);
    const size = get(ci.size);
    if (/^grand\s*total$|^total$/i.test(item)) return;
    // Tally quantities look like "12 pcs" or "1,200.00 Nos"
    const qtyRaw = get(ci.quantity).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    if (!item && !size) return errors.push(`Row ${line}: missing item/size`);
    if (!qtyRaw) return errors.push(`Row ${line}: invalid quantity`);
    const quantity = Math.round(Number(qtyRaw[0]));
    if (quantity < 0) return errors.push(`Row ${line}: negative quantity`);
    const row = { item, category: get(ci.category), size, quantity, location: get(ci.location) };
    const key = `${row.item}|${row.size}|${row.location}`.toLowerCase();
    if (seen.has(key)) return errors.push(`Row ${line}: duplicate of an earlier row`);
    seen.add(key);
    rows.push(row);
  });
  return { rows, errors };
}
