import { describe, expect, it } from 'vitest';
import { statusLabel, statusOf } from './status';
import type { PantryItem } from './types';

function item(qty: number, threshold: number): PantryItem {
  return { id: 'x', name: 'Test item', qty, unit: 'pcs', threshold, category: 'daily' };
}

describe('statusOf', () => {
  it('is "out" when qty is zero', () => {
    expect(statusOf(item(0, 5))).toBe('out');
  });

  it('is "out" for a negative qty (defensive)', () => {
    expect(statusOf(item(-1, 5))).toBe('out');
  });

  it('is "low" when qty is below the threshold', () => {
    expect(statusOf(item(2, 5))).toBe('low');
  });

  it('is "low" when qty exactly equals the threshold', () => {
    expect(statusOf(item(5, 5))).toBe('low');
  });

  it('is "good" when qty is above the threshold', () => {
    expect(statusOf(item(6, 5))).toBe('good');
  });

  it('is "good" when threshold is zero and qty is positive', () => {
    expect(statusOf(item(1, 0))).toBe('good');
  });
});

describe('statusLabel', () => {
  it('maps each status to its display label', () => {
    expect(statusLabel('out')).toBe('Out of stock');
    expect(statusLabel('low')).toBe('Running low');
    expect(statusLabel('good')).toBe('In stock');
  });
});
