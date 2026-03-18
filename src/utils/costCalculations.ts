/**
 * Cost calculation utilities
 * Handle billing rate calculations and cost allocations
 */

import type {
  BillingConfiguration,
  TieredPricingRule,
} from '../types/billing';

/**
 * Calculate cost based on LOC and billing configuration
 */
export function calculateCost(
  ncloc: number,
  config: BillingConfiguration,
  language?: string
): number {
  // Check for tiered pricing first
  if (config.tieredPricing && config.tieredPricing.length > 0) {
    return calculateTieredCost(ncloc, config.tieredPricing);
  }

  // Check for language-specific rate
  if (language && config.languageRates?.[language]) {
    return (ncloc / 1000) * config.languageRates[language];
  }

  // Use default rate (or 0 if neither contract value nor rate is set)
  const rate = config.defaultRate ?? 0;
  return (ncloc / 1000) * rate;
}

/**
 * Price per 1k LOC from the plan (allowance from billing API): contract value ÷ (plan allowance in 1k).
 * This is the nominal rate from your license, not the effective rate on consumed LOC.
 */
export function getPricePer1kFromPlan(
  config: BillingConfiguration,
  planAllowanceLOC: number
): number | null {
  if (planAllowanceLOC <= 0 || config.contractValue == null || config.contractValue <= 0) {
    return null;
  }
  return (config.contractValue * 1000) / planAllowanceLOC;
}

/**
 * Calculate cost using tiered pricing
 */
export function calculateTieredCost(
  ncloc: number,
  tiers: TieredPricingRule[]
): number {
  let totalCost = 0;
  let remainingLOC = ncloc;

  // Sort tiers by minLOC ascending
  const sortedTiers = [...tiers].sort((a, b) => a.minLOC - b.minLOC);

  for (const tier of sortedTiers) {
    if (remainingLOC <= 0) break;

    const tierMin = tier.minLOC;
    const tierMax = tier.maxLOC ?? Infinity;
    const tierSize = tierMax - tierMin;

    if (ncloc > tierMin) {
      const locInTier = Math.min(remainingLOC, tierSize);
      totalCost += (locInTier / 1000) * tier.ratePerKLOC;
      remainingLOC -= locInTier;
    }
  }

  return totalCost;
}

/** Currency code to symbol for headers/labels. */
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * Format currency (uses symbol via Intl, e.g. $1,234.56)
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  decimals = 2
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/** Parts for rendering currency with the decimal in smaller type (e.g. $1,234.<small>56</small>) */
export interface CurrencyParts {
  symbol: string;
  whole: string;
  decimal: string;
}

/**
 * Split formatted currency into symbol, whole part, and decimal part for display (e.g. decimal in smaller font).
 */
export function formatCurrencyParts(
  amount: number,
  currency = 'USD',
  decimals = 2
): CurrencyParts {
  const symbol = getCurrencySymbol(currency);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(Math.abs(amount));
  const lastDot = formatted.lastIndexOf('.');
  const whole = lastDot >= 0 ? formatted.slice(0, lastDot) : formatted;
  const decimal = lastDot >= 0 ? formatted.slice(lastDot + 1) : '';
  return {
    symbol: amount < 0 ? `−${symbol}` : symbol,
    whole,
    decimal,
  };
}
