/**
 * Unit tests for ProjectList.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import ProjectList from './ProjectList';

vi.mock('../../hooks/useSonarCloudData', () => ({
  useProjects: () => ({
    data: {
      components: [
        { key: 'proj-1', name: 'Project One', visibility: 'private', tags: ['team-a'] },
        { key: 'proj-2', name: 'Project Two', visibility: 'private', tags: [] },
      ],
      paging: { total: 2 },
    },
    isLoading: false,
  }),
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('ProjectList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
  });

  it('renders project list with onProjectsSelected callback', () => {
    const onSelected = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectList onProjectsSelected={onSelected} organization="my-org" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Project Two')).toBeInTheDocument();
  });
});
