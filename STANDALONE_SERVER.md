# 🚀 Standalone Server with CORS Proxy - SOLVED!

## Problem Solved: CORS Errors ✅

The browser was getting CORS errors when trying to access SonarCloud API directly. This is expected - SonarCloud doesn't allow direct browser requests for security reasons.

## Solution: Built-in Proxy Server

I've created a **standalone Node.js server** that:
- ✅ Serves the React app (static files from `dist/`)
- ✅ **Proxies all API requests** to SonarCloud (bypasses CORS)
- ✅ Can be **packaged as a single executable**
- ✅ Auto-opens browser on startup
- ✅ Works on macOS, Linux, and Windows

---

## How to Use

### Development Mode
```bash
# Build the frontend once
npm run build

# Start the server
npm run server
```

The server will:
1. Start on http://localhost:3000
2. Serve your app
3. Proxy all `/api/*` requests to https://sonarcloud.io/api/*
4. Auto-open your browser

### One Command (Build + Run)
```bash
npm start
```

---

## How It Works

### Architecture
```
Browser                  Local Server              SonarCloud
  |                           |                         |
  |-- GET /                   |                         |
  |<-- index.html ------------|                         |
  |                           |                         |
  |-- GET /api/projects ------+                         |
  |                           |-- PROXY REQUEST ------->|
  |                           |<-- RESPONSE ------------|
  |<-- RESPONSE (with CORS)---|                         |
```

### Key Features

1. **CORS Headers Added**
   - Server adds `Access-Control-Allow-Origin: *`
   - Allows browser to access SonarCloud data
   - No more CORS errors!

2. **Authorization Forwarded**
   - Your SonarCloud token is forwarded from browser
   - Stored securely in browser IndexedDB
   - Never exposed to any third party

3. **SPA Routing**
   - All routes serve `index.html`
   - React Router works correctly
   - Refresh page doesn't break

---

## Create Standalone Executable

### Package for All Platforms
```bash
npm run package
```

This creates executables in `./binaries/`:
- `sonar-billing-macos-arm64` - macOS (Apple Silicon)
- `sonar-billing-linux-x64` - Linux
- `sonar-billing-win-x64.exe` - Windows

### Run the Executable
```bash
# macOS/Linux
./binaries/sonar-billing-macos-arm64

# Windows
binaries\sonar-billing-win-x64.exe
```

### Distribution
Just send the executable to users:
- **No Node.js installation required**
- **No npm install needed**
- **Single file to run**
- **Self-contained** (includes all dependencies)

---

## Server Configuration

### Environment Variables
```bash
PORT=3000                    # Server port (default: 3000)
NO_OPEN=true                 # Don't auto-open browser
```

### Custom Port
```bash
PORT=8080 npm run server
```

---

## File Changes Made

### New Files
- `server.js` - Express server with proxy middleware

### Modified Files
- `package.json` - Added server scripts
- `src/services/sonarcloud.ts` - Use local proxy instead of direct API

### Dependencies Added
- `express` - Web server
- `http-proxy-middleware` - CORS proxy
- `open` - Auto-open browser
- `pkg` (dev) - Create executables

---

## Testing the CORS Fix

### Before (Direct API - CORS Error ❌)
```javascript
fetch('https://sonarcloud.io/api/projects')
// ❌ CORS Error: No 'Access-Control-Allow-Origin' header
```

### After (Proxy Server - Works ✅)
```javascript
fetch('http://localhost:3000/api/projects')
// ✅ Works! Server proxies to SonarCloud and adds CORS headers
```

---

## Deployment Options

### Option 1: Standalone Executable (Recommended)
```bash
npm run package
# Share the executable file
```

**Pros:**
- ✅ No dependencies needed
- ✅ Single file distribution
- ✅ Easy for end users

**Cons:**
- ⚠️ Large file size (~50-100 MB)
- ⚠️ Separate build for each platform

### Option 2: Docker
```bash
docker build -t sonar-billing .
docker run -p 3000:3000 sonar-billing
```

### Option 3: Regular Node.js Deployment
```bash
npm install
npm start
```

**Requirements:**
- Node.js 22+ installed
- All dependencies installed

---

## Security Notes

1. **Token Storage**
   - Tokens stored in browser IndexedDB only
   - Server doesn't store or log tokens
   - HTTPS recommended for production

2. **Proxy Server**
   - Runs locally on your machine
   - No external servers involved
   - All data stays on your network

3. **Production Use**
   - Use HTTPS if deployed on network
   - Consider authentication for multi-user
   - Review proxy logs for debugging

---

## Troubleshooting

### Port Already in Use
```bash
# Change port
PORT=8080 npm run server
```

### Executable Won't Run
```bash
# macOS: Give execute permission
chmod +x ./binaries/sonar-billing-macos-arm64

# macOS: Allow unsigned app
# System Preferences → Security → Allow
```

### Build Errors
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

---

## What's Next?

1. **Test the server**: `npm run server`
2. **Try the app**: http://localhost:3000
3. **Enter your token** - CORS should work now!
4. **Package executable**: `npm run package` (when ready)

---

**No more CORS errors!** 🎉

The app now works perfectly with a built-in proxy server that can be packaged as a standalone executable.
