import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'pantry-log-collapsed-categories-v1';

// The module reads localStorage exactly once, at import time, into a
// module-level Set. Each test needs a fresh module instance so it can
// control what that initial read sees.
async function freshModule() {
  vi.resetModules();
  return import('./categoryCollapse');
}

beforeEach(() => {
  localStorage.clear();
});

describe('categoryCollapse', () => {
  it('defaults every category to expanded when nothing is stored', async () => {
    const { isCollapsed } = await freshModule();
    expect(isCollapsed('india')).toBe(false);
    expect(isCollapsed('daily')).toBe(false);
    expect(isCollapsed('bulk')).toBe(false);
  });

  it('setCollapsed(true) then isCollapsed reflects it, without affecting other categories', async () => {
    const { isCollapsed, setCollapsed } = await freshModule();

    setCollapsed('india', true);

    expect(isCollapsed('india')).toBe(true);
    expect(isCollapsed('daily')).toBe(false);
    expect(isCollapsed('bulk')).toBe(false);
  });

  it('setCollapsed(false) un-collapses a category', async () => {
    const { isCollapsed, setCollapsed } = await freshModule();

    setCollapsed('india', true);
    setCollapsed('india', false);

    expect(isCollapsed('india')).toBe(false);
  });

  it('persists collapsed categories to localStorage', async () => {
    const { setCollapsed } = await freshModule();

    setCollapsed('india', true);
    setCollapsed('bulk', true);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    expect(new Set(stored)).toEqual(new Set(['india', 'bulk']));
  });

  it('reads previously persisted collapsed categories on load', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['bulk']));

    const { isCollapsed } = await freshModule();

    expect(isCollapsed('bulk')).toBe(true);
    expect(isCollapsed('india')).toBe(false);
  });

  it('falls back to nothing collapsed when storage is corrupted', async () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    const { isCollapsed } = await freshModule();

    expect(isCollapsed('india')).toBe(false);
  });

  it('falls back to nothing collapsed when the stored value is not an array', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ india: true }));

    const { isCollapsed } = await freshModule();

    expect(isCollapsed('india')).toBe(false);
  });
});
