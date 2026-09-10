import type { NewItemInput } from './store';
import { parseBulkInput } from './parseBulk';
import { scanReceipt } from './receiptScan';
import { byId, h } from './dom';

/**
 * Wire up the "Add several items" dialog. Items can be typed/pasted or pulled
 * from a receipt photo; either way they land in the textarea, get a live
 * parse preview, and are handed to `onAdd` on submit.
 */
export function initBulkDialog(onAdd: (inputs: NewItemInput[]) => void): void {
  const dialog = byId<HTMLDialogElement>('bulkDialog');
  const form = byId<HTMLFormElement>('bulkForm');
  const textarea = byId<HTMLTextAreaElement>('bulkText');
  const preview = byId('bulkPreview');
  const submit = byId<HTMLButtonElement>('bulkSubmit');
  const scanBtn = byId<HTMLButtonElement>('scanReceipt');
  const fileInput = byId<HTMLInputElement>('receiptFile');
  const status = byId('scanStatus');

  let parsed: NewItemInput[] = [];

  const refresh = (): void => {
    parsed = parseBulkInput(textarea.value);

    preview.replaceChildren(
      ...parsed.map((item) =>
        h('span', { class: 'bulk-chip' }, [
          h('span', { class: 'bulk-chip-name' }, [item.name]),
          h('span', { class: 'bulk-chip-qty' }, [`${item.qty} ${item.unit}`]),
        ]),
      ),
    );
    preview.hidden = parsed.length === 0;

    submit.disabled = parsed.length === 0;
    submit.textContent =
      parsed.length === 0 ? 'Add items' : `Add ${parsed.length} item${parsed.length === 1 ? '' : 's'}`;
  };

  const setStatus = (message: string | null): void => {
    status.textContent = message ?? '';
    status.hidden = message === null;
  };

  const open = (): void => {
    form.reset();
    setStatus(null);
    refresh();
    dialog.showModal();
    textarea.focus();
  };

  const handleReceipt = async (file: File): Promise<void> => {
    scanBtn.disabled = true;
    setStatus('Reading receipt… 0%');
    try {
      const lines = await scanReceipt(file, (fraction) => {
        setStatus(`Reading receipt… ${Math.round(fraction * 100)}%`);
      });

      if (lines.length === 0) {
        setStatus('No items found — try a sharper, straight-on photo, or type them below.');
        return;
      }

      const existing = textarea.value.trim();
      textarea.value = (existing ? `${existing}\n` : '') + lines.join('\n');
      refresh();
      setStatus(`Found ${lines.length} line${lines.length === 1 ? '' : 's'} — check them before adding.`);
    } catch (error) {
      console.error('Receipt scan failed', error);
      setStatus('Could not read that image. Type the items below instead.');
    } finally {
      scanBtn.disabled = false;
    }
  };

  byId('openBulk').addEventListener('click', open);
  byId('cancelBulk').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  textarea.addEventListener('input', refresh);

  scanBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // allow re-picking the same file
    if (file) void handleReceipt(file);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (parsed.length === 0) return;
    onAdd(parsed);
    dialog.close();
  });
}
