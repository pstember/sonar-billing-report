# SonarCloud API Limits & Constraints

**IMPORTANT**: This document describes critical limits enforced by the SonarCloud API that MUST be respected in the application.

---

## ⚠️ Critical Limits

### Maximum Page Size: 100

The SonarCloud API enforces a **strict maximum of 100 items per page** for all paginated endpoints.

#### Error Message

Attempting to exceed this limit results in:

```json
{
  "errors": [
    {
      "msg": "'ps' value (500) must be less than 100"
    }
  ]
}
```

#### Affected Endpoints

All paginated endpoints have this limit:

- `/api/projects/search`
- `/api/project_tags/search`
- `/api/measures/search_history`
- `/api/components/search`
- `/api/organizations/search`
- And more...

---

## 📏 Pagination Parameters

### Standard Parameters

| Parameter | Description | Default | Maximum | Required |
|-----------|-------------|---------|---------|----------|
| `ps` | Page size (items per page) | 50 | **100** | No |
| `p` | Page number (1-indexed) | 1 | No limit | No |

### Example Usage

```typescript
// ✅ CORRECT - Within limits
GET /api/project_tags/search?organization=my-org&ps=100&p=1

// ❌ INCORRECT - Exceeds maximum
GET /api/project_tags/search?organization=my-org&ps=500&p=1
// Returns: {"errors":[{"msg":"'ps' value (500) must be less than 100"}]}
```

---

## 💻 Implementation

### Use Constants

Always use the predefined constants:

```typescript
// src/constants/api.ts
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;

// In your components
import { MAX_PAGE_SIZE } from '@/constants/api';

const { data } = useProjectTags({ ps: MAX_PAGE_SIZE });
```

### Code Examples

#### ✅ CORRECT Usage

```typescript
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from '@/constants/api';

// Use maximum allowed
const { data: tagsData } = useProjectTags({ ps: MAX_PAGE_SIZE });

// Use default (recommended for better performance)
const { data: projectsData } = useProjects({ ps: DEFAULT_PAGE_SIZE });
```

#### ❌ INCORRECT Usage

```typescript
// DON'T hardcode values exceeding the limit
const { data: tagsData } = useProjectTags({ ps: 500 }); // ERROR!

// DON'T use magic numbers without constants
const { data: projectsData } = useProjects({ ps: 100 }); // Works but not maintainable
```

---

## 🔄 Handling Large Datasets

### Strategy 1: Pagination

For datasets larger than 100 items, implement pagination:

```typescript
import { getPaginationConfig, MAX_PAGE_SIZE } from '@/constants/api';

async function fetchAllTags(organization: string) {
  const allTags = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await service.getProjectTags({
      organization,
      ps: MAX_PAGE_SIZE,
      p: page,
    });

    allTags.push(...response.tags);

    // Check if there are more pages
    hasMore = response.paging.total > page * MAX_PAGE_SIZE;
    page++;
  }

  return allTags;
}
```

### Strategy 2: Using Pagination Helper

```typescript
import { getPaginationConfig } from '@/constants/api';

// If you know the total count
const totalItems = 350;
const config = getPaginationConfig(totalItems, 100);

// config = {
//   pageSize: 100,
//   totalPages: 4,
//   pages: [1, 2, 3, 4]
// }

// Fetch all pages
const allData = await Promise.all(
  config.pages.map(page =>
    service.getProjectTags({
      organization: 'my-org',
      ps: config.pageSize,
      p: page,
    })
  )
);
```

### Strategy 3: Load More Pattern

```typescript
function TagsList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectTags({
    ps: MAX_PAGE_SIZE,
    p: page,
  });

  const loadMore = () => setPage(p => p + 1);

  return (
    <div>
      {data?.tags.map(tag => <div key={tag}>{tag}</div>)}
      {data?.paging.total > page * MAX_PAGE_SIZE && (
        <button onClick={loadMore}>Load More</button>
      )}
    </div>
  );
}
```

---

## 📊 Response Structure

### Paging Object

All paginated endpoints include a `paging` object:

```json
{
  "paging": {
    "pageIndex": 1,
    "pageSize": 100,
    "total": 350
  },
  "tags": [...]
}
```

| Field | Description |
|-------|-------------|
| `pageIndex` | Current page number (1-indexed) |
| `pageSize` | Items per page (≤ 100) |
| `total` | Total number of items available |

### Calculate Total Pages

```typescript
const totalPages = Math.ceil(paging.total / paging.pageSize);
const hasNextPage = paging.total > paging.pageIndex * paging.pageSize;
```

---

## 🛠️ Helper Functions

### Available in `src/constants/api.ts`

#### `getValidPageSize(requestedSize?: number): number`

Ensures page size doesn't exceed maximum:

```typescript
const pageSize = getValidPageSize(500); // Returns 100
const pageSize = getValidPageSize(50);  // Returns 50
const pageSize = getValidPageSize();    // Returns DEFAULT_PAGE_SIZE (50)
```

