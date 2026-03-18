/**
 * Cost Centers Component
 * Create cost centers and assign projects (via checkboxes) with allocation % for billing.
 * Includes "Projects in scope" table and cost center recap with project list and Total LOC roll-up.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import {
  useCostCenters,
  useCostCenterAssignments,
  useSaveCostCenter,
  useDeleteCostCenter,
  useSaveCostCenterAssignment,
  useDeleteCostCenterAssignment,
} from '../../hooks/useBilling';
import { useProjects, type ProjectWithOrganization } from '../../hooks/useSonarCloudData';
import { useProjectsRealData } from '../../hooks/useProjectsRealData';
import { getTagMappings, migrateTagMappingsToCostCenters, getAuthConfig } from '../../services/db';
import SonarCloudService from '../../services/sonarcloud';
import ProjectList from '../Portfolio/ProjectList';
import type { CostCenter } from '../../types/billing';

interface CostCentersProps {
  readonly organization?: string;
  readonly onProjectsSelected?: (projectKeys: string[]) => void;
  /** When provided (multi-org), use this list instead of useProjects(organization). Organization column is shown. */
  readonly projectsWithOrg?: ProjectWithOrganization[];
}

export default function CostCenters({ organization, onProjectsSelected, projectsWithOrg }: Readonly<CostCentersProps>) {
  const queryClient = useQueryClient();
  const migrationDone = useRef(false);

  const { data: costCenters = [], isLoading: loadingCC } = useCostCenters();
  const { data: allAssignments = [], isLoading: loadingAssignments } = useCostCenterAssignments();

  const projectOnlyAssignments = useMemo(
    () => allAssignments.filter((a) => a.type === 'project'),
    [allAssignments]
  );

  const selectedProjectKeys = useMemo(
    () => [...new Set(projectOnlyAssignments.map((a) => a.projectKey).filter(Boolean))] as string[],
    [projectOnlyAssignments]
  );

  useEffect(() => {
    onProjectsSelected?.(selectedProjectKeys);
  }, [selectedProjectKeys, onProjectsSelected]);

  const { projects: projectsWithNcloc = [] } = useProjectsRealData(selectedProjectKeys);

  useEffect(() => {
    if (migrationDone.current || costCenters.length > 0) return;
    migrationDone.current = true;
    getTagMappings().then((mappings) => {
      if (mappings.length > 0) {
        migrateTagMappingsToCostCenters().then(() => {
          queryClient.invalidateQueries({ queryKey: ['costCenters'] });
          queryClient.invalidateQueries({ queryKey: ['costCenterAssignments'] });
        });
      }
    });
  }, [costCenters.length, queryClient]);
  const saveCC = useSaveCostCenter();
  const deleteCC = useDeleteCostCenter();
  const saveAssignment = useSaveCostCenterAssignment();
  const deleteAssignment = useDeleteCostCenterAssignment();

  const { data: projectsDataFromApi } = useProjects({
    organization: projectsWithOrg == null ? organization || undefined : undefined,
    ps: 100,
  });
  const projects = projectsWithOrg ?? projectsDataFromApi?.components ?? [];

  const privateProjects = useMemo(
    () => projects.filter((p) => p.visibility === 'private'),
    [projects]
  );

  const projectsForAllocation = useMemo(() => {
    const byKey = new Map(
      projectsWithNcloc.map((p) => {
        const fromList = privateProjects.find((pr) => pr.key === p.key);
        const tags = fromList?.tags?.length ? fromList.tags : (p.tags ?? []);
        return [p.key, { key: p.key, ncloc: p.ncloc, tags }] as const;
      })
    );
    return selectedProjectKeys.map((key) => {
      const existing = byKey.get(key);
      if (existing) return existing;
      const fromList = privateProjects.find((pr) => pr.key === key);
      return { key, ncloc: 0, tags: fromList?.tags ?? [] };
    });
  }, [selectedProjectKeys, projectsWithNcloc, privateProjects]);

  const projectLocQueries = useQueries({
    queries: selectedProjectKeys.map((key) => ({
      queryKey: ['projectLOC', key],
      queryFn: async () => {
        const auth = await getAuthConfig();
        if (!auth) return null;
        const service = new SonarCloudService({
          baseUrl: auth.baseUrl,
          token: auth.token,
          organization: auth.organization,
          enterpriseKey: auth.enterpriseKey,
        });
        const response = await service.getComponentMeasures({
          component: key,
          metricKeys: ['ncloc'],
        });
        const nclocMeasure = response.component.measures?.find((m) => m.metric === 'ncloc');
        return { key, ncloc: nclocMeasure ? Number.parseInt(nclocMeasure.value || '0', 10) : 0 };
      },
      enabled: !!key,
    })),
  });

  const projectNclocByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projectsForAllocation) {
      if (p.ncloc > 0) map.set(p.key, p.ncloc);
    }
    for (const q of projectLocQueries) {
      if (q.data) map.set(q.data.key, q.data.ncloc);
    }
    for (const key of selectedProjectKeys) {
      if (!map.has(key)) map.set(key, 0);
    }
    return map;
  }, [projectsForAllocation, projectLocQueries, selectedProjectKeys]);

  const locSummary = useMemo(() => {
    const byCostCenter = new Map<string, number>();
    for (const cc of costCenters) {
      byCostCenter.set(cc.id, 0);
    }
    for (const a of projectOnlyAssignments) {
      if (!a.costCenterId || !a.projectKey) continue;
      const ncloc = projectNclocByKey.get(a.projectKey) ?? 0;
      const pct = Math.min(100, Math.max(0, a.allocationPercentage ?? 0));
      const contribution = (ncloc * pct) / 100;
      byCostCenter.set(
        a.costCenterId,
        (byCostCenter.get(a.costCenterId) ?? 0) + contribution
      );
    }
    return {
      byAssignment: new Map<string, number>() as Map<string, number>,
      byCostCenter,
    };
  }, [costCenters, projectOnlyAssignments, projectNclocByKey]);

  const [showAddCC, setShowAddCC] = useState(false);
  const [newCC, setNewCC] = useState({ name: '', code: '' });
  const [editingCC, setEditingCC] = useState<CostCenter | null>(null);
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bulkSuccessMessage) return;
    const t = setTimeout(() => setBulkSuccessMessage(null), 5000);
    return () => clearTimeout(t);
  }, [bulkSuccessMessage]);

  const handleSaveCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCC) {
      await saveCC.mutateAsync(editingCC);
      setEditingCC(null);
    } else if (newCC.name.trim()) {
      await saveCC.mutateAsync({ name: newCC.name.trim(), code: newCC.code.trim() || undefined });
      setNewCC({ name: '', code: '' });
      setShowAddCC(false);
    }
  };

  const handleDeleteCostCenter = async (cc: CostCenter) => {
    if (confirm(`Delete cost center "${cc.name}" and all its assignments?`)) {
      await deleteCC.mutateAsync(cc.id);
    }
  };

  const handleSaveProjectAssignment = useCallback(
    async (projectKey: string, costCenterId: string, allocationPercentage: number) => {
      const pct = Math.min(100, Math.max(0, allocationPercentage));
      const existing = allAssignments.find(
        (a) => a.type === 'project' && a.projectKey === projectKey && a.costCenterId === costCenterId
      );
      if (existing) {
        await saveAssignment.mutateAsync({ ...existing, allocationPercentage: pct });
        return;
      }
      const projectAssignments = allAssignments.filter(
        (a) => a.type === 'project' && a.projectKey === projectKey
      );
      const n = projectAssignments.length + 1;
      const base = Math.floor(100 / n);
      const remainder = 100 - base * n;
      const distributed = (i: number) => base + (i < remainder ? 1 : 0);
      for (let i = 0; i < projectAssignments.length; i++) {
        const a = projectAssignments[i];
        await saveAssignment.mutateAsync({ ...a, allocationPercentage: distributed(i) });
      }
      await saveAssignment.mutateAsync({
        costCenterId,
        type: 'project',
        projectKey,
        allocationPercentage: distributed(projectAssignments.length),
      });
    },
    [allAssignments, saveAssignment]
  );

  const handleClearProjectAssignment = useCallback(
    async (projectKey: string, costCenterId?: string) => {
      const toRemove = allAssignments.filter(
        (x) => x.type === 'project' && x.projectKey === projectKey && (costCenterId == null || x.costCenterId === costCenterId)
      );
      for (const a of toRemove) {
        await deleteAssignment.mutateAsync(a.id);
      }
      if (costCenterId == null || toRemove.length === 0) return;
      const remaining = allAssignments.filter(
        (x) => x.type === 'project' && x.projectKey === projectKey && x.costCenterId !== costCenterId
      );
      if (remaining.length === 0) return;
      const n = remaining.length;
      const base = Math.floor(100 / n);
      const remainder = 100 - base * n;
      for (let i = 0; i < remaining.length; i++) {
        const a = remaining[i];
        await saveAssignment.mutateAsync({
          ...a,
          allocationPercentage: base + (i < remainder ? 1 : 0),
        });
      }
    },
    [allAssignments, deleteAssignment, saveAssignment]
  );

  const handleBulkAssign = useCallback(
    async (
      projectKeys: string[],
      assignments: Array<{ costCenterId: string; allocationPercentage: number }>,
      replaceExisting: boolean
    ) => {
      if (assignments.length === 0) return;
      for (const projectKey of projectKeys) {
        if (replaceExisting) {
          const matches = allAssignments.filter(
            (a) => a.type === 'project' && a.projectKey === projectKey
          );
          for (const a of matches) {
            await deleteAssignment.mutateAsync(a.id);
          }
        }
        for (const { costCenterId, allocationPercentage } of assignments) {
          const pct = Math.min(100, Math.max(0, allocationPercentage));
          const existing = allAssignments.find(
            (a) => a.type === 'project' && a.projectKey === projectKey && a.costCenterId === costCenterId
          );
          if (existing) {
            await saveAssignment.mutateAsync({ ...existing, allocationPercentage: pct });
          } else {
            await saveAssignment.mutateAsync({
              costCenterId,
              type: 'project',
              projectKey,
              allocationPercentage: pct,
            });
          }
        }
      }
    },
    [allAssignments, saveAssignment, deleteAssignment]
  );

  if (loadingCC || loadingAssignments) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-600 dark:text-slate-300">Loading cost centers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-sonar-purple dark:text-white mb-2">Projects in scope &amp; assignments</h2>
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">
          Assign projects to cost centers; assigned projects define scope and LOC roll-up.
        </p>
        {bulkSuccessMessage && (
          <output
            aria-live="polite"
            className="block mb-4 p-3 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-600 rounded text-sm text-gray-800 dark:text-gray-200 font-body"
          >
            {bulkSuccessMessage}
          </output>
        )}
        <ProjectList
          organization={organization}
          projectsWithOrg={projectsWithOrg}
          onProjectsSelected={() => {}}
          selectedProjectKeys={selectedProjectKeys}
          costCenters={costCenters}
          assignments={allAssignments}
          onSaveProjectAssignment={handleSaveProjectAssignment}
          onClearProjectAssignment={handleClearProjectAssignment}
          onBulkAssign={handleBulkAssign}
          onBulkActionSuccess={setBulkSuccessMessage}
        />

        <div className="flex justify-between items-center mb-4 mt-8">
          <h2 className="text-2xl font-bold text-sonar-purple dark:text-white">Cost center recap</h2>
          <button
            type="button"
            onClick={() => setShowAddCC(true)}
            className="btn-sonar-accent px-4 py-2 rounded-lg"
          >
            Add cost center
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-3">
          Assign projects above with the checkboxes. Total LOC below rolls up from those project assignments.
        </p>

        {showAddCC && (
          <form onSubmit={handleSaveCostCenter} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cost-center-name" className="block text-sm font-medium mb-1 text-sonar-purple dark:text-white">Name</label>
                <input
                  id="cost-center-name"
                  type="text"
                  value={newCC.name}
                  onChange={(e) => setNewCC((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                  required
                  placeholder="e.g. Engineering Team A"
                />
              </div>
              <div>
                <label htmlFor="cost-center-code" className="block text-sm font-medium mb-1 text-sonar-purple dark:text-white">Code (optional)</label>
                <input
                  id="cost-center-code"
                  type="text"
                  value={newCC.code}
                  onChange={(e) => setNewCC((prev) => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                  placeholder="e.g. CC-001"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="btn-sonar-primary px-4 py-2 rounded-lg">Save</button>
              <button type="button" onClick={() => { setShowAddCC(false); setNewCC({ name: '', code: '' }); }} className="btn-sonar-outline px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </form>
        )}

        {costCenters.length > 0 ? (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Cost center</th>
                  <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Projects</th>
                  <th className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">Total LOC (roll-up)</th>
                  <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {costCenters.map((cc) => {
                  const totalLoc = Math.round(locSummary.byCostCenter.get(cc.id) ?? 0);
                  const ccProjectAssignments = projectOnlyAssignments.filter((a) => a.costCenterId === cc.id);
                  const projectNames = ccProjectAssignments.map((a) => {
                    const proj = privateProjects.find((p) => p.key === a.projectKey) ?? projectsWithNcloc.find((p) => p.key === a.projectKey);
                    return proj?.name ?? a.projectKey;
                  });
                  return (
                    <tr key={cc.id} className="border-t dark:border-gray-600">
                      <td className="px-3 py-2">
                        {editingCC?.id === cc.id ? (
                          <form onSubmit={(e) => { handleSaveCostCenter(e); setEditingCC(null); }} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingCC.name}
                              onChange={(e) => setEditingCC((p) => (p ? { ...p, name: e.target.value } : null))}
                              className="px-2 py-1 border rounded dark:bg-gray-600 dark:text-white w-40"
                              required
                            />
                            <input
                              type="text"
                              value={editingCC.code ?? ''}
                              onChange={(e) => setEditingCC((p) => (p ? { ...p, code: e.target.value } : null))}
                              className="px-2 py-1 border rounded dark:bg-gray-600 dark:text-white w-20"
                              placeholder="Code"
                            />
                            <button type="submit" className="btn-sonar-primary px-2 py-1 rounded text-sm">Save</button>
                            <button type="button" onClick={() => setEditingCC(null)} className="btn-sonar-outline px-2 py-1 rounded text-sm">Cancel</button>
                          </form>
                        ) : (
                          <span className="font-medium text-gray-900 dark:text-white">{cc.name}{cc.code ? ` (${cc.code})` : ''}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[200px]">
                        {projectNames.length > 0 ? (
                          <ul className="text-xs list-disc list-inside max-h-24 overflow-y-auto">
                            {projectNames.map((name, i) => (
                              <li key={`${ccProjectAssignments[i]?.projectKey ?? i}`} className="truncate" title={name}>{name}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-600 dark:text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">
                        {totalLoc.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {editingCC?.id !== cc.id && (
                          <>
                            <button type="button" onClick={() => setEditingCC(cc)} className="text-sonar-blue hover:text-sonar-blue-secondary hover:underline text-sm mr-2 font-body">Edit</button>
                            <button type="button" onClick={() => handleDeleteCostCenter(cc)} className="text-red-600 dark:text-red-400 hover:underline text-sm font-body">Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !showAddCC && (
            <p className="py-4 text-gray-600 dark:text-slate-300 text-sm">Create a cost center, then assign projects in the table above using the checkboxes.</p>
          )
        )}
      </div>
    </div>
  );
}
