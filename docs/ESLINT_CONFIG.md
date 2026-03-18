# ESLint configuration

**Last updated:** Tightened to type-checked + stylistic (see below).

## Current setup

**File:** `eslint.config.js` (flat config)

| Item | Value |
|------|--------|
| **Ignored** | `dist`, `coverage` |
| **Linted** | `**/*.{ts,tsx}` only |
| **JS** | `@eslint/js` recommended |
| **TypeScript** | `typescript-eslint` **recommended** (no type-aware rules) |
| **React** | `eslint-plugin-react-hooks` (flat recommended), `eslint-plugin-react-refresh` (Vite) |
| **Env** | `ecmaVersion: 2020`, `globals.browser` |

So today you get:

- Core ESLint recommended
- TypeScript recommended (e.g. `no-explicit-any`, `no-unused-vars` TS version) but **without** type-checked rules (no `parserOptions.project`)
- React Hooks and React Refresh

Root `.js` files (`server.js`, `test-api.js`, etc.) are **not** linted.

---

## Does it need tightening?

**Yes**, if you want to match CLAUDE.md and reduce bugs:

1. **CLAUDE.md says "No `any`"** – `@typescript-eslint/no-explicit-any` is already in `recommended` and is firing; the codebase still has violations (e.g. `src/types/sonarcloud.d.ts`, `src/utils/exportUtils.ts`). Tightening = fix those and treat the rule as error.

2. **No type-aware linting** – Without `parserOptions.project` / `projectService`, you don’t get rules that use the type checker (e.g. `no-misused-promises`, `await-thenable`, `no-floating-promises`). Adding type-checked config would catch more real bugs.

3. **Stricter TypeScript preset** – You can move from `recommended` to `strict` (or `recommendedTypeChecked` / `strictTypeChecked` with type-aware rules) for stricter rules and to align with “strict mode” in CLAUDE.md.

4. **React Hooks** – The React Hooks plugin is already strict (e.g. setState-in-effect, exhaustive-deps). Current lint output shows existing violations; tightening = fix those and keep rules as error.

5. **Style** – No `stylistic` config today; adding `tseslint.configs.stylistic` would standardize style (e.g. consistent member/delimiter style).

6. **ECMA** – `ecmaVersion: 2020` is conservative; your `tsconfig.app.json` uses ES2023; you can set `ecmaVersion: 2023` if you want lint and build to align.

---

## Recommended tightenings (in order)

### 1. Low friction

- Set **`ecmaVersion`** to `2023` to match `tsconfig.app.json`.
- Add **`tseslint.configs.stylistic`** for consistent style.
- In **`globalIgnores`**, keep `dist` and `coverage`; add `node_modules` if not already implied.

### 2. Enforce “no any” and existing rules

- Fix existing **`@typescript-eslint/no-explicit-any`** and **react-hooks** violations (or narrow with `overrides` and `eslint-disable` only where truly needed).
- Ensure **no-explicit-any** and critical **react-hooks** rules are **error**, not warning, so CI and PRs stay clean.

### 3. Type-aware linting (high impact)

- Add **parserOptions** so ESLint can use the TypeScript compiler:
  - Either `parserOptions: { projectService: true }` (uses tsconfig by convention), or
  - `parserOptions: { project: './tsconfig.app.json' }`.
- Switch to **`tseslint.configs.recommendedTypeChecked`** (and optionally **`tseslint.configs.stylisticTypeChecked`**) so type-aware rules run.
- Expect new reports (e.g. floating promises, misused promises); fix or relax per rule as needed.

### 4. Optional: stricter preset

- If the team is comfortable with TypeScript, consider **`tseslint.configs.strict`** (without type-checking) or **`tseslint.configs.strictTypeChecked`** (with type-checking) instead of `recommended` / `recommendedTypeChecked`. These are not “stable” in semver (rules can be added/changed in minors), so only adopt if you’re willing to fix new warnings over time.

---

## Summary

| Area | Current | Tighten |
|------|---------|--------|
| TypeScript | recommended | recommendedTypeChecked (+ parserOptions) or strict / strictTypeChecked |
| Style | none | stylistic or stylisticTypeChecked |
| ecmaVersion | 2020 | 2023 |
| no-explicit-any | on (violations present) | fix violations, keep as error |
| React Hooks | on (violations present) | fix violations, keep as error |

The config itself is small and clear; the main gains are (1) turning on type-aware rules and (2) fixing existing violations so the rules you care about (no `any`, hooks) are fully enforced.
