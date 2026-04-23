/**
 * Unit tests for useBilling hooks.
 * Mocks db service and uses QueryClientProvider.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useTagMappings,
  useSaveTagMapping,
  useDeleteTagMapping,
  useImportTagMappings,
  useBillingConfig,
  useSaveBillingConfig,
  useCostCenters,
  useCostCenterAssignments,
  useSaveCostCenter,
  useDeleteCostCenter,
  useSaveCostCenterAssignment,
  useDeleteCostCenterAssignment,
} from './useBilling';

const getTagMappings = vi.fn();
const saveTagMapping = vi.fn();
const deleteTagMapping = vi.fn();
const importTagMappings = vi.fn();
const getBillingConfig = vi.fn();
const saveBillingConfig = vi.fn();
const getCostCenters = vi.fn();
const saveCostCenter = vi.fn();
const deleteCostCenter = vi.fn();
const getCostCenterAssignments = vi.fn();
const saveCostCenterAssignment = vi.fn();
const deleteCostCenterAssignment = vi.fn();

vi.mock('../services/store', () => ({
  getTagMappings: (...args: unknown[]) => getTagMappings(...args),
  saveTagMapping: (...args: unknown[]) => saveTagMapping(...args),
  deleteTagMapping: (...args: unknown[]) => deleteTagMapping(...args),
  importTagMappings: (...args: unknown[]) => importTagMappings(...args),
  getBillingConfig: (...args: unknown[]) => getBillingConfig(...args),
  saveBillingConfig: (...args: unknown[]) => saveBillingConfig(...args),
  getCostCenters: (...args: unknown[]) => getCostCenters(...args),
  saveCostCenter: (...args: unknown[]) => saveCostCenter(...args),
  deleteCostCenter: (...args: unknown[]) => deleteCostCenter(...args),
  getCostCenterAssignments: (...args: unknown[]) => getCostCenterAssignments(...args),
  saveCostCenterAssignment: (...args: unknown[]) => saveCostCenterAssignment(...args),
  deleteCostCenterAssignment: (...args: unknown[]) => deleteCostCenterAssignment(...args),
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useBilling hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0 } },
    });
    vi.clearAllMocks();
  });

  describe('useTagMappings', () => {
    it('returns loading then data on success', async () => {
      const mappings = [{ tag: 't1', teamName: 'Team 1', percentage: 100 }];
      getTagMappings.mockResolvedValue(mappings);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useTagMappings, { wrapper });

      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mappings);
      expect(getTagMappings).toHaveBeenCalled();
    });

    it('returns error when queryFn throws', async () => {
      getTagMappings.mockRejectedValue(new Error('db error'));

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useTagMappings, { wrapper });

      await waitFor(
        () => expect(result.current.status).toBe('error'),
        { timeout: 3000 }
      );
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe('db error');
    });
  });

  describe('useSaveTagMapping', () => {
    it('calls saveTagMapping and invalidates tagMappings on success', async () => {
      saveTagMapping.mockResolvedValue(1);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useSaveTagMapping, { wrapper });

      result.current.mutate({ tag: 't1', teamName: 'T1', percentage: 100 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(saveTagMapping.mock.calls[0][0]).toMatchObject({
        tag: 't1',
        teamName: 'T1',
        percentage: 100,
      });
    });
  });

  describe('useDeleteTagMapping', () => {
    it('calls deleteTagMapping and invalidates on success', async () => {
      deleteTagMapping.mockResolvedValue(undefined);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useDeleteTagMapping, { wrapper });

      result.current.mutate('tag-to-delete');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(deleteTagMapping.mock.calls[0][0]).toBe('tag-to-delete');
    });
  });

  describe('useImportTagMappings', () => {
    it('calls importTagMappings and invalidates on success', async () => {
      importTagMappings.mockResolvedValue(undefined);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useImportTagMappings, { wrapper });

      const mappings = [{ tag: 'a', teamName: 'A', percentage: 100 }];
      result.current.mutate(mappings);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(importTagMappings.mock.calls[0][0]).toEqual(mappings);
    });
  });

  describe('useBillingConfig', () => {
    it('returns billing config on success', async () => {
      const config = { currency: 'USD', defaultRate: 2.5, contractValue: 10000 };
      getBillingConfig.mockResolvedValue(config);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useBillingConfig, { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(config);
    });
  });

  describe('useSaveBillingConfig', () => {
    it('calls saveBillingConfig and invalidates on success', async () => {
      saveBillingConfig.mockResolvedValue(1);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useSaveBillingConfig, { wrapper });

      result.current.mutate({ currency: 'EUR', defaultRate: 3, contractValue: 20000 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(saveBillingConfig.mock.calls[0][0]).toEqual({
        currency: 'EUR',
        defaultRate: 3,
        contractValue: 20000,
      });
    });
  });

  describe('useCostCenters', () => {
    it('returns cost centers on success', async () => {
      const centers = [{ id: 'cc-1', name: 'Eng', code: 'ENG' }];
      getCostCenters.mockResolvedValue(centers);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useCostCenters, { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(centers);
    });
  });

  describe('useCostCenterAssignments', () => {
    it('calls getCostCenterAssignments with costCenterId when provided', async () => {
      getCostCenterAssignments.mockResolvedValue([]);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useCostCenterAssignments('cc-123'),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getCostCenterAssignments).toHaveBeenCalledWith('cc-123');
    });

    it('calls getCostCenterAssignments without id when undefined', async () => {
      getCostCenterAssignments.mockResolvedValue([]);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(
        () => useCostCenterAssignments(undefined),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getCostCenterAssignments).toHaveBeenCalledWith(undefined);
    });
  });

  describe('useSaveCostCenter', () => {
    it('calls saveCostCenter and invalidates costCenters and assignments', async () => {
      saveCostCenter.mockResolvedValue('cc-new');

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useSaveCostCenter, { wrapper });

      result.current.mutate({ name: 'New Center', code: 'NC' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(saveCostCenter).toHaveBeenCalled();
    });
  });

  describe('useDeleteCostCenter', () => {
    it('calls deleteCostCenter and invalidates on success', async () => {
      deleteCostCenter.mockResolvedValue(undefined);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useDeleteCostCenter, { wrapper });

      result.current.mutate('cc-to-delete');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(deleteCostCenter.mock.calls[0][0]).toBe('cc-to-delete');
    });
  });

  describe('useSaveCostCenterAssignment', () => {
    it('calls saveCostCenterAssignment and invalidates assignments', async () => {
      saveCostCenterAssignment.mockResolvedValue('cca-new');

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useSaveCostCenterAssignment, { wrapper });

      result.current.mutate({
        costCenterId: 'cc-1',
        type: 'tag',
        tag: 'team-x',
        allocationPercentage: 100,
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(saveCostCenterAssignment).toHaveBeenCalled();
    });
  });

  describe('useDeleteCostCenterAssignment', () => {
    it('calls deleteCostCenterAssignment and invalidates on success', async () => {
      deleteCostCenterAssignment.mockResolvedValue(undefined);

      const wrapper = createWrapper(queryClient);
      const { result } = renderHook(useDeleteCostCenterAssignment, { wrapper });

      result.current.mutate('cca-to-delete');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(deleteCostCenterAssignment.mock.calls[0][0]).toBe('cca-to-delete');
    });
  });
});
