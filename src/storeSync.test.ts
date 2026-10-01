import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PantryItem } from './types';
import type { NewItemInput } from './store';

// Store's sync wiring (isSyncConfigured === true) needs its own file,
// separate from store.test.ts's unconfigured-by-default tests, since
// vi.mock is hoisted and applies to every test in the file it's declared in.
const { mockHandle, mockStartPantrySync } = vi.hoisted(() => {
  const mockHandle = { push: vi.fn(), stop: vi.fn() };
  const mockStartPantrySync = vi.fn(
    (_code: string, _onRemoteItems: (items: unknown) => void, _onStatus?: (status: string) => void) => mockHandle,
  );
  return { mockHandle, mockStartPantrySync };
});

vi.mock('./firebaseClient', () => ({ isSyncConfigured: true }));
vi.mock('./remoteSync', () => ({ startPantrySync: mockStartPantrySync }));

import { Store } from './store';
import { getStoredPantryCode, isValidPantryCode, setStoredPantryCode } from './pantryCode';

type RemoteItemsCallback = (items: PantryItem[] | null) => void;
type StatusCallback = (status: string) => void;

const newRice: NewItemInput = { name: 'Basmati rice', qty: 5, unit: 'kg', threshold: 2, category: 'bulk' };

function lastSyncCallbacks(): { onRemoteItems: RemoteItemsCallback; onStatus: StatusCallback } {
  const calls = mockStartPantrySync.mock.calls;
  const call = calls[calls.length - 1]!;
  return { onRemoteItems: call[1] as RemoteItemsCallback, onStatus: call[2] as StatusCallback };
}

beforeEach(() => {
  localStorage.clear();
  mockStartPantrySync.mockClear();
  mockHandle.push.mockClear();
  mockHandle.stop.mockClear();
});

describe('Store with sync configured', () => {
  it('generates a pantry code and starts syncing on construction', () => {
    const store = new Store();
    const { sync } = store.getState();

    expect(sync.configured).toBe(true);
    expect(isValidPantryCode(sync.code ?? '')).toBe(true);
    expect(mockStartPantrySync).toHaveBeenCalledWith(sync.code, expect.any(Function), expect.any(Function));
    expect(getStoredPantryCode()).toBe(sync.code);
  });

  it('reuses an already-stored code rather than generating a new one', () => {
    setStoredPantryCode('ABCDEF');
    const store = new Store();

    expect(store.getState().sync.code).toBe('ABCDEF');
  });

  it('pushes the current items to the sync handle on every mutation', () => {
    const store = new Store();
    store.clearExamples();
    mockHandle.push.mockClear();

    store.addItem(newRice);

    expect(mockHandle.push).toHaveBeenCalledWith(store.getState().items);
  });

  it('adopts remote items once the subscription delivers them', () => {
    const store = new Store();
    const { onRemoteItems } = lastSyncCallbacks();

    const remoteItems: PantryItem[] = [
      { id: 'r1', name: 'Remote Item', qty: 2, unit: 'pcs', threshold: 1, category: 'daily' },
    ];
    onRemoteItems(remoteItems);

    expect(store.getState().items).toEqual(remoteItems);
    expect(store.getState().showingExamples).toBe(false);
  });

  it('seeds the remote pantry from local items when the code is brand new', () => {
    const store = new Store();
    const { onRemoteItems } = lastSyncCallbacks();
    mockHandle.push.mockClear();

    onRemoteItems(null); // nothing remote yet for this code

    expect(mockHandle.push).toHaveBeenCalledWith(store.getState().items);
  });

  it('only seeds once per connection, even if called again with null', () => {
    new Store();
    const { onRemoteItems } = lastSyncCallbacks();
    mockHandle.push.mockClear();

    onRemoteItems(null);
    onRemoteItems(null);

    expect(mockHandle.push).toHaveBeenCalledTimes(1);
  });

  it('reflects status updates from the sync callback', () => {
    const store = new Store();
    const { onStatus } = lastSyncCallbacks();

    onStatus('synced');
    expect(store.getState().sync.status).toBe('synced');

    onStatus('error');
    expect(store.getState().sync.status).toBe('error');
  });

  describe('joinPantry', () => {
    it('rejects a malformed code without touching the sync connection', () => {
      const store = new Store();
      mockStartPantrySync.mockClear();

      const result = store.joinPantry('nope');

      expect(result).toEqual({ ok: false, error: expect.any(String) });
      expect(mockStartPantrySync).not.toHaveBeenCalled();
    });

    it('normalizes (uppercases, strips separators) before validating/storing', () => {
      const store = new Store();
      const result = store.joinPantry('ab-cdef');

      expect(result.ok).toBe(true);
      expect(store.getState().sync.code).toBe('ABCDEF');
      expect(getStoredPantryCode()).toBe('ABCDEF');
    });

    it('stops the previous sync connection before starting the new one', () => {
      const store = new Store();

      store.joinPantry('ABCDEF');

      expect(mockHandle.stop).toHaveBeenCalled();
      expect(mockStartPantrySync).toHaveBeenLastCalledWith('ABCDEF', expect.any(Function), expect.any(Function));
    });
  });
});
