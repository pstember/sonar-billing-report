/**
 * SonarQube Cloud API Constants
 *
 * These constants define the limits and constraints of the SonarQube Cloud API.
 * Reference: https://docs.sonarcloud.io/
 */

/**
 * Maximum page size allowed by SonarQube Cloud API for paginated endpoints
 *
 * IMPORTANT: The SonarQube Cloud API enforces a maximum of 100 items per page.
 * Attempting to use a larger value will result in an error:
 * {"errors":[{"msg":"'ps' value (X) must be less than 100"}]}
 *
 * This applies to endpoints like:
 * - /api/projects/search
 * - /api/project_tags/search
 * - /api/measures/search_history
 * - etc.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Default page size for API requests
 * Using a smaller default can improve response times
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Page number starts at 1 (not 0)
 */
export const FIRST_PAGE = 1;

/**
 * Common metric keys used in the application
 */
export const METRIC_KEYS = {
  // Lines of Code
  NCLOC: 'ncloc',

  // Quality metrics
  COVERAGE: 'coverage',
  BUGS: 'bugs',
  VULNERABILITIES: 'vulnerabilities',
  CODE_SMELLS: 'code_smells',

  // Ratings
  RELIABILITY_RATING: 'reliability_rating',
  SECURITY_RATING: 'security_rating',
  SQALE_RATING: 'sqale_rating',

  // Technical debt
  SQALE_INDEX: 'sqale_index',
  SQALE_DEBT_RATIO: 'sqale_debt_ratio',
} as const;

/**
 * API endpoint paths (relative to base URL)
 */
export const API_PATHS = {
  ORGANIZATIONS_SEARCH: '/organizations/search',
  PROJECTS_SEARCH: '/projects/search',
  PROJECT_TAGS_SEARCH: '/project_tags/search',
  COMPONENTS_SEARCH: '/components/search',
  MEASURES_COMPONENT: '/measures/component',
  MEASURES_HISTORY: '/measures/search_history',
  MEASURES_COMPONENT_TREE: '/measures/component_tree',
} as const;

/**
 * Component qualifiers used in SonarQube Cloud
 */
export const QUALIFIERS = {
  PROJECT: 'TRK',
  MODULE: 'BRC',
  DIRECTORY: 'DIR',
  FILE: 'FIL',
  UNIT_TEST: 'UTS',
  PORTFOLIO: 'VW',
  SUB_PORTFOLIO: 'SVW',
  APPLICATION: 'APP',
} as const;

/**
 * Helper function to ensure page size doesn't exceed maximum
 */
export function getValidPageSize(requestedSize?: number): number {
  if (!requestedSize) return DEFAULT_PAGE_SIZE;
  return Math.min(requestedSize, MAX_PAGE_SIZE);
}

/**
 * Helper function to paginate through all results
 * Returns configuration for making multiple requests if needed
 */
export function getPaginationConfig(totalItems: number, pageSize: number = DEFAULT_PAGE_SIZE) {
  const validPageSize = getValidPageSize(pageSize);
  const totalPages = Math.ceil(totalItems / validPageSize);

  return {
    pageSize: validPageSize,
    totalPages,
    pages: Array.from({ length: totalPages }, (_, i) => i + 1),
  };
}
