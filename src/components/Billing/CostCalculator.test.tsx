/**
 * Unit tests for CostCalculator.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import CostCalculator from './CostCalculator';

const useBillingConfig = vi.fn();
const useSaveBillingConfig = vi.fn();

vi.mock('../../hooks/useBilling', () => ({
  useBillingConfig: (...args: unknown[]) => useBillingConfig(...args),
  useSaveBillingConfig: (...args: unknown[]) => useSaveBillingConfig(...args),
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('CostCalculator', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
    useBillingConfig.mockReturnValue({
      data: { contractValue: 10000, defaultRate: 10, currency: 'USD', languageRates: {} },
      isLoading: false,
    });
    useSaveBillingConfig.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('renders Cost Configuration heading and edit button when not editing', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CostCalculator />
      </QueryClientProvider>
    );
    expect(screen.getByText('Cost Configuration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Configuration' })).toBeInTheDocument();
  });

  it('shows loading when useBillingConfig is loading', () => {
    useBillingConfig.mockReturnValue({ data: undefined, isLoading: true });
    render(
      <QueryClientProvider client={queryClient}>
        <CostCalculator />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Loading billing configuration/)).toBeInTheDocument();
  });

  it('switches to edit mode and shows form', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <CostCalculator />
      </QueryClientProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Edit Configuration' }));
    expect(screen.getByLabelText(/Contract value/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('calls save mutation when Save clicked', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    useSaveBillingConfig.mockReturnValue({ mutateAsync, mutate: vi.fn(), isPending: false });
    render(
      <QueryClientProvider client={queryClient}>
        <CostCalculator />
      </QueryClientProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Edit Configuration' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutateAsync).toHaveBeenCalled();
  });
});
