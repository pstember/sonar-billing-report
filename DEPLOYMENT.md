# SonarQube Cloud Billing Report - Deployment Guide

## Quick Start

### Development
```bash
npm install
npm run dev
```

Visit http://localhost:5173

### Production Build
```bash
npm run build
```

The build output will be in the `dist/` directory.

## Running Locally with CORS Proxy

The browser cannot call the SonarQube Cloud API directly due to CORS. Use the built-in Node.js server, which serves the app and proxies `/api/*` to SonarQube Cloud:

```bash
npm start
```

This builds and starts the server on http://localhost:3000, auto-opens the browser, and forwards `/api/*` to https://sonarcloud.io/api/* with CORS headers. It also proxies `/billing`, `/organizations`, and `/enterprises` to https://api.sonarcloud.io.

**Manual start (after build):**
```bash
npm run build
npm run server
```

**Environment variables:** `PORT=3000` (default), `NO_OPEN=true` to disable auto-open. Example: `PORT=8080 npm run server`.

**Standalone executable:** Run `npm run package` to create binaries in `./binaries/` (macOS, Linux, Windows); no Node.js required on the target machine.

## Deployment Options

### Option 1: Netlify

1. **Via Netlify CLI**
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

2. **Via Git Integration**
- Push code to GitHub/GitLab/Bitbucket
- Connect repository to Netlify
- Build settings:
  - Build command: `npm run build`
  - Publish directory: `dist`
  - Node version: 22

### Option 2: Vercel

1. **Via Vercel CLI**
```bash
npm install -g vercel
npm run build
vercel --prod
```

2. **Via Git Integration**
- Push code to GitHub
- Import project in Vercel
- Auto-detected settings work out of the box

### Option 3: GitHub Pages

1. Add to `package.json`:
```json
{
  "homepage": "https://yourusername.github.io/sonar-billing-report"
}
```

2. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

3. Add deploy script:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

4. Deploy:
```bash
npm run deploy
```

### Option 4: AWS S3 + CloudFront

1. **Build the app**
```bash
npm run build
```

2. **Upload to S3**
```bash
aws s3 sync dist/ s3://your-bucket-name --delete
```

3. **Configure bucket for static hosting**
- Enable static website hosting
- Set index document: `index.html`
- Set error document: `index.html` (for SPA routing)

4. **Create CloudFront distribution** (optional, for HTTPS)
- Origin: S3 bucket
- Custom error response: 404 → /index.html (200)

## Environment Configuration

### CORS Proxy (if needed)

If SonarQube Cloud blocks CORS requests, deploy a simple proxy:

**Cloudflare Worker:**
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const sonarUrl = 'https://sonarcloud.io' + url.pathname + url.search;

    const response = await fetch(sonarUrl, {
      headers: request.headers,
      method: request.method,
      body: request.body
    });

    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  }
}
```

Update `src/services/sonarcloud.ts` baseUrl to use proxy:
```typescript
const DEFAULT_BASE_URL = 'https://your-worker.workers.dev';
```

## Security Considerations

1. **Token Storage**
   - Tokens are stored in IndexedDB (client-side only)
   - Never expose tokens in URLs or logs
   - Tokens never sent to any server except SonarQube Cloud

2. **HTTPS**
   - Always deploy with HTTPS enabled
   - Use Netlify/Vercel for automatic HTTPS
   - For custom domains, configure SSL certificates

3. **CSP Headers** (optional)
   Add to `netlify.toml` or server config:
   ```toml
   [[headers]]
     for = "/*"
     [headers.values]
       Content-Security-Policy = "default-src 'self'; connect-src 'self' https://sonarcloud.io; style-src 'self' 'unsafe-inline';"
   ```

## Performance Optimization

1. **Build Optimizations** (already configured in Vite)
   - Code splitting
   - Tree shaking
   - Minification
   - Gzip compression

2. **CDN Configuration**
   - Cache static assets
   - Set proper cache headers
   - Use CDN for global distribution

3. **Lazy Loading**
   - Charts load on-demand
   - AG-Grid loads when pivot table is viewed

## Monitoring

### Error Tracking
Add Sentry (optional):
```bash
npm install @sentry/react
```

### Analytics
Add Google Analytics or Plausible (optional)

## Backup & Data

- All data stored in browser IndexedDB
- Export tag mappings regularly (CSV backup)
- No server-side data storage needed

## Troubleshooting

### Build Fails
- Ensure Node.js v22+ is installed
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf dist`

### CORS Errors
- Deploy CORS proxy (see above)
- Update baseUrl in sonarcloud service

### Slow Loading
- Check SonarQube Cloud API rate limits
- Reduce number of projects fetched
- Increase cache TTL

## Update Strategy

1. Pull latest code
2. Run `npm install` to update dependencies
3. Test locally with `npm run dev`
4. Build and deploy: `npm run build && [deploy command]`

## Support

For issues, check:
- Browser console for errors
- Network tab for API failures
- IndexedDB for stored data

Built with Claude Code
