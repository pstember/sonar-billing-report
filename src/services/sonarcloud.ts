/**
 * SonarQube Cloud API Service
 * Handles all API communication with SonarQube Cloud
 */

import type {
  SonarCloudConfig,
  Organization,
  OrganizationsResponse,
  ProjectsSearchResponse,
  ProjectTagsResponse,
  MeasuresComponentResponse,
  MeasuresHistoryResponse,
  SonarCloudError,
  Project,
  NCLOCDistributionResponse,
  ConsumptionSummariesResponse,
  OrganizationDetails,
  Enterprise,
  EnterpriseOrganization,
} from '../types/sonarcloud';
import { MAX_PAGE_SIZE } from '../constants/api';

// Use empty string to use same origin (our proxy server)
// When app runs on http://localhost:3000, API calls go to http://localhost:3000/api/*
// The server then proxies to https://sonarcloud.io/api/*
const DEFAULT_BASE_URL = '';
const API_VERSION = '/api';

class SonarCloudService {
  private config: SonarCloudConfig;

  constructor(config: SonarCloudConfig) {
    this.config = {
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      token: config.token,
      organization: config.organization,
    };
  }

  /**
   * Update configuration (e.g., when token changes)
   */
  updateConfig(config: Partial<SonarCloudConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate Basic Auth header (SonarQube Cloud uses Basic auth with token:empty_password)
   */
  private getAuthHeader(): string {
    // SonarQube Cloud expects: Basic base64(token:)
    const credentials = btoa(`${this.config.token}:`);
    return `Basic ${credentials}`;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${API_VERSION}${endpoint}`;

    const headers = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = (await response.json()) as SonarCloudError;
          errorMessage = errorData.errors?.[0]?.msg ?? errorMessage;
        } catch {
          // Error body may be non-JSON (e.g. HTML); keep status text
        }
        throw new Error(errorMessage);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred', { cause: error });
    }
  }

  /**
   * Make authenticated billing API request (no /api prefix)
   * Used for api.sonarcloud.io/billing/* endpoints
   */
  private async billingRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth = true
  ): Promise<T> {
    // Billing API doesn't use /api prefix - goes directly to /billing/*
    const url = `${this.config.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Only add Authorization if required (some endpoints like organizations don't need it)
    if (requireAuth) {
      headers.Authorization = this.getAuthHeader();
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = (await response.json()) as SonarCloudError;
          errorMessage = errorData.errors?.[0]?.msg ?? errorMessage;
        } catch {
          // Error body may be non-JSON (e.g. HTML); keep status text
        }
        throw new Error(errorMessage);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred', { cause: error });
    }
  }

  /**
   * Search organizations
   */
  async searchOrganizations(params: {
    member?: boolean;
    organizations?: string;
  } = {}): Promise<OrganizationsResponse> {
    const searchParams = new URLSearchParams();

    // Default to member=true if no parameters provided
    const member = params.member ?? true;
    searchParams.append('member', member.toString());

    if (params.organizations) {
      searchParams.append('organizations', params.organizations);
    }

    return this.request<OrganizationsResponse>(
      `/organizations/search?${searchParams.toString()}`
    );
  }

  /**
   * Get organizations by IDs (UUIDs, UUIDv4s, or keys)
   * More efficient than searchOrganizations for known organization identifiers
   * NOTE: This endpoint is on api.sonarcloud.io (NOT sonarcloud.io/api)
   * NOTE: This endpoint returns an array directly, not wrapped in { organizations: [] }
   */
  async getOrganizationsByIds(ids: string[]): Promise<Organization[]> {
    const searchParams = new URLSearchParams();
    searchParams.append('ids', ids.join(','));

    return this.billingRequest<Organization[]>(
      `/organizations/organizations?${searchParams.toString()}`,
      {},
      true
    );
  }

  /**
   * Get enterprise details
   * Returns array with enterprise ID and metadata
   */
  async getEnterpriseDetails(enterpriseKey?: string): Promise<Enterprise[]> {
    const entKey = enterpriseKey ?? this.config.enterpriseKey;
    const searchParams = new URLSearchParams();

    if (entKey) {
      searchParams.append('enterpriseKey', entKey);
    }

    // This endpoint is on api.sonarcloud.io (not sonarcloud.io)
    return this.billingRequest<Enterprise[]>(
      `/enterprises/enterprises${searchParams.toString() ? '?' + searchParams.toString() : ''}`,
      {},
      true // Requires Bearer token
    );
  }

  /**
   * Get all organizations in an enterprise with their UUIDs.
   * Uses enterpriseId (UUID from enterprises/enterprises), not enterpriseKey.
   */
  async getEnterpriseOrganizations(enterpriseId: string): Promise<EnterpriseOrganization[]> {
    const searchParams = new URLSearchParams();
    searchParams.append('enterpriseId', enterpriseId);

    return this.billingRequest<EnterpriseOrganization[]>(
      `/enterprises/enterprise-organizations?${searchParams.toString()}`,
      {},
      true // Requires Bearer token
    );
  }

  /**
   * Get organization details including UUID (needed for billing API)
   * Endpoint: api.sonarcloud.io/organizations/organizations
   * NOTE: This requires browser session cookies - not usable with Bearer token
   */
  async getOrganizationDetails(organizationKey?: string): Promise<OrganizationDetails> {
    const orgKey = organizationKey ?? this.config.organization;
    const searchParams = new URLSearchParams({
      organizationKey: orgKey ?? '',
      excludeEligibility: 'true',
    });

    // This endpoint is on api.sonarcloud.io (not sonarcloud.io)
    return this.billingRequest<OrganizationDetails>(
      `/organizations/organizations?${searchParams.toString()}`,
      {},
      true // Uses Bearer token like other APIs
    );
  }

  /**
   * Search projects in an organization
   * Uses components/search_projects which includes tags
   */
  async searchProjects(params: {
    organization?: string;
    p?: number; // page number
    ps?: number; // page size
  } = {}): Promise<ProjectsSearchResponse> {
    const searchParams = new URLSearchParams();

    const org = params.organization ?? this.config.organization;
    if (org) searchParams.append('organization', org);
    if (params.p) searchParams.append('p', params.p.toString());
    if (params.ps) searchParams.append('ps', params.ps.toString());

    // Use components/search_projects instead of projects/search to get tags
    return this.request<ProjectsSearchResponse>(
      `/components/search_projects?${searchParams.toString()}`
    );
  }

  /**
   * Search all projects in an organization (paginates until every page is fetched, max 100 per request).
   */
  async searchProjectsAll(params: { organization?: string } = {}): Promise<ProjectsSearchResponse> {
    const ps = MAX_PAGE_SIZE;
    let page = 1;
    const components: Project[] = [];
    let total = 0;
    const maxPages = 500;

    for (;;) {
      const res = await this.searchProjects({
        organization: params.organization,
        p: page,
        ps,
      });
      const batch = res.components ?? [];
      components.push(...batch);
      total = res.paging?.total ?? components.length;
      if (batch.length === 0 || batch.length < ps || components.length >= total || page >= maxPages) {
        break;
      }
      page += 1;
    }

    return {
      components,
      paging: {
        pageIndex: 1,
        pageSize: ps,
        total,
      },
    };
  }

  /**
   * Get all project tags in an organization
   */
  async getProjectTags(params: {
    organization?: string;
    ps?: number;
  } = {}): Promise<ProjectTagsResponse> {
    const searchParams = new URLSearchParams();

    const org = params.organization ?? this.config.organization;
    if (org) searchParams.append('organization', org);
    if (params.ps) searchParams.append('ps', params.ps.toString());

    return this.request<ProjectTagsResponse>(
      `/project_tags/search?${searchParams.toString()}`
    );
  }

  /**
   * Get details for a specific component (project)
   */
  async getComponentDetails(componentKey: string): Promise<{ component: Project }> {
    const searchParams = new URLSearchParams({
      component: componentKey,
    });

    return this.request<{ component: Project }>(
      `/components/show?${searchParams.toString()}`
    );
  }

  /**
   * Get measures for a component (project or portfolio)
   */
  async getComponentMeasures(params: {
    component: string;
    metricKeys: string[];
  }): Promise<MeasuresComponentResponse> {
    const searchParams = new URLSearchParams({
      component: params.component,
      metricKeys: params.metricKeys.join(','),
    });

    return this.request<MeasuresComponentResponse>(
      `/measures/component?${searchParams.toString()}`
    );
  }

  /**
   * Get historical measures for a component
   */
  async getComponentHistory(params: {
    component: string;
    metrics: string[];
    from?: string; // ISO date
    to?: string; // ISO date
    p?: number;
    ps?: number;
  }): Promise<MeasuresHistoryResponse> {
    const searchParams = new URLSearchParams({
      component: params.component,
      metrics: params.metrics.join(','),
    });

    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);
    if (params.p) searchParams.append('p', params.p.toString());
    if (params.ps) searchParams.append('ps', params.ps.toString());

    return this.request<MeasuresHistoryResponse>(
      `/measures/search_history?${searchParams.toString()}`
    );
  }

  /**
   * Get NCLOC distribution for billing
   * Shows per-project LOC with visibility (private projects count toward billing)
   */
  async getBillingNCLOCDistribution(params: {
    organization?: string;
    p?: number;
    ps?: number;
  } = {}): Promise<NCLOCDistributionResponse> {
    const searchParams = new URLSearchParams();

    const org = params.organization ?? this.config.organization;
    if (org) searchParams.append('organization', org);
    if (params.p) searchParams.append('p', params.p.toString());
    if (params.ps) searchParams.append('ps', params.ps.toString());

    return this.request<NCLOCDistributionResponse>(
      `/billing/get_ncloc_distribution?${searchParams.toString()}`
    );
  }

  /**
   * Full NCLOC distribution for an organization (paginates with ps = MAX_PAGE_SIZE until all rows are fetched).
   */
  async getBillingNCLOCDistributionAll(params: { organization?: string } = {}): Promise<NCLOCDistributionResponse> {
    const ps = MAX_PAGE_SIZE;
    let page = 1;
    const projects: NCLOCDistributionResponse['projects'] = [];
    let total = 0;
    const maxPages = 500;

    for (;;) {
      const res = await this.getBillingNCLOCDistribution({
        organization: params.organization,
        p: page,
        ps,
      });
      const batch = res.projects ?? [];
      projects.push(...batch);
      total = res.paging?.total ?? projects.length;
      if (batch.length === 0 || batch.length < ps || projects.length >= total || page >= maxPages) {
        break;
      }
      page += 1;
    }

    return {
      projects,
      paging: {
        pageIndex: 1,
        pageSize: ps,
        total,
      },
    };
  }

  /**
   * Get consumption summaries (LOC consumed vs limit)
   * Supports two modes:
   *   - Per-org: resourceId=<org-uuid>, resourceType=organization
   *   - Enterprise (all orgs): parentResourceId=<enterprise-uuid>, parentResourceType=enterprise, resourceType=organization
   * NOTE: This endpoint is on api.sonarcloud.io (NOT sonarcloud.io/api)
   * Uses billingRequest() which doesn't add /api prefix
   */
  async getConsumptionSummaries(params?: {
    resourceId?: string;
    parentResourceId?: string;
    parentResourceType?: string;
    key?: string;
    resourceType?: string;
    mode?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Promise<ConsumptionSummariesResponse> {
    if (!params?.resourceId && !params?.parentResourceId) {
      throw new Error('resourceId or parentResourceId is required for consumption summaries API');
    }

    const searchParams = new URLSearchParams({
      key: params?.key ?? 'linesOfCode',
      resourceType: params?.resourceType ?? 'organization',
    });

    if (params?.resourceId) searchParams.append('resourceId', params.resourceId);
    if (params?.parentResourceId) searchParams.append('parentResourceId', params.parentResourceId);
    if (params?.parentResourceType) searchParams.append('parentResourceType', params.parentResourceType);
    if (params?.mode) searchParams.append('mode', params.mode);
    if (params?.pageIndex) searchParams.append('pageIndex', params.pageIndex.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    return this.billingRequest<ConsumptionSummariesResponse>(
      `/billing/consumption-summaries?${searchParams.toString()}`
    );
  }

  /**
   * Get consumption summaries for all orgs in an enterprise in a single call.
   * Uses parentResourceId=<enterprise-uuid> so non-member orgs are included.
   * Paginates until all summaries are fetched.
   */
  async getEnterpriseConsumptionSummaries(params: {
    enterpriseId: string;
    key?: string;
  }): Promise<ConsumptionSummariesResponse> {
    const pageSize = 100;
    let pageIndex = 1;
    const allSummaries: ConsumptionSummariesResponse['consumptionSummaries'] = [];

    for (;;) {
      const res = await this.getConsumptionSummaries({
        parentResourceId: params.enterpriseId,
        parentResourceType: 'enterprise',
        resourceType: 'organization',
        key: params.key ?? 'linesOfCode',
        pageIndex,
        pageSize,
      });
      const batch = res.consumptionSummaries ?? [];
      allSummaries.push(...batch);
      const total = res.page?.total ?? allSummaries.length;
      if (batch.length === 0 || batch.length < pageSize || allSummaries.length >= total) break;
      pageIndex += 1;
    }

    return {
      consumptionSummaries: allSummaries,
      page: { pageIndex: 1, pageSize: allSummaries.length, total: allSummaries.length },
    };
  }

  /**
   * Validate token by testing API access
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.searchOrganizations();
      return true;
    } catch {
      return false;
    }
  }
}

export default SonarCloudService;
