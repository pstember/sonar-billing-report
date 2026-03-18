/**
 * Unit tests for CostCenters.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import CostCenters from './CostCenters';

vi.mock('../../hooks/useBilling', () => ({
  useCostCenters: () => ({ data: [], isLoading: false }),
  useCostCenterAssignments: () => ({ data: [], isLoading: false }),
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
  getTagMappings: () => Promise.resolve([]),
  migrateTagMappingsToCostCenters: () => Promise.resolve(),
  getAuthConfig: () => Promise.resolve({}),
}));

vi.mock('../../services/sonarcloud', () => ({ default: vi.fn() }));

vi.mock('../Portfolio/ProjectList', () => ({
  default: () => <div data-testid="project-list">ProjectList</div>,
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
  });

  it('renders cost centers section and project list', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CostCenters organization="my-org" />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('project-list')).toBeInTheDocument();
  });
});
