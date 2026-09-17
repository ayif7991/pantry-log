import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountFixture, stubDialogs } from './test/fixture';
import type { NewItemInput } from './store';

vi.mock('./receiptScan', () => ({ scanReceipt: vi.fn() }));

import { scanReceipt } from './receiptScan';
import { initBulkDialog } from './bulkDialog';

const scanReceiptMock = vi.mocked(scanReceipt);

beforeEach(() => {
  scanReceiptMock.mockReset();
  mountFixture();
  stubDialogs();
});

function textarea(): HTMLTextAreaElement {
  return document.getElementById('bulkText') as HTMLTextAreaElement;
}

function submitBtn(): HTMLButtonElement {
  return document.getElementById('bulkSubmit') as HTMLButtonElement;
}

function typeItems(text: string): void {
  const el = textarea();
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function submit(): void {
  document.getElementById('bulkForm')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('typed / pasted entry', () => {
  it('disables submit and hides the preview until there is something parsed', () => {
    initBulkDialog(vi.fn());
    expect(submitBtn().disabled).toBe(true);
    expect(document.getElementById('bulkPreview')?.hidden).toBe(true);
  });

  it('shows a live preview chip per parsed item as the textarea changes', () => {
    initBulkDialog(vi.fn());

    typeItems('rice, pasta x2');

    const chips = document.querySelectorAll('.bulk-chip');
    expect(chips.length).toBe(2);
    expect(chips[0]?.querySelector('.bulk-chip-name')?.textContent).toBe('rice');
    expect(chips[0]?.querySelector('.bulk-chip-qty')?.textContent).toBe('1 pcs');
    expect(chips[1]?.querySelector('.bulk-chip-qty')?.textContent).toBe('2 pcs');
    expect(submitBtn().disabled).toBe(false);
    expect(submitBtn().textContent).toBe('Add 2 items');
    expect(document.getElementById('bulkPreview')?.hidden).toBe(false);
  });

  it('uses singular phrasing for exactly one item', () => {
    initBulkDialog(vi.fn());
    typeItems('rice');
    expect(submitBtn().textContent).toBe('Add 1 item');
  });

  it('submits the parsed items merged with the chosen category, then closes', () => {
    const onAdd = vi.fn();
    initBulkDialog(onAdd);
    (document.getElementById('bulkDialog') as HTMLDialogElement).open = true;

    typeItems('rice, pasta x2');
    (document.getElementById('bulkCategory') as HTMLSelectElement).value = 'india';
    submit();

    expect(onAdd).toHaveBeenCalledWith([
      { name: 'rice', qty: 1, unit: 'pcs', threshold: 1, category: 'india' },
      { name: 'pasta', qty: 2, unit: 'pcs', threshold: 1, category: 'india' },
    ] satisfies NewItemInput[]);
    expect((document.getElementById('bulkDialog') as HTMLDialogElement).open).toBe(false);
  });

  it('does nothing on submit when nothing has been parsed', () => {
    const onAdd = vi.fn();
    initBulkDialog(onAdd);

    submit();

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('resets the form and status when reopened', () => {
    initBulkDialog(vi.fn());
    typeItems('rice');

    document.getElementById('openBulk')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(textarea().value).toBe('');
    expect((document.getElementById('bulkDialog') as HTMLDialogElement).open).toBe(true);
  });

  it('closes on Cancel and on backdrop click', () => {
    initBulkDialog(vi.fn());
    const dialog = document.getElementById('bulkDialog') as HTMLDialogElement;

    dialog.open = true;
    document.getElementById('cancelBulk')!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(dialog.open).toBe(false);

    dialog.open = true;
    dialog.dispatchEvent(new Event('click', { bubbles: true }));
    expect(dialog.open).toBe(false);
  });
});

describe('receipt scanning', () => {
  function selectFile(): void {
    const input = document.getElementById('receiptFile') as HTMLInputElement;
    const file = new File(['fake image bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('clicking "Scan a receipt photo" opens the hidden file input', () => {
    initBulkDialog(vi.fn());
    const input = document.getElementById('receiptFile') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    document.getElementById('scanReceipt')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(clickSpy).toHaveBeenCalled();
  });

  it('fills the textarea with the scanned lines and reports how many were found', async () => {
    scanReceiptMock.mockResolvedValue(['Milk', 'Bread x2']);
    initBulkDialog(vi.fn());

    selectFile();
    await flush();

    expect(textarea().value).toBe('Milk\nBread x2');
    expect(document.getElementById('scanStatus')?.textContent).toContain('Found 2 lines');
    expect(document.querySelectorAll('.bulk-chip').length).toBe(2);
  });

  it('appends scanned lines after anything already typed', async () => {
    scanReceiptMock.mockResolvedValue(['Milk']);
    initBulkDialog(vi.fn());
    typeItems('rice');

    selectFile();
    await flush();

    expect(textarea().value).toBe('rice\nMilk');
  });

  it('reports when no items were found in the photo', async () => {
    scanReceiptMock.mockResolvedValue([]);
    initBulkDialog(vi.fn());

    selectFile();
    await flush();

    expect(document.getElementById('scanStatus')?.textContent).toMatch(/no items found/i);
    expect(textarea().value).toBe('');
  });

  it('reports an error and leaves the textarea usable if scanning throws', async () => {
    scanReceiptMock.mockRejectedValue(new Error('ocr blew up'));
    initBulkDialog(vi.fn());

    selectFile();
    await flush();

    expect(document.getElementById('scanStatus')?.textContent).toMatch(/could not read that image/i);
    const scanBtn = document.getElementById('scanReceipt') as HTMLButtonElement;
    expect(scanBtn.disabled).toBe(false); // re-enabled after failure
  });

  it('disables the scan button while a scan is in flight', async () => {
    let resolveScan!: (lines: string[]) => void;
    scanReceiptMock.mockReturnValue(new Promise((resolve) => (resolveScan = resolve)));
    initBulkDialog(vi.fn());

    selectFile();
    await flush();

    const scanBtn = document.getElementById('scanReceipt') as HTMLButtonElement;
    expect(scanBtn.disabled).toBe(true);

    resolveScan(['Milk']);
    await flush();

    expect(scanBtn.disabled).toBe(false);
  });
});
