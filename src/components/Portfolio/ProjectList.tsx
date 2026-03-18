/**
 * Project List Component
 * Display and select SonarCloud projects with real data.
 * Optional: controlled selection (selectedProjectKeys) and assignment columns (cost center + allocation %).
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useProjects, type ProjectWithOrganization } from '../../hooks/useSonarCloudData';
import { useQueries } from '@tanstack/react-query';
import SonarCloudService from '../../services/sonarcloud';
import { getAuthConfig } from '../../services/db';
import type { CostCenter, CostCenterAssignment } from '../../types/billing';

interface ProjectListProps {
  readonly onProjectsSelected: (projectKeys: string[]) => void;
  readonly onProjectsDataChange?: (projectsData: {key: string, ncloc: number, tags: string[]}[]) => void;
  readonly organization?: string;
  /** When provided, selection is controlled by parent (sync from prop and notify on change). */
  readonly selectedProjectKeys?: string[];
  /** When provided, each project row shows Cost center dropdown and Allocation %. */
  readonly costCenters?: CostCenter[];
  readonly assignments?: CostCenterAssignment[];
  readonly onSaveProjectAssignment?: (projectKey: string, costCenterId: string, allocationPercentage: number) => void;
  /** Clear one (projectKey, costCenterId) or all for project if costCenterId omitted */
  readonly onClearProjectAssignment?: (projectKey: string, costCenterId?: string) => void;
  /** Bulk assign all filtered projects to one or more cost centers (parent performs save/delete loop). Allocations per row; total should be 100%. */
  readonly onBulkAssign?: (
    projectKeys: string[],
    assignments: { costCenterId: string; allocationPercentage: number }[],
    replaceExisting: boolean
  ) => void | Promise<void>;
  /** Optional: show success message after a bulk action (e.g. toast). */
  readonly onBulkActionSuccess?: (message: string) => void;
  /** When provided (multi-org), use this list instead of useProjects(organization). Organization column is shown. */
  readonly projectsWithOrg?: ProjectWithOrganization[];
  /** When provided, LOC for these project keys is taken from this map and no projectLOC request is made for them. */
  readonly preferredNclocMap?: Record<string, number>;
}

