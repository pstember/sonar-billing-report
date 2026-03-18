/**
 * Cost Calculator Component
 * Configure contract value (license cost); indicative price per 1k LOC is derived from scope.
 */

import { useState, useEffect } from 'react';
import { useBillingConfig, useSaveBillingConfig } from '../../hooks/useBilling';
import type { BillingConfiguration } from '../../types/billing';
import { getPricePer1kFromPlan, formatCurrencyParts } from '../../utils/costCalculations';

interface CostCalculatorProps {
  /** Plan allowance (total LOC in license) from billing API. Used for price per 1k LOC indication. */
  readonly planAllowanceLOC?: number;
}

export default function CostCalculator({ planAllowanceLOC }: CostCalculatorProps) {
  const { data: config, isLoading } = useBillingConfig();
  const saveConfig = useSaveBillingConfig();

  const [editing, setEditing] = useState(false);
  const [showUsageDetails, setShowUsageDetails] = useState(false);
  const [formData, setFormData] = useState<BillingConfiguration>(
    config ?? {
      contractValue: undefined,
      defaultRate: 10,
      currency: 'USD',
      languageRates: {},
    }
  );

  // Sync config prop into local form when it changes (e.g. after load)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop-to-state sync
    if (config) setFormData(config);
  }, [config]);

  const handleSave = async () => {
    await saveConfig.mutateAsync(formData);
    setEditing(false);
  };

  const pricePer1kFromPlan = planAllowanceLOC != null && planAllowanceLOC > 0 && formData.contractValue != null && formData.contractValue > 0
    ? getPricePer1kFromPlan(formData, planAllowanceLOC)
    : null;
  const hasContractValue = formData.contractValue !== null && formData.contractValue !== undefined;
  const hasPricePer1kFromPlan = pricePer1kFromPlan !== null && pricePer1kFromPlan !== undefined;

  if (isLoading) return <div>Loading billing configuration...</div>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 border border-gray-100 dark:border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-sonar-purple dark:text-white">Cost Configuration</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="btn-sonar-accent px-4 py-2 rounded-lg"
          >
            Edit Configuration
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="contract-value" className="block text-sm font-medium mb-1 text-sonar-purple dark:text-white">Contract value (total license cost)</label>
            <div className="flex gap-2">
              <input
                id="contract-value"
                type="number"
                step="0.01"
                min="0"
                value={formData.contractValue ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  contractValue: e.target.value === '' ? undefined : Number(e.target.value),
                })}
                placeholder="e.g. 10000"
                className="flex-1 px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
              />
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
              Known figure from your license. Used to allocate cost by Consumed LOC share and to derive an indicative rate from Contract value.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void handleSave()}
              className="btn-sonar-primary px-4 py-2 rounded-lg"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="btn-sonar-outline px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600 dark:text-slate-300">Contract value</span>
              <p className="text-2xl font-bold text-sonar-purple dark:text-white tabular-nums">
                {hasContractValue ? (() => {
                  const p = formatCurrencyParts(Number(formData.contractValue), formData.currency);
                  return <>{p.symbol}{p.whole}{p.decimal ? <span className="text-[0.7em] opacity-90">.{p.decimal}</span> : null}</>;
                })() : '—'}
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-300">Total license cost</p>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-slate-300">Price per 1k LOC (from plan)</span>
              <p className="text-2xl font-bold text-sonar-purple dark:text-white tabular-nums">
                {hasPricePer1kFromPlan ? (() => {
                  const p = formatCurrencyParts(pricePer1kFromPlan, formData.currency, 4);
                  return <>{p.symbol}{p.whole}{p.decimal ? <span className="text-[0.7em] opacity-90">.{p.decimal}</span> : null}</>;
                })() : '—'}
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                {planAllowanceLOC != null && planAllowanceLOC > 0 && formData.contractValue != null && formData.contractValue > 0
                  ? `Contract value ÷ ${(planAllowanceLOC / 1000).toLocaleString()}k LOC (plan allowance from Billing API)`
                  : 'Set Contract value; plan allowance comes from the Plan Usage card (Billing API)'}
              </p>
            </div>
          </div>

          {(formData.contractValue != null && formData.contractValue > 0) && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-slate-50">How cost is applied</h3>
                  <p className="text-xs text-gray-700 dark:text-slate-300">
                    Shows how Contract value is split into project share and rate-based cost.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUsageDetails((prev) => !prev)}
                  className="text-sm font-semibold text-sonar-purple dark:text-sky-300 hover:underline"
                >
                  {showUsageDetails ? 'Hide details' : 'Show details'}
                </button>
              </div>

              {showUsageDetails && (
                <div className="mt-4 space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-slate-50 mb-1.5">License share (per project)</p>
                    <p className="text-gray-700 dark:text-slate-300 mb-2">
                      Allocates Contract value to a project using its share of Consumed LOC over Contracted LOC.
                    </p>
                    <div className="font-mono text-gray-900 dark:text-slate-100 bg-white/60 dark:bg-slate-800/80 rounded-lg px-4 py-3 border border-blue-100 dark:border-slate-600">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="text-gray-700 dark:text-slate-200 font-medium">Share</span>
                        <span className="text-sonar-purple dark:text-sky-300 font-semibold">=</span>
                        <span className="inline-flex flex-col items-center min-w-[6rem]">
                          <span className="text-center text-gray-800 dark:text-slate-100">Consumed LOC</span>
                          <span className="block w-full h-0 border-b-2 border-gray-400 dark:border-slate-400 my-0.5" />
                          <span className="text-center text-gray-700 dark:text-slate-200">Contracted LOC</span>
                        </span>
                        <span className="text-sonar-purple dark:text-sky-300 font-semibold">×</span>
                        <span className="text-gray-800 dark:text-slate-100">Contract value</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 dark:text-slate-50 mb-1.5">Cost rate-based (per project)</p>
                    <p className="text-gray-700 dark:text-slate-300 mb-2">
                      Pro-rated cost for a project’s Allocated LOC, using Contract value and total Consumed LOC.
                    </p>
                    <div className="font-mono text-gray-900 dark:text-slate-100 bg-white/60 dark:bg-slate-800/80 rounded-lg px-4 py-3 border border-blue-100 dark:border-slate-600">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="text-gray-700 dark:text-slate-200 font-medium">Cost</span>
                        <span className="text-sonar-purple dark:text-sky-300 font-semibold">=</span>
                        <span className="inline-flex flex-col items-center min-w-[6rem]">
                          <span className="text-center text-gray-800 dark:text-slate-100">Allocated LOC</span>
                          <span className="block w-full h-0 border-b-2 border-gray-400 dark:border-slate-400 my-0.5" />
                          <span className="text-center text-gray-700 dark:text-slate-200">Consumed LOC</span>
                        </span>
                        <span className="text-sonar-purple dark:text-sky-300 font-semibold">×</span>
                        <span className="text-gray-800 dark:text-slate-100">Contract value</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
