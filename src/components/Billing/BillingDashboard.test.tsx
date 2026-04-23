/**
 * Unit tests for BillingDashboard.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
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

vi.mock('./CostCenters', () => ({ default: () => <div data-testid="cost-centers">CostCenters</div> }));
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
const useEnterpriseOrganizations = vi.fn(() => ({ data: { organizations: [orgs[0]], enterpriseName: 'Test Enterprise' }, isLoading: false }));
const useProjectsForOrganizations = vi.fn(() => ({ projects: [], totalCount: 0, isLoading: false, error: null }));
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
}));

vi.mock('../../hooks/useSonarCloudData', () => ({
  useProjects: () => ({ data: { components: [] }, isLoading: false }),
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
    getSetting.mockResolvedValue(undefined);
    useEnterpriseOrganizations.mockReturnValue({ data: { organizations: [orgs[0]], enterpriseName: 'Test Enterprise' }, isLoading: false });
    useProjectsForOrganizations.mockReturnValue({ projects: [], totalCount: 0, isLoading: false, error: null });
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
});
