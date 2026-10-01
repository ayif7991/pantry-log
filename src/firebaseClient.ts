/**
 * Lazily-initialized Firebase app + Firestore instance for cross-device
 * sync. Firebase is only imported (a meaningful chunk of JS) if a project
 * has actually been configured via VITE_FIREBASE_* env vars — an app with
 * none set still works perfectly well as a local-only pantry.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True once every required Firebase env var is present. */
export const isSyncConfigured: boolean = Object.values(config).every((v) => typeof v === 'string' && v.length > 0);

type Firestore = import('firebase/firestore').Firestore;

let dbPromise: Promise<Firestore> | null = null;

/** Resolves to a ready Firestore instance. Only call this when {@link isSyncConfigured} is true. */
export function getFirestoreDb(): Promise<Firestore> {
  dbPromise ??= initFirestore();
  return dbPromise;
}

async function initFirestore(): Promise<Firestore> {
  const { initializeApp } = await import('firebase/app');
  const { initializeFirestore, persistentLocalCache } = await import('firebase/firestore');

  // Only called when isSyncConfigured is true, so these are guaranteed set.
  const app = initializeApp({
    apiKey: config.apiKey!,
    authDomain: config.authDomain!,
    projectId: config.projectId!,
    appId: config.appId!,
  });

  return initializeFirestore(app, { localCache: persistentLocalCache({}) });
}
