import { describe, expect, it } from 'vitest';
import { CATEGORIES, DEFAULT_CATEGORY, isCategory } from './types';

describe('isCategory', () => {
  it('accepts every known category id', () => {
    for (const meta of CATEGORIES) {
      expect(isCategory(meta.id)).toBe(true);
    }
  });

  it('rejects unknown strings', () => {
    expect(isCategory('snacks')).toBe(false);
    expect(isCategory('')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isCategory(undefined)).toBe(false);
    expect(isCategory(null)).toBe(false);
    expect(isCategory(42)).toBe(false);
    expect(isCategory({ id: 'daily' })).toBe(false);
  });
});

describe('DEFAULT_CATEGORY', () => {
  it('is one of the known categories', () => {
    expect(isCategory(DEFAULT_CATEGORY)).toBe(true);
  });
});
