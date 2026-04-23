/**
 * Unit tests for SonarCloudService.
 * Uses mocked fetch and fixtures; no production code changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SonarCloudService from './sonarcloud';

import organizationsFixture from '../../fixtures/organizations.json';
import projectsSearchFixture from '../../fixtures/projectsSearch.json';
import projectTagsFixture from '../../fixtures/projectTags.json';
import measuresComponentFixture from '../../fixtures/measuresComponent.json';
import measuresHistoryFixture from '../../fixtures/measuresHistory.json';
import nclocDistributionFixture from '../../fixtures/nclocDistribution.json';
import consumptionSummariesFixture from '../../fixtures/consumptionSummaries.json';
import organizationDetailsFixture from '../../fixtures/organizationDetails.json';
import enterprisesFixture from '../../fixtures/enterprises.json';
import enterpriseOrganizationsFixture from '../../fixtures/enterpriseOrganizations.json';
import sonarCloudErrorFixture from '../../fixtures/sonarCloudError.json';

const BASE_URL = 'https://test.sonarcloud.io';
const TOKEN = 'test-token';

describe('SonarCloudService', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let service: SonarCloudService;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    service = new SonarCloudService({ baseUrl: BASE_URL, token: TOKEN });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockSuccess<T>(body: T) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(body),
    });
  }

  function mockError(msg: string) {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ errors: [{ msg }] }),
    });
  }

  describe('request error handling', () => {
    it('throws with API error message when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ errors: [{ msg: 'Insufficient permissions' }] }),
      });
      await expect(service.searchOrganizations()).rejects.toThrow('Insufficient permissions');
    });

    it('throws with HTTP status fallback when response has no errors array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });
      await expect(service.searchOrganizations()).rejects.toThrow(
        'HTTP 500: Internal Server Error'
      );
    });

    it('throws "An unknown error occurred" when fetch throws non-Error', async () => {
      mockFetch.mockRejectedValueOnce('network failure');
      await expect(service.searchOrganizations()).rejects.toThrow('An unknown error occurred');
    });
  });

  describe('searchOrganizations', () => {
    it('calls correct URL with /api and returns fixture', async () => {
      mockSuccess(organizationsFixture);
      const result = await service.searchOrganizations();
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/organizations/search?member=true`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${btoa(`${TOKEN}:`)}`,
          }),
        })
      );
      expect(result).toEqual(organizationsFixture);
    });

    it('passes member and organizations params', async () => {
      mockSuccess(organizationsFixture);
      await service.searchOrganizations({
        member: false,
        organizations: 'org1,org2',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('member=false'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('organizations=org1%2Corg2'),
        expect.any(Object)
      );
    });
  });

  describe('getOrganizationsByIds', () => {
    it('calls billing URL (no /api) with ids and returns array', async () => {
      const orgs = (organizationsFixture as { organizations: unknown[] }).organizations;
      mockSuccess(orgs);
      const result = await service.getOrganizationsByIds(['id1', 'id2']);
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/organizations/organizations?ids=id1%2Cid2`,
        expect.any(Object)
      );
      expect(result).toEqual(orgs);
    });
  });

  describe('getEnterpriseDetails', () => {
    it('calls billing URL and returns enterprises array', async () => {
      mockSuccess(enterprisesFixture);
      const result = await service.getEnterpriseDetails();
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/enterprises/enterprises`,
        expect.any(Object)
      );
      expect(result).toEqual(enterprisesFixture);
    });

    it('appends enterpriseKey when provided', async () => {
      mockSuccess(enterprisesFixture);
      await service.getEnterpriseDetails('my-enterprise');
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/enterprises/enterprises?enterpriseKey=my-enterprise`,
        expect.any(Object)
      );
    });
  });

  describe('getEnterpriseOrganizations', () => {
    it('calls billing URL with enterpriseId and returns array', async () => {
      mockSuccess(enterpriseOrganizationsFixture);
      const result = await service.getEnterpriseOrganizations('ent-uuid-123');
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/enterprises/enterprise-organizations?enterpriseId=ent-uuid-123`,
        expect.any(Object)
      );
      expect(result).toEqual(enterpriseOrganizationsFixture);
    });
  });

  describe('getOrganizationDetails', () => {
    it('calls billing URL with organizationKey and returns details', async () => {
      mockSuccess(organizationDetailsFixture);
      const result = await service.getOrganizationDetails('my-org');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/organizations?'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('organizationKey=my-org'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('excludeEligibility=true'),
        expect.any(Object)
      );
      expect(result).toEqual(organizationDetailsFixture);
    });

    it('uses config organization when key not provided', async () => {
      service.updateConfig({ organization: 'default-org' });
      mockSuccess(organizationDetailsFixture);
      await service.getOrganizationDetails();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('organizationKey=default-org'),
        expect.any(Object)
      );
    });
  });

  describe('searchProjects', () => {
    it('calls /api/components/search_projects with params and returns fixture', async () => {
      service.updateConfig({ organization: 'my-org' });
      mockSuccess(projectsSearchFixture);
      const result = await service.searchProjects({ p: 1, ps: 50 });
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/components/search_projects?organization=my-org&p=1&ps=50`,
        expect.any(Object)
      );
      expect(result).toEqual(projectsSearchFixture);
    });
  });

  describe('searchProjectsAll', () => {
    it('merges multiple pages when total exceeds first page size', async () => {
      service.updateConfig({ organization: 'my-org' });
      const comp = (projectsSearchFixture as { components: { key: string; name: string; qualifier: string; visibility: string }[] }).components[0];
      const page1 = {
        paging: { pageIndex: 1, pageSize: 100, total: 120 },
        components: Array.from({ length: 100 }, (_, i) => ({
          ...comp,
          key: `my-org_proj-${i}`,
          name: `Project ${i}`,
        })),
      };
      const page2 = {
        paging: { pageIndex: 2, pageSize: 100, total: 120 },
        components: Array.from({ length: 20 }, (_, i) => ({
          ...comp,
          key: `my-org_proj-${100 + i}`,
          name: `Project ${100 + i}`,
        })),
      };
      mockSuccess(page1);
      mockSuccess(page2);
      const result = await service.searchProjectsAll();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.components).toHaveLength(120);
      expect(result.paging.total).toBe(120);
    });

    it('single fetch when all projects fit one page', async () => {
      service.updateConfig({ organization: 'my-org' });
      mockSuccess(projectsSearchFixture);
      const result = await service.searchProjectsAll();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.components).toHaveLength(2);
    });
  });

  describe('getProjectTags', () => {
    it('calls /api/project_tags/search and returns tags', async () => {
      service.updateConfig({ organization: 'my-org' });
      mockSuccess(projectTagsFixture);
      const result = await service.getProjectTags({ ps: 100 });
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/project_tags/search?organization=my-org&ps=100`,
        expect.any(Object)
      );
      expect(result).toEqual(projectTagsFixture);
    });
  });

  describe('getComponentDetails', () => {
    it('calls /api/components/show with component key and returns component', async () => {
      const componentShowFixture = {
        component: (projectsSearchFixture as { components: unknown[] }).components[0],
      };
      mockSuccess(componentShowFixture);
      const result = await service.getComponentDetails('my-org_project-a');
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/components/show?component=my-org_project-a`,
        expect.any(Object)
      );
      expect(result).toEqual(componentShowFixture);
    });
  });

  describe('getComponentMeasures', () => {
    it('calls /api/measures/component with component and metricKeys', async () => {
      mockSuccess(measuresComponentFixture);
      const result = await service.getComponentMeasures({
        component: 'my-org_project-a',
        metricKeys: ['ncloc', 'coverage'],
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/measures/component?'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('component=my-org_project-a'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('metricKeys=ncloc%2Ccoverage'),
        expect.any(Object)
      );
      expect(result).toEqual(measuresComponentFixture);
    });
  });

  describe('getComponentHistory', () => {
    it('calls /api/measures/search_history with params and returns fixture', async () => {
      mockSuccess(measuresHistoryFixture);
      const result = await service.getComponentHistory({
        component: 'my-org_project-a',
        metrics: ['ncloc'],
        from: '2024-01-01',
        to: '2024-03-01',
        p: 1,
        ps: 100,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/measures/search_history?'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('component=my-org_project-a'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('metrics=ncloc'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('from=2024-01-01'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('to=2024-03-01'),
        expect.any(Object)
      );
      expect(result).toEqual(measuresHistoryFixture);
    });
  });

  describe('getBillingNCLOCDistribution', () => {
    it('calls /api/billing/get_ncloc_distribution and returns fixture', async () => {
      service.updateConfig({ organization: 'my-org' });
      mockSuccess(nclocDistributionFixture);
      const result = await service.getBillingNCLOCDistribution({ p: 1, ps: 100 });
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/billing/get_ncloc_distribution?organization=my-org&p=1&ps=100`,
        expect.any(Object)
      );
      expect(result).toEqual(nclocDistributionFixture);
    });
  });

  describe('getBillingNCLOCDistributionAll', () => {
    it('merges multiple pages when total exceeds first page size', async () => {
      service.updateConfig({ organization: 'my-org' });
      const page1 = {
        paging: { pageIndex: 1, pageSize: 100, total: 150 },
        projects: Array.from({ length: 100 }, (_, i) => ({
          projectKey: `k${i}`,
          projectName: `P${i}`,
          ncloc: 1,
          visibility: 'private' as const,
        })),
      };
      const page2 = {
        paging: { pageIndex: 2, pageSize: 100, total: 150 },
        projects: Array.from({ length: 50 }, (_, i) => ({
          projectKey: `k${100 + i}`,
          projectName: `P${100 + i}`,
          ncloc: 1,
          visibility: 'private' as const,
        })),
      };
      mockSuccess(page1);
      mockSuccess(page2);
      const result = await service.getBillingNCLOCDistributionAll();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.projects).toHaveLength(150);
      expect(result.paging.total).toBe(150);
    });

    it('single fetch when first page contains all rows', async () => {
      service.updateConfig({ organization: 'my-org' });
      mockSuccess(nclocDistributionFixture);
      const result = await service.getBillingNCLOCDistributionAll();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.projects).toHaveLength(2);
    });
  });

  describe('getConsumptionSummaries', () => {
    it('calls billing URL with resourceId and returns fixture', async () => {
      mockSuccess(consumptionSummariesFixture);
      const result = await service.getConsumptionSummaries({
        resourceId: '452ade58-23a5-4047-adb1-3af0606bdd7a',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/billing/consumption-summaries?'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('resourceId=452ade58-23a5-4047-adb1-3af0606bdd7a'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=linesOfCode'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('resourceType=organization'),
        expect.any(Object)
      );
      expect(result).toEqual(consumptionSummariesFixture);
    });

    it('throws when resourceId is missing', async () => {
      await expect(
        service.getConsumptionSummaries({})
      ).rejects.toThrow('resourceId or parentResourceId is required for consumption summaries API');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('returns true when searchOrganizations resolves', async () => {
      mockSuccess(organizationsFixture);
      const result = await service.validateToken();
      expect(result).toBe(true);
    });

    it('returns false when searchOrganizations rejects', async () => {
      mockError('Unauthorized');
      const result = await service.validateToken();
      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('throws Error with errors[0].msg when response.ok is false', async () => {
      const errBody = sonarCloudErrorFixture as { errors: [{ msg: string }] };
      mockError(errBody.errors[0].msg);
      await expect(service.searchOrganizations()).rejects.toThrow(
        "'ps' value (500) must be less than 100"
      );
    });

    it('rethrows when response.json() throws', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });
      await expect(service.searchOrganizations()).rejects.toThrow('Invalid JSON');
    });
  });
});
