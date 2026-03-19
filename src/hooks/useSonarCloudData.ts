/**
 * React Query hooks for SonarQube Cloud API data fetching
 */

import { useQuery, useQueries, useMutation } from '@tanstack/react-query';
import type { Project } from '../types/sonarcloud';
import SonarCloudService from '../services/sonarcloud';
import { getAuthConfig } from '../services/db';

/** Project with organization attribution for multi-org views */
export interface ProjectWithOrganization extends Project {
  organizationKey: string;
  organizationName: string;
}

/**
 * Hook to get SonarQube Cloud service instance
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

/** Org shape for multi-org projects (key and name for attribution) */
export interface OrgKeyName {
  key: string;
  name: string;
  uuid?: string;
}

/**
 * Fetch projects for multiple organizations and merge with organization attribution.
 * Each project gets organizationKey and organizationName so the UI can show the required Organization column.
 */
export function useProjectsForOrganizations(orgs: OrgKeyName[], ps = 100) {
  const queries = useQueries({
    queries: orgs.map((org) => ({
      queryKey: ['projects', { organization: org.key, ps }],
      queryFn: async () => {
        const service = await getSonarCloudService();
        const res = await service.searchProjects({ organization: org.key, ps });
        const components = (res.components ?? []).map((c) => ({
          ...c,
          organizationKey: org.key,
          organizationName: org.name,
        })) as ProjectWithOrganization[];
        return { ...res, components };
      },
      enabled: orgs.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error;
  const allComponents: ProjectWithOrganization[] = queries.reduce(
    (acc, q) => (q.data?.components ? acc.concat(q.data.components) : acc),
    [] as ProjectWithOrganization[]
  );
  const totalCount = queries.reduce((sum, q) => sum + (q.data?.paging?.total ?? 0), 0);

  return {
    projects: allComponents,
    totalCount,
    paging: { total: totalCount, pageIndex: 1, pageSize: allComponents.length },
    isLoading,
    error,
  };
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
