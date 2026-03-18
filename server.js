/**
 * SonarCloud Billing Report - Standalone Server
 * Simple Express server that serves the app and proxies SonarCloud API requests
 */

import express from 'express';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SONARCLOUD_API = 'https://sonarcloud.io';
const SONARCLOUD_BILLING_API = 'https://api.sonarcloud.io';

// Compress responses (gzip) for API and static assets
app.use(compression());

// Add CORS middleware for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Optional request logging (uncomment for debugging)
// app.use((req, res, next) => {
//   console.log(`[REQUEST] ${req.method} ${req.url}`);
//   next();
// });

// Manual proxy for api.sonarcloud.io/billing/*
app.use('/billing', async (req, res) => {
  try {
    const url = `https://api.sonarcloud.io/billing${req.url}`;

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization || req.headers.Authorization || '',
        'Accept': 'application/json'
      }
    });
    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Billing Proxy Error]', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
});

// Manual proxy for api.sonarcloud.io/enterprises/*
app.use('/enterprises', async (req, res) => {
  try {
    const url = `https://api.sonarcloud.io/enterprises${req.url}`;

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization || req.headers.Authorization || '',
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Enterprises Proxy Error]', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
});

// Manual proxy for api.sonarcloud.io/organizations/*
app.use('/organizations', async (req, res) => {
  try {
    const url = `https://api.sonarcloud.io/organizations${req.url}`;

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization || req.headers.Authorization || '',
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[ORGANIZATIONS PROXY ERROR]', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
});

// CORS proxy for SonarCloud API - MUST be before static files
app.use('/api', createProxyMiddleware({
  target: SONARCLOUD_API,
  changeOrigin: true,
  pathRewrite: {
    '^/': '/api/' // Add /api prefix back (Express strips it when mounted at /api)
  },
  onProxyReq: (proxyReq, req, res) => {
    // CRITICAL: Forward Authorization header
    const auth = req.headers.authorization || req.headers.Authorization;
    if (auth) {
      proxyReq.setHeader('Authorization', auth);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Serve static files from dist folder (AFTER proxy so API routes take precedence)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA routing - serve index.html for all non-API, non-static routes
app.use((req, res, next) => {
  // Skip if it's an API request or a static file
  if (req.path.startsWith('/api') || req.path.startsWith('/billing') || req.path.startsWith('/organizations') || req.path.startsWith('/enterprises') || req.path.includes('.')) {
    return next();
  }
  // Serve index.html for all other routes (SPA routing)
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   SonarCloud Billing Report Server                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`  ✅ Server running at: ${url}`);
  console.log(`  📊 Ready to analyze SonarCloud billing data\n`);
  console.log('  Press Ctrl+C to stop the server\n');

  // Auto-open browser
  if (process.env.NO_OPEN !== 'true') {
    console.log('  🌐 Opening browser...\n');
    open(url).catch(() => {
      console.log(`  ℹ️  Could not auto-open browser. Please visit: ${url}\n`);
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n  👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n  👋 Shutting down gracefully...');
  process.exit(0);
});
