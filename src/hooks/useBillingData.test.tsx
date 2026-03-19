/**
 * Unit tests for useBillingData hooks.
 * Mocks getAuthConfig and SonarCloudService.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useBillingNCLOCDistribution,
  useConsumptionSummaries,
  useOrganizationDetails,
  useBillingOverview,
  useMultiOrgBillingOverview,
} from './useBillingData';

const getAuthConfig = vi.fn();
const mockGetBillingNCLOCDistribution = vi.fn();
const mockGetBillingNCLOCDistributionAll = vi.fn();
const mockGetConsumptionSummaries = vi.fn();
const mockGetOrganizationDetails = vi.fn();
const mockGetEnterpriseDetails = vi.fn();
const mockGetEnterpriseOrganizations = vi.fn();
const mockGetOrganizationsByIds = vi.fn();

const createMockService = () => ({
  getBillingNCLOCDistribution: mockGetBillingNCLOCDistribution,
  getBillingNCLOCDistributionAll: mockGetBillingNCLOCDistributionAll,
  getConsumptionSummaries: mockGetConsumptionSummaries,
  getOrganizationDetails: mockGetOrganizationDetails,
  getEnterpriseDetails: mockGetEnterpriseDetails,
  getEnterpriseOrganizations: mockGetEnterpriseOrganizations,
  getOrganizationsByIds: mockGetOrganizationsByIds,
});

vi.mock('../services/db', () => ({
  getAuthConfig: (...args: unknown[]) => getAuthConfig(...args),
}));

vi.mock('../services/sonarcloud', () => ({
  default: function MockSonarCloudService() {
    return createMockService();
  },
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useBillingData', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
    vi.clearAllMocks();
    mockGetBillingNCLOCDistributionAll.mockImplementation(async (p: { organization?: string }) =>
      mockGetBillingNCLOCDistribution({ organization: p.organization, p: 1, ps: 100 })
    );
    getAuthConfig.mockResolvedValue({
      baseUrl: 'https://sonarcloud.io',
      token: 'test-token',
      organization: 'my-org',
    });
  });

  describe('useBillingNCLOCDistribution', () => {
    it('is disabled when organization is not provided', () => {
      mockGetBillingNCLOCDistributionAll.mockResolvedValue({ projects: [], paging: { total: 0 } });
      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useBillingNCLOCDistribution({}),
        { wrapper }
      );
      expect(result.current.isFetching).toBe(false);
      expect(mockGetBillingNCLOCDistributionAll).not.toHaveBeenCalled();
    });

    it('fetches and returns NCLOC data when organization is provided', async () => {
      const nclocData = {
        projects: [{ key: 'p1', ncloc: 1000, visibility: 'private' }],
        paging: { total: 1 },
      };
      mockGetBillingNCLOCDistributionAll.mockResolvedValue(nclocData);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useBillingNCLOCDistribution({ organization: 'my-org', ps: 100 }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(nclocData);
      expect(mockGetBillingNCLOCDistributionAll).toHaveBeenCalledWith({
        organization: 'my-org',
      });
    });

    it('returns error when getAuthConfig fails', async () => {
      getAuthConfig.mockResolvedValue(undefined);
      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useBillingNCLOCDistribution({ organization: 'my-org' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toContain('Not authenticated');
    });
  });

  describe('useConsumptionSummaries', () => {
    it('is disabled when resourceId is not provided', () => {
      const wrapper = createWrapper(queryClient);
      renderHook(() => useConsumptionSummaries({}), { wrapper });
      expect(mockGetConsumptionSummaries).not.toHaveBeenCalled();
    });

    it('fetches consumption when resourceId is provided', async () => {
      const consumption = {
        consumptionSummaries: [{ usage: 50000, allowance: 100000, mode: 'absoluteReserved' }],
      };
      mockGetConsumptionSummaries.mockResolvedValue(consumption);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useConsumptionSummaries({ resourceId: 'org-uuid-123' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(consumption);
    });
  });

  describe('useOrganizationDetails', () => {
    it('fetches org details when organizationKey is provided', async () => {
      const details = { key: 'my-org', name: 'My Org', uuidV4: 'uuid-123' };
      mockGetOrganizationDetails.mockResolvedValue(details);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useOrganizationDetails('my-org'),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(details);
    });
  });

  describe('useBillingOverview', () => {
    it('returns aggregated totals from NCLOC and consumption', async () => {
      mockGetBillingNCLOCDistributionAll.mockResolvedValue({
        projects: [
          { key: 'p1', ncloc: 1000, visibility: 'private' },
          { key: 'p2', ncloc: 500, visibility: 'public' },
        ],
        paging: { total: 2 },
      });
      mockGetConsumptionSummaries.mockResolvedValue({
        consumptionSummaries: [{ usage: 1500, allowance: 10000, mode: 'absoluteReserved' }],
      });

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () =>
          useBillingOverview({
            key: 'my-org',
            uuid: 'org-uuid-123',
          }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.privateLOC).toBe(1000);
      expect(result.current.publicLOC).toBe(500);
      expect(result.current.totalLOC).toBe(1500);
      expect(result.current.consumed).toBe(1500);
      expect(result.current.limit).toBe(10000);
      expect(result.current.usagePercent).toBe(15);
      expect(result.current.privateProjectCount).toBe(1);
      expect(result.current.publicProjectCount).toBe(1);
    });

    it('isLoading stays true until both NCLOC and consumption queries finish', async () => {
      mockGetBillingNCLOCDistributionAll.mockResolvedValue({
        projects: [{ key: 'p1', ncloc: 100, visibility: 'private' }],
        paging: { total: 1 },
      });
      mockGetConsumptionSummaries.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  consumptionSummaries: [
                    { usage: 100, allowance: 1000, mode: 'absoluteReserved' },
                  ],
                }),
              80
            );
          })
      );

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useBillingOverview({ key: 'my-org', uuid: 'org-uuid' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoadingNCLOC).toBe(false));
      expect(result.current.isLoadingConsumption).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.consumed).toBe(100);
    });
  });

  describe('useMultiOrgBillingOverview', () => {
    it('fetches per-org and aggregates', async () => {
      mockGetBillingNCLOCDistributionAll.mockResolvedValue({
        projects: [],
        paging: { total: 0 },
      });
      mockGetConsumptionSummaries.mockResolvedValue({
        consumptionSummaries: [{ usage: 100, allowance: 200, mode: 'absoluteReserved' }],
      });

      const orgs = [
        { key: 'org1', name: 'Org 1', uuid: 'uuid-1' },
        { key: 'org2', name: 'Org 2', uuid: 'uuid-2' },
      ];
      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useMultiOrgBillingOverview(orgs), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.byOrg).toHaveLength(2);
      expect(result.current.consumed).toBe(200);
      expect(result.current.limit).toBe(400);
    });
  });
});
