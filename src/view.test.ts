import { beforeAll, describe, expect, it } from 'vitest';
import type { AppState } from './store';
import type { PantryItem } from './types';
import { mountFixture } from './test/fixture';

let render: typeof import('./view').render;

function item(overrides: Partial<PantryItem> & Pick<PantryItem, 'id' | 'name' | 'category'>): PantryItem {
  return { qty: 1, unit: 'pcs', threshold: 1, ...overrides };
}

function state(overrides: Partial<AppState> = {}): AppState {
  return { items: [], filter: 'all', query: '', showingExamples: false, ...overrides };
}

beforeAll(async () => {
  localStorage.clear();
  mountFixture();
  ({ render } = await import('./view'));
});

describe('render', () => {
  it('groups items into a section per category, in CATEGORIES order, skipping empty ones', () => {
    render(
      state({
        items: [
          item({ id: '1', name: 'Rice', category: 'bulk' }),
          item({ id: '2', name: 'Milk', category: 'daily' }),
        ],
      }),
    );

    expect(document.querySelectorAll('.category-section').length).toBe(2);
    const labels = [...document.querySelectorAll('.category-label')].map((el) => el.textContent);
    expect(labels).toEqual(['Daily essentials', 'Bulk staples']);
  });

  it('renders a row per item with name, unit/threshold meta, and status pill', () => {
    render(
      state({ items: [item({ id: '1', name: 'Rice', category: 'bulk', qty: 5, unit: 'kg', threshold: 2 })] }),
    );

    const row = document.querySelector('.row');
    expect(row?.getAttribute('data-id')).toBe('1');
    expect(row?.querySelector('.name')?.textContent).toBe('Rice');
    expect(row?.querySelector('.meta')?.textContent).toBe('kg · low at 2');
    expect(row?.querySelector('.pill')?.textContent).toBe('In stock');
    expect(row?.querySelector('.pill')?.className).toContain('good');
  });

  it('updates the stats strip and the filter chip counts', () => {
    render(
      state({
        items: [
          item({ id: '1', name: 'A', category: 'daily', qty: 0, threshold: 1 }), // out
          item({ id: '2', name: 'B', category: 'daily', qty: 1, threshold: 1 }), // low
          item({ id: '3', name: 'C', category: 'bulk', qty: 5, threshold: 1 }), // good
        ],
      }),
    );

    expect(document.getElementById('statTotal')?.textContent).toBe('3');
    expect(document.getElementById('statLow')?.textContent).toBe('1');
    expect(document.getElementById('statOut')?.textContent).toBe('1');
    expect(document.getElementById('cAll')?.textContent).toBe('3');
    expect(document.getElementById('cGood')?.textContent).toBe('1');
    expect(document.getElementById('cLow')?.textContent).toBe('1');
    expect(document.getElementById('cOut')?.textContent).toBe('1');
  });

  it('filters rows by status while keeping the category grouping', () => {
    render(
      state({
        filter: 'out',
        items: [
          item({ id: '1', name: 'A', category: 'india', qty: 0, threshold: 1 }),
          item({ id: '2', name: 'B', category: 'india', qty: 5, threshold: 1 }),
          item({ id: '3', name: 'C', category: 'daily', qty: 5, threshold: 1 }),
        ],
      }),
    );

    expect(document.querySelectorAll('.category-section').length).toBe(1);
    expect(document.querySelectorAll('.row').length).toBe(1);
    expect(document.querySelector('.name')?.textContent).toBe('A');
  });

  it('filters rows by a case-insensitive search query', () => {
    render(
      state({
        query: 'RI',
        items: [item({ id: '1', name: 'Rice', category: 'bulk' }), item({ id: '2', name: 'Milk', category: 'daily' })],
      }),
    );

    expect(document.querySelectorAll('.row').length).toBe(1);
    expect(document.querySelector('.name')?.textContent).toBe('Rice');
  });

  it('shows the empty state exactly when nothing is visible', () => {
    render(state({ items: [] }));
    expect(document.getElementById('emptyState')?.hidden).toBe(false);

    render(state({ items: [item({ id: '1', name: 'Rice', category: 'bulk' })] }));
    expect(document.getElementById('emptyState')?.hidden).toBe(true);
  });

  it('shows the example banner only while showingExamples is true', () => {
    render(state({ showingExamples: true }));
    expect(document.getElementById('exampleBanner')?.hidden).toBe(false);

    render(state({ showingExamples: false }));
    expect(document.getElementById('exampleBanner')?.hidden).toBe(true);
  });

  it('shows the item count next to each section label', () => {
    render(
      state({
        items: [item({ id: '1', name: 'A', category: 'bulk' }), item({ id: '2', name: 'B', category: 'bulk' })],
      }),
    );

    expect(document.querySelector('.category-count')?.textContent).toBe('2');
  });

  it('toggling a section persists its collapsed state across the next render', () => {
    const oneItem = state({ items: [item({ id: '1', name: 'A', category: 'bulk' })] });

    render(oneItem);
    const details = document.querySelector<HTMLDetailsElement>('.category-section');
    expect(details?.open).toBe(true);

    details!.open = false;
    details!.dispatchEvent(new Event('toggle'));

    render(oneItem);
    const rerendered = document.querySelector<HTMLDetailsElement>('.category-section');
    expect(rerendered?.open).toBe(false);
  });
});
