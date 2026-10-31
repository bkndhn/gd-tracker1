import { describe, it, expect } from 'bun:test';
import { isLowStock, stockItemCode } from '@/components/StockInventory';
describe('stock inventory', () => {
  it('flags low stock at or below the low-stock level', () => {
    expect(isLowStock({ quantity: 3, min_qty: 3 })).toBe(true);
    expect(isLowStock({ quantity: 4, min_qty: 3 })).toBe(false);
    expect(isLowStock({ quantity: 0, min_qty: 0 })).toBe(true);
  });
  it('builds item sticker codes', () => { expect(stockItemCode({ id: 'abc' })).toBe('STK-abc'); });
});
