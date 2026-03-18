/**
 * LOC Trend Chart Component
 * Premium data visualization with refined aesthetics
 * Click a series name in the legend to show/hide it from the chart.
 */

import { useState, useCallback, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatLargeNumber } from '../../utils/dataTransformers';
import { CHART_COLORS } from '../../constants/chartColors';

const STORAGE_PREFIX = 'sonar-billing-loc-trend-hidden';

interface LOCTrendChartProps {
  data: {
    date: string;
    [key: string]: string | number;
  }[];
  teamNames: string[];
  /** Optional map from dataKey to display label (e.g. __total__ -> "Total") */
  seriesLabels?: Record<string, string>;
  /** Optional key for persisting hidden series in localStorage (e.g. org key) */
  chartId?: string;
  /** DataKey for the aggregate total series (e.g. __total__) for "Show only Total" / "Show all" */
  aggregateTotalKey?: string;
}

// Tooltip: sort so Total first, then by value descending
function sortPayload(
  payload: readonly { name: string; value?: number }[],
  seriesLabels: Record<string, string>
): { name: string; value?: number }[] {
  return [...payload].sort((a, b) => {
    const labelA = seriesLabels[a.name] ?? a.name;
    const labelB = seriesLabels[b.name] ?? b.name;
    if (labelA === 'Total') return -1;
    if (labelB === 'Total') return 1;
    return Number(b.value ?? 0) - Number(a.value ?? 0);
  });
}

