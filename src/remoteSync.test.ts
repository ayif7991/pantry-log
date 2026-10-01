import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PantryItem } from './types';

const { mockDb } = vi.hoisted(() => ({ mockDb: { __fakeDb: true } }));

vi.mock('./firebaseClient', () => ({
  isSyncConfigured: true,
  getFirestoreDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, collection: string, id: string) => ({ __collection: collection, __id: id })),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { startPantrySync } from './remoteSync';

// The real onSnapshot/doc signatures are heavily overloaded; tests only
// need "a function that was called with these args", so cast the mocks to
// something easy to drive instead of fighting Firestore's overload set.
const docMock = doc as unknown as ReturnType<typeof vi.fn>;
const setDocMock = setDoc as unknown as ReturnType<typeof vi.fn>;
const onSnapshotMock = onSnapshot as unknown as ReturnType<typeof vi.fn>;

type SnapshotCallback = (snapshot: { data: () => { items?: PantryItem[] } | undefined }) => void;
type ErrorCallback = (error: Error) => void;

const item: PantryItem = { id: '1', name: 'Milk', qty: 1, unit: 'l', threshold: 1, category: 'daily' };

/** Setting up the Firestore subscription goes through a couple of awaited dynamic imports before onSnapshot is actually called — wait for that instead of guessing a tick count. */
async function waitForSubscription(): Promise<void> {
  await vi.waitFor(() => expect(onSnapshotMock).toHaveBeenCalled());
}

async function waitForPush(): Promise<void> {
  await vi.waitFor(() => expect(setDocMock).toHaveBeenCalled());
}

beforeEach(() => {
  docMock.mockClear();
  setDocMock.mockReset().mockResolvedValue(undefined);
  onSnapshotMock.mockReset();
});

describe('startPantrySync', () => {
  it('opens the pantry\'s document and reports "connecting" immediately', async () => {
    onSnapshotMock.mockImplementation(() => vi.fn());

    const onStatus = vi.fn();
    startPantrySync('ABCDEF', vi.fn(), onStatus);
    await waitForSubscription();

    expect(docMock).toHaveBeenCalledWith(mockDb, 'pantries', 'ABCDEF');
    expect(onStatus).toHaveBeenCalledWith('connecting');
  });

  it('reports "synced" and forwards items from a snapshot', async () => {
    let onNext!: SnapshotCallback;
    onSnapshotMock.mockImplementation((_ref: unknown, next: SnapshotCallback) => {
      onNext = next;
      return vi.fn();
    });

    const onItems = vi.fn();
    const onStatus = vi.fn();
    startPantrySync('ABCDEF', onItems, onStatus);
    await waitForSubscription();

    onNext({ data: () => ({ items: [item] }) });

    expect(onStatus).toHaveBeenCalledWith('synced');
    expect(onItems).toHaveBeenCalledWith([item]);
  });

  it('reports null items when the document does not exist yet', async () => {
    onSnapshotMock.mockImplementation((_ref: unknown, next: SnapshotCallback) => {
      next({ data: () => undefined });
      return vi.fn();
    });

    const onItems = vi.fn();
    startPantrySync('ABCDEF', onItems);
    await waitForSubscription();

    expect(onItems).toHaveBeenCalledWith(null);
  });

  it('push() writes the items with a server timestamp to the pantry document', async () => {
    onSnapshotMock.mockImplementation(() => vi.fn());

    const handle = startPantrySync('ABCDEF', vi.fn());
    await waitForSubscription();
    handle.push([item]);
    await waitForPush();

    expect(setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ __id: 'ABCDEF' }),
      { items: [item], updatedAt: 'SERVER_TIMESTAMP' },
    );
  });

  it('suppresses the snapshot echo of a value just pushed', async () => {
    let onNext!: SnapshotCallback;
    onSnapshotMock.mockImplementation((_ref: unknown, next: SnapshotCallback) => {
      onNext = next;
      return vi.fn();
    });

    const onItems = vi.fn();
    const handle = startPantrySync('ABCDEF', onItems);
    await waitForSubscription();

    handle.push([item]);
    await waitForPush();
    onItems.mockClear();

    onNext({ data: () => ({ items: [item] }) }); // Firestore echoing our own write back
    expect(onItems).not.toHaveBeenCalled();
  });

  it('still forwards a genuinely different remote change after a push', async () => {
    let onNext!: SnapshotCallback;
    onSnapshotMock.mockImplementation((_ref: unknown, next: SnapshotCallback) => {
      onNext = next;
      return vi.fn();
    });

    const onItems = vi.fn();
    const handle = startPantrySync('ABCDEF', onItems);
    await waitForSubscription();

    handle.push([item]);
    await waitForPush();
    onItems.mockClear();

    const other: PantryItem = { ...item, id: '2', name: 'Bread' };
    onNext({ data: () => ({ items: [item, other] }) });
    expect(onItems).toHaveBeenCalledWith([item, other]);
  });

  it('reports "error" if the subscription itself errors', async () => {
    onSnapshotMock.mockImplementation((_ref: unknown, _next: SnapshotCallback, onError: ErrorCallback) => {
      onError(new Error('boom'));
      return vi.fn();
    });

    const onStatus = vi.fn();
    startPantrySync('ABCDEF', vi.fn(), onStatus);
    await vi.waitFor(() => expect(onStatus).toHaveBeenCalledWith('error'));
  });

  it('stop() unsubscribes, and push() afterward is a no-op', async () => {
    const unsubscribe = vi.fn();
    onSnapshotMock.mockImplementation(() => unsubscribe);

    const handle = startPantrySync('ABCDEF', vi.fn());
    await waitForSubscription();

    handle.stop();
    expect(unsubscribe).toHaveBeenCalled();

    setDocMock.mockClear();
    handle.push([item]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(setDocMock).not.toHaveBeenCalled();
  });
});

describe('startPantrySync when sync is not configured', () => {
  it('reports "disabled" and never touches Firestore', async () => {
    vi.resetModules();
    vi.doMock('./firebaseClient', () => ({
      isSyncConfigured: false,
      getFirestoreDb: vi.fn(),
    }));

    const { startPantrySync: startDisabled } = await import('./remoteSync');
    const onStatus = vi.fn();
    const handle = startDisabled('ABCDEF', vi.fn(), onStatus);

    expect(onStatus).toHaveBeenCalledWith('disabled');
    expect(() => handle.push([item])).not.toThrow();
    expect(docMock).not.toHaveBeenCalled();

    vi.doUnmock('./firebaseClient');
  });
});
