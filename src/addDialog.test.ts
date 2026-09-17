import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountFixture, stubDialogs } from './test/fixture';
import { initAddDialog } from './addDialog';
import type { NewItemInput } from './store';

beforeEach(() => {
  mountFixture();
  stubDialogs();
});

function fill(fields: { name?: string; qty?: string; unit?: string; threshold?: string; category?: string }): void {
  if (fields.name !== undefined) (document.getElementById('fName') as HTMLInputElement).value = fields.name;
  if (fields.qty !== undefined) (document.getElementById('fQty') as HTMLInputElement).value = fields.qty;
  if (fields.unit !== undefined) (document.getElementById('fUnit') as HTMLSelectElement).value = fields.unit;
  if (fields.threshold !== undefined) {
    (document.getElementById('fThresh') as HTMLInputElement).value = fields.threshold;
  }
  if (fields.category !== undefined) {
    (document.getElementById('fCategory') as HTMLSelectElement).value = fields.category;
  }
}

function submit(): void {
  document.getElementById('addForm')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

describe('initAddDialog', () => {
  it('opens the dialog and defaults qty/threshold to 1 when "Add item" is clicked', () => {
    initAddDialog(vi.fn());
    fill({ qty: '9', threshold: '9' });

    document.getElementById('openAdd')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect((document.getElementById('addDialog') as HTMLDialogElement).open).toBe(true);
    expect((document.getElementById('fQty') as HTMLInputElement).value).toBe('1');
    expect((document.getElementById('fThresh') as HTMLInputElement).value).toBe('1');
  });

  it('closes the dialog when Cancel is clicked', () => {
    initAddDialog(vi.fn());
    const dialog = document.getElementById('addDialog') as HTMLDialogElement;
    dialog.open = true;

    document.getElementById('cancelAdd')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(dialog.open).toBe(false);
  });

  it('closes when the backdrop (the dialog element itself) is clicked', () => {
    initAddDialog(vi.fn());
    const dialog = document.getElementById('addDialog') as HTMLDialogElement;
    dialog.open = true;

    dialog.dispatchEvent(new Event('click', { bubbles: true }));

    expect(dialog.open).toBe(false);
  });

  it('does not close when a click inside the dialog bubbles up', () => {
    initAddDialog(vi.fn());
    const dialog = document.getElementById('addDialog') as HTMLDialogElement;
    dialog.open = true;

    document.getElementById('fName')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(dialog.open).toBe(true);
  });

  it('submits a filled-in form as a NewItemInput and closes the dialog', () => {
    const onAdd = vi.fn();
    initAddDialog(onAdd);
    (document.getElementById('addDialog') as HTMLDialogElement).open = true;

    fill({ name: '  Basmati rice  ', qty: '5', unit: 'kg', threshold: '2', category: 'bulk' });
    submit();

    expect(onAdd).toHaveBeenCalledWith({
      name: 'Basmati rice',
      qty: 5,
      unit: 'kg',
      threshold: 2,
      category: 'bulk',
    } satisfies NewItemInput);
    expect((document.getElementById('addDialog') as HTMLDialogElement).open).toBe(false);
  });

  it('does nothing for a blank (or whitespace-only) name', () => {
    const onAdd = vi.fn();
    initAddDialog(onAdd);

    fill({ name: '   ', qty: '1', unit: 'pcs', threshold: '1' });
    submit();

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('falls back to 0 for missing/non-numeric qty and threshold', () => {
    const onAdd = vi.fn();
    initAddDialog(onAdd);

    fill({ name: 'Mystery item', qty: '', threshold: '' });
    submit();

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ qty: 0, threshold: 0 }));
  });
});
