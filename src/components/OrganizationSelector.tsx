/**
 * Organization Selector Component
 * Allows switching between organizations in an enterprise (single or multi-select)
 */

import { useEnterpriseOrganizations, type SelectedOrganization } from '../hooks/useBillingData';
import { saveSetting, getSetting } from '../services/db';
import { useEffect, useState, useCallback } from 'react';

export type { SelectedOrganization } from '../hooks/useBillingData';

interface OrganizationSelectorPropsSingle {
  multiSelect?: false;
  onOrganizationChange: (organization: SelectedOrganization) => void;
  selectedOrganizations?: never;
  onOrganizationsChange?: never;
}

interface OrganizationSelectorPropsMulti {
  multiSelect: true;
  selectedOrganizations: SelectedOrganization[];
  onOrganizationsChange: (organizations: SelectedOrganization[]) => void;
  onOrganizationChange?: never;
}

type OrganizationSelectorProps = OrganizationSelectorPropsSingle | OrganizationSelectorPropsMulti;

export default function OrganizationSelector(props: OrganizationSelectorProps) {
  const { multiSelect = false } = props;
  const { data, isLoading, error } = useEnterpriseOrganizations();
  const organizations = data?.organizations ?? [];
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedKeysMulti, setSelectedKeysMulti] = useState<Set<string>>(new Set());

  // Single-select: load saved organization on mount
  useEffect(() => {
    if (multiSelect) return;
    const onOrganizationChange = (props as OrganizationSelectorPropsSingle).onOrganizationChange;
    const loadSavedOrg = async () => {
      if (!organizations || organizations.length === 0) return;

      const saved = await getSetting<string>('selectedOrganization');
      if (saved) {
        const org = organizations.find(org => org.key === saved);
        if (org) {
          setSelectedOrg(saved);
          onOrganizationChange({ key: org.key, name: org.name, uuid: org.uuid });
          return;
        }
      }

      const firstOrg = organizations[0];
      setSelectedOrg(firstOrg.key);
      onOrganizationChange({ key: firstOrg.key, name: firstOrg.name, uuid: firstOrg.uuid });
    };
    void loadSavedOrg();
  }, [organizations, multiSelect]);

  // Multi-select: sync from controlled value
  useEffect(() => {
    if (!multiSelect) return;
    const selected = (props as OrganizationSelectorPropsMulti).selectedOrganizations ?? [];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync controlled value to internal set
    setSelectedKeysMulti(new Set(selected.map((o) => o.key)));
  }, [multiSelect, (props as OrganizationSelectorPropsMulti).selectedOrganizations]);

  const handleChangeSingle = useCallback(
    async (orgKey: string) => {
      const org = organizations?.find(o => o.key === orgKey);
      if (!org || multiSelect) return;
      const onOrganizationChange = (props as OrganizationSelectorPropsSingle).onOrganizationChange;
      setSelectedOrg(orgKey);
      await saveSetting('selectedOrganization', orgKey);
      onOrganizationChange({ key: org.key, name: org.name, uuid: org.uuid });
    },
    [organizations, multiSelect, props]
  );

  const handleToggleMulti = useCallback(
    (org: SelectedOrganization, checked: boolean) => {
      if (!multiSelect) return;
      const { onOrganizationsChange } = props as OrganizationSelectorPropsMulti;
      const next = new Set(selectedKeysMulti);
      if (checked) next.add(org.key);
      else next.delete(org.key);
      setSelectedKeysMulti(next);
      const list = organizations?.filter((o) => next.has(o.key)) ?? [];
      onOrganizationsChange(list);
      void saveSetting('selectedOrganizations', list.map((o) => ({ key: o.key, name: o.name, uuid: o.uuid })));
    },
    [multiSelect, organizations, selectedKeysMulti, props]
  );

  if (error) {
    const message = error instanceof Error ? error.message : 'Failed to load organizations';
    let suggestion = 'Check your connection and try refreshing the page.';

    if (message.includes('401') || message.includes('403') || message.includes('Unauthorized')) {
      suggestion = 'Your token may have expired. Try logging out and reconnecting.';
    } else if (message.includes('Enterprise')) {
      suggestion = 'Verify your Enterprise Key in SonarCloud settings.';
    }

    return (
      <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-700">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-600 dark:text-red-400 font-body font-semibold">
            {message}
          </span>
        </div>
        <p className="text-xs text-red-600 dark:text-red-400 font-body ml-7 opacity-90">
          {suggestion}
        </p>
      </div>
    );
  }

  if (isLoading || !organizations) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sonar-blue"></div>
        <span className="text-sm text-gray-600 dark:text-slate-300 font-body">Loading organizations...</span>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
        <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-yellow-600 dark:text-yellow-400 font-body">No organizations found in enterprise</span>
      </div>
    );
  }

  // If only one organization and single mode, show it but don't make it a dropdown
  if (organizations.length === 1 && !multiSelect) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm">
        <svg className="w-5 h-5 text-sonar-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <div>
          <div className="text-xs font-medium text-sonar-purple dark:text-white uppercase tracking-wide">Organization</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">{organizations[0].name}</div>
        </div>
      </div>
    );
  }

  // Multi-select: list with checkboxes
  if (multiSelect) {
    return (
      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-sonar-blue/5 dark:bg-sonar-blue/10 border-r border-gray-300 dark:border-gray-600">
          <svg className="w-5 h-5 text-sonar-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-xs font-bold text-sonar-purple dark:text-white uppercase tracking-wide">Organizations</span>
        </div>
        <div className="flex-1 px-4 py-2 flex flex-wrap gap-3 items-center">
          {organizations.map((org) => (
            <label key={org.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedKeysMulti.has(org.key)}
                onChange={(e) => handleToggleMulti(org, e.target.checked)}
                className="rounded border-gray-400 text-sonar-blue focus:ring-sonar-blue"
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">{org.name}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-sonar-blue/5 dark:bg-sonar-blue/10 border-r border-gray-300 dark:border-gray-600">
        <svg className="w-5 h-5 text-sonar-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span className="text-xs font-bold text-sonar-purple dark:text-white uppercase tracking-wide">Organization</span>
      </div>
      <select
        value={selectedOrg}
        onChange={(e) => void handleChangeSingle(e.target.value)}
        className="flex-1 px-4 py-2 bg-transparent text-sm font-semibold text-gray-900 dark:text-white font-body focus:outline-none focus:ring-2 focus:ring-sonar-blue cursor-pointer"
      >
        {organizations.map((org) => (
          <option key={org.key} value={org.key}>
            {org.name} ({org.key})
          </option>
        ))}
      </select>
    </div>
  );
}
