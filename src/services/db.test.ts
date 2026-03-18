/**
 * Unit tests for IndexedDB/Dexie service (db.ts).
 * Uses fake-indexeddb from vitest.setup.ts so Dexie runs in Node.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  saveAuthConfig,
  getAuthConfig,
  updateAuthValidation,
  clearAuth,
  saveTagMapping,
  getTagMappings,
  getTagMapping,
  deleteTagMapping,
  importTagMappings,
  getCostCenters,
  getCostCenter,
  saveCostCenter,
  deleteCostCenter,
  getCostCenterAssignments,
  getCostCenterAssignment,
  saveCostCenterAssignment,
  deleteCostCenterAssignment,
  migrateTagMappingsToCostCenters,
  saveBillingConfig,
  getBillingConfig,
  setCache,
  getCache,
  clearCache,
  clearExpiredCache,
  getCacheSize,
  saveSetting,
  getSetting,
  saveHistoricalSnapshot,
  getHistoricalSnapshots,
  clearHistoricalSnapshots,
} from './db';

async function clearAllTables(): Promise<void> {
  await db.auth.clear();
  await db.tagMappings.clear();
  await db.billingConfig.clear();
  await db.cache.clear();
  await db.settings.clear();
  await db.historicalSnapshots.clear();
  await db.costCenterAssignments.clear();
  await db.costCenters.clear();
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

describe('Tag mappings', () => {
  beforeEach(clearAllTables);

  it('saveTagMapping adds new mapping and returns id', async () => {
    const id = await saveTagMapping({
      tag: 'team-a',
      teamName: 'Team A',
      percentage: 100,
    });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
    const m = await getTagMapping('team-a');
    expect(m?.teamName).toBe('Team A');
    expect(m?.percentage).toBe(100);
  });

  it('saveTagMapping updates existing mapping by tag', async () => {
    const id1 = await saveTagMapping({
      tag: 't1',
      teamName: 'Team 1',
      percentage: 100,
    });
    const id2 = await saveTagMapping({
      tag: 't1',
      teamName: 'Team 1 Updated',
      percentage: 50,
    });
    expect(id2).toBe(id1);
    const m = await getTagMapping('t1');
    expect(m?.teamName).toBe('Team 1 Updated');
    expect(m?.percentage).toBe(50);
  });

  it('getTagMappings returns all mappings', async () => {
    await saveTagMapping({ tag: 'a', teamName: 'A', percentage: 100 });
    await saveTagMapping({ tag: 'b', teamName: 'B', percentage: 100 });
    const list = await getTagMappings();
    expect(list).toHaveLength(2);
  });

  it('getTagMapping returns undefined for missing tag', async () => {
    const m = await getTagMapping('nonexistent');
    expect(m).toBeUndefined();
  });

  it('deleteTagMapping removes mapping', async () => {
    await saveTagMapping({ tag: 'del', teamName: 'Del', percentage: 100 });
    await deleteTagMapping('del');
    expect(await getTagMapping('del')).toBeUndefined();
  });

  it('importTagMappings replaces all mappings', async () => {
    await saveTagMapping({ tag: 'old', teamName: 'Old', percentage: 100 });
    await importTagMappings([
      { tag: 'n1', teamName: 'New1', percentage: 100 },
      { tag: 'n2', teamName: 'New2', percentage: 100 },
    ]);
    const list = await getTagMappings();
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.tag).sort()).toEqual(['n1', 'n2']);
  });
});

describe('Cost centers', () => {
  beforeEach(clearAllTables);

  it('saveCostCenter adds and returns id', async () => {
    const id = await saveCostCenter({ name: 'Engineering', code: 'ENG' });
    expect(id).toMatch(/^cc-/);
    const cc = await getCostCenter(id);
    expect(cc?.name).toBe('Engineering');
    expect(cc?.code).toBe('ENG');
  });

  it('getCostCenters returns all', async () => {
    await saveCostCenter({ name: 'A', code: 'A' });
    await saveCostCenter({ name: 'B', code: 'B' });
    const list = await getCostCenters();
    expect(list).toHaveLength(2);
  });

  it('getCostCenter returns undefined for missing id', async () => {
    const cc = await getCostCenter('missing-id');
    expect(cc).toBeUndefined();
  });

  it('deleteCostCenter removes center and its assignments', async () => {
    const id = await saveCostCenter({ name: 'X', code: 'X' });
    await saveCostCenterAssignment({
      costCenterId: id,
      type: 'tag',
      tag: 't1',
      allocationPercentage: 100,
    });
    await deleteCostCenter(id);
    expect(await getCostCenter(id)).toBeUndefined();
    expect(await getCostCenterAssignments(id)).toHaveLength(0);
  });
});

describe('migrateTagMappingsToCostCenters', () => {
  beforeEach(clearAllTables);

  it('does nothing when no tag mappings exist', async () => {
    await migrateTagMappingsToCostCenters();
    expect(await getCostCenters()).toHaveLength(0);
    expect(await getCostCenterAssignments()).toHaveLength(0);
  });

  it('creates one cost center per distinct teamName and assignments per mapping', async () => {
    await saveTagMapping({
      tag: 'tag1',
      teamName: 'Engineering',
      percentage: 100,
    });
    await saveTagMapping({
      tag: 'tag2',
      teamName: 'Engineering',
      percentage: 100,
    });
    await saveTagMapping({
      tag: 'tag3',
      teamName: 'Product',
      percentage: 100,
    });
    await migrateTagMappingsToCostCenters();
    const centers = await getCostCenters();
    expect(centers.length).toBeGreaterThanOrEqual(2);
    const assignments = await getCostCenterAssignments();
    expect(assignments).toHaveLength(3);
  });

  it('uses costCenter field when present on tag mapping', async () => {
    await db.tagMappings.add({
      tag: 't1',
      teamName: 'Team A',
      costCenter: 'Cost Center A',
      percentage: 100,
    });
    await migrateTagMappingsToCostCenters();
    const centers = await getCostCenters();
    expect(centers.some((c) => c.name === 'Cost Center A' || c.code === 'Cost Center A')).toBe(true);
  });
});

describe('Cost center assignments', () => {
  beforeEach(clearAllTables);

  it('saveCostCenterAssignment adds and returns id', async () => {
    const ccId = await saveCostCenter({ name: 'CC', code: 'C' });
    const aId = await saveCostCenterAssignment({
      costCenterId: ccId,
      type: 'tag',
      tag: 'team-x',
      allocationPercentage: 100,
    });
    expect(aId).toMatch(/^cca-/);
    const a = await getCostCenterAssignment(aId);
    expect(a?.tag).toBe('team-x');
    expect(a?.costCenterId).toBe(ccId);
  });

  it('getCostCenterAssignments with costCenterId filters', async () => {
    const cc1 = await saveCostCenter({ name: 'C1', code: '1' });
    const cc2 = await saveCostCenter({ name: 'C2', code: '2' });
    await saveCostCenterAssignment({
      costCenterId: cc1,
      type: 'tag',
      tag: 't1',
      allocationPercentage: 100,
    });
    await saveCostCenterAssignment({
      costCenterId: cc2,
      type: 'tag',
      tag: 't2',
      allocationPercentage: 100,
    });
    const forCc1 = await getCostCenterAssignments(cc1);
    expect(forCc1).toHaveLength(1);
    expect(forCc1[0].tag).toBe('t1');
    const all = await getCostCenterAssignments();
    expect(all).toHaveLength(2);
  });

  it('deleteCostCenterAssignment removes assignment', async () => {
    const ccId = await saveCostCenter({ name: 'C', code: 'C' });
    const aId = await saveCostCenterAssignment({
      costCenterId: ccId,
      type: 'project',
      projectKey: 'proj-1',
      allocationPercentage: 100,
    });
    await deleteCostCenterAssignment(aId);
    expect(await getCostCenterAssignment(aId)).toBeUndefined();
  });
});

describe('Billing config', () => {
  beforeEach(clearAllTables);

  it('saveBillingConfig and getBillingConfig', async () => {
    const config = {
      currency: 'USD',
      defaultRate: 2.5,
      contractValue: 10000,
    };
    await saveBillingConfig(config);
    const got = await getBillingConfig();
    expect(got?.currency).toBe('USD');
    expect(got?.defaultRate).toBe(2.5);
    expect(got?.contractValue).toBe(10000);
  });

  it('saveBillingConfig clears previous config', async () => {
    await saveBillingConfig({ currency: 'USD', defaultRate: 1 });
    await saveBillingConfig({ currency: 'EUR', defaultRate: 2 });
    const got = await getBillingConfig();
    expect(got?.currency).toBe('EUR');
    const all = await db.billingConfig.toArray();
    expect(all).toHaveLength(1);
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

describe('Settings', () => {
  beforeEach(clearAllTables);

  it('saveSetting and getSetting', async () => {
    await saveSetting('theme', 'dark');
    const value = await getSetting<string>('theme');
    expect(value).toBe('dark');
  });

  it('getSetting returns undefined for missing key', async () => {
    const value = await getSetting('missing');
    expect(value).toBeUndefined();
  });

  it('saveSetting overwrites', async () => {
    await saveSetting('key', 'first');
    await saveSetting('key', 'second');
    expect(await getSetting('key')).toBe('second');
  });
});

describe('Historical snapshots', () => {
  beforeEach(clearAllTables);

  it('saveHistoricalSnapshot and getHistoricalSnapshots', async () => {
    await saveHistoricalSnapshot({
      date: '2024-01-15',
      teamName: 'Team A',
      ncloc: 1000,
      cost: 2500,
    });
    await saveHistoricalSnapshot({
      date: '2024-01-16',
      teamName: 'Team A',
      ncloc: 1100,
      cost: 2750,
    });
    const list = await getHistoricalSnapshots({});
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.date)).toEqual(['2024-01-15', '2024-01-16']);
  });

  it('getHistoricalSnapshots filters by teamName', async () => {
    await saveHistoricalSnapshot({
      date: '2024-01-01',
      teamName: 'Team A',
      ncloc: 100,
      cost: 100,
    });
    await saveHistoricalSnapshot({
      date: '2024-01-01',
      teamName: 'Team B',
      ncloc: 200,
      cost: 200,
    });
    const teamA = await getHistoricalSnapshots({ teamName: 'Team A' });
    expect(teamA).toHaveLength(1);
    expect(teamA[0].teamName).toBe('Team A');
  });

  it('getHistoricalSnapshots filters by fromDate and toDate', async () => {
    await saveHistoricalSnapshot({
      date: '2024-01-10',
      teamName: 'T',
      ncloc: 10,
      cost: 10,
    });
    await saveHistoricalSnapshot({
      date: '2024-01-20',
      teamName: 'T',
      ncloc: 20,
      cost: 20,
    });
    await saveHistoricalSnapshot({
      date: '2024-01-30',
      teamName: 'T',
      ncloc: 30,
      cost: 30,
    });
    const mid = await getHistoricalSnapshots({
      fromDate: '2024-01-15',
      toDate: '2024-01-25',
    });
    expect(mid).toHaveLength(1);
    expect(mid[0].date).toBe('2024-01-20');
  });

  it('clearHistoricalSnapshots removes all', async () => {
    await saveHistoricalSnapshot({
      date: '2024-01-01',
      teamName: 'T',
      ncloc: 1,
      cost: 1,
    });
    await clearHistoricalSnapshots();
    expect(await getHistoricalSnapshots({})).toHaveLength(0);
  });
});
