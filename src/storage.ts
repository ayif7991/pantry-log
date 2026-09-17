import type { PantryItem } from './types';
import { DEFAULT_CATEGORY, isCategory } from './types';

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
    return Array.isArray(parsed) ? parsed.map(normalizeItem) : null;
  } catch {
    return null;
  }
}

/** Backfill `category` on items saved before that field existed. */
function normalizeItem(raw: PantryItem): PantryItem {
  return isCategory(raw.category) ? raw : { ...raw, category: DEFAULT_CATEGORY };
}

/** Persist the item list. Failures (private mode, quota) are ignored on purpose. */
export function saveItems(items: readonly PantryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}
