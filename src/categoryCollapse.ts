import type { Category } from './types';

const STORAGE_KEY = 'pantry-log-collapsed-categories-v1';

function readCollapsed(): Set<Category> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as Category[]) : new Set();
  } catch {
    return new Set();
  }
}

// UI-only preference (which sections are collapsed) — kept separate from
// the item list itself, and read once since a single tab is all that edits it.
const collapsed = readCollapsed();

export function isCollapsed(category: Category): boolean {
  return collapsed.has(category);
}

export function setCollapsed(category: Category, value: boolean): void {
  if (value) collapsed.add(category);
  else collapsed.delete(category);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    /* ignore */
  }
}