const CustomTooltip = (props: {
  active?: boolean;
  payload?: { name?: string; value?: number; stroke?: string }[];
  label?: string;
  seriesLabels?: Record<string, string>;
} & Record<string, unknown>) => {
  const { active, payload, label, seriesLabels = {} } = props;
  if (active && payload?.length) {
    const sorted = sortPayload(payload as { name: string; value?: number }[], seriesLabels);
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-600 overflow-hidden min-w-[220px]">
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
          <p className="font-sans font-bold text-gray-900 dark:text-white text-sm tracking-wide">
            {label}
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {sorted.map((entry: { name?: string; value?: number; stroke?: string }, index: number) => (
            <div key={String(entry.name ?? index)} className="flex items-center justify-between gap-6 group">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-4 h-4 rounded-md flex-shrink-0 ring-2 ring-slate-100 dark:ring-slate-700 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: entry.stroke ?? '#94a3b8' }}
                />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate font-body">
                  {seriesLabels[entry.name ?? ''] ?? entry.name ?? ''}
                </span>
              </div>
              <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums flex-shrink-0 font-sans">
                {formatLargeNumber(Number(entry.value ?? 0))}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Legend with click-to-toggle: all series stay in the legend; click to disable/enable drawing
const CustomLegend = ({
  items,
  hiddenSeries,
  onToggle,
}: {
  items: { dataKey: string; label: string; color: string }[];
  hiddenSeries: Set<string>;
  onToggle: (dataKey: string) => void;
}) => {
  return (
    <div className="flex flex-wrap gap-3 justify-center mt-8 px-4">
      {items.map((entry) => {
        const isHidden = hiddenSeries.has(entry.dataKey);
        return (
          <button
            key={entry.dataKey}
            type="button"
            onClick={() => onToggle(entry.dataKey)}
            aria-pressed={!isHidden}
            aria-label={isHidden ? `Show ${entry.label} series` : `Hide ${entry.label} series`}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all duration-200 cursor-pointer select-none ${
              isHidden
                ? 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 opacity-60 hover:opacity-90'
                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:shadow-md hover:border-sonar-blue/40 dark:hover:border-sonar-blue/50'
            }`}
            title={isHidden ? `Show ${entry.label}` : `Hide ${entry.label}`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full ring-2 ring-slate-100 dark:ring-slate-700 transition-all ${isHidden ? 'opacity-50' : ''}`}
              style={{ backgroundColor: isHidden ? '#9ca3af' : entry.color }}
            />
            <span
              className={`text-sm font-bold font-body transition-colors ${
                isHidden
                  ? 'text-gray-500 dark:text-slate-400 line-through'
                  : 'text-gray-700 dark:text-slate-200 group-hover:text-gray-900 dark:group-hover:text-slate-50'
              }`}
            >
              {entry.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

function loadHiddenSeries(chartId: string | undefined): Set<string> {
  if (!chartId || globalThis.localStorage === undefined) return new Set();
  try {
    const raw = globalThis.localStorage.getItem(`${STORAGE_PREFIX}-${chartId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function saveHiddenSeries(chartId: string | undefined, hidden: Set<string>): void {
  if (!chartId || globalThis.localStorage === undefined) return;
  try {
    const arr = Array.from(hidden);
    globalThis.localStorage.setItem(`${STORAGE_PREFIX}-${chartId}`, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export default function LOCTrendChart({
  data,
  teamNames,
  seriesLabels = {},
  chartId,
  aggregateTotalKey,
}: LOCTrendChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => loadHiddenSeries(chartId));

  useEffect(() => {
    if (chartId) saveHiddenSeries(chartId, hiddenSeries);
  }, [chartId, hiddenSeries]);

  const toggleSeries = useCallback((name: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const showOnlyTotal = useCallback(() => {
    if (!aggregateTotalKey) return;
    const toHide = teamNames.filter((t) => t !== aggregateTotalKey);
    setHiddenSeries(new Set(toHide));
  }, [aggregateTotalKey, teamNames]);

  const showAll = useCallback(() => {
    setHiddenSeries(new Set());
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-8 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sonar-purple dark:text-white font-bold text-xl font-sans mb-2">No trend data available</p>
          <p className="text-sm text-gray-600 dark:text-slate-300 font-body">Select projects to view historical trends</p>
        </div>
      </div>
    );
  }

  const viewMode = aggregateTotalKey && teamNames.length > 1 && hiddenSeries.size === teamNames.length - 1 && !hiddenSeries.has(aggregateTotalKey)
    ? 'total'
    : 'all';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-8 transition-all duration-300 hover:shadow-xl">
      {/* Header: title + View mode (aligned with Cost Distribution pie) */}
      <div className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <h3 className="text-2xl font-bold text-sonar-purple dark:text-white tracking-tight font-sans">
            Lines of Code Trend
          </h3>
          {aggregateTotalKey && teamNames.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-slate-300 font-body">View</span>
              <div className="inline-flex gap-px rounded bg-slate-100 dark:bg-slate-700">
                <button
                  type="button"
                  onClick={showOnlyTotal}
                  aria-pressed={viewMode === 'total'}
                  className={`px-2 py-1 rounded text-xs font-body transition-colors ${
                    viewMode === 'total'
                      ? 'bg-sonar-blue/15 dark:bg-sonar-blue/25 text-sonar-blue dark:text-sonar-blue border border-sonar-blue/30 font-medium'
                      : 'text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-slate-100'
                  }`}
                >
                  Total only
                </button>
                <button
                  type="button"
                  onClick={showAll}
                  aria-pressed={viewMode === 'all'}
                  className={`px-2 py-1 rounded text-xs font-body transition-colors ${
                    viewMode === 'all'
                      ? 'bg-sonar-blue/15 dark:bg-sonar-blue/25 text-sonar-blue dark:text-sonar-blue border border-sonar-blue/30 font-medium'
                      : 'text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-slate-100'
                  }`}
                >
                  All series
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-300 font-body font-medium">
          Monthly total LOC by cost center (last known value per project until next scan). Click a series in the legend to hide or show it.
        </p>
      </div>

      {/* Chart with professional styling */}
      <ResponsiveContainer width="100%" height={440}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {/* Subtle grid for visual guidance */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            strokeOpacity={0.4}
            vertical={false}
            className="dark:stroke-slate-600 dark:stroke-opacity-40"
          />

          {/* X-Axis with refined typography */}
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              fill: '#6b7280'
            }}
            tickLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
            axisLine={{ stroke: '#d1d5db', strokeWidth: 1.5 }}
            height={60}
            angle={-12}
            textAnchor="end"
            tick={{ fill: '#6b7280' }}
          />

          {/* Y-Axis: start at 0 so scale does not jump when toggling series */}
          <YAxis
            domain={[0, 'auto']}
            tickFormatter={formatLargeNumber}
            stroke="#9ca3af"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              fill: '#6b7280'
            }}
            tickLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
            axisLine={{ stroke: '#d1d5db', strokeWidth: 1.5 }}
            width={85}
            tick={{ fill: '#6b7280' }}
          />

          {/* Custom premium tooltip */}
          <Tooltip content={(p) => <CustomTooltip {...(p as object)} seriesLabels={seriesLabels} />} />

          {/* Custom legend: all series always shown; click to disable/enable on chart */}
          <Legend
            content={() => (
              <CustomLegend
                items={teamNames.map((name, i) => ({
                  dataKey: name,
                  label: seriesLabels[name] ?? name,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                }))}
                hiddenSeries={hiddenSeries}
                onToggle={toggleSeries}
              />
            )}
          />

          {/* Bold, high-contrast lines with smooth curves (only visible series) */}
          {teamNames.filter((team) => !hiddenSeries.has(team)).map((team) => {
            const index = teamNames.indexOf(team);
            const color = CHART_COLORS[index % CHART_COLORS.length];
            return (
              <Line
                key={team}
                type="monotone"
                dataKey={team}
                stroke={color}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={{
                  r: 5,
                  fill: color,
                  strokeWidth: 2.5,
                  stroke: '#ffffff',
                  className: 'drop-shadow-md transition-all duration-200'
                }}
                activeDot={{
                  r: 9,
                  fill: color,
                  strokeWidth: 5,
                  stroke: '#ffffff',
                  className: 'drop-shadow-2xl cursor-pointer animate-pulse'
                }}
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
