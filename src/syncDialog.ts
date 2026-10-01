import type { Store } from './store';
import type { SyncStatus } from './remoteSync';
import { byId } from './dom';

/** Only the slice of Store this dialog actually needs — easy to fake in tests, no private-member baggage. */
type SyncStore = Pick<Store, 'getState' | 'subscribe' | 'joinPantry'>;

/** Wire up the "Sync across devices" dialog: shows this device's pantry code and lets another device join it. */
export function initSyncDialog(store: SyncStore): void {
  const dialog = byId<HTMLDialogElement>('syncDialog');
  const unconfigured = byId('syncUnconfigured');
  const configured = byId('syncConfigured');
  const codeEl = byId('syncCode');
  const copyBtn = byId<HTMLButtonElement>('copyCode');
  const statusText = byId('syncStatusText');
  const joinForm = byId<HTMLFormElement>('joinForm');
  const joinInput = byId<HTMLInputElement>('joinCode');
  const joinStatus = byId('joinStatus');

  const render = (): void => {
    const { sync } = store.getState();
    unconfigured.hidden = sync.configured;
    configured.hidden = !sync.configured;
    if (!sync.configured) return;

    codeEl.textContent = sync.code ?? '——————';
    statusText.textContent = statusLabel(sync.status);
  };

  store.subscribe(render);
  render();

  byId('openSync').addEventListener('click', () => {
    joinForm.reset();
    joinStatus.hidden = true;
    render();
    dialog.showModal();
  });

  byId('closeSync').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  copyBtn.addEventListener('click', () => {
    const code = store.getState().sync.code;
    if (!code) return;
    void copyToClipboard(code).then((ok) => {
      const original = 'Copy';
      copyBtn.textContent = ok ? 'Copied!' : "Couldn't copy";
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1500);
    });
  });

  joinForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const result = store.joinPantry(joinInput.value);
    if (result.ok) {
      joinInput.value = '';
      joinStatus.hidden = true;
    } else {
      joinStatus.textContent = result.error;
      joinStatus.hidden = false;
    }
  });
}

function statusLabel(status: SyncStatus): string {
  switch (status) {
    case 'connecting':
      return 'Connecting…';
    case 'synced':
      return 'Synced';
    case 'error':
      return 'Sync error — changes are still saved on this device.';
    case 'disabled':
      return '';
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