export default function ProjectList({
  onProjectsSelected,
  onProjectsDataChange,
  organization,
  selectedProjectKeys: controlledSelection,
  costCenters,
  assignments = [],
  onSaveProjectAssignment,
  onClearProjectAssignment,
  onBulkAssign,
  onBulkActionSuccess,
  projectsWithOrg,
  preferredNclocMap,
}: ProjectListProps) {
  const { data: projectsDataFromApi, isLoading: projectsLoadingFromApi } = useProjects({
    organization: projectsWithOrg == null ? organization ?? undefined : undefined,
    ps: 100,
  });
  const projectsFromApi = projectsDataFromApi?.components ?? [];
  const projects = projectsWithOrg ?? projectsFromApi;
  const projectsLoading = projectsWithOrg != null ? false : projectsLoadingFromApi;
  const isAssignmentMode = Boolean(onSaveProjectAssignment != null);
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const selectedProjects = controlledSelection !== undefined && controlledSelection !== null
    ? new Set(controlledSelection)
    : internalSelected;
  const setSelectedProjects = useCallback((next: Set<string>) => {
    const keys = Array.from(next);
    if (controlledSelection === undefined || controlledSelection === null) setInternalSelected(next);
    onProjectsSelected(keys);
  }, [controlledSelection, onProjectsSelected]);

  useEffect(() => {
    if (controlledSelection !== undefined && controlledSelection !== null) {
      setInternalSelected(new Set(controlledSelection));
    }
  }, [controlledSelection]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  type SortColumn = 'project' | 'loc';
  type SortDir = 'asc' | 'desc';
  const [sortBy, setSortBy] = useState<SortColumn>('loc');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  interface BulkRow { id: string; costCenterId: string; allocationPercentage: number }
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkReplaceExisting, setBulkReplaceExisting] = useState(true);
  const [bulkInProgress, setBulkInProgress] = useState(false);


  // Derive available tags from private projects only
  // This ensures we only show tags that are actually present on private projects
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    projects.forEach(project => {
      // Only include tags from private projects
      if (project.visibility === 'private' && project.tags && project.tags.length > 0) {
        project.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  // Fetch LOC only for projects not in preferredNclocMap (avoids duplicate request when dashboard already has full data)
  const projectsNeedingLoc = useMemo(
    () =>
      preferredNclocMap
        ? projects.filter((p) => !(p.key in preferredNclocMap))
        : projects,
    [projects, preferredNclocMap]
  );

  const projectMeasuresQueries = useQueries({
    queries: projectsNeedingLoc.map((project) => ({
      queryKey: ['projectLOC', project.key],
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
          component: project.key,
          metricKeys: ['ncloc'],
        });

        const nclocMeasure = response.component.measures?.find(m => m.metric === 'ncloc');
        return {
          key: project.key,
          ncloc: nclocMeasure ? Number.parseInt(nclocMeasure.value ?? '0', 10) : 0,
        };
      },
      enabled: !!project.key,
    })),
  });

  // Create a map of project key to LOC (preferred map first, then query results)
  const projectLOCMap = useMemo(() => {
    const map = new Map<string, number>();
    if (preferredNclocMap) {
      Object.entries(preferredNclocMap).forEach(([key, ncloc]) => map.set(key, ncloc));
    }
    projectMeasuresQueries.forEach((query) => {
      if (query.data) {
        map.set(query.data.key, query.data.ncloc);
      }
    });
    return map;
  }, [preferredNclocMap, projectMeasuresQueries]);

  // Filter projects by visibility (private only), selected tags, and search query
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // ONLY show private projects (public projects don't count toward billing)
      const isPrivate = p.visibility === 'private';

      // Filter by selected tags (any tag matches)
      const tagMatch = selectedTags.size === 0 ||
        p.tags?.some(tag => selectedTags.has(tag));

      // Filter by search query
      const searchMatch = !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.key.toLowerCase().includes(searchQuery.toLowerCase());

      return isPrivate && tagMatch && searchMatch;
    });
  }, [projects, selectedTags, searchQuery]);

  const sortedProjects = useMemo(() => {
    const list = [...filteredProjects];
    const mult = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'loc') {
      list.sort((a, b) => {
        const locA = projectLOCMap.get(a.key) ?? 0;
        const locB = projectLOCMap.get(b.key) ?? 0;
        return mult * (locA - locB);
      });
    } else {
      list.sort((a, b) => mult * (a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.key.localeCompare(b.key)));
    }
    return list;
  }, [filteredProjects, projectLOCMap, sortBy, sortDir]);

  const handleSort = useCallback((column: SortColumn) => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'loc' ? 'desc' : 'asc');
    }
  }, [sortBy]);

  const getAssignmentForProjectAndCC = useCallback(
    (projectKey: string, costCenterId: string) =>
      assignments.find(
        (a) => a.type === 'project' && a.projectKey === projectKey && a.costCenterId === costCenterId
      ) ?? null,
    [assignments]
  );

  const projectAllocationTotalByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assignments) {
      if (a.type !== 'project' || !a.projectKey) continue;
      const pct = a.allocationPercentage ?? 0;
      map.set(a.projectKey, (map.get(a.projectKey) ?? 0) + pct);
    }
    return map;
  }, [assignments]);

  const nextBulkRowId = useRef(0);
  const handleOpenBulkModal = useCallback(() => {
    setBulkModalOpen(true);
    const firstId = costCenters?.length ? costCenters[0].id : '';
    nextBulkRowId.current += 1;
    setBulkRows(firstId ? [{ id: `bulk-row-${nextBulkRowId.current}`, costCenterId: firstId, allocationPercentage: 100 }] : []);
    setBulkReplaceExisting(true);
  }, [costCenters]);

  const handleCloseBulkModal = useCallback(() => {
    if (!bulkInProgress) setBulkModalOpen(false);
  }, [bulkInProgress]);

  const bulkTotalPct = useMemo(
    () => bulkRows.reduce((sum, r) => sum + Math.min(100, Math.max(0, r.allocationPercentage)), 0),
    [bulkRows]
  );
  const bulkIsValid = bulkRows.length > 0 && bulkRows.every((r) => r.costCenterId) && Math.round(bulkTotalPct) === 100;

  const remainingCostCenters = useMemo(
    () => (costCenters ?? []).filter((cc) => !bulkRows.some((r) => r.costCenterId === cc.id)),
    [costCenters, bulkRows]
  );

  const getCostCenterOptionsForRow = useCallback(
    (row: BulkRow) =>
      (costCenters ?? []).filter(
        (cc) => cc.id === row.costCenterId || !bulkRows.some((r) => r.id !== row.id && r.costCenterId === cc.id)
      ),
    [costCenters, bulkRows]
  );

  const handleAddBulkRow = useCallback(() => {
    const firstRemaining = remainingCostCenters[0];
    if (!firstRemaining) return;
    nextBulkRowId.current += 1;
    const newRow: BulkRow = {
      id: `bulk-row-${nextBulkRowId.current}`,
      costCenterId: firstRemaining.id,
      allocationPercentage: 0,
    };
    setBulkRows((prev) => {
      const next = [...prev, newRow];
      const n = next.length;
      const base = Math.floor(100 / n);
      const remainder = 100 - base * n;
      return next.map((row, i) => ({
        ...row,
        allocationPercentage: base + (i < remainder ? 1 : 0),
      }));
    });
  }, [remainingCostCenters]);

  const handleRemoveBulkRow = useCallback((id: string) => {
    setBulkRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      if (next.length === 0) return next;
      const n = next.length;
      const base = Math.floor(100 / n);
      const remainder = 100 - base * n;
      return next.map((row, i) => ({
        ...row,
        allocationPercentage: base + (i < remainder ? 1 : 0),
      }));
    });
  }, []);

  const handleUpdateBulkRow = useCallback((id: string, field: 'costCenterId' | 'allocationPercentage', value: string | number) => {
    setBulkRows((prev) =>
      prev.map((row) =>
        row.id !== id ? row : { ...row, [field]: field === 'allocationPercentage' ? Number(value) || 0 : value }
      )
    );
  }, []);

  const handleBulkAssignSubmit = useCallback(async () => {
    if (!onBulkAssign || filteredProjects.length === 0 || !bulkIsValid) return;
    const assignments = bulkRows.map((r) => ({
      costCenterId: r.costCenterId,
      allocationPercentage: Math.min(100, Math.max(0, r.allocationPercentage)),
    }));
    setBulkInProgress(true);
    try {
      const keys = filteredProjects.map((p) => p.key);
      await onBulkAssign(keys, assignments, bulkReplaceExisting);
      const summary = assignments
        .map((a) => {
          const name = costCenters?.find((c) => c.id === a.costCenterId)?.name ?? a.costCenterId;
          return `${name} ${a.allocationPercentage}%`;
        })
        .join(', ');
      onBulkActionSuccess?.(`${keys.length} project${keys.length !== 1 ? 's' : ''} assigned: ${summary}.`);
      setBulkModalOpen(false);
    } finally {
      setBulkInProgress(false);
    }
  }, [
    bulkRows,
    bulkIsValid,
    bulkReplaceExisting,
    filteredProjects,
    onBulkAssign,
    costCenters,
    onBulkActionSuccess,
  ]);

  const toggleProject = (key: string) => {
    const newSet = new Set(selectedProjects);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedProjects(newSet);
    const selectedKeys = Array.from(newSet);

    // Notify parent of full project data
    if (onProjectsDataChange) {
      const projectsWithData = selectedKeys.map(key => {
        const project = projects.find(p => p.key === key);
        return {
          key,
          ncloc: projectLOCMap.get(key) ?? 0,
          tags: project?.tags ?? [],
        };
      });
      onProjectsDataChange(projectsWithData);
    }
  };

  const toggleTag = (tag: string) => {
    const newSet = new Set(selectedTags);
    if (newSet.has(tag)) {
      newSet.delete(tag);
    } else {
      newSet.add(tag);
    }
    setSelectedTags(newSet);
  };

  const selectAll = () => {
    const allKeys = new Set(filteredProjects.map((p) => p.key));
    setSelectedProjects(allKeys);
  };

  const clearAll = () => {
    setSelectedProjects(new Set());
  };

  const clearTagFilters = () => {
    setSelectedTags(new Set());
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const isLoadingMeasures = projectMeasuresQueries.some(q => q.isLoading);

  if (projectsLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-t-4 border-sonar-blue">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-sonar-blue"></div>
          <p className="ml-4 text-sonar-purple dark:text-white font-body">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-t-4 border-sonar-blue">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-sonar-purple dark:text-white">
          {isAssignmentMode ? 'Assign projects to cost centers' : 'Select Projects'}
        </h2>
        {!isAssignmentMode && (
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="btn-sonar-primary px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-body text-sm"
            >
              Select All ({filteredProjects.length})
            </button>
            <button
              onClick={clearAll}
              className="btn-sonar-outline px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg font-body text-sm"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Bulk assign modal */}
      {bulkModalOpen && costCenters && costCenters.length > 0 && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center w-full max-w-none h-full max-h-none border-0 p-0 bg-black/50"
          aria-labelledby="bulk-modal-title"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 border border-gray-200 dark:border-gray-600 max-h-[90vh] overflow-y-auto">
            <h3 id="bulk-modal-title" className="text-lg font-bold text-sonar-purple dark:text-white mb-2 font-body">
              Assign all filtered to cost center(s)
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-4 font-body">
              Split allocation across one or more cost centers. Total must equal 100%. Applies to {filteredProjects.length} filtered project{filteredProjects.length !== 1 ? 's' : ''}.
            </p>
            <div className="space-y-3">
              {bulkRows.map((row) => (
                <div key={row.id} className="flex items-center gap-2 flex-wrap">
                  <select
                    aria-label="Cost center"
                    value={row.costCenterId}
                    onChange={(e) => handleUpdateBulkRow(row.id, 'costCenterId', e.target.value)}
                    className="flex-1 min-w-[140px] px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white font-body text-sm"
                  >
                    {getCostCenterOptionsForRow(row).map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name}{cc.code ? ` (${cc.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.allocationPercentage}
                    onChange={(e) => handleUpdateBulkRow(row.id, 'allocationPercentage', e.target.value)}
                    aria-label="Allocation %"
                    className="w-16 px-2 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white font-body text-sm tabular-nums"
                  />
                  <span className="text-sm text-gray-500 dark:text-slate-300 font-body">%</span>
                  {bulkRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBulkRow(row.id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      aria-label="Remove this cost center"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddBulkRow}
                disabled={remainingCostCenters.length === 0}
                className="btn-sonar-outline px-3 py-1.5 rounded-lg text-sm font-body disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add cost center
              </button>
              {bulkRows.length > 0 && (
                <p className={`text-sm font-body ${Math.round(bulkTotalPct) === 100 ? 'text-gray-600 dark:text-slate-300' : 'text-red-600 dark:text-red-400'}`}>
                  Total: {Math.round(bulkTotalPct)}% {Math.round(bulkTotalPct) === 100 ? '' : '— must equal 100%'}
                </p>
              )}
              <label className="flex items-center gap-2 cursor-pointer font-body text-sm text-gray-700 dark:text-gray-300 pt-1">
                <input
                  type="checkbox"
                  checked={bulkReplaceExisting}
                  onChange={(e) => setBulkReplaceExisting(e.target.checked)}
                  className="w-4 h-4 text-sonar-blue focus:ring-sonar-blue rounded"
                />
                Replace existing assignments for these projects
              </label>
              {!bulkReplaceExisting && (
                <p className="text-xs text-amber-700 dark:text-amber-200 font-body">
                  Some projects may have total allocation ≠ 100%; adjust in the table.
                </p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseBulkModal}
                disabled={bulkInProgress}
                className="btn-sonar-outline px-4 py-2 rounded-lg font-body text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBulkAssignSubmit()}
                disabled={bulkInProgress || !bulkIsValid}
                className="btn-sonar-primary px-4 py-2 rounded-lg font-body text-sm disabled:opacity-50"
              >
                {bulkInProgress ? 'Applying…' : 'Assign all'}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Info banner */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-sonar-blue rounded">
        <p className="text-sm text-gray-700 dark:text-gray-300 font-body">
          <span className="font-semibold">Private projects only.</span> Public projects don't count toward billing and are hidden from this list.
          {isAssignmentMode && (
            <> Allocation per project must total <strong>100%</strong> across cost centers.</>
          )}
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-sonar-blue focus:border-sonar-blue font-body transition-all"
        />
      </div>

      {/* Tag Filter - Multi-select with checkboxes (includes Assign button in assignment mode) */}
      {(availableTags.length > 0 || (isAssignmentMode && costCenters && costCenters.length > 0)) && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            <h3 className="font-semibold text-sonar-purple dark:text-white font-body">
              {availableTags.length > 0 ? 'Filter by Tags' : 'Assign projects'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {availableTags.length > 0 && selectedTags.size > 0 && (
                <button
                  onClick={clearTagFilters}
                  className="text-sm text-sonar-blue hover:text-sonar-blue-secondary font-body"
                >
                  Clear filters
                </button>
              )}
              {isAssignmentMode && costCenters && costCenters.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenBulkModal}
                  disabled={filteredProjects.length === 0}
                  className="btn-sonar-accent px-4 py-2 rounded-lg transition-all duration-200 font-body text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign all filtered to… ({filteredProjects.length})
                </button>
              )}
            </div>
            </div>
          {availableTags.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.has(tag);
                  const projectCount = projects.filter(p => p.tags?.includes(tag)).length;

                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium font-body transition-all duration-200 ${
                        isSelected
                          ? 'bg-sonar-blue text-white shadow-md'
                          : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:border-sonar-blue'
                      }`}
                    >
                      {tag} <span className="ml-1 opacity-75">({projectCount})</span>
                    </button>
                  );
                })}
              </div>
              {selectedTags.size > 0 && (
                <p className="mt-2 text-sm text-gray-600 dark:text-slate-300 font-body">
                  {selectedTags.size} tag{selectedTags.size > 1 ? 's' : ''} selected
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-sonar-background dark:bg-slate-800 p-3 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-slate-300 font-body">Private Projects</p>
          <p className="text-2xl font-bold text-sonar-purple dark:text-white">{projects.filter(p => p.visibility === 'private').length}</p>
          <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">{projects.filter(p => p.visibility === 'public').length} public hidden</p>
        </div>
        <div className="bg-sonar-background dark:bg-slate-800 p-3 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-slate-300 font-body">Filtered</p>
          <p className="text-2xl font-bold text-sonar-blue dark:text-sky-300">{filteredProjects.length}</p>
        </div>
        <div className="bg-sonar-background dark:bg-slate-800 p-3 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-slate-300 font-body">{isAssignmentMode ? 'In scope' : 'Selected'}</p>
          <p className="text-2xl font-bold text-sonar-teal dark:text-teal-400">{selectedProjects.size}</p>
        </div>
      </div>

      {/* Projects List — table when assignment mode, cards otherwise */}
      <div className="border-2 border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          {isLoadingMeasures && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 text-sm text-yellow-800 dark:text-yellow-200 font-body">
              <span className="animate-pulse">Loading LOC data...</span>
            </div>
          )}

          {(() => {
            if (filteredProjects.length === 0) {
              return (
                <div className="p-8 text-center text-gray-600 dark:text-slate-300 font-body">
                  <p className="text-lg mb-2">No projects found</p>
                  <p className="text-sm">Try adjusting your filters or search query</p>
                </div>
              );
            }
            if (isAssignmentMode) {
              return (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                <tr>
                  {projectsWithOrg != null && (
                    <th className="px-3 py-2 text-left text-gray-700 dark:text-slate-200">Organization</th>
                  )}
                  <th
                    className="px-3 py-2 text-left text-gray-700 dark:text-slate-200 cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-slate-600"
                    onClick={() => handleSort('project')}
                    role="columnheader"
                    aria-sort={sortBy === 'project' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    Project {sortBy === 'project' && (sortDir === 'asc' ? '\u2191' : '\u2193')}
                  </th>
                  <th
                    className="px-3 py-2 text-right text-gray-700 dark:text-slate-200 cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-slate-600 tabular-nums"
                    onClick={() => handleSort('loc')}
                    role="columnheader"
                    aria-sort={sortBy === 'loc' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    LOC {sortBy === 'loc' && (sortDir === 'asc' ? '\u2191' : '\u2193')}
                  </th>
                  <th className="px-3 py-2 text-left text-gray-700 dark:text-slate-200">Tags</th>
                  {costCenters?.map((cc) => (
                    <th key={cc.id} className="px-2 py-2 text-left text-gray-700 dark:text-slate-200 whitespace-nowrap" title={cc.name}>
                      {cc.name}{cc.code ? ` (${cc.code})` : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((project) => {
                  const loc = projectLOCMap.get(project.key) ?? 0;
                  const isSelected = selectedProjects.has(project.key);
                  const allocationTotal = projectAllocationTotalByKey.get(project.key) ?? 0;
                  const hasAllocationError = isSelected && Math.round(allocationTotal) !== 100;
                  return (
                    <tr
                      key={project.key}
                      className={`border-t dark:border-gray-600 ${getAssignmentRowClass(hasAllocationError, isSelected)}`}
                      role={hasAllocationError ? 'alert' : undefined}
                    >
                      {projectsWithOrg != null && (
                      <td className="px-3 py-2 text-gray-700 dark:text-slate-200">
                        {(project as ProjectWithOrganization).organizationName ?? '—'}
                      </td>
                    )}
                      <td className="px-3 py-2">
                        <div className="font-semibold text-sonar-purple dark:text-white truncate max-w-[200px]" title={project.name}>{project.name}</div>
                        <div className="text-xs text-gray-600 dark:text-slate-300 font-mono truncate max-w-[200px]" title={project.key}>{project.key}</div>
                        {hasAllocationError && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1" role="alert">
                            Total allocation must be 100% (currently {Math.round(allocationTotal)}%)
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {loc > 0 ? formatNumber(loc) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {project.tags?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {project.tags.map((tag) => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      {costCenters?.map((cc) => {
                        const assignment = getAssignmentForProjectAndCC(project.key, cc.id);
                        const checked = Boolean(assignment);
                        return (
                          <td key={cc.id} className="px-2 py-2 align-top">
                            <div className="flex items-center gap-1 flex-wrap">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    onSaveProjectAssignment?.(project.key, cc.id, 100);
                                  } else {
                                    onClearProjectAssignment?.(project.key, cc.id);
                                  }
                                }}
                                className="w-4 h-4 text-sonar-blue focus:ring-sonar-blue cursor-pointer"
                                title={`Assign to ${cc.name}`}
                              />
                              {checked && (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={assignment?.allocationPercentage ?? 100}
                                  onChange={(e) => {
                                    const pct = Number(e.target.value) || 0;
                                    onSaveProjectAssignment?.(project.key, cc.id, Math.min(100, Math.max(0, pct)));
                                  }}
                                  className="w-12 px-1 py-0.5 border rounded dark:bg-gray-600 dark:text-white text-xs"
                                  title="Allocation %"
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
              );
            }
            return (
            sortedProjects.map((project) => {
              const loc = projectLOCMap.get(project.key) ?? 0;
              const isSelected = selectedProjects.has(project.key);

              return (
                <div
                  key={project.key}
                  className={`flex items-start gap-3 p-4 border-b last:border-b-0 transition-colors ${
                    isSelected
                      ? 'bg-sonar-blue/10 hover:bg-sonar-blue/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleProject(project.key)}
                    className="w-5 h-5 mt-1 text-sonar-blue focus:ring-sonar-blue cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sonar-purple dark:text-white truncate">
                          {project.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-slate-300 font-mono truncate">
                          {project.key}
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-right">
                          <div className="text-lg font-bold text-sonar-blue">
                            {loc > 0 ? formatNumber(loc) : '—'}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-slate-300 font-body">LOC</div>
                        </div>
                      </div>
                    </div>

                    {project.tags && project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {project.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium font-body transition-colors ${
                              selectedTags.has(tag)
                                ? 'bg-sonar-blue text-white shadow-sm'
                                : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function getAssignmentRowClass(hasAllocationError: boolean, isSelected: boolean): string {
  if (hasAllocationError) return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500';
  if (isSelected) return 'bg-sonar-blue/10 dark:bg-sonar-blue/20';
  return 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
}
