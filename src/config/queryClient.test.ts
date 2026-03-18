import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryClient, persister } from './queryClient';

vi.mock('../services/db', () => ({
  setCache: vi.fn(() => Promise.resolve()),
  getCache: vi.fn(() => Promise.resolve(undefined)),
}));

describe('queryClient', () => {
  it('exports a QueryClient instance', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it('has default staleTime of 5 minutes', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(5 * 60 * 1000);
  });

  it('has default gcTime of 24 hours', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.gcTime).toBe(24 * 60 * 60 * 1000);
  });

  it('has retry 2 for queries', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(2);
  });

  it('has refetchOnWindowFocus false', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('has retry 1 for mutations', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.mutations?.retry).toBe(1);
  });
});

describe('persister', () => {
  beforeEach(async () => {
    const { setCache, getCache } = await import('../services/db');
    vi.mocked(setCache).mockClear();
    vi.mocked(getCache).mockClear();
  });

  it('persistClient calls setCache with cache key and client', async () => {
    const { setCache } = await import('../services/db');
    const client = { clientState: {}, buster: 'test' };
    await persister.persistClient(client);
    expect(setCache).toHaveBeenCalledWith(
      'react-query-cache',
      client,
      86400000
    );
  });

  it('restoreClient returns undefined when getCache returns undefined', async () => {
    const { getCache } = await import('../services/db');
    vi.mocked(getCache).mockResolvedValue(undefined);
    const result = await persister.restoreClient();
    expect(result).toBeUndefined();
  });

  it('restoreClient returns cached client when getCache returns data', async () => {
    const { getCache } = await import('../services/db');
    const cached = { clientState: {}, buster: 'x' };
    vi.mocked(getCache).mockResolvedValue(cached);
    const result = await persister.restoreClient();
    expect(result).toEqual(cached);
  });

  it('removeClient resolves without throwing', async () => {
    await expect(persister.removeClient()).resolves.toBeUndefined();
  });
});
