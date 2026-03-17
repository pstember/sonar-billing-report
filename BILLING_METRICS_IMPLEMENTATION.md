# Always-Visible Billing Metrics + Plan Configuration

## Overview

Complete implementation of always-visible billing metrics with configurable plan details. Since SonarCloud's billing API requires browser session authentication (not accessible with API tokens), users can manually configure their plan details which persist across sessions.

---

## 🎯 Key Features

### 1. Always-Visible Metrics Bar

**4 Key Metrics** displayed at the top of the dashboard (visible even when no projects selected):

1. **Projects Selected**: X/Y with percentage
2. **Total Lines of Code**: LOC from selected projects
3. **Average LOC Per Project**: Distribution metric
4. **Plan Usage**: LOC usage vs configured limit with progress bar

### 2. Billing Plan Configuration

Users can configure their SonarCloud plan details:
- **Plan Name**: (e.g., "Team Plan", "Enterprise")
- **LOC Allowance Limit**: Maximum LOC in their plan
- **Active Add-ons**: List of enabled features

Configuration is **stored in localStorage** and persists across sessions.

### 3. Visual Plan Display

When configured, plan information is displayed prominently:
- Plan name badge
- Add-on chips
- Always visible below metrics bar

---

## 📊 Metrics Details

### Metric 1: Projects Selected

```
42/67
63% of organization
```

**Features:**
- Shows selection context
- Updates in real-time as projects are selected/deselected
- Indigo gradient icon badge
- Always visible

### Metric 2: Total Lines of Code

```
1,234,567
Across 42 selected projects
```

**Features:**
- Primary billing factor
- Shows LOC from selected projects only
- Blue gradient icon badge
- Shows "Select projects to analyze" when none selected

### Metric 3: Average LOC Per Project

```
29,395
Average codebase size
```

**Features:**
- Helps identify project size distribution
- Purple gradient icon badge
- Shows "—" when no projects selected
- Useful for budget allocation

### Metric 4: Plan Usage (When Configured)

```
45.2%
[=========>         ]
1,234,567 / 2,730,000 LOC
```

**Features:**
- Only appears when billing plan is configured
- Progress bar with color coding:
  - Green: 0-75% usage
  - Amber: 75-90% usage
  - Red: 90-100% usage
- Emerald gradient icon badge
- Real-time calculation

---

## ⚙️ Configuration System

### Accessing Configuration

1. Click **"Config"** tab in navigation
2. **"Billing Plan Configuration"** card appears at top
3. Click **"Edit"** button

### Configuring Your Plan

**Step 1: Plan Name**
```
Input: "Team Plan"
```

**Step 2: LOC Allowance Limit**
```
Input: 2730000
Help text: "Maximum lines of code allowed in your plan"
```

**Step 3: Add-ons**
```
Click: "+ Add Add-on"
Input: "Security Analysis"
Click: "+ Add Add-on"
Input: "Pull Request Decoration"
```

**Step 4: Save**
```
Click: "Save Configuration"
```

### Data Persistence

Configuration is stored in **localStorage**:
- Key: `sonarcloud-billing-config`
- Persists across browser sessions
- Survives page refreshes
- Per-browser storage

---

## 🏗️ Architecture

### Component Structure

```
BillingDashboard
├── Metrics Bar (Always Visible)
│   ├── Projects Selected Card
│   ├── Total LOC Card
│   ├── Avg LOC Card
│   └── Plan Usage Card (conditional)
├── Plan Info Banner (conditional)
├── ProjectList
└── Charts (conditional on selection)
```

### Data Flow

```
User Configures Plan
  ↓
BillingConfig Component
  ↓
localStorage
  ↓
onConfigChange callback
  ↓
BillingDashboard state
  ↓
Metrics calculations
  ↓
UI Update
```

### State Management

```typescript
// In BillingDashboard.tsx
const [billingPlan, setBillingPlan] = useState<BillingPlan | null>(null);

// BillingPlan interface
interface BillingPlan {
  locLimit: number;
  locUsed: number;
  planName: string;
  addOns: string[];
}
```

### Calculations

```typescript
// Selected project stats
const selectedLOC = projectsData.reduce((sum, p) => sum + p.ncloc, 0);
const selectedCount = selectedProjects.length;
const avgLOCPerProject = selectedCount > 0
  ? Math.round(selectedLOC / selectedCount)
  : 0;

// Plan usage
const locUsagePercent = billingPlan && billingPlan.locLimit > 0
  ? (selectedLOC / billingPlan.locLimit) * 100
  : 0;
```

