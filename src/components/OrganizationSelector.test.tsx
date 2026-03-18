/**
 * Unit tests for OrganizationSelector.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import OrganizationSelector from './OrganizationSelector';

const mockOrgs = [
  { key: 'org1', name: 'Organization 1', uuid: 'uuid-1' },
  { key: 'org2', name: 'Organization 2', uuid: 'uuid-2' },
];

const useEnterpriseOrganizations = vi.fn();
const saveSetting = vi.fn();
const getSetting = vi.fn();

vi.mock('../hooks/useBillingData', () => ({
  useEnterpriseOrganizations: (...args: unknown[]) => useEnterpriseOrganizations(...args),
}));

vi.mock('../services/db', () => ({
  saveSetting: (...args: unknown[]) => saveSetting(...args),
  getSetting: (...args: unknown[]) => getSetting(...args),
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('OrganizationSelector', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
    useEnterpriseOrganizations.mockReturnValue({
      data: mockOrgs,
      isLoading: false,
      error: null,
    });
    getSetting.mockResolvedValue(undefined);
    saveSetting.mockResolvedValue(undefined);
  });

  it('renders loading state when organizations are loading', () => {
    useEnterpriseOrganizations.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSelector onOrganizationChange={onChange} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it('renders organization options when loaded (single-select)', async () => {
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSelector onOrganizationChange={onChange} />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'org1', name: 'Organization 1', uuid: 'uuid-1' })
      );
    });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onOrganizationChange when selection changes (single-select)', async () => {
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSelector onOrganizationChange={onChange} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'org2');
    await waitFor(() => {
      expect(saveSetting).toHaveBeenCalledWith('selectedOrganization', 'org2');
    });
  });
});
