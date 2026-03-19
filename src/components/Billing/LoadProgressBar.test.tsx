/**
 * Unit tests for LoadProgressBar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoadProgressBar from './LoadProgressBar';

const mockItems = [
  {
    category: 'billing' as const,
    label: 'org1',
    description: 'Usage and limit',
    status: 'success' as const,
    fetchStatus: 'idle' as const,
    subCalls: [{ label: 'get_ncloc_distribution', description: '' }],
  },
  {
    category: 'projects' as const,
    label: 'org1',
    description: 'Project list',
    status: 'success' as const,
    fetchStatus: 'idle' as const,
    subCalls: [],
  },
];

const mockUseDashboardLoadProgress = vi.fn();
vi.mock('../../hooks/useDashboardLoadProgress', () => ({
  useDashboardLoadProgress: (...args: unknown[]) => mockUseDashboardLoadProgress(...args),
}));

describe('LoadProgressBar', () => {
  beforeEach(() => {
    mockUseDashboardLoadProgress.mockReturnValue({
      total: 2,
      completed: 1,
      percent: 50,
      fetching: 1,
      items: mockItems,
      isComplete: false,
      isLoading: true,
    });
  });

  it('renders progress bar and count while loading', () => {
    render(<LoadProgressBar />);
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
    expect(screen.getByText(/\(1 fetching\)/)).toBeInTheDocument();
  });

  it('shows progress details and categories when expanded', async () => {
    const user = userEvent.setup();
    render(<LoadProgressBar />);

    // Should show "Show details" button initially
    const showButton = screen.getByRole('button', { name: /Show details/ });
    expect(showButton).toBeInTheDocument();

    // Click to expand
    await user.click(showButton);

    // Now details should be visible
    expect(screen.getByText(/Billing/)).toBeInTheDocument();
    expect(screen.getByText(/Projects/)).toBeInTheDocument();
    expect(screen.getByText(/Only the .fetching. count are actual network/)).toBeInTheDocument();
  });

  it('renders nothing when fully loaded (isComplete)', () => {
    mockUseDashboardLoadProgress.mockReturnValueOnce({
      total: 2,
      completed: 2,
      percent: 100,
      fetching: 0,
      items: mockItems,
      isComplete: true,
      isLoading: false,
    });
    const { container } = render(<LoadProgressBar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when total is 0', () => {
    mockUseDashboardLoadProgress.mockReturnValueOnce({
      total: 0,
      completed: 0,
      percent: 0,
      fetching: 0,
      items: [],
      isComplete: true,
      isLoading: false,
    });
    const { container } = render(<LoadProgressBar />);
    expect(container.firstChild).toBeNull();
  });

  it('shows spinner not check when item has success but is still fetching', async () => {
    const user = userEvent.setup();
    const itemsWithOneFetching = [
      { category: 'billing' as const, label: 'Done', description: 'Complete', status: 'success' as const, fetchStatus: 'idle' as const, subCalls: [] },
      { category: 'billing' as const, label: 'Refetching', description: 'In flight', status: 'success' as const, fetchStatus: 'fetching' as const, subCalls: [] },
    ];
    mockUseDashboardLoadProgress.mockReturnValue({
      total: 2,
      completed: 1,
      percent: 50,
      fetching: 1,
      items: itemsWithOneFetching,
      isComplete: false,
      isLoading: true,
    });
    render(<LoadProgressBar />);
    await user.click(screen.getByRole('button', { name: /Show details/ }));
    const checks = screen.getAllByText('✓');
    expect(checks).toHaveLength(1);
  });

  it('collapses category when all items in section are fully complete', async () => {
    const user = userEvent.setup();
    const itemsWithOneCategoryComplete = [
      { category: 'enterprise' as const, label: 'Org A', description: 'Done', status: 'success' as const, fetchStatus: 'idle' as const, subCalls: [] },
      { category: 'enterprise' as const, label: 'Org B', description: 'Done', status: 'success' as const, fetchStatus: 'idle' as const, subCalls: [] },
      { category: 'projects' as const, label: 'Proj', description: 'Pending', status: 'pending' as const, fetchStatus: 'fetching' as const, subCalls: [] },
    ];
    mockUseDashboardLoadProgress.mockReturnValue({
      total: 3,
      completed: 2,
      percent: 67,
      fetching: 1,
      items: itemsWithOneCategoryComplete,
      isComplete: false,
      isLoading: true,
    });
    render(<LoadProgressBar />);
    await user.click(screen.getByRole('button', { name: /Show details/ }));
    await waitFor(() => {
      const enterpriseButton = screen.getByRole('button', { name: /Enterprise/ });
      expect(enterpriseButton).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
