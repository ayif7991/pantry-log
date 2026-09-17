import type { PantryItem } from './types';

/**
 * Seed data shown on first visit (before anything is saved) so the UI has
 * something to demonstrate. Cleared via the "Clear examples" banner button,
 * or replaced the moment the user edits/adds/removes anything.
 */
export const EXAMPLE_ITEMS: readonly PantryItem[] = [
  { id: 'ex1', name: 'Basmati rice', qty: 5, unit: 'kg', threshold: 2 },
  { id: 'ex2', name: 'Toor dal (Arhar)', qty: 2, unit: 'kg', threshold: 1 },
  { id: 'ex3', name: 'Chana dal', qty: 1, unit: 'kg', threshold: 0.5 },
  { id: 'ex4', name: 'Urad dal', qty: 200, unit: 'g', threshold: 300 },
  { id: 'ex5', name: 'Moong dal', qty: 0, unit: 'g', threshold: 200 },
  { id: 'ex6', name: 'Masoor dal (red lentils)', qty: 400, unit: 'g', threshold: 200 },
  { id: 'ex7', name: 'Turmeric powder (Haldi)', qty: 150, unit: 'g', threshold: 100 },
  { id: 'ex8', name: 'Red chilli powder', qty: 50, unit: 'g', threshold: 100 },
  { id: 'ex9', name: 'Garam masala', qty: 0, unit: 'g', threshold: 50 },
  { id: 'ex10', name: 'Cumin seeds (Jeera)', qty: 100, unit: 'g', threshold: 50 },
  { id: 'ex11', name: 'Mustard seeds (Rai)', qty: 80, unit: 'g', threshold: 50 },
  { id: 'ex12', name: 'Tea powder', qty: 250, unit: 'g', threshold: 100 },
];
