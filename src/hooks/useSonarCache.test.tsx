/**
 * Unit tests for useSonarCache hooks.
 * Mocks store service; tests query/mutation behaviour without a real server.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Store service mocks ────────────────────────────────────────────────────────
const getSonarCache = vi.fn();
const saveSonarCache = vi.fn();
const clearSonarCache = vi.fn();

vi.mock('../services/store', () => ({
  getSonarCache: (...args: unknown[]) => getSonarCache(...args),
  saveSonarCache: (...args: unknown[]) => saveSonarCache(...args),
  clearSonarCache: (...args: unknown[]) => clearSonarCache(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

import {
  useSonarCacheRead,
  useSonarCacheWrite,
  useRefetchAndCache,
} from './useSonarCache';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSonarCacheRead', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
    vi.clearAllMocks();
  });

  it('returns data from getSonarCache when orgKey provided', async () => {
    const cacheData = {
      projects: [{ orgKey: 'my-org', projectKey: 'p1', name: 'P1', visibility: 'private', ncloc: 100, tags: [], fetchedAt: '2026-04-23T10:00:00.000Z' }],
      fetchedAt: '2026-04-23T10:00:00.000Z',
    };
    getSonarCache.mockResolvedValue(cacheData);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useSonarCacheRead('my-org'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(cacheData);
    expect(getSonarCache).toHaveBeenCalledWith('my-org');
  });

  it('does not fetch when orgKey is falsy', () => {
    const wrapper = createWrapper(queryClient);
    renderHook(() => useSonarCacheRead(undefined), { wrapper });

    expect(getSonarCache).not.toHaveBeenCalled();
  });

  it('queryKey includes orgKey for cache isolation', async () => {
    getSonarCache.mockResolvedValue({ projects: [], fetchedAt: null });
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useSonarCacheRead('org-a'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getSonarCache).toHaveBeenCalledWith('org-a');
  });
});

describe('useSonarCacheWrite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
    vi.clearAllMocks();
  });

  it('calls saveSonarCache with orgKey and projects', async () => {
    const saveResult = { upserted: 2, removed: 1, fetchedAt: '2026-04-23T11:00:00.000Z' };
    saveSonarCache.mockResolvedValue(saveResult);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useSonarCacheWrite(), { wrapper });

    const projects = [
      { projectKey: 'p1', name: 'P1', visibility: 'private' as const, ncloc: 500 },
    ];

    await act(async () => {
      result.current.mutate({ orgKey: 'my-org', projects });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saveSonarCache).toHaveBeenCalledWith('my-org', projects);
  });

  it('returns mutation result on success', async () => {
    const saveResult = { upserted: 3, removed: 0, fetchedAt: '2026-04-23T11:00:00.000Z' };
    saveSonarCache.mockResolvedValue(saveResult);

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useSonarCacheWrite(), { wrapper });

    await act(async () => {
      result.current.mutate({ orgKey: 'org-x', projects: [] });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(saveResult);
  });
});

describe('useRefetchAndCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
    vi.clearAllMocks();
  });

  it('exposes refetchAll function and isRefetching flag', () => {
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useRefetchAndCache([]), { wrapper });

    expect(typeof result.current.refetchAll).toBe('function');
    expect(typeof result.current.isRefetching).toBe('boolean');
  });

  it('isRefetching is false initially', () => {
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useRefetchAndCache(['org-a']), { wrapper });
    expect(result.current.isRefetching).toBe(false);
  });
});
