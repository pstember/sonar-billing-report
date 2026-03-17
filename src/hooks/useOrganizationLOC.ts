/**
 * Hook to fetch total LOC across all organization projects
 * This is used for billing metrics to show org-level usage vs plan limit
 */

import { useQueries } from '@tanstack/react-query';
import { useProjects } from './useSonarCloudData';
import SonarCloudService from '../services/sonarcloud';
import { getAuthConfig } from '../services/db';

export function useOrganizationLOC() {
  // First, get all project keys in the organization
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects({ ps: 100 });

  const projectKeys = projectsData?.components?.map(p => p.key) || [];

  // Then fetch LOC for each project in parallel
  const locQueries = useQueries({
    queries: projectKeys.map((key) => ({
      queryKey: ['projectLOC', key],
      queryFn: async () => {
        const auth = await getAuthConfig();
        if (!auth) throw new Error('Not authenticated');

        const service = new SonarCloudService({
          baseUrl: auth.baseUrl,
          token: auth.token,
          organization: auth.organization,
          enterpriseKey: auth.enterpriseKey,
        });

        try {
          const measures = await service.getComponentMeasures({
            component: key,
            metricKeys: ['ncloc'],
          });

          const nclocMeasure = measures.component?.measures?.find(m => m.metric === 'ncloc');
          return {
            key,
            ncloc: parseInt(nclocMeasure?.value || '0'),
          };
        } catch (error) {
          // If a project fails to fetch, return 0 LOC rather than failing the entire query
          console.warn(`Failed to fetch LOC for project ${key}:`, error);
          return {
            key,
            ncloc: 0,
          };
        }
      },
      // Cache for 5 minutes since org-level LOC doesn't change frequently
      staleTime: 5 * 60 * 1000,
      // Don't retry failed projects immediately
      retry: 1,
    })),
  });

  // Check if all queries are done
  const isLoading = isLoadingProjects || locQueries.some(q => q.isLoading);
  const hasErrors = locQueries.some(q => q.isError);

  // Calculate total LOC from all successful queries
  const totalLOC = locQueries.reduce((sum, query) => {
    if (query.data) {
      return sum + query.data.ncloc;
    }
    return sum;
  }, 0);

  // Get count of projects
  const totalProjects = projectsData?.paging?.total || 0;
  const loadedProjects = locQueries.filter(q => q.data).length;

  return {
    totalLOC,
    totalProjects,
    loadedProjects,
    isLoading,
    hasErrors,
    // Percentage of projects successfully loaded
    loadProgress: totalProjects > 0 ? (loadedProjects / totalProjects) * 100 : 0,
  };
}
