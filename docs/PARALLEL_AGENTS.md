# Parallel Agents: Fixtures & Unit Tests

This document defines how to run **multiple Cursor agents in parallel** to implement the fixtures and unit tests plan. Each agent gets a single, self-contained prompt so you can paste it into a new Composer/Agent chat and run them in the order below.

---

## Progress

- [x] **Phase 1: Tooling** – Vitest, jsdom, @testing-library/react, scripts, vitest.config.ts
- [x] **Phase 2: Fixtures** – fixtures/ folder and 12 JSON files
- [ ] **Phase 3: Unit tests**
  - [ ] Agent A (constants & cost-center)
  - [x] Agent B (costCalculations, dataTransformers, exportUtils)
  - [x] Agent C (SonarQube Cloud service)
  - [ ] Agent D (useDashboardLoadProgress; optional: db)

---

## Execution order

1. **Phase 1 (Tooling)** – Run **one** agent first. Wait for it to finish.
2. **Phase 2 (Fixtures)** – Run **one** agent. Can start after or in parallel with Phase 1.
3. **Phase 3 (Tests)** – Run **four** agents **in parallel**, each in its own new chat. Start only after Phase 1 and Phase 2 are done (so `npm run test` works and fixtures exist).

---

## Phase 1: Tooling (run first)

**Open a new Composer/Agent chat** and paste the block below. Run it and wait until it’s done.

```
You are implementing the "Test runner and setup" part of the fixtures & unit tests plan.

Do the following without changing any production source code:

1. Add to package.json devDependencies: vitest (^2.0.0), jsdom (^25.0.1), @testing-library/react (^16.0.1).
2. Add to package.json scripts: "test": "vitest" and "test:run": "vitest run".
3. Create vitest.config.ts at project root with:
   - plugins: [react()] (import from @vitejs/plugin-react)
   - test.environment: 'jsdom'
   - test.globals: true
   - test.include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
   - resolve.alias for 'fixtures' pointing to path.resolve(__dirname, 'fixtures')
   Use defineConfig from 'vitest/config', react from '@vitejs/plugin-react', path from 'path'.

When done, run "npm install" and "npm run test" once to confirm the test runner starts (0 tests is OK).
```

---

## Phase 2: Fixtures (run after or with Phase 1)

**Open another new Composer/Agent chat** and paste the block below. Run it and wait until it’s done.

```
You are implementing the "Fixtures folder" part of the fixtures & unit tests plan.

Create a folder "fixtures/" at the project root. Create these JSON files with minimal but valid data matching the types in src/types/sonarcloud.d.ts and src/types/billing.d.ts:

1. fixtures/organizations.json  → { organizations: Organization[], paging: Paging }
2. fixtures/projectsSearch.json → { paging, components: Project[] }  (key is "components" not "projects")
3. fixtures/projectTags.json    → { tags: string[] }
4. fixtures/measuresComponent.json → { component: MeasuresComponent, metrics: MetricDefinition[] }
5. fixtures/measuresHistory.json → { paging, measures: HistoryMeasure[] }
6. fixtures/nclocDistribution.json → { paging, projects: NCLOCDistributionProject[] }
7. fixtures/consumptionSummaries.json → { consumptionSummaries: ConsumptionSummary[], page: Paging }
8. fixtures/organizationDetails.json → { organization: Organization & { id: string } }
9. fixtures/enterprises.json    → array of Enterprise (getEnterpriseDetails returns array)
10. fixtures/enterpriseOrganizations.json → array of EnterpriseOrganization (or { organizations } if API wraps)
11. fixtures/sonarCloudError.json → { errors: [{ msg: string }] }
12. fixtures/billing.json       → optional: { billingConfig: BillingConfiguration, costCenters: CostCenter[], costCenterAssignments: CostCenterAssignment[] }

Use 1 org, 2 projects, a few tags, and minimal measures/history so tests stay readable. Do not change any production code.
```

---

## Phase 3: Unit tests (run four agents in parallel)

Start **four separate Composer/Agent chats**. Paste **one** of the four blocks below into **each** chat, then run all four. Do not assign the same block to two chats.

---

### Agent A – Constants & cost-center allocation

Paste this into **Chat 1**:

