/**
 * Client-side wrapper for the server-side SQLite store (/store/*).
 * Replaces the Dexie/IndexedDB functions for persistent user configuration.
 */

import type {
  CostCenter,
  CostCenterAssignment,
  BillingConfiguration,
  TagMapping,
  HistoricalSnapshot,
} from '../types/billing';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/store${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (res.status === 204) return undefined as unknown as T;
  if (!res.ok) throw new Error(`Store API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ─── Cost Centers ─────────────────────────────────────────────────────────────

export async function getCostCenters(): Promise<CostCenter[]> {
  return apiFetch<CostCenter[]>('/costCenters');
}

export async function saveCostCenter(cc: CostCenter | Omit<CostCenter, 'id'>): Promise<string> {
  const withId: CostCenter = 'id' in cc && cc.id ? cc : { ...cc, id: generateId('cc') };
  await apiFetch<CostCenter>(`/costCenters/${encodeURIComponent(withId.id)}`, {
    method: 'PUT',
    body: JSON.stringify(withId),
  });
  return withId.id;
}

export async function deleteCostCenter(id: string): Promise<void> {
  await apiFetch<void>(`/costCenters/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Cost Center Assignments ──────────────────────────────────────────────────

export async function getCostCenterAssignments(costCenterId?: string): Promise<CostCenterAssignment[]> {
  const qs = costCenterId ? `?costCenterId=${encodeURIComponent(costCenterId)}` : '';
  return apiFetch<CostCenterAssignment[]>(`/costCenterAssignments${qs}`);
}

export async function saveCostCenterAssignment(
  a: CostCenterAssignment | Omit<CostCenterAssignment, 'id'>
): Promise<string> {
  const withId: CostCenterAssignment = 'id' in a && a.id ? a : { ...a, id: generateId('cca') };
  await apiFetch<CostCenterAssignment>(`/costCenterAssignments/${encodeURIComponent(withId.id)}`, {
    method: 'PUT',
    body: JSON.stringify(withId),
  });
  return withId.id;
}

export async function deleteCostCenterAssignment(id: string): Promise<void> {
  await apiFetch<void>(`/costCenterAssignments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Billing Configuration ────────────────────────────────────────────────────

export async function getBillingConfig(): Promise<BillingConfiguration | undefined> {
  const data = await apiFetch<BillingConfiguration | null>('/billingConfig');
  return data ?? undefined;
}

export async function saveBillingConfig(config: BillingConfiguration): Promise<void> {
  await apiFetch<BillingConfiguration>('/billingConfig', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ─── Tag Mappings ─────────────────────────────────────────────────────────────

export async function getTagMappings(): Promise<TagMapping[]> {
  return apiFetch<TagMapping[]>('/tagMappings');
}

export async function saveTagMapping(mapping: TagMapping): Promise<void> {
  await apiFetch<TagMapping>(`/tagMappings/${encodeURIComponent(mapping.tag)}`, {
    method: 'PUT',
    body: JSON.stringify(mapping),
  });
}

export async function deleteTagMapping(tag: string): Promise<void> {
  await apiFetch<void>(`/tagMappings/${encodeURIComponent(tag)}`, { method: 'DELETE' });
}

export async function importTagMappings(mappings: TagMapping[]): Promise<void> {
  await apiFetch<{ imported: number }>('/tagMappings/import', {
    method: 'POST',
    body: JSON.stringify(mappings),
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function saveSetting(key: string, value: unknown): Promise<void> {
  await apiFetch<unknown>(`/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const data = await apiFetch<T | null>(`/settings/${encodeURIComponent(key)}`);
  return data ?? undefined;
}

// ─── Historical Snapshots ─────────────────────────────────────────────────────

export async function getHistoricalSnapshots(): Promise<HistoricalSnapshot[]> {
  return apiFetch<HistoricalSnapshot[]>('/historicalSnapshots');
}

export async function saveHistoricalSnapshots(snapshots: HistoricalSnapshot[]): Promise<void> {
  await apiFetch<{ inserted: number }>('/historicalSnapshots', {
    method: 'POST',
    body: JSON.stringify(snapshots),
  });
}

export async function clearHistoricalSnapshots(): Promise<void> {
  await apiFetch<void>('/historicalSnapshots', { method: 'DELETE' });
}

// ─── Sonar Projects Cache ─────────────────────────────────────────────────────

export interface SonarProjectCacheEntry {
  orgKey: string;
  projectKey: string;
  name: string;
  visibility: 'public' | 'private';
  ncloc: number;
  tags: string[];
  fetchedAt: string;
}

export interface SonarCacheResponse {
  projects: SonarProjectCacheEntry[];
  fetchedAt: string | null;
}

export interface SonarCacheSaveResult {
  upserted: number;
  removed: number;
  fetchedAt: string;
}

export interface SonarProjectInput {
  projectKey: string;
  name: string;
  visibility: 'public' | 'private';
  ncloc: number;
  tags?: string[];
}

export async function getSonarCache(orgKey: string): Promise<SonarCacheResponse> {
  return apiFetch<SonarCacheResponse>(`/sonarCache/${encodeURIComponent(orgKey)}`);
}

export async function saveSonarCache(
  orgKey: string,
  projects: SonarProjectInput[],
): Promise<SonarCacheSaveResult> {
  return apiFetch<SonarCacheSaveResult>(`/sonarCache/${encodeURIComponent(orgKey)}`, {
    method: 'POST',
    body: JSON.stringify({ projects }),
  });
}

export async function clearSonarCache(orgKey: string): Promise<void> {
  await apiFetch<void>(`/sonarCache/${encodeURIComponent(orgKey)}`, { method: 'DELETE' });
}

// ─── One-time migration: IndexedDB → SQLite ────────────────────────────────

interface MigratePayload {
  costCenters: CostCenter[];
  costCenterAssignments: CostCenterAssignment[];
  billingConfig?: BillingConfiguration;
  tagMappings: TagMapping[];
  settings: Record<string, unknown>;
  historicalSnapshots: HistoricalSnapshot[];
}

export async function migrateFromIndexedDB(payload: MigratePayload): Promise<void> {
  await apiFetch<{ ok: boolean }>('/migrate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
