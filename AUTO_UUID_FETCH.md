# Automatic Organization UUID Fetching

## The Final Piece: Fully Automatic Billing!

Integrated automatic organization UUID fetching to enable **fully automatic billing metrics** with zero manual configuration.

---

## What Was Missing

The consumption summaries API requires an organization **UUID** (not the org key):
```
❌ resourceId=sonarcloud-demos (org key) → 403 Forbidden
✅ resourceId=23c165f2-d9c9-4667-960e-ec0bf6da390a (UUID) → 200 OK
```

But we only had the organization key from the user's auth config. We needed a way to get the UUID automatically.

---

## The Solution

You found the **perfect API endpoint**:
```
GET /organizations/organizations?organizationKey=sonarcloud-demos&excludeEligibility=true
```

This returns the organization details **including the UUID**!

### Implementation Flow

**Step 1: Fetch Organization UUID**
```typescript
GET /organizations/organizations?organizationKey=sonarcloud-demos
→ Returns { organization: { id: "23c165f2-d9c9-4667-960e-ec0bf6da390a", ... } }
```

**Step 2: Use UUID for Consumption API**
```typescript
GET /billing/consumption-summaries?resourceId=23c165f2-d9c9-4667-960e-ec0bf6da390a
→ Returns { summaries: [{ consumed: 2345678, limit: 2730000, ... }] }
```

**Step 3: Display Live Data**
```typescript
Plan Usage ● (green dot = live API!)
85.9%
━━━━━━━━━━━━━━━━░░░
2,345,678 / 2,730,000 LOC (Live API)
42 private • 25 public
```

---

## What Was Changed

### 1. Added Organization Details Method

**File: `src/services/sonarcloud.ts`**

```typescript
async getOrganizationDetails(organizationKey?: string): Promise<OrganizationDetails> {
  const orgKey = organizationKey || this.config.organization;
  const searchParams = new URLSearchParams({
    organizationKey: orgKey || '',
    excludeEligibility: 'true',
  });

  // Uses billingRequest (no /api prefix, goes to api.sonarcloud.io)
  return this.billingRequest<OrganizationDetails>(
    `/organizations/organizations?${searchParams.toString()}`
  );
}
```

**Why billingRequest?**
- This endpoint is on `api.sonarcloud.io` (NOT `sonarcloud.io/api`)
- Same as consumption summaries - needs no `/api` prefix

### 2. Updated Billing Hook

**File: `src/hooks/useBillingData.ts`**

```typescript
export function useBillingOverview() {
  // Step 1: Fetch organization UUID
  const { data: orgDetails } = useOrganizationDetails();
  const organizationUUID = orgDetails?.organization?.id;

  // Step 2: Fetch NCLOC distribution (private/public)
  const { data: nclocData } = useBillingNCLOCDistribution({ ps: 100 });

  // Step 3: Fetch consumption using UUID
  const { data: consumptionData } = useConsumptionSummaries(
    organizationUUID ? { resourceId: organizationUUID } : undefined
  );

  // Use consumption data if available, fallback to calculated
  const consumed = consumptionData?.summaries?.[0]?.consumed || privateLOC;
  const limit = consumptionData?.summaries?.[0]?.limit || 0;

  return { consumed, limit, ... };
}
```

