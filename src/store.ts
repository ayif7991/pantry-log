import type { Category, Filter, PantryItem, Unit } from './types';
import { EXAMPLE_ITEMS } from './examples';
import { loadItems, saveItems } from './storage';

export interface AppState {
  items: PantryItem[];
  filter: Filter;
  query: string;
  /** True while the seed examples are on screen and nothing has been saved yet. */
  showingExamples: boolean;
}

type Listener = (state: AppState) => void;

function makeId(): string {
  return `it_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface NewItemInput {
  name: string;
  qty: number;
  unit: Unit;
  threshold: number;
  category: Category;
}

/**
 * Holds all app state and is the only place items are mutated. Any change
 * that touches items is persisted and drops the "examples" flag. Views
 * subscribe with `subscribe()` and re-render on notification.
 */
export class Store {
  private state: AppState;
  private readonly listeners = new Set<Listener>();

  constructor() {
    const saved = loadItems();
    this.state = saved
      ? { items: saved, filter: 'all', query: '', showingExamples: false }
      : { items: EXAMPLE_ITEMS.map((it) => ({ ...it })), filter: 'all', query: '', showingExamples: true };
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  /** Persist items and re-render. Called after every item mutation. */
  private commit(): void {
    this.state.showingExamples = false;
    saveItems(this.state.items);
    this.emit();
  }

  // ---- view-only state (not persisted) ----

  setFilter(filter: Filter): void {
    this.state.filter = filter;
    this.emit();
  }

  setQuery(query: string): void {
    this.state.query = query;
    this.emit();
  }

  // ---- item mutations ----

  addItem(input: NewItemInput): void {
    this.addItems([input]);
  }

  /** Add several items at once (bulk / receipt entry). Newest first. */
  addItems(inputs: readonly NewItemInput[]): void {
    if (inputs.length === 0) return;
    const items: PantryItem[] = inputs.map((input) => ({ id: makeId(), ...input }));
    this.state.items = [...items, ...this.state.items];
    this.commit();
  }

  removeItem(id: string): void {
    this.state.items = this.state.items.filter((it) => it.id !== id);
    this.commit();
  }

  changeQty(id: string, delta: number): void {
    const item = this.state.items.find((it) => it.id === id);
    if (!item) return;
    item.qty = Math.max(0, item.qty + delta);
    this.commit();
  }

  clearExamples(): void {
    this.state.items = [];
    this.commit();
  }
}
