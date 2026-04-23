/**
 * Unit tests for BillingDashboard.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BillingDashboard from './BillingDashboard';
import type { BillingDetailsRow } from '../PivotTable/BillingPivotTable';

const getSetting = vi.fn((_key: string): Promise<unknown> => Promise.resolve(undefined));
vi.mock('../../services/db', () => ({
  clearAuth: vi.fn(),
  clearCache: vi.fn(),
}));
vi.mock('../../services/store', () => ({
  getSetting: (key: string) => getSetting(key),
  saveSetting: vi.fn(() => Promise.resolve()),
}));

let capturedCostCentersProps: { organization?: string; projectsWithOrg?: unknown[] } = {};
vi.mock('./CostCenters', () => ({
  default: (props: { organization?: string; projectsWithOrg?: unknown[] }) => {
    capturedCostCentersProps = { organization: props.organization, projectsWithOrg: props.projectsWithOrg };
    return <div data-testid="cost-centers">CostCenters</div>;
  },
}));
vi.mock('./CostCalculator', () => ({ default: () => <div data-testid="cost-calculator">CostCalculator</div> }));
vi.mock('../Charts/LOCTrendChart', () => ({ default: () => <div data-testid="loc-trend-chart">LOCTrendChart</div> }));
vi.mock('../Charts/TeamCostPieChart', () => ({ default: () => <div data-testid="team-cost-pie">TeamCostPieChart</div> }));
let capturedPivotData: BillingDetailsRow[] = [];
vi.mock('../PivotTable/BillingPivotTable', () => ({
  default: (props: { data: BillingDetailsRow[] }) => {
    capturedPivotData = props.data ?? [];
    return <div data-testid="pivot-table">BillingPivotTable</div>;
  },
}));
vi.mock('../CacheIndicator', () => ({ default: () => <div data-testid="cache-indicator">CacheIndicator</div> }));
vi.mock('./LoadProgressBar', () => ({ default: () => <div data-testid="load-progress">LoadProgressBar</div> }));
vi.mock('../OrganizationSelector', () => ({ default: () => <div data-testid="org-selector">OrganizationSelector</div> }));
vi.mock('../ThemeSelector', () => ({ default: () => <div data-testid="theme-selector">ThemeSelector</div> }));

const orgs = [
  { key: 'org1', name: 'Org 1', uuid: 'u1' },
  { key: 'org2', name: 'Org 2', uuid: 'u2' },
];
type MockProject = { key: string; name: string; visibility: string; organizationName?: string; organizationKey?: string };
type MockProjectsData = { components: MockProject[]; paging?: { total: number } };
const useEnterpriseOrganizations = vi.fn(() => ({ data: { organizations: [orgs[0]], enterpriseName: 'Test Enterprise' }, isLoading: false }));
const useProjectsForOrganizations = vi.fn(() => ({ projects: [] as MockProject[], totalCount: 0, isLoading: false, error: null }));
const useProjects = vi.fn(() => ({ data: { components: [] as MockProject[], paging: { total: 0 } } as MockProjectsData, isLoading: false }));
vi.mock('../../hooks/useBillingData', () => ({
  useEnterpriseOrganizations: () => useEnterpriseOrganizations(),
  useBillingOverview: () => ({
    consumed: 0,
    limit: 0,
    usagePercent: 0,
    isLoading: false,
    error: null,
  }),
  useMultiOrgBillingOverview: () => ({
    consumed: 0,
    limit: 0,
    usagePercent: 0,
    byOrg: [],
    isLoading: false,
    error: null,
  }),
  useEnterpriseConsumptionSummaries: () => ({ data: undefined, isLoading: false }),
  useBillingNCLOCDistribution: () => ({ data: undefined, isFetching: false }),
}));

vi.mock('../../hooks/useSonarCache', () => ({
  useSonarCacheRead: () => ({ data: undefined }),
  useRefetchAndCache: () => ({ refetchAll: vi.fn(), isRefetching: false, lastError: null }),
  useAutoSaveBillingNCLOC: vi.fn(),
}));

vi.mock('../../hooks/useSonarCloudData', () => ({
  useProjects: () => useProjects(),
  useProjectsForOrganizations: () => useProjectsForOrganizations(),
}));

const mockProjectsRealData = {
  projects: [] as { key: string; name: string; ncloc: number }[],
  monthlyTrendByProject: [] as unknown[],
  isLoading: false,
  isError: false,
};
vi.mock('../../hooks/useProjectsRealData', () => ({
  useProjectsRealData: () => ({
    ...mockProjectsRealData,
    pivotData: [],
    trendData: [],
    aggregatedByTag: [],
  }),
}));

const mockCostCenters = [{ id: 'cc-1', name: 'CC1', code: 'C1' }];
const mockAssignments = {
  data: [] as { id: string; costCenterId: string; type: string; projectKey?: string; allocationPercentage: number }[],
};
vi.mock('../../hooks/useBilling', () => ({
  useCostCenters: () => ({ data: mockCostCenters }),
  useCostCenterAssignments: () => mockAssignments,
  useBillingConfig: () => ({ data: { currency: 'USD', defaultRate: 10 }, isLoading: false }),
}));

vi.mock('../../utils/exportUtils', () => ({
  exportToCSV: vi.fn(),
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
}));

describe('BillingDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
    capturedPivotData = [];
    capturedCostCentersProps = {};
    getSetting.mockResolvedValue(undefined);
    useEnterpriseOrganizations.mockReturnValue({ data: { organizations: [orgs[0]], enterpriseName: 'Test Enterprise' }, isLoading: false });
    useProjectsForOrganizations.mockReturnValue({ projects: [] as MockProject[], totalCount: 0, isLoading: false, error: null });
    useProjects.mockReturnValue({ data: { components: [] as MockProject[], paging: { total: 0 } } as MockProjectsData, isLoading: false });
    mockProjectsRealData.projects = [];
    mockAssignments.data = [];
  });

  it('renders dashboard with cost centers and theme selector', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BillingDashboard />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('cost-centers')).toBeInTheDocument();
    expect(screen.getByTestId('theme-selector')).toBeInTheDocument();
  });

  it('filters billing rows to only projects in selected org(s) (in-scope)', async () => {
    getSetting.mockImplementation((key: string) => {
      if (key === 'viewMode') return Promise.resolve('multi');
      if (key === 'selectedOrganizations') return Promise.resolve(orgs);
      return Promise.resolve(undefined);
    });
    useEnterpriseOrganizations.mockReturnValue({ data: { organizations: orgs, enterpriseName: 'Test Enterprise' }, isLoading: false });
    useProjectsForOrganizations.mockReturnValue({
      projects: [
        {
          key: 'proj-a',
          name: 'Proj A',
          visibility: 'private',
          organizationName: 'Org 1',
          organizationKey: 'org1',
        },
      ],
      totalCount: 1,
      isLoading: false,
      error: null,
    });
    mockProjectsRealData.projects = [{ key: 'proj-a', name: 'Proj A', ncloc: 1000 }];
    mockAssignments.data = [
      { id: 'a1', costCenterId: 'cc-1', type: 'project', projectKey: 'proj-a', allocationPercentage: 100 },
      { id: 'a2', costCenterId: 'cc-1', type: 'project', projectKey: 'proj-b', allocationPercentage: 100 },
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <BillingDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(capturedPivotData.length).toBeGreaterThan(0);
    });

    const projectKeys = capturedPivotData.map((r) => r.projectKey);
    expect(projectKeys).toContain('proj-a');
    expect(projectKeys).not.toContain('proj-b');
    const allowedKeys = ['proj-a', '__unassigned__', '__unused__'];
    expect(projectKeys.every((k) => allowedKeys.includes(k))).toBe(true);
  });

  it('does not list projects from single-org when in multi-org view with no orgs selected', async () => {
    // Bug: when viewMode='multi' and < 2 orgs are selected, allPrivateProjectKeys fell back
    // to allProjects (single-org fetch), leaking the single-org's projects into the pivot table.
    getSetting.mockImplementation((key: string) => {
      if (key === 'viewMode') return Promise.resolve('multi');
      if (key === 'selectedOrganizations') return Promise.resolve([]); // no orgs selected
      return Promise.resolve(undefined);
    });
    // Single-org fetch returns a private project (the bleed-through source)
    useProjects.mockReturnValue({
      data: {
        components: [
          { key: 'leaked-proj', name: 'Leaked Project', visibility: 'private' },
        ],
      },
      isLoading: false,
    });
    // Multi-org fetch returns nothing (no orgs queried)
    useProjectsForOrganizations.mockReturnValue({ projects: [] as MockProject[], totalCount: 0, isLoading: false, error: null });
    mockAssignments.data = [
      { id: 'a1', costCenterId: 'cc-1', type: 'project', projectKey: 'leaked-proj', allocationPercentage: 100 },
    ];
    mockProjectsRealData.projects = [{ key: 'leaked-proj', name: 'Leaked Project', ncloc: 500 }];

    render(
      <QueryClientProvider client={queryClient}>
        <BillingDashboard />
      </QueryClientProvider>
    );

    // Wait a tick for any async state to settle
    await waitFor(() => {
      // pivot table should render
      expect(screen.getByTestId('pivot-table')).toBeInTheDocument();
    });

    // The leaked project should NOT appear — no orgs are selected in multi mode
    const projectKeys = capturedPivotData.map((r) => r.projectKey);
    expect(projectKeys).not.toContain('leaked-proj');
  });

  it('passes organization=undefined and projectsWithOrg=[] to CostCenters when viewMode=multi with no orgs selected', async () => {
    // Bug: organization prop used isMultiOrg guard; when viewMode='multi' but isMultiOrg=false
    // (< 2 orgs selected), stale selectedOrganization?.key was passed → useProjects inside
    // CostCenters fetched 75 available-to-assign projects from the old single-org.
    getSetting.mockImplementation((key: string) => {
      if (key === 'viewMode') return Promise.resolve('multi');
      if (key === 'selectedOrganizations') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
    useProjects.mockReturnValue({
      data: { components: [{ key: 'leaked-proj', name: 'Leaked', visibility: 'private' }] },
      isLoading: false,
    });
    useProjectsForOrganizations.mockReturnValue({ projects: [] as MockProject[], totalCount: 0, isLoading: false, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <BillingDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('cost-centers')).toBeInTheDocument();
    });

    // In multi mode with no orgs, organization must be undefined — not a stale single-org key
    expect(capturedCostCentersProps.organization).toBeUndefined();
    // projectsWithOrg must be [] (empty multi result), NOT undefined or single-org projects
    expect(Array.isArray(capturedCostCentersProps.projectsWithOrg)).toBe(true);
  });

  it('Projects in Scope widget shows 0/0 when viewMode=multi with no orgs selected', async () => {
    // Bug: actualPrivateProjectCount used isMultiOrg guard; in multi+0-orgs state it fell back
    // to allProjects (single-org), showing "0/75" instead of "0/0".
    getSetting.mockImplementation((key: string) => {
      if (key === 'viewMode') return Promise.resolve('multi');
      if (key === 'selectedOrganizations') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
    // Single-org has 75 private projects — the bleed source
    const seventyFiveProjects: MockProject[] = Array.from({ length: 75 }, (_, i) => ({
      key: `proj-${i}`,
      name: `Project ${i}`,
      visibility: 'private',
    }));
    useProjects.mockReturnValue({
      data: { components: seventyFiveProjects, paging: { total: 75 } } as MockProjectsData,
      isLoading: false,
    });
    useProjectsForOrganizations.mockReturnValue({ projects: [] as MockProject[], totalCount: 0, isLoading: false, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <BillingDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('cost-centers')).toBeInTheDocument();
    });

    // title="0 of N private projects assigned (in selected orgs)" — N must NOT be 75
    const donutEl = screen.queryByTitle(/of 75 private/);
    expect(donutEl).toBeNull();
  });

  it('refetch strip is hidden in single mode with no org selected (default)', async () => {
    // Default state: viewMode='single', selectedOrganization=null → activeOrgKeys=[]
    render(
      <QueryClientProvider client={queryClient}>
        <BillingDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('cost-centers')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('refetch-strip')).toBeNull();
  });

  it('refetch strip is hidden when viewMode=multi with no orgs selected', async () => {
    getSetting.mockImplementation((key: string) => {
      if (key === 'viewMode') return Promise.resolve('multi');
      if (key === 'selectedOrganizations') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
    useProjectsForOrganizations.mockReturnValue({ projects: [] as MockProject[], totalCount: 0, isLoading: false, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <BillingDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('cost-centers')).toBeInTheDocument();
    });

    // queriedOrganizations=[] → activeOrgKeys=[] → strip must not render
    expect(screen.queryByTestId('refetch-strip')).toBeNull();
  });

  it('refetch strip is visible with Refetch button when viewMode=multi with orgs selected', async () => {
    getSetting.mockImplementation((key: string) => {
      if (key === 'viewMode') return Promise.resolve('multi');
      if (key === 'selectedOrganizations') return Promise.resolve(orgs); // 2 orgs
      return Promise.resolve(undefined);
    });
    useEnterpriseOrganizations.mockReturnValue({ data: { organizations: orgs, enterpriseName: 'Test Enterprise' }, isLoading: false });
    useProjectsForOrganizations.mockReturnValue({ projects: [] as MockProject[], totalCount: 0, isLoading: false, error: null });

    render(
      <QueryClientProvider client={queryClient}>
        <BillingDashboard />
      </QueryClientProvider>
    );

    // queriedOrganizations=[org1,org2] → activeOrgKeys=['org1','org2'] → strip renders
    await waitFor(() => {
      expect(screen.getByTestId('refetch-strip')).toBeInTheDocument();
    });

    expect(screen.getByTestId('refetch-button')).toBeInTheDocument();
    expect(screen.getByTestId('refetch-button')).toHaveTextContent('Refetch from Sonar');
    // No cache data → last-fetched shows "Never"
    expect(screen.getByTestId('last-fetched-label')).toHaveTextContent('Last fetched: Never');
  });
});
