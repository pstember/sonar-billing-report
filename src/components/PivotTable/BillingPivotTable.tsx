/**
 * Billing Details Table (AG-Grid)
 * One row per project × cost center: allocated LOC and cost by cost center.
 */

import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { ColDef } from 'ag-grid-community';
import { formatCurrency, getCurrencySymbol } from '../../utils/costCalculations';
import { formatNumberWithCommas } from '../../utils/dataTransformers';

export interface BillingDetailsRow {
  costCenterName: string;
  costCenterCode: string;
  projectKey: string;
  projectName: string;
  allocationPercentage: number;
  ncloc: number;
  allocatedLoc: number;
  cost: number;
  costContractShare: number;
}

export interface BillingDetailsTotals {
  allocatedLoc: number;
  cost: number;
  costContractShare: number;
}

interface BillingPivotTableProps {
  readonly data: BillingDetailsRow[];
  readonly currency?: string;
  readonly totals?: BillingDetailsTotals;
}

const NO_ROWS_MESSAGE = 'No billing rows. Assign projects to cost centers above.';

export default function BillingPivotTable({ data, currency = 'USD', totals }: BillingPivotTableProps) {
  const rowData = data ?? [];
  const hasRows = rowData.length > 0;

  const pinnedBottomData = useMemo(() => {
    if (!totals || !hasRows) return undefined;
    return [{
      costCenterName: '',
      costCenterCode: '',
      projectKey: '',
      projectName: 'Total',
      allocationPercentage: undefined as unknown as number,
      ncloc: undefined as unknown as number,
      allocatedLoc: totals.allocatedLoc,
      cost: totals.cost,
      costContractShare: totals.costContractShare,
    }];
  }, [totals, hasRows]);

  const costCenterDisplayValue = (params: { data?: BillingDetailsRow }) => {
    const d = params.data;
    if (!d) return '';
    const name = d.costCenterName ?? '';
    const code = d.costCenterCode;
    return code ? `${name} (${code})` : name;
  };

  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        field: 'costCenterName',
        headerName: 'Cost center',
        valueGetter: (params) => costCenterDisplayValue(params),
        minWidth: 220,
        flex: 1,
      },
      { field: 'projectName', headerName: 'Project', minWidth: 200, flex: 1 },
      {
        field: 'allocationPercentage',
        headerName: 'Allocation %',
        type: 'numericColumn',
        width: 110,
        valueFormatter: (params) => (params.value === null || params.value === undefined ? '—' : `${params.value}%`),
      },
      {
        field: 'ncloc',
        headerName: 'Total LOC',
        type: 'numericColumn',
        aggFunc: 'sum',
        width: 110,
        valueFormatter: (params) => formatNumberWithCommas(params.value ?? 0),
      },
      {
        field: 'allocatedLoc',
        headerName: 'Allocated LOC',
        type: 'numericColumn',
        aggFunc: 'sum',
        width: 120,
        valueFormatter: (params) => formatNumberWithCommas(params.value ?? 0),
      },
      {
        field: 'cost',
        headerName: `Cost rate-based (${getCurrencySymbol(currency)})`,
        type: 'numericColumn',
        aggFunc: 'sum',
        width: 140,
        valueFormatter: (params) => formatCurrency(params.value ?? 0, currency),
      },
      {
        field: 'costContractShare',
        headerName: `License share (${getCurrencySymbol(currency)})`,
        type: 'numericColumn',
        aggFunc: 'sum',
        width: 140,
        valueFormatter: (params) => formatCurrency(params.value ?? 0, currency),
      },
    ],
    [currency]
  );

  const defaultColDef = useMemo(
    () => ({
      flex: 1,
      minWidth: 100,
      sortable: true,
      filter: true,
      resizable: true,
    }),
    []
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 border border-gray-100 dark:border-slate-700">
      <h3 className="text-xl font-bold mb-2 text-sonar-purple dark:text-white">Billing Details</h3>
      <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">
        Allocated LOC and cost by cost center. One row per project per cost center assignment.
      </p>
      {hasRows === false && (
        <p className="text-sm text-amber-600 dark:text-amber-300 mb-4">
          No rows yet — assign projects to cost centers in the section above to see data here.
        </p>
      )}
      <div
        className="ag-theme-alpine"
        style={{
          height: hasRows ? 500 : 320,
          width: '100%',
          minHeight: 200,
          minWidth: 600,
        }}
      >
        <AgGridReact<BillingDetailsRow>
          key="billing-details-grid"
          rowData={rowData}
          pinnedBottomRowData={pinnedBottomData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          suppressAggFuncInHeader={false}
          animateRows={true}
          enableRangeSelection={true}
          overlayNoRowsTemplate={`<span class="ag-overlay-no-rows-center">${NO_ROWS_MESSAGE}</span>`}
          initialState={{
            sort: { sortModel: [
              { colId: 'costCenterName', sort: 'asc' },
              { colId: 'cost', sort: 'desc' },
            ] },
          }}
        />
      </div>
    </div>
  );
}
