import { describe, it, expect } from 'vitest';
import {
  parseLanguageDistribution,
  getTotalNLOC,
  getLanguagePercentages,
  sortLanguagesByLOC,
  formatLargeNumber,
  formatCompactLoc,
  formatNumberWithCommas,
  calculatePercentageChange,
  formatPercentage,
  groupBy,
} from './dataTransformers';

describe('parseLanguageDistribution', () => {
  it('returns empty object for empty string', () => {
    expect(parseLanguageDistribution('')).toEqual({});
    expect(parseLanguageDistribution('   ')).toEqual({});
  });

  it('parses single pair', () => {
    expect(parseLanguageDistribution('java=1000')).toEqual({ java: 1000 });
  });

  it('parses multiple lang=num; pairs', () => {
    expect(parseLanguageDistribution('java=1234;javascript=567;python=890')).toEqual({
      java: 1234,
      javascript: 567,
      python: 890,
    });
  });

  it('handles malformed pairs (skips invalid)', () => {
    expect(parseLanguageDistribution('java=100;=200;py=;ts=300')).toEqual({
      java: 100,
      ts: 300,
    });
  });

  it('trims language names', () => {
    expect(parseLanguageDistribution('  java  =100')).toEqual({ java: 100 });
  });

  it('ignores non-numeric loc', () => {
    expect(parseLanguageDistribution('java=abc')).toEqual({});
  });
});

describe('getTotalNLOC', () => {
  it('returns 0 for empty distribution', () => {
    expect(getTotalNLOC({})).toBe(0);
  });

  it('returns sum of LOC from parsed distribution', () => {
    const dist = parseLanguageDistribution('java=1000;javascript=500;python=200');
    expect(getTotalNLOC(dist)).toBe(1700);
  });
});

describe('getLanguagePercentages', () => {
  it('returns empty object when total is 0', () => {
    expect(getLanguagePercentages({})).toEqual({});
  });

  it('returns correct percentages from parsed distribution', () => {
    const dist = parseLanguageDistribution('java=500;javascript=300;python=200');
    const pct = getLanguagePercentages(dist);
    expect(pct.java).toBeCloseTo(50, 1);
    expect(pct.javascript).toBeCloseTo(30, 1);
    expect(pct.python).toBeCloseTo(20, 1);
  });
});

describe('sortLanguagesByLOC', () => {
  it('returns entries sorted by LOC descending', () => {
    const dist = parseLanguageDistribution('java=100;javascript=500;python=200');
    expect(sortLanguagesByLOC(dist)).toEqual([
      ['javascript', 500],
      ['python', 200],
      ['java', 100],
    ]);
  });

  it('returns empty array for empty distribution', () => {
    expect(sortLanguagesByLOC({})).toEqual([]);
  });
});

describe('formatLargeNumber', () => {
  it('formats millions with M', () => {
    expect(formatLargeNumber(1000000)).toBe('1.0M');
    expect(formatLargeNumber(2500000)).toBe('2.5M');
  });

  it('formats thousands with K', () => {
    expect(formatLargeNumber(1000)).toBe('1.0K');
    expect(formatLargeNumber(5500)).toBe('5.5K');
  });

  it('returns string of number below 1000', () => {
    expect(formatLargeNumber(999)).toBe('999');
    expect(formatLargeNumber(0)).toBe('0');
  });
});

describe('formatCompactLoc', () => {
  it('formats thousands with k', () => {
    expect(formatCompactLoc(1000)).toBe('1k');
    expect(formatCompactLoc(223688)).toBe('223.7k');
    expect(formatCompactLoc(999)).toBe('999');
  });

  it('formats millions with m', () => {
    expect(formatCompactLoc(1000000)).toBe('1m');
    expect(formatCompactLoc(1500000)).toBe('1.5m');
    expect(formatCompactLoc(1234567)).toBe('1.2m');
  });

  it('formats billions with b and trillions with t', () => {
    expect(formatCompactLoc(1e9)).toBe('1b');
    expect(formatCompactLoc(2.5e9)).toBe('2.5b');
    expect(formatCompactLoc(1e12)).toBe('1t');
    expect(formatCompactLoc(1.1e12)).toBe('1.1t');
  });

  it('returns number as string below 1000', () => {
    expect(formatCompactLoc(0)).toBe('0');
    expect(formatCompactLoc(1)).toBe('1');
    expect(formatCompactLoc(999)).toBe('999');
  });

  it('handles negative and non-finite as 0', () => {
    expect(formatCompactLoc(-100)).toBe('0');
    expect(formatCompactLoc(Number.NaN)).toBe('0');
  });
});

describe('formatNumberWithCommas', () => {
  it('adds thousand separators', () => {
    expect(formatNumberWithCommas(1234567)).toBe('1,234,567');
    expect(formatNumberWithCommas(1000)).toBe('1,000');
  });

  it('handles small numbers', () => {
    expect(formatNumberWithCommas(0)).toBe('0');
    expect(formatNumberWithCommas(99)).toBe('99');
  });
});

describe('calculatePercentageChange', () => {
  it('returns 100 when oldValue is 0 and newValue > 0', () => {
    expect(calculatePercentageChange(0, 50)).toBe(100);
  });

  it('returns 0 when oldValue is 0 and newValue is 0', () => {
    expect(calculatePercentageChange(0, 0)).toBe(0);
  });

  it('returns positive change', () => {
    expect(calculatePercentageChange(100, 150)).toBe(50);
  });

  it('returns negative change', () => {
    expect(calculatePercentageChange(100, 50)).toBe(-50);
  });
});

describe('formatPercentage', () => {
  it('formats with 1 decimal by default', () => {
    expect(formatPercentage(33.456)).toBe('33.5%');
  });

  it('respects decimals parameter', () => {
    expect(formatPercentage(33.456, 2)).toBe('33.46%');
    expect(formatPercentage(33.456, 0)).toBe('33%');
  });
});

describe('groupBy', () => {
  it('groups by key from keyGetter', () => {
    const items = [
      { type: 'a', id: 1 },
      { type: 'b', id: 2 },
      { type: 'a', id: 3 },
    ];
    const result = groupBy(items, (x) => x.type);
    expect(result.a).toHaveLength(2);
    expect(result.b).toHaveLength(1);
    expect(result.a.map((x) => x.id)).toEqual([1, 3]);
    expect(result.b[0].id).toBe(2);
  });

  it('returns empty object for empty array', () => {
    expect(groupBy([], (x: { k: string }) => x.k)).toEqual({});
  });
});
