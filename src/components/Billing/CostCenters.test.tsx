/**
 * Unit tests for CostCenters.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import CostCenters from './CostCenters';

const mockAssignmentsData = {
  data: [] as { id: string; costCenterId: string; type: string; projectKey?: string; allocationPercentage: number }[],
};
vi.mock('../../hooks/useBilling', () => ({
  useCostCenters: () => ({ data: [{ id: 'cc-1', name: 'CC1', code: 'C1' }], isLoading: false }),
  useCostCenterAssignments: () => ({ data: mockAssignmentsData.data, isLoading: false }),
  useSaveCostCenter: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue('cc-1'), isPending: false }),
  useDeleteCostCenter: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveCostCenterAssignment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCostCenterAssignment: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useSonarCloudData', () => ({
  useProjects: () => ({ data: { components: [] }, isLoading: false }),
}));

vi.mock('../../hooks/useProjectsRealData', () => ({
  useProjectsRealData: () => ({ projects: [], isLoading: false, isError: false }),
}));

vi.mock('../../services/db', () => ({
  getAuthConfig: () => Promise.resolve({}),
}));

vi.mock('../../services/sonarcloud', () => ({ default: vi.fn() }));

let capturedSelectedProjectKeys: string[] = [];
vi.mock('../Portfolio/ProjectList', () => ({
  default: (props: { selectedProjectKeys?: string[] }) => {
    capturedSelectedProjectKeys = props.selectedProjectKeys ?? [];
    return <div data-testid="project-list">ProjectList</div>;
  },
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('CostCenters', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
    capturedSelectedProjectKeys = [];
    mockAssignmentsData.data = [];
  });

  it('renders cost centers section and project list', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CostCenters organization="my-org" />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('project-list')).toBeInTheDocument();
  });

  it('filters "projects in scope" to projectKeysInSelectedOrgs when provided', () => {
    mockAssignmentsData.data = [
      { id: 'a1', costCenterId: 'cc-1', type: 'project', projectKey: 'p1', allocationPercentage: 100 },
      { id: 'a2', costCenterId: 'cc-1', type: 'project', projectKey: 'p2', allocationPercentage: 50 },
    ];
    render(
      <QueryClientProvider client={queryClient}>
        <CostCenters
          organization="my-org"
          projectKeysInSelectedOrgs={['p1']}
        />
      </QueryClientProvider>
    );
    expect(capturedSelectedProjectKeys).toEqual(['p1']);
    expect(capturedSelectedProjectKeys).not.toContain('p2');
  });

  it('shows ALL assigned projects when projectKeysInSelectedOrgs is undefined (single-org mode)', () => {
    mockAssignmentsData.data = [
      { id: 'a1', costCenterId: 'cc-1', type: 'project', projectKey: 'p1', allocationPercentage: 100 },
      { id: 'a2', costCenterId: 'cc-1', type: 'project', projectKey: 'p2', allocationPercentage: 100 },
    ];
    render(
      <QueryClientProvider client={queryClient}>
        <CostCenters organization="my-org" />
      </QueryClientProvider>
    );
    // undefined = no scope filter → all assignments visible
    expect(capturedSelectedProjectKeys).toContain('p1');
    expect(capturedSelectedProjectKeys).toContain('p2');
  });

  it('shows NO assigned projects when projectKeysInSelectedOrgs is [] (multi-org, no orgs selected)', () => {
    // Bug: empty array was treated same as undefined (no filter) — all projects bled through.
    // Fix: empty array must mean "scope is explicitly empty — hide all".
    mockAssignmentsData.data = [
      { id: 'a1', costCenterId: 'cc-1', type: 'project', projectKey: 'leaked-proj', allocationPercentage: 100 },
      { id: 'a2', costCenterId: 'cc-1', type: 'project', projectKey: 'another-proj', allocationPercentage: 50 },
    ];
    render(
      <QueryClientProvider client={queryClient}>
        <CostCenters
          organization={undefined}
          projectKeysInSelectedOrgs={[]}
        />
      </QueryClientProvider>
    );
    // [] = "no org selected in multi mode" → nothing should appear
    expect(capturedSelectedProjectKeys).toHaveLength(0);
    expect(capturedSelectedProjectKeys).not.toContain('leaked-proj');
    expect(capturedSelectedProjectKeys).not.toContain('another-proj');
  });
});
