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

// ── Auth + Sonar service mocks (for useRefetchAndCache) ───────────────────────
const getAuthConfig = vi.fn();
vi.mock('../services/db', () => ({
  getAuthConfig: (...args: unknown[]) => getAuthConfig(...args),
}));

const getBillingNCLOCDistributionAll = vi.fn();
vi.mock('../services/sonarcloud', () => ({
  default: class MockSonarCloudService {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getBillingNCLOCDistributionAll(...args: unknown[]) {
      return getBillingNCLOCDistributionAll(...args);
    }
  },
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
  useAutoSaveBillingNCLOC,
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

  it('invalidates sonarCache query for the org on success', async () => {
    saveSonarCache.mockResolvedValue({ upserted: 1, removed: 0, fetchedAt: '2026-04-23T11:00:00.000Z' });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useSonarCacheWrite(), { wrapper });

    await act(async () => {
      result.current.mutate({ orgKey: 'target-org', projects: [] });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['sonarCache', 'target-org'] }),
    );
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

  it('lastError is null initially', () => {
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useRefetchAndCache(['org-a']), { wrapper });
    expect(result.current.lastError).toBeNull();
  });

  it('fetches NCLOC per org, maps to cache format, and writes to SQLite', async () => {
    getAuthConfig.mockResolvedValue({ baseUrl: 'https://sonar.io', token: 'tok', organization: 'org-a', enterpriseKey: 'ek' });
    saveSonarCache.mockResolvedValue({ upserted: 2, removed: 0, fetchedAt: '2026-04-23T12:00:00.000Z' });
    getBillingNCLOCDistributionAll.mockResolvedValue({
      paging: { total: 2, pageIndex: 1, pageSize: 100 },
      projects: [
        { projectKey: 'p1', projectName: 'Project One', ncloc: 1000, visibility: 'private' },
        { projectKey: 'p2', projectName: 'Project Two', ncloc: 500, visibility: 'public' },
      ],
    });

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useRefetchAndCache(['org-a']), { wrapper });

    act(() => { result.current.refetchAll(); });

    // Wait for the mutation side effect — saveSonarCache called means the full chain ran
    await waitFor(() => expect(saveSonarCache).toHaveBeenCalledTimes(1));

    expect(getBillingNCLOCDistributionAll).toHaveBeenCalledWith({ organization: 'org-a' });
    expect(saveSonarCache).toHaveBeenCalledWith('org-a', [
      { projectKey: 'p1', name: 'Project One', ncloc: 1000, visibility: 'private' },
      { projectKey: 'p2', name: 'Project Two', ncloc: 500, visibility: 'public' },
    ]);
  });

  it('calls saveSonarCache for each org in parallel', async () => {
    getAuthConfig.mockResolvedValue({ baseUrl: 'https://sonar.io', token: 'tok', organization: 'org-a', enterpriseKey: 'ek' });
    saveSonarCache.mockResolvedValue({ upserted: 0, removed: 0, fetchedAt: '2026-04-23T12:00:00.000Z' });
    getBillingNCLOCDistributionAll.mockResolvedValue({ paging: { total: 0, pageIndex: 1, pageSize: 100 }, projects: [] });

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useRefetchAndCache(['org-a', 'org-b']), { wrapper });

    act(() => { result.current.refetchAll(); });
    // Wait for the mutation side effect to complete (both orgs)
    await waitFor(() => expect(saveSonarCache).toHaveBeenCalledTimes(2));

    expect(getBillingNCLOCDistributionAll).toHaveBeenCalledTimes(2);
    expect(saveSonarCache).toHaveBeenCalledWith('org-a', []);
    expect(saveSonarCache).toHaveBeenCalledWith('org-b', []);
  });

  it('invalidates sonarCache, billingNCLOC, billingOverviewOrg, and consumptionSummaries on success', async () => {
    getAuthConfig.mockResolvedValue({ baseUrl: 'https://sonar.io', token: 'tok', organization: 'org-x', enterpriseKey: 'ek' });
    saveSonarCache.mockResolvedValue({ upserted: 0, removed: 0, fetchedAt: '2026-04-23T12:00:00.000Z' });
    getBillingNCLOCDistributionAll.mockResolvedValue({ paging: { total: 0, pageIndex: 1, pageSize: 100 }, projects: [] });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useRefetchAndCache(['org-x']), { wrapper });

    act(() => { result.current.refetchAll(); });
    // Wait for the mutation to complete — invalidation happens synchronously in onSuccess
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['consumptionSummaries'] }),
    ));

    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['sonarCache', 'org-x'] }));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['billingNCLOC', 'org-x'] }));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['billingOverviewOrg', 'org-x'] }));
  });
});

