/**
 * Unit tests for assignment scope filtering.
 * Protects the rule: only assignments for projects in the selected org(s) are "in scope".
 */

import { describe, it, expect } from 'vitest';
import { filterAssignmentsInScope } from './assignmentScope';
import type { CostCenterAssignment } from '../types/billing';

function assignment(projectKey: string, costCenterId: string, allocationPercentage = 100): CostCenterAssignment {
  return {
    id: `cca-${projectKey}-${costCenterId}`,
    costCenterId,
    type: 'project',
    projectKey,
    allocationPercentage,
  };
}

describe('filterAssignmentsInScope', () => {
  it('returns only assignments whose projectKey is in projectKeysInScope', () => {
    const assignments: CostCenterAssignment[] = [
      assignment('proj-a', 'cc-1'),
      assignment('proj-b', 'cc-1'),
      assignment('proj-c', 'cc-2'),
    ];
    const inScope = filterAssignmentsInScope(assignments, ['proj-a', 'proj-c']);
    expect(inScope).toHaveLength(2);
    expect(inScope.map((a) => a.projectKey)).toEqual(['proj-a', 'proj-c']);
  });

  it('returns empty array when no project keys are in scope', () => {
    const assignments: CostCenterAssignment[] = [
      assignment('proj-x', 'cc-1'),
      assignment('proj-y', 'cc-1'),
    ];
    const inScope = filterAssignmentsInScope(assignments, ['proj-a', 'proj-b']);
    expect(inScope).toHaveLength(0);
  });

  it('returns all assignments when all project keys are in scope', () => {
    const assignments: CostCenterAssignment[] = [
      assignment('proj-a', 'cc-1'),
      assignment('proj-b', 'cc-1'),
    ];
    const inScope = filterAssignmentsInScope(assignments, ['proj-a', 'proj-b']);
    expect(inScope).toHaveLength(2);
  });

  it('returns empty when projectKeysInScope is empty', () => {
    const assignments: CostCenterAssignment[] = [assignment('proj-a', 'cc-1')];
    const inScope = filterAssignmentsInScope(assignments, []);
    expect(inScope).toHaveLength(0);
  });

  it('returns empty when assignments is empty', () => {
    const inScope = filterAssignmentsInScope([], ['proj-a']);
    expect(inScope).toHaveLength(0);
  });

  it('excludes tag-type assignments (no projectKey in scope set)', () => {
    const assignments: CostCenterAssignment[] = [
      assignment('proj-a', 'cc-1'),
      { id: 'cca-tag-1', costCenterId: 'cc-1', type: 'tag', tag: 'backend', allocationPercentage: 100 },
    ];
    const inScope = filterAssignmentsInScope(assignments, ['proj-a']);
    expect(inScope).toHaveLength(1);
    expect(inScope[0].projectKey).toBe('proj-a');
  });

  it('excludes assignments with missing projectKey', () => {
    const assignments: CostCenterAssignment[] = [
      assignment('proj-a', 'cc-1'),
      { id: 'cca-2', costCenterId: 'cc-1', type: 'project', allocationPercentage: 50 },
    ];
    const inScope = filterAssignmentsInScope(assignments, ['proj-a']);
    expect(inScope).toHaveLength(1);
    expect(inScope[0].projectKey).toBe('proj-a');
  });
});
