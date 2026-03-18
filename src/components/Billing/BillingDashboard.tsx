/**
 * Main Billing Dashboard
 * Integrates all billing components (single-org, multi-org aggregate, or all-org summary)
 */

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clearAuth, clearCache, getSetting, saveSetting } from '../../services/db';
import CostCenters from './CostCenters';
import CostCalculator from './CostCalculator';
import LOCTrendChart from '../Charts/LOCTrendChart';
import TeamCostPieChart from '../Charts/TeamCostPieChart';
import BillingPivotTable from '../PivotTable/BillingPivotTable';
import CacheIndicator from '../CacheIndicator';
import LoadProgressBar from './LoadProgressBar';
import OrganizationSelector, { type SelectedOrganization } from '../OrganizationSelector';
import ThemeSelector from '../ThemeSelector';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { getCurrencySymbol } from '../../utils/costCalculations';
import { useProjectsRealData } from '../../hooks/useProjectsRealData';
import { useProjects, useProjectsForOrganizations } from '../../hooks/useSonarCloudData';
import { useBillingOverview, useMultiOrgBillingOverview, useEnterpriseOrganizations } from '../../hooks/useBillingData';
import { useCostCenters, useCostCenterAssignments, useBillingConfig } from '../../hooks/useBilling';

export type ViewMode = 'single' | 'multi' | 'all';

