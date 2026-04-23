/**
 * Tracks progress of dashboard data loading by counting React Query cache entries.
 * Includes all active queries so every API call appears in the loading list.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export type LoadProgressCategory = 'enterprise' | 'billing' | 'projects' | 'other';

export interface LoadProgressSubCall {
  label: string;
}

export interface LoadProgressItem {
  category: LoadProgressCategory;
  label: string;
  /** Short explanation of what this API call is used for */
  description: string;
  /** Ordered list of actual API sub-calls (HTTP requests) performed by this query */
  subCalls: LoadProgressSubCall[];
  status: 'pending' | 'success' | 'error';
  fetchStatus: 'idle' | 'fetching' | 'paused';
}

function getFetchStatus(q: { state: { fetchStatus?: string } }): 'idle' | 'fetching' | 'paused' {
  const fs = (q.state as { fetchStatus?: string }).fetchStatus;
  if (fs === 'fetching') return 'fetching';
  if (fs === 'paused') return 'paused';
  return 'idle';
}

/** Pending+idle queries are still "work to do" but were omitted here, which hid the bar when the cache had many stale successes from persistence. */
function shouldCountQuery(q: { state: { status?: string; fetchStatus?: string }; options?: unknown }): boolean {
  const st = (q.state as { status?: string }).status ?? '';
  const fs = getFetchStatus(q as { state: { fetchStatus?: string } });
  const enabled = (q.options as { enabled?: boolean } | undefined)?.enabled;
  if (st === 'success' || st === 'error') return true;
  if (fs === 'fetching') return true;
  if (st === 'pending' && enabled !== false) return true;
  return false;
}

// Only SonarQube API query keys appear in the progress bar.
// Local SQLite store queries (costCenters, billingConfig, etc.) are fast/local
// and would just add noise to the loading indicator.
const SONARQUBE_QUERY_KEYS = new Set([
  'enterpriseOrganizations',
  'enterpriseConsumptionSummaries',
  'billingOverviewOrg',
  'billingNCLOC',
  'consumptionSummaries',
  'organizationDetails',
  'projects',
  'projectHistory',
  'projectFullData',
  'projectLOC',
]);

const LABEL_DEFAULT: Record<string, string> = {
  enterpriseOrganizations: 'Organizations',
  enterpriseConsumptionSummaries: 'Enterprise consumption',
  billingOverviewOrg: 'Billing',
  billingNCLOC: 'NCLOC distribution',
  consumptionSummaries: 'Consumption',
  projects: 'Projects',
  projectHistory: 'NCLOC history',
  projectFullData: 'Project data',
  projectLOC: 'Project LOC',
  organizationDetails: 'Org details',
};

function labelForQuery(key: string, key2: unknown, key3: unknown): string {
  // ['projects', 'all', orgKey] — key2 is the literal string 'all', org name is key3
  if (key === 'projects' && key2 === 'all' && typeof key3 === 'string') return key3;
  // ['organizationDetails', orgKey] or ['billingNCLOC', orgKey] — key2 is the org key
  if (typeof key2 === 'string' && key2 !== '') return key2;
  return LABEL_DEFAULT[key] ?? key;
}

const DESCRIPTION_BY_KEY: Record<string, string> = {
  enterpriseOrganizations: 'Org list for your enterprise (selector & which orgs to load)',
  enterpriseConsumptionSummaries: 'Bulk usage & allowance for all orgs in enterprise (single call)',
  billingOverviewOrg: 'Usage, limit & Reserved/Pooled for this org',
  billingNCLOC: 'Per-project LOC used for billing',
  consumptionSummaries: 'Consumed vs allowance (plan usage)',
  projects: 'Project list for this org',
  projectHistory: 'NCLOC history for trend (last 12 months)',
  projectFullData: 'Project details, measures (ncloc, coverage, bugs) & tags',
  projectLOC: 'LOC for project (billing/display)',
  organizationDetails: 'Organization UUID for billing API',
};

function descriptionForQuery(key: string): string {
  return DESCRIPTION_BY_KEY[key] ?? 'API call';
}

