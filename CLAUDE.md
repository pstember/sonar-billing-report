# Development Guidelines for SonarQube Cloud Billing Report

This file contains guidelines and important information for developing and maintaining this project.

## 📋 Table of Contents

- [Documentation principle](#documentation-principle)
- [Brand Guidelines](#brand-guidelines)
- [API Constraints](#api-constraints)
- [Code Standards](#code-standards)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Security](#security)

---

## Documentation principle

**Code is source of truth.** Docs complement the codebase: they provide entrypoints (README, QUICK_START) and point to code for endpoints, constants, and structure. Do not duplicate what can be inferred from `src/services/sonarcloud.ts`, `server.js`, `src/constants/api.ts`, and `package.json`. When adding or changing docs, prefer "see [file]" over pasting lists or values that will drift.

---

## 🎨 Brand Guidelines

### Overview

This application follows **Sonar's official brand guidelines**. All UI components MUST use the official Sonar brand colors, typography, and design patterns.

### Official Resources

- **Brand Identity Guide**: https://www.sonarsource.com/brand-identity/
- **Zeroheight Guide**: https://zeroheight.com/718590635/p/2593ae-external-sonar-brand-guide

### Brand Colors

All components must use these official Sonar brand colors:

```typescript
// Primary Colors
--color-sonar-blue: #126ED3        // Primary actions, links, active states
--color-sonar-purple: #290042      // Headings, primary text
--color-sonar-blue-secondary: #0C5DB5   // Hover states
--color-sonar-blue-light: #B7D3F2  // Disabled states, subtle backgrounds
--color-sonar-teal: #1B998B        // Badges, "New" indicators
--color-sonar-background: #EEFCFC  // Page background
```

#### Usage in Components

```jsx
// ✅ CORRECT - Use Sonar brand colors
<button className="bg-sonar-blue hover:bg-sonar-blue-secondary">

// ❌ INCORRECT - Don't use generic colors
<button className="bg-blue-600 hover:bg-blue-700">
```

### Typography

**Primary Font: Poppins**
- Use for: Headings, buttons, navigation, titles
- Font family class: `font-sans`

**Secondary Font: Inter**
- Use for: Body text, labels, inputs, paragraphs
- Font family class: `font-body`

```jsx
// ✅ CORRECT
<h1 className="font-sans text-sonar-purple">Heading</h1>
<p className="font-body text-gray-600">Body text</p>

// ❌ INCORRECT
<h1 className="text-purple-600">Heading</h1>
```

### Component Styling

Use the pre-built component classes for consistency:

```jsx
// Buttons
<button className="btn-sonar-primary px-4 py-2">Primary Action</button>
<button className="btn-sonar-secondary px-4 py-2">Secondary Action</button>

// Inputs
<input className="input-sonar w-full px-4 py-3" />

// Cards
<div className="card-sonar p-6">...</div>
```

### Documentation

- **Complete Guide**: [BRAND_IMPLEMENTATION.md](./BRAND_IMPLEMENTATION.md)
- **Color Reference**: [BRAND_COLORS_REFERENCE.md](./BRAND_COLORS_REFERENCE.md)
- **Brand Constants**: [src/styles/brand.ts](./src/styles/brand.ts)

---

## 🔌 API Constraints

### SonarQube Cloud API Limits

**CRITICAL**: The SonarQube Cloud API has strict limits that MUST be respected.

#### Maximum Page Size: 100

```typescript
// ✅ CORRECT
const { data } = useProjectTags({ ps: 100 });

// ❌ INCORRECT - Will fail with error
const { data } = useProjectTags({ ps: 500 });
// Error: {'ps' value (500) must be less than 100"}
```

#### Use Constants

Always use the constants defined in `src/constants/api.ts`:

```typescript
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from '@/constants/api';

// ✅ CORRECT
const { data } = useProjects({ ps: MAX_PAGE_SIZE });
const { data } = useProjects({ ps: DEFAULT_PAGE_SIZE }); // 50
```

#### Pagination

For large datasets, implement pagination:

```typescript
import { getPaginationConfig } from '@/constants/api';

// Get all pages needed
const config = getPaginationConfig(totalItems, 100);
// config = { pageSize: 100, totalPages: 5, pages: [1, 2, 3, 4, 5] }

// Fetch each page
for (const page of config.pages) {
  await fetchData({ ps: config.pageSize, p: page });
}
```

#### API Endpoints Reference

See `src/constants/api.ts` for:
- Maximum page sizes
- Endpoint paths
- Common metric keys
- Component qualifiers
- Helper functions

### Error Handling

Always handle API limits gracefully:

```typescript
try {
  const data = await service.getProjectTags({ ps: requestedSize });
} catch (error) {
  if (error.message.includes('must be less than')) {
    // Retry with MAX_PAGE_SIZE
    const data = await service.getProjectTags({ ps: MAX_PAGE_SIZE });
  }
}
```

---

## 💻 Code Standards

### TypeScript

- **Use strict mode**: All TypeScript files must pass strict type checking
- **No `any` types**: Use proper types or `unknown`
- **Prefer interfaces**: For object shapes, use interfaces over types

### React

- **Functional components**: Use function components with hooks
- **Use React Query**: For all API data fetching
- **Proper hooks**: Follow React hooks rules

```typescript
// ✅ CORRECT
export default function Component() {
  const { data, isLoading } = useQuery(...);

  return <div>...</div>;
}

// ❌ INCORRECT
export default class Component extends React.Component {
  // Don't use class components
}
```

### Styling

- **Tailwind CSS v4**: Use Tailwind utility classes
- **Brand colors**: Always use Sonar brand colors
- **Responsive**: Use responsive classes (sm:, md:, lg:)

```jsx
// ✅ CORRECT
<div className="bg-sonar-background p-4 sm:p-6 lg:p-8">

// ❌ INCORRECT
<div style={{ backgroundColor: '#eefcfc', padding: '1rem' }}>
```

### File Organization

```
src/
├── components/          # React components
│   ├── Auth/           # Authentication components
│   ├── Billing/        # Billing-specific components
│   ├── Charts/         # Chart components
│   └── Portfolio/      # Portfolio/project components
├── hooks/              # Custom React hooks
├── services/           # API services
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── constants/          # Application constants
└── styles/             # Style configurations
```

---

## 🧪 Testing

### Manual Testing

Before committing:

```bash
# Build the project
npm run build

# Start the server
npm start

# Test API endpoints
node test-api.js

# Test end-to-end
node test-e2e.js
```

### What to Test

1. **Visual**: Brand colors, fonts, spacing
2. **Functional**: All features work
3. **API**: No page size errors
4. **Security**: No hardcoded tokens
5. **Build**: Production build succeeds

### Test Scripts

- `test-api.js` - Tests all 7 SonarQube Cloud API endpoints
- `test-e2e.js` - End-to-end server and integration tests
- `test-service.js` - Service class unit tests

---

## 🔒 Security

### Token Management

**NEVER hardcode tokens** in source code or documentation.

#### ✅ CORRECT

```typescript
// Use environment variables
const token = process.env.SONAR_TOKEN;

// Store in .env file (not committed)
SONAR_TOKEN=your_token_here
```

#### ❌ INCORRECT

```typescript
// Don't hardcode tokens
const token = 'ed5b99ded32e7ae312e4a8ce7d865d4480eb2a56';
```

### Environment Variables

- **`.env`** - Contains actual secrets (NOT committed)
- **`.env.example`** - Template for users (committed)
- **`.gitignore`** - Must include `.env`

### Token Name

Use `SONAR_TOKEN` (matches sonar-scanner convention):

```bash
# .env file
SONAR_TOKEN=your_token_here
```

### Documentation

- **Security Guide**: [SECURITY.md](./SECURITY.md)

---

## 📚 Additional Resources

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Main project documentation |
| `QUICK_START.md` | Getting started guide |
| `DEPLOYMENT.md` | Deploy options and local proxy |
| `SECURITY.md` | Security best practices |
| `API_LIMITS.md` | SonarQube Cloud API limits |
| `DASHBOARD_LOADING.md` | Which API calls run on load, when they are remade vs cached |
| `BRAND_IMPLEMENTATION.md` | Brand implementation details |
| `BRAND_COLORS_REFERENCE.md` | Color palette reference |
| `CHANGELOG.md` | Recent changes |

### Code References

| File | Purpose |
|------|---------|
| `src/constants/api.ts` | API limits and constants |
| `src/styles/brand.ts` | Brand color/font constants |
| `src/index.css` | Tailwind theme configuration |

---

## 🚀 Quick Checklist for New Features

Before implementing a new feature:

- [ ] Review brand guidelines (colors, fonts, spacing)
- [ ] Check API constraints (page size limits)
- [ ] Use constants from `src/constants/api.ts`
- [ ] Use brand colors from Tailwind classes
- [ ] Use Poppins for headings, Inter for body text
- [ ] No hardcoded tokens or secrets
- [ ] Add TypeScript types
- [ ] Test with `npm run build`
- [ ] Test API calls with proper page sizes
- [ ] Update documentation if needed

---

## 📞 Support

### For Brand Questions
- Check [BRAND_IMPLEMENTATION.md](./BRAND_IMPLEMENTATION.md)
- Review official Sonar brand guide
- See [src/styles/brand.ts](./src/styles/brand.ts)

### For API Questions
- Check [src/constants/api.ts](./src/constants/api.ts)
- Review [API_LIMITS.md](./API_LIMITS.md)
- Test with [test-api.js](./test-api.js)

### For Security Questions
- Review [SECURITY.md](./SECURITY.md)

---

## 📝 Common Pitfalls

### ❌ Don't Do This

```typescript
// 1. Don't exceed page size limit
useProjectTags({ ps: 500 }) // ERROR!

// 2. Don't use generic colors
className="bg-purple-600" // Use bg-sonar-purple

// 3. Don't hardcode tokens
const token = 'abc123...' // Use process.env.SONAR_TOKEN

// 4. Don't use wrong fonts
className="font-arial" // Use font-sans or font-body

// 5. Don't skip TypeScript types
const data: any = ... // Use proper types
```

### ✅ Do This Instead

```typescript
// 1. Use MAX_PAGE_SIZE
import { MAX_PAGE_SIZE } from '@/constants/api';
useProjectTags({ ps: MAX_PAGE_SIZE })

// 2. Use brand colors
className="bg-sonar-purple"

// 3. Use environment variables
const token = process.env.SONAR_TOKEN

// 4. Use brand fonts
className="font-sans" // or font-body

// 5. Use proper types
const data: ProjectData = ...
```

---

**Last Updated**: March 16, 2026
**Maintainer**: Development Team
**Version**: 1.0.0
