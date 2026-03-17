/**
 * Billing and Cost Allocation Type Definitions
 */

/** @deprecated Use CostCenter + CostCenterAssignment instead. Kept for migration. */
export interface TagMapping {
  tag: string;
  teamName: string;
  costCenter?: string;
  percentage?: number; // For shared projects, defaults to 100
  notes?: string;
}

export interface CostCenter {
  id: string;
  name: string;
  code?: string;
}

export type CostCenterAssignmentType = 'project' | 'tag';

export interface CostCenterAssignment {
  id: string;
  costCenterId: string;
  type: CostCenterAssignmentType;
  projectKey?: string; // when type === 'project'
  tag?: string;       // when type === 'tag'
  allocationPercentage: number; // 0-100
}

export interface CostRate {
  id: string;
  name: string;
  ratePerKLOC: number; // Cost per 1000 lines of code
  language?: string; // Optional language-specific rate
  effectiveFrom?: string; // ISO date string
  effectiveTo?: string; // ISO date string
}

export interface TieredPricingRule {
  minLOC: number;
  maxLOC?: number;
  ratePerKLOC: number;
}

export interface BillingConfiguration {
  /** Total license/contract value (known figure). Used for license-share cost allocation. */
  contractValue?: number;
  /** Price per 1k LOC (optional fallback when contract value not set). Derived from contractValue/totalScopeLoc when contract value is set. */
  defaultRate?: number;
  languageRates?: Record<string, number>;
  tieredPricing?: TieredPricingRule[];
  currency: string;
}

export interface ProjectBillingData {
  projectKey: string;
  projectName: string;
  tags: string[];
  ncloc: number;
  languageDistribution: Record<string, number>;
  lastAnalysisDate?: string;
  teamAllocations: TeamAllocation[];
}

export interface TeamAllocation {
  teamName: string;
  tag: string;
  percentage: number;
  ncloc: number;
  cost: number;
}

export interface TeamBillingSummary {
  teamName: string;
  tags: string[];
  totalNLOC: number;
  totalCost: number;
  projectCount: number;
  languageBreakdown: Record<string, number>;
  projects: ProjectBillingData[];
}

export interface BillingPeriod {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  label: string; // e.g., "January 2024", "Q1 2024"
}

export interface BillingReport {
  period: BillingPeriod;
  generatedAt: string;
  teamSummaries: TeamBillingSummary[];
  totalNLOC: number;
  totalCost: number;
  unallocatedNLOC: number;
  unallocatedProjects: string[];
}

export interface HistoricalSnapshot {
  date: string;
  teamName: string;
  ncloc: number;
  cost: number;
}

export interface TrendData {
  teamName: string;
  data: Array<{
    date: string;
    ncloc: number;
    cost: number;
  }>;
  growth: {
    absolute: number; // Change in NLOC
    percentage: number; // % change
  };
}
