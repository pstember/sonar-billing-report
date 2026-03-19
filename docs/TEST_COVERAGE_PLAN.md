# Test Coverage Plan: 15.76% → 90%

## Todo checklist (track progress)

- [x] **Phase 1:** chartColors.test.ts, theme.test.ts, brand.test.ts, queryClient.test.ts
- [x] **Phase 2:** db.test.ts (cache expiry, error paths), sonarcloud.test.ts (edge paths)
- [x] **Phase 3:** useBilling.test.tsx, useBillingData.test.tsx, useSonarQube CloudData.test.tsx, useProjectsRealData.test.tsx
- [x] **Phase 4:** App.test.tsx, CacheIndicator.test.tsx, ThemeSelector.test.tsx, TokenInput.test.tsx, LoadProgressBar.test.tsx, OrganizationSelector.test.tsx
- [x] **Phase 5:** BillingConfig.test.tsx, CostCalculator.test.tsx, BillingPivotTable.test.tsx, TeamCostPieChart.test.tsx, LOCTrendChart.test.tsx
- [x] **Phase 6:** CostCenters.test.tsx, BillingDashboard.test.tsx, ProjectList.test.tsx
- [ ] **Coverage ≥ 90%** (current ~69% lines — add more tests in Phase 5/6 components to reach 90%)
- [x] **Vitest threshold** enabled in vitest.config.ts (set to current coverage; raise to 90 when reached)

## Current state (as of last run)

| Metric     | Current | Target |
|-----------|---------|--------|
| Statements| 65.04%  | 90%    |
| Lines     | 68.91% (1091/1583) | 90% (~1425) |
| Branches  | 42.85%  | (improve with more component tests) |
| Functions | 56.52%  | (improve with more component tests) |

**Run coverage:** `npm run test:coverage`

### Already well covered

- `src/constants/api.ts` — 100%
- `src/utils/costCalculations.ts` — 100%
- `src/utils/costCenterAllocation.ts` — 100%
- `src/utils/dataTransformers.ts` — 100%
- `src/utils/exportUtils.ts` — 100%
- `src/services/sonarcloud.ts` — 94.93%
- `src/hooks/useDashboardLoadProgress.ts` — 97.74%
- `src/services/db.ts` — 78.6%

### Not covered (0% lines)

- All UI components (App, Billing*, Charts, Portfolio, Auth, etc.)
- Config: `queryClient.ts`
- Constants/styles: `chartColors.ts`, `brand.ts`
- Utils: `theme.ts`
- Hooks: `useBilling`, `useBillingData`, `useSonarQube CloudData`, `useProjectsRealData`

---

## Plan to reach 90% line coverage

Roughly **3,700** additional lines need to be covered. The plan is phased by impact and effort.

---

### Phase 1: Quick wins — config, constants, pure utils (~1–2 days)

**Goal:** Get small, non-React files to 100%. Low effort, no DOM.

| File | Lines | Effort | Notes |
|------|-------|--------|--------|
| `src/constants/chartColors.ts` | ~35 | Low | Export values; simple assertions. |
| `src/utils/theme.ts` | ~50 | Low | Pure functions; mock `localStorage` / `matchMedia` in jsdom. |
| `src/styles/brand.ts` | ~115 | Low | Same as chartColors: constants and helpers. |
| `src/config/queryClient.ts` | ~45 | Low | Instantiate client, optionally test persister with mocked `db`. |

**Estimated new covered lines:** ~245  
**Cumulative after Phase 1:** ~19–20%

---

### Phase 2: Finish services and remaining branches (~0.5–1 day)

**Goal:** Push `db.ts` and `sonarcloud.ts` to 90%+ and close obvious gaps.

| File | Current | Uncovered (from report) | Action |
|------|---------|-------------------------|--------|
| `src/services/db.ts` | 78.6% | 105–131, 187–209 | Add tests for those branches (e.g. cache expiry, errors). |
| `src/services/sonarcloud.ts` | 94.93% | 112–115, 119–123 | Add a few tests for edge paths. |

**Estimated new covered lines:** ~50  
**Cumulative after Phase 2:** ~20–21%

---

### Phase 3: Hooks (~2–3 days)

**Goal:** Cover all data-fetching and orchestration hooks. Highest impact for the effort.

