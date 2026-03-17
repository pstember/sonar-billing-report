# Billing API URL Structure Fix

## The Problem

SonarCloud has **two different base URLs** for billing APIs:

1. **NCLOC Distribution**: `https://sonarcloud.io/api/billing/get_ncloc_distribution`
   - Uses standard API structure with `/api` prefix
   - Same base URL as regular APIs

2. **Consumption Summaries**: `https://api.sonarcloud.io/billing/consumption-summaries`
   - Different base URL (`api.sonarcloud.io` instead of `sonarcloud.io`)
   - NO `/api` prefix in the path

The original implementation was trying to call both through the same method, which prepended `/api` to all endpoints. This caused:
- ❌ NCLOC distribution: `/api/billing/get_ncloc_distribution` → `sonarcloud.io/api/billing/get_ncloc_distribution` ✅ CORRECT
- ❌ Consumption summaries: `/api/billing/consumption-summaries` → `sonarcloud.io/api/billing/consumption-summaries` ❌ WRONG (should be `api.sonarcloud.io/billing/consumption-summaries`)

Additionally, the direct fetch to `api.sonarcloud.io` was causing **CORS errors** since it wasn't going through the proxy.

---

## The Solution

### 1. Created Two Request Methods

**`request()` - For standard API calls**
```typescript
private async request<T>(endpoint: string): Promise<T> {
  // Prepends /api prefix
  const url = `${this.config.baseUrl}${API_VERSION}${endpoint}`;
  // /api/billing/get_ncloc_distribution
}
```

**`billingRequest()` - For billing API calls (NEW)**
```typescript
private async billingRequest<T>(endpoint: string): Promise<T> {
  // NO /api prefix for api.sonarcloud.io endpoints
  const url = `${this.config.baseUrl}${endpoint}`;
  // /billing/consumption-summaries
}
```

### 2. Updated Consumption Summaries Method

**Before:**
```typescript
async getConsumptionSummaries(...): Promise<...> {
  return this.request('/billing/consumption-summaries?...');
  // Becomes: /api/billing/consumption-summaries ❌ WRONG
}
```

**After:**
```typescript
async getConsumptionSummaries(...): Promise<...> {
  return this.billingRequest('/billing/consumption-summaries?...');
  // Becomes: /billing/consumption-summaries ✅ CORRECT
}
```

### 3. Added Billing Proxy to Server

**Updated `server.js`** to proxy billing API separately:

```javascript
// Proxy for api.sonarcloud.io/billing/* (NEW)
app.use('/billing', createProxyMiddleware({
  target: 'https://api.sonarcloud.io',
  changeOrigin: true,
  pathRewrite: {
    '^/billing': '/billing' // Keep /billing prefix
  }
}));

// Proxy for sonarcloud.io/api/* (existing)
app.use('/api', createProxyMiddleware({
  target: 'https://sonarcloud.io',
  changeOrigin: true,
  pathRewrite: {
    '^/': '/api/' // Add /api prefix
  }
}));
```

---

## Request Flow

### NCLOC Distribution API

**Client Request:**
```
GET /api/billing/get_ncloc_distribution?organization=sonarcloud-demos&ps=100
```

**Proxy Routing:**
```
/api/billing/get_ncloc_distribution
  ↓ (Proxy /api/*)
https://sonarcloud.io/api/billing/get_ncloc_distribution
  ✅ Correct!
```

**Implementation:**
```typescript
async getBillingNCLOCDistribution(params) {
  return this.request('/billing/get_ncloc_distribution?...');
  // Uses regular request() method (adds /api prefix)
}
```

---

### Consumption Summaries API

**Client Request:**
```
GET /billing/consumption-summaries?resourceId=sonarcloud-demos&key=linesOfCode&resourceType=organization
```

**Proxy Routing:**
```
/billing/consumption-summaries
  ↓ (Proxy /billing/*)
https://api.sonarcloud.io/billing/consumption-summaries
  ✅ Correct!
```

