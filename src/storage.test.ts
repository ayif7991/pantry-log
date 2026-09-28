import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadItems, saveItems } from './storage';
import type { PantryItem } from './types';

const rice: PantryItem = { id: 'ex1', name: 'Rice', qty: 5, unit: 'kg', threshold: 2, category: 'bulk' };

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('loadItems', () => {
  it('returns null when nothing is stored', () => {
    expect(loadItems()).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem('pantry-log-items-v1', '{not valid json');
    expect(loadItems()).toBeNull();
  });

  it('returns null when the stored value is not an array', () => {
    localStorage.setItem('pantry-log-items-v1', JSON.stringify({ not: 'an array' }));
    expect(loadItems()).toBeNull();
  });

  it('returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadItems()).toBeNull();
  });

  it('round-trips items saved via saveItems', () => {
    saveItems([rice]);
    expect(loadItems()).toEqual([rice]);
  });

  it('backfills a default category on items saved before that field existed', () => {
    const legacy = { id: 'old1', name: 'Old item', qty: 1, unit: 'pcs', threshold: 1 };
    localStorage.setItem('pantry-log-items-v1', JSON.stringify([legacy]));

    expect(loadItems()).toEqual([{ ...legacy, category: 'daily' }]);
  });

  it('backfills a default category when the stored value is invalid', () => {
    const bogus = { id: 'old2', name: 'Old item', qty: 1, unit: 'pcs', threshold: 1, category: 'snacks' };
    localStorage.setItem('pantry-log-items-v1', JSON.stringify([bogus]));

    expect(loadItems()).toEqual([{ ...bogus, category: 'daily' }]);
  });

  it('leaves a valid category untouched', () => {
    saveItems([rice]);
    const [loaded] = loadItems() ?? [];
    expect(loaded?.category).toBe('bulk');
  });
});

describe('saveItems', () => {
  it('persists items as JSON under the expected key', () => {
    saveItems([rice]);
    expect(localStorage.getItem('pantry-log-items-v1')).toBe(JSON.stringify([rice]));
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveItems([rice])).not.toThrow();
  });
});
