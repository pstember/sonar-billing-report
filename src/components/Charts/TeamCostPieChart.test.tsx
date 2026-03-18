/**
 * Unit tests for TeamCostPieChart.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamCostPieChart from './TeamCostPieChart';

const segments = [
  { name: 'Engineering', value: 50000, cost: 2500, licenseShare: 25 },
  { name: 'Product', value: 30000, cost: 1500, licenseShare: 15 },
];

describe('TeamCostPieChart', () => {
  it('renders chart with cost center segments', () => {
    render(
      <TeamCostPieChart
        costCenterSegments={segments}
        unallocatedLoc={5000}
      />
    );
    expect(screen.getByText('Allocated + Unassigned')).toBeInTheDocument();
  });

  it('renders All LOCs option when unusedLoc provided', () => {
    render(
      <TeamCostPieChart
        costCenterSegments={segments}
        unallocatedLoc={5000}
        unusedLoc={10000}
      />
    );
    expect(screen.getByText('All LOCs')).toBeInTheDocument();
  });
});
