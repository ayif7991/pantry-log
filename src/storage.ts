import type { PantryItem } from './types';

const STORAGE_KEY = 'pantry-log-items-v1';

/**
 * Read the saved item list from localStorage.
 * Returns `null` when nothing is stored or the stored value is unusable —
 * callers treat that as "show the examples".
 */
export function loadItems(): PantryItem[] | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PantryItem[]) : null;
  } catch {
    return null;
  }
}

/** Persist the item list. Failures (private mode, quota) are ignored on purpose. */
export function saveItems(items: readonly PantryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}
