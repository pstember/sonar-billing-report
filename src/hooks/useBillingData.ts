/**
 * React Query hooks for SonarQube Cloud Billing API
 *
 * NOTE: Only PRIVATE projects count toward billing!
 */

import { useQuery, useQueries } from '@tanstack/react-query';
import SonarCloudService from '../services/sonarcloud';
import { getAuthConfig } from '../services/db';

export interface SelectedOrganization {
  key: string;
  name: string;
  uuid: string;
}

async function getSonarCloudService(): Promise<SonarCloudService> {
  const auth = await getAuthConfig();
  if (!auth) {
    throw new Error('Not authenticated. Please log in first.');
  }
  return new SonarCloudService({
    baseUrl: auth.baseUrl,
    token: auth.token,
    organization: auth.organization,
    enterpriseKey: auth.enterpriseKey,
  });
}

/**
 * Get NCLOC distribution for billing
 * Shows per-project LOC with visibility (only private projects count!)
 */
export function useBillingNCLOCDistribution(params: {
  organization?: string;
  /** @deprecated Ignored; all pages are fetched up to API max page size. */
  ps?: number;
} = {}) {
  return useQuery({
    queryKey: ['billingNCLOC', params.organization],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.getBillingNCLOCDistributionAll({
        organization: params.organization,
      });
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: !!params.organization, // Only fetch if organization is specified
  });
}

/**
 * Get consumption summaries (LOC consumed vs limit)
 * This is the SOURCE OF TRUTH for billing
 * Automatically tries with organization key - no manual config needed!
 */
