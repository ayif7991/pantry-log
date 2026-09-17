import type { PantryItem } from './types';

/**
 * Seed data shown on first visit (before anything is saved) so the UI has
 * something to demonstrate. Cleared via the "Clear examples" banner button,
 * or replaced the moment the user edits/adds/removes anything. Spans all
 * three categories so each section has something in it.
 */
export const EXAMPLE_ITEMS: readonly PantryItem[] = [
  // From India — spices and specialty items stocked up on during a trip.
  { id: 'ex1', name: 'Garam masala', qty: 0, unit: 'g', threshold: 50, category: 'india' },
  { id: 'ex2', name: 'Turmeric powder (Haldi)', qty: 150, unit: 'g', threshold: 100, category: 'india' },
  { id: 'ex3', name: 'Mango pickle (Achaar)', qty: 1, unit: 'jars', threshold: 1, category: 'india' },
  { id: 'ex4', name: 'Tea powder', qty: 250, unit: 'g', threshold: 100, category: 'india' },

  // Daily essentials — perishables that get restocked often.
  { id: 'ex5', name: 'Eggs', qty: 6, unit: 'pcs', threshold: 6, category: 'daily' },
  { id: 'ex6', name: 'Milk', qty: 2, unit: 'l', threshold: 1, category: 'daily' },
  { id: 'ex7', name: 'Cheese', qty: 0, unit: 'pcs', threshold: 1, category: 'daily' },
  { id: 'ex8', name: 'Butter', qty: 2, unit: 'pcs', threshold: 1, category: 'daily' },

  // Bulk staples — rice and dals bought in large quantities, infrequently.
  { id: 'ex9', name: 'Basmati rice', qty: 5, unit: 'kg', threshold: 2, category: 'bulk' },
  { id: 'ex10', name: 'Toor dal (Arhar)', qty: 2, unit: 'kg', threshold: 1, category: 'bulk' },
  { id: 'ex11', name: 'Chana dal', qty: 0.5, unit: 'kg', threshold: 1, category: 'bulk' },
  { id: 'ex12', name: 'Moong dal', qty: 1, unit: 'kg', threshold: 0.5, category: 'bulk' },
];
