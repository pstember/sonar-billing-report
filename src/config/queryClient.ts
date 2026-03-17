/**
 * TanStack Query Configuration
 * Set up React Query with persistent caching
 */

import { QueryClient } from '@tanstack/react-query';
import { setCache, getCache } from '../services/db';

/**
 * Custom persister for TanStack Query using IndexedDB
 */
const persister = {
  async persistClient(client: unknown) {
    await setCache('react-query-cache', client, 86400000); // 24 hour TTL
  },
  async restoreClient() {
    return await getCache<unknown>('react-query-cache');
  },
  async removeClient() {
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
