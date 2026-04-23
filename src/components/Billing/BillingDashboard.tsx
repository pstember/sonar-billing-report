/**
 * Main Billing Dashboard
 * Integrates all billing components (single-org, multi-org aggregate, or all-org summary)
 */

import { useState, useEffect, useMemo, useRef, useCallback, startTransition, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clearAuth, clearCache } from '../../services/db';
import { getSetting, saveSetting } from '../../services/store';
import CostCenters from './CostCenters';
import CostCalculator from './CostCalculator';
import LOCTrendChart from '../Charts/LOCTrendChart';
import TeamCostPieChart from '../Charts/TeamCostPieChart';
import BillingPivotTable from '../PivotTable/BillingPivotTable';
import CacheIndicator from '../CacheIndicator';
import LoadProgressBar from './LoadProgressBar';
import OrganizationSelector, { type SelectedOrganization } from '../OrganizationSelector';
import ThemeSelector from '../ThemeSelector';
import { formatCompactLoc } from '../../utils/dataTransformers';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { getCurrencySymbol } from '../../utils/costCalculations';
import { useProjectsRealData } from '../../hooks/useProjectsRealData';
import { useProjects, useProjectsForOrganizations } from '../../hooks/useSonarCloudData';
import { useBillingOverview, useMultiOrgBillingOverview, useEnterpriseOrganizations, useEnterpriseConsumptionSummaries, useBillingNCLOCDistribution, type BillingOverviewOrg } from '../../hooks/useBillingData';
import { filterAssignmentsInScope } from '../../utils/assignmentScope';
import { useCostCenters, useCostCenterAssignments, useBillingConfig } from '../../hooks/useBilling';
import { useSonarCacheRead, useRefetchAndCache, useAutoSaveBillingNCLOC } from '../../hooks/useSonarCache';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { Toast } from '../Shared/Toast';
import { HelpIcon } from '../Shared/HelpIcon';

export type ViewMode = 'single' | 'multi' | 'all';

// Stable empty array constant — prevents new reference on every render when query data is undefined.
// NEVER use `= []` inline as a default for React Query results; it creates a new reference each render,
// which cascades through useMemo deps and triggers useEffect on every render → infinite loop.
const EMPTY_ARRAY: never[] = [];

function tableCellContent(rowError: unknown, isPending: boolean, getValue: () => string | number): string {
  if (rowError) return '—';
  if (isPending) return '…';
  const v = getValue();
  return typeof v === 'number' ? v.toLocaleString() : v;
}

function renderModeCell(rowError: unknown, isPending: boolean, mode: string | undefined): ReactNode {
  if (rowError || isPending) return '—';
  if (mode) return <OrgModeBadge mode={mode} />;
  return '—';
}

/**
 * For pooled (unreserved) orgs the per-org limit equals the shared pool size and is
 * shown on every row — misleading. Replace with a muted label instead.
 */
function renderLimitCell(rowError: unknown, isPending: boolean, data: BillingOverviewOrg | undefined): ReactNode {
  if (rowError) return '—';
  if (isPending) return '…';
  if (data?.mode === 'unreserved') {
    return <span className="text-gray-400 dark:text-slate-500 italic text-xs" title="Limit is shared across all pooled organisations">Shared pool</span>;
  }
  return (data?.limit ?? 0).toLocaleString();
}

/**
 * Usage % is meaningless per-org for pooled orgs (individual contribution / shared pool ≈ 0%).
 * Show a dash instead.
 */
function renderUsagePercentCell(rowError: unknown, isPending: boolean, data: BillingOverviewOrg | undefined): ReactNode {
  if (rowError) return '—';
  if (isPending) return '…';
  if (data?.mode === 'unreserved') {
    return <span className="text-gray-400 dark:text-slate-500" title="Usage % is shared across all pooled organisations and is not meaningful per organisation">—</span>;
  }
  return `${(data?.usagePercent ?? 0).toFixed(1)}%`;
}

function OrgModeBadge({ mode }: { mode: string }) {
  if (mode === 'unreserved') {
    return (
      <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" title="Pooled LOC — counted once in enterprise total">
        Pooled
      </span>
    );
  }
  if (mode === 'absoluteReserved') {
    return (
      <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" title="Reserved LOC — counted per organisation in total">
        Reserved
      </span>
    );
  }
  return null;
}

