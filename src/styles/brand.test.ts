import { describe, it, expect } from 'vitest';
import {
  SonarColors,
  SonarFonts,
  SonarSpacing,
  SonarAnimations,
  SonarComponents,
} from './brand';

describe('brand', () => {
  describe('SonarColors', () => {
    it('exports blue primary, secondary, light', () => {
      expect(SonarColors.blue.primary).toBe('#126ED3');
      expect(SonarColors.blue.secondary).toBe('#0C5DB5');
      expect(SonarColors.blue.light).toBe('#B7D3F2');
    });

    it('exports purple primary and dark', () => {
      expect(SonarColors.purple.primary).toBe('#290042');
      expect(SonarColors.purple.dark).toBe('#1a0029');
    });

    it('exports teal accent', () => {
      expect(SonarColors.teal).toBe('#1B998B');
    });

    it('exports background light and white', () => {
      expect(SonarColors.background.light).toBe('#EEFCFC');
      expect(SonarColors.background.white).toBe('#FFFFFF');
    });

    it('exports text primary and secondary', () => {
      expect(SonarColors.text.primary).toBe('#290042');
      expect(SonarColors.text.secondary).toBe('#69809B');
    });
  });

  describe('SonarFonts', () => {
    it('exports primary, secondary, mono font families', () => {
      expect(SonarFonts.primary).toContain('Poppins');
      expect(SonarFonts.secondary).toContain('Inter');
      expect(SonarFonts.mono).toContain('monospace');
    });

    it('exports font weights', () => {
      expect(SonarFonts.weights.normal).toBe(400);
      expect(SonarFonts.weights.medium).toBe(500);
      expect(SonarFonts.weights.semibold).toBe(600);
      expect(SonarFonts.weights.bold).toBe(700);
    });

    it('exports font sizes', () => {
      expect(SonarFonts.sizes.xs).toBe('12px');
      expect(SonarFonts.sizes.sm).toBe('14px');
      expect(SonarFonts.sizes.base).toBe('16px');
      expect(SonarFonts.sizes.lg).toBe('18px');
      expect(SonarFonts.sizes.xl).toBe('20px');
      expect(SonarFonts.sizes['2xl']).toBe('24px');
      expect(SonarFonts.sizes['3xl']).toBe('32px');
      expect(SonarFonts.sizes['4xl']).toBe('48px');
    });
  });

  describe('SonarSpacing', () => {
    it('exports borderRadius scale', () => {
      expect(SonarSpacing.borderRadius.sm).toBe('0.375rem');
      expect(SonarSpacing.borderRadius.md).toBe('0.5rem');
      expect(SonarSpacing.borderRadius.lg).toBe('0.75rem');
      expect(SonarSpacing.borderRadius.xl).toBe('1rem');
      expect(SonarSpacing.borderRadius['2xl']).toBe('1.5rem');
    });

    it('exports border widths', () => {
      expect(SonarSpacing.borders.thin).toBe('1px');
      expect(SonarSpacing.borders.medium).toBe('2px');
      expect(SonarSpacing.borders.thick).toBe('4px');
    });
  });

  describe('SonarAnimations', () => {
    it('exports duration and easing', () => {
      expect(SonarAnimations.duration.fast).toBe('150ms');
      expect(SonarAnimations.duration.normal).toBe('200ms');
      expect(SonarAnimations.duration.slow).toBe('300ms');
      expect(SonarAnimations.easing.default).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
      expect(SonarAnimations.easing.in).toBe('cubic-bezier(0.4, 0, 1, 1)');
      expect(SonarAnimations.easing.out).toBe('cubic-bezier(0, 0, 0.2, 1)');
      expect(SonarAnimations.easing.inOut).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    });
  });

  describe('SonarComponents', () => {
    it('exports button primary and secondary styles', () => {
      expect(SonarComponents.button.primary.background).toBe(SonarColors.blue.primary);
      expect(SonarComponents.button.primary.hover).toBe(SonarColors.blue.secondary);
      expect(SonarComponents.button.primary.text).toBe('#FFFFFF');
      expect(SonarComponents.button.secondary.background).toBe(SonarColors.purple.primary);
      expect(SonarComponents.button.secondary.hover).toBe(SonarColors.purple.dark);
      expect(SonarComponents.button.secondary.text).toBe('#FFFFFF');
    });

    it('exports input styles', () => {
      expect(SonarComponents.input.border).toBe('#D1D5DB');
      expect(SonarComponents.input.focusBorder).toBe(SonarColors.blue.primary);
      expect(SonarComponents.input.background).toBe('#FFFFFF');
    });
  });
});
