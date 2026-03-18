/**
 * Billing-specific hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTagMappings,
  saveTagMapping,
  deleteTagMapping,
  importTagMappings,
  getBillingConfig,
  saveBillingConfig,
  getCostCenters,
  saveCostCenter,
  deleteCostCenter,
  getCostCenterAssignments,
  saveCostCenterAssignment,
  deleteCostCenterAssignment,
} from '../services/db';

/**
 * Get all tag mappings
 */
export function useTagMappings() {
  return useQuery({
    queryKey: ['tagMappings'],
    queryFn: getTagMappings,
  });
}

/**
 * Save tag mapping mutation
 */
export function useSaveTagMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveTagMapping,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tagMappings'] });
    },
  });
}

/**
 * Delete tag mapping mutation
 */
export function useDeleteTagMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTagMapping,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tagMappings'] });
    },
  });
}

/**
 * Import tag mappings mutation
 */
export function useImportTagMappings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importTagMappings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tagMappings'] });
    },
  });
}

/**
 * Get billing configuration
 */
export function useBillingConfig() {
  return useQuery({
    queryKey: ['billingConfig'],
    queryFn: getBillingConfig,
  });
}

/**
 * Save billing configuration mutation
 */
export function useSaveBillingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveBillingConfig,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billingConfig'] });
    },
  });
}

/**
 * Cost Centers
 */
export function useCostCenters() {
  return useQuery({
    queryKey: ['costCenters'],
    queryFn: getCostCenters,
  });
}

export function useCostCenterAssignments(costCenterId?: string) {
  return useQuery({
    queryKey: ['costCenterAssignments', costCenterId ?? 'all'],
    queryFn: () => getCostCenterAssignments(costCenterId),
  });
}

export function useSaveCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveCostCenter,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['costCenters'] });
      void queryClient.invalidateQueries({ queryKey: ['costCenterAssignments'] });
    },
  });
}

export function useDeleteCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCostCenter,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['costCenters'] });
      void queryClient.invalidateQueries({ queryKey: ['costCenterAssignments'] });
    },
  });
}

export function useSaveCostCenterAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveCostCenterAssignment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['costCenterAssignments'] });
    },
  });
}

export function useDeleteCostCenterAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCostCenterAssignment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['costCenterAssignments'] });
    },
  });
}
