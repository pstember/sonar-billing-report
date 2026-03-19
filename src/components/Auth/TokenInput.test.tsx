/**
 * Unit tests for TokenInput.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TokenInput from './TokenInput';

const saveAuthConfig = vi.fn();
const mockValidateToken = vi.fn();
const mockGetEnterpriseDetails = vi.fn();
const mockGetEnterpriseOrganizations = vi.fn();

vi.mock('../../services/db', () => ({
  saveAuthConfig: (...args: unknown[]) => saveAuthConfig(...args),
}));

vi.mock('../../services/sonarcloud', () => ({
  default: function MockSonarCloudService() {
    return {
      validateToken: mockValidateToken,
      getEnterpriseDetails: mockGetEnterpriseDetails,
      getEnterpriseOrganizations: mockGetEnterpriseOrganizations,
    };
  },
}));

vi.mock('../ThemeSelector', () => ({
  default: () => <div data-testid="theme-selector">ThemeSelector</div>,
}));

describe('TokenInput', () => {
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateToken.mockResolvedValue(true);
    mockGetEnterpriseDetails.mockResolvedValue([{ id: 'ent-uuid' }]);
    mockGetEnterpriseOrganizations.mockResolvedValue([]);
    saveAuthConfig.mockResolvedValue(1);
  });

  it('renders token and enterprise key inputs and submit button', () => {
    render(<TokenInput onSuccess={onSuccess} />);
    expect(screen.getByLabelText(/SonarQube Cloud Access Token/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Enterprise Key/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to Dashboard/ })).toBeInTheDocument();
  });

  it('shows validation error when token is empty on submit', async () => {
    const user = userEvent.setup();
    render(<TokenInput onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/Enterprise Key/), 'my-enterprise');
    await user.click(screen.getByRole('button', { name: /Continue to Dashboard/ }));
    await screen.findByText(/Please enter your SonarQube Cloud token/);
  });

  it('shows validation error when enterprise key is empty on submit', async () => {
    const user = userEvent.setup();
    render(<TokenInput onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/SonarQube Cloud Access Token/), 'my-token');
    await user.click(screen.getByRole('button', { name: /Continue to Dashboard/ }));
    await screen.findByText(/Please enter your Enterprise Key/);
  });

  it('calls onSuccess after successful validation and save', async () => {
    const user = userEvent.setup();
    render(<TokenInput onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/SonarQube Cloud Access Token/), 'my-token');
    await user.type(screen.getByLabelText(/Enterprise Key/), 'my-enterprise');
    await user.click(screen.getByRole('button', { name: /Continue to Dashboard/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
