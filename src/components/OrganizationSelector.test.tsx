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
  { key: 'org1', name: 'Organization 1', uuid: 'uuid-1', isMember: true },
  { key: 'org2', name: 'Organization 2', uuid: 'uuid-2', isMember: true },
];

const useEnterpriseOrganizations = vi.fn();
const saveSetting = vi.fn();
const getSetting = vi.fn();

vi.mock('../hooks/useBillingData', () => ({
  useEnterpriseOrganizations: (...args: unknown[]) => useEnterpriseOrganizations(...args),
}));

vi.mock('../services/store', () => ({
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
      data: { organizations: mockOrgs },
      isLoading: false,
      error: null,
    });
    getSetting.mockResolvedValue(undefined);
    saveSetting.mockResolvedValue(undefined);
  });

  it('renders loading state when organizations are loading', () => {
    useEnterpriseOrganizations.mockReturnValue({ data: undefined, isLoading: true, error: null } as never);
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

  describe('multi-select: non-member orgs', () => {
    const orgsWithNonMember = [
      { key: 'org1', name: 'Organization 1', uuid: 'uuid-1', isMember: true },
      { key: 'org2', name: 'Organization 2', uuid: 'uuid-2', isMember: false },
    ];

    beforeEach(() => {
      useEnterpriseOrganizations.mockReturnValue({
        data: { organizations: orgsWithNonMember },
        isLoading: false,
        error: null,
      });
    });

    it('disables non-member org checkboxes in multi-select mode', () => {
      const onOrganizationsChange = vi.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <OrganizationSelector
            multiSelect
            selectedOrganizations={[]}
            onOrganizationsChange={onOrganizationsChange}
          />
        </QueryClientProvider>
      );
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeDisabled();   // org1 — member
      expect(checkboxes[1]).toBeDisabled();        // org2 — not a member
    });

    it('does not fire onOrganizationsChange when toggling a non-member org', async () => {
      const onOrganizationsChange = vi.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <OrganizationSelector
            multiSelect
            selectedOrganizations={[]}
            onOrganizationsChange={onOrganizationsChange}
          />
        </QueryClientProvider>
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Clicking the disabled checkbox (org2) should not call the handler
      await userEvent.click(checkboxes[1]);
      expect(onOrganizationsChange).not.toHaveBeenCalled();
    });

    it('shows "not a member" label next to disabled org in multi-select mode', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <OrganizationSelector
            multiSelect
            selectedOrganizations={[]}
            onOrganizationsChange={vi.fn()}
          />
        </QueryClientProvider>
      );
      expect(screen.getByText(/not a member/)).toBeInTheDocument();
    });

    it('does not disable orgs where isMember is undefined (old cache)', () => {
      useEnterpriseOrganizations.mockReturnValue({
        data: {
          organizations: [
            { key: 'org1', name: 'Organization 1', uuid: 'uuid-1', isMember: undefined as unknown as boolean },
          ],
        },
        isLoading: false,
        error: null,
      });
      render(
        <QueryClientProvider client={queryClient}>
          <OrganizationSelector
            multiSelect
            selectedOrganizations={[]}
            onOrganizationsChange={vi.fn()}
          />
        </QueryClientProvider>
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeDisabled();
    });
  });
});
