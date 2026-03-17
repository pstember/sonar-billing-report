/**
 * SonarCloud API Type Definitions
 * Based on SonarCloud REST API v1
 */

export interface SonarCloudConfig {
  baseUrl: string;
  token: string;
  organization?: string;
  enterpriseKey?: string; // NEW - for enterprise-level access
}

export interface Paging {
  pageIndex: number;
  pageSize: number;
  total: number;
}

export interface Organization {
  key: string;
  name: string;
  description?: string;
  url?: string;
  avatar?: string;
  // Additional fields that might be in the response
  id?: string; // Internal organization ID (e.g., "AZy9bfTRc6mNMozJJ_jn")
  uuidV4?: string; // UUID v4 (e.g., "452ade58-23a5-4047-adb1-3af0606bdd7a")
  alm?: {
    key: string;
    url: string;
    membersSync?: boolean;
  };
  guarded?: boolean;
  subscription?: string;
  [key: string]: any; // Allow additional fields
}

export interface OrganizationDetails {
  organization: Organization & {
    id: string; // UUID for billing API
  };
}

export interface OrganizationsResponse {
  organizations: Organization[];
  paging: Paging;
}

export interface Project {
  key: string;
  name: string;
  qualifier: string;
  visibility: 'public' | 'private';
  lastAnalysisDate?: string;
  revision?: string;
  tags?: string[];
}

export interface ProjectsSearchResponse {
  paging: Paging;
  components: Project[];
}

export interface ProjectTag {
  tag: string;
}

export interface ProjectTagsResponse {
  tags: string[];
}

export interface Portfolio {
  key: string;
  name: string;
  qualifier: 'VW' | 'SVW'; // VW = Portfolio, SVW = Sub-Portfolio
  visibility: 'public' | 'private';
}

export interface PortfoliosResponse {
  components: Portfolio[];
  paging: Paging;
}

export interface Measure {
  metric: string;
  value?: string;
  periods?: MeasurePeriod[];
  bestValue?: boolean;
}

export interface MeasurePeriod {
  index: number;
  value: string;
}

export interface MeasuresComponent {
  key: string;
  name: string;
  qualifier: string;
  measures: Measure[];
}

export interface MeasuresComponentResponse {
  component: MeasuresComponent;
  metrics: MetricDefinition[];
}

export interface HistoryMeasure {
  metric: string;
  history: HistoryPoint[];
}

export interface HistoryPoint {
  date: string;
  value: string;
}

export interface MeasuresHistoryResponse {
  paging: Paging;
  measures: HistoryMeasure[];
}

export interface MetricDefinition {
  key: string;
  name: string;
  description: string;
  domain: string;
  type: string;
  higherValuesAreBetter: boolean;
  qualitative: boolean;
  hidden: boolean;
  custom: boolean;
}

export interface ComponentTreeItem {
  key: string;
  name: string;
  qualifier: string;
  path?: string;
  language?: string;
  measures?: Measure[];
}

export interface MeasuresComponentTreeResponse {
  paging: Paging;
  baseComponent: ComponentTreeItem;
  components: ComponentTreeItem[];
}

/**
 * Parsed language distribution
 * Example: { "java": 1234, "javascript": 567, "python": 890 }
 */
export interface LanguageDistribution {
  [language: string]: number;
}

/**
 * API Error Response
 */
export interface SonarCloudError {
  errors: Array<{
    msg: string;
  }>;
}

/**
 * Common metric keys used in the application
 */
export const METRIC_KEYS = {
  NCLOC: 'ncloc',
  LINES: 'lines',
  NCLOC_LANGUAGE_DISTRIBUTION: 'ncloc_language_distribution',
  NEW_LINES: 'new_lines',
  NEW_NCLOC: 'new_ncloc',
  ALERT_STATUS: 'alert_status',
  QUALITY_GATE_DETAILS: 'quality_gate_details',
} as const;

export type MetricKey = typeof METRIC_KEYS[keyof typeof METRIC_KEYS];

/**
 * Billing API Types
 */

// NCLOC Distribution per project
export interface NCLOCDistributionProject {
  projectKey: string;
  projectName: string;
  ncloc: number;
  visibility: 'public' | 'private';
}

export interface NCLOCDistributionResponse {
  paging: Paging;
  projects: NCLOCDistributionProject[];
}

// Consumption Summary
export interface ConsumptionSummary {
  usage: number; // LOC currently used
  allowance: number; // LOC limit/allowance
  usagePercentage: number;
  key: string; // e.g., "linesOfCode"
  resourceId: string; // Organization UUID
  resourceType: string; // e.g., "organization"
  consumptionType: string; // e.g., "snapshot"
  mode: string; // e.g., "absoluteReserved"
  parentResourceId?: string;
  parentResourceType?: string;
  quotaId?: string;
}

export interface ConsumptionSummariesResponse {
  consumptionSummaries: ConsumptionSummary[]; // API returns consumptionSummaries, not summaries
  page: Paging;
}

// Enterprise API Types
export interface Enterprise {
  id: string; // Enterprise UUID
  key: string; // Enterprise key (e.g., "sonar-demos")
  name: string; // Display name
  defaultPortfolioPermissionTemplateId?: string;
}

export interface EnterprisesResponse {
  enterprises: Enterprise[];
}

export interface EnterpriseOrganization {
  enterpriseOrganizationId: string;
  enterpriseId: string;
  organizationId: string; // Internal SonarCloud ID
  organizationUuidV4: string; // UUID for billing API
  // API might return additional fields - allow any
  [key: string]: any;
}

export interface EnterpriseOrganizationsResponse {
  organizations: EnterpriseOrganization[];
}

export interface OrganizationWithUUID extends Organization {
  uuid?: string; // Matched from enterprise API
}
