/**
 * Unit tests for CacheIndicator.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CacheIndicator from './CacheIndicator';

const getCacheSize = vi.fn();
const clearExpiredCache = vi.fn();

vi.mock('../services/db', () => ({
  getCacheSize: (...args: unknown[]) => getCacheSize(...args),
  clearExpiredCache: (...args: unknown[]) => clearExpiredCache(...args),
}));

describe('CacheIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCacheSize.mockResolvedValue(0);
    clearExpiredCache.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('renders online status when navigator.onLine is true', async () => {
    render(<CacheIndicator />);
    await waitFor(() => {
      expect(screen.getByText('Online')).toBeInTheDocument();
    });
  });

  it('shows cached items count when cacheSize > 0', async () => {
    getCacheSize.mockResolvedValue(5);
    render(<CacheIndicator />);
    await waitFor(() => {
      expect(screen.getByText(/5 cached items/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('calls clearExpiredCache on mount', async () => {
    render(<CacheIndicator />);
    await waitFor(() => {
      expect(clearExpiredCache).toHaveBeenCalled();
    }, { timeout: 1000 });
  });
});
