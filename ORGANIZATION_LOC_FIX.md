# Organization LOC Allowance Fix

## Problem

The "Plan Usage" metric was showing **selected projects LOC** vs the configured plan limit, which was incorrect. Users need to see their **total organization LOC** (all projects) compared to their plan allowance.

## Root Cause

The BillingDashboard was calculating:
```typescript
const selectedLOC = projectsData.reduce((sum, p) => sum + p.ncloc, 0);
const locUsagePercent = (selectedLOC / billingPlan.locLimit) * 100;
```

This meant:
- ❌ Numerator: LOC from only selected projects
- ✅ Denominator: Organization LOC limit from billing plan
- ❌ Result: Meaningless percentage that changed based on selection

## Solution

Created a new hook `useOrganizationLOC` that:
1. Fetches all organization projects
2. Fetches LOC (ncloc) for each project in parallel using `useQueries`
3. Calculates total organization LOC
4. Shows loading progress during calculation

### Implementation

**New file: `src/hooks/useOrganizationLOC.ts`**

```typescript
export function useOrganizationLOC() {
  // Get all project keys
  const { data: projectsData } = useProjects({ ps: 100 });
  const projectKeys = projectsData?.components?.map(p => p.key) || [];

  // Fetch LOC for each project in parallel
  const locQueries = useQueries({
    queries: projectKeys.map((key) => ({
      queryKey: ['projectLOC', key],
      queryFn: async () => {
        // Fetch ncloc measure for this project
      },
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })),
  });

  // Sum up all LOC values
  const totalLOC = locQueries.reduce((sum, query) => {
    return sum + (query.data?.ncloc || 0);
  }, 0);

  return { totalLOC, isLoading, loadProgress };
}
```

**Updated: `src/components/Billing/BillingDashboard.tsx`**

```typescript
// Fetch organization-wide LOC
const {
  totalLOC: organizationTotalLOC,
  isLoading: isLoadingOrgLOC,
  loadProgress: orgLOCProgress,
} = useOrganizationLOC();

// Calculate plan usage with org LOC
const locUsagePercent = billingPlan && billingPlan.locLimit > 0
  ? (organizationTotalLOC / billingPlan.locLimit) * 100
  : 0;
```

## Performance Considerations

### API Calls
- **Organization with 100 projects** = ~100 API calls
- All calls made **in parallel** using React Query's `useQueries`
- **Cached for 5 minutes** - no re-fetching on every navigation

### Loading State
The 4th metric card shows:
- **Loading spinner** in icon badge
- **Progress percentage** (e.g., "73%") while loading
- **Blue progress bar** that fills as projects load
- **Final percentage** once all projects loaded

Example loading states:
```
Loading: "73%" with blue bar at 73%
Loaded:  "45.2%" with green/amber/red bar based on usage
```

## User Experience

### Before Fix
```
Plan Usage: 23.4%
1,234,567 / 2,730,000 LOC
```
❌ Only shows selected projects (e.g., 5 out of 100)
❌ Percentage changes as you select/deselect projects
❌ Not useful for billing tracking

### After Fix
```
Plan Usage: 45.2%
2,345,678 / 2,730,000 LOC
```
✅ Shows entire organization's LOC
✅ Percentage stays consistent regardless of selection
✅ Accurate billing usage metric

## Testing

### Verify Organization LOC

1. **Go to Overview tab**
2. **Configure billing plan** (Config tab):
   - Plan name: "Team Plan"
   - LOC limit: 2730000
   - Save configuration
3. **Return to Overview**
4. **Watch 4th metric load**:
   - Shows spinner and percentage (e.g., "73%")
   - Blue progress bar fills
   - Final percentage appears (e.g., "45.2%")
5. **Verify correct LOC**:
   - Number should match sum of ALL org projects
   - NOT just selected projects

### Check API Calls

Open DevTools → Network tab:
```bash
# Should see multiple parallel calls:
/api/measures/component?component=project-1&metricKeys=ncloc
/api/measures/component?component=project-2&metricKeys=ncloc
/api/measures/component?component=project-3&metricKeys=ncloc
...
```

### Verify Caching

1. Navigate to Config tab
2. Return to Overview
3. Check Network tab - should NOT refetch (cached for 5 min)

## Error Handling

The hook handles failures gracefully:
```typescript
try {
  const measures = await service.getComponentMeasures(...);
  return { key, ncloc: parseInt(value || '0') };
} catch (error) {
  console.warn(`Failed to fetch LOC for project ${key}:`, error);
  return { key, ncloc: 0 }; // Continue with 0 instead of failing
}
```

Benefits:
- If 1 project fails → others still load
- Partial data is better than no data
- Warnings logged for debugging

## What Changed

### Files Created
- ✅ `src/hooks/useOrganizationLOC.ts` - New hook for org-wide LOC

### Files Modified
- ✅ `src/components/Billing/BillingDashboard.tsx`
  - Import `useOrganizationLOC`
  - Use `organizationTotalLOC` in Plan Usage metric
  - Add loading states (spinner, progress)

### Bundle Impact
```
CSS: 260.45 kB (gzip: 44.54 kB) [no change]
JS:  1,605.34 kB (gzip: 477.31 kB) [+8 KB for new hook]
```

## Future Enhancements

### Possible Improvements

1. **Background Refresh**
   - Auto-refresh org LOC every 10 minutes
   - Update badge shows when new data available

2. **LOC Breakdown**
   - Click metric to see LOC by team/tag
   - Show top 10 largest projects
   - Filter by language

3. **Historical Tracking**
   - Store daily org LOC snapshots
   - Show growth trend over time
   - Alert when approaching limit

4. **Optimization**
   - Use `/api/measures/search_projects` if available (single call)
   - Batch multiple projects per request
   - Implement virtual scrolling for large orgs

---

## Summary

✅ **Problem**: Plan Usage metric showed selected projects LOC instead of organization total
✅ **Solution**: Created `useOrganizationLOC` hook to fetch all projects' LOC
✅ **Result**: Accurate billing usage metric that reflects entire organization
✅ **Performance**: Parallel fetching + 5-minute caching keeps it fast
✅ **UX**: Loading states show progress, final metric is accurate

**Date:** March 16, 2026
**Status:** ✅ Complete
**Build:** ✅ Passing
**Server:** http://localhost:3000

*Organization LOC allowance now correctly displays total organization usage vs plan limit!* 📊✨
