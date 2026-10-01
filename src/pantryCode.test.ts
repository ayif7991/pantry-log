import { beforeEach, describe, expect, it } from 'vitest';
import {
  generatePantryCode,
  getOrCreatePantryCode,
  getStoredPantryCode,
  isValidPantryCode,
  normalizePantryCode,
  setStoredPantryCode,
} from './pantryCode';

beforeEach(() => {
  localStorage.clear();
});

describe('generatePantryCode', () => {
  it('generates a 6-character code from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePantryCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXY3456789]{6}$/);
    }
  });

  it('never includes easily-confused characters (0/O, 1/I/L, 2/Z)', () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePantryCode()).not.toMatch(/[0O1IL2Z]/);
    }
  });
});

describe('normalizePantryCode', () => {
  it('uppercases', () => {
    expect(normalizePantryCode('abcdef')).toBe('ABCDEF');
  });

  it('strips surrounding whitespace', () => {
    expect(normalizePantryCode('  ABCDEF  ')).toBe('ABCDEF');
  });

  it('strips internal spaces and hyphens (e.g. "ABC-DEF" or "ABC DEF")', () => {
    expect(normalizePantryCode('ABC-DEF')).toBe('ABCDEF');
    expect(normalizePantryCode('ABC DEF')).toBe('ABCDEF');
  });
});

describe('isValidPantryCode', () => {
  it('accepts a well-formed code', () => {
    expect(isValidPantryCode('ABCDEF')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidPantryCode('ABCDE')).toBe(false);
    expect(isValidPantryCode('ABCDEFG')).toBe(false);
    expect(isValidPantryCode('')).toBe(false);
  });

  it('rejects excluded look-alike characters', () => {
    expect(isValidPantryCode('ABCDE0')).toBe(false); // 0
    expect(isValidPantryCode('ABCDEI')).toBe(false); // I
  });

  it('rejects lowercase (callers should normalize first)', () => {
    expect(isValidPantryCode('abcdef')).toBe(false);
  });
});

describe('getStoredPantryCode / setStoredPantryCode', () => {
  it('returns null when nothing is stored', () => {
    expect(getStoredPantryCode()).toBeNull();
  });

  it('round-trips a stored code', () => {
    setStoredPantryCode('ABCDEF');
    expect(getStoredPantryCode()).toBe('ABCDEF');
  });
});

describe('getOrCreatePantryCode', () => {
  it('creates and persists a new code when none is stored', () => {
    const code = getOrCreatePantryCode();
    expect(isValidPantryCode(code)).toBe(true);
    expect(getStoredPantryCode()).toBe(code);
  });

  it('returns the same code on a later call (does not regenerate)', () => {
    const first = getOrCreatePantryCode();
    const second = getOrCreatePantryCode();
    expect(second).toBe(first);
  });

  it('regenerates if the stored value is corrupted/invalid', () => {
    setStoredPantryCode('not-a-valid-code!!');
    const code = getOrCreatePantryCode();
    expect(isValidPantryCode(code)).toBe(true);
  });
});
