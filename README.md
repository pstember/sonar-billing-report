# SonarCloud Billing Report

A self-contained web application for visualizing SonarCloud metrics focused on **billing and cost allocation**.

## ✅ Latest Updates (March 2026)

**📏 API Page Size Fix** - Fixed page size limit error (max 100 items per page). Added API constants and comprehensive documentation. See [PAGE_SIZE_FIX.md](./PAGE_SIZE_FIX.md) for details.

**🎨 Brand Update** - UI updated to match official Sonar brand guidelines with proper colors, typography (Poppins/Inter), and design patterns. See [BRAND_UPDATE_COMPLETE.md](./BRAND_UPDATE_COMPLETE.md) for details.

**🔧 API Fix Applied** - The organizations search endpoint has been fixed to include required parameters. All endpoints are now fully functional and tested. See [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md) for details.

**📚 Development Guidelines** - Added [CLAUDE.md](./CLAUDE.md) with complete guidelines for brand standards, API limits, security practices, and code standards for future development.

## Overview

This application enables back-billing teams/departments based on their SonarCloud usage (lines of code). It provides:

- **Tag-based grouping**: Group projects by tags representing teams/departments/cost centers
- **Cost calculation**: Configure rates ($ per 1000 LOC) to convert LOC to costs
- **Billing reports**: Monthly/quarterly reports with period-over-period comparisons
- **Interactive visualizations**: Charts and pivot tables for billing analysis
- **Export capabilities**: Excel/CSV exports formatted for finance teams
- **Offline mode**: Persistent caching for viewing data offline

## Technology Stack

- **Frontend**: React 18 + Vite + TypeScript
- **UI**: Tailwind CSS + Radix UI components
- **Charts**: Recharts
- **Tables**: AG-Grid Community Edition
- **State Management**: TanStack Query + Zustand
- **Storage**: IndexedDB (via Dexie.js)
- **Utils**: date-fns, lodash, xlsx

## Features

### Core Features
- Single enterprise token authentication
- Portfolio and project hierarchy visualization
- Tag-to-team mapping for cost attribution
- Time period filtering (last month, quarter, year, custom ranges)
- Multiple grouping options (Tag, Language, Portfolio, Project)
- Interactive charts (trends, distributions, comparisons)
- Advanced pivot table with drag-drop fields
- Cost calculator with configurable rates
- Billing report exports

### Advanced Features (Planned)
- Historical billing archives
- Budget tracking per team
- Untagged projects reporting
- Tiered pricing support
- Multiple cost allocation methods

## Getting Started

### Prerequisites
- Node.js 22+ (or 20.19+)
- SonarCloud enterprise token

### Quick Start

**Option 1: Standalone Server (Recommended)**
```bash
npm install
npm start
```
This builds and starts the Express server with built-in CORS proxy on http://localhost:3000

**Option 2: Development Mode**
```bash
npm install
npm run dev
```
Visit http://localhost:5173 for hot-module reloading during development.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Build and start the standalone server (production) |
| `npm run server` | Start the server (requires build first) |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Build TypeScript and bundle for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |
| `npm run package` | Create standalone binaries |

### Testing

Test all API endpoints:
```bash
node test-api.js [YOUR_TOKEN]
```

Test end-to-end server functionality:
```bash
node test-e2e.js
```

### Deployment

The app is fully client-side and can be deployed to any static hosting service:
- **Netlify** (recommended): `netlify deploy --prod --dir=dist`
- **Vercel**: `vercel --prod`
- **GitHub Pages**: `npm run deploy` (after setup)
- **AWS S3 + CloudFront**
- **Docker**: See DEPLOYMENT.md

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

## Configuration

### SonarCloud Token

1. Log in to SonarCloud
2. Go to My Account → Security → Generate Token
3. Create a token with appropriate permissions
4. Enter the token in the app's authentication screen

### Cost Rates

Configure your billing rates in the app:
1. Navigate to Billing Configuration
2. Set price per 1000 LOC
3. Optional: Configure language-specific rates
4. Optional: Set up tiered pricing

### Tag Mapping

Map SonarCloud tags to internal teams:
1. Navigate to Tag Management
2. Import or manually create tag-to-team mappings
3. Set percentage allocations for shared projects
4. Export mappings for backup

## API Endpoints Used

All 7 SonarCloud API endpoints are fully functional and tested:

- ✅ `GET /api/organizations/search` - Organization details (with member parameter)
- ✅ `GET /api/projects/search` - List projects with tags
- ✅ `GET /api/project_tags/search` - Available tags
- ✅ `GET /api/components/search` - Portfolio structure
- ✅ `GET /api/measures/component` - Project metrics
- ✅ `GET /api/measures/search_history` - Historical data
- ✅ `GET /api/measures/component_tree` - Component tree with metrics

See [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md) for detailed test results.

## Troubleshooting

### Common Issues

**Error: "At least one of the following parameters must be specified"**
- Fixed in the latest version. The organizations endpoint now correctly includes `member=true` parameter.

**Port Already in Use**
```bash
PORT=3001 npm run server
```

**Token Issues**
- Verify your token has the correct permissions
- Test with: `node test-api.js YOUR_TOKEN`
- Check SonarCloud token expiration

**CORS Errors**
- Use the standalone server mode (`npm start`) which includes CORS proxy
- The proxy is automatically configured to handle SonarCloud API requests

For more help, see:
- [CLAUDE.md](./CLAUDE.md) - **Complete development guidelines** (brand, API, security)
- [QUICK_START.md](./QUICK_START.md) - Detailed getting started guide
- [API_LIMITS.md](./API_LIMITS.md) - SonarCloud API limits and pagination
- [PAGE_SIZE_FIX.md](./PAGE_SIZE_FIX.md) - Recent page size fix
- [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md) - Complete test results

## License

MIT

## Authors

Built with Claude Code
