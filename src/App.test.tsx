/**
 * Unit tests for App.
 * Mocks auth and child components to assert layout and routing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

const getAuthConfig = vi.fn();

vi.mock('./services/db', () => ({
  getAuthConfig: (...args: unknown[]) => getAuthConfig(...args),
  setCache: vi.fn(() => Promise.resolve()),
  getCache: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('./components/Auth/TokenInput', () => ({
  default: function MockTokenInput() {
    return <div data-testid="token-input">TokenInput</div>;
  },
}));

vi.mock('./components/ThemeSelector', () => ({
  default: function MockThemeSelector() {
    return <div data-testid="theme-selector">ThemeSelector</div>;
  },
}));

vi.mock('./components/Billing/BillingDashboard', () => ({
  default: function MockBillingDashboard() {
    return <div data-testid="billing-dashboard">BillingDashboard</div>;
  },
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getAuthConfig.mockImplementation(() => new Promise(() => {}));
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows TokenInput when not authenticated', async () => {
    getAuthConfig.mockResolvedValue(undefined);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('token-input')).toBeInTheDocument();
    });
  });

  it('shows TokenInput when auth has token but no enterpriseKey', async () => {
    getAuthConfig.mockResolvedValue({ token: 'x', baseUrl: 'https://x.com', enterpriseKey: '' });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('token-input')).toBeInTheDocument();
    });
  });

  it('shows BillingDashboard when authenticated with token and enterpriseKey', async () => {
    getAuthConfig.mockResolvedValue({
      token: 'secret',
      baseUrl: 'https://sonarcloud.io',
      enterpriseKey: 'my-enterprise',
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('billing-dashboard')).toBeInTheDocument();
    });
  });
});
