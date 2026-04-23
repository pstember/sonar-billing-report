/**
 * Hooks for reading, writing, and refreshing the SQLite Sonar projects cache.
 *
 * Architecture note: the auth token lives in IndexedDB on the client only —
 * the server cannot call SonarCloud directly. All cache writes happen
 * client-side via these hooks.
 */

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSonarCache, saveSonarCache, type SonarProjectInput } from '../services/store';
import { getAuthConfig } from '../services/db';
import SonarCloudService from '../services/sonarcloud';
import type { NCLOCDistributionResponse } from '../types/sonarcloud.d.ts';

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * React Query read from the SQLite sonar projects cache.
 * staleTime/gcTime = Infinity: SQLite is source of truth; we never auto-refetch.
 */
export function useSonarCacheRead(orgKey: string | undefined) {
  return useQuery({
    queryKey: ['sonarCache', orgKey],
    queryFn: () => getSonarCache(orgKey!),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!orgKey,
  });
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Mutation that writes a batch of projects to the SQLite cache for one org.
 * Invalidates the sonarCache query on success so reads pick up the new data.
 */
export function useSonarCacheWrite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgKey, projects }: { orgKey: string; projects: SonarProjectInput[] }) =>
      saveSonarCache(orgKey, projects),
    onSuccess: (_data, { orgKey }) => {
      queryClient.invalidateQueries({ queryKey: ['sonarCache', orgKey] });
    },
  });
}

// ── Refetch from Sonar ────────────────────────────────────────────────────────

async function getSonarService(): Promise<SonarCloudService> {
  const auth = await getAuthConfig();
  if (!auth) throw new Error('Not authenticated. Please log in first.');
  return new SonarCloudService({
    baseUrl: auth.baseUrl,
    token: auth.token,
    organization: auth.organization,
    enterpriseKey: auth.enterpriseKey,
  });
}

function mapNCLOCToCache(
  response: NCLOCDistributionResponse,
): SonarProjectInput[] {
  return (response.projects ?? []).map((p) => ({
    projectKey: p.projectKey,
    name: p.projectName,
    visibility: p.visibility,
    ncloc: p.ncloc,
  }));
}

/**
 * Orchestrates a live Sonar API fetch → delta write to SQLite → cache invalidation
 * for one or more org keys in parallel.
 */
export function useRefetchAndCache(orgKeys: string[]) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const service = await getSonarService();
      await Promise.all(
        orgKeys.map(async (orgKey) => {
          const response = await service.getBillingNCLOCDistributionAll({ organization: orgKey });
          const projects = mapNCLOCToCache(response);
          await saveSonarCache(orgKey, projects);
        }),
      );
    },
    onSuccess: () => {
      for (const orgKey of orgKeys) {
        queryClient.invalidateQueries({ queryKey: ['sonarCache', orgKey] });
        queryClient.invalidateQueries({ queryKey: ['billingNCLOC', orgKey] });
        queryClient.invalidateQueries({ queryKey: ['billingOverviewOrg', orgKey] });
      }
      queryClient.invalidateQueries({ queryKey: ['consumptionSummaries'] });
    },
  });

  return {
    refetchAll: mutation.mutate,
    isRefetching: mutation.isPending,
    lastError: mutation.error ?? null,
  };
}

// ── Auto-save background hook ─────────────────────────────────────────────────

/**
 * Silently writes NCLOC data to SQLite whenever a React Query fetch completes.
 * Failure is swallowed — this must never break the dashboard.
 */
export function useAutoSaveBillingNCLOC(
  orgKey: string | undefined,
  data: NCLOCDistributionResponse | undefined,
  isFetching: boolean,
) {
  const lastSavedRef = useRef<NCLOCDistributionResponse | undefined>(undefined);

  useEffect(() => {
    if (!orgKey || !data || isFetching) return;
    if (lastSavedRef.current === data) return; // same reference — already saved
    lastSavedRef.current = data;

    const projects = mapNCLOCToCache(data);
    saveSonarCache(orgKey, projects).catch(() => {
      // Intentionally silent — cache failure must not surface to the user
    });
  }, [orgKey, data, isFetching]);
}
