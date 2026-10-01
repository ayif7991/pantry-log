import type { PantryItem } from './types';
import { getFirestoreDb, isSyncConfigured } from './firebaseClient';

const COLLECTION = 'pantries';

export type SyncStatus = 'disabled' | 'connecting' | 'synced' | 'error';

export interface PantrySyncHandle {
  /** Send the current item list to the shared document. */
  push(items: readonly PantryItem[]): void;
  /** Stop listening for remote changes. */
  stop(): void;
}

/**
 * Keeps a pantry's items in sync with the Firestore document at
 * `pantries/{code}`. `onRemoteItems` fires with the document's current
 * items whenever they change — including once, immediately, with `null` if
 * nothing has been pushed there yet (a brand-new code).
 *
 * Writes made via the returned handle's `push` are not echoed back through
 * `onRemoteItems` (compared by value, not a server round-trip), so a local
 * edit doesn't bounce back and re-trigger itself.
 */
export function startPantrySync(
  code: string,
  onRemoteItems: (items: PantryItem[] | null) => void,
  onStatus?: (status: SyncStatus) => void,
): PantrySyncHandle {
  if (!isSyncConfigured) {
    onStatus?.('disabled');
    return { push: () => {}, stop: () => {} };
  }

  let stopped = false;
  let unsubscribeSnapshot: (() => void) | null = null;
  let lastPushedJson: string | null = null;

  const docRefPromise = (async () => {
    const db = await getFirestoreDb();
    const { doc } = await import('firebase/firestore');
    return doc(db, COLLECTION, code);
  })();

  onStatus?.('connecting');

  void (async () => {
    try {
      const ref = await docRefPromise;
      const { onSnapshot } = await import('firebase/firestore');
      if (stopped) return;

      unsubscribeSnapshot = onSnapshot(
        ref,
        (snapshot) => {
          onStatus?.('synced');
          const data = snapshot.data() as { items?: PantryItem[] } | undefined;
          if (!data?.items) {
            onRemoteItems(null);
            return;
          }
          const json = JSON.stringify(data.items);
          if (json === lastPushedJson) return; // our own write, already applied locally
          onRemoteItems(data.items);
        },
        () => onStatus?.('error'),
      );
    } catch {
      onStatus?.('error');
    }
  })();

  return {
    push(items) {
      if (stopped) return;
      lastPushedJson = JSON.stringify(items);
      void (async () => {
        try {
          const ref = await docRefPromise;
          const { setDoc, serverTimestamp } = await import('firebase/firestore');
          await setDoc(ref, { items, updatedAt: serverTimestamp() });
        } catch {
          onStatus?.('error');
        }
      })();
    },
    stop() {
      stopped = true;
      unsubscribeSnapshot?.();
    },
  };
}
