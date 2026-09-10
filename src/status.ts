import type { PantryItem, Status } from './types';

/** Classify an item by how much of it is left. */
export function statusOf(item: PantryItem): Status {
  if (item.qty <= 0) return 'out';
  if (item.qty <= item.threshold) return 'low';
  return 'good';
}

/** Human-readable label for a status pill. */
export function statusLabel(status: Status): string {
  switch (status) {
    case 'out':
      return 'Out of stock';
    case 'low':
      return 'Running low';
    case 'good':
      return 'In stock';
  }
}
