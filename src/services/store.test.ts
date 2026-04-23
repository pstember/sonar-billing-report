/**
 * Unit tests for the SQLite store service (store.ts).
 * Mocks fetch to test the HTTP contract without a real server.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSonarCache,
  saveSonarCache,
  clearSonarCache,
  type SonarCacheResponse,
  type SonarCacheSaveResult,
} from './store';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk<T>(body: T) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function mockNoContent() {
  mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null) });
}

beforeEach(() => { mockFetch.mockReset(); });
afterEach(() => { vi.clearAllMocks(); });

describe('getSonarCache', () => {
  it('GET /store/sonarCache/:orgKey and returns projects + fetchedAt', async () => {
    const response: SonarCacheResponse = {
      projects: [
        { orgKey: 'my-org', projectKey: 'proj-1', name: 'Project 1', visibility: 'private', ncloc: 1000, tags: [], fetchedAt: '2026-04-23T10:00:00.000Z' },
      ],
      fetchedAt: '2026-04-23T10:00:00.000Z',
    };
    mockOk(response);

    const result = await getSonarCache('my-org');

    expect(mockFetch).toHaveBeenCalledWith(
      '/store/sonarCache/my-org',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) })
    );
    expect(result.fetchedAt).toBe('2026-04-23T10:00:00.000Z');
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].projectKey).toBe('proj-1');
  });

  it('returns null fetchedAt when no cache exists', async () => {
    mockOk({ projects: [], fetchedAt: null });
    const result = await getSonarCache('new-org');
    expect(result.fetchedAt).toBeNull();
    expect(result.projects).toHaveLength(0);
  });

  it('URL-encodes the orgKey', async () => {
    mockOk({ projects: [], fetchedAt: null });
    await getSonarCache('org with spaces');
    expect(mockFetch).toHaveBeenCalledWith(
      '/store/sonarCache/org%20with%20spaces',
      expect.anything()
    );
  });
});

describe('saveSonarCache', () => {
  it('POST /store/sonarCache/:orgKey with projects array', async () => {
    const saveResult: SonarCacheSaveResult = { upserted: 2, removed: 1, fetchedAt: '2026-04-23T11:00:00.000Z' };
    mockOk(saveResult);

    const projects = [
      { projectKey: 'p1', name: 'P1', visibility: 'private' as const, ncloc: 500 },
      { projectKey: 'p2', name: 'P2', visibility: 'public' as const, ncloc: 200 },
    ];
    const result = await saveSonarCache('my-org', projects);

    expect(mockFetch).toHaveBeenCalledWith(
      '/store/sonarCache/my-org',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ projects }),
      })
    );
    expect(result.upserted).toBe(2);
    expect(result.removed).toBe(1);
    expect(result.fetchedAt).toBe('2026-04-23T11:00:00.000Z');
  });
});

describe('clearSonarCache', () => {
  it('DELETE /store/sonarCache/:orgKey', async () => {
    mockNoContent();
    await clearSonarCache('my-org');
    expect(mockFetch).toHaveBeenCalledWith(
      '/store/sonarCache/my-org',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
