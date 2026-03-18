/**
 * Unit tests for BillingConfig.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingConfig from './BillingConfig';

const STORAGE_KEY = 'sonarcloud-billing-config';

describe('BillingConfig', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders default config when nothing in storage', () => {
    render(<BillingConfig />);
    expect(screen.getByText('Billing Plan Configuration')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText(/Free Plan/)).toBeInTheDocument();
  });

  it('shows Edit button and switches to edit mode on click', async () => {
    const user = userEvent.setup();
    render(<BillingConfig />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Save Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfigChange when config is provided', () => {
    const onConfigChange = vi.fn();
    render(<BillingConfig onConfigChange={onConfigChange} />);
    expect(onConfigChange).toHaveBeenCalled();
  });

  it('saves config to localStorage and calls onConfigChange when Save clicked', async () => {
    const user = userEvent.setup();
    const onConfigChange = vi.fn();
    render(<BillingConfig onConfigChange={onConfigChange} />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const planInput = screen.getByPlaceholderText(/e.g., Team Plan/);
    await user.clear(planInput);
    await user.type(planInput, 'Pro Plan');
    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));
    const saved = localStorage.getItem(STORAGE_KEY);
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved!).planName).toBe('Pro Plan');
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ planName: 'Pro Plan' }));
  });

  it('restores previous config when Cancel clicked', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      locLimit: 200000,
      locUsed: 50000,
      planName: 'Saved Plan',
      addOns: [],
    }));
    render(<BillingConfig />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Saved Plan')).toBeInTheDocument();
  });
});
