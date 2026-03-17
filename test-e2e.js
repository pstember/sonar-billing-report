/**
 * End-to-End Test
 * Starts the server and tests API endpoints through the proxy
 *
 * Usage:
 *   node test-e2e.js                    # Uses token from .env file
 *   node test-e2e.js YOUR_TOKEN_HERE    # Uses provided token
 */

import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const TOKEN = process.argv[2] || process.env.SONAR_TOKEN;

if (!TOKEN) {
  console.error('\n❌ Error: No token provided!\n');
  console.error('Please either:');
  console.error('  1. Create a .env file with SONAR_TOKEN=your_token');
  console.error('  2. Pass token as argument: node test-e2e.js YOUR_TOKEN\n');
  process.exit(1);
}

const PORT = 3001; // Use different port to avoid conflicts
const SERVER_URL = `http://localhost:${PORT}`;

let serverProcess;

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

/**
 * Start the server
 */
async function startServer() {
  console.log(`${colors.cyan}Starting server on port ${PORT}...${colors.reset}`);

  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], {
      env: { ...process.env, PORT, NO_OPEN: 'true' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';

    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Server running at')) {
        console.log(`${colors.green}✓ Server started${colors.reset}\n`);
        // Wait a bit for server to be fully ready
        setTimeout(resolve, 1000);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', reject);

    // Timeout if server doesn't start
    setTimeout(() => {
      reject(new Error('Server failed to start within 10 seconds'));
    }, 10000);
  });
}

/**
 * Stop the server
 */
function stopServer() {
  if (serverProcess) {
    console.log(`\n${colors.cyan}Stopping server...${colors.reset}`);
    serverProcess.kill();
    console.log(`${colors.green}✓ Server stopped${colors.reset}\n`);
  }
}

/**
 * Test API endpoint through proxy
 */
async function testEndpoint(endpoint, description) {
  const url = `${SERVER_URL}/api${endpoint}`;
  console.log(`${colors.cyan}Testing:${colors.reset} ${description}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.errors?.[0]?.msg || `HTTP ${response.status}`;
      console.log(`${colors.red}✗ FAILED:${colors.reset} ${errorMsg}`);
      return false;
    }

    console.log(`${colors.green}✓ SUCCESS${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ FAILED:${colors.reset} ${error.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   End-to-End Server Test                               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Start server
    await startServer();

    // Test static files
    console.log(`${colors.cyan}Testing:${colors.reset} Static files (index.html)`);
    try {
      const response = await fetch(`${SERVER_URL}/`);
      if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
        console.log(`${colors.green}✓ SUCCESS${colors.reset}\n`);
      } else {
        console.log(`${colors.red}✗ FAILED${colors.reset}\n`);
      }
    } catch (error) {
      console.log(`${colors.red}✗ FAILED:${colors.reset} ${error.message}\n`);
    }

    // Test API proxy endpoints
    const results = [];

    results.push(await testEndpoint(
      '/organizations/search?member=true',
      'Organizations API (with fix)'
    ));

    results.push(await testEndpoint(
      '/projects/search?organization=sonar-solutions&ps=5',
      'Projects API'
    ));

    results.push(await testEndpoint(
      '/project_tags/search?organization=sonar-solutions',
      'Project Tags API'
    ));

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   Test Results                                         ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log(`${colors.green}✓ Passed:${colors.reset} ${passed}/${total}`);

    if (passed === total) {
      console.log(`\n${colors.green}🎉 All end-to-end tests passed!${colors.reset}`);
      console.log(`\nThe server is working correctly:`);
      console.log(`- Static files are served`);
      console.log(`- API proxy is working`);
      console.log(`- Organizations endpoint fix is applied`);
      console.log(`- Authentication with token works\n`);
      stopServer();
      process.exit(0);
    } else {
      console.log(`\n${colors.red}❌ Some tests failed${colors.reset}\n`);
      stopServer();
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n${colors.red}Fatal error:${colors.reset}`, error.message);
    stopServer();
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, cleaning up...');
  stopServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, cleaning up...');
  stopServer();
  process.exit(0);
});

// Run tests
runTests();
