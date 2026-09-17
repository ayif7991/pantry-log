import type { AppState } from './store';
import type { Category, CategoryMeta, PantryItem, Status } from './types';
import { CATEGORIES } from './types';
import { statusOf, statusLabel } from './status';
import { isCollapsed, setCollapsed } from './categoryCollapse';
import { byId, h, svg } from './dom';

const CHEVRON_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 6 15 12 9 18"/>
  </svg>`;

const TRASH_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>`;

// Cache element lookups once.
const els = {
  list: byId('list'),
  emptyState: byId('emptyState'),
  exampleBanner: byId('exampleBanner'),
  statTotal: byId('statTotal'),
  statLow: byId('statLow'),
  statOut: byId('statOut'),
  cAll: byId('cAll'),
  cGood: byId('cGood'),
  cLow: byId('cLow'),
  cOut: byId('cOut'),
};

interface Counts {
  all: number;
  good: number;
  low: number;
  out: number;
}

function countByStatus(items: readonly PantryItem[]): Counts {
  const counts: Counts = { all: items.length, good: 0, low: 0, out: 0 };
  for (const item of items) counts[statusOf(item)]++;
  return counts;
}

function visibleItems(state: AppState): PantryItem[] {
  const query = state.query.trim().toLowerCase();
  return state.items.filter((item) => {
    if (state.filter !== 'all' && statusOf(item) !== state.filter) return false;
    if (query && !item.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

function byCategory(items: readonly PantryItem[], category: Category): PantryItem[] {
  return items.filter((item) => item.category === category);
}

function rowEl(item: PantryItem): HTMLElement {
  const status: Status = statusOf(item);

  const nameCol = h('div', { class: 'name-col' }, [
    h('div', { class: 'name' }, [item.name]),
    h('div', { class: 'meta' }, [`${item.unit} · low at ${item.threshold}`]),
  ]);

  const qty = h('div', { class: 'qty' }, [
    String(item.qty),
    h('span', { class: 'unit' }, [item.unit]),
  ]);
  const stepper = h('div', { class: 'stepper' }, [
    h('button', { type: 'button', class: 'dec', 'aria-label': 'Decrease quantity' }, ['−']),
    qty,
    h('button', { type: 'button', class: 'inc', 'aria-label': 'Increase quantity' }, ['+']),
  ]);

  const pill = h('span', { class: `pill ${status}` }, [statusLabel(status)]);

  const del = h('button', { type: 'button', class: 'del', 'aria-label': `Remove ${item.name}` });
  del.append(svg(TRASH_ICON));

  return h('div', { class: 'row', 'data-id': item.id }, [nameCol, stepper, pill, del]);
}

function sectionEl(meta: CategoryMeta, items: readonly PantryItem[]): HTMLDetailsElement {
  const chevron = svg(CHEVRON_ICON);
  chevron.setAttribute('class', 'chevron');

  const summary = h('summary', { class: 'category-heading' }, [
    chevron,
    h('span', { class: 'category-label' }, [meta.label]),
    h('span', { class: 'category-count' }, [String(items.length)]),
  ]);
  const rows = h('div', { class: 'category-rows' }, items.map(rowEl));

  const attrs: Record<string, string> = { class: 'category-section' };
  if (!isCollapsed(meta.id)) attrs['open'] = '';

  const details = h('details', attrs, [summary, rows]);
  details.addEventListener('toggle', () => setCollapsed(meta.id, !details.open));
  return details;
}

/** Repaint the whole list, stats, and banners from the current state. */
export function render(state: AppState): void {
  const counts = countByStatus(state.items);

  els.statTotal.textContent = String(state.items.length);
  els.statLow.textContent = String(counts.low);
  els.statOut.textContent = String(counts.out);
  els.cAll.textContent = String(counts.all);
  els.cGood.textContent = String(counts.good);
  els.cLow.textContent = String(counts.low);
  els.cOut.textContent = String(counts.out);

  els.exampleBanner.hidden = !state.showingExamples;

  const visible = visibleItems(state);
  const sections = CATEGORIES.map((meta) => ({ meta, items: byCategory(visible, meta.id) })).filter(
    (section) => section.items.length > 0,
  );

  els.list.replaceChildren(...sections.map((section) => sectionEl(section.meta, section.items)));
  els.emptyState.hidden = visible.length !== 0;
}
