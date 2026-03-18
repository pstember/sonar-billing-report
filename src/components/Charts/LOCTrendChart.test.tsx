/**
 * Unit tests for LOCTrendChart.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LOCTrendChart from './LOCTrendChart';

const sampleData = [
  { date: 'Jan 2025', Total: 10000, 'team-a': 6000, 'team-b': 4000 },
  { date: 'Feb 2025', Total: 12000, 'team-a': 7000, 'team-b': 5000 },
];
const teamNames = ['team-a', 'team-b'];

describe('LOCTrendChart', () => {
  it('renders chart title and description', () => {
    render(
      <LOCTrendChart
        data={sampleData}
        teamNames={teamNames}
      />
    );
    expect(screen.getByText('Lines of Code Trend')).toBeInTheDocument();
    expect(screen.getByText(/Monthly total LOC by cost center/)).toBeInTheDocument();
  });

  it('renders with seriesLabels and aggregateTotalKey', () => {
    render(
      <LOCTrendChart
        data={sampleData}
        teamNames={teamNames}
        seriesLabels={{ __total__: 'Total' }}
        aggregateTotalKey="__total__"
      />
    );
    expect(screen.getByText('Lines of Code Trend')).toBeInTheDocument();
  });
});
