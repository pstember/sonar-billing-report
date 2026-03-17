/**
 * React Query hooks for SonarCloud Billing API
 *
 * NOTE: Only PRIVATE projects count toward billing!
 */

import { useQuery } from '@tanstack/react-query';
import SonarCloudService from '../services/sonarcloud';
import { getAuthConfig } from '../services/db';

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
  ps?: number;
} = {}) {
  return useQuery({
    queryKey: ['billingNCLOC', params],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.getBillingNCLOCDistribution(params);
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
  organization?: string;
}) {
  return useQuery({
    queryKey: ['consumptionSummaries', params],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.getConsumptionSummaries({
        resourceId: params?.resourceId,
        organization: params?.organization,
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

/**
 * Get all organizations in the enterprise with UUIDs
 * Fetches enterprise organizations and enriches them with keys/names
 */
export function useEnterpriseOrganizations() {
  return useQuery({
    queryKey: ['enterpriseOrganizations'],
    queryFn: async () => {
      const service = await getSonarCloudService();
      const auth = await getAuthConfig();

      if (!auth?.enterpriseKey) {
        throw new Error('Enterprise key is required. Please configure it in the login page.');
      }

      // Get enterprise organizations with UUIDs
      const enterpriseOrgs = await service.getEnterpriseOrganizations(auth.enterpriseKey);

      // Get organization details using UUIDs
      const uuids = enterpriseOrgs.map(eo => eo.organizationUuidV4);
      const allOrgs = await service.getOrganizationsByIds(uuids);

      // Match enterprise orgs with detailed organization data by UUID
      return enterpriseOrgs.map((eo) => {
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
    },
    staleTime: 60 * 60 * 1000,
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
  } = useBillingNCLOCDistribution({ organization: organization?.key, ps: 100 });

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
  const totalProjects = nclocData?.paging?.total || 0;
  const privateProjects = nclocData?.projects?.filter(p => p.visibility === 'private') || [];
  const publicProjects = nclocData?.projects?.filter(p => p.visibility === 'public') || [];

  const privateLOC = privateProjects.reduce((sum, p) => sum + p.ncloc, 0);
  const publicLOC = publicProjects.reduce((sum, p) => sum + p.ncloc, 0);
  const totalLOC = privateLOC + publicLOC;

  // Get consumption from API (source of truth)
  const consumed = consumptionData?.consumptionSummaries?.[0]?.usage;
  const limit = consumptionData?.consumptionSummaries?.[0]?.allowance;
  const usagePercent = limit && limit > 0 ? ((consumed || 0) / limit) * 100 : 0;

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

    // Per-project data
    privateProjects,
    publicProjects,
    allProjects: nclocData?.projects || [],

    // Loading states
    isLoading: isLoadingNCLOC || isLoadingConsumption,
    isLoadingNCLOC,
    isLoadingConsumption,

    // Errors
    error: nclocError || consumptionError,
    nclocError,
    consumptionError,

    // API doesn't provide period dates in this endpoint
    periodStartDate: undefined,
    periodEndDate: undefined,
  };
}
