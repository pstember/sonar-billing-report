# Dashboard loading – which API calls run?

This doc lists every API call that can run when the billing dashboard loads (single-org or multi-org). It also explains when calls are **remade** vs **served from cache**.

## Cache behavior

- **Query key + within `staleTime`** → React Query serves from cache; **no network request**.
- **New query key or data older than `staleTime`** → request is (re)made.

So the cache does **not** make the multi-org page longer: it avoids remaking calls. Only **uncached** or **stale** keys trigger network requests.

Default `staleTime` is **5 minutes** (see `src/config/queryClient.ts`). Some queries use 1 hour (e.g. `organizationDetails`, `enterpriseOrganizations`).

---

## Calls that run on load

### 1. Enterprise (once per app)

| React Query key | API calls inside | When remade |
|-----------------|------------------|-------------|
| `enterpriseOrganizations` | GET enterprise details, GET enterprise-organizations, GET organizations by IDs | When cache is empty or older than 1 hour |

### 2. Per organization (multi-org or “All organizations”)

| React Query key | API calls inside | When remade |
|-----------------|------------------|-------------|
| `projects`, `{ organization, ps }` | GET `/api/components/search_projects?organization=…` | New org or cache &gt; 5 min |
| `billingOverviewOrg`, `org.key` | GET billing NCLOC distribution + GET consumption-summaries | New org or cache &gt; 5 min |

So for **N** selected orgs you have **N** project-list requests and **N** billing-overview requests (each billing overview = 2 HTTP calls). If that org was already loaded (e.g. from single-org), the same key is reused and **not remade**.

### 3. Per private project (all private projects across selected orgs)

| React Query key | API calls inside | When remade |
|-----------------|------------------|-------------|
| `projectFullData`, `projectKey` | GET measures/component + GET components/show | New project key or cache &gt; 5 min |
| `projectHistory`, `projectKey` | GET measures/search_history (ncloc, 12 months) | New project key or cache &gt; 5 min |
| `projectLOC`, `projectKey` | GET measures/component (ncloc) | New project key or cache &gt; 5 min (used in ProjectList / CostCenters) |

So for **M** private projects you have up to **3M** query entries (projectFullData, projectHistory, projectLOC). Each query is **only remade** if that project key was not loaded recently. Example: you had single-org with 40 projects, then switch to multi-org with 71 projects → only the **31 new** project keys trigger new requests; the 40 are from cache.

### 4. Other (cost centers, config, etc.)

- `costCenters`, `costCenterAssignments`, `billingConfig`, `tagMappings`: local/IndexedDB or API; invalidated only on user changes, not on view switch.

---

## Summary

- **Cached** = same query key and within `staleTime` → **no** call remade.
- **Remade** = first time that key is used, or data is older than `staleTime`.

So multi-org is slower only when it needs **new** data: new orgs or new projects. Keeping the cache (and optionally increasing `staleTime` for project data) makes multi-org **faster** by reusing previous single-org or multi-org results.
