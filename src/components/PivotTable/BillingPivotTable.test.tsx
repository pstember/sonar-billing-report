/**
 * Unit tests for BillingPivotTable.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillingPivotTable from './BillingPivotTable';

vi.mock('../../utils/theme', () => ({
  isDark: () => false,
}));

vi.mock('ag-grid-react', () => ({
  AgGridReact: () => <div data-testid="ag-grid">AG Grid</div>,
}));

const sampleRow = {
  costCenterName: 'Engineering',
  costCenterCode: 'ENG',
  projectKey: 'proj-1',
  projectName: 'Project One',
  allocationPercentage: 100,
  ncloc: 5000,
  allocatedLoc: 5000,
  cost: 250,
  costContractShare: 25,
};

describe('BillingPivotTable', () => {
  it('renders no-rows message when data is empty', () => {
    render(<BillingPivotTable data={[]} />);
    expect(screen.getByText(/No rows yet/)).toBeInTheDocument();
  });

  it('renders grid when data provided', () => {
    render(<BillingPivotTable data={[sampleRow]} />);
    expect(screen.getByTestId('ag-grid')).toBeInTheDocument();
  });

  it('renders grid with totals when totals provided', () => {
    render(
      <BillingPivotTable
        data={[sampleRow]}
        totals={{
          allocatedLoc: 5000,
          cost: 250,
          costContractShare: 25,
        }}
      />
    );
    expect(screen.getByTestId('ag-grid')).toBeInTheDocument();
  });

  it('renders with showOrganizationColumn', () => {
    render(
      <BillingPivotTable
        data={[{ ...sampleRow, organizationName: 'My Org' }]}
        showOrganizationColumn
      />
    );
    expect(screen.getByTestId('ag-grid')).toBeInTheDocument();
  });
});
