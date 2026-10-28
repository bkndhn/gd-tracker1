import { describe, it, expect } from 'vitest';
import { summariseByShop } from '@/components/RequirementsMonthlySummary';
import { matchScannedRequirement } from '@/components/RequirementScanner';

const r = (o: any) => ({ id: 'abcdef12-0000', shop_name: 'A', size: 'XL', quantity: 1, status: 'requested', created_at: '2026-10-05T10:00:00Z', ...o });

describe('monthly shop summary', () => {
  it('counts each stage reached per shop for the month only', () => {
    const rows = [
      r({ status: 'received', packed_at: 'x', moved_at: 'x', received_at: 'x' }),
      r({ status: 'packed', packed_at: 'x' }),
      r({ created_at: '2026-09-30T10:00:00Z' }),
    ] as any;
    const [a] = summariseByShop(rows, '2026-10');
    expect(a).toMatchObject({ requested: 2, packed: 2, moved: 1, received: 1, fulfilRate: 50 });
  });
});

describe('scan matching', () => {
  it('matches only open requests, by short id or oldest same size', () => {
    const rows = [
      r({ id: 'aaaaaaaa-1', created_at: '2026-10-02' }),
      r({ id: 'bbbbbbbb-1', created_at: '2026-10-01' }),
      r({ id: 'cccccccc-1', status: 'packed' }),
    ] as any;
    expect(matchScannedRequirement('aaaaaaaa', rows)?.id).toBe('aaaaaaaa-1');
    expect(matchScannedRequirement('xl', rows)?.id).toBe('bbbbbbbb-1');
    expect(matchScannedRequirement('cccccccc', rows)).toBeNull();
  });
});
