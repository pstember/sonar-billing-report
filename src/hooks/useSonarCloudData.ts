/**
 * React Query hooks for SonarCloud API data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SonarCloudService from '../services/sonarcloud';
import { getAuthConfig } from '../services/db';

/**
 * Hook to get SonarCloud service instance
 */
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
 * Query: Search projects
 */
export function useProjects(params: {
  organization?: string;
  ps?: number;
} = {}) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.searchProjects(params);
    },
    enabled: !!params.organization, // Only fetch if organization is specified
  });
}

/**
 * Query: Get project tags
 */
export function useProjectTags(params: {
  organization?: string;
  ps?: number;
} = {}) {
  return useQuery({
    queryKey: ['projectTags', params],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.getProjectTags(params);
    },
  });
}

/**
 * Query: List portfolios
 */
export function usePortfolios(params: {
  organization?: string;
} = {}) {
  return useQuery({
    queryKey: ['portfolios', params],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.listPortfolios(params);
    },
  });
}

/**
 * Query: Get component measures
 */
export function useComponentMeasures(params: {
  component: string;
  metricKeys: string[];
}) {
  return useQuery({
    queryKey: ['componentMeasures', params],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.getComponentMeasures(params);
    },
    enabled: !!params.component && params.metricKeys.length > 0,
  });
}

/**
 * Query: Get component history
 */
export function useComponentHistory(params: {
  component: string;
  metrics: string[];
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: ['componentHistory', params],
    queryFn: async () => {
      const service = await getSonarCloudService();
      return service.getComponentHistory(params);
    },
    enabled: !!params.component && params.metrics.length > 0,
  });
}

/**
 * Mutation: Validate token
 */
export function useValidateToken() {
  return useMutation({
    mutationFn: async (token: string) => {
      const service = new SonarCloudService({
        baseUrl: '', // Empty string to use proxy server
        token,
      });
      return service.validateToken();
    },
  });
}

/**
 * Hook to prefetch multiple projects data
 */
export function usePrefetchProjects(projectKeys: string[], metricKeys: string[]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const service = await getSonarCloudService();
      const promises = projectKeys.map(component =>
        service.getComponentMeasures({ component, metricKeys })
      );
      return Promise.all(promises);
    },
    onSuccess: (data) => {
      // Cache each project's data
      data.forEach((projectData, index) => {
        queryClient.setQueryData(
          ['componentMeasures', { component: projectKeys[index], metricKeys }],
          projectData
        );
      });
    },
  });
}
