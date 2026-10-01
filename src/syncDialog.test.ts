import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountFixture, stubDialogs } from './test/fixture';
import { initSyncDialog } from './syncDialog';
import type { AppState, JoinPantryResult, SyncState } from './store';

/** A minimal stand-in for Store, exposing only what initSyncDialog needs. */
function makeFakeStore(initialSync: SyncState) {
  let state: AppState = { items: [], filter: 'all', query: '', showingExamples: false, sync: initialSync };
  const listeners = new Set<(state: AppState) => void>();

  const notify = (): void => {
    for (const listener of listeners) listener(state);
  };

  return {
    getState: (): Readonly<AppState> => state,
    subscribe: (listener: (state: AppState) => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    joinPantry: vi.fn((code: string): JoinPantryResult => {
      if (code !== 'ABCDEF') return { ok: false, error: 'That code doesn’t look right.' };
      state = { ...state, sync: { ...state.sync, code: 'ABCDEF' } };
      notify();
      return { ok: true };
    }),
    // test-only helper, not part of the real Store surface
    setSync: (sync: SyncState): void => {
      state = { ...state, sync };
      notify();
    },
  };
}

beforeEach(() => {
  mountFixture();
  stubDialogs();
});

function elements() {
  return {
    dialog: document.getElementById('syncDialog') as HTMLDialogElement,
    unconfigured: document.getElementById('syncUnconfigured') as HTMLElement,
    configured: document.getElementById('syncConfigured') as HTMLElement,
    code: document.getElementById('syncCode') as HTMLElement,
    statusText: document.getElementById('syncStatusText') as HTMLElement,
    joinInput: document.getElementById('joinCode') as HTMLInputElement,
    joinForm: document.getElementById('joinForm') as HTMLFormElement,
    joinStatus: document.getElementById('joinStatus') as HTMLElement,
  };
}

describe('initSyncDialog', () => {
  it('shows the "not configured" message when sync is unavailable', () => {
    initSyncDialog(makeFakeStore({ configured: false, code: null, status: 'disabled' }));
    const { unconfigured, configured } = elements();

    expect(unconfigured.hidden).toBe(false);
    expect(configured.hidden).toBe(true);
  });

  it('shows the pantry code and status when sync is configured', () => {
    initSyncDialog(makeFakeStore({ configured: true, code: 'ABCDEF', status: 'synced' }));
    const { unconfigured, configured, code, statusText } = elements();

    expect(unconfigured.hidden).toBe(true);
    expect(configured.hidden).toBe(false);
    expect(code.textContent).toBe('ABCDEF');
    expect(statusText.textContent).toBe('Synced');
  });

  it('updates live when the store reports a new status', () => {
    const store = makeFakeStore({ configured: true, code: 'ABCDEF', status: 'connecting' });
    initSyncDialog(store);

    expect(elements().statusText.textContent).toBe('Connecting…');

    store.setSync({ configured: true, code: 'ABCDEF', status: 'error' });
    expect(elements().statusText.textContent).toMatch(/sync error/i);
  });

  it('opens the dialog when "Sync" is clicked, resetting the join form', () => {
    initSyncDialog(makeFakeStore({ configured: true, code: 'ABCDEF', status: 'synced' }));
    const { dialog, joinInput, joinStatus } = elements();
    joinInput.value = 'leftover';
    joinStatus.hidden = false;

    document.getElementById('openSync')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(dialog.open).toBe(true);
    expect(joinInput.value).toBe('');
    expect(joinStatus.hidden).toBe(true);
  });

  it('closes on "Done" and on backdrop click', () => {
    initSyncDialog(makeFakeStore({ configured: true, code: 'ABCDEF', status: 'synced' }));
    const { dialog } = elements();

    dialog.open = true;
    document.getElementById('closeSync')!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(dialog.open).toBe(false);

    dialog.open = true;
    dialog.dispatchEvent(new Event('click', { bubbles: true }));
    expect(dialog.open).toBe(false);
  });

  it('submitting a valid join code clears the input and any error', () => {
    const store = makeFakeStore({ configured: true, code: 'ZZZZZZ', status: 'synced' });
    initSyncDialog(store);
    const { joinInput, joinForm, joinStatus } = elements();

    joinInput.value = 'ABCDEF';
    joinForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    expect(store.joinPantry).toHaveBeenCalledWith('ABCDEF');
    expect(joinInput.value).toBe('');
    expect(joinStatus.hidden).toBe(true);
    expect(elements().code.textContent).toBe('ABCDEF');
  });

  it('submitting an invalid join code shows the error and keeps the input', () => {
    const store = makeFakeStore({ configured: true, code: 'ZZZZZZ', status: 'synced' });
    initSyncDialog(store);
    const { joinInput, joinForm, joinStatus } = elements();

    joinInput.value = 'nope';
    joinForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    expect(joinStatus.hidden).toBe(false);
    expect(joinStatus.textContent).toMatch(/doesn.t look right/i);
    expect(joinInput.value).toBe('nope');
  });

  it('copying the code shows brief confirmation text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    initSyncDialog(makeFakeStore({ configured: true, code: 'ABCDEF', status: 'synced' }));
    document.getElementById('copyCode')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(writeText).toHaveBeenCalledWith('ABCDEF');
    await vi.waitFor(() => expect(document.getElementById('copyCode')!.textContent).toBe('Copied!'));
  });
});
