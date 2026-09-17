/** A single tracked pantry item. */
export interface PantryItem {
  id: string;
  name: string;
  qty: number;
  unit: Unit;
  /** Quantity at or below which the item counts as "running low". */
  threshold: number;
  category: Category;
}

/** Units offered in the "add item" form. */
export type Unit = 'pcs' | 'jars' | 'cans' | 'bags' | 'boxes' | 'g' | 'kg' | 'ml' | 'l';

export const UNITS: readonly Unit[] = ['pcs', 'jars', 'cans', 'bags', 'boxes', 'g', 'kg', 'ml', 'l'];

/**
 * Which shelf an item belongs to. The list is grouped into a section per
 * category (in this order) instead of one flat list.
 */
export type Category = 'india' | 'daily' | 'bulk';

export interface CategoryMeta {
  id: Category;
  label: string;
  hint: string;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: 'india', label: 'From India', hint: 'Spices, snacks, and specialty items brought back from a trip' },
  { id: 'daily', label: 'Daily essentials', hint: 'Perishables bought often — eggs, milk, cheese, bread' },
  { id: 'bulk', label: 'Bulk staples', hint: 'Rice, dals, and other staples bought in large quantities' },
];

export const DEFAULT_CATEGORY: Category = 'daily';

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && CATEGORIES.some((c) => c.id === value);
}

/** Derived stock status for an item. */
export type Status = 'good' | 'low' | 'out';

/** Which items the list is currently filtered to. */
export type Filter = 'all' | Status;
