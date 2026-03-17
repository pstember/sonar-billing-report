/**
 * Hook to fetch real project data for billing dashboard
 *
 * LOC trend: uses last-known-value (carry-forward) per project per month.
 * If a project was scanned in Jan (512 LOC) and next in Mar (500 LOC), Feb shows 512.
 * Data is grouped by calendar month; we request up to 12 months of history from the API.
 */

import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import SonarCloudService from '../services/sonarcloud';
import { getAuthConfig } from '../services/db';

/** Number of months of history to request (SonarCloud may return less). */
const TREND_HISTORY_MONTHS = 12;

export interface ProjectData {
  key: string;
  name: string;
  ncloc: number;
  tags: string[];
}

/** One month bucket with carried-forward LOC per project. */
export interface MonthlyProjectLoc {
  monthKey: string;   // e.g. "2025-01"
  monthLabel: string; // e.g. "Jan 2025"
  projectNcloc: Record<string, number>;
}

export function useProjectsRealData(projectKeys: string[]) {
  // Fetch current measures for selected projects
  const projectQueries = useQueries({
    queries: projectKeys.map((key) => ({
      queryKey: ['projectFullData', key],
      queryFn: async () => {
        const auth = await getAuthConfig();
        if (!auth) return null;

        const service = new SonarCloudService({
          baseUrl: auth.baseUrl,
          token: auth.token,
          organization: auth.organization,
          enterpriseKey: auth.enterpriseKey,
        });

        try {
          // Get project details with measures and component info
          const [measuresResponse, componentDetails] = await Promise.all([
            service.getComponentMeasures({
              component: key,
              metricKeys: ['ncloc', 'coverage', 'bugs', 'vulnerabilities', 'code_smells'],
            }),
            service.getComponentDetails(key),
          ]);

          const nclocMeasure = measuresResponse.component.measures?.find(
            (m) => m.metric === 'ncloc'
          );
          const coverageMeasure = measuresResponse.component.measures?.find(
            (m) => m.metric === 'coverage'
          );
          const bugsMeasure = measuresResponse.component.measures?.find(
            (m) => m.metric === 'bugs'
          );

          return {
            key,
            name: measuresResponse.component.name,
            ncloc: nclocMeasure ? Number.parseInt(nclocMeasure.value || '0', 10) : 0,
            coverage: coverageMeasure ? Number.parseFloat(coverageMeasure.value || '0') : 0,
            bugs: bugsMeasure ? Number.parseInt(bugsMeasure.value || '0', 10) : 0,
            tags: componentDetails.component.tags || [],
          };
        } catch (error) {
          console.error(`Error fetching data for ${key}:`, error);
          return null;
        }
      },
      enabled: !!key,
    })),
  });

  // Fetch historical data for trend chart (up to 12 months; SonarCloud may return less)
  const historyQueries = useQueries({
    queries: projectKeys.map((key) => ({
      queryKey: ['projectHistory', key],
      queryFn: async () => {
        const auth = await getAuthConfig();
        if (!auth) return null;

        const service = new SonarCloudService({
          baseUrl: auth.baseUrl,
          token: auth.token,
          organization: auth.organization,
          enterpriseKey: auth.enterpriseKey,
        });

        try {
          const toDate = new Date();
          const fromDate = new Date();
          fromDate.setMonth(fromDate.getMonth() - TREND_HISTORY_MONTHS);

          const historyResponse = await service.getComponentHistory({
            component: key,
            metrics: ['ncloc'],
            from: fromDate.toISOString().split('T')[0],
            to: toDate.toISOString().split('T')[0],
            ps: 1000,
          });

          const projectData = projectQueries.find((q) => q.data?.key === key)?.data;
          const tags = projectData?.tags || [];

          return {
            key,
            tags,
            history: historyResponse.measures?.[0]?.history || [],
          };
        } catch (error) {
          console.error(`Error fetching history for ${key}:`, error);
          return null;
        }
      },
      enabled: !!key,
    })),
  });

  // Aggregate data by tags
  const aggregatedByTag = useMemo(() => {
    const tagMap = new Map<string, { name: string; value: number; projectCount: number }>();

    projectQueries.forEach((query) => {
      if (!query.data) return;

      const project = query.data;

      // If project has no tags, assign to "Untagged"
      const projectTags = project.tags.length > 0 ? project.tags : ['Untagged'];

      projectTags.forEach((tag: string) => {
        const existing = tagMap.get(tag);
        if (existing) {
          existing.value += project.ncloc;
          existing.projectCount += 1;
        } else {
          tagMap.set(tag, {
            name: tag,
            value: project.ncloc,
            projectCount: 1,
          });
        }
      });
    });

    return Array.from(tagMap.values()).sort((a, b) => b.value - a.value);
  }, [projectQueries]);

  // Create pivot table data
  const pivotData = useMemo(() => {
    return projectQueries
      .map((query) => {
        if (!query.data) return null;

        const project = query.data;
        const costPerKLOC = 10; // Default rate - should come from config
        const cost = (project.ncloc / 1000) * costPerKLOC;
        const primaryTag = project.tags.length > 0 ? project.tags[0] : 'Untagged';

        return {
          teamName: primaryTag, // Use first tag as team name
          projectName: project.name,
          projectKey: project.key,
          tags: project.tags.join(', ') || 'Untagged',
          tag: primaryTag,
          ncloc: project.ncloc,
          coverage: project.coverage,
          bugs: project.bugs,
          cost: Math.round(cost * 100) / 100,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [projectQueries]);

  // Build monthly buckets: last N months (aligned to calendar months)
  const monthBuckets = useMemo(() => {
    const buckets: { monthKey: string; monthLabel: string }[] = [];
    const now = new Date();
    for (let i = TREND_HISTORY_MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const monthKey = `${y}-${String(m).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      buckets.push({ monthKey, monthLabel });
    }
    return buckets;
  }, []);

  function lastKnownNclocForMonth(
    history: Array<{ date: string; value: string }>,
    endOfMonthStr: string
  ): number {
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    let lastValue = 0;
    for (const point of sorted) {
      const dateOnly = point.date.split('T')[0];
      if (dateOnly <= endOfMonthStr) {
        lastValue = Number.parseInt(point.value || '0', 10);
      }
    }
    return lastValue;
  }

  // Per-project carry-forward: for each month, use last known ncloc on or before end of that month
  const monthlyTrendByProject = useMemo((): MonthlyProjectLoc[] => {
    return monthBuckets.map(({ monthKey, monthLabel }) => {
      const projectNcloc: Record<string, number> = {};
      const [y, m] = monthKey.split('-').map(Number);
      const endOfMonth = new Date(y, m, 0); // last day of month
      const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

      historyQueries.forEach((query) => {
        if (!query.data?.key || !query.data.history?.length) return;
        const projectKey = query.data.key;
        const lastValue = lastKnownNclocForMonth(query.data.history, endOfMonthStr);
        if (lastValue > 0) {
          projectNcloc[projectKey] = lastValue;
        }
      });

      return { monthKey, monthLabel, projectNcloc };
    });
  }, [historyQueries, monthBuckets]);

  // Legacy trendData: kept for compatibility; dashboard should use monthlyTrendByProject to build by-CC series
  const trendData = useMemo(() => {
    return monthlyTrendByProject.map((m) => {
      const total = Object.values(m.projectNcloc).reduce((s, v) => s + v, 0);
      return {
        date: m.monthLabel,
        Total: total,
        ...m.projectNcloc,
      } as { date: string; [key: string]: string | number };
    });
  }, [monthlyTrendByProject]);

  const isLoading = projectQueries.some((q) => q.isLoading) || historyQueries.some((q) => q.isLoading);
  const isError = projectQueries.some((q) => q.isError) || historyQueries.some((q) => q.isError);

  return {
    projects: projectQueries.map((q) => q.data).filter(Boolean) as Array<{
      key: string;
      name: string;
      ncloc: number;
      coverage: number;
      bugs: number;
      tags: string[];
    }>,
    aggregatedByTag,
    pivotData,
    trendData,
    monthlyTrendByProject,
    isLoading,
    isError,
  };
}
