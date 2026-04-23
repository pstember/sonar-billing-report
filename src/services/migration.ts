/**
 * One-time migration: IndexedDB/Dexie → server-side SQLite store.
 * Reads legacy data from IndexedDB before the Dexie v3 upgrade drops those tables,
 * then POSTs it to /store/migrate. Guards against running twice with localStorage flag.
 */

import Dexie from 'dexie';
import { migrateFromIndexedDB } from './store';
import type {
  CostCenter,
  CostCenterAssignment,
  BillingConfiguration,
  TagMapping,
  HistoricalSnapshot,
} from '../types/billing';

const MIGRATION_FLAG = 'sonar_billing_migrated_to_sqlite';

interface LegacyRow {
  id?: number | string;
  [key: string]: unknown;
}

/** Returns true if migration has already run. */
export function isMigrated(): boolean {
  return localStorage.getItem(MIGRATION_FLAG) === '1';
}

/**
 * Run once on startup.
 * Opens a temporary Dexie connection at v2 schema (before the main db upgrades to v3),
 * reads all config tables, sends to /store/migrate, then marks complete.
 */
export async function runMigrationIfNeeded(): Promise<void> {
  if (isMigrated()) return;

  // Open a snapshot at v2 — this lets us read the tables that v3 will drop.
  const legacyDb = new Dexie('SonarBillingDB');
  legacyDb.version(2).stores({
    auth: '++id, lastValidated',
    tagMappings: '++id, tag, teamName',
    billingConfig: '++id',
    cache: 'key, timestamp',
    settings: 'key',
    historicalSnapshots: '++id, date, teamName',
    costCenters: 'id',
    costCenterAssignments: 'id, costCenterId, projectKey, tag',
  });

  try {
    const [costCenters, costCenterAssignments, billingConfigs, tagMappings, settings, snapshots] =
      await Promise.all([
        (legacyDb.table('costCenters').toArray() as Promise<LegacyRow[]>).catch(() => [] as LegacyRow[]),
        (legacyDb.table('costCenterAssignments').toArray() as Promise<LegacyRow[]>).catch(() => [] as LegacyRow[]),
        (legacyDb.table('billingConfig').toArray() as Promise<LegacyRow[]>).catch(() => [] as LegacyRow[]),
        (legacyDb.table('tagMappings').toArray() as Promise<LegacyRow[]>).catch(() => [] as LegacyRow[]),
        (legacyDb.table('settings').toArray() as Promise<LegacyRow[]>).catch(() => [] as LegacyRow[]),
        (legacyDb.table('historicalSnapshots').toArray() as Promise<LegacyRow[]>).catch(() => [] as LegacyRow[]),
      ]);

    // Convert settings array to object
    const settingsObj: Record<string, unknown> = {};
    for (const s of settings) {
      if (typeof s.key === 'string') {
        settingsObj[s.key] = s.value;
      }
    }

    await migrateFromIndexedDB({
      costCenters: costCenters as unknown as CostCenter[],
      costCenterAssignments: costCenterAssignments as unknown as CostCenterAssignment[],
      billingConfig: billingConfigs[0] as unknown as BillingConfiguration | undefined,
      tagMappings: tagMappings as unknown as TagMapping[],
      settings: settingsObj,
      historicalSnapshots: snapshots as unknown as HistoricalSnapshot[],
    });

    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch (err) {
    // Non-fatal: if migration fails (e.g. server not running), retry next startup.
    console.warn('[Migration] IndexedDB → SQLite migration failed, will retry next startup:', err);
  } finally {
    legacyDb.close();
  }
}
