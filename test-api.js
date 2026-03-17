/**
 * API Endpoint Test Script
 * Tests all SonarCloud API endpoints with provided token
 *
 * Usage:
 *   node test-api.js                    # Uses token from .env file
 *   node test-api.js YOUR_TOKEN_HERE    # Uses provided token
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const TOKEN = process.argv[2] || process.env.SONAR_TOKEN;

if (!TOKEN) {
  console.error('\n❌ Error: No token provided!\n');
  console.error('Please either:');
  console.error('  1. Create a .env file with SONAR_TOKEN=your_token');
  console.error('  2. Pass token as argument: node test-api.js YOUR_TOKEN\n');
  process.exit(1);
}

const BASE_URL = 'https://sonarcloud.io/api';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Make API request
 */
async function apiRequest(endpoint, description) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`\n${colors.blue}Testing:${colors.reset} ${description}`);
  console.log(`${colors.cyan}Endpoint:${colors.reset} ${endpoint}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.errors?.[0]?.msg || `HTTP ${response.status}: ${response.statusText}`;
      console.log(`${colors.red}✗ FAILED${colors.reset}: ${errorMsg}`);
      return { success: false, error: errorMsg, data };
    }

    console.log(`${colors.green}✓ SUCCESS${colors.reset}`);

    // Show some sample data
    if (data.organizations) {
      console.log(`  Found ${data.organizations.length} organization(s)`);
      if (data.organizations[0]) {
        console.log(`  Sample: ${data.organizations[0].key} - ${data.organizations[0].name}`);
      }
    } else if (data.components) {
      console.log(`  Found ${data.components.length} component(s)`);
      if (data.components[0]) {
        console.log(`  Sample: ${data.components[0].key} - ${data.components[0].name}`);
      }
    } else if (data.paging) {
      console.log(`  Total: ${data.paging.total}, Page ${data.paging.pageIndex}/${Math.ceil(data.paging.total / data.paging.pageSize)}`);
    }

    return { success: true, data };
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   SonarCloud API Endpoint Tests                       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`${colors.cyan}Token:${colors.reset} ${TOKEN.substring(0, 10)}...${TOKEN.substring(TOKEN.length - 4)}`);

  const results = [];

  // Test 1: Search Organizations (with member=true)
  results.push(
    await apiRequest(
      '/organizations/search?member=true',
      'Search Organizations (member=true)'
    )
  );

  // Get organization key for subsequent tests
  let orgKey = null;
  const lastResult = results[results.length - 1];
  if (lastResult.success && lastResult.data.organizations?.length > 0) {
    // List all organizations
    console.log(`\n${colors.cyan}Available organizations:${colors.reset}`);
    lastResult.data.organizations.forEach((org, idx) => {
      console.log(`  ${idx + 1}. ${org.key} - ${org.name}`);
    });

    // Try to find an organization with projects, or use the first one
    orgKey = lastResult.data.organizations[0].key;
    console.log(`${colors.yellow}\nUsing organization:${colors.reset} ${orgKey}`);
  }

  // Test 2: Search Projects
  if (orgKey) {
    let projectsResult = await apiRequest(
      `/projects/search?organization=${orgKey}&ps=10`,
      'Search Projects'
    );

    // If failed, try with other organizations
    if (!projectsResult.success && lastResult.data.organizations?.length > 1) {
      console.log(`${colors.yellow}Trying other organizations...${colors.reset}`);
      for (let i = 1; i < lastResult.data.organizations.length && !projectsResult.success; i++) {
        const nextOrg = lastResult.data.organizations[i].key;
        console.log(`${colors.yellow}Trying with:${colors.reset} ${nextOrg}`);
        projectsResult = await apiRequest(
          `/projects/search?organization=${nextOrg}&ps=10`,
          `Search Projects (${nextOrg})`
        );
        if (projectsResult.success) {
          orgKey = nextOrg;
          console.log(`${colors.green}Switched to organization:${colors.reset} ${orgKey}`);
        }
      }
    }

    results.push(projectsResult);
  } else {
    console.log(`\n${colors.yellow}⊘ SKIPPED:${colors.reset} Search Projects (no organization found)`);
    results.push({ success: false, skipped: true });
  }

  // Get project key for subsequent tests
  let projectKey = null;
  const projectResult = results[results.length - 1];
  if (projectResult.success && projectResult.data.components?.length > 0) {
    projectKey = projectResult.data.components[0].key;
    console.log(`${colors.yellow}Using project:${colors.reset} ${projectKey}`);
  }

  // Test 3: Get Project Tags
  if (orgKey) {
    results.push(
      await apiRequest(
        `/project_tags/search?organization=${orgKey}&ps=10`,
        'Get Project Tags'
      )
    );
  } else {
    console.log(`\n${colors.yellow}⊘ SKIPPED:${colors.reset} Get Project Tags (no organization found)`);
    results.push({ success: false, skipped: true });
  }

  // Test 4: List Portfolios
  if (orgKey) {
    results.push(
      await apiRequest(
        `/components/search?organization=${orgKey}&qualifiers=VW,SVW`,
        'List Portfolios'
      )
    );
  } else {
    console.log(`\n${colors.yellow}⊘ SKIPPED:${colors.reset} List Portfolios (no organization found)`);
    results.push({ success: false, skipped: true });
  }

  // Test 5: Get Component Measures
  if (projectKey) {
    results.push(
      await apiRequest(
        `/measures/component?component=${encodeURIComponent(projectKey)}&metricKeys=ncloc,coverage,bugs`,
        'Get Component Measures'
      )
    );
  } else {
    console.log(`\n${colors.yellow}⊘ SKIPPED:${colors.reset} Get Component Measures (no project found)`);
    results.push({ success: false, skipped: true });
  }

  // Test 6: Get Component History
  if (projectKey) {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
    results.push(
      await apiRequest(
        `/measures/search_history?component=${encodeURIComponent(projectKey)}&metrics=ncloc&from=${from}&ps=10`,
        'Get Component History'
      )
    );
  } else {
    console.log(`\n${colors.yellow}⊘ SKIPPED:${colors.reset} Get Component History (no project found)`);
    results.push({ success: false, skipped: true });
  }

  // Test 7: Get Component Tree
  if (projectKey) {
    results.push(
      await apiRequest(
        `/measures/component_tree?component=${encodeURIComponent(projectKey)}&metricKeys=ncloc&qualifiers=FIL&ps=5`,
        'Get Component Tree'
      )
    );
  } else {
    console.log(`\n${colors.yellow}⊘ SKIPPED:${colors.reset} Get Component Tree (no project found)`);
    results.push({ success: false, skipped: true });
  }

  // Print summary
  console.log('\n\n╔════════════════════════════════════════════════════════╗');
  console.log('║   Test Results Summary                                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const total = results.length;

  console.log(`${colors.green}✓ Passed:${colors.reset}  ${successful}/${total}`);
  if (failed > 0) {
    console.log(`${colors.red}✗ Failed:${colors.reset}  ${failed}/${total}`);
  }
  if (skipped > 0) {
    console.log(`${colors.yellow}⊘ Skipped:${colors.reset} ${skipped}/${total}`);
  }

  const successRate = ((successful / total) * 100).toFixed(1);
  console.log(`\n${colors.cyan}Success Rate:${colors.reset} ${successRate}%`);

  if (successful === total) {
    console.log(`\n${colors.green}🎉 All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else if (failed === 0 && skipped > 0) {
    console.log(`\n${colors.yellow}⚠️  Some tests were skipped due to missing data${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}❌ Some tests failed${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