const SUBCALLS_BY_KEY: Record<string, LoadProgressSubCall[]> = {
  enterpriseConsumptionSummaries: [
    { label: 'GET /billing/consumption-summaries?parentResourceId=<enterpriseId>&key=linesOfCode&resourceType=organization (all orgs in one call)' },
  ],
  enterpriseOrganizations: [
    { label: 'GET /enterprises/enterprises?enterpriseKey=… (resolve enterprise UUID)' },
    { label: 'GET /enterprises/enterprise-organizations?enterpriseId=… (org UUIDs for enterprise)' },
    { label: 'GET /organizations/organizations?ids=… (org names & keys by UUID)' },
  ],
  billingOverviewOrg: [
    { label: 'GET /billing/get_ncloc_distribution?organization=… (per-project LOC)' },
    { label: 'GET /billing/consumption-summaries?resourceId=… (usage & allowance)' },
  ],
  billingNCLOC: [{ label: 'GET /billing/get_ncloc_distribution?organization=…' }],
  consumptionSummaries: [{ label: 'GET /billing/consumption-summaries?resourceId=…' }],
  projects: [{ label: 'GET /api/components/search_projects?organization=…' }],
  projectHistory: [{ label: 'GET /measures/search_history?component=…&metrics=ncloc&from=…&to=…&ps=1000' }],
  projectFullData: [
    { label: 'GET /measures/component?component=…&metricKeys=…' },
    { label: 'GET /components/show?component=… (details & tags)' },
  ],
  projectLOC: [{ label: 'GET /measures/component?component=…&metricKeys=ncloc' }],
  organizationDetails: [{ label: 'GET /organizations/show?organization=…' }],
};

function subCallsForQuery(key: string): LoadProgressSubCall[] {
  return SUBCALLS_BY_KEY[key] ?? [];
}

const CATEGORY_BY_KEY: Record<string, LoadProgressCategory> = {
  enterpriseOrganizations: 'enterprise',
  enterpriseConsumptionSummaries: 'billing',
  billingOverviewOrg: 'billing',
  billingNCLOC: 'billing',
  consumptionSummaries: 'billing',
  projects: 'projects',
  projectHistory: 'projects',
  projectFullData: 'projects',
  projectLOC: 'projects',
  organizationDetails: 'enterprise',
};

function categoryForQuery(key: string): LoadProgressCategory {
  return CATEGORY_BY_KEY[key] ?? 'other';
}

function getDashboardProgress(
  queryClient: ReturnType<typeof useQueryClient>
): { completed: number; total: number; fetching: number; items: LoadProgressItem[] } {
  const cache = queryClient.getQueryCache();
  const queries = cache.findAll({ predicate: () => true });
  const fetchStatus = (q: (typeof queries)[0]) => getFetchStatus(q);
  // Only track SonarQube API queries — skip local store queries (fast/local, not meaningful in a loading bar)
  const activeQueries = queries.filter(
    (q) => SONARQUBE_QUERY_KEYS.has((q.queryKey?.[0] as string) ?? '') && shouldCountQuery(q)
  );
  const total = activeQueries.length;
  const fetching = activeQueries.filter((q) => fetchStatus(q) === 'fetching').length;
  /* Only count as completed when done and not currently fetching (avoids counting background refetches) */
  const completed = activeQueries.filter(
    (q) =>
      (q.state.status === 'success' || q.state.status === 'error') &&
      fetchStatus(q) !== 'fetching'
  ).length;
  const items: LoadProgressItem[] = activeQueries.map((q) => {
    const key = (q.queryKey?.[0] as string) ?? '';
    const key2 = q.queryKey?.[1];
    const key3 = q.queryKey?.[2];
    return {
      category: categoryForQuery(key),
      label: labelForQuery(key, key2, key3),
      description: descriptionForQuery(key),
      subCalls: subCallsForQuery(key),
      status: (() => {
        if (q.state.status === 'success') return 'success';
        if (q.state.status === 'error') return 'error';
        return 'pending';
      })(),
      fetchStatus: getFetchStatus(q),
    };
  });
  return { completed, total, fetching, items };
}

export function useDashboardLoadProgress() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(() => getDashboardProgress(queryClient));

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const update = () => setProgress(getDashboardProgress(queryClient));
    update();
    // Defer subscription updates so we never call setState during another component's render
    // (React Query can notify subscribers synchronously when cache updates during render)
    const unsub = cache.subscribe(() => queueMicrotask(update));
    return unsub;
  }, [queryClient]);

  const { completed, total, fetching, items } = progress;
  const isComplete = total > 0 && completed >= total && fetching === 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    completed,
    total,
    /** Number of queries currently in flight (actual network requests). Rest of completed are from cache or already finished. */
    fetching,
    percent,
    items,
    isComplete,
    isLoading: total > 0 && !isComplete,
  };
}