describe('useAutoSaveBillingNCLOC', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
    saveSonarCache.mockResolvedValue({ upserted: 1, removed: 0, fetchedAt: '2026-04-23T12:00:00.000Z' });
  });

  it('calls saveSonarCache when data arrives and isFetching is false', async () => {
    const data = { paging: { total: 1, pageIndex: 1, pageSize: 100 }, projects: [{ projectKey: 'p1', projectName: 'P1', ncloc: 100, visibility: 'private' as const }] };
    const wrapper = createWrapper(queryClient);
    renderHook(() => useAutoSaveBillingNCLOC('my-org', data, false), { wrapper });

    await waitFor(() => expect(saveSonarCache).toHaveBeenCalledTimes(1));
    expect(saveSonarCache).toHaveBeenCalledWith('my-org', [
      { projectKey: 'p1', name: 'P1', ncloc: 100, visibility: 'private' },
    ]);
  });

  it('does not call saveSonarCache when isFetching is true', async () => {
    const data = { paging: { total: 0, pageIndex: 1, pageSize: 100 }, projects: [] };
    const wrapper = createWrapper(queryClient);
    renderHook(() => useAutoSaveBillingNCLOC('my-org', data, true), { wrapper });

    // Give a tick for any potential async effect to fire
    await new Promise((r) => setTimeout(r, 10));
    expect(saveSonarCache).not.toHaveBeenCalled();
  });

  it('does not call saveSonarCache when orgKey is undefined', async () => {
    const data = { paging: { total: 0, pageIndex: 1, pageSize: 100 }, projects: [] };
    const wrapper = createWrapper(queryClient);
    renderHook(() => useAutoSaveBillingNCLOC(undefined, data, false), { wrapper });

    await new Promise((r) => setTimeout(r, 10));
    expect(saveSonarCache).not.toHaveBeenCalled();
  });

  it('does not call saveSonarCache when data is undefined', async () => {
    const wrapper = createWrapper(queryClient);
    renderHook(() => useAutoSaveBillingNCLOC('my-org', undefined, false), { wrapper });

    await new Promise((r) => setTimeout(r, 10));
    expect(saveSonarCache).not.toHaveBeenCalled();
  });

  it('does not double-save same data reference on re-render', async () => {
    const data = { paging: { total: 0, pageIndex: 1, pageSize: 100 }, projects: [] };
    const wrapper = createWrapper(queryClient);
    const { rerender } = renderHook(
      ({ d }: { d: typeof data }) => useAutoSaveBillingNCLOC('my-org', d, false),
      { wrapper, initialProps: { d: data } },
    );

    await waitFor(() => expect(saveSonarCache).toHaveBeenCalledTimes(1));

    // Same reference re-rendered — must NOT trigger a second save
    rerender({ d: data });
    await new Promise((r) => setTimeout(r, 10));
    expect(saveSonarCache).toHaveBeenCalledTimes(1);
  });

  it('swallows saveSonarCache errors silently', async () => {
    saveSonarCache.mockRejectedValue(new Error('DB write failed'));
    const data = { paging: { total: 0, pageIndex: 1, pageSize: 100 }, projects: [] };
    const wrapper = createWrapper(queryClient);

    // Should not throw
    expect(() =>
      renderHook(() => useAutoSaveBillingNCLOC('my-org', data, false), { wrapper })
    ).not.toThrow();

    // Wait and ensure no uncaught promise rejection propagated
    await new Promise((r) => setTimeout(r, 20));
  });
});
