/**
 * Billing Configuration Component
 * Allows users to configure their SonarCloud plan details manually
 * (Billing API requires browser session auth, not accessible with API tokens)
 */

import { useState, useEffect } from 'react';

interface BillingPlan {
  locLimit: number;
  locUsed: number;
  planName: string;
  addOns: string[];
}

interface BillingConfigProps {
  onConfigChange?: (config: BillingPlan) => void;
}

const DEFAULT_CONFIG: BillingPlan = {
  locLimit: 100000,
  locUsed: 0,
  planName: 'Free Plan',
  addOns: [],
};

const STORAGE_KEY = 'sonarcloud-billing-config';

function parseStoredConfig(saved: string): BillingPlan {
  const parsed = JSON.parse(saved) as BillingPlan;
  return {
    locLimit: Number(parsed?.locLimit) || DEFAULT_CONFIG.locLimit,
    locUsed: Number(parsed?.locUsed) || DEFAULT_CONFIG.locUsed,
    planName: String(parsed?.planName ?? DEFAULT_CONFIG.planName),
    addOns: Array.isArray(parsed?.addOns) ? parsed.addOns.map(String) : DEFAULT_CONFIG.addOns,
  };
}

export default function BillingConfig({ onConfigChange }: BillingConfigProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [config, setConfig] = useState<BillingPlan>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseStoredConfig(saved) : DEFAULT_CONFIG;
  });

  useEffect(() => {
    onConfigChange?.(config);
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    onConfigChange?.(config);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setConfig(parseStoredConfig(saved));
    }
    setIsEditing(false);
  };

  const addAddOn = () => {
    const newAddOn = prompt('Enter add-on name (e.g., "Security Analysis", "Pull Request Decoration"):');
    if (newAddOn?.trim()) {
      setConfig(prev => ({
        ...prev,
        addOns: [...prev.addOns, newAddOn.trim()],
      }));
    }
  };

  const removeAddOn = (index: number) => {
    setConfig(prev => ({
      ...prev,
      addOns: prev.addOns.filter((_, i) => i !== index),
    }));
  };

  if (!isEditing) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl border-2 border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Billing Plan Configuration
          </h3>
          <button
            onClick={() => setIsEditing(true)}
            className="btn-sonar-primary px-3 py-1.5 text-sm rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Edit
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-sonar-purple dark:text-white uppercase tracking-wide mb-1">
              Plan
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {config.planName}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-sonar-purple dark:text-white uppercase tracking-wide mb-1">
              LOC Allowance
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
              {config.locLimit.toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-sonar-purple dark:text-white uppercase tracking-wide mb-1">
              Active Add-ons
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {config.addOns.length}
            </p>
          </div>
        </div>

        {config.addOns.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-sonar-purple dark:text-white uppercase tracking-wide mb-2">
              Add-ons
            </p>
            <div className="flex flex-wrap gap-2">
              {config.addOns.map((addOn, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-sonar-blue/10 text-sonar-blue text-sm font-medium rounded-full"
                >
                  {addOn}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-600 dark:text-slate-300">
          ℹ️ Billing API requires browser session auth. Configure your plan details manually.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-2 border-sonar-blue p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Edit Billing Configuration
      </h3>

      <div className="space-y-4">
        {/* Plan Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">
            Plan Name
          </label>
          <input
            type="text"
            value={config.planName}
            onChange={(e) => setConfig(prev => ({ ...prev, planName: e.target.value }))}
            className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sonar-blue focus:border-sonar-blue dark:bg-gray-700 dark:text-white"
            placeholder="e.g., Team Plan, Enterprise"
          />
        </div>

        {/* LOC Limit */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">
            LOC Allowance Limit
          </label>
          <input
            type="number"
            value={config.locLimit}
            onChange={(e) => setConfig(prev => ({ ...prev, locLimit: parseInt(e.target.value) || 0 }))}
            className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sonar-blue focus:border-sonar-blue dark:bg-gray-700 dark:text-white"
            placeholder="e.g., 100000"
          />
          <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">
            Maximum lines of code allowed in your plan
          </p>
        </div>

        {/* Add-ons */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">
            Active Add-ons
          </label>
          <div className="space-y-2">
            {config.addOns.map((addOn, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                  {addOn}
                </span>
                <button
                  onClick={() => removeAddOn(index)}
                  className="btn-sonar-danger px-3 py-2 rounded-lg text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={addAddOn}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:border-sonar-blue hover:text-sonar-blue transition-colors"
            >
              + Add Add-on
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSave}
          className="btn-sonar-primary flex-1 px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
        >
          Save Configuration
        </button>
        <button
          onClick={handleCancel}
          className="btn-sonar-outline px-4 py-2 rounded-lg font-semibold transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export { type BillingPlan };
