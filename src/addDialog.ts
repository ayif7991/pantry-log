import type { NewItemInput } from './store';
import type { Unit } from './types';
import { UNITS } from './types';
import { byId } from './dom';

function isUnit(value: string): value is Unit {
  return (UNITS as readonly string[]).includes(value);
}

/**
 * Wire up the "Add pantry item" dialog. Calls `onAdd` with a validated item
 * when the form is submitted.
 */
export function initAddDialog(onAdd: (input: NewItemInput) => void): void {
  const dialog = byId<HTMLDialogElement>('addDialog');
  const form = byId<HTMLFormElement>('addForm');
  const nameInput = byId<HTMLInputElement>('fName');
  const qtyInput = byId<HTMLInputElement>('fQty');
  const unitInput = byId<HTMLSelectElement>('fUnit');
  const threshInput = byId<HTMLInputElement>('fThresh');

  const open = (): void => {
    form.reset();
    qtyInput.value = '1';
    threshInput.value = '1';
    dialog.showModal();
    nameInput.focus();
  };

  byId('openAdd').addEventListener('click', open);
  byId('cancelAdd').addEventListener('click', () => dialog.close());

  // Click on the backdrop (the dialog element itself) closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    if (!name) return;

    const rawUnit = unitInput.value;
    const unit: Unit = isUnit(rawUnit) ? rawUnit : 'pcs';

    onAdd({
      name,
      qty: Number.parseFloat(qtyInput.value) || 0,
      unit,
      threshold: Number.parseFloat(threshInput.value) || 0,
    });

    dialog.close();
  });
}
