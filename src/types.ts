/** A single tracked pantry item. */
export interface PantryItem {
  id: string;
  name: string;
  qty: number;
  unit: Unit;
  /** Quantity at or below which the item counts as "running low". */
  threshold: number;
}

/** Units offered in the "add item" form. */
export type Unit = 'pcs' | 'jars' | 'cans' | 'bags' | 'boxes' | 'g' | 'kg' | 'ml' | 'l';

export const UNITS: readonly Unit[] = ['pcs', 'jars', 'cans', 'bags', 'boxes', 'g', 'kg', 'ml', 'l'];

/** Derived stock status for an item. */
export type Status = 'good' | 'low' | 'out';

/** Which items the list is currently filtered to. */
export type Filter = 'all' | Status;
