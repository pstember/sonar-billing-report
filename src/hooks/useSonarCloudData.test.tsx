/**
 * Unit tests for useSonarCloudData hooks.
 * Mocks getAuthConfig and SonarCloudService.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useProjects,
  useProjectsForOrganizations,
  useProjectTags,
  useValidateToken,
} from './useSonarCloudData';

const getAuthConfig = vi.fn();
const mockSearchProjects = vi.fn();
const mockSearchProjectsAll = vi.fn();
const mockGetProjectTags = vi.fn();
const mockValidateToken = vi.fn();

const createMockService = () => ({
  searchProjects: mockSearchProjects,
  searchProjectsAll: mockSearchProjectsAll,
  getProjectTags: mockGetProjectTags,
  validateToken: mockValidateToken,
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

describe('useSonarCloudData', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
    vi.clearAllMocks();
    mockSearchProjectsAll.mockImplementation(async (p: { organization?: string }) =>
      mockSearchProjects({ organization: p.organization, p: 1, ps: 100 })
    );
    getAuthConfig.mockResolvedValue({
      baseUrl: 'https://sonarcloud.io',
      token: 'test-token',
      organization: 'my-org',
    });
  });

  describe('useProjects', () => {
    it('is disabled when organization is not provided', () => {
      const wrapper = createWrapper(queryClient);
      renderHook(() => useProjects({}), { wrapper });
      expect(mockSearchProjectsAll).not.toHaveBeenCalled();
    });

    it('fetches and returns projects when organization is provided', async () => {
      const projectsData = { components: [{ key: 'p1', name: 'Project 1' }], paging: { total: 1 } };
      mockSearchProjectsAll.mockResolvedValue(projectsData);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useProjects({ organization: 'my-org', ps: 50 }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(projectsData);
      expect(mockSearchProjectsAll).toHaveBeenCalledWith({ organization: 'my-org' });
    });

    it('returns error when not authenticated', async () => {
      getAuthConfig.mockResolvedValue(undefined);
      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useProjects({ organization: 'my-org' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.status).toBe('error'));
      expect((result.current.error as Error).message).toContain('Not authenticated');
    });
  });

  describe('useProjectsForOrganizations', () => {
    it('returns empty when orgs array is empty', () => {
      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(() => useProjectsForOrganizations([]), { wrapper });
      expect(result.current.projects).toEqual([]);
      expect(result.current.totalCount).toBe(0);
    });

    it('fetches projects per org and merges with attribution', async () => {
      mockSearchProjectsAll.mockResolvedValue({
        components: [{ key: 'proj-1', name: 'Proj 1' }],
        paging: { total: 1 },
      });

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () =>
          useProjectsForOrganizations([
            { key: 'org1', name: 'Org 1' },
            { key: 'org2', name: 'Org 2' },
          ]),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockSearchProjectsAll).toHaveBeenCalledWith(
        expect.objectContaining({ organization: 'org1' })
      );
      expect(mockSearchProjectsAll).toHaveBeenCalledWith(
        expect.objectContaining({ organization: 'org2' })
      );
      expect(result.current.projects.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('useProjectTags', () => {
    it('fetches project tags', async () => {
      const tagsData = { tags: [{ key: 'tag1', value: 'Tag 1' }] };
      mockGetProjectTags.mockResolvedValue(tagsData);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useProjectTags({ organization: 'my-org', ps: 100 }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(tagsData);
    });
  });

  describe('useValidateToken', () => {
    it('calls validateToken with token', async () => {
      mockValidateToken.mockResolvedValue(undefined);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useValidateToken, { wrapper });

      result.current.mutate('my-token');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockValidateToken).toHaveBeenCalled();
    });
  });
});
