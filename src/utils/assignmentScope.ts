/**
 * Assignment scope utilities.
 * Used to restrict cost center assignments to projects in the currently selected org(s).
 */

import type { CostCenterAssignment } from '../types/billing';

/**
 * Returns only assignments whose projectKey is in the given set (e.g. private project keys
 * of the currently selected organization(s)). Tag assignments are excluded.
 * Used so billing table, "Projects in scope", and metrics only reflect selected orgs.
 */
export function filterAssignmentsInScope(
  assignments: CostCenterAssignment[],
  projectKeysInScope: string[]
): CostCenterAssignment[] {
  const inScopeKeys = new Set(projectKeysInScope);
  return assignments.filter(
    (a) => (a.type === 'project' || a.projectKey) && !!a.projectKey && inScopeKeys.has(a.projectKey)
  );
}
