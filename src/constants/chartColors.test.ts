import { describe, it, expect } from 'vitest';
import {
  CHART_COLORS,
  PIE_COLORS,
  PIE_UNASSIGNED_COLOR,
  PIE_UNUSED_COLOR,
} from './chartColors';

describe('chartColors', () => {
  describe('CHART_COLORS', () => {
    it('exports a non-empty array of hex color strings', () => {
      expect(CHART_COLORS).toBeInstanceOf(Array);
      expect(CHART_COLORS.length).toBeGreaterThan(0);
      CHART_COLORS.forEach((color) => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('starts with Sonar brand colors', () => {
      expect(CHART_COLORS[0]).toBe('#126ED3');
      expect(CHART_COLORS[1]).toBe('#290042');
      expect(CHART_COLORS[2]).toBe('#1B998B');
      expect(CHART_COLORS[3]).toBe('#0C5DB5');
    });
  });

  describe('PIE_COLORS', () => {
    it('exports same palette as CHART_COLORS', () => {
      expect(PIE_COLORS).toEqual(CHART_COLORS);
    });
  });

  describe('PIE_UNASSIGNED_COLOR', () => {
    it('exports a hex color string', () => {
      expect(PIE_UNASSIGNED_COLOR).toBe('#94a3b8');
      expect(PIE_UNASSIGNED_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe('PIE_UNUSED_COLOR', () => {
    it('exports a hex color string', () => {
      expect(PIE_UNUSED_COLOR).toBe('#cbd5e1');
      expect(PIE_UNUSED_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});