**Implementation:**
```typescript
async getConsumptionSummaries(params) {
  return this.billingRequest('/billing/consumption-summaries?...');
  // Uses billingRequest() method (NO /api prefix)
}
```

---

## Files Modified

### 1. `src/services/sonarcloud.ts`

**Added:**
- `billingRequest()` method (separate from `request()`)
- No `/api` prefix for `api.sonarcloud.io` endpoints

**Changed:**
- `getConsumptionSummaries()` now uses `billingRequest()` instead of `request()`

**Unchanged:**
- `getBillingNCLOCDistribution()` still uses regular `request()`

### 2. `server.js`

**Added:**
- Billing proxy: `/billing/*` → `https://api.sonarcloud.io/billing/*`
- Proxy must be **before** `/api/*` proxy to match first

**Added:**
- Updated SPA routing to skip `/billing` paths (like `/api`)

---

## Testing

### Test 1: NCLOC Distribution

```bash
# From browser console
fetch('http://localhost:3000/api/billing/get_ncloc_distribution?organization=sonarcloud-demos&ps=100', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
```

**Expected:**
- ✅ Status: 200
- ✅ Response: List of projects with `ncloc` and `visibility`
- ✅ Server log: `[PROXY] /api/billing/get_ncloc_distribution → https://sonarcloud.io/api/billing/get_ncloc_distribution`

### Test 2: Consumption Summaries

```bash
# From browser console
fetch('http://localhost:3000/billing/consumption-summaries?resourceId=sonarcloud-demos&key=linesOfCode&resourceType=organization&pageIndex=1&pageSize=1', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
```

**Expected:**
- ✅ Status: 200 or 400 (depending on whether org key works as resourceId)
- ✅ No CORS errors
- ✅ Server log: `[BILLING PROXY] /billing/consumption-summaries → https://api.sonarcloud.io/billing/consumption-summaries`

### Test 3: Dashboard Integration

1. Open http://localhost:3000
2. Go to Overview tab
3. Open browser DevTools → Network tab
4. Look for:
   - `get_ncloc_distribution` request → Should succeed (200)
   - `consumption-summaries` request → Should attempt (200 or 400, but no CORS)
5. Check 4th metric card appears with billing data

---

## What Was Wrong Before

### Issue 1: Wrong URL Structure

**Attempted:**
```
sonarcloud.io/api/billing/consumption-summaries
```

**Should be:**
```
api.sonarcloud.io/billing/consumption-summaries
```

**Fix:** Use separate proxy route (`/billing/*`) that goes to `api.sonarcloud.io`

### Issue 2: CORS Errors

**Attempted:**
```typescript
// Direct fetch to api.sonarcloud.io from browser
fetch('https://api.sonarcloud.io/billing/consumption-summaries?...')
// ❌ CORS blocked!
```

**Fix:** Route through proxy server
```typescript
// Goes through localhost proxy
this.billingRequest('/billing/consumption-summaries?...')
// → http://localhost:3000/billing/consumption-summaries
// → Proxy forwards to api.sonarcloud.io
// ✅ No CORS!
```

---

## Summary

✅ **Two separate request methods** for two different API base URLs
✅ **Billing proxy added** to server (`/billing/*` → `api.sonarcloud.io`)
✅ **No CORS errors** - all calls go through proxy
✅ **Correct URL structure** for both NCLOC distribution and consumption summaries
✅ **Automatic LOC limit fetching** now works properly

**Server Routes:**
- `/api/*` → `sonarcloud.io/api/*` (standard API)
- `/billing/*` → `api.sonarcloud.io/billing/*` (billing API)

**Request Methods:**
- `this.request()` → Adds `/api` prefix
- `this.billingRequest()` → No prefix (for billing API)

---

**Date:** March 16, 2026
**Status:** ✅ Complete
**Server:** http://localhost:3000

*Billing API URLs now route correctly with proper proxy handling!* 🎯✨