```
You are implementing unit tests for constants and cost-center allocation (Agent A of the parallel test plan).

Prerequisites: Vitest and fixtures are already set up (Phase 1 and 2 done). Do not change production code.

1. Create src/constants/api.test.ts:
   - getValidPageSize(undefined | 50 | 100 | 150) → default, 50, 100, 100 capped
   - getPaginationConfig(totalItems, pageSize): pageSize capped at 100, totalPages and pages array for various totalItems/pageSize, including 0 items

2. Create src/utils/costCenterAllocation.test.ts:
   - allocateProjectToCostCenters: no assignments → empty allocations, totalAllocationPercent 0
   - direct assignment by projectKey wins over tag-based
   - tag-based match when no direct match
   - multiple assignments normalized to 100%
   - unknown costCenterId → use assignment's costCenterId as name
   - allocateProjectsToCostCenters: multiple projects, each result matches single-project behavior
   - allocationSummary: byAssignment and byCostCenter sums from ProjectAllocationResult[]

Import from the real modules under test. Use describe/it/expect from vitest.
```

---

### Agent B – Utils (calculations, transformers, export)

Paste this into **Chat 2**:

```
You are implementing unit tests for cost calculations, data transformers, and export utils (Agent B of the parallel test plan).

Prerequisites: Vitest and fixtures are already set up. Do not change production code.

1. Create src/utils/costCalculations.test.ts:
   - calculateCost: default rate only; language-specific rate; tiered when tieredPricing present
   - getPricePer1kFromPlan: null when planAllowanceLOC<=0 or no contractValue; correct value when both set
   - calculateTieredCost: sort by minLOC; LOC in one tier; LOC across multiple tiers; open-ended last tier (maxLOC undefined)
   - getCurrencySymbol and formatCurrency: USD, EUR, GBP, unknown code; decimals

2. Create src/utils/dataTransformers.test.ts:
   - parseLanguageDistribution: empty string, single pair, multiple "lang=num;", malformed pairs, whitespace
   - getTotalNLOC, getLanguagePercentages, sortLanguagesByLOC from parsed distribution
   - formatLargeNumber (K/M), formatNumberWithCommas, calculatePercentageChange (zero old, positive/negative), formatPercentage, groupBy

3. Create src/utils/exportUtils.test.ts:
   - exportToCSV: mock document.createElement, appendChild, removeChild, URL.createObjectURL; assert Blob content (e.g. await blob.text()) matches expected CSV; empty array / missing keys
   - exportToExcel and exportToPDF: vi.mock('xlsx') and jspdf; assert they are invoked with expected data and filename/sheetName

Import from the real modules under test. Use describe/it/expect and vi from vitest.
```

---

### Agent C – SonarQube Cloud service

Paste this into **Chat 3**:

```
You are implementing unit tests for the SonarQube Cloud service (Agent C of the parallel test plan).

Prerequisites: Vitest and fixtures folder with all JSON files exist. Do not change production code in src/services/sonarcloud.ts.

Create src/services/sonarcloud.test.ts:

1. Mock globalThis.fetch (e.g. vi.stubGlobal('fetch', mockFetch)). The mock should:
   - Resolve with { ok: true, json: () => Promise.resolve(fixture) } when the test expects success
   - Resolve with { ok: false, json: () => Promise.resolve({ errors: [{ msg: '...' }] }) } for error cases

2. For each public method, test: correct URL (baseUrl + /api for standard API, no /api for billing), correct query params, and return value matches fixture. Load fixtures from the fixtures/ folder (e.g. import or read from ../../fixtures/organizations.json or use path alias "fixtures" if configured).

   Methods: searchOrganizations, getOrganizationsByIds, getEnterpriseDetails, getEnterpriseOrganizations, getOrganizationDetails, searchProjects, getProjectTags, getComponentDetails, getComponentMeasures, getComponentHistory, getBillingNCLOCDistribution, getConsumptionSummaries.

3. validateToken: when searchOrganizations resolves → true; when it rejects → false.

4. Error handling: when response.ok is false and body has errors[0].msg, throw Error with that message; when response.json() throws or body is not JSON, rethrow or throw.

Use describe/it/expect and vi from vitest. Instantiate SonarQube CloudService with a test baseUrl and token.
```

---