**Key Features:**
- ✅ Automatically fetches UUID on mount
- ✅ Uses UUID for consumption API
- ✅ Falls back gracefully if UUID fetch fails
- ✅ Caches UUID for 1 hour (doesn't change)

### 3. Added Organizations Proxy

**File: `server.js`**

```javascript
// Proxy for api.sonarcloud.io/organizations/*
app.use('/organizations', createProxyMiddleware({
  target: 'https://api.sonarcloud.io',
  changeOrigin: true,
  pathRewrite: {
    '^/organizations': '/organizations'
  },
  ...
}));
```

**Server Routes Now:**
1. `/api/*` → `sonarcloud.io/api/*` (standard API)
2. `/billing/*` → `api.sonarcloud.io/billing/*` (billing API)
3. `/organizations/*` → `api.sonarcloud.io/organizations/*` (org details) ⭐ NEW

---

## How It Works

### 1. Dashboard Loads

```
Browser → Dashboard Component
  ↓
Calls: useBillingOverview()
```

### 2. Three Parallel API Calls

```
Call 1: GET /organizations/organizations?organizationKey=sonarcloud-demos
  → Fetches: { organization: { id: "UUID" } }
  → Caches for 1 hour

Call 2: GET /api/billing/get_ncloc_distribution?organization=sonarcloud-demos&ps=100
  → Fetches: All projects with ncloc and visibility (private/public)
  → Caches for 5 minutes

Call 3: GET /billing/consumption-summaries?resourceId=UUID&key=linesOfCode...
  → Waits for Call 1 to get UUID
  → Fetches: { consumed: X, limit: Y }
  → Caches for 5 minutes
```

### 3. Data Aggregation

```typescript
// From Call 2 (NCLOC distribution)
const privateProjects = nclocData.projects.filter(p => p.visibility === 'private');
const privateLOC = privateProjects.reduce((sum, p) => sum + p.ncloc, 0);

// From Call 3 (Consumption API)
const consumed = consumptionData?.summaries?.[0]?.consumed;
const limit = consumptionData?.summaries?.[0]?.limit;

// Fallback if Call 3 fails
const actualConsumed = consumed || privateLOC; // Use calculated if API fails
const actualLimit = limit || 0; // No limit if API fails

// Calculate usage
const usagePercent = actualLimit > 0 ? (actualConsumed / actualLimit) * 100 : 0;
```

### 4. UI Displays

```
If consumption API succeeded:
  Plan Usage ● (green dot)
  85.9%
  2,345,678 / 2,730,000 LOC (Live API)
  42 private • 25 public

If consumption API failed (but NCLOC worked):
  Plan Usage
  2,345,678 LOC
  42 private • 25 public
  (No percentage - no limit to compare against)
```

---

## Request Flow Diagram

```
User Opens Dashboard
  ↓
┌─────────────────────────────────────────────────────────┐
│ Step 1: Get Organization UUID                          │
│ GET /organizations/organizations?orgKey=sonarcloud-demos│
│   ↓ (Proxy to api.sonarcloud.io)                      │
│ Response: { organization: { id: "UUID" } }             │
└─────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Get NCLOC Distribution                         │
│ GET /api/billing/get_ncloc_distribution?org=...&ps=100 │
│   ↓ (Proxy to sonarcloud.io/api)                      │
│ Response: { projects: [{ ncloc, visibility }, ...] }   │
└─────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Get Consumption (with UUID from Step 1)        │
│ GET /billing/consumption-summaries?resourceId=UUID...  │
│   ↓ (Proxy to api.sonarcloud.io)                      │
│ Response: { summaries: [{ consumed, limit }] }         │
└─────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: Display Metrics                                │
│ ● 4th Metric Card with Live Billing Data               │
│ ● Green dot indicates live API data                    │
│ ● Shows consumed / limit with usage %                  │
│ ● Shows private vs public project count                │
└─────────────────────────────────────────────────────────┘
```

---

## Files Modified

### New Methods Added

**`src/services/sonarcloud.ts`**
- `getOrganizationDetails()` - Fetches org UUID

**`src/hooks/useBillingData.ts`**
- `useOrganizationDetails()` - Hook to fetch UUID
- Updated `useBillingOverview()` - Uses UUID for consumption

**`server.js`**
- Added `/organizations/*` proxy route

### Type Definitions

**`src/types/sonarcloud.d.ts`**
```typescript
export interface OrganizationDetails {
  organization: Organization & {
    id: string; // UUID for billing API
  };
}
```

---

## Caching Strategy

### Organization UUID (1 hour)
```typescript
staleTime: 60 * 60 * 1000 // 1 hour
```
**Why:** Organization UUID never changes, safe to cache long

### NCLOC Distribution (5 minutes)
```typescript
staleTime: 5 * 60 * 1000 // 5 minutes
```
**Why:** Project LOC changes with each analysis (daily/hourly)

### Consumption Summaries (5 minutes)
```typescript
staleTime: 5 * 60 * 1000 // 5 minutes
```
**Why:** Billing data updates when projects are analyzed

---

## Error Handling

### UUID Fetch Fails
```typescript
const organizationUUID = orgDetails?.organization?.id;
// If undefined, consumption API won't be called
// Falls back to calculated privateLOC
```

**Result:** Still works! Shows private project LOC without usage percentage.

### NCLOC Distribution Fails
```typescript
const privateProjects = nclocData?.projects?.filter(...) || [];
// If undefined, returns empty array
```

**Result:** Shows 0 private projects, 0 LOC.

### Consumption API Fails (with UUID)
```typescript
const consumed = consumptionData?.summaries?.[0]?.consumed || privateLOC;
const limit = consumptionData?.summaries?.[0]?.limit || 0;
// Falls back to calculated values
```

**Result:** Shows calculated private LOC, no usage percentage (no limit).

---

## User Experience

### Best Case: All APIs Work ✅

```
User opens dashboard
  ↓
3 API calls complete in ~500ms
  ↓
4th metric card appears:
  Plan Usage ● (green dot)
  85.9%
  ━━━━━━━━━━━━━━━━░░░
  2,345,678 / 2,730,000 LOC (Live API)
  42 private projects • 25 public
```

**Indicators:**
- ✅ Green dot (●) = Live consumption data
- ✅ "(Live API)" label = Using real billing API
- ✅ Percentage shown = Have both consumed and limit

### Fallback: UUID Fails ⚠️

```
UUID fetch fails
  ↓
Consumption API not called
  ↓
4th metric card shows:
  Plan Usage
  2,345,678 LOC
  42 private projects • 25 public
```

**Indicators:**
- ❌ No green dot = Calculated data
- ❌ No percentage = No limit to compare
- ✅ Still shows private LOC count correctly

### Total Failure: All Billing APIs Fail ❌

```
All billing APIs fail
  ↓
Only 3 metrics shown:
  1. Projects Selected
  2. Total LOC (from standard API)
  3. Avg LOC Per Project
  (No 4th metric)
```

**Fallback:** Standard API still works for basic metrics.

---

## Testing

### Test 1: Verify UUID Fetch

```bash
# Browser console
fetch('http://localhost:3000/organizations/organizations?organizationKey=sonarcloud-demos&excludeEligibility=true', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(d => console.log('UUID:', d.organization.id))
```

**Expected:** Organization UUID printed.

### Test 2: Verify Consumption with UUID

```bash
# After getting UUID from Test 1
fetch('http://localhost:3000/billing/consumption-summaries?resourceId=UUID&key=linesOfCode&resourceType=organization&pageIndex=1&pageSize=1', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(d => console.log('Consumed:', d.summaries[0].consumed, 'Limit:', d.summaries[0].limit))
```

**Expected:** Real consumed and limit values.

### Test 3: Dashboard Integration

1. Open http://localhost:3000
2. Open DevTools → Network tab
3. Look for three calls:
   - `organizations/organizations` → Should succeed (200)
   - `get_ncloc_distribution` → Should succeed (200)
   - `consumption-summaries` → Should succeed (200)
4. Check 4th metric card:
   - Should show green dot (●)
   - Should show "(Live API)"
   - Should show usage percentage

---

## What This Achieves

✅ **Fully Automatic** - Zero manual configuration needed
✅ **Uses Real Billing API** - Exact consumed and limit from SonarCloud
✅ **Organization UUID Auto-Fetched** - No user input required
✅ **Private vs Public Filtering** - Only counts private projects
✅ **Graceful Fallbacks** - Works even if some APIs fail
✅ **Smart Caching** - UUID cached 1 hour, billing data 5 minutes
✅ **Live Indicator** - Green dot shows when using live API

**User Experience:**
1. Configure SonarCloud token (one time)
2. Open dashboard
3. See real billing metrics immediately
4. Done!

---

**Date:** March 16, 2026
**Status:** ✅ Complete
**Server:** http://localhost:3000

*Fully automatic billing metrics with live SonarCloud API data!* 🎯✨🔥
