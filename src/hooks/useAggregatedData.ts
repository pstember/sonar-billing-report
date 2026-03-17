/**
 * Aggregated billing data hook
 * Fetches and processes project data for billing
 */

import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import SonarCloudService from '../services/sonarcloud';
import { getAuthConfig, getTagMappings, getBillingConfig } from '../services/db';
import { parseLanguageDistribution } from '../utils/dataTransformers';
import { calculateCost } from '../utils/costCalculations';
import type { TeamBillingSummary, ProjectBillingData } from '../types/billing';
import { METRIC_KEYS } from '../types/sonarcloud';

export function useAggregatedBillingData(projectKeys: string[]) {
  // Fetch measures for all selected projects
  const projectQueries = useQueries({
    queries: projectKeys.map((projectKey) => ({
      queryKey: ['projectMeasures', projectKey],
      queryFn: async () => {
        const auth = await getAuthConfig();
        if (!auth) throw new Error('Not authenticated');

        const service = new SonarCloudService({
          baseUrl: auth.baseUrl,
          token: auth.token,
          organization: auth.organization,
          enterpriseKey: auth.enterpriseKey,
        });

        const response = await service.getComponentMeasures({
          component: projectKey,
          metricKeys: [METRIC_KEYS.NCLOC, METRIC_KEYS.NCLOC_LANGUAGE_DISTRIBUTION],
        });

        return response.component;
      },
      enabled: !!projectKey,
    })),
  });

  // Aggregate data by team
  const aggregatedData = useMemo(async () => {
    const tagMappings = await getTagMappings();
    const billingConfig = await getBillingConfig();

    if (!billingConfig) return null;

    const teamMap = new Map<string, TeamBillingSummary>();

    // Process each project
    for (const query of projectQueries) {
      if (!query.data) continue;

      const project = query.data;
      const nclocMeasure = project.measures?.find((m) => m.metric === METRIC_KEYS.NCLOC);
      const langDistMeasure = project.measures?.find(
        (m) => m.metric === METRIC_KEYS.NCLOC_LANGUAGE_DISTRIBUTION
      );

      if (!nclocMeasure || !langDistMeasure) continue;

      const ncloc = parseInt(nclocMeasure.value || '0', 10);
      const languageDistribution = parseLanguageDistribution(langDistMeasure.value || '');

      // Find tags for this project (from project name or configured tags)
      const projectTags: string[] = []; // TODO: Get from project metadata

      // Calculate cost
      const cost = calculateCost(ncloc, billingConfig);

      // Allocate to teams based on tag mappings
      const allocations = projectTags
        .map((tag) => tagMappings.find((m) => m.tag === tag))
        .filter(Boolean);

      for (const mapping of allocations) {
        if (!mapping) continue;

        const teamName = mapping.teamName;
        const percentage = mapping.percentage || 100;
        const allocatedNLOC = (ncloc * percentage) / 100;
        const allocatedCost = (cost * percentage) / 100;

        let teamSummary = teamMap.get(teamName);
        if (!teamSummary) {
          teamSummary = {
            teamName,
            tags: [mapping.tag],
            totalNLOC: 0,
            totalCost: 0,
            projectCount: 0,
            languageBreakdown: {},
            projects: [],
          };
          teamMap.set(teamName, teamSummary);
        }

        teamSummary.totalNLOC += allocatedNLOC;
        teamSummary.totalCost += allocatedCost;
        teamSummary.projectCount += 1;

        // Add language breakdown
        for (const [lang, loc] of Object.entries(languageDistribution)) {
          teamSummary.languageBreakdown[lang] =
            (teamSummary.languageBreakdown[lang] || 0) + (loc * percentage) / 100;
        }

        // Add project
        const projectData: ProjectBillingData = {
          projectKey: project.key,
          projectName: project.name,
          tags: projectTags,
          ncloc,
          languageDistribution,
          teamAllocations: [
            {
              teamName,
              tag: mapping.tag,
              percentage,
              ncloc: allocatedNLOC,
              cost: allocatedCost,
            },
          ],
        };
        teamSummary.projects.push(projectData);
      }
    }

    return Array.from(teamMap.values());
  }, [projectQueries]);

  const isLoading = projectQueries.some((q) => q.isLoading);
  const isError = projectQueries.some((q) => q.isError);

  return {
    data: aggregatedData,
    isLoading,
    isError,
  };
}
