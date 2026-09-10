import type { Filter } from './types';
import { Store } from './store';
import { render } from './view';
import { initAddDialog } from './addDialog';
import { initBulkDialog } from './bulkDialog';
import { byId } from './dom';

const FILTERS: readonly Filter[] = ['all', 'good', 'low', 'out'];

function isFilter(value: string | null): value is Filter {
  return value !== null && (FILTERS as readonly string[]).includes(value);
}

/** Build the app: wire the DOM to a Store and keep the view in sync. */
export function startApp(): void {
  const store = new Store();

  store.subscribe(render);

  // ---- list: quantity steppers and delete, via event delegation ----
  byId('list').addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const row = target.closest<HTMLElement>('.row');
    const id = row?.dataset['id'];
    if (!id) return;

    if (target.closest('.inc')) store.changeQty(id, +1);
    else if (target.closest('.dec')) store.changeQty(id, -1);
    else if (target.closest('.del')) store.removeItem(id);
  });

  // ---- filter chips ----
  const chips = byId('filterChips');
  chips.addEventListener('click', (event) => {
    const chip = (event.target as Element).closest<HTMLButtonElement>('.chip');
    if (!chip) return;

    const filter = chip.dataset['filter'] ?? null;
    if (!isFilter(filter)) return;

    store.setFilter(filter);
    for (const c of chips.querySelectorAll<HTMLButtonElement>('.chip')) {
      c.setAttribute('aria-pressed', String(c === chip));
    }
  });

  // ---- search ----
  byId<HTMLInputElement>('searchInput').addEventListener('input', (event) => {
    store.setQuery((event.target as HTMLInputElement).value);
  });

  // ---- example banner ----
  byId('clearExamples').addEventListener('click', () => store.clearExamples());

  // ---- add-item dialogs ----
  initAddDialog((input) => store.addItem(input));
  initBulkDialog((inputs) => store.addItems(inputs));

  // First paint.
  render(store.getState());
}
