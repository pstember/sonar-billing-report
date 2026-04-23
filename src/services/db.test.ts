/**
 * Unit tests for IndexedDB/Dexie service (db.ts).
 * Only covers auth + cache — the tables now served by SQLite have been removed.
 * Uses fake-indexeddb from vitest.setup.ts so Dexie runs in Node.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  saveAuthConfig,
  getAuthConfig,
  updateAuthValidation,
  clearAuth,
  setCache,
  getCache,
  clearCache,
  clearExpiredCache,
  getCacheSize,
} from './db';

async function clearAllTables(): Promise<void> {
  await db.auth.clear();
  await db.cache.clear();
}

describe('Auth', () => {
  beforeEach(clearAllTables);

  it('saveAuthConfig stores config and returns id', async () => {
    const id = await saveAuthConfig({
      token: 'test-token',
      baseUrl: 'https://example.com',
      organization: 'my-org',
      organizationName: 'My Org',
    });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('getAuthConfig returns stored config', async () => {
    await saveAuthConfig({
      token: 'secret',
      baseUrl: 'https://sonar.example.com',
      organization: 'acme',
      organizationName: 'Acme',
    });
    const config = await getAuthConfig();
    expect(config).toBeDefined();
    expect(config?.token).toBe('secret');
    expect(config?.baseUrl).toBe('https://sonar.example.com');
    expect(config?.organization).toBe('acme');
    expect(config?.organizationName).toBe('Acme');
  });

  it('clearAuth removes config', async () => {
    await saveAuthConfig({ token: 'x', baseUrl: 'https://x.com' });
    await clearAuth();
    const config = await getAuthConfig();
    expect(config).toBeUndefined();
  });

  it('saveAuthConfig clears previous auth before saving', async () => {
    await saveAuthConfig({ token: 'first', baseUrl: 'https://a.com' });
    await saveAuthConfig({ token: 'second', baseUrl: 'https://b.com' });
    const config = await getAuthConfig();
    expect(config?.token).toBe('second');
    const all = await db.auth.toArray();
    expect(all).toHaveLength(1);
  });

  it('updateAuthValidation updates lastValidated', async () => {
    await saveAuthConfig({ token: 't', baseUrl: 'https://u.com' });
    const before = await getAuthConfig();
    await new Promise((r) => setTimeout(r, 5));
    await updateAuthValidation();
    const after = await getAuthConfig();
    expect(after?.lastValidated).toBeDefined();
    expect(new Date(after!.lastValidated).getTime()).toBeGreaterThanOrEqual(
      new Date(before!.lastValidated).getTime()
    );
  });
});

describe('Cache', () => {
  beforeEach(clearAllTables);

  it('setCache and getCache return data', async () => {
    await setCache('key1', { foo: 42 });
    const data = await getCache<{ foo: number }>('key1');
    expect(data).toEqual({ foo: 42 });
  });

  it('getCache returns null for missing key', async () => {
    const data = await getCache('nonexistent');
    expect(data).toBeNull();
  });

  it('getCache returns null when entry is expired', async () => {
    await db.cache.put({
      key: 'expired',
      data: { x: 1 },
      timestamp: Date.now() - 10000,
      ttl: 1000,
    });
    const data = await getCache('expired');
    expect(data).toBeNull();
    const size = await getCacheSize();
    expect(size).toBe(0);
  });

  it('clearCache removes all entries', async () => {
    await setCache('k1', 1);
    await setCache('k2', 2);
    await clearCache();
    expect(await getCache('k1')).toBeNull();
    expect(await getCache('k2')).toBeNull();
    expect(await getCacheSize()).toBe(0);
  });

  it('clearExpiredCache removes only expired entries', async () => {
    await setCache('valid', { v: 1 }, 60000);
    await db.cache.put({
      key: 'expired',
      data: {},
      timestamp: Date.now() - 2000,
      ttl: 1000,
    });
    await clearExpiredCache();
    expect(await getCache('valid')).toEqual({ v: 1 });
    expect(await getCache('expired')).toBeNull();
  });

  it('getCacheSize returns count', async () => {
    await setCache('a', 1);
    await setCache('b', 2);
    expect(await getCacheSize()).toBe(2);
  });
});
