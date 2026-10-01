import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

// isSyncConfigured is computed once at module load from import.meta.env, so
// each scenario needs its own fresh module instance after stubbing env vars.
async function freshModule() {
  vi.resetModules();
  return import('./firebaseClient');
}

beforeEach(() => {
  for (const key of ENV_KEYS) vi.stubEnv(key, '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isSyncConfigured', () => {
  it('is false when no Firebase env vars are set', async () => {
    const { isSyncConfigured } = await freshModule();
    expect(isSyncConfigured).toBe(false);
  });

  it('is false when only some env vars are set', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'key');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'proj');

    const { isSyncConfigured } = await freshModule();
    expect(isSyncConfigured).toBe(false);
  });

  it('is true once every required env var is set', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'key');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'domain');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'proj');
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'app');

    const { isSyncConfigured } = await freshModule();
    expect(isSyncConfigured).toBe(true);
  });
});
