# Changelog

All notable changes to this project will be documented here.

## [0.1.0] - 2026-04-23

### Features
- Enterprise-level consumption API: single call covers all orgs (including non-member) instead of N per-org calls
- Pooled org display: "Limit" and "Usage %" columns now show "Shared pool" / "—" for unreserved orgs instead of misleading per-org values
- Auto-login from `.env`: server exposes `SONAR_TOKEN` + `SONAR_ENTERPRISE_KEY` via `/config`; login screen pre-fills and auto-submits
- Beta badges and cost config layout improvements
- Bulk unassign feature for cost center assignments
- Rebrand from SonarCloud to SonarQube Cloud

### Bug Fixes
- Non-member orgs no longer show missing billing data; NCLOC fetch failures are non-fatal

---

## Pre-versioning history (manual)

### March 18, 2026

#### UX & Copy Improvements
- **Perspective rebranding** – View modes renamed: "Perspective" replaces "View"; "Single Organisation", "Multiple organisation", "Enterprise Overview"
- **British English** – All user-facing text now uses "organisation(s)" for consistency
- **Button consistency** – All action buttons standardized to blue (btn-sonar-primary)
- **Smart selection** – Enterprise Overview table now has green/gray selection buttons that sync with Multiple organisation checkboxes
- **Information architecture** – Cost Centers section moved before Project Assignment for logical flow (create → assign)
- **Authentication improvements** – "SonarQube Cloud Access Token" label, "Continue to Dashboard" button, direct link to token generation
- **Progressive disclosure** – Load progress bar collapsed by default with show/hide toggle
- **Copy improvements** – Conversational, user-friendly language throughout; technical jargon replaced with plain English
- **New shared components** – LOCTooltip, HelpIcon, Toast, useKeyboardShortcuts (prepared for future enhancements)

#### Technical
- **ProjectList wrapper** – Optional `showWrapper` prop to prevent duplicate headings when embedded
- **Error remediation** – Context-aware error messages with suggested fixes
- **Tests** – All 264 tests passing; updated for new copy and UI changes

### March 17, 2026

#### Core Features
- **API page size** – SonarQube Cloud API enforces max 100 items per page; app uses `src/constants/api.ts` and [API_LIMITS.md](./API_LIMITS.md)
- **Brand** – UI updated to Sonar brand guidelines (colors, Poppins/Inter, design patterns). See [BRAND_IMPLEMENTATION.md](./BRAND_IMPLEMENTATION.md)
- **Organizations endpoint** – Fixed to send required `member=true` parameter; all 7 API endpoints verified
- **Development guidelines** – [CLAUDE.md](./CLAUDE.md) added for brand, API limits, security, and code standards