export function useConsumptionSummaries(params?: {
  resourceId?: string;
}) {
  return useQuery({
    queryKey: ['consumptionSummaries', params],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.getConsumptionSummaries({
        resourceId: params?.resourceId,
        key: 'linesOfCode',
        resourceType: 'organization',
        pageIndex: 1,
        pageSize: 1,
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!params?.resourceId,
  });
}

/**
 * Get organization details to extract UUID for billing API
 */
export function useOrganizationDetails(organizationKey?: string) {
  return useQuery({
    queryKey: ['organizationDetails', organizationKey],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.getOrganizationDetails(organizationKey);
    },
    staleTime: 60 * 60 * 1000, // Cache for 1 hour (org UUID doesn't change)
    enabled: !!organizationKey,
  });
}

export interface EnterpriseOrganizationsResult {
  organizations: SelectedOrganization[];
  enterpriseName?: string;
  enterpriseId?: string;
}

/**
 * Get all organizations in the enterprise with UUIDs
 * Fetches enterprise organizations and enriches them with keys/names
 */
export function useEnterpriseOrganizations() {
  return useQuery({
    queryKey: ['enterpriseOrganizations'],
    queryFn: async (): Promise<EnterpriseOrganizationsResult> => {
      const service = await getSonarCloudService();
      const auth = await getAuthConfig();

      if (!auth?.enterpriseKey) {
        throw new Error('Enterprise key is required. Please configure it in the login page.');
      }

      // Resolve enterprise UUID from key (enterprise-organizations requires enterpriseId, not enterpriseKey)
      const enterprises = await service.getEnterpriseDetails(auth.enterpriseKey);
      const enterprise = enterprises?.[0];
      const enterpriseId = enterprise?.id;
      if (!enterpriseId) {
        throw new Error('Enterprise not found for the given enterprise key. Please check your enterprise key.');
      }

      // Get enterprise organizations with UUIDs (filtered by enterprise)
      const enterpriseOrgs = await service.getEnterpriseOrganizations(enterpriseId);

      // Get organization details using UUIDs
      const uuids = enterpriseOrgs.map(eo => eo.organizationUuidV4);
      const allOrgs = await service.getOrganizationsByIds(uuids);

      // Match enterprise orgs with detailed organization data by UUID
      const organizations = enterpriseOrgs.map((eo) => {
        const matchedOrg = allOrgs.find((org) => org.uuidV4 === eo.organizationUuidV4);

        if (!matchedOrg) {
          console.warn(`Could not find org details for UUID: ${eo.organizationUuidV4}`);
          return {
            key: eo.organizationUuidV4,
            name: eo.organizationUuidV4,
            uuid: eo.organizationUuidV4,
          };
        }

        return {
          key: matchedOrg.key,
          name: matchedOrg.name,
          uuid: eo.organizationUuidV4,
        };
      });

      return {
        organizations,
        enterpriseName: enterprise.name,
        enterpriseId,
      };
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Get consumption summaries for ALL orgs in an enterprise in a single API call.
 * Uses parentResourceId=<enterpriseId> so non-member orgs are included.
 * Returns a Map<orgUuid, ConsumptionSummary> for easy lookup.
 */
export function useEnterpriseConsumptionSummaries(enterpriseId: string | undefined) {
  return useQuery({
    queryKey: ['enterpriseConsumptionSummaries', enterpriseId],
    queryFn: async () => {
      const service = await getSonarCloudService();
      const res = await service.getEnterpriseConsumptionSummaries({ enterpriseId: enterpriseId! });
      // Index by resourceId (org UUID) for O(1) lookup
      const byOrgUuid = new Map(
        (res.consumptionSummaries ?? []).map((s) => [s.resourceId, s])
      );
      return { summaries: res.consumptionSummaries, byOrgUuid };
    },
    enabled: !!enterpriseId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Combined hook that provides complete billing overview
 * Uses organization key for NCLOC API and UUID for consumption API
 */
export function useBillingOverview(organization?: { key: string; uuid: string }) {
  // Get NCLOC distribution (per-project breakdown)
  // Uses organization KEY
  const {
    data: nclocData,
    isLoading: isLoadingNCLOC,
    error: nclocError,
  } = useBillingNCLOCDistribution({ organization: organization?.key });

  // Get consumption summary (total consumed vs limit)
  // Uses organization UUID
  const {
    data: consumptionData,
    isLoading: isLoadingConsumption,
    error: consumptionError,
  } = useConsumptionSummaries(
    organization?.uuid ? { resourceId: organization.uuid } : undefined
  );

  // Calculate totals from NCLOC distribution
  const totalProjects = nclocData?.paging?.total ?? 0;
  const privateProjects = nclocData?.projects?.filter(p => p.visibility === 'private') ?? [];
  const publicProjects = nclocData?.projects?.filter(p => p.visibility === 'public') ?? [];

  const privateLOC = privateProjects.reduce((sum, p) => sum + p.ncloc, 0);
  const publicLOC = publicProjects.reduce((sum, p) => sum + p.ncloc, 0);
  const totalLOC = privateLOC + publicLOC;

  // Get consumption from API (source of truth)
  const summary = consumptionData?.consumptionSummaries?.[0];
  const consumed = summary?.usage;
  const limit = summary?.allowance;
  const usagePercent = limit && limit > 0 ? ((consumed ?? 0) / limit) * 100 : 0;
  const mode: ConsumptionMode | undefined =
    summary?.mode === 'absoluteReserved' || summary?.mode === 'unreserved' ? summary.mode : undefined;

  return {
    // Project counts
    totalProjects,
    privateProjectCount: privateProjects.length,
    publicProjectCount: publicProjects.length,

    // LOC totals
    totalLOC,
    privateLOC,
    publicLOC,

    // Billing (source of truth from consumption API)
    consumed,
    limit,
    usagePercent,
    mode,

    // Per-project data
    privateProjects,
    publicProjects,
    allProjects: nclocData?.projects ?? [],

    // Loading states
    isLoading: isLoadingNCLOC || isLoadingConsumption,
    isLoadingNCLOC,
    isLoadingConsumption,

    // Errors
    error: nclocError ?? consumptionError,
    nclocError,
    consumptionError,

    // API doesn't provide period dates in this endpoint
    periodStartDate: undefined,
    periodEndDate: undefined,
  };
}

/** Consumption mode: absoluteReserved = per-org (count in aggregate); unreserved = pooled (count once). */
export type ConsumptionMode = 'absoluteReserved' | 'unreserved';

/** Per-org billing snapshot for multi-org aggregate */
export interface BillingOverviewOrg {
  key: string;
  name: string;
  uuid: string;
  consumed: number | undefined;
  limit: number | undefined;
  usagePercent: number;
  /** absoluteReserved = private to org; unreserved = pooled (count once in multi-org total) */
  mode?: ConsumptionMode;
  privateProjectCount: number;
  publicProjectCount: number;
  totalProjects: number;
}

import type { ConsumptionSummary } from '../types/sonarcloud';

/**
 * Fetch billing overview for a single org.
 * Accepts an optional pre-fetched consumption summary (from enterprise-level call)
 * to avoid a redundant per-org API call.
 * NCLOC fetch is best-effort: non-member orgs may return empty; that's OK.
 */
async function fetchBillingOverviewForOrg(
  service: SonarCloudService,
  org: { key: string; uuid: string; name: string },
  prefetchedSummary?: ConsumptionSummary
): Promise<BillingOverviewOrg> {
  const [nclocRes, consumptionRes] = await Promise.all([
    service.getBillingNCLOCDistributionAll({ organization: org.key }).catch(() => ({ projects: [], paging: { pageIndex: 1, pageSize: 0, total: 0 } })),
    prefetchedSummary
      ? Promise.resolve({ consumptionSummaries: [prefetchedSummary], page: { pageIndex: 1, pageSize: 1, total: 1 } })
      : service.getConsumptionSummaries({
          resourceId: org.uuid,
          key: 'linesOfCode',
          resourceType: 'organization',
          pageIndex: 1,
          pageSize: 1,
        }),
  ]);
  const privateProjects = nclocRes.projects?.filter((p) => p.visibility === 'private') ?? [];
  const publicProjects = nclocRes.projects?.filter((p) => p.visibility === 'public') ?? [];
  const summary = consumptionRes.consumptionSummaries?.[0];
  const consumed = summary?.usage;
  const limit = summary?.allowance;
  const mode: ConsumptionMode | undefined =
    summary?.mode === 'absoluteReserved' || summary?.mode === 'unreserved' ? summary.mode : undefined;
  const usagePercent = limit && limit > 0 ? ((consumed ?? 0) / limit) * 100 : 0;
  return {
    key: org.key,
    name: org.name,
    uuid: org.uuid,
    consumed,
    limit,
    usagePercent,
    mode,
    privateProjectCount: privateProjects.length,
    publicProjectCount: publicProjects.length,
    totalProjects: nclocRes.paging?.total ?? 0,
  };
}

/**
 * Multi-org billing overview: fetches per-org data in parallel and returns aggregated + byOrg.
 * Pass prefetchedConsumption (from useEnterpriseConsumptionSummaries) to skip per-org consumption
 * calls and get data for non-member orgs too.
 */
export function useMultiOrgBillingOverview(
  orgs: SelectedOrganization[],
  prefetchedConsumption?: Map<string, ConsumptionSummary>
) {
  const queries = useQueries({
    queries: orgs.map((org) => ({
      // Do NOT include !!prefetchedConsumption in the key. When the enterprise-level
      // consumption data arrives later, we don't want to invalidate and re-fetch all N
      // org queries — their results are identical whether obtained via per-org or prefetched
      // consumption API calls. Stable key = no double-fetch on mode entry.
      queryKey: ['billingOverviewOrg', org.key],
      queryFn: async () => {
        const service = await getSonarCloudService();
        return fetchBillingOverviewForOrg(service, org, prefetchedConsumption?.get(org.uuid));
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error;
  const byOrg: BillingOverviewOrg[] = queries.map((q) => q.data).filter(Boolean) as BillingOverviewOrg[];
  /** One entry per selected org: resolved data or loading/error so the table can show all selected orgs */
  const orgResults: {
    org: SelectedOrganization;
    data: BillingOverviewOrg | undefined;
    isPending: boolean;
    error: Error | null;
  }[] = orgs.map((org, i) => ({
    org,
    data: queries[i]?.data,
    isPending: queries[i]?.status === 'pending',
    error: queries[i]?.error ?? null,
  }));
  // absoluteReserved = per-org (sum); unreserved = pooled (count once)
  const reservedOrgs = byOrg.filter((o) => o.mode === 'absoluteReserved');
  const unreservedOrgs = byOrg.filter((o) => o.mode === 'unreserved');
  const consumedReserved = reservedOrgs.reduce((sum, o) => sum + (o.consumed ?? 0), 0);
  const consumedUnreserved = unreservedOrgs.length > 0
    ? Math.max(...unreservedOrgs.map((o) => o.consumed ?? 0))
    : 0;
  const consumed = consumedReserved + consumedUnreserved;
  const limitReserved = reservedOrgs.reduce((sum, o) => sum + (o.limit ?? 0), 0);
  const limitUnreserved = unreservedOrgs.length > 0
    ? Math.max(...unreservedOrgs.map((o) => o.limit ?? 0))
    : 0;
  const limit = limitReserved + limitUnreserved;
  const usagePercent = limit > 0 ? (consumed / limit) * 100 : 0;
  const privateProjectCount = byOrg.reduce((s, o) => s + o.privateProjectCount, 0);
  const publicProjectCount = byOrg.reduce((s, o) => s + o.publicProjectCount, 0);
  const totalProjects = byOrg.reduce((s, o) => s + o.totalProjects, 0);

  return {
    consumed,
    limit,
    usagePercent,
    privateProjectCount,
    publicProjectCount,
    totalProjects,
    byOrg,
    orgResults,
    isLoading,
    error,
  };
}