| File | Lines | Approach |
|------|-------|----------|
| `useBilling.ts` | 154 | RTL + mock React Query / API; test loading, success, error. |
| `useBillingData.ts` | 340 | Same; mock `useBilling`, `useSonarQube CloudData`, DB; test aggregation and edge cases. |
| `useSonarQube CloudData.ts` | 127 | Mock `sonarcloud` service and React Query; test key flows. |
| `useProjectsRealData.ts` | 267 | Mock services and pagination; test page accumulation and filters. |

**Estimated new covered lines:** ~888  
**Cumulative after Phase 3:** ~35–38%

---

### Phase 4: Smaller components (~2–3 days)

**Goal:** Cover App shell and self-contained components with RTL.

| File | Lines | Approach |
|------|-------|----------|
| `App.tsx` | 53 | Render with mock auth/store; assert main layout and routing. |
| `CacheIndicator.tsx` | 43 | Render; test visibility and basic props. |
| `ThemeSelector.tsx` | 112 | Render; test theme options and that `applyTheme`/storage are called (mock `theme.ts` if needed). |
| `TokenInput.tsx` | 173 | Render; test input, submit, validation. |
| `LoadProgressBar.tsx` | 148 | Render with mock progress; test labels and visibility. |
| `OrganizationSelector.tsx` | 188 | Render with mock orgs; test selection and callbacks. |

**Estimated new covered lines:** ~717  
**Cumulative after Phase 4:** ~48–52%

---

### Phase 5: Medium components (~3–4 days)

**Goal:** Cover Billing and Chart components with mocked data and user interactions.

| File | Lines | Approach |
|------|-------|----------|
| `BillingConfig.tsx` | 231 | Render with mock billing config; test form fields and save. |
| `CostCalculator.tsx` | 204 | Render with mock rates; test calculations and display. |
| `BillingPivotTable.tsx` | 197 | Render with small fixture; test columns and export if applicable. |
| `TeamCostPieChart.tsx` | 239 | Render with fixture; test segments and labels. |
| `LOCTrendChart.tsx` | 353 | Render with fixture series; test axes and tooltips. |

**Estimated new covered lines:** ~1224  
**Cumulative after Phase 5:** ~72–76%

---

### Phase 6: Large components (~4–5 days)

**Goal:** Cover the two biggest files enough to push overall coverage to 90%. Prefer integration-style tests and critical paths over 100% of every branch.

| File | Lines | Approach |
|------|-------|----------|
| `CostCenters.tsx` | 468 | Render with mock cost centers; test add/edit/delete and allocation. |
| `BillingDashboard.tsx` | 1022 | Render with mocked hooks/data; test main sections, tabs, and key actions. |
| `ProjectList.tsx` | 805 | Render with mock projects; test list, filters, and pagination. |

**Estimated new covered lines:** ~1800+ (target: enough to cross 90% overall)

**Cumulative after Phase 6:** **90%+** line coverage

---

## Implementation notes

1. **Mocks**
   - Use `vi.mock()` for `@/services/sonarcloud`, `@/services/db`, and React Query where needed.
   - Reuse or extend `fixtures/` (e.g. `billing.json`, `organizations.json`) in tests.

2. **React Testing Library**
   - Already used in `useDashboardLoadProgress.test.tsx`. Use same patterns: `render`, `screen`, `userEvent`, avoid testing implementation details.

3. **Coverage config**
   - `vitest.config.ts` already excludes `main.tsx`, `**/*.test.*`, `**/*.d.ts`, and `src/types/**`. No need to cover types or entry point.

4. **CI**
   - Add `npm run test:coverage` to CI and optionally enforce a threshold, e.g.:
     ```ts
     coverage: {
       lines: 90,
       statements: 90,
     }
     ```
   - Only add threshold once you are close to 90% to avoid failing the build.

5. **Order of work**
   - Do Phases 1–2 first for fast gains and a solid base.
   - Then Phase 3 (hooks), then Phase 4, then 5 and 6. Re-run `npm run test:coverage` after each phase to track progress.

---

## Summary

| Phase | Focus | Est. new lines | Est. time |
|-------|--------|-----------------|-----------|
| 1 | Config, constants, theme, brand | ~245 | 1–2 days |
| 2 | db/sonarcloud gaps | ~50 | 0.5–1 day |
| 3 | Hooks | ~888 | 2–3 days |
| 4 | Small components | ~717 | 2–3 days |
| 5 | Medium components | ~1224 | 3–4 days |
| 6 | Large components | ~1800+ | 4–5 days |

Total estimated effort: **~13–18 days** to reach 90% line coverage, depending on how deep you go in Phase 6.
