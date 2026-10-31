import { describe, it, expect } from 'vitest';
import { parseStockRows } from '../stockImport';

describe('parseStockRows', () => {
  it('reads Tally-style quantities and skips totals/duplicates', () => {
    const { rows, errors } = parseStockRows([
      ['Stock Summary'],
      ['Particulars', 'Godown', 'Closing Quantity'],
      ['Shirt M', 'Main', '1,200.00 Nos'],
      ['Shirt M', 'Main', '5'],
      ['Pant', 'Main', 'abc'],
      ['Grand Total', '', '1200'],
    ]);
    expect(rows).toEqual([{ item: 'Shirt M', category: '', size: '', quantity: 1200, location: 'Main' }]);
    expect(errors.length).toBe(2);
  });
});

import { planStockMerge } from '@/lib/stockImport';
describe('planStockMerge', () => {
  it('updates matching items, adds new ones, sums duplicates', () => {
    const rows = [
      { item: 'Shirt', size: 'M', category: 'Top', quantity: 5, location: 'A1' },
      { item: 'shirt ', size: 'm', category: 'Top', quantity: 3, location: 'a1' },
      { item: 'Pant', size: '32', category: 'Bottom', quantity: 7, location: '' },
    ];
    const { updates, inserts } = planStockMerge(rows, [{ id: 'x', item: 'Shirt', size: 'M', location: 'A1' }]);
    expect(updates).toEqual([{ id: 'x', quantity: 8 }]);
    expect(inserts.map((i) => i.item)).toEqual(['Pant']);
  });
});