---

## 🎨 Visual Design

### Metrics Cards

Each card follows premium design pattern:

**Structure:**
```tsx
<div className="premium-card">
  <header>
    <h3>METRIC NAME</h3>
    <icon-badge />
  </header>
  <value>1,234,567</value>
  <context>Additional info</context>
</div>
```

**Features:**
- Gradient backgrounds (white → color-tint)
- Icon badges (top-right)
- Hover effects (-translate-y-1)
- Responsive grid (1/2/4 columns)
- Tabular numbers for alignment

### Plan Usage Progress Bar

```tsx
<div className="progress-container">
  <div
    className={usage > 90 ? 'red' : usage > 75 ? 'amber' : 'green'}
    style={{ width: `${Math.min(usage, 100)}%` }}
  />
</div>
```

**Color Logic:**
- **0-75%**: Green (healthy)
- **75-90%**: Amber (warning)
- **90-100%**: Red (critical)

### Plan Info Banner

```
Plan: [Team Plan]  Add-ons: [Security Analysis] [PR Decoration]
```

**Features:**
- Blue tinted background
- Plan name in blue badge
- Add-ons as teal chips
- Horizontal layout
- Always visible when configured

---

## 🔧 Implementation Files

### New Files

**`src/components/Billing/BillingConfig.tsx`** (New)
- Configuration UI component
- localStorage integration
- Edit/View modes
- Add-on management
- Form validation

### Modified Files

**`src/components/Billing/BillingDashboard.tsx`**
- Added `billingPlan` state
- Moved metrics outside conditional
- Added 4th metric (Plan Usage)
- Added plan info banner
- Integrated BillingConfig in Config tab

**Changes:**
```typescript
// Before: Metrics only shown when projects selected
{selectedProjects.length > 0 && <Metrics />}

// After: Metrics always visible
<Metrics />  // Always rendered
<ProjectList />
{selectedProjects.length > 0 && <Charts />}  // Conditional charts
```

---

## 📱 User Experience

### First-Time User Flow

1. **Land on Overview tab**
   - See 3 metrics with placeholder values
   - No plan usage metric (not configured)
   - See "Select projects to analyze"

2. **Navigate to Config tab**
   - See "Billing Plan Configuration" card
   - Click "Edit" button

3. **Configure Plan**
   - Enter plan name: "Team Plan"
   - Enter LOC limit: 2730000
   - Add add-ons: "Security Analysis"
   - Click "Save Configuration"

4. **Return to Overview**
   - See 4th metric: "Plan Usage"
   - See plan info banner
   - Select projects to see calculations

### Returning User Flow

1. **Land on Overview tab**
   - Configuration auto-loaded from localStorage
   - See all 4 metrics immediately
   - Plan info banner visible

2. **Select Projects**
   - Metrics update in real-time
   - Plan usage calculates automatically
   - Progress bar animates

---

## 🔍 Why Manual Configuration?

### Billing API Limitations

The SonarCloud billing API requires:

```bash
# Required for billing endpoints:
- JWT-SESSION cookie (browser session)
- XSRF-TOKEN (anti-CSRF token)
- Organization UUID (not in standard API)

# What we have:
✅ API Bearer token
❌ Cannot access billing endpoints

# What this means:
- /billing/subscriptions → ❌ 400 Bad Request
- /billing/consumption-summaries → ❌ 400 Bad Request
```

**Authentication Methods:**
```
Standard API (our token):
  ✓ /api/projects/search
  ✓ /api/measures/component
  ✓ /api/components/search_projects

Billing API (requires browser):
  ✗ /billing/subscriptions
  ✗ /billing/consumption-summaries
  ✗ Needs: Authenticated browser session
```

### Solution Benefits

✅ **Reliable**: No auth issues, works 100% of time
✅ **Fast**: No API calls needed, instant display
✅ **Persistent**: Saved across sessions
✅ **Flexible**: Can update anytime
✅ **Privacy**: Data stays in browser

❌ **Manual**: User must input once
❌ **Not Real-Time**: Must update if plan changes

### Future Alternative

