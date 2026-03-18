/**
 * Data transformation utilities
 * Parse and transform SonarCloud API responses
 */

import type { LanguageDistribution } from '../types/sonarcloud';

/**
 * Parse ncloc_language_distribution metric
 * Input: "java=1234;javascript=567;python=890"
 * Output: { java: 1234, javascript: 567, python: 890 }
 */
export function parseLanguageDistribution(value: string): LanguageDistribution {
  if (!value || value.trim() === '') {
    return {};
  }

  const distribution: LanguageDistribution = {};
  const pairs = value.split(';');

  for (const pair of pairs) {
    const [language, locStr] = pair.split('=');
    if (language && locStr) {
      const loc = parseInt(locStr, 10);
      if (!isNaN(loc)) {
        distribution[language.trim()] = loc;
      }
    }
  }

  return distribution;
}

/**
 * Get total NCLOC from language distribution
 */
export function getTotalNLOC(distribution: LanguageDistribution): number {
  return Object.values(distribution).reduce((sum, loc) => sum + loc, 0);
}

/**
 * Get language percentage breakdown
 */
export function getLanguagePercentages(
  distribution: LanguageDistribution
): Record<string, number> {
  const total = getTotalNLOC(distribution);
  if (total === 0) return {};

  const percentages: Record<string, number> = {};
  for (const [language, loc] of Object.entries(distribution)) {
    percentages[language] = (loc / total) * 100;
  }

  return percentages;
}

/**
 * Sort languages by LOC (descending)
 */
export function sortLanguagesByLOC(
  distribution: LanguageDistribution
): [string, number][] {
  return Object.entries(distribution).sort((a, b) => b[1] - a[1]);
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format number with thousand separators
 */
export function formatNumberWithCommas(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(
  oldValue: number,
  newValue: number
): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Group array items by a key
 */
export function groupBy<T>(
  array: T[],
  keyGetter: (item: T) => string
): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyGetter(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}
