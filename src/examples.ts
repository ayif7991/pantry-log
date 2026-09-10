import type { PantryItem } from './types';

/**
 * Seed data shown on first visit (before anything is saved) so the UI has
 * something to demonstrate. Cleared via the "Clear examples" banner button,
 * or replaced the moment the user edits/adds/removes anything.
 */
export const EXAMPLE_ITEMS: readonly PantryItem[] = [
  { id: 'ex1', name: 'Basmati rice', qty: 3, unit: 'kg', threshold: 1 },
  { id: 'ex2', name: 'Penne pasta', qty: 1, unit: 'boxes', threshold: 2 },
  { id: 'ex3', name: 'Olive oil', qty: 250, unit: 'ml', threshold: 200 },
  { id: 'ex4', name: 'Chopped tomatoes', qty: 4, unit: 'cans', threshold: 2 },
  { id: 'ex5', name: 'Ground coffee', qty: 0, unit: 'bags', threshold: 1 },
  { id: 'ex6', name: 'Black pepper', qty: 1, unit: 'jars', threshold: 1 },
  { id: 'ex7', name: 'Rolled oats', qty: 900, unit: 'g', threshold: 300 },
  { id: 'ex8', name: 'Honey', qty: 2, unit: 'jars', threshold: 1 },
];
