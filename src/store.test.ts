import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Store, type NewItemInput } from './store';
import { EXAMPLE_ITEMS } from './examples';
import { loadItems } from './storage';

const newRice: NewItemInput = { name: 'Basmati rice', qty: 5, unit: 'kg', threshold: 2, category: 'bulk' };
const newMilk: NewItemInput = { name: 'Milk', qty: 1, unit: 'l', threshold: 1, category: 'daily' };

beforeEach(() => {
  localStorage.clear();
});

describe('Store construction', () => {
  it('seeds from EXAMPLE_ITEMS and flags showingExamples when nothing is saved', () => {
    const store = new Store();
    const state = store.getState();

    expect(state.showingExamples).toBe(true);
    expect(state.items).toEqual(EXAMPLE_ITEMS);
    expect(state.filter).toBe('all');
    expect(state.query).toBe('');
  });

  it('does not mutate the shared EXAMPLE_ITEMS array', () => {
    const store = new Store();
    store.changeQty(EXAMPLE_ITEMS[0]!.id, 5);
    expect(EXAMPLE_ITEMS[0]!.qty).not.toBe(store.getState().items[0]!.qty);
  });

  it('loads previously saved items instead of the examples', () => {
    const seed = new Store();
    seed.clearExamples();
    seed.addItem(newRice);

    const reopened = new Store();
    expect(reopened.getState().showingExamples).toBe(false);
    expect(reopened.getState().items.map((i) => i.name)).toEqual(['Basmati rice']);
  });
});

describe('addItem / addItems', () => {
  it('assigns a generated id and adds newest-first', () => {
    const store = new Store();
    store.clearExamples();

    store.addItem(newRice);
    store.addItem(newMilk);

    const items = store.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0]?.name).toBe('Milk'); // most recently added is first
    expect(items[1]?.name).toBe('Basmati rice');
    expect(items[0]?.id).toEqual(expect.any(String));
    expect(items[0]?.id).not.toBe(items[1]?.id);
  });

  it('adding from the example state drops showingExamples', () => {
    const store = new Store();
    expect(store.getState().showingExamples).toBe(true);

    store.addItem(newRice);

    expect(store.getState().showingExamples).toBe(false);
  });

  it('addItems is a no-op for an empty array', () => {
    const store = new Store();
    const before = store.getState().items;

    store.addItems([]);

    expect(store.getState().items).toBe(before);
  });

  it('persists added items so they survive a reload', () => {
    const store = new Store();
    store.clearExamples();
    store.addItem(newRice);

    expect(loadItems()?.map((i) => i.name)).toEqual(['Basmati rice']);
  });
});

describe('removeItem', () => {
  it('removes only the matching item', () => {
    const store = new Store();
    store.clearExamples();
    store.addItems([newRice, newMilk]);
    const [milk, rice] = store.getState().items;

    store.removeItem(rice!.id);

    expect(store.getState().items).toEqual([milk]);
  });

  it('is a no-op for an unknown id', () => {
    const store = new Store();
    const before = store.getState().items;

    store.removeItem('does-not-exist');

    expect(store.getState().items).toEqual(before);
  });
});

describe('changeQty', () => {
  it('increments and decrements quantity', () => {
    const store = new Store();
    store.clearExamples();
    store.addItem(newRice);
    const id = store.getState().items[0]!.id;

    store.changeQty(id, 1);
    expect(store.getState().items[0]?.qty).toBe(6);

    store.changeQty(id, -2);
    expect(store.getState().items[0]?.qty).toBe(4);
  });

  it('floors quantity at zero', () => {
    const store = new Store();
    store.clearExamples();
    store.addItem(newMilk); // qty 1

    store.changeQty(store.getState().items[0]!.id, -5);

    expect(store.getState().items[0]?.qty).toBe(0);
  });

  it('is a no-op for an unknown id', () => {
    const store = new Store();
    const before = store.getState().items;

    store.changeQty('does-not-exist', 1);

    expect(store.getState().items).toEqual(before);
  });
});

describe('clearExamples', () => {
  it('empties the list and persists that (does not resurrect the examples on reload)', () => {
    const store = new Store();
    store.clearExamples();

    expect(store.getState().items).toEqual([]);
    expect(store.getState().showingExamples).toBe(false);

    const reopened = new Store();
    expect(reopened.getState().items).toEqual([]);
    expect(reopened.getState().showingExamples).toBe(false);
  });
});

describe('setFilter / setQuery', () => {
  it('update state and notify subscribers', () => {
    const store = new Store();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setFilter('low');
    expect(store.getState().filter).toBe('low');
    expect(listener).toHaveBeenCalledTimes(1);

    store.setQuery('rice');
    expect(store.getState().query).toBe('rice');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('subscribe', () => {
  it('notifies every subscriber on each mutation', () => {
    const store = new Store();
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);

    store.addItem(newRice);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribing', () => {
    const store = new Store();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.addItem(newRice);

    expect(listener).not.toHaveBeenCalled();
  });
});
