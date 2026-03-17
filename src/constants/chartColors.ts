/**
 * Shared chart color palette
 * Sonar brand colors first, then high-contrast accents for multiple series.
 * Use for both LOC Trend and Cost Distribution pie so charts feel consistent.
 */

// Sonar brand (BRAND_COLORS_REFERENCE.md)
const SONAR_BLUE = '#126ED3';
const SONAR_PURPLE = '#290042';
const SONAR_TEAL = '#1B998B';
const SONAR_BLUE_SECONDARY = '#0C5DB5';

// High-contrast accents for many series (WCAG-friendly)
const ACCENTS = [
  '#F59E0B', // Amber
  '#EF4444', // Rose
  '#EC4899', // Fuchsia
  '#14B8A6', // Teal variant
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#6366F1', // Indigo
  '#A855F7', // Purple
  '#FB923C', // Peach
];

/** Palette for line/bar charts: brand first, then accents. Use by index % length. */
export const CHART_COLORS: string[] = [
  SONAR_BLUE,
  SONAR_PURPLE,
  SONAR_TEAL,
  SONAR_BLUE_SECONDARY,
  ...ACCENTS,
];

/** Same palette for pie segments (cost centers). */
export const PIE_COLORS: string[] = CHART_COLORS;

/** Reserved colors for special pie segments */
export const PIE_UNASSIGNED_COLOR = '#94a3b8';
export const PIE_UNUSED_COLOR = '#cbd5e1';