If SonarCloud adds billing API to standard API:
1. Replace localStorage with API call
2. Keep same UI/UX
3. Auto-fetch on load
4. Keep manual fallback

---

## 📊 Example Configurations

### Free Plan

```json
{
  "planName": "Free Plan",
  "locLimit": 100000,
  "addOns": []
}
```

**Result:**
- Plan Usage metric appears
- 100K LOC limit
- No add-ons shown

### Team Plan

```json
{
  "planName": "Team Plan",
  "locLimit": 2730000,
  "addOns": ["Security Analysis", "Pull Request Decoration"]
}
```

**Result:**
- Plan Usage shows 2.73M limit
- Team Plan badge visible
- 2 add-on chips displayed

### Enterprise

```json
{
  "planName": "Enterprise",
  "locLimit": 20000000,
  "addOns": [
    "Security Analysis",
    "Pull Request Decoration",
    "Portfolio Management",
    "Advanced Security"
  ]
}
```

**Result:**
- Plan Usage shows 20M limit
- Enterprise badge visible
- 4 add-on chips (wraps if needed)

---

## 🧪 Testing

### Test Scenario 1: First-Time Setup

1. Clear localStorage: `localStorage.clear()`
2. Refresh page
3. Verify: Only 3 metrics visible
4. Go to Config tab → Edit billing config
5. Enter: Plan name, LOC limit, add 2 add-ons
6. Save
7. Return to Overview
8. Verify: 4th metric appears, plan banner shows

### Test Scenario 2: Usage Calculation

1. Configure plan: 1,000,000 LOC limit
2. Select projects totaling 450,000 LOC
3. Verify: Plan Usage shows 45.0%
4. Verify: Progress bar is green
5. Select more projects: 800,000 LOC total
6. Verify: Plan Usage shows 80.0%
7. Verify: Progress bar turns amber

### Test Scenario 3: Persistence

1. Configure plan with details
2. Close browser completely
3. Reopen browser
4. Navigate to dashboard
5. Verify: Configuration preserved
6. Verify: 4 metrics visible
7. Verify: Plan banner shows

### Test Scenario 4: Edit Configuration

1. With existing config, go to Config tab
2. Click "Edit"
3. Change plan name
4. Remove an add-on
5. Increase LOC limit
6. Save
7. Return to Overview
8. Verify: Changes reflected immediately

---

## 🚀 Future Enhancements

### Possible Improvements

1. **Multiple Organizations**
   - Store config per organization
   - Switch between orgs
   - Per-org LOC tracking

2. **Historical Usage**
   - Track LOC usage over time
   - Show monthly trends
   - Alert before hitting limit

3. **Cost Estimation**
   - Add cost per LOC rate
   - Calculate monthly bill
   - Project future costs

4. **Export Config**
   - Download as JSON
   - Share with team
   - Import from file

5. **Browser Extension**
   - Auto-extract from SonarCloud UI
   - One-click import
   - Keep in sync

6. **API Integration (If Available)**
   - Auto-fetch when possible
   - Fallback to manual
   - Sync button

---

## ✅ Summary

### What Was Built

✅ **Always-visible metrics** (4 cards)
✅ **Manual plan configuration** (Config tab)
✅ **localStorage persistence** (survives sessions)
✅ **Plan usage calculation** (with progress bar)
✅ **Plan info banner** (shows current plan)
✅ **Premium visual design** (gradients, animations)

### Key Metrics

1. Projects Selected (X/Y)
2. Total LOC (selected)
3. Average LOC per project
4. Plan Usage (% of limit)

### Configuration

- Plan name
- LOC limit
- Active add-ons
- Stored in browser

### User Benefits

- **Always see key metrics** (even without selection)
- **Know plan limits** (configure once)
- **Track usage** (real-time percentage)
- **See add-ons** (know what's active)

---

## 📄 API Documentation Note

The billing endpoints mentioned by the user:
```
/billing/subscriptions
/billing/consumption-summaries
```

These require **browser session authentication** which is not accessible via API tokens. This is why we implemented a manual configuration system instead.

If SonarCloud adds these to the standard API in the future, the implementation can be updated to auto-fetch, while keeping the manual configuration as a fallback.

---

**Date:** March 16, 2026
**Status:** ✅ Complete
**Build:** ✅ Passing
**Server:** http://localhost:3000

*Always-visible billing metrics with configurable plan details!* 📊✨
