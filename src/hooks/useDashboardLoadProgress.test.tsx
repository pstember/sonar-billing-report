/**
 * Unit tests for useDashboardLoadProgress.
 * Uses a fresh QueryClient and seeds the cache to assert progress and item labels/categories.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDashboardLoadProgress } from './useDashboardLoadProgress';

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useDashboardLoadProgress', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('returns total 0 and percent 0 when cache has no queries', () => {
    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(useDashboardLoadProgress, { wrapper });

    expect(result.current.total).toBe(0);
    expect(result.current.completed).toBe(0);
    expect(result.current.percent).toBe(0);
    expect(result.current.items).toHaveLength(0);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns correct completed, total and percent with 2 queries (one success, one error)', async () => {
    queryClient.setQueryData(['projects', { organization: 'my-org' }], { components: [], paging: {} });
    await queryClient
      .fetchQuery({
        queryKey: ['billingOverviewOrg', 'org-123'],
        queryFn: () => Promise.reject(new Error('fail')),
      })
      .catch(() => {});

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(useDashboardLoadProgress, { wrapper });

    expect(result.current.total).toBe(2);
    expect(result.current.completed).toBe(2);
    expect(result.current.percent).toBe(100);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.isComplete).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('items have correct label, category and subCalls for known query keys', async () => {
    queryClient.setQueryData(['projects', { organization: 'acme' }], { components: [], paging: {} });
    queryClient.setQueryData(['billingOverviewOrg', 'acme'], { some: 'data' });

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(useDashboardLoadProgress, { wrapper });

    expect(result.current.items).toHaveLength(2);

    const projectsItem = result.current.items.find(
      (i) => i.category === 'projects' && i.label === 'acme'
    );
    expect(projectsItem).toBeDefined();
    expect(projectsItem?.description).toBe('Project list for this org');
    expect(projectsItem?.subCalls).toHaveLength(1);
    expect(projectsItem?.subCalls[0].label).toContain('components/search_projects');

    const billingItem = result.current.items.find(
      (i) => i.category === 'billing' && i.description.includes('Usage, limit')
    );
    expect(billingItem).toBeDefined();
    expect(billingItem?.label).toBe('acme'); // key2 as string is used as label
    expect(billingItem?.description).toBe('Usage, limit & Reserved/Pooled for this org');
    expect(billingItem?.subCalls).toHaveLength(2);
    expect(billingItem?.subCalls.some((s) => s.label.includes('get_ncloc_distribution'))).toBe(true);
    expect(billingItem?.subCalls.some((s) => s.label.includes('consumption-summaries'))).toBe(true);
  });
});
