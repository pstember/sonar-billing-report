/**
 * Progress bar for dashboard data loading. Shows completed/total API calls
 * and a nested list of pending/active calls. Category sections auto-collapse when all their requests are done.
 */

import { useState, useEffect } from 'react';
import { useDashboardLoadProgress } from '../../hooks/useDashboardLoadProgress';
import type { LoadProgressCategory, LoadProgressItem } from '../../hooks/useDashboardLoadProgress';

const CATEGORY_LABELS: Record<LoadProgressCategory, string> = {
  enterprise: 'Enterprise',
  billing: 'Billing',
  projects: 'Projects',
  other: 'Other',
};

function ItemStatus({ item }: { readonly item: LoadProgressItem }) {
  if (item.status === 'success') return <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>✓</span>;
  if (item.status === 'error') return <span className="text-red-500 dark:text-red-400" aria-hidden>✗</span>;
  if (item.fetchStatus === 'fetching') return <span className="inline-block load-progress-spinner" aria-hidden />;
  /* Pending: same 3/4 arc spinner, grey so you can tell waiting vs in-progress */
  return <span className="inline-block load-progress-spinner load-progress-spinner--pending" aria-hidden />;
}

function ItemWithSubCalls({ item, itemKey }: { readonly item: LoadProgressItem; readonly itemKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const hasSubCalls = item.subCalls.length > 0;
  const n = item.subCalls.length;
  let toggleLabel: string;
  if (expanded) toggleLabel = 'Hide sub-calls';
  else if (n === 1) toggleLabel = 'Show 1 sub-call';
  else toggleLabel = `Show ${n} sub-calls`;

  return (
    <li className="text-xs">
      <div className="flex items-center gap-2 text-gray-600 dark:text-slate-300 flex-wrap">
        <ItemStatus item={item} />
        <span className={item.status === 'error' ? 'text-red-600 dark:text-red-400' : undefined}>{item.label}</span>
        <span className="text-gray-400 dark:text-slate-500 font-normal">— {item.description}</span>
        {hasSubCalls && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] text-sonar-blue dark:text-sonar-blue hover:underline focus:outline-none focus:ring-1 focus:ring-sonar-blue rounded"
            aria-expanded={expanded}
            aria-controls={`subcalls-${itemKey}`}
          >
            {toggleLabel}
          </button>
        )}
      </div>
      {hasSubCalls && expanded && (
        <ul id={`subcalls-${itemKey}`} className="mt-1 ml-5 space-y-0.5 border-l border-gray-200 dark:border-slate-600 pl-2">
          {item.subCalls.map((sub) => (
            <li key={sub.label} className="text-[11px] text-gray-500 dark:text-slate-400 font-mono break-all" title={sub.label}>
              {sub.label}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function isItemFullyComplete(item: LoadProgressItem): boolean {
  return (item.status === 'success' || item.status === 'error') && item.fetchStatus !== 'fetching';
}

function Group({
  category,
  items,
}: {
  readonly category: LoadProgressCategory;
  readonly items: LoadProgressItem[];
}) {
  const [expanded, setExpanded] = useState(true);
  const completedInCategory = items.filter((i) => i.status === 'success' || i.status === 'error').length;
  const totalInCategory = items.length;
  const allCompleted = items.length > 0 && items.every(isItemFullyComplete);

  useEffect(() => {
    if (allCompleted) setExpanded(false);
  }, [allCompleted]);

  const subtotalLabel = `${completedInCategory} / ${totalInCategory}`;

  return (
    <li className="mt-1.5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 w-full text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-slate-300 focus:outline-none focus:ring-1 focus:ring-sonar-blue rounded py-0.5"
        aria-expanded={expanded}
        aria-controls={`category-${category}`}
      >
        <span
          className={`inline-block transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
          aria-hidden
        >
          ▸
        </span>
        <span>{CATEGORY_LABELS[category]}</span>
        <span className="tabular-nums text-[11px] font-normal normal-case ml-auto">{subtotalLabel}</span>
      </button>
      {expanded && (
        <ul id={`category-${category}`} className="mt-0.5 ml-3 space-y-1.5">
          {items.map((item, i) => (
            <ItemWithSubCalls key={`${category}-${item.label}-${i}`} item={item} itemKey={`${category}-${item.label}-${i}`} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function LoadProgressBar() {
  const { completed, total, percent, isComplete, items, fetching } = useDashboardLoadProgress();
  const [showDetails, setShowDetails] = useState(false);

  if (total === 0 || isComplete) return null;

  const byCategory: Record<LoadProgressCategory, LoadProgressItem[]> = { enterprise: [], billing: [], projects: [], other: [] };
  for (const item of items) byCategory[item.category].push(item);
  const order: LoadProgressCategory[] = ['enterprise', 'billing', 'projects', 'other'];

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-600 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center gap-3 mb-2">
          <progress
            value={percent}
            max={100}
            className="sr-only"
            aria-label={`Dashboard data: ${completed} of ${total} requests`}
          />
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-sonar-blue dark:bg-sonar-blue load-progress-bar-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-slate-300 tabular-nums shrink-0">
            {completed} / {total}
            {fetching > 0 && (
              <span className="text-gray-500 dark:text-slate-400 font-normal ml-1">
                ({fetching} fetching)
              </span>
            )}
          </span>
          {items.length > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-sonar-blue hover:underline shrink-0"
            >
              {showDetails ? 'Hide' : 'Show'} details
            </button>
          )}
        </div>
        {!showDetails && (
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Only the &quot;fetching&quot; count are actual network requests; the rest are from cache.
          </p>
        )}
        {showDetails && items.length > 0 && (
          <>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Only the &quot;fetching&quot; count are actual network requests; the rest are from cache.
            </p>
            <ul className="mt-2 space-y-0 border-t border-gray-100 dark:border-slate-700 pt-2">
              {order.filter((c) => byCategory[c]?.length).map((category) => (
                <Group key={category} category={category} items={byCategory[category]} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
