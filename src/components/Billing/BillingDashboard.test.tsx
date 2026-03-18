/**
 * Unit tests for BillingDashboard.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import BillingDashboard from './BillingDashboard';

vi.mock('../../services/db', () => ({
  clearAuth: vi.fn(),
  clearCache: vi.fn(),
  getSetting: vi.fn(() => Promise.resolve(undefined)),
  saveSetting: vi.fn(() => Promise.resolve()),
}));

vi.mock('./CostCenters', () => ({ default: () => <div data-testid="cost-centers">CostCenters</div> }));
vi.mock('./CostCalculator', () => ({ default: () => <div data-testid="cost-calculator">CostCalculator</div> }));
vi.mock('../Charts/LOCTrendChart', () => ({ default: () => <div data-testid="loc-trend-chart">LOCTrendChart</div> }));
vi.mock('../Charts/TeamCostPieChart', () => ({ default: () => <div data-testid="team-cost-pie">TeamCostPieChart</div> }));
vi.mock('../PivotTable/BillingPivotTable', () => ({ default: () => <div data-testid="pivot-table">BillingPivotTable</div> }));
vi.mock('../CacheIndicator', () => ({ default: () => <div data-testid="cache-indicator">CacheIndicator</div> }));
vi.mock('./LoadProgressBar', () => ({ default: () => <div data-testid="load-progress">LoadProgressBar</div> }));
vi.mock('../OrganizationSelector', () => ({ default: () => <div data-testid="org-selector">OrganizationSelector</div> }));
vi.mock('../ThemeSelector', () => ({ default: () => <div data-testid="theme-selector">ThemeSelector</div> }));

vi.mock('../../hooks/useBillingData', () => ({
  useEnterpriseOrganizations: () => ({ data: [{ key: 'org1', name: 'Org 1', uuid: 'u1' }], isLoading: false }),
  useBillingOverview: () => ({
    totalLOC: 0,
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
}));

vi.mock('../../hooks/useSonarCloudData', () => ({
  useProjects: () => ({ data: { components: [] }, isLoading: false }),
  useProjectsForOrganizations: () => ({ projects: [], totalCount: 0, isLoading: false, error: null }),
}));

vi.mock('../../hooks/useProjectsRealData', () => ({
  useProjectsRealData: () => ({
    projects: [],
    pivotData: [],
    trendData: [],
    monthlyTrendByProject: [],
    aggregatedByTag: [],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../hooks/useBilling', () => ({
  useCostCenters: () => ({ data: [] }),
  useCostCenterAssignments: () => ({ data: [] }),
  useBillingConfig: () => ({ data: { currency: 'USD', defaultRate: 10 }, isLoading: false }),
}));

vi.mock('../../utils/exportUtils', () => ({
  exportToCSV: vi.fn(),
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('BillingDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
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
});
