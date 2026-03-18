# Build & Package Guide

Complete guide for building, running, and packaging SonarCloud Billing Report.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Development](#development)
- [Production Build](#production-build)
- [Creating Executables](#creating-executables)
- [Deployment Options](#deployment-options)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js

### Install & Run

```bash
# 1. Clone the repository
git clone git@github.com:pstember/sonar-billing-report.git
cd sonar-billing-report

# 2. Install dependencies
npm install

# 3. Build and start
npm start
```

The application will:
- Build the TypeScript and React code
- Start the Express server on `http://localhost:3000`
- Automatically open your browser
- Show the token input screen

---

## 💻 Development

### Development Mode (Hot Reload)

```bash
# Start Vite dev server with hot module replacement
npm run dev
```

This runs only the frontend with Vite's development server. The frontend will proxy API calls to SonarCloud directly.

**URL**: `http://localhost:5173`

### Full Development Mode (Server + Frontend)

```bash
# Run both Express server and Vite dev server
npm run dev:full
```

This runs:
- Express server on `http://localhost:3000`
- Vite dev server on `http://localhost:5173`

Use this when testing server-side features or the proxy configuration.

### Making Changes

1. **Edit Files**: Modify files in `src/`
2. **Auto-Reload**: Changes are automatically reflected in dev mode
3. **Type Check**: TypeScript will show errors in your editor
4. **Lint**: Run `npm run lint` to check code quality

---

## 🏗️ Production Build

### Build for Production

```bash
# Build TypeScript + Bundle React app
npm run build
```

This command:
1. Compiles TypeScript (`tsc -b`)
2. Bundles React app with Vite
3. Creates optimized production files in `dist/`

**Output**:
```
dist/
├── assets/          # Bundled JS, CSS, fonts
├── index.html       # Entry point
└── [other assets]
```

### Run Production Build Locally

```bash
# Option 1: Build and start in one command
npm start

# Option 2: Build first, then start server
npm run build
npm run server

# Option 3: Preview with Vite
npm run preview
```

**URL**: `http://localhost:3000`

### Environment Variables

The application works **without** a `.env` file - users enter their SonarCloud token in the UI.

For **testing scripts only** (optional):
```bash
# Copy example
cp .env.example .env

# Edit .env
echo "SONAR_TOKEN=your_token_here" > .env
```

Never commit `.env` - it's in `.gitignore`.

---

## 📦 Creating Executables

### Package as Standalone Binaries

Create platform-specific executables that bundle Node.js and your application:

```bash
npm run package
```

This command:
1. Builds the application (`npm run build`)
2. Uses `pkg` to create standalone executables
3. Outputs binaries to `./binaries/`

**Generated Files**:
```
binaries/
├── sonar-billing-macos-arm64    # macOS Apple Silicon
├── sonar-billing-linux-x64      # Linux x64
└── sonar-billing-win-x64.exe    # Windows x64
```

### Supported Platforms

| Platform | Architecture | File |
|----------|-------------|------|
| macOS | ARM64 (M1/M2/M3) | `sonar-billing-macos-arm64` |
| Linux | x64 | `sonar-billing-linux-x64` |
| Windows | x64 | `sonar-billing-win-x64.exe` |

### Customize Packaging

Edit `package.json` to change platforms:

```json
{
  "scripts": {
    "package": "npm run build && pkg server.js --targets node22-macos-arm64,node22-linux-x64,node22-win-x64 --output-path ./binaries"
  }
}
```

**Available targets**: See [pkg targets](https://github.com/vercel/pkg#targets)

### Run the Executable

#### macOS / Linux

```bash
# Make executable (first time only)
chmod +x binaries/sonar-billing-macos-arm64

# Run
./binaries/sonar-billing-macos-arm64
```

#### Windows

```powershell
# Run
.\binaries\sonar-billing-win-x64.exe
```

#### Custom Port

```bash
# macOS / Linux
PORT=3001 ./binaries/sonar-billing-macos-arm64

# Windows
set PORT=3001 && .\binaries\sonar-billing-win-x64.exe
```

#### Disable Auto-Open Browser

```bash
# macOS / Linux
NO_OPEN=true ./binaries/sonar-billing-macos-arm64

# Windows
set NO_OPEN=true && .\binaries\sonar-billing-win-x64.exe
```

### Distribution

To distribute the application:

1. **Build executables**:
   ```bash
   npm run package
   ```

2. **Test each executable** on its target platform

3. **Package with instructions**:
   ```
   sonar-billing-report/
   ├── sonar-billing-macos-arm64
   ├── sonar-billing-linux-x64
   ├── sonar-billing-win-x64.exe
   └── README.txt              # Quick instructions
   ```

4. **Compress**:
   ```bash
   # Create archives
   tar -czf sonar-billing-macos.tar.gz binaries/sonar-billing-macos-arm64
   tar -czf sonar-billing-linux.tar.gz binaries/sonar-billing-linux-x64
   zip sonar-billing-windows.zip binaries/sonar-billing-win-x64.exe
   ```

---

## 🚢 Deployment Options

### 1. Standalone Executable (Recommended for Desktop)

**Pros**:
- Single file, no dependencies
- No Node.js installation required
- Easy to distribute

**Cons**:
- Large file size (~50MB)
- Platform-specific builds needed

**Use Case**: Desktop application, internal tools

### 2. Node.js Server (Recommended for Servers)

**Pros**:
- Smaller deployment size
- Easy to update
- Standard Node.js deployment

**Cons**:
- Requires Node.js on target system
- Need to manage dependencies

**Deploy**:
```bash
# On target server
git clone <repo>
npm install --production
npm start
```

### 3. Docker Container

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Docker instructions.

**Pros**:
- Consistent environment
- Easy scaling
- Includes all dependencies

**Cons**:
- Requires Docker
- Larger image size

### 4. Process Manager (PM2)

For production Node.js deployments:

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name sonar-billing

# Auto-restart on reboot
pm2 startup
pm2 save
```

---

## 🧪 Testing

### Test the Build

```bash
# 1. Build
npm run build

# 2. Test API endpoints
node test-api.js

# 3. Start server
npm run server

# 4. Verify in browser
# Visit http://localhost:3000
```

### Test Executables

```bash
# 1. Package
npm run package

# 2. Run executable
./binaries/sonar-billing-macos-arm64

# 3. Test in browser
# Visit http://localhost:3000
```

### End-to-End Tests

```bash
# Run comprehensive tests
node test-e2e.js
```

---

## 📊 Build Sizes

| Type | Size | Notes |
|------|------|-------|
| Source | ~5MB | Before build |
| Built dist/ | ~2MB | After npm run build |
| Executable | ~50MB | Includes Node.js runtime |
| Docker Image | ~200MB | Includes OS + Node.js |

---

## 🔧 Troubleshooting

### Build Fails

```bash
# Clean and rebuild
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### Package Fails

```bash
# Ensure pkg is installed
npm install --save-dev pkg

# Verify build first
npm run build
ls -la dist/

# Then package
npm run package
```

### Executable Won't Run

**macOS**: "Cannot be opened because the developer cannot be verified"
```bash
# Allow the executable
xattr -d com.apple.quarantine ./binaries/sonar-billing-macos-arm64
```

**Linux**: Permission denied
```bash
chmod +x ./binaries/sonar-billing-linux-x64
```

**Windows**: Antivirus blocking
- Add exception for the executable
- Or run from trusted location

---

## 📚 Related Documentation

| File | Purpose |
|------|---------|
| [README.md](./README.md) | Main project documentation |
| [QUICK_START.md](./QUICK_START.md) | Getting started guide |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment options |
| [CLAUDE.md](./CLAUDE.md) | Development guidelines |

---

## 🆘 Support

If you encounter issues:

1. **Check Build**:
   ```bash
   npm run build
   ```

2. **Check Dependencies**:
   ```bash
   npm install
   ```

3. **Check Node Version**:
   ```bash
   node --version  # Should be 18 or higher
   ```

4. **Test API**:
   ```bash
   node test-api.js
   ```

---

**Last Updated**: March 18, 2026