### Agent D – Dashboard progress hook (and optional DB)

Paste this into **Chat 4**:

```
You are implementing unit tests for useDashboardLoadProgress and optionally db (Agent D of the parallel test plan).

Prerequisites: Vitest, jsdom, @testing-library/react are set up. Do not change production code.

1. Create src/hooks/useDashboardLoadProgress.test.tsx:
   - Wrap the hook in QueryClientProvider (from @tanstack/react-query) with a fresh QueryClient.
   - Use renderHook from @testing-library/react.
   - Test: 0 queries in cache → total 0, percent 0.
   - Test: 2 queries in cache (e.g. setQueryData for success, one for error) → completed, total, percent correct.
   - Test: items[].label, items[].category, items[].subCalls for known query keys (e.g. 'projects', 'billingOverviewOrg') match expected labels/descriptions.

2. (Optional) Create src/services/db.test.ts: use fake-indexeddb in a Vitest setup file so Dexie runs in Node; test saveAuthConfig, getAuthConfig, clearAuth; cost centers and assignments CRUD; billing config; cache set/get; settings; historical snapshots. If adding fake-indexeddb is too invasive, skip DB tests.

Use describe/it/expect from vitest.
```

---

## How to run the agents (step-by-step)

### Option A: Multiple Cursor Composer/Agent chats (recommended)

1. **Start Phase 1**
   - In Cursor: open **Composer** (or **Agent**).
   - Paste the **Phase 1 (Tooling)** prompt from above.
   - Run it. Wait until it reports done and `npm run test` works.

2. **Start Phase 2**
   - Open a **new** Composer/Agent chat (e.g. new tab or new chat).
   - Paste the **Phase 2 (Fixtures)** prompt.
   - Run it. Wait until all fixture files exist under `fixtures/`.

3. **Start Phase 3 (parallel)**
   - Open **four new** Composer/Agent chats (Chat 1, 2, 3, 4).
   - In **Chat 1**: paste the **Agent A** prompt → Run.
   - In **Chat 2**: paste the **Agent B** prompt → Run.
   - In **Chat 3**: paste the **Agent C** prompt → Run.
   - In **Chat 4**: paste the **Agent D** prompt → Run.
   - Run all four; they can execute in parallel because they touch different files.

4. **Verify**
   - In the repo root: `npm run test:run`
   - Fix any failing tests or merge conflicts if two agents edited the same file (they shouldn’t if each uses only its assigned files).

### Option B: Sequential (one chat)

If you prefer a single chat, run the same prompts **one after another** in this order: Phase 1 → Phase 2 → Agent A → Agent B → Agent C → Agent D. Wait for each to finish before pasting the next. Slower, but no need to manage multiple chats.

---

## File ownership (no two agents edit the same file)

| Agent     | Files created/edited |
|----------|----------------------|
| Phase 1  | `package.json`, `vitest.config.ts` |
| Phase 2  | `fixtures/*.json` (12 files) |
| Agent A  | `src/constants/api.test.ts`, `src/utils/costCenterAllocation.test.ts` |
| Agent B  | `src/utils/costCalculations.test.ts`, `src/utils/dataTransformers.test.ts`, `src/utils/exportUtils.test.ts` |
| Agent C  | `src/services/sonarcloud.test.ts` |
| Agent D  | `src/hooks/useDashboardLoadProgress.test.tsx`, (optional) `src/services/db.test.ts` |

---

## Reference

- Full plan: `.cursor/plans/fixtures_and_unit_tests_94a01a57.plan.md` (or plan “Fixtures and unit tests”).
- Types: `src/types/sonarcloud.d.ts`, `src/types/billing.d.ts`.
- API limits: `src/constants/api.ts` (MAX_PAGE_SIZE 100, etc.).

---

## Todo (next steps)

- [x] **Agent D** – `useDashboardLoadProgress` unit tests added (`src/hooks/useDashboardLoadProgress.test.tsx`). DB tests skipped (fake-indexeddb setup deferred).
- [x] **Agent B** – `costCalculations.test.ts`, `dataTransformers.test.ts`, `exportUtils.test.ts` added.
- [ ] **Phase 3** – Run Agents A, D (in parallel or sequentially) to add remaining unit tests; then `npm run test:run` to verify.
