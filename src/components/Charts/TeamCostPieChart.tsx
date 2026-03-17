/**
 * Cost Distribution Pie Chart
 * Shows LOC by cost center, unassigned (in-scope but not allocated to any cost center), and optional unused allowance.
 * Toggle: "All LOCs" (includes unused) vs "Allocated + Unassigned".
 * Click a segment to highlight it and scroll the table row into view.
 */

import { useState, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils/costCalculations';
import { formatLargeNumber } from '../../utils/dataTransformers';
import { PIE_COLORS, PIE_UNASSIGNED_COLOR, PIE_UNUSED_COLOR } from '../../constants/chartColors';

export type CostCenterSegment = { name: string; value: number; cost?: number; licenseShare?: number };

interface TeamCostPieChartProps {
  readonly costCenterSegments: CostCenterSegment[];
  readonly unallocatedLoc: number;
  /** LOC not consumed within allowance (allowance - consumed). Shown when showUnused is true. */
  readonly unusedLoc?: number;
  /** Rate-based cost for unassigned LOC (Allocated + Unassigned view). */
  readonly unassignedCost?: number;
  /** License share for unassigned LOC (All LOCs view). */
  readonly unassignedLicenseShare?: number;
  /** License share for unused allowance (All LOCs view only). */
  readonly unusedLicenseShare?: number;
  readonly currency?: string;
}

type PieEntry = { name: string; value: number; cost?: number; licenseShare?: number; fill?: string };

const CustomPieTooltip = (props: {
  active?: boolean;
  payload?: Array<{ payload?: PieEntry }>;
  showUnused: 'all' | 'allocated';
  currency: string;
} & Record<string, unknown>) => {
  const { active, payload, showUnused, currency } = props;
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;
  const money = showUnused === 'all' ? (entry.licenseShare ?? 0) : (entry.cost ?? 0);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600 px-4 py-3 min-w-[180px]">
      <p className="font-body font-semibold text-gray-900 dark:text-white text-sm mb-1">{entry.name}</p>
      <p className="text-sm text-gray-600 dark:text-slate-300 font-body">
        LOC: <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{formatLargeNumber(entry.value)}</span>
      </p>
      <p className="text-sm text-gray-600 dark:text-slate-300 font-body">
        {showUnused === 'all' ? 'License share' : 'Rate cost'}:{' '}
        <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(money, currency)}</span>
      </p>
    </div>
  );
};

