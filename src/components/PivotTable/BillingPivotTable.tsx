/**
 * Billing Details Table (AG-Grid)
 *
 * - Uses ag-grid-react (AgGridReact) with row data and column defs; AG-Grid renders a .ag-root-wrapper
 *   and uses CSS vars (--ag-background-color etc.) from the theme class on the container.
 * - We apply ag-theme-alpine (light) or ag-theme-alpine-dark (dark) so the grid matches the app theme.
 * - Dark is driven by document.documentElement.classList.contains('dark'); we also have CSS overrides
 *   in index.css (html.dark .billing-details-card) so the card and grid stay dark even if state is out of sync.
 * - One row per project × cost center: allocated LOC and cost by cost center.
 */

import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { ColDef } from 'ag-grid-community';
import { formatCurrency, getCurrencySymbol } from '../../utils/costCalculations';
import { formatNumberWithCommas } from '../../utils/dataTransformers';
import { isDark } from '../../utils/theme';

export interface BillingDetailsRow {
  costCenterName: string;
  costCenterCode: string;
  projectKey: string;
  projectName: string;
  /** Required in multi-org view so organization is listed for every row */
  organizationName?: string;
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
  /** When true, Organization column is shown (required in multi-org) */
  readonly showOrganizationColumn?: boolean;
}

const NO_ROWS_MESSAGE = 'No billing rows. Assign projects to cost centers above.';

export default function BillingPivotTable({ data, currency = 'USD', totals, showOrganizationColumn = false }: BillingPivotTableProps) {
  const [dark, setDark] = useState(() => isDark());

  useEffect(() => {
    const handler = () => setDark(isDark());
    globalThis.addEventListener('themechange', handler);
    return () => globalThis.removeEventListener('themechange', handler);
  }, []);

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
      ...(showOrganizationColumn
        ? [{ field: 'organizationName', headerName: 'Organization', minWidth: 160, flex: 1 } as ColDef]
        : []),
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
        width: 110,
        valueFormatter: (params) => formatNumberWithCommas(Number(params.value) || 0),
      },
      {
        field: 'allocatedLoc',
        headerName: 'Allocated LOC',
        type: 'numericColumn',
        width: 120,
        valueFormatter: (params) => formatNumberWithCommas(Number(params.value) || 0),
      },
      {
        field: 'cost',
        headerName: `Cost rate-based (${getCurrencySymbol(currency)})`,
        type: 'numericColumn',
        width: 140,
        valueFormatter: (params) => formatCurrency(Number(params.value) || 0, currency),
      },
      {
        field: 'costContractShare',
        headerName: `License share (${getCurrencySymbol(currency)})`,
        type: 'numericColumn',
        width: 140,
        valueFormatter: (params) => formatCurrency(Number(params.value) || 0, currency),
      },
    ],
    [currency, showOrganizationColumn]
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
    <div className={dark ? 'dark' : ''}>
      <div
        className="billing-details-card rounded-lg shadow p-6 border border-gray-100 dark:border-slate-600"
        style={
          dark
            ? { backgroundColor: 'rgb(30 41 59)', borderColor: 'rgb(71 85 105)' }
            : { backgroundColor: 'white', borderColor: undefined }
        }
      >
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
          className={dark ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'}
          style={{
            height: hasRows ? 500 : 320,
            width: '100%',
            minHeight: 200,
            minWidth: 600,
          }}
        >
          <AgGridReact<BillingDetailsRow>
            key="billing-details-grid"
            theme="legacy"
            rowData={rowData}
            pinnedBottomRowData={pinnedBottomData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows={true}
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
    </div>
  );
}