function formatFetchedAt(fetchedAt: string | null | undefined): string {
  if (!fetchedAt) return 'Never';
  const diff = Date.now() - new Date(fetchedAt).getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) return 'Less than 1 hour ago';
  if (hours < 24) return `${Math.floor(hours)} hour${Math.floor(hours) === 1 ? '' : 's'} ago`;
  return new Date(fetchedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function BillingDashboard() {
  const queryClient = useQueryClient();
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<SelectedOrganization | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [selectedOrganizations, setSelectedOrganizations] = useState<SelectedOrganization[]>([]);
  // Separate state that drives actual API queries — debounced so rapid checkbox
  // clicks don't fire a new wave of API calls on every single toggle.
  const [queriedOrganizations, setQueriedOrganizations] = useState<SelectedOrganization[]>([]);
  const [showLOCExplainer, setShowLOCExplainer] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingSteps, setOnboardingSteps] = useState({
    createdCostCenter: false,
    assignedProjects: false,
    setContractValue: false,
    viewedBreakdown: false,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [celebrationMilestones, setCelebrationMilestones] = useState({
    firstCostCenter: false,
    fullAllocation: false,
    tenthExport: false,
    exportCount: 0,
  });

  const { data: enterpriseData, isLoading: isLoadingEnterprise } = useEnterpriseOrganizations();
  const enterpriseOrgs = enterpriseData?.organizations ?? [];
  const enterpriseName = enterpriseData?.enterpriseName;

  const applyViewMode = (mode: ViewMode) => {
    // Low-priority transition: keeps the browser responsive while the 1500-line
    // component re-renders with the new view mode.
    startTransition(() => { setViewMode(mode); });
    saveSetting('viewMode', mode).catch(() => {});
  };

  // Load view mode and selected organizations from settings
  useEffect(() => {
    const load = async () => {
      try {
        const [mode, orgs, onboardingCompleted, steps, milestones] = await Promise.all([
          getSetting<ViewMode>('viewMode'),
          getSetting<SelectedOrganization[]>('selectedOrganizations'),
          getSetting<boolean>('onboardingCompleted'),
          getSetting<typeof onboardingSteps>('onboardingSteps'),
          getSetting<typeof celebrationMilestones>('celebrationMilestones'),
        ]);
        if (mode && (mode === 'single' || mode === 'multi' || mode === 'all')) setViewMode(mode);
        if (Array.isArray(orgs) && orgs.length > 0) {
          setSelectedOrganizations(orgs);
          setQueriedOrganizations(orgs); // no debounce on initial load
        }
        if (!onboardingCompleted) setShowOnboarding(true);
        if (steps) setOnboardingSteps(steps);
        if (milestones) setCelebrationMilestones(milestones);
      } catch { /* ignore */ }
    };
    load().catch(() => {});
  }, []);

  const saveOrgsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleOrganizationsChange = useCallback((orgs: SelectedOrganization[]) => {
    // Update checkbox UI immediately (low-priority render)
    startTransition(() => { setSelectedOrganizations(orgs); });
    // Debounce both the API queries and the DB write so rapid checkbox clicks
    // don't fire a new wave of network requests on every single toggle.
    if (saveOrgsTimer.current) clearTimeout(saveOrgsTimer.current);
    saveOrgsTimer.current = setTimeout(() => {
      setQueriedOrganizations(orgs);
      saveSetting('selectedOrganizations', orgs).catch(() => {});
    }, 400);
  }, []);

  // Reset selected projects when organization(s) change (intentional sync when org changes)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection when org changes
    if (viewMode === 'single' && selectedOrganization) setSelectedProjects([]);
    if (viewMode === 'multi' && selectedOrganizations.length > 0) setSelectedProjects([]);
  }, [viewMode, selectedOrganization, selectedOrganizations]);

  // queriedOrganizations drives API calls (debounced); selectedOrganizations drives UI checkboxes (immediate)
  const isMultiOrg = viewMode === 'multi' && queriedOrganizations.length >= 2;

  // Single-org: projects and billing
  const { data: allProjects } = useProjects({
    organization: isMultiOrg ? undefined : selectedOrganization?.key,
  });

  // Multi-org: aggregated billing and merged projects
  const multiBilling = useMultiOrgBillingOverview(isMultiOrg ? queriedOrganizations : []);
  // All-org view needs project counts with visibility; projects search has it, billing NCLOC often does not
  const orgsForProjectList = isMultiOrg ? queriedOrganizations : (viewMode === 'all' ? enterpriseOrgs : []);
  const mergedProjectsResult = useProjectsForOrganizations(orgsForProjectList);

  // All-org summary: per-org billing data when view is "All organizations"
  const isAllOrgsView = viewMode === 'all';
  // Enterprise-level consumption: single call covers all orgs including non-member ones
  const { data: enterpriseConsumption } = useEnterpriseConsumptionSummaries(
    isAllOrgsView ? enterpriseData?.enterpriseId : undefined
  );
  const allOrgsBilling = useMultiOrgBillingOverview(
    isAllOrgsView ? enterpriseOrgs : [],
    enterpriseConsumption?.byOrgUuid
  );

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

  const { data: costCenters = EMPTY_ARRAY } = useCostCenters();
  const { data: allAssignments = EMPTY_ARRAY } = useCostCenterAssignments();
  const { data: billingConfig } = useBillingConfig();

  // ── Sonar cache: auto-save + refetch ────────────────────────────────────────
  // Only auto-save in single-org mode (multi-org refetch covers all orgs explicitly)
  const { data: nclocDataForCache, isFetching: isFetchingNcloc } =
    useBillingNCLOCDistribution({ organization: viewMode === 'single' ? selectedOrganization?.key : undefined });
  useAutoSaveBillingNCLOC(
    viewMode === 'single' ? selectedOrganization?.key : undefined,
    nclocDataForCache,
    isFetchingNcloc,
  );

  const { data: sonarCacheData } = useSonarCacheRead(
    viewMode === 'single' ? selectedOrganization?.key : undefined,
  );

  const activeOrgKeys = useMemo(
    () =>
      viewMode === 'single'
        ? (selectedOrganization ? [selectedOrganization.key] : [])
        : viewMode === 'multi'
        ? queriedOrganizations.map((o) => o.key)
        : enterpriseOrgs.map((o) => o.key),
    [viewMode, selectedOrganization, queriedOrganizations, enterpriseOrgs],
  );

  const { refetchAll, isRefetching } = useRefetchAndCache(activeOrgKeys);
  // ────────────────────────────────────────────────────────────────────────────

  // Auto-check onboarding steps based on data
  useEffect(() => {
    if (!showOnboarding) return;
    const newSteps = { ...onboardingSteps };
    let changed = false;

    if (costCenters.length > 0 && !newSteps.createdCostCenter) {
      newSteps.createdCostCenter = true;
      changed = true;
    }
    if (allAssignments.length >= 5 && !newSteps.assignedProjects) {
      newSteps.assignedProjects = true;
      changed = true;
    }
    if (billingConfig?.contractValue && !newSteps.setContractValue) {
      newSteps.setContractValue = true;
      changed = true;
    }

    if (changed) {
      setOnboardingSteps(newSteps);
      saveSetting('onboardingSteps', newSteps).catch(() => {});
    }
  }, [costCenters.length, allAssignments.length, billingConfig?.contractValue, showOnboarding, onboardingSteps]);

  // Check for celebration milestones
  useEffect(() => {
    const checkMilestones = async () => {
      const newMilestones = { ...celebrationMilestones };
      let changed = false;

      // First cost center created
      if (costCenters.length === 1 && !celebrationMilestones.firstCostCenter) {
        newMilestones.firstCostCenter = true;
        changed = true;
        setToastMessage('🎉 You created your first cost center! Now assign some projects to see the magic happen.');
      }

      if (changed) {
        setCelebrationMilestones(newMilestones);
        await saveSetting('celebrationMilestones', newMilestones);
      }
    };
    checkMilestones().catch(() => {});
  }, [costCenters.length, celebrationMilestones]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: '1',
      ctrlOrCmd: true,
      action: () => applyViewMode('single'),
      description: 'Switch to Single Org view',
    },
    {
      key: '2',
      ctrlOrCmd: true,
      action: () => applyViewMode('multi'),
      description: 'Switch to Multi-Org view',
    },
    {
      key: '3',
      ctrlOrCmd: true,
      action: () => applyViewMode('all'),
      description: 'Switch to All Orgs view',
    },
  ]);

  const allPrivateProjectKeys = useMemo(
    () =>
      viewMode === 'multi' || isMultiOrg
        ? mergedProjectsResult.projects.filter((p) => p.visibility === 'private').map((p) => p.key)
        : (allProjects?.components?.filter((p) => p.visibility === 'private').map((p) => p.key) ?? []),
    [viewMode, isMultiOrg, mergedProjectsResult.projects, allProjects]
  );

  // Only treat assignments as "in scope" when their project is in the currently selected org(s)
  const assignmentsInScope = useMemo(
    () => filterAssignmentsInScope(allAssignments, allPrivateProjectKeys),
    [allAssignments, allPrivateProjectKeys]
  );

  const projectKeysFromAssignments = useMemo(
    () => [...new Set(assignmentsInScope.filter((a) => a.projectKey).map((a) => a.projectKey!))],
    [assignmentsInScope]
  );

  // Only fetch real project data for assigned projects — not all private projects.
  // Fetching all private project NCLOC would fire N×2 API calls per org change (one
  // getComponentMeasures + one getComponentDetails per project), flooding the proxy and
  // causing hundreds of rapid re-renders as each resolves. Unassigned LOC is computed
  // from the billing API total (consumed) instead to avoid this overhead.
  const projectKeysForData = useMemo(
    () => projectKeysFromAssignments.length > 0
      ? projectKeysFromAssignments
      : selectedProjects,
    [projectKeysFromAssignments, selectedProjects]
  );

  // Fetch real data for all private projects (or selected + assigned when org list not yet loaded)
  const {
    projects: projectsData,
    monthlyTrendByProject,
    isLoading: isLoadingProjectData,
  } = useProjectsRealData(projectKeysForData);

  const projectNclocMap = useMemo(
    () => Object.fromEntries(projectsData.map((p) => [p.key, p.ncloc])),
    [projectsData]
  );

  // LOC trend by cost center: use monthly carry-forward project LOC, then allocate by CC per month
  // Use a reserved key for aggregate total so a cost center named "Total" doesn't overwrite it
  const AGGREGATE_TOTAL_KEY = '__total__';
  const { realTrendData, trendTeamNames, trendSeriesLabels } = useMemo(() => {
    const projectOnly = assignmentsInScope.filter((a) => (a.type === 'project' || a.projectKey) && a.projectKey && a.costCenterId);
    const ccDisplayNames = costCenters.map((cc) => (cc.code ? `${cc.name} (${cc.code})` : cc.name));
    const data: { date: string; [key: string]: string | number }[] = [];

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
  }, [monthlyTrendByProject, costCenters, assignmentsInScope]);

  const costCenterDistribution = useMemo(() => {
    const projectOnly = assignmentsInScope.filter((a) => (a.type === 'project' || a.projectKey) && a.projectKey && a.costCenterId);
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
    // Use billing API total when available (avoids needing NCLOC for all private projects)
    const totalInScope = consumed ?? projectsData.reduce((s, p) => s + p.ncloc, 0);
    const allocatedTotal = Array.from(byCostCenter.values()).reduce((s, v) => s + v, 0);
    // Cap at totalInScope so unassigned is never negative (e.g. when allocations sum to >100% per project)
    const unallocatedLoc = Math.max(0, Math.round(totalInScope - allocatedTotal));
    const segments = costCenters.map((cc) => ({
      name: cc.code ? `${cc.name} (${cc.code})` : cc.name,
      value: Math.round(byCostCenter.get(cc.id) ?? 0),
    }));
    return {
      costCenterSegments: segments,
      unallocatedLoc: Math.round(unallocatedLoc),
      totalInScope,
    };
  }, [costCenters, assignmentsInScope, projectsData, consumed]);

  const unusedLoc = limit != null && consumed != null ? Math.max(0, limit - (consumed || 0)) : undefined;

  const billingDetailsData = useMemo(() => {
    const projectOnly = assignmentsInScope.filter((a) => (a.type === 'project' || a.projectKey) && a.projectKey && a.costCenterId);
    const nclocByKey = new Map(projectsData.map((p) => [p.key, p.ncloc]));
    const projectNameByKey = new Map(projectsData.map((p) => [p.key, p.name]));
    const config = billingConfig ?? { defaultRate: 10, currency: 'USD' };
    interface Row {
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
    }
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

    // Single "Unassigned" row: LOC not assigned to any cost center.
    // Use billing API total (consumed) when available — avoids needing NCLOC for all
    // private projects. Fall back to summing fetched project data when consumed is zero.
    const totalAllocated = Array.from(allocatedByProject.values()).reduce((s, v) => s + v, 0);
    let totalUnassignedLoc: number;
    if (consumed != null && consumed > 0) {
      totalUnassignedLoc = Math.max(0, Math.round(consumed - totalAllocated));
    } else {
      let sum = 0;
      for (const p of projectsData) {
        const allocatedRaw = allocatedByProject.get(p.key) ?? 0;
        const allocatedForProject = Math.min(allocatedRaw, p.ncloc);
        sum += Math.round(Math.max(0, p.ncloc - allocatedForProject));
      }
      totalUnassignedLoc = sum;
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
  }, [costCenters, assignmentsInScope, projectsData, billingConfig, limit, consumed, isMultiOrg, projectKeyToOrgName]);

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

  /** Projects that are assigned and in selected org(s) — used for metrics and "total LOC in scope" to match the billing table. */
  const projectsInScope = useMemo(() => {
    const inScopeKeys = new Set(projectKeysFromAssignments);
    return projectsData.filter((p) => inScopeKeys.has(p.key));
  }, [projectsData, projectKeysFromAssignments]);

  // Total LOC for in-scope (assigned) projects only — matches billing table and export totals
  const selectedLOC = useMemo(
    () => projectsInScope.reduce((sum, p) => sum + p.ncloc, 0),
    [projectsInScope]
  );

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

  const trackExport = async () => {
    const newMilestones = { ...celebrationMilestones };
    newMilestones.exportCount += 1;

    if (newMilestones.exportCount === 10 && !newMilestones.tenthExport) {
      newMilestones.tenthExport = true;
      setToastMessage('🏆 That\'s your 10th export! You\'re a billing pro.');
    }

    setCelebrationMilestones(newMilestones);
    await saveSetting('celebrationMilestones', newMilestones);
  };

  const handleExportCSV = () => {
    if (!billingRows || billingRows.length === 0) return;
    exportToCSV(buildExportRows(billingRows, selectedLOC, billingTotals), `billing-details-${new Date().toISOString().split('T')[0]}.csv`);
    trackExport().catch(() => {});
  };

  const handleExportExcel = async () => {
    if (!billingRows || billingRows.length === 0) return;
    await exportToExcel(buildExportRows(billingRows, selectedLOC, billingTotals), `billing-details-${new Date().toISOString().split('T')[0]}.xlsx`, 'Billing Details');
    await trackExport();
  };

  const handleExportPDF = async () => {
    if (!billingRows || billingRows.length === 0) return;
    await exportToPDF(buildExportRows(billingRows, selectedLOC, billingTotals), `billing-report-${new Date().toISOString().split('T')[0]}.pdf`);
    await trackExport();
  };
  const selectedCount = selectedProjects.length;
  /** Number of projects assigned (to cost centers) that are in the currently selected org(s). Used for Projects Assigned card. */
  const assignedInScopeCount = projectKeysFromAssignments.length;
  /** In-scope assigned projects with LOC > 0 — for Median/Min/Max LOC cards so metrics match the billing view. */
  const projectsWithLocInScope = useMemo(
    () => projectsInScope.filter((p) => p.ncloc > 0),
    [projectsInScope]
  );
  const { medianLOCPerProject, minLoc, maxLoc } = useMemo(() => {
    if (projectsWithLocInScope.length === 0) return { medianLOCPerProject: null, minLoc: null, maxLoc: null };
    const sorted = [...projectsWithLocInScope].map((p) => p.ncloc).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    return {
      medianLOCPerProject: median,
      minLoc: sorted[0],
      maxLoc: sorted.at(-1) ?? null,
    };
  }, [projectsWithLocInScope]);

  // ONLY use data from billing API - no fallbacks to configured limits
  // consumed = total LOC used across all private projects in the organization
  // limit = total LOC available in the organization's plan (from consumption API)
  const actualConsumed = consumed ?? 0;
  const actualLimit = limit ?? 0;
  const actualUsagePercent = actualLimit > 0 ? (actualConsumed / actualLimit) * 100 : 0;

  return (
    <div className="min-h-screen bg-sonar-background">
      <header className="bg-white dark:bg-slate-800 shadow-md border-b-2 border-sonar-blue/10 dark:border-slate-700">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <img
                src="/sonarqube-cloud-mark.svg"
                alt="SonarQube Cloud"
                className="h-10 w-10"
              />
              <div>
                <h1 className="text-3xl font-bold text-sonar-purple dark:text-white flex flex-wrap items-center gap-2">
                  <span>SonarQube Cloud Billing Dashboard</span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-body uppercase tracking-wide bg-sonar-teal/15 text-sonar-teal border border-sonar-teal/30 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-600/40"
                    title="This dashboard is in beta; behaviour and layout may change."
                  >
                    Beta
                  </span>
                </h1>
                <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">
                  Allocate code ownership and calculate costs across teams
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeSelector />
              <button
                onClick={() => { handleLogout(); }}
                className="btn-sonar-danger px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-body"
              >
                Logout
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-sonar-purple dark:text-white uppercase tracking-wide">Perspective</span>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                {(['single', 'multi', 'all'] as const).map((mode) => {
                  const labels = {
                    single: 'Single Organisation',
                    multi: 'Multiple organisation',
                    all: 'Enterprise Overview'
                  };
                  const tooltips = {
                    single: 'View one organisation with full cost allocation details',
                    multi: 'Compare metrics across multiple organisations',
                    all: 'Enterprise-wide overview of all organisations'
                  };
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => applyViewMode(mode)}
                      title={tooltips[mode]}
                      className={`px-4 py-2 text-sm font-medium font-body transition-colors ${
                        viewMode === mode
                          ? 'bg-sonar-blue text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
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
                <span className="text-sm font-medium text-gray-600 dark:text-slate-300">
                  Showing all organisations in {enterpriseName ? <strong className="text-sonar-purple dark:text-white">{enterpriseName}</strong> : 'enterprise'}
                </span>
              </div>
            )}
            {activeOrgKeys.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm">
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  Last fetched: {formatFetchedAt(sonarCacheData?.fetchedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => refetchAll()}
                  disabled={isRefetching}
                  className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg border-2 border-sonar-blue text-sonar-blue hover:bg-sonar-blue/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isRefetching && (
                    <span className="inline-block w-3 h-3 border border-sonar-blue border-t-transparent rounded-full animate-spin" />
                  )}
                  {isRefetching ? 'Fetching…' : 'Refetch from Sonar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <LoadProgressBar />
      <CacheIndicator />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {viewMode === 'all' ? (
            /* All organizations summary view – table for easy comparison */
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-sonar-purple dark:text-white">Enterprise Overview</h2>
                <p className="mt-1 text-gray-600 dark:text-slate-300 font-body">
                  Summary of billing and usage per organisation. Open one to view its dashboard or add several to compare.
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400 font-body">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 font-medium mr-1">Reserved</span> = per-org;{' '}
                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 font-medium ml-1 mr-1">Pooled</span> = shared (counted once in enterprise total).
                </p>
              </div>

              {(() => {
                const enterpriseLoaded = !isLoadingEnterprise && enterpriseData !== undefined;
                const showEmptyMessage = enterpriseLoaded && enterpriseOrgs.length === 0;
                const showBillingLoading = enterpriseOrgs.length > 0 && allOrgsBilling.isLoading;
                const hasRows = allOrgsBilling.byOrg.length > 0;

                if (!enterpriseLoaded || showBillingLoading) {
                  return (
                    <div className="flex items-center justify-center gap-3 py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 shadow-sm">
                      <div className="animate-spin rounded-full h-10 w-10 border-2 border-sonar-blue border-t-transparent" />
                      <span className="text-gray-600 dark:text-slate-300 font-body">Loading organisation data…</span>
                    </div>
                  );
                }
                if (showEmptyMessage) {
                  return (
                    <div className="py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 text-center shadow-sm">
                      <p className="text-gray-600 dark:text-slate-300 font-body">No organisations found in enterprise.</p>
                    </div>
                  );
                }
                if (!hasRows) {
                  return (
                    <div className="py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 text-center shadow-sm">
                      <p className="text-gray-600 dark:text-slate-300 font-body">Unable to load billing data for organisations. Try refreshing.</p>
                    </div>
                  );
                }
                return (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/80">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wider">Organisation</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wider">Billing</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wider">Consumed (LOC)</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wider">Limit (LOC)</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wider">Usage %</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wider">Private / Public</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                        {(allOrgsBilling.orgResults ?? allOrgsBilling.byOrg.map((o) => ({
                          org: { key: o.key, name: o.name, uuid: o.uuid },
                          data: o,
                          isPending: false,
                          error: null,
                        }))).map(({ org, data, isPending, error: rowError }) => {
                          const counts = perOrgProjectCounts.get(org.key);
                          const privateCount = counts?.private ?? data?.privateProjectCount ?? 0;
                          const publicCount = counts?.public ?? data?.publicProjectCount ?? 0;
                          return (
                            <tr key={org.key} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{org.name}</td>
                              <td className="px-4 py-3">{renderModeCell(rowError, isPending, data?.mode)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                {tableCellContent(rowError, isPending, () => (data?.consumed ?? 0))}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                {renderLimitCell(rowError, isPending, data)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                {renderUsagePercentCell(rowError, isPending, data)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-slate-400">
                                {tableCellContent(rowError, isPending, () => `${privateCount} / ${publicCount}`)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {(() => {
                                    const isSelected = selectedOrganizations.some((o) => o.key === org.key);
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = [...selectedOrganizations];
                                          if (isSelected) {
                                            // Remove from selection (consistent with checkbox behavior)
                                            const filtered = next.filter((o) => o.key !== org.key);
                                            setSelectedOrganizations(filtered);
                                            handleOrganizationsChange(filtered);
                                          } else {
                                            // Add to selection (consistent with checkbox behavior - no view switch)
                                            next.push({ key: org.key, name: org.name, uuid: org.uuid, isMember: org.isMember });
                                            setSelectedOrganizations(next);
                                            handleOrganizationsChange(next);
                                          }
                                        }}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-colors ${
                                          isSelected
                                            ? 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            : 'border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                                        }`}
                                        title={isSelected ? 'Remove from multiple organisation selection' : 'Add to multiple organisation selection'}
                                      >
                                        {isSelected ? '✓ Selected' : '+ Select'}
                                      </button>
                                    );
                                  })()}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      applyViewMode('single');
                                      setSelectedOrganization({ key: org.key, name: org.name, uuid: org.uuid, isMember: org.isMember });
                                      saveSetting('selectedOrganization', org.key).catch(() => {});
                                    }}
                                    className="btn-sonar-primary px-3 py-1.5 text-xs font-medium rounded-lg"
                                  >
                                    Open →
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                );
              })()}
            </div>
          ) : (
            <>
              {/* Onboarding Checklist */}
              {showOnboarding && (
                <div className="bg-gradient-to-r from-sonar-blue to-sonar-purple text-white rounded-xl p-6 mb-6 shadow-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold">Welcome! Let's get you set up 👋</h3>
                      <p className="text-sm opacity-90 mt-1">4 quick steps to your first billing report</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowOnboarding(false);
                        saveSetting('onboardingCompleted', true).catch(() => {});
                      }}
                      className="text-white/80 hover:text-white text-2xl leading-none"
                      aria-label="Close onboarding checklist"
                    >
                      ×
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onboardingSteps.createdCostCenter}
                        readOnly
                        className="w-5 h-5 rounded"
                      />
                      <span className={onboardingSteps.createdCostCenter ? 'line-through opacity-70' : ''}>
                        Create your first cost center
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onboardingSteps.assignedProjects}
                        readOnly
                        className="w-5 h-5 rounded"
                      />
                      <span className={onboardingSteps.assignedProjects ? 'line-through opacity-70' : ''}>
                        Assign 5+ projects
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onboardingSteps.setContractValue}
                        readOnly
                        className="w-5 h-5 rounded"
                      />
                      <span className={onboardingSteps.setContractValue ? 'line-through opacity-70' : ''}>
                        Set contract value
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onboardingSteps.viewedBreakdown}
                        onChange={(e) => {
                          const newSteps = { ...onboardingSteps, viewedBreakdown: e.target.checked };
                          setOnboardingSteps(newSteps);
                          saveSetting('onboardingSteps', newSteps).catch(() => {});
                        }}
                        className="w-5 h-5 rounded"
                      />
                      <span className={onboardingSteps.viewedBreakdown ? 'line-through opacity-70' : ''}>
                        View cost breakdown (scroll to Billing Details below)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* LOC Metrics Explainer Panel */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <button
                  onClick={() => setShowLOCExplainer(!showLOCExplainer)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-sonar-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Understanding your LOC metrics
                  </h4>
                  <svg className={`w-4 h-4 transition-transform ${showLOCExplainer ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showLOCExplainer && (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="border-l-2 border-sonar-blue pl-3">
                      <strong className="text-sonar-purple dark:text-white">Contracted LOC:</strong>
                      <p className="text-gray-600 dark:text-slate-300 mt-1">
                        The total capacity in your SonarQube Cloud license (e.g., 5 million lines). This is what you're paying for.
                      </p>
                    </div>
                    <div className="border-l-2 border-amber-500 pl-3">
                      <strong className="text-sonar-purple dark:text-white">Consumed LOC:</strong>
                      <p className="text-gray-600 dark:text-slate-300 mt-1">
                        Actual code in your private projects (what you're actively using from your license).
                      </p>
                    </div>
                    <div className="border-l-2 border-teal-500 pl-3">
                      <strong className="text-sonar-purple dark:text-white">Allocated LOC:</strong>
                      <p className="text-gray-600 dark:text-slate-300 mt-1">
                        Code assigned to specific cost centers in this tool (for internal chargeback and tracking).
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Always-Visible Billing Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Projects Assigned - donut with count in center (only projects in selected org(s)) */}
                    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl border-2 border-gray-100 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-3 min-h-[2.75rem]">
                        <div>
                          <h3 className="text-xs font-bold text-sonar-purple dark:text-white font-body uppercase tracking-wider">
                            Projects in Scope
                          </h3>
                          <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                            Assigned to cost centers
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 min-h-[5rem]">
                        {actualPrivateProjectCount > 0 ? (() => {
                          const assignedPct = assignedInScopeCount / actualPrivateProjectCount;
                          const deg = Math.min(1, assignedPct) * 360;
                          return (
                            <div
                              className="relative flex-shrink-0 w-20 h-20 rounded-full"
                              title={`${assignedInScopeCount} of ${actualPrivateProjectCount} private projects assigned (in selected orgs)`}
                              style={{
                                background: `conic-gradient(#4f46e5 0deg ${deg}deg, #94a3b8 ${deg}deg 360deg)`,
                              }}
                            >
                              <div className="absolute inset-[10px] rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                                <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{assignedInScopeCount}</span>
                              </div>
                            </div>
                          );
                        })() : (
                        <div className="relative flex-shrink-0 w-20 h-20 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                            <span className="text-2xl font-black text-gray-500 dark:text-slate-200 tabular-nums">—</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <p className="text-xl font-bold text-gray-900 dark:text-slate-100 tabular-nums">
                            {assignedInScopeCount}<span className="text-lg text-gray-600 dark:text-slate-300 font-semibold">/{actualPrivateProjectCount}</span>
                          </p>
                          <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                            {actualPrivateProjectCount > 0 ? ((assignedInScopeCount / actualPrivateProjectCount) * 100).toFixed(0) : 0}% of private projects
                          </p>
                          <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                            {totalProjectCount} total ({actualPublicProjectCount} public)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* LOC attributed to cost centers - donut with value in center */}
                    <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-950 rounded-2xl shadow-xl border-2 border-blue-100 dark:border-blue-900 p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-3 min-h-[2.75rem]">
                        <div>
                          <h3 className="text-xs font-bold text-sonar-purple dark:text-white font-body uppercase tracking-wider">
                            Code Allocated
                          </h3>
                          <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                            Lines distributed to teams
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sonar-blue to-sonar-blue-secondary flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 min-h-[5rem]">
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
                                <span className="text-sm font-black text-sonar-blue dark:text-sky-300 tabular-nums leading-tight text-center" title={billingTotals.allocatedLoc.toLocaleString()}>
                                  {formatCompactLoc(billingTotals.allocatedLoc)}
                                </span>
                              </div>
                            </div>
                          );
                        })() : (
                          <div className="relative flex-shrink-0 w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-lg font-black text-gray-500 dark:text-slate-300 tabular-nums">—</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          {(selectedCount > 0 || projectKeysFromAssignments.length > 0) && (() => {
                            const totalLocInScope = billingTotals.allocatedLoc + costCenterDistribution.unallocatedLoc;
                            const allocatedPct = totalLocInScope > 0 ? (billingTotals.allocatedLoc / totalLocInScope) * 100 : 0;
                            return totalLocInScope > 0 ? (
                              <>
                                <p className="text-xl font-bold text-sonar-blue dark:text-sky-300 tabular-nums">
                                  {formatCompactLoc(billingTotals.allocatedLoc)}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                                  {allocatedPct.toFixed(0)}% of total in scope
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                  {totalLocInScope.toLocaleString()} total LOC in scope
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                                LOC to cost centers
                              </p>
                            );
                          })()}
                          {!(selectedCount > 0 || projectKeysFromAssignments.length > 0) && (
                            <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                              LOC to cost centers
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Plan Usage - headroom = allowance − consumed */}
                    <div className="bg-gradient-to-br from-white to-emerald-50 dark:from-gray-800 dark:to-emerald-950 rounded-2xl shadow-xl border-2 border-emerald-100 dark:border-emerald-900 p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-3 min-h-[2.75rem]">
                          <div>
                            <h3 className="text-xs font-bold text-sonar-purple dark:text-white font-body uppercase tracking-wider">
                              License Consumption {limit && limit > 0 && <span className="text-green-600">●</span>}
                            </h3>
                            <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                              % of contracted capacity
                            </p>
                          </div>
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
                      <div className="flex items-center justify-between mb-3 min-h-[2.75rem]">
                        <div>
                          <h3 className="text-xs font-bold text-sonar-purple dark:text-white font-body uppercase tracking-wider">
                            Typical Project Size
                          </h3>
                          <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                            Median lines of code
                          </p>
                        </div>
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
                        Typical codebase size (assigned projects in scope)
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
                          Per-organisation breakdown
                        </h3>
                        <div className="flex items-start gap-2 mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <svg className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center">
                              <span className="inline-block px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 font-medium">
                                Reserved
                              </span>
                              <span className="text-gray-600 dark:text-slate-300 ml-2">
                                = Dedicated capacity per organisation (LOC counted separately for each org)
                              </span>
                              <HelpIcon content="In reserved mode, each organisation has its own separate LOC limit. The same code in different organisations counts multiple times toward your total. Better for isolated teams." />
                            </div>
                            <div className="flex items-center">
                              <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 font-medium">
                                Pooled
                              </span>
                              <span className="text-gray-600 dark:text-slate-300 ml-2">
                                = Shared capacity across enterprise (LOC counted once in enterprise total)
                              </span>
                              <HelpIcon content="In pooled mode, each line of code is counted only once toward your total enterprise license, regardless of how many organisations use it. More cost-effective for shared codebases." />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-4 py-2 text-left text-gray-700 dark:text-slate-200 font-medium">Organisation</th>
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
                                    {renderModeCell(rowError, isPending, data?.mode)}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                    {tableCellContent(rowError, isPending, () => (data?.consumed ?? 0))}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                    {renderLimitCell(rowError, isPending, data)}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                    {renderUsagePercentCell(rowError, isPending, data)}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-slate-400">
                                    {tableCellContent(rowError, isPending, () => `${privateCount} / ${publicCount}`)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ); })()}

                  {/* Cost configuration — after per-org breakdown when shown; always above Cost Centers */}
                  <div className="space-y-4">
                    {isMultiOrg && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-sonar-blue rounded flex items-start gap-2">
                        <svg className="w-5 h-5 text-sonar-blue shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-gray-700 dark:text-gray-200 font-body">
                          <span className="font-semibold">Multiple organisation view:</span> The plan allowance shown below is the combined total across {selectedOrganizations.length} organisation{selectedOrganizations.length === 1 ? '' : 's'}.
                        </p>
                      </div>
                    )}
                    <CostCalculator planAllowanceLOC={limit} />
                  </div>

                  <CostCenters
                    key={viewMode === 'multi' ? `multi-${selectedOrganizations.map((o) => o.key).join(',')}` : (selectedOrganization?.key ?? 'no-org')}
                    organization={viewMode === 'single' ? selectedOrganization?.key : undefined}
                    projectsWithOrg={viewMode === 'multi' || isMultiOrg ? mergedProjectsResult.projects : undefined}
                    preferredNclocMap={projectNclocMap}
                    onProjectsSelected={setSelectedProjects}
                    projectKeysInSelectedOrgs={viewMode === 'multi' || isMultiOrg ? allPrivateProjectKeys : undefined}
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
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sonar-blue/10 mb-4">
                    <svg className="w-8 h-8 text-sonar-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Ready to allocate costs?
                  </h3>
                  <p className="text-gray-600 dark:text-slate-300 mb-4 max-w-md mx-auto">
                    Start by creating cost centers for your teams, then assign projects to see how code ownership breaks down.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Scroll down to the "Team Summary" section to get started
                  </p>
                </div>
              )}

          {viewMode === 'multi' && selectedOrganizations.length < 2 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <p className="text-amber-800 dark:text-amber-200 font-body">
                Select at least 2 organisations above to see the aggregate view and assign projects across them.
              </p>
            </div>
          )}

          {/* Reports: export actions */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border-t-4 border-sonar-blue">
            <h2 className="text-2xl font-bold mb-4 text-sonar-purple dark:text-white">Billing Reports</h2>
            <p className="text-gray-600 dark:text-slate-300 font-body">
              Export and download billing reports for selected period and teams.
            </p>
            <div className="mt-6 flex gap-4 flex-wrap">
              <button
                onClick={() => { handleExportExcel(); }}
                className="btn-sonar-primary px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-body"
              >
                Export to Excel
              </button>
              <button
                onClick={() => { handleExportCSV(); }}
                className="btn-sonar-primary px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-body"
              >
                Export to CSV
              </button>
              <button
                onClick={() => { handleExportPDF(); }}
                className="btn-sonar-primary px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-body"
              >
                Generate PDF Report
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      </main>

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-500 dark:text-slate-400 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
        Press{' '}
        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono border border-gray-300 dark:border-gray-600">
          ⌘/Ctrl+1/2/3
        </kbd>{' '}
        to switch views
      </div>

      {/* Toast Notifications */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          variant="success"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