export default function TeamCostPieChart({
  costCenterSegments,
  unallocatedLoc,
  unusedLoc = 0,
  unassignedCost = 0,
  unassignedLicenseShare = 0,
  unusedLicenseShare = 0,
  currency = 'USD',
}: Readonly<TeamCostPieChartProps>) {
  const [showUnused, setShowUnused] = useState<'all' | 'allocated'>('allocated');
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);

  // Pie: only in-scope LOC (cost centers + Unassigned). Exclude Unused so the pie stays readable when Unused is huge (e.g. 4M LOC).
  const pieData = useMemo((): PieEntry[] => {
    const items: PieEntry[] = [
      ...costCenterSegments.filter((s) => s.value > 0).map((s) => ({
        ...s,
        cost: s.cost ?? 0,
        licenseShare: s.licenseShare ?? 0,
      })),
      { name: 'Unassigned', value: unallocatedLoc, cost: unassignedCost, licenseShare: unassignedLicenseShare, fill: PIE_UNASSIGNED_COLOR },
    ];
    return items.filter((d) => d.value > 0 || d.name === 'Unassigned');
  }, [costCenterSegments, unallocatedLoc, unassignedCost, unassignedLicenseShare]);

  // Table: when "All LOCs" selected, add Unused row so license share is visible for all segments
  const tableData = useMemo((): PieEntry[] => {
    if (showUnused === 'all' && unusedLoc != null && unusedLoc > 0) {
      return [
        ...pieData,
        { name: 'Unused (allowance)', value: unusedLoc, cost: 0, licenseShare: unusedLicenseShare, fill: PIE_UNUSED_COLOR },
      ];
    }
    return pieData;
  }, [pieData, showUnused, unusedLoc, unusedLicenseShare]);

  const hasData = pieData.length > 0;
  const onlyUnassigned = hasData && pieData.length === 1 && pieData[0].name === 'Unassigned';

  const colorForIndex = useCallback((index: number, item: { name: string; fill?: string }) => {
    if (item.fill) return item.fill;
    return PIE_COLORS[index % PIE_COLORS.length];
  }, []);

  const handleSegmentHover = useCallback((index: number | null) => {
    setHoveredSegmentIndex(index);
  }, []);

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-8 flex flex-col items-center justify-center min-h-[400px]">
        <h3 className="text-2xl font-bold mb-4 text-sonar-purple dark:text-white font-sans">Cost distribution (LOC)</h3>
        <p className="text-gray-600 dark:text-slate-300 font-body">No data available. Assign projects to cost centers to see distribution.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-8 transition-all duration-300 hover:shadow-xl">
      {/* Header: title + View mode (aligned with LOC Trend) */}
      <div className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <h3 className="text-2xl font-bold text-sonar-purple dark:text-white tracking-tight font-sans">
            Cost distribution (LOC)
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-slate-300 font-body">View</span>
            <div className="inline-flex gap-px rounded bg-slate-100 dark:bg-slate-700">
              <button
                type="button"
                onClick={() => setShowUnused('allocated')}
                aria-pressed={showUnused === 'allocated'}
                aria-label="View allocated and unassigned LOC only"
                className={`px-2 py-1 rounded text-xs font-body transition-colors ${
                  showUnused === 'allocated'
                    ? 'bg-sonar-blue/15 dark:bg-sonar-blue/25 text-sonar-blue dark:text-sonar-blue border border-sonar-blue/30 font-medium'
                    : 'text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-slate-100'
                }`}
              >
                Allocated + Unassigned
              </button>
              <button
                type="button"
                onClick={() => setShowUnused('all')}
                aria-pressed={showUnused === 'all'}
                aria-label="View all LOCs including unused allowance"
                className={`px-2 py-1 rounded text-xs font-body transition-colors ${
                  showUnused === 'all'
                    ? 'bg-sonar-blue/15 dark:bg-sonar-blue/25 text-sonar-blue dark:text-sonar-blue border border-sonar-blue/30 font-medium'
                    : 'text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-slate-100'
                }`}
              >
                All LOCs
              </button>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-300 font-body font-medium">
          {showUnused === 'all'
            ? 'Cost centers + unassigned (in-scope) + unused allowance.'
            : onlyUnassigned
              ? 'All in-scope LOC are unassigned. Assign projects to cost centers to see distribution.'
              : 'Cost centers + unassigned LOC in scope.'}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="w-full" style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={tableData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => {
                  const pct = (percent ?? 0) * 100;
                  return pct >= 1 ? `${name}: ${Math.round(pct)}%` : `${name}`;
                }}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {tableData.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${entry.value}-${index}`}
                    fill={colorForIndex(index, entry)}
                    onMouseEnter={() => handleSegmentHover(index)}
                    onMouseLeave={() => handleSegmentHover(null)}
                  />
                ))}
              </Pie>
              <Tooltip content={(p) => <CustomPieTooltip {...(p as object)} showUnused={showUnused} currency={currency} />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-300 font-body">Hover a segment to highlight its row in the table.</p>
        <div className="w-full overflow-x-auto">
          <table
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden min-w-0"
            aria-label="Cost distribution breakdown for the chart above"
          >
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-700">
                <th className="text-left py-2 px-3 font-semibold text-sonar-purple dark:text-white font-sans">Segment</th>
                <th className="text-right py-2 px-3 font-semibold text-sonar-purple dark:text-white font-sans">LOC</th>
                <th className="text-right py-2 px-3 font-semibold text-sonar-purple dark:text-white font-sans">
                  {showUnused === 'all' ? 'License share' : 'Rate cost'}
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300 font-body">
              {tableData.map((entry, index) => (
                <tr
                  key={`${entry.name}-${entry.value}-${index}`}
                  data-segment-index={index}
                  className={`border-t border-slate-200 dark:border-slate-600 transition-colors ${
                    hoveredSegmentIndex === index ? 'bg-sonar-blue/10 dark:bg-sonar-blue/20' : ''
                  }`}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: colorForIndex(index, entry) }}
                        aria-hidden
                      />
                      <span className="truncate" title={entry.name}>{entry.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">{formatLargeNumber(entry.value)}</td>
                  <td className="text-right py-2 px-3 tabular-nums font-medium">
                    {formatCurrency(showUnused === 'all' ? (entry.licenseShare ?? 0) : (entry.cost ?? 0), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
