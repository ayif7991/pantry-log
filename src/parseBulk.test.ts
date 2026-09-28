import { describe, expect, it } from 'vitest';
import { parseBulkInput } from './parseBulk';

describe('parseBulkInput', () => {
  it('parses a plain comma-separated list at qty 1, unit pcs', () => {
    expect(parseBulkInput('rice, pasta, milk')).toEqual([
      { name: 'rice', qty: 1, unit: 'pcs', threshold: 1 },
      { name: 'pasta', qty: 1, unit: 'pcs', threshold: 1 },
      { name: 'milk', qty: 1, unit: 'pcs', threshold: 1 },
    ]);
  });

  it('splits on newlines and semicolons too', () => {
    const result = parseBulkInput('rice\npasta;milk');
    expect(result.map((i) => i.name)).toEqual(['rice', 'pasta', 'milk']);
  });

  it('ignores blank entries from extra separators', () => {
    const result = parseBulkInput('rice,,  ,\n\nmilk');
    expect(result.map((i) => i.name)).toEqual(['rice', 'milk']);
  });

  it('reads a trailing "xN" multiplier', () => {
    expect(parseBulkInput('pasta x2')).toEqual([{ name: 'pasta', qty: 2, unit: 'pcs', threshold: 1 }]);
  });

  it('reads a "×N" multiplier (unicode times sign)', () => {
    expect(parseBulkInput('coffee ×3')).toEqual([{ name: 'coffee', qty: 3, unit: 'pcs', threshold: 1 }]);
  });

  it('reads a leading "Nx" multiplier', () => {
    expect(parseBulkInput('2x yogurt')).toEqual([{ name: 'yogurt', qty: 2, unit: 'pcs', threshold: 1 }]);
  });

  it('reads a leading "N x" multiplier', () => {
    expect(parseBulkInput('2 x yogurt')).toEqual([{ name: 'yogurt', qty: 2, unit: 'pcs', threshold: 1 }]);
  });

  it('reads a trailing "N unit" pair', () => {
    expect(parseBulkInput('flour 2 kg')).toEqual([{ name: 'flour', qty: 2, unit: 'kg', threshold: 1 }]);
  });

  it('reads a trailing "Nunit" with no space', () => {
    expect(parseBulkInput('olive oil 1l')).toEqual([{ name: 'olive oil', qty: 1, unit: 'l', threshold: 1 }]);
  });

  it('reads a leading "N item" count', () => {
    expect(parseBulkInput('3 eggs')).toEqual([{ name: 'eggs', qty: 3, unit: 'pcs', threshold: 1 }]);
  });

  it('reads a leading "N unit item" (qty + unit before the name)', () => {
    expect(parseBulkInput('2 kg flour')).toEqual([{ name: 'flour', qty: 2, unit: 'kg', threshold: 1 }]);
  });

  it('supports decimal quantities', () => {
    expect(parseBulkInput('chicken breast 1.5 kg')).toEqual([
      { name: 'chicken breast', qty: 1.5, unit: 'kg', threshold: 1 },
    ]);
  });

  it('does not mistake a trailing non-unit word for a unit', () => {
    expect(parseBulkInput('apples red')).toEqual([{ name: 'apples red', qty: 1, unit: 'pcs', threshold: 1 }]);
  });

  it('keeps an unrecognised leading word as part of the name', () => {
    expect(parseBulkInput('3 red apples')).toEqual([{ name: 'red apples', qty: 3, unit: 'pcs', threshold: 1 }]);
  });

  it('drops entries that are only a number', () => {
    expect(parseBulkInput('7')).toEqual([]);
  });

  it('drops entries that end up empty after cleanup', () => {
    expect(parseBulkInput('   ,  ,')).toEqual([]);
  });

  it('treats a lone multiplier with no name as a literal item (no name to attach it to)', () => {
    expect(parseBulkInput('x2')).toEqual([{ name: 'x2', qty: 1, unit: 'pcs', threshold: 1 }]);
  });

  it('strips bullet and numbered-list prefixes', () => {
    const result = parseBulkInput('- flour\n* sugar\n1. rice\n2) milk');
    expect(result.map((i) => i.name)).toEqual(['flour', 'sugar', 'rice', 'milk']);
  });

  it('merges duplicate entries (same name + unit), summing quantities', () => {
    expect(parseBulkInput('milk, milk, milk x2')).toEqual([{ name: 'milk', qty: 4, unit: 'pcs', threshold: 1 }]);
  });

  it('merges duplicates case-insensitively', () => {
    expect(parseBulkInput('Milk, milk')).toEqual([{ name: 'Milk', qty: 2, unit: 'pcs', threshold: 1 }]);
  });

  it('keeps same-name entries separate when units differ', () => {
    const result = parseBulkInput('flour 1 kg, flour 200 g');
    expect(result).toEqual([
      { name: 'flour', qty: 1, unit: 'kg', threshold: 1 },
      { name: 'flour', qty: 200, unit: 'g', threshold: 1 },
    ]);
  });

  it('parses a realistic mixed shopping list', () => {
    const result = parseBulkInput('rice\npasta x2\nolive oil 1 l\nmilk, eggs x12, butter');
    expect(result).toEqual([
      { name: 'rice', qty: 1, unit: 'pcs', threshold: 1 },
      { name: 'pasta', qty: 2, unit: 'pcs', threshold: 1 },
      { name: 'olive oil', qty: 1, unit: 'l', threshold: 1 },
      { name: 'milk', qty: 1, unit: 'pcs', threshold: 1 },
      { name: 'eggs', qty: 12, unit: 'pcs', threshold: 1 },
      { name: 'butter', qty: 1, unit: 'pcs', threshold: 1 },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseBulkInput('')).toEqual([]);
    expect(parseBulkInput('   \n  ')).toEqual([]);
  });
});
