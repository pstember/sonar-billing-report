/**
 * Unit tests for LoadProgressBar.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    status: 'pending' as const,
    fetchStatus: 'fetching' as const,
    subCalls: [],
  },
];

vi.mock('../../hooks/useDashboardLoadProgress', () => ({
  useDashboardLoadProgress: () => ({
    total: 2,
    completed: 1,
    percent: 50,
    items: mockItems,
    isComplete: false,
    isLoading: true,
  }),
}));

describe('LoadProgressBar', () => {
  it('renders progress label with completed and total', () => {
    render(<LoadProgressBar />);
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });

  it('renders item labels and descriptions', () => {
    render(<LoadProgressBar />);
    expect(screen.getAllByText('org1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Usage and limit/)).toBeInTheDocument();
    expect(screen.getByText(/Project list/)).toBeInTheDocument();
  });
});
