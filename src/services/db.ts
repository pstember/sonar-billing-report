/**
 * IndexedDB Database Setup with Dexie
 * Handles persistent storage for: auth session and API response cache.
 * User-configuration data (cost centers, assignments, billing config, etc.)
 * has been migrated to the server-side SQLite store (src/services/store.ts).
 */

import Dexie, { type Table } from 'dexie';

export interface AuthConfig {
  id?: number;
  token: string;
  organization?: string;
  organizationName?: string;
  enterpriseKey?: string;
  baseUrl: string;
  lastValidated: string;
  createdAt: string;
}

export interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class SonarBillingDatabase extends Dexie {
  auth!: Table<AuthConfig>;
  cache!: Table<CacheEntry>;

  constructor() {
    super('SonarBillingDB');

    this.version(1).stores({
      auth: '++id, lastValidated',
      tagMappings: '++id, tag, teamName',
      billingConfig: '++id',
      cache: 'key, timestamp',
      settings: 'key',
      historicalSnapshots: '++id, date, teamName',
    });

    this.version(2).stores({
      auth: '++id, lastValidated',
      tagMappings: '++id, tag, teamName',
      billingConfig: '++id',
      cache: 'key, timestamp',
      settings: 'key',
      historicalSnapshots: '++id, date, teamName',
      costCenters: 'id',
      costCenterAssignments: 'id, costCenterId, projectKey, tag',
    });

    // Version 3: drop the tables now served by SQLite.
    // Dexie needs them listed (even as null) to remove them from the schema;
    // they still exist on disk until a future purge, but are no longer used.
    this.version(3).stores({
      auth: '++id, lastValidated',
      cache: 'key, timestamp',
      tagMappings: null,
      billingConfig: null,
      settings: null,
      historicalSnapshots: null,
      costCenters: null,
      costCenterAssignments: null,
    });
  }
}

export const db = new SonarBillingDatabase();

// ─── Auth Management ──────────────────────────────────────────────────────────

export async function saveAuthConfig(config: Omit<AuthConfig, 'id' | 'createdAt' | 'lastValidated'>): Promise<number> {
  await db.auth.clear();
  return db.auth.add({
    ...config,
    createdAt: new Date().toISOString(),
    lastValidated: new Date().toISOString(),
  }) as Promise<number>;
}

export async function getAuthConfig(): Promise<AuthConfig | undefined> {
  const configs = await db.auth.toArray();
  return configs[0] as AuthConfig | undefined;
}

export async function updateAuthValidation(): Promise<void> {
  const config = await getAuthConfig();
  if (config?.id) {
    await db.auth.update(config.id, {
      lastValidated: new Date().toISOString(),
    });
  }
}

export async function clearAuth(): Promise<void> {
  await db.auth.clear();
}

// ─── Cache Management ─────────────────────────────────────────────────────────

export async function setCache<T>(key: string, data: T, ttl = 3600000): Promise<void> {
  await db.cache.put({ key, data, timestamp: Date.now(), ttl });
}

export async function getCache<T>(key: string): Promise<T | null> {
  const entry = await db.cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    await db.cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export async function clearCache(): Promise<void> {
  await db.cache.clear();
}

export async function clearExpiredCache(): Promise<void> {
  const now = Date.now();
  const entries = await db.cache.toArray();
  const expiredKeys = entries
    .filter(entry => now - entry.timestamp > entry.ttl)
    .map(entry => entry.key);
  await db.cache.bulkDelete(expiredKeys);
}

export async function getCacheSize(): Promise<number> {
  return db.cache.count();
}
