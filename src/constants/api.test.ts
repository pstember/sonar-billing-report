import { describe, it, expect } from 'vitest';
import {
  getValidPageSize,
  getPaginationConfig,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './api';

describe('getValidPageSize', () => {
  it('returns DEFAULT_PAGE_SIZE when requestedSize is undefined', () => {
    expect(getValidPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('returns 50 when requestedSize is 50', () => {
    expect(getValidPageSize(50)).toBe(50);
  });

  it('returns 100 when requestedSize is 100', () => {
    expect(getValidPageSize(100)).toBe(MAX_PAGE_SIZE);
  });

  it('caps at MAX_PAGE_SIZE when requestedSize exceeds 100', () => {
    expect(getValidPageSize(150)).toBe(MAX_PAGE_SIZE);
    expect(getValidPageSize(500)).toBe(MAX_PAGE_SIZE);
  });
});

describe('getPaginationConfig', () => {
  it('caps pageSize at MAX_PAGE_SIZE', () => {
    const config = getPaginationConfig(500, 200);
    expect(config.pageSize).toBe(MAX_PAGE_SIZE);
    expect(config.totalPages).toBe(5);
    expect(config.pages).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns correct totalPages and pages for exact fit', () => {
    const config = getPaginationConfig(100, 50);
    expect(config.pageSize).toBe(50);
    expect(config.totalPages).toBe(2);
    expect(config.pages).toEqual([1, 2]);
  });

  it('returns correct totalPages and pages when remainder exists', () => {
    const config = getPaginationConfig(75, 50);
    expect(config.pageSize).toBe(50);
    expect(config.totalPages).toBe(2);
    expect(config.pages).toEqual([1, 2]);
  });

  it('uses DEFAULT_PAGE_SIZE when pageSize not provided', () => {
    const config = getPaginationConfig(100);
    expect(config.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(config.totalPages).toBe(2);
    expect(config.pages).toEqual([1, 2]);
  });

  it('returns one page when totalItems is less than pageSize', () => {
    const config = getPaginationConfig(10, 50);
    expect(config.pageSize).toBe(50);
    expect(config.totalPages).toBe(1);
    expect(config.pages).toEqual([1]);
  });

  it('returns one page when totalItems is 0', () => {
    const config = getPaginationConfig(0, 50);
    expect(config.totalPages).toBe(0);
    expect(config.pages).toEqual([]);
  });
});
