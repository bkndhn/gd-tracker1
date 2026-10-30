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
