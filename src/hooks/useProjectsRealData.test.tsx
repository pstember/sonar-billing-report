/**
 * Unit tests for useProjectsRealData.
 * Mocks getAuthConfig and SonarCloudService (getComponentMeasures, getComponentDetails, getComponentHistory).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProjectsRealData } from './useProjectsRealData';

const getAuthConfig = vi.fn();
const mockGetComponentMeasures = vi.fn();
const mockGetComponentDetails = vi.fn();
const mockGetComponentHistory = vi.fn();

const createMockService = () => ({
  getComponentMeasures: mockGetComponentMeasures,
  getComponentDetails: mockGetComponentDetails,
  getComponentHistory: mockGetComponentHistory,
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

describe('useProjectsRealData', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
    vi.clearAllMocks();
    getAuthConfig.mockResolvedValue({
      baseUrl: 'https://sonarcloud.io',
      token: 'test-token',
      organization: 'my-org',
    });
    mockGetComponentMeasures.mockResolvedValue({
      component: {
        name: 'My Project',
        measures: [
          { metric: 'ncloc', value: '5000' },
          { metric: 'coverage', value: '85.2' },
          { metric: 'bugs', value: '2' },
        ],
      },
    });
    mockGetComponentDetails.mockResolvedValue({
      component: { key: 'my-org_project', name: 'My Project', tags: ['team-a'] },
    });
    mockGetComponentHistory.mockResolvedValue({
      measures: [{ metric: 'ncloc', history: [{ date: '2025-01-15', value: '5000' }] }],
    });
  });

  it('returns empty projects when projectKeys is empty', () => {
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useProjectsRealData([]), { wrapper });
    expect(result.current.projects).toEqual([]);
    expect(result.current.aggregatedByTag).toEqual([]);
    expect(result.current.pivotData).toEqual([]);
  });

  it('fetches project data and builds pivotData and aggregatedByTag', async () => {
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(
      () => useProjectsRealData(['my-org_project']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0].key).toBe('my-org_project');
    expect(result.current.projects[0].ncloc).toBe(5000);
    expect(result.current.projects[0].tags).toEqual(['team-a']);
    expect(result.current.pivotData.length).toBeGreaterThanOrEqual(0);
    expect(result.current.aggregatedByTag.length).toBeGreaterThanOrEqual(0);
    expect(result.current.monthlyTrendByProject.length).toBeGreaterThan(0);
  });

  it('returns null for project when getAuthConfig is undefined', async () => {
    getAuthConfig.mockResolvedValue(undefined);
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(
      () => useProjectsRealData(['my-org_project']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.projects).toHaveLength(0);
  });

  it('handles service error and returns empty projects', async () => {
    mockGetComponentMeasures.mockRejectedValue(new Error('API error'));
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(
      () => useProjectsRealData(['my-org_project']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.projects).toHaveLength(0);
  });
});
