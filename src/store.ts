import type { Category, Filter, PantryItem, Unit } from './types';
import { EXAMPLE_ITEMS } from './examples';
import { loadItems, saveItems } from './storage';
import { isSyncConfigured } from './firebaseClient';
import { getOrCreatePantryCode, isValidPantryCode, normalizePantryCode, setStoredPantryCode } from './pantryCode';
import type { PantrySyncHandle, SyncStatus } from './remoteSync';
import { startPantrySync } from './remoteSync';

export interface SyncState {
  /** Whether this deployment has a Firebase project wired up at all. */
  configured: boolean;
  /** This device's pantry code once sync is configured, else null. */
  code: string | null;
  status: SyncStatus;
}

export interface AppState {
  items: PantryItem[];
  filter: Filter;
  query: string;
  /** True while the seed examples are on screen and nothing has been saved yet. */
  showingExamples: boolean;
  sync: SyncState;
}

export type JoinPantryResult = { ok: true } | { ok: false; error: string };

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
  private syncHandle: PantrySyncHandle | null = null;

  constructor() {
    const saved = loadItems();
    const sync: SyncState = { configured: isSyncConfigured, code: null, status: 'disabled' };
    this.state = saved
      ? { items: saved, filter: 'all', query: '', showingExamples: false, sync }
      : { items: EXAMPLE_ITEMS.map((it) => ({ ...it })), filter: 'all', query: '', showingExamples: true, sync };

    if (isSyncConfigured) this.connectSync(getOrCreatePantryCode());
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  /**
   * Start (or switch to) syncing with the given code's shared pantry. A
   * brand-new code gets seeded from whatever's here right now; an existing
   * one's data replaces what's here — "joining" means adopting their list.
   */
  private connectSync(code: string): void {
    this.syncHandle?.stop();
    this.state.sync = { ...this.state.sync, code, status: 'connecting' };
    this.emit();

    let seeded = false;
    this.syncHandle = startPantrySync(
      code,
      (remoteItems) => {
        if (remoteItems === null) {
          if (!seeded) {
            seeded = true;
            this.syncHandle?.push(this.state.items);
          }
          return;
        }
        this.state.items = remoteItems;
        this.state.showingExamples = false;
        saveItems(this.state.items);
        this.emit();
      },
      (status) => {
        this.state.sync = { ...this.state.sync, status };
        this.emit();
      },
    );
  }

  /** Switch this device to an existing pantry code from another device. */
  joinPantry(rawCode: string): JoinPantryResult {
    const code = normalizePantryCode(rawCode);
    if (!isValidPantryCode(code)) {
      return { ok: false, error: 'That code doesn’t look right — codes are 6 letters or numbers.' };
    }
    setStoredPantryCode(code);
    this.connectSync(code);
    return { ok: true };
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
    this.syncHandle?.push(this.state.items);
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
