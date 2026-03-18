import { describe, it, expect } from 'vitest';
import {
  allocateProjectToCostCenters,
  allocateProjectsToCostCenters,
  allocationSummary,
  type ProjectInput,
} from './costCenterAllocation';
import type { CostCenter, CostCenterAssignment } from '../types/billing';

const costCenters: CostCenter[] = [
  { id: 'cc1', name: 'Cost Center A' },
  { id: 'cc2', name: 'Cost Center B' },
  { id: 'cc-unknown', name: 'Unknown CC' }, // may be missing from map in tests
];

describe('allocateProjectToCostCenters', () => {
  it('returns empty allocations and totalAllocationPercent 0 when no assignments match', () => {
    const project: ProjectInput = { key: 'proj-x', ncloc: 1000, tags: ['frontend'] };
    const assignments: CostCenterAssignment[] = [
      { id: 'a1', costCenterId: 'cc1', type: 'project', projectKey: 'other', allocationPercentage: 100 },
      { id: 'a2', costCenterId: 'cc1', type: 'tag', tag: 'backend', allocationPercentage: 100 },
    ];
    const result = allocateProjectToCostCenters(project, costCenters, assignments);
    expect(result.projectKey).toBe('proj-x');
    expect(result.ncloc).toBe(1000);
    expect(result.totalAllocationPercent).toBe(0);
    expect(result.allocations).toEqual([]);
  });

  it('direct assignment by projectKey wins over tag-based', () => {
    const project: ProjectInput = { key: 'proj-p', ncloc: 500, tags: ['shared'] };
    const assignments: CostCenterAssignment[] = [
      { id: 'a-tag', costCenterId: 'cc2', type: 'tag', tag: 'shared', allocationPercentage: 100 },
      { id: 'a-direct', costCenterId: 'cc1', type: 'project', projectKey: 'proj-p', allocationPercentage: 100 },
    ];
    const result = allocateProjectToCostCenters(project, costCenters, assignments);
    expect(result.totalAllocationPercent).toBe(100);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].costCenterId).toBe('cc1');
    expect(result.allocations[0].costCenterName).toBe('Cost Center A');
    expect(result.allocations[0].allocationPercentage).toBe(100);
    expect(result.allocations[0].allocatedNcloc).toBe(500);
  });

  it('tag-based match when no direct match', () => {
    const project: ProjectInput = { key: 'proj-t', ncloc: 200, tags: ['team-alpha'] };
    const assignments: CostCenterAssignment[] = [
      { id: 'a1', costCenterId: 'cc1', type: 'tag', tag: 'team-alpha', allocationPercentage: 100 },
    ];
    const result = allocateProjectToCostCenters(project, costCenters, assignments);
    expect(result.totalAllocationPercent).toBe(100);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].costCenterId).toBe('cc1');
    expect(result.allocations[0].allocatedNcloc).toBe(200);
  });

  it('multiple assignments normalized to 100%', () => {
    const project: ProjectInput = { key: 'proj-m', ncloc: 1000, tags: [] };
    const assignments: CostCenterAssignment[] = [
      { id: 'a1', costCenterId: 'cc1', type: 'project', projectKey: 'proj-m', allocationPercentage: 60 },
      { id: 'a2', costCenterId: 'cc2', type: 'project', projectKey: 'proj-m', allocationPercentage: 40 },
    ];
    const result = allocateProjectToCostCenters(project, costCenters, assignments);
    expect(result.totalAllocationPercent).toBe(100);
    expect(result.allocations).toHaveLength(2);
    const cc1 = result.allocations.find((a) => a.costCenterId === 'cc1');
    const cc2 = result.allocations.find((a) => a.costCenterId === 'cc2');
    expect(cc1?.allocationPercentage).toBe(60);
    expect(cc2?.allocationPercentage).toBe(40);
    expect(cc1.allocatedNcloc).toBe(600);
    expect(cc2.allocatedNcloc).toBe(400);
  });

  it('unknown costCenterId uses assignment costCenterId as name', () => {
    const project: ProjectInput = { key: 'proj-u', ncloc: 100, tags: [] };
    const assignments: CostCenterAssignment[] = [
      { id: 'a1', costCenterId: 'cc-missing', type: 'project', projectKey: 'proj-u', allocationPercentage: 100 },
    ];
    const result = allocateProjectToCostCenters(project, costCenters, assignments);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].costCenterName).toBe('cc-missing');
  });
});

describe('allocateProjectsToCostCenters', () => {
  it('returns one result per project; each matches single-project behavior', () => {
    const projects: ProjectInput[] = [
      { key: 'p1', ncloc: 100, tags: ['t1'] },
      { key: 'p2', ncloc: 200, tags: ['t2'] },
    ];
    const assignments: CostCenterAssignment[] = [
      { id: 'a1', costCenterId: 'cc1', type: 'tag', tag: 't1', allocationPercentage: 100 },
      { id: 'a2', costCenterId: 'cc2', type: 'tag', tag: 't2', allocationPercentage: 100 },
    ];
    const results = allocateProjectsToCostCenters(projects, costCenters, assignments);
    expect(results).toHaveLength(2);
    expect(results[0].projectKey).toBe('p1');
    expect(results[0].allocations[0].allocatedNcloc).toBe(100);
    expect(results[1].projectKey).toBe('p2');
    expect(results[1].allocations[0].allocatedNcloc).toBe(200);
  });
});

describe('allocationSummary', () => {
  it('aggregates byAssignment and byCostCenter from ProjectAllocationResult[]', () => {
    const results = [
      {
        projectKey: 'p1',
        ncloc: 100,
        totalAllocationPercent: 100,
        allocations: [
          { costCenterId: 'cc1', costCenterName: 'A', assignmentId: 'a1', allocationPercentage: 50, allocatedNcloc: 50 },
          { costCenterId: 'cc2', costCenterName: 'B', assignmentId: 'a2', allocationPercentage: 50, allocatedNcloc: 50 },
        ],
      },
      {
        projectKey: 'p2',
        ncloc: 200,
        totalAllocationPercent: 100,
        allocations: [
          { costCenterId: 'cc1', costCenterName: 'A', assignmentId: 'a1', allocationPercentage: 100, allocatedNcloc: 200 },
        ],
      },
    ];
    const summary = allocationSummary(results);
    expect(summary.byAssignment.get('a1')).toBe(250);
    expect(summary.byAssignment.get('a2')).toBe(50);
    expect(summary.byCostCenter.get('cc1')).toBe(250);
    expect(summary.byCostCenter.get('cc2')).toBe(50);
  });
});