#### `getPaginationConfig(totalItems: number, pageSize?: number)`

Calculate pagination configuration:

```typescript
const config = getPaginationConfig(350, 100);
// Returns:
// {
//   pageSize: 100,
//   totalPages: 4,
//   pages: [1, 2, 3, 4]
// }
```

---

## 🚨 Error Handling

### Detecting Page Size Errors

```typescript
try {
  const data = await service.getProjectTags({ ps: requestedSize });
} catch (error) {
  if (error.message.includes('must be less than')) {
    console.error('Page size exceeds maximum allowed (100)');

    // Retry with max allowed
    const data = await service.getProjectTags({ ps: MAX_PAGE_SIZE });
  }
}
```

### Validation Before API Call

```typescript
import { getValidPageSize } from '@/constants/api';

function fetchData(requestedSize: number) {
  const validSize = getValidPageSize(requestedSize);

  if (validSize !== requestedSize) {
    console.warn(`Page size ${requestedSize} exceeds maximum. Using ${validSize} instead.`);
  }

  return service.getProjectTags({ ps: validSize });
}
```

---

## 📋 Best Practices

### 1. Always Use Constants

```typescript
// ✅ GOOD
import { MAX_PAGE_SIZE } from '@/constants/api';
useProjectTags({ ps: MAX_PAGE_SIZE });

// ❌ BAD
useProjectTags({ ps: 100 }); // Magic number
```

### 2. Default to Smaller Page Sizes

```typescript
// ✅ GOOD - Better performance for initial loads
import { DEFAULT_PAGE_SIZE } from '@/constants/api';
useProjects({ ps: DEFAULT_PAGE_SIZE }); // 50 items

// ⚠️ OK but slower
useProjects({ ps: MAX_PAGE_SIZE }); // 100 items
```

### 3. Implement Pagination for Large Datasets

```typescript
// ✅ GOOD - Pagination for 350 items
const pages = [1, 2, 3, 4]; // 4 pages of 100 items
await Promise.all(pages.map(p => fetch({ ps: 100, p })));

// ❌ BAD - Trying to fetch all at once
fetch({ ps: 500 }); // ERROR!
```

### 4. Cache Results

```typescript
// ✅ GOOD - Use React Query caching
const { data } = useQuery({
  queryKey: ['tags', organization, page],
  queryFn: () => fetchTags({ ps: MAX_PAGE_SIZE, p: page }),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

---

## 📖 Real-World Examples

### Example 1: Fixed Bug

**Before** (Incorrect):
```typescript
// src/components/Portfolio/ProjectList.tsx
const { data: tagsData } = useProjectTags({ ps: 500 }); // ❌ ERROR!
```

**After** (Fixed):
```typescript
// src/components/Portfolio/ProjectList.tsx
import { MAX_PAGE_SIZE } from '@/constants/api';

const { data: tagsData } = useProjectTags({ ps: MAX_PAGE_SIZE }); // ✅ Works!
```

### Example 2: Fetching All Tags with Pagination

```typescript
async function getAllTags(organization: string): Promise<string[]> {
  const allTags: string[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await service.getProjectTags({
      organization,
      ps: MAX_PAGE_SIZE,
      p: page,
    });

    allTags.push(...response.tags);

    const totalFetched = page * MAX_PAGE_SIZE;
    hasMore = response.paging.total > totalFetched;

    page++;
  }

  return allTags;
}
```

### Example 3: Component with Load More

```typescript
function ProjectTagsSelector() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectTags({
    ps: MAX_PAGE_SIZE,
    p: page,
  });

  const tags = data?.tags || [];
  const hasMore = data && data.paging.total > page * MAX_PAGE_SIZE;

  return (
    <div>
      <h3>Available Tags</h3>
      <ul>
        {tags.map(tag => <li key={tag}>{tag}</li>)}
      </ul>

      {hasMore && (
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Load More Tags'}
        </button>
      )}

      <p className="text-sm text-gray-500">
        Showing {Math.min(page * MAX_PAGE_SIZE, data?.paging.total || 0)} of {data?.paging.total || 0} tags
      </p>
    </div>
  );
}
```

---

## 🔍 Debugging

### Check API Calls

1. Open browser DevTools (Network tab)
2. Look for SonarCloud API calls
3. Check the `ps` parameter in the request URL
4. Verify it's ≤ 100

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `'ps' value must be less than 100` | Page size > 100 | Use `MAX_PAGE_SIZE` (100) |
| Missing data | Only first page fetched | Implement pagination |
| Slow performance | Too many API calls | Use caching, batch requests |

---

## 📚 References

- **Constants File**: [src/constants/api.ts](./src/constants/api.ts)
- **SonarCloud API Docs**: https://docs.sonarcloud.io/
- **API Fix Summary**: [API_FIX_SUMMARY.md](./API_FIX_SUMMARY.md)

---

**Remember**: Always respect the 100-item page size limit. Use constants, implement pagination for large datasets, and cache results when possible.

*Last Updated: March 16, 2026*