export default function BillingDashboard() {
  const queryClient = useQueryClient();
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<SelectedOrganization | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>('single');
  const [selectedOrganizations, setSelectedOrganizations] = useState<SelectedOrganization[]>([]);

  const { data: enterpriseOrgs = [] } = useEnterpriseOrganizations();
  const hasMultipleOrgs = enterpriseOrgs.length >= 2;

  // Load view mode and selected organizations from settings
  useEffect(() => {
    getSetting<ViewMode>('viewMode').then((mode) => {
      if (mode && (mode === 'single' || mode === 'multi' || mode === 'all')) setViewModeState(mode);
    });
    getSetting<SelectedOrganization[]>('selectedOrganizations').then((orgs) => {
      if (Array.isArray(orgs) && orgs.length > 0) setSelectedOrganizations(orgs);
    });
  }, []);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    saveSetting('viewMode', mode);
  };

  const handleOrganizationsChange = (orgs: SelectedOrganization[]) => {
    setSelectedOrganizations(orgs);
    saveSetting('selectedOrganizations', orgs);
  };

  // Reset selected projects when organization(s) change
  useEffect(() => {
    if (viewMode === 'single' && selectedOrganization) setSelectedProjects([]);
    if (viewMode === 'multi' && selectedOrganizations.length > 0) setSelectedProjects([]);
  }, [viewMode, selectedOrganization, selectedOrganizations]);

  const isMultiOrg = viewMode === 'multi' && selectedOrganizations.length >= 2;

  // Single-org: projects and billing
  const { data: allProjects } = useProjects({
    organization: !isMultiOrg ? selectedOrganization?.key : undefined,
    ps: 100,
  });

  // Multi-org: aggregated billing and merged projects
  const multiBilling = useMultiOrgBillingOverview(isMultiOrg ? selectedOrganizations : []);
  const mergedProjectsResult = useProjectsForOrganizations(isMultiOrg ? selectedOrganizations : []);

  // All-org summary: per-org billing data when view is "All organizations"
  const isAllOrgsView = viewMode === 'all';
  const allOrgsBilling = useMultiOrgBillingOverview(isAllOrgsView ? enterpriseOrgs : []);

  const {
    consumed: singleConsumed,
    limit: singleLimit,
    mode: singleMode,
    privateProjectCount: singlePrivateCount,
    publicProjectCount: singlePublicCount,
    isLoading: isLoadingBillingSingle,
  } = useBillingOverview(!isMultiOrg && selectedOrganization ? { key: selectedOrganization.key, uuid: selectedOrganization.uuid } : undefined);

  const consumed = isMultiOrg ? multiBilling.consumed : singleConsumed;
  const limit = isMultiOrg ? multiBilling.limit : singleLimit;
  const privateProjectCount = isMultiOrg ? multiBilling.privateProjectCount : singlePrivateCount;
  const publicProjectCount = isMultiOrg ? multiBilling.publicProjectCount : singlePublicCount;
  const isLoadingBilling = isMultiOrg ? multiBilling.isLoading : isLoadingBillingSingle;

  const totalProjectCount = isMultiOrg
    ? mergedProjectsResult.totalCount
    : (allProjects?.paging?.total ?? 0);
  const actualPrivateProjectCount = isMultiOrg
    ? mergedProjectsResult.projects.filter((p) => p.visibility === 'private').length
    : (allProjects?.components?.filter((p) => p.visibility === 'private').length ?? 0);
  const actualPublicProjectCount = isMultiOrg
    ? mergedProjectsResult.projects.filter((p) => p.visibility === 'public').length
    : (allProjects?.components?.filter((p) => p.visibility === 'public').length ?? 0);

  const projectKeyToOrgName = useMemo(() => {
    const m = new Map<string, string>();
    mergedProjectsResult.projects.forEach((p) => {
      if ('organizationName' in p) m.set(p.key, p.organizationName);
    });
    return m;
  }, [mergedProjectsResult.projects]);

  /** Per-org private/public counts from projects list (billing NCLOC API often omits visibility) */
  const perOrgProjectCounts = useMemo(() => {
    const m = new Map<string, { private: number; public: number }>();
    mergedProjectsResult.projects.forEach((p) => {
      const key = 'organizationKey' in p ? (p as { organizationKey: string }).organizationKey : '';
      if (!key) return;
      if (!m.has(key)) m.set(key, { private: 0, public: 0 });
      const v = p.visibility === 'private' ? 'private' : 'public';
      m.get(key)![v]++;
    });
    return m;
  }, [mergedProjectsResult.projects]);

  const { data: costCenters = [] } = useCostCenters();
  const { data: allAssignments = [] } = useCostCenterAssignments();
  const { data: billingConfig } = useBillingConfig();

  const projectKeysFromAssignments = useMemo(
    () => [...new Set((allAssignments.filter((a) => (a.type === 'project' || a.projectKey) && a.projectKey).map((a) => a.projectKey!)))],
    [allAssignments]
  );

  const allPrivateProjectKeys = useMemo(
    () =>
      isMultiOrg
        ? mergedProjectsResult.projects.filter((p) => p.visibility === 'private').map((p) => p.key)
        : (allProjects?.components?.filter((p) => p.visibility === 'private').map((p) => p.key) ?? []),
    [isMultiOrg, mergedProjectsResult.projects, allProjects]
  );

  const projectKeysForData = useMemo(
    () => [...new Set(allPrivateProjectKeys.length > 0 ? allPrivateProjectKeys : [...selectedProjects, ...projectKeysFromAssignments])],
    [allPrivateProjectKeys, selectedProjects, projectKeysFromAssignments]
  );

  // Fetch real data for all private projects (or selected + assigned when org list not yet loaded)
  const {
    projects: projectsData,
    monthlyTrendByProject,
    isLoading: isLoadingProjectData,
  } = useProjectsRealData(projectKeysForData);

  // LOC trend by cost center: use monthly carry-forward project LOC, then allocate by CC per month
  // Use a reserved key for aggregate total so a cost center named "Total" doesn't overwrite it
  const AGGREGATE_TOTAL_KEY = '__total__';
  const { realTrendData, trendTeamNames, trendSeriesLabels } = useMemo(() => {
    const projectOnly = allAssignments.filter((a) => (a.type === 'project' || a.projectKey) && a.projectKey && a.costCenterId);
    const ccDisplayNames = costCenters.map((cc) => (cc.code ? `${cc.name} (${cc.code})` : cc.name));
    const data: Array<{ date: string; [key: string]: string | number }> = [];

    monthlyTrendByProject.forEach((month) => {
      const total = Object.values(month.projectNcloc).reduce((s, v) => s + v, 0);
      const row: { date: string; [key: string]: string | number } = {
        date: month.monthLabel,
        [AGGREGATE_TOTAL_KEY]: total,
      };

      costCenters.forEach((cc) => {
        const displayName = cc.code ? `${cc.name} (${cc.code})` : cc.name;
        let ccLoc = 0;
        for (const a of projectOnly) {
          if (a.costCenterId !== cc.id || !a.projectKey) continue;
          const ncloc = month.projectNcloc[a.projectKey] ?? 0;
          const pct = Math.min(100, Math.max(0, a.allocationPercentage ?? 0));
          ccLoc += (ncloc * pct) / 100;
        }
        row[displayName] = Math.round(ccLoc);
      });

      data.push(row);
    });

    const labels: Record<string, string> = { [AGGREGATE_TOTAL_KEY]: 'Total' };
    ccDisplayNames.forEach((name) => {
      labels[name] = name;
    });
    return {
      realTrendData: data,
      trendTeamNames: [...ccDisplayNames, AGGREGATE_TOTAL_KEY],
      trendSeriesLabels: labels,
    };
  }, [monthlyTrendByProject, costCenters, allAssignments]);

  const costCenterDistribution = useMemo(() => {
    const projectOnly = allAssignments.filter((a) => (a.type === 'project' || a.projectKey) && a.projectKey && a.costCenterId);
    const nclocByKey = new Map(projectsData.map((p) => [p.key, p.ncloc]));
    const byCostCenter = new Map<string, number>();
    for (const cc of costCenters) {
      byCostCenter.set(cc.id, 0);
    }
    for (const a of projectOnly) {
      if (!a.projectKey || !a.costCenterId) continue;
      const ncloc = nclocByKey.get(a.projectKey) ?? 0;
      const pct = Math.min(100, Math.max(0, a.allocationPercentage ?? 0));
      byCostCenter.set(a.costCenterId, (byCostCenter.get(a.costCenterId) ?? 0) + (ncloc * pct) / 100);
    }
    const totalInScope = projectsData.reduce((s, p) => s + p.ncloc, 0);
    const allocatedTotal = Array.from(byCostCenter.values()).reduce((s, v) => s + v, 0);
    // Cap at totalInScope so unassigned is never negative (e.g. when allocations sum to >100% per project)
    const unallocatedLoc = Math.max(0, totalInScope - allocatedTotal);
    const segments = costCenters.map((cc) => ({
      name: cc.code ? `${cc.name} (${cc.code})` : cc.name,
      value: Math.round(byCostCenter.get(cc.id) ?? 0),
    }));
    return {
      costCenterSegments: segments,
      unallocatedLoc: Math.round(unallocatedLoc),
      totalInScope,
    };
  }, [costCenters, allAssignments, projectsData]);

  const unusedLoc = limit != null && consumed != null ? Math.max(0, limit - (consumed || 0)) : undefined;

  const billingDetailsData = useMemo(() => {
    const projectOnly = allAssignments.filter((a) => (a.type === 'project' || a.projectKey) && a.projectKey && a.costCenterId);
    const nclocByKey = new Map(projectsData.map((p) => [p.key, p.ncloc]));
    const projectNameByKey = new Map(projectsData.map((p) => [p.key, p.name]));
    const config = billingConfig ?? { defaultRate: 10, currency: 'USD' };
    type Row = {
      costCenterName: string;
      costCenterCode: string;
      projectKey: string;
      projectName: string;
      organizationName?: string;
      allocationPercentage: number;
      ncloc: number;
      allocatedLoc: number;
      cost: number;
      costContractShare: number;
    };
    const rows: Row[] = [];

    // Per-project allocated LOC (sum of allocated portions across all cost center assignments)
    const allocatedByProject = new Map<string, number>();
    for (const a of projectOnly) {
      if (!a.projectKey || !a.costCenterId) continue;
      const ncloc = nclocByKey.get(a.projectKey) ?? 0;
      const pct = Math.min(100, Math.max(0, a.allocationPercentage ?? 0));
      const allocatedLoc = (ncloc * pct) / 100;
      allocatedByProject.set(a.projectKey, (allocatedByProject.get(a.projectKey) ?? 0) + allocatedLoc);
    }

    for (const a of projectOnly) {
      if (!a.projectKey || !a.costCenterId) continue;
      const ncloc = nclocByKey.get(a.projectKey) ?? 0;
      const pct = Math.min(100, Math.max(0, a.allocationPercentage ?? 0));
      const allocatedLoc = Math.round((ncloc * pct) / 100);
      const cc = costCenters.find((c) => c.id === a.costCenterId);
      rows.push({
        costCenterName: cc?.name ?? 'Unknown',
        costCenterCode: cc?.code ?? '',
        projectKey: a.projectKey,
        projectName: projectNameByKey.get(a.projectKey) ?? a.projectKey,
        organizationName: projectKeyToOrgName.get(a.projectKey),
        allocationPercentage: pct,
        ncloc,
        allocatedLoc,
        cost: 0,
        costContractShare: 0,
      });
    }

    // Single "Unassigned" row: sum all LOC not assigned to any cost center (cost to absorb at group level).
    // Cap allocated per project at ncloc so over-allocations (e.g. 80% + 21%) don't force unassigned to 0.
    let totalUnassignedLoc = 0;
    for (const p of projectsData) {
      const allocatedRaw = allocatedByProject.get(p.key) ?? 0;
      const allocatedForProject = Math.min(allocatedRaw, p.ncloc);
      const unassignedLoc = Math.round(Math.max(0, p.ncloc - allocatedForProject));
      totalUnassignedLoc += unassignedLoc;
    }
    if (totalUnassignedLoc > 0) {
      rows.push({
        costCenterName: 'Unassigned',
        costCenterCode: '',
        projectKey: '__unassigned__',
        projectName: 'All unassigned',
        organizationName: isMultiOrg ? '—' : undefined,
        allocationPercentage: 0,
        ncloc: totalUnassignedLoc,
        allocatedLoc: 0,
        cost: 0,
        costContractShare: 0,
      });
    }

    const totalScopeLoc = rows.reduce((s, r) => s + r.allocatedLoc, 0);
    const contractValue = config.contractValue ?? 0;
    const planAllowanceLOC = limit != null && limit > 0 ? limit : totalScopeLoc;
    const totalInScope = totalScopeLoc + totalUnassignedLoc;

    // Rate-based cost: spread contract value over all in-scope LOC (allocated + unassigned) so cost to absorb is visible
    const ratePerLOC = totalInScope > 0 && contractValue > 0 ? contractValue / totalInScope : 0;
    for (const r of rows) {
      const locForCost = r.projectKey === '__unassigned__' ? totalUnassignedLoc : r.allocatedLoc;
      r.cost = Math.round(locForCost * ratePerLOC * 100) / 100;
      r.costContractShare = planAllowanceLOC > 0 && contractValue > 0
        ? Math.round((locForCost * contractValue) / planAllowanceLOC * 100) / 100
        : 0;
    }

    // Unused LOC row: bridge so total in the table matches the plan allowance when there is headroom.
    const unusedAllocatedLOC = planAllowanceLOC > totalInScope
      ? Math.round(planAllowanceLOC - totalInScope)
      : 0;
    if (unusedAllocatedLOC > 0) {
      rows.push({
        costCenterName: '—',
        costCenterCode: '',
        projectKey: '__unused__',
        projectName: 'Unused LOC',
        organizationName: isMultiOrg ? '—' : undefined,
        allocationPercentage: 0,
        ncloc: unusedAllocatedLOC,
        allocatedLoc: 0,
        cost: 0,
        costContractShare: 0,
      });
    }

    const shareBasisLOC = rows.reduce((s, r) => {
      if (r.projectKey === '__unassigned__') return s + totalUnassignedLoc;
      if (r.projectKey === '__unused__') return s + unusedAllocatedLOC;
      return s + r.allocatedLoc;
    }, 0);
    const shareRows = rows.map((r) => {
      const locForShare = r.projectKey === '__unassigned__'
        ? totalUnassignedLoc
        : r.projectKey === '__unused__'
          ? unusedAllocatedLOC
          : r.allocatedLoc;
      const exactShare = shareBasisLOC > 0 && contractValue > 0 ? (locForShare * contractValue) / shareBasisLOC : 0;
      return { ...r, costContractShare: exactShare };
    });
    let allocatedShareTotal = 0;
    for (let i = 0; i < shareRows.length; i++) {
      if (i < shareRows.length - 1) {
        shareRows[i].costContractShare = Math.round(shareRows[i].costContractShare * 100) / 100;
        allocatedShareTotal += shareRows[i].costContractShare;
      } else if (shareRows.length > 0) {
        shareRows[i].costContractShare = Math.round((contractValue - allocatedShareTotal) * 100) / 100;
      }
    }
    rows.splice(0, rows.length, ...shareRows);
    return { rows, totalScopeLoc };
  }, [costCenters, allAssignments, projectsData, billingConfig, limit, isMultiOrg, projectKeyToOrgName]);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      queryClient.clear();
      await clearCache();
      await clearAuth();
      window.location.reload();
    }
  };

  // Trend chart series: Total + cost center names (from monthly carry-forward LOC)

  const billingRows = billingDetailsData.rows;
  const billingTotals = useMemo(() => {
    return {
      allocatedLoc: billingRows.reduce((s, r) => s + r.allocatedLoc, 0),
      cost: billingRows.reduce((s, r) => s + r.cost, 0),
      costContractShare: billingRows.reduce((s, r) => s + r.costContractShare, 0),
    };
  }, [billingRows]);

  const chartSegmentData = useMemo(() => {
    const costByName = new Map<string, number>();
    const licenseShareByName = new Map<string, number>();
    for (const r of billingRows) {
      if (r.projectKey === '__unassigned__' || r.projectKey === '__unused__') continue;
      const name = r.costCenterCode ? `${r.costCenterName} (${r.costCenterCode})` : r.costCenterName;
      costByName.set(name, (costByName.get(name) ?? 0) + r.cost);
      licenseShareByName.set(name, (licenseShareByName.get(name) ?? 0) + r.costContractShare);
    }
    const segments = costCenterDistribution.costCenterSegments.map((seg) => ({
      ...seg,
      cost: costByName.get(seg.name) ?? 0,
      licenseShare: licenseShareByName.get(seg.name) ?? 0,
    }));
    const unassignedRow = billingRows.find((r) => r.projectKey === '__unassigned__');
    const unassignedCost = unassignedRow?.cost ?? 0;
    const unassignedLicenseShare = unassignedRow?.costContractShare ?? 0;
    const unusedLicenseShare = billingRows.find((r) => r.projectKey === '__unused__')?.costContractShare ?? 0;
    return { segments, unassignedCost, unassignedLicenseShare, unusedLicenseShare };
  }, [billingRows, costCenterDistribution.costCenterSegments]);

  // Calculate stats for selected projects (exclude 0 LOC = no scan)
  const selectedLOC = projectsData.reduce((sum, p) => sum + p.ncloc, 0);

  const buildExportRows = useMemo(() => {
    const curr = billingConfig?.currency ?? 'USD';
    const sym = getCurrencySymbol(curr);
    return (rows: typeof billingRows, totalLoc: number, totals: { allocatedLoc: number; cost: number; costContractShare: number }) => {
      const baseRow = (row: typeof billingRows[0]) => ({
        ...(isMultiOrg ? { Organization: row.organizationName ?? '—' } : {}),
        'Cost center': row.costCenterCode ? `${row.costCenterName} (${row.costCenterCode})` : row.costCenterName,
        Project: row.projectName,
        'Allocation %': row.allocationPercentage,
        'Total LOC': row.ncloc,
        'Allocated LOC': row.allocatedLoc,
        [`Cost rate-based (${sym})`]: row.cost,
        [`License share (${sym})`]: row.costContractShare,
      });
      const data = rows.map(baseRow);
      data.push({
        ...(isMultiOrg ? { Organization: '—' } : {}),
        'Cost center': 'Total',
        Project: 'All projects',
        'Allocation %': 0,
        'Total LOC': totalLoc,
        'Allocated LOC': totals.allocatedLoc,
        [`Cost rate-based (${sym})`]: totals.cost,
        [`License share (${sym})`]: totals.costContractShare,
      });
      return data;
    };
  }, [billingConfig?.currency, isMultiOrg]);

  const handleExportCSV = () => {
    if (!billingRows || billingRows.length === 0) return;
    exportToCSV(buildExportRows(billingRows, selectedLOC, billingTotals), `billing-details-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportExcel = () => {
    if (!billingRows || billingRows.length === 0) return;
    exportToExcel(buildExportRows(billingRows, selectedLOC, billingTotals), `billing-details-${new Date().toISOString().split('T')[0]}.xlsx`, 'Billing Details');
  };

  const handleExportPDF = () => {
    if (!billingRows || billingRows.length === 0) return;
    exportToPDF(buildExportRows(billingRows, selectedLOC, billingTotals), `billing-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };
  const selectedCount = selectedProjects.length;
  const projectsWithLoc = useMemo(
    () => projectsData.filter((p) => p.ncloc > 0),
    [projectsData]
  );
  const { medianLOCPerProject, minLoc, maxLoc } = useMemo(() => {
    if (projectsWithLoc.length === 0) return { medianLOCPerProject: null, minLoc: null, maxLoc: null };
    const sorted = [...projectsWithLoc].map((p) => p.ncloc).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    return {
      medianLOCPerProject: median,
      minLoc: sorted[0],
      maxLoc: sorted.at(-1) ?? null,
    };
  }, [projectsWithLoc]);

  // ONLY use data from billing API - no fallbacks to configured limits
  // consumed = total LOC used across all private projects in the organization
  // limit = total LOC available in the organization's plan (from consumption API)
  const actualConsumed = consumed || 0;
  const actualLimit = limit || 0;
  const actualUsagePercent = actualLimit > 0 ? (actualConsumed / actualLimit) * 100 : 0;

  return (
    <div className="min-h-screen bg-sonar-background">
      <header className="bg-white dark:bg-slate-800 shadow-md border-b-2 border-sonar-blue/10 dark:border-slate-700">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-sonar-purple dark:text-white">
              SonarCloud Billing Dashboard
            </h1>
            <div className="flex items-center gap-3">
              <ThemeSelector />
              <button
                onClick={handleLogout}
                className="btn-sonar-danger px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-body"
              >
                Logout
              </button>
            </div>
          </div>
          {hasMultipleOrgs ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-sonar-purple dark:text-white uppercase tracking-wide">View</span>
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  {(['single', 'multi', 'all'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={`px-4 py-2 text-sm font-medium font-body transition-colors ${
                        viewMode === mode
                          ? 'bg-sonar-blue text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {mode === 'single' && 'Single organization'}
                      {mode === 'multi' && 'Multiple organizations'}
                      {mode === 'all' && 'All organizations'}
                    </button>
                  ))}
                </div>
              </div>
              {viewMode === 'single' && (
                <OrganizationSelector onOrganizationChange={setSelectedOrganization} />
              )}
              {viewMode === 'multi' && (
                <OrganizationSelector
                  multiSelect
                  selectedOrganizations={selectedOrganizations}
                  onOrganizationsChange={handleOrganizationsChange}
                />
              )}
              {viewMode === 'all' && (
                <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
                  <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Showing all organizations in enterprise</span>
                </div>
              )}
            </div>
          ) : (
            <OrganizationSelector onOrganizationChange={setSelectedOrganization} />
          )}
        </div>
      </header>

      <LoadProgressBar />
      <CacheIndicator />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {viewMode === 'all' ? (
            /* All organizations summary view */
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-sonar-purple dark:text-white">All organizations</h2>
              <p className="text-gray-600 dark:text-slate-300 font-body">
                Summary of billing and usage per organization. Open one to view its dashboard or add several to compare.
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-body">
                <span className="inline-block px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 font-medium mr-1">Reserved</span> = per-org;
                <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 font-medium ml-1 mr-1">Pooled</span> = shared (counted once in enterprise total).
              </p>
              {allOrgsBilling.isLoading ? (
                <div className="flex items-center justify-center gap-3 py-12 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sonar-blue" />
                  <span className="text-gray-600 dark:text-slate-300">Loading organization data...</span>
                </div>
              ) : allOrgsBilling.byOrg.length === 0 ? (
                <div className="py-12 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 text-center text-gray-600 dark:text-slate-300">
                  No organizations found.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {allOrgsBilling.byOrg.map((org) => (
                    <div
                      key={org.key}
                      className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-600 p-5 hover:border-sonar-blue/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <h3 className="text-lg font-bold text-sonar-purple dark:text-white truncate min-w-0" title={org.name}>{org.name}</h3>
                        {org.mode === 'unreserved' ? (
                          <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" title="Pooled LOC — counted once in enterprise total">Pooled</span>
                        ) : org.mode === 'absoluteReserved' ? (
                          <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" title="Reserved LOC — counted per organization in total">Reserved</span>
                        ) : null}
                      </div>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-slate-400">Consumed</dt>
                          <dd className="font-medium tabular-nums text-gray-900 dark:text-white">{(org.consumed ?? 0).toLocaleString()} LOC</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-slate-400">Limit</dt>
                          <dd className="font-medium tabular-nums text-gray-900 dark:text-white">{(org.limit ?? 0).toLocaleString()} LOC</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-slate-400">Usage</dt>
                          <dd className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{org.usagePercent.toFixed(1)}%</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-slate-400">Projects</dt>
                          <dd className="font-medium tabular-nums text-gray-900 dark:text-white">{org.privateProjectCount} private / {org.publicProjectCount} public</dd>
                        </div>
                      </dl>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setViewMode('single');
                            setSelectedOrganization({ key: org.key, name: org.name, uuid: org.uuid });
                            saveSetting('selectedOrganization', org.key);
                          }}
                          className="btn-sonar-primary px-3 py-1.5 text-sm rounded-lg"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setViewMode('multi');
                            const next = [...selectedOrganizations];
                            if (!next.some((o) => o.key === org.key)) next.push({ key: org.key, name: org.name, uuid: org.uuid });
                            setSelectedOrganizations(next);
                            handleOrganizationsChange(next);
                          }}
                          className="btn-sonar-accent px-3 py-1.5 text-sm rounded-lg"
                        >
                          Add to compare
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Always-Visible Billing Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Projects Assigned - donut with count in center */}
                    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl border-2 border-gray-100 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-sonar-purple dark:text-white font-body uppercase tracking-wider">
                          Projects Assigned
                        </h3>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {actualPrivateProjectCount > 0 ? (() => {
                          const assignedPct = selectedCount / actualPrivateProjectCount;
                          const deg = Math.min(1, assignedPct) * 360;
                          return (
                            <div
                              className="relative flex-shrink-0 w-20 h-20 rounded-full"
                              title={`${selectedCount} of ${actualPrivateProjectCount} private projects assigned`}
                              style={{
                                background: `conic-gradient(#4f46e5 0deg ${deg}deg, #94a3b8 ${deg}deg 360deg)`,
                              }}
                            >
                              <div className="absolute inset-[10px] rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                                <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{selectedCount}</span>
                              </div>
                            </div>
                          );
                        })() : (
                        <div className="relative flex-shrink-0 w-20 h-20 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                            <span className="text-2xl font-black text-gray-500 dark:text-slate-200 tabular-nums">—</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xl font-bold text-gray-900 dark:text-slate-100 tabular-nums">
                            {selectedCount}<span className="text-lg text-gray-600 dark:text-slate-300 font-semibold">/{actualPrivateProjectCount}</span>
                          </p>
                          <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                            {actualPrivateProjectCount > 0 ? ((selectedCount / actualPrivateProjectCount) * 100).toFixed(0) : 0}% of private projects
                          </p>
                          <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                            {totalProjectCount} total ({actualPublicProjectCount} public)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* LOC attributed to cost centers - donut with value in center */}
                    <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-950 rounded-2xl shadow-xl border-2 border-blue-100 dark:border-blue-900 p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-sonar-purple dark:text-white font-body uppercase tracking-wider">
                          LOC attributed to cost centers
                        </h3>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sonar-blue to-sonar-blue-secondary flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {(selectedCount > 0 || projectKeysFromAssignments.length > 0) ? (() => {
                          const total = billingTotals.allocatedLoc + costCenterDistribution.unallocatedLoc;
                          if (total <= 0) {
                            return (
                              <div className="relative flex-shrink-0 w-20 h-20 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                                <span className="text-sm font-black text-sonar-blue dark:text-sky-300 tabular-nums">—</span>
                              </div>
                            );
                          }
                          const allocatedPct = billingTotals.allocatedLoc / total;
                          const deg = allocatedPct * 360;
                          return (
                            <div
                              className="relative flex-shrink-0 w-20 h-20 rounded-full"
                              title={`Allocated: ${billingTotals.allocatedLoc.toLocaleString()} · Unassigned: ${costCenterDistribution.unallocatedLoc.toLocaleString()}`}
                              style={{
                                background: `conic-gradient(#3b82f6 0deg ${deg}deg, #94a3b8 ${deg}deg 360deg)`,
                              }}
                            >
                              <div className="absolute inset-[10px] rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                                <span className="text-sm font-black text-sonar-blue dark:text-sky-300 tabular-nums leading-tight text-center px-0.5 truncate max-w-full">
                                  {billingTotals.allocatedLoc.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })() : (
                          <div className="relative flex-shrink-0 w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-lg font-black text-gray-500 dark:text-slate-300 tabular-nums">—</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                            LOC attributed to cost centers
                          </p>
                          {(selectedCount > 0 || projectKeysFromAssignments.length > 0) && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                              of {selectedLOC.toLocaleString()} total LOC in scope
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Plan Usage - headroom = allowance − consumed */}
                    <div className="bg-gradient-to-br from-white to-emerald-50 dark:from-gray-800 dark:to-emerald-950 rounded-2xl shadow-xl border-2 border-emerald-100 dark:border-emerald-900 p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-3">
<h3 className="text-xs font-bold text-sonar-purple dark:text-white font-body uppercase tracking-wider">
                          Plan Usage {limit && limit > 0 && <span className="text-green-600">●</span>}
                          </h3>
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                            {isLoadingBilling ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <div className="mb-2">
                          <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {isLoadingBilling ? (
                                <span className="text-2xl text-slate-200">...</span>
                            ) : (
                              <>{actualUsagePercent.toFixed(1)}<span className="text-2xl">%</span></>
                            )}
                          </p>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              isLoadingBilling ? 'bg-blue-500' : actualUsagePercent > 90 ? 'bg-red-500' : actualUsagePercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${isLoadingBilling ? 50 : Math.min(actualUsagePercent, 100)}%` }}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                            {isLoadingBilling ? (
                              `Loading billing data...`
                            ) : (
                              <>
                                <span className="font-semibold text-gray-700 dark:text-slate-100">{actualConsumed.toLocaleString()} LOC used</span>
                                <span className="mx-1">of</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-300">{actualLimit.toLocaleString()} LOC available</span>
                                {singleMode && !isMultiOrg && (
                                  <span className="text-gray-500 dark:text-slate-400 font-normal">
                                    {' '}({singleMode === 'absoluteReserved' ? 'Reserved' : 'Pooled'})
                                  </span>
                                )}
                              </>
                            )}
                          </p>
                          {!isLoadingBilling && limit && limit > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-300 font-semibold">
                              ✓ Live data from Billing API
                            </p>
                          )}
                          {!isLoadingBilling && !limit && (
                            <p className="text-xs text-red-500 dark:text-red-300 font-semibold">
                              ⚠ No billing data available from API
                            </p>
                          )}
                          {!isLoadingBilling && privateProjectCount > 0 && (
                            <p className="text-xs text-gray-600 dark:text-slate-400">
                              {privateProjectCount} private project{privateProjectCount !== 1 ? 's' : ''} • {publicProjectCount} public
                            </p>
                          )}
                          {!isLoadingBilling && unusedLoc != null && (
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              FYI — Headroom: {unusedLoc.toLocaleString()} LOC
                            </p>
                          )}
                        </div>
                      </div>

                    {/* Median LOC Per Project */}
                    <div className="bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-950 rounded-2xl shadow-xl border-2 border-purple-100 dark:border-purple-900 p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-sonar-purple dark:text-white font-body uppercase tracking-wider">
                          Median LOC Per Project
                        </h3>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-4xl font-black text-purple-600 dark:text-purple-300 tabular-nums mb-1">
                        {medianLOCPerProject != null ? medianLOCPerProject.toLocaleString() : '—'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                        Typical codebase size (scanned projects only)
                      </p>
                      {minLoc != null && maxLoc != null && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          FYI — Largest: {maxLoc.toLocaleString()} LOC · Smallest: {minLoc.toLocaleString()} LOC
                        </p>
                      )}
                    </div>
                  </div>

                  {isMultiOrg && selectedOrganizations.length >= 2 && (() => {
                    const results = multiBilling.orgResults ?? multiBilling.byOrg.map((o) => ({ org: { key: o.key, name: o.name, uuid: o.uuid }, data: o, isPending: false, error: null }));
                    return (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-600">
                        <h3 className="text-lg font-bold text-sonar-purple dark:text-white">
                          Per-organization breakdown
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          Reserved = per-org usage; Pooled = shared, counted once in total above.
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-4 py-2 text-left text-gray-700 dark:text-slate-200 font-medium">Organization</th>
                              <th className="px-4 py-2 text-left text-gray-700 dark:text-slate-200 font-medium">Billing</th>
                              <th className="px-4 py-2 text-right text-gray-700 dark:text-slate-200 font-medium">Consumed (LOC)</th>
                              <th className="px-4 py-2 text-right text-gray-700 dark:text-slate-200 font-medium">Limit (LOC)</th>
                              <th className="px-4 py-2 text-right text-gray-700 dark:text-slate-200 font-medium">Usage %</th>
                              <th className="px-4 py-2 text-right text-gray-700 dark:text-slate-200 font-medium">Private / Public</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                            {results.map(({ org, data, isPending, error: rowError }) => {
                              const counts = perOrgProjectCounts.get(org.key);
                              const privateCount = counts?.private ?? data?.privateProjectCount ?? 0;
                              const publicCount = counts?.public ?? data?.publicProjectCount ?? 0;
                              return (
                                <tr key={org.key} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{org.name}</td>
                                  <td className="px-4 py-2">
                                    {rowError || isPending ? '—' : data?.mode === 'unreserved' ? (
                                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" title="Pooled — counted once in total">Pooled</span>
                                    ) : data?.mode === 'absoluteReserved' ? (
                                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" title="Reserved — counted per org in total">Reserved</span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                    {rowError ? '—' : isPending ? '…' : (data?.consumed ?? 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                    {rowError ? '—' : isPending ? '…' : (data?.limit ?? 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                    {rowError ? '—' : isPending ? '…' : (data?.usagePercent ?? 0).toFixed(1)}%
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-slate-400">
                                    {rowError ? '—' : isPending ? '…' : `${privateCount} / ${publicCount}`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ); })()}

                  <CostCenters
                    key={isMultiOrg ? `multi-${selectedOrganizations.map((o) => o.key).join(',')}` : (selectedOrganization?.key ?? 'no-org')}
                    organization={isMultiOrg ? undefined : selectedOrganization?.key}
                    projectsWithOrg={isMultiOrg ? mergedProjectsResult.projects : undefined}
                    onProjectsSelected={setSelectedProjects}
                  />

                  {(selectedProjects.length > 0 || projectKeysFromAssignments.length > 0) && (
                    <>
                  {isLoadingProjectData && projectKeysForData.length > 0 && (
                    <div className="bg-sonar-blue/10 border border-sonar-blue/20 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sonar-blue"></div>
                        <p className="text-sonar-purple dark:text-white font-body font-medium">
                          Loading detailed project data...
                        </p>
                      </div>
                    </div>
                  )}

                  {(!isLoadingProjectData || projectKeysForData.length === 0) && (
                    <>
                      {(selectedProjects.length > 0 || projectKeysFromAssignments.length > 0) && !isLoadingProjectData && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <LOCTrendChart
                            data={realTrendData}
                            teamNames={trendTeamNames}
                            seriesLabels={trendSeriesLabels}
                            chartId={selectedOrganization?.key}
                            aggregateTotalKey={AGGREGATE_TOTAL_KEY}
                          />
                          <TeamCostPieChart
                            costCenterSegments={chartSegmentData.segments}
                            unallocatedLoc={costCenterDistribution.unallocatedLoc}
                            unusedLoc={unusedLoc}
                            unassignedCost={chartSegmentData.unassignedCost}
                            unassignedLicenseShare={chartSegmentData.unassignedLicenseShare}
                            unusedLicenseShare={chartSegmentData.unusedLicenseShare}
                            currency={billingConfig?.currency ?? 'USD'}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Billing Details table always visible so the grid and headers render */}
                      <BillingPivotTable
                          data={billingRows}
                          currency={billingConfig?.currency ?? 'USD'}
                          totals={billingTotals}
                          showOrganizationColumn={isMultiOrg}
                        />

              {selectedProjects.length === 0 && projectKeysFromAssignments.length === 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-12 text-center border-t-4 border-sonar-blue">
                  <div className="text-gray-600 dark:text-slate-300 mb-4">
                    <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-sonar-purple dark:text-white mb-2">
                    No Projects Assigned
                  </h3>
                  <p className="text-gray-600 dark:text-slate-300 font-body">
                    Assign one or more projects to cost centers in the section above to view billing analytics
                  </p>
                </div>
              )}

          {viewMode === 'multi' && selectedOrganizations.length < 2 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <p className="text-amber-800 dark:text-amber-200 font-body">
                Select at least 2 organizations above to see the aggregate view and assign projects across them.
              </p>
            </div>
          )}

          {/* Config: cost calculator */}
          <div className="space-y-6">
            {isMultiOrg && (
              <p className="text-sm text-gray-600 dark:text-slate-400 font-body">
                Plan allowance below is aggregated across {selectedOrganizations.length} organization{selectedOrganizations.length !== 1 ? 's' : ''}.
              </p>
            )}
            <CostCalculator planAllowanceLOC={limit} />
          </div>

          {/* Reports: export actions */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border-t-4 border-sonar-blue">
            <h2 className="text-2xl font-bold mb-4 text-sonar-purple dark:text-white">Billing Reports</h2>
            <p className="text-gray-600 dark:text-slate-300 font-body">
              Export and download billing reports for selected period and teams.
            </p>
            <div className="mt-6 flex gap-4 flex-wrap">
              <button
                onClick={handleExportExcel}
                className="btn-sonar-primary px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-body"
              >
                Export to Excel
              </button>
              <button
                onClick={handleExportCSV}
                className="btn-sonar-primary px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-body"
              >
                Export to CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="btn-sonar-accent px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-body"
              >
                Generate PDF Report
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
