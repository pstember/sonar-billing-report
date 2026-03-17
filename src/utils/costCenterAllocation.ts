/**
 * Cost center allocation: resolve project/tag assignments to per-project, per-cost-center LOC
 * with normalization so each project's allocation sums to 100%.
 */

import type { CostCenter, CostCenterAssignment } from '../types/billing';

export interface ProjectInput {
  key: string;
  ncloc: number;
  tags: string[];
}

export interface CostCenterAllocationItem {
  costCenterId: string;
  costCenterName: string;
  assignmentId: string;
  allocationPercentage: number; // normalized 0-100
  allocatedNcloc: number;
}

export interface ProjectAllocationResult {
  projectKey: string;
  ncloc: number;
  totalAllocationPercent: number; // before normalize (may != 100)
  allocations: CostCenterAllocationItem[];
}

/**
 * For a single project, find all matching assignments and return allocated LOC per cost center.
 * Direct assignment wins: if any assignment matches by projectKey, use only those (ignore tags).
 * Otherwise use tag-based matches. Normalize so total allocated = 100% of project ncloc.
 */
export function allocateProjectToCostCenters(
  project: ProjectInput,
  costCenters: CostCenter[],
  assignments: CostCenterAssignment[]
): ProjectAllocationResult {
  const ccMap = new Map(costCenters.map((c) => [c.id, c]));
  const directMatches = assignments.filter((a) => a.projectKey === project.key);
  const matching =
    directMatches.length > 0
      ? directMatches
      : assignments.filter((a) => a.tag && project.tags.includes(a.tag));

  if (matching.length === 0) {
    return {
      projectKey: project.key,
      ncloc: project.ncloc,
      totalAllocationPercent: 0,
      allocations: [],
    };
  }
  const totalPercent = matching.reduce((s, a) => s + a.allocationPercentage, 0);
  const allocations: CostCenterAllocationItem[] = matching.map((a) => {
    const cc = ccMap.get(a.costCenterId);
    const normPct = totalPercent > 0 ? (a.allocationPercentage / totalPercent) * 100 : 0;
    return {
      costCenterId: a.costCenterId,
      costCenterName: cc?.name ?? a.costCenterId,
      assignmentId: a.id,
      allocationPercentage: normPct,
      allocatedNcloc: (project.ncloc * normPct) / 100,
    };
  });
  return {
    projectKey: project.key,
    ncloc: project.ncloc,
    totalAllocationPercent: totalPercent,
    allocations,
  };
}

/**
 * Allocate many projects to cost centers. Returns one result per project.
 */
export function allocateProjectsToCostCenters(
  projects: ProjectInput[],
  costCenters: CostCenter[],
  assignments: CostCenterAssignment[]
): ProjectAllocationResult[] {
  return projects.map((p) =>
    allocateProjectToCostCenters(p, costCenters, assignments)
  );
}

export interface AllocationSummary {
  byAssignment: Map<string, number>;
  byCostCenter: Map<string, number>;
}

/**
 * From allocation results, aggregate LOC per assignment id and per cost center.
 * Use for LOC column (byAssignment) and cost-center total row (byCostCenter).
 */
export function allocationSummary(results: ProjectAllocationResult[]): AllocationSummary {
  const byAssignment = new Map<string, number>();
  const byCostCenter = new Map<string, number>();
  for (const r of results) {
    for (const alloc of r.allocations) {
      byAssignment.set(
        alloc.assignmentId,
        (byAssignment.get(alloc.assignmentId) ?? 0) + alloc.allocatedNcloc
      );
      byCostCenter.set(
        alloc.costCenterId,
        (byCostCenter.get(alloc.costCenterId) ?? 0) + alloc.allocatedNcloc
      );
    }
  }
  return { byAssignment, byCostCenter };
}
