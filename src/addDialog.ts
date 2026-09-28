import type { NewItemInput } from './store';
import type { Category, Unit } from './types';
import { DEFAULT_CATEGORY, isCategory, UNITS } from './types';
import { scanProduct } from './productScan';
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
  const categoryInput = byId<HTMLSelectElement>('fCategory');
  const scanBtn = byId<HTMLButtonElement>('scanProduct');
  const fileInput = byId<HTMLInputElement>('productFile');
  const status = byId('productScanStatus');

  const setStatus = (message: string | null): void => {
    status.textContent = message ?? '';
    status.hidden = message === null;
  };

  const open = (): void => {
    form.reset();
    qtyInput.value = '1';
    threshInput.value = '1';
    setStatus(null);
    dialog.showModal();
    nameInput.focus();
  };

  byId('openAdd').addEventListener('click', open);
  byId('cancelAdd').addEventListener('click', () => dialog.close());

  // Click on the backdrop (the dialog element itself) closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  const handleProductPhoto = async (file: File): Promise<void> => {
    scanBtn.disabled = true;
    setStatus('Reading label… 0%');
    try {
      const name = await scanProduct(file, (fraction) => {
        setStatus(`Reading label… ${Math.round(fraction * 100)}%`);
      });

      if (!name) {
        setStatus("Couldn't make out a name — try a sharper, closer photo, or type it below.");
        return;
      }

      nameInput.value = name;
      nameInput.select();
      setStatus('Got it — check the name below, then fill in the rest.');
    } catch (error) {
      console.error('Product scan failed', error);
      setStatus('Could not read that image. Type the item below instead.');
    } finally {
      scanBtn.disabled = false;
    }
  };

  scanBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // allow re-picking the same file
    if (file) void handleProductPhoto(file);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    if (!name) return;

    const rawUnit = unitInput.value;
    const unit: Unit = isUnit(rawUnit) ? rawUnit : 'pcs';
    const category: Category = isCategory(categoryInput.value) ? categoryInput.value : DEFAULT_CATEGORY;

    onAdd({
      name,
      qty: Number.parseFloat(qtyInput.value) || 0,
      unit,
      threshold: Number.parseFloat(threshInput.value) || 0,
      category,
    });

    dialog.close();
  });
}
