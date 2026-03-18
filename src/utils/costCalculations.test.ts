import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  getPricePer1kFromPlan,
  calculateTieredCost,
  getCurrencySymbol,
  formatCurrency,
} from './costCalculations';
import type { BillingConfiguration, TieredPricingRule } from '../types/billing';

describe('calculateCost', () => {
  it('uses default rate only when no language or tiered pricing', () => {
    const config: BillingConfiguration = {
      currency: 'USD',
      defaultRate: 10,
    };
    expect(calculateCost(1000, config)).toBe(10);
    expect(calculateCost(5000, config)).toBe(50);
  });

  it('uses language-specific rate when language is provided and in languageRates', () => {
    const config: BillingConfiguration = {
      currency: 'USD',
      defaultRate: 5,
      languageRates: { java: 20, javascript: 8 },
    };
    expect(calculateCost(1000, config, 'java')).toBe(20);
    expect(calculateCost(2000, config, 'javascript')).toBe(16);
  });

  it('falls back to default rate when language not in languageRates', () => {
    const config: BillingConfiguration = {
      currency: 'USD',
      defaultRate: 10,
      languageRates: { java: 20 },
    };
    expect(calculateCost(1000, config, 'python')).toBe(10);
  });

  it('uses tiered pricing when tieredPricing is present', () => {
    const config: BillingConfiguration = {
      currency: 'USD',
      defaultRate: 10,
      tieredPricing: [
        { minLOC: 0, maxLOC: 5000, ratePerKLOC: 15 },
        { minLOC: 5000, maxLOC: 10000, ratePerKLOC: 12 },
      ],
    };
    // 3000 LOC in first tier: 3 * 15 = 45
    expect(calculateCost(3000, config)).toBe(45);
    // 7000 LOC: 5*15 + 2*12 = 75 + 24 = 99
    expect(calculateCost(7000, config)).toBe(99);
  });

  it('returns 0 when defaultRate is not set and no language/tiered', () => {
    const config: BillingConfiguration = { currency: 'USD' };
    expect(calculateCost(1000, config)).toBe(0);
  });
});

describe('getPricePer1kFromPlan', () => {
  it('returns null when planAllowanceLOC <= 0', () => {
    const config: BillingConfiguration = { currency: 'USD', contractValue: 10000 };
    expect(getPricePer1kFromPlan(config, 0)).toBe(null);
    expect(getPricePer1kFromPlan(config, -100)).toBe(null);
  });

  it('returns null when contractValue is missing or <= 0', () => {
    const configNoVal: BillingConfiguration = { currency: 'USD' };
    expect(getPricePer1kFromPlan(configNoVal, 10000)).toBe(null);
    const configZero: BillingConfiguration = { currency: 'USD', contractValue: 0 };
    expect(getPricePer1kFromPlan(configZero, 10000)).toBe(null);
  });

  it('returns correct value when both contractValue and planAllowanceLOC are set', () => {
    const config: BillingConfiguration = { currency: 'USD', contractValue: 10000 };
    // 10000 * 1000 / 10000 = 1000 per 1k LOC
    expect(getPricePer1kFromPlan(config, 10000)).toBe(1000);
    // 5000 * 1000 / 20000 = 250
    expect(getPricePer1kFromPlan(config, 20000)).toBe(500);
  });
});

describe('calculateTieredCost', () => {
  it('sorts tiers by minLOC ascending', () => {
    const tiers: TieredPricingRule[] = [
      { minLOC: 5000, maxLOC: 10000, ratePerKLOC: 12 },
      { minLOC: 0, maxLOC: 5000, ratePerKLOC: 15 },
    ];
    // 3000 LOC should all be in first tier (0-5k) at 15
    expect(calculateTieredCost(3000, tiers)).toBe(45);
  });

  it('computes cost when LOC falls in one tier', () => {
    const tiers: TieredPricingRule[] = [
      { minLOC: 0, maxLOC: 5000, ratePerKLOC: 10 },
    ];
    expect(calculateTieredCost(3000, tiers)).toBe(30);
  });

  it('computes cost when LOC spans multiple tiers', () => {
    const tiers: TieredPricingRule[] = [
      { minLOC: 0, maxLOC: 5000, ratePerKLOC: 20 },
      { minLOC: 5000, maxLOC: 10000, ratePerKLOC: 15 },
    ];
    // 7000: 5*20 + 2*15 = 100 + 30 = 130
    expect(calculateTieredCost(7000, tiers)).toBe(130);
  });

  it('handles open-ended last tier (maxLOC undefined)', () => {
    const tiers: TieredPricingRule[] = [
      { minLOC: 0, maxLOC: 5000, ratePerKLOC: 10 },
      { minLOC: 5000, maxLOC: undefined, ratePerKLOC: 5 },
    ];
    // 10000: 5*10 + 5*5 = 50 + 25 = 75
    expect(calculateTieredCost(10000, tiers)).toBe(75);
  });
});

describe('getCurrencySymbol', () => {
  it('returns symbol for USD, EUR, GBP', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
  });

  it('returns code for unknown currency', () => {
    expect(getCurrencySymbol('CHF')).toBe('CHF');
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
  });
});

describe('formatCurrency', () => {
  it('formats USD with 2 decimals by default', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('formats EUR and GBP', () => {
    expect(formatCurrency(100, 'EUR')).toMatch(/100[,.]00/);
    expect(formatCurrency(100, 'GBP')).toMatch(/100[,.]00/);
  });

  it('respects decimals parameter', () => {
    expect(formatCurrency(1.234, 'USD', 0)).toBe('$1');
    expect(formatCurrency(1.234, 'USD', 3)).toBe('$1.234');
  });

  it('defaults to USD when currency not provided', () => {
    expect(formatCurrency(10)).toContain('10.00');
  });
});
