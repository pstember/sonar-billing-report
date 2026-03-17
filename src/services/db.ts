/**
 * IndexedDB Database Setup with Dexie
 * Handles persistent storage for tokens, cache, and billing data
 */

import Dexie, { type Table } from 'dexie';
import type { TagMapping, BillingConfiguration, HistoricalSnapshot, CostCenter, CostCenterAssignment } from '../types/billing';

export interface AuthConfig {
  id?: number;
  token: string;
  organization?: string;
  organizationName?: string;
  enterpriseKey?: string; // NEW - for enterprise-level access
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

export interface AppSettings {
  key: string;
  value: unknown;
}

export class SonarBillingDatabase extends Dexie {
  auth!: Table<AuthConfig>;
  tagMappings!: Table<TagMapping & { id?: number }>;
  billingConfig!: Table<BillingConfiguration & { id?: number }>;
  cache!: Table<CacheEntry>;
  settings!: Table<AppSettings>;
  historicalSnapshots!: Table<HistoricalSnapshot & { id?: number }>;
  costCenters!: Table<CostCenter>;
  costCenterAssignments!: Table<CostCenterAssignment>;

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
  }
}

export const db = new SonarBillingDatabase();

/**
 * Auth Management
 */
export async function saveAuthConfig(config: Omit<AuthConfig, 'id' | 'createdAt' | 'lastValidated'>): Promise<number> {
  // Clear existing auth
  await db.auth.clear();

  // Save new config
  return db.auth.add({
    ...config,
    createdAt: new Date().toISOString(),
    lastValidated: new Date().toISOString(),
  });
}

export async function getAuthConfig(): Promise<AuthConfig | undefined> {
  const configs = await db.auth.toArray();
  return configs[0];
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

/**
 * Tag Mapping Management
 */
export async function saveTagMapping(mapping: TagMapping): Promise<number> {
  const existing = await db.tagMappings.where('tag').equals(mapping.tag).first();

  if (existing && existing.id) {
    await db.tagMappings.update(existing.id, mapping);
    return existing.id;
  }

  return db.tagMappings.add(mapping);
}

export async function getTagMappings(): Promise<TagMapping[]> {
  return db.tagMappings.toArray();
}

export async function getTagMapping(tag: string): Promise<TagMapping | undefined> {
  return db.tagMappings.where('tag').equals(tag).first();
}

export async function deleteTagMapping(tag: string): Promise<void> {
  await db.tagMappings.where('tag').equals(tag).delete();
}

export async function importTagMappings(mappings: TagMapping[]): Promise<void> {
  await db.tagMappings.clear();
  await db.tagMappings.bulkAdd(mappings);
}

/**
 * Cost Center Management
 */
export async function getCostCenters(): Promise<CostCenter[]> {
  return db.costCenters.toArray();
}

export async function getCostCenter(id: string): Promise<CostCenter | undefined> {
  return db.costCenters.get(id);
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function saveCostCenter(cc: CostCenter | Omit<CostCenter, 'id'>): Promise<string> {
  const withId: CostCenter = 'id' in cc && cc.id ? cc as CostCenter : { ...cc, id: generateId('cc') };
  await db.costCenters.put(withId);
  return withId.id;
}

export async function deleteCostCenter(id: string): Promise<void> {
  await db.costCenterAssignments.where('costCenterId').equals(id).delete();
  await db.costCenters.delete(id);
}

/**
 * Cost Center Assignment Management
 */
export async function getCostCenterAssignments(costCenterId?: string): Promise<CostCenterAssignment[]> {
  if (costCenterId) {
    return db.costCenterAssignments.where('costCenterId').equals(costCenterId).toArray();
  }
  return db.costCenterAssignments.toArray();
}

export async function getCostCenterAssignment(id: string): Promise<CostCenterAssignment | undefined> {
  return db.costCenterAssignments.get(id);
}

export async function saveCostCenterAssignment(a: CostCenterAssignment | Omit<CostCenterAssignment, 'id'>): Promise<string> {
  const withId: CostCenterAssignment = 'id' in a && a.id ? a as CostCenterAssignment : { ...a, id: generateId('cca') };
  await db.costCenterAssignments.put(withId);
  return withId.id;
}

export async function deleteCostCenterAssignment(id: string): Promise<void> {
  await db.costCenterAssignments.delete(id);
}

/**
 * One-time migration: TagMapping -> CostCenter + CostCenterAssignment
 * Creates one CostCenter per distinct teamName (or costCenter), then one assignment per TagMapping.
 */
export async function migrateTagMappingsToCostCenters(): Promise<void> {
  const mappings = await db.tagMappings.toArray();
  if (mappings.length === 0) return;

  const nameToId = new Map<string, string>();
  for (const m of mappings) {
    const name = (m.costCenter?.trim() || m.teamName?.trim() || 'Unnamed');
    if (!nameToId.has(name)) {
      const id = `cc-${name.toLowerCase().replaceAll(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.costCenters.put({ id, name, code: m.costCenter?.trim() || undefined });
      nameToId.set(name, id);
    }
    const costCenterId = nameToId.get(name)!;
    const assignId = `cca-${m.tag}-${costCenterId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await db.costCenterAssignments.put({
      id: assignId,
      costCenterId,
      type: 'tag',
      tag: m.tag,
      allocationPercentage: Math.min(100, Math.max(0, m.percentage ?? 100)),
    });
  }
}

/**
 * Billing Configuration Management
 */
export async function saveBillingConfig(config: BillingConfiguration): Promise<number> {
  await db.billingConfig.clear();
  return db.billingConfig.add(config);
}

export async function getBillingConfig(): Promise<BillingConfiguration | undefined> {
  const configs = await db.billingConfig.toArray();
  return configs[0];
}

/**
 * Cache Management
 */
export async function setCache<T>(key: string, data: T, ttl = 3600000): Promise<void> {
  await db.cache.put({
    key,
    data,
    timestamp: Date.now(),
    ttl,
  });
}

export async function getCache<T>(key: string): Promise<T | null> {
  const entry = await db.cache.get(key);

  if (!entry) return null;

  // Check if expired
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

/**
 * Settings Management
 */
export async function saveSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.get(key);
  return setting?.value as T | undefined;
}

/**
 * Historical Snapshots Management
 */
export async function saveHistoricalSnapshot(snapshot: HistoricalSnapshot): Promise<number> {
  return db.historicalSnapshots.add(snapshot);
}

export async function getHistoricalSnapshots(params: {
  teamName?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<HistoricalSnapshot[]> {
  let query = db.historicalSnapshots.toCollection();

  if (params.teamName) {
    query = db.historicalSnapshots.where('teamName').equals(params.teamName);
  }

  let results = await query.toArray();

  if (params.fromDate) {
    results = results.filter(s => s.date >= params.fromDate!);
  }

  if (params.toDate) {
    results = results.filter(s => s.date <= params.toDate!);
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export async function clearHistoricalSnapshots(): Promise<void> {
  await db.historicalSnapshots.clear();
}
