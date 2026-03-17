# Quick Start Guide

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Your Token
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your SonarCloud token
# SONAR_TOKEN=your_token_here
```

**Important:** Never commit the `.env` file to git. It's already in `.gitignore`.

### 3. Build the Application
```bash
npm run build
```

### 4. Start the Server
```bash
npm run server
# or
npm start  # (builds and starts in one command)
```

The application will:
- Start on `http://localhost:3000`
- Automatically open your browser
- Display the SonarCloud Billing Report dashboard

## Using the Application

### First Time Setup
1. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and add your SonarCloud token
3. Start the server with `npm start`
4. Enter your token in the browser when prompted
5. The token will be validated automatically

## Testing the API

### Run API Tests
```bash
node test-api.js
```

This will:
- Test all 7 SonarCloud API endpoints
- Show detailed results with color-coded output
- Verify your token is working correctly

### Expected Output
```
╔════════════════════════════════════════════════════════╗
║   SonarCloud API Endpoint Tests                       ║
╚════════════════════════════════════════════════════════╝

✓ Passed:  7/7
Success Rate: 100.0%

🎉 All tests passed!
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Development | `npm run dev` | Start Vite dev server with HMR |
| Build | `npm run build` | Build TypeScript and bundle for production |
| Server | `npm run server` | Start the Express server (production) |
| Start | `npm start` | Build and start (one command) |
| Lint | `npm run lint` | Run ESLint |
| Preview | `npm run preview` | Preview production build locally |
| Package | `npm run package` | Create standalone binaries |

## Features

### Dashboard
- View billing data for all projects
- Filter by organization, tags, and date ranges
- Export data to Excel
- View cost breakdowns and trends

### API Integration
The application connects to SonarCloud API through a built-in proxy server:
- **Frontend**: `http://localhost:3000`
- **API Proxy**: `http://localhost:3000/api/*` → `https://sonarcloud.io/api/*`
- **Token**: Passed via Bearer authentication

### Data Endpoints
1. Organizations - List all organizations you're a member of
2. Projects - Search and filter projects
3. Project Tags - Get all available tags
4. Portfolios - List all portfolios
5. Measures - Get metrics (LOC, coverage, bugs, etc.)
6. History - Get historical metric data
7. Component Tree - Get file-level details

## Troubleshooting

### Port Already in Use
```bash
# Change the port
PORT=3001 npm run server
```

### Browser Doesn't Open
```bash
# Disable auto-open
NO_OPEN=true npm run server
# Then manually visit: http://localhost:3000
```

### API Errors
1. Check your token is valid
2. Run the test script: `node test-api.js`
3. Check the console for detailed error messages

### Build Errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Development

### Project Structure
```
sonar-billing-report/
├── src/
│   ├── components/      # React components
│   ├── services/        # API services
│   ├── hooks/           # React hooks
│   ├── types/           # TypeScript types
│   └── utils/           # Utility functions
├── server.js            # Express server
├── test-api.js          # API test script
└── dist/                # Production build
```

### Making Changes
1. Edit source files in `src/`
2. Run `npm run dev` for development with HMR
3. Build with `npm run build` for production
4. Test with `npm run server`

## Support

For issues or questions:
1. Check `API_FIX_SUMMARY.md` for recent fixes
2. Run `node test-api.js` to verify API connectivity
3. Check browser console for detailed errors
4. Review server logs for proxy errors
