/**
 * TanStack Query Configuration
 * Set up React Query with persistent caching
 */

import { QueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { setCache, getCache } from '../services/db';

const CACHE_KEY = 'react-query-cache';
const MAX_AGE_MS = 86400000; // 24 hours

/**
 * Custom persister for TanStack Query using IndexedDB
 */
const persister = {
  async persistClient(client: PersistedClient): Promise<void> {
    await setCache(CACHE_KEY, client, MAX_AGE_MS);
  },
  async restoreClient(): Promise<PersistedClient | undefined> {
    const cached = await getCache<PersistedClient>(CACHE_KEY);
    return cached ?? undefined;
  },
  async removeClient(): Promise<void> {
    // Cache cleanup handled by db.clearCache()
  },
};

/**
 * Create query client with default options
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 24 * 60 * 60 * 1000, // 24 hours (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

export { persister };
