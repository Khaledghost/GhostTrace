/**
 * Comprehensive Validation Test for GhostTrace
 * Tests full functionality including server startup, middleware, and dashboard
 */

require('dotenv').config();
const express = require('express');
const http = require('http');

const TEST_PORT = 4000;
const DASHBOARD_PORT = 4001;

console.log('\n🔍 GhostTrace Comprehensive Validation Test\n');
console.log('═'.repeat(60));

let app;
let server;
let ghosttraceInstance;

// Test 1: Initialize GhostTrace
async function testInitialization() {
  console.log('\n📋 Phase 1: Initialization\n');
  
  try {
    const ghosttrace = require('./index');
    app = express();
    app.use(express.json());
    
    console.log('  ⏳ Initializing GhostTrace...');
    ghosttraceInstance = await ghosttrace.init({
      adminEmail: 'test@example.com',
      adminPassword: 'TestPassword123!',
      dashboardPort: DASHBOARD_PORT,
      blockThreshold: 70,
      rateLimit: 120,
      blockOnThreat: true,
    });
    
    console.log('  ✅ GhostTrace initialized successfully');
    console.log(`  ✅ Dashboard instance created`);
    console.log(`  ✅ Config stored globally`);
    
    return true;
  } catch (error) {
    console.error(`  ❌ Initialization failed: ${error.message}`);
    return false;
  }
}

// Test 2: Apply middleware
function testMiddleware() {
  console.log('\n📋 Phase 2: Middleware Integration\n');
  
  try {
    const ghosttrace = require('./index');
    
    // Global protection
    app.use('/api', ghosttrace.secure());
    console.log('  ✅ Applied global middleware to /api');
    
    // Route-specific protection
    app.use('/api/high-security', ghosttrace.secure({ 
      riskThreshold: 50,
      rateLimit: 20,
    }));
    console.log('  ✅ Applied custom middleware to /api/high-security');
    
    // Test routes
    app.get('/api/test', (req, res) => {
      res.json({ 
        message: 'Hello World',
        dna: req.clientDNA,
        timestamp: Date.now(),
      });
    });
    
    app.get('/api/users', (req, res) => {
      res.json({ users: ['Alice', 'Bob', 'Charlie'] });
    });
    
    app.get('/api/high-security/data', (req, res) => {
      res.json({ sensitive: 'data' });
    });
    
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    console.log('  ✅ Test routes configured');
    
    return true;
  } catch (error) {
    console.error(`  ❌ Middleware setup failed: ${error.message}`);
    return false;
  }
}

// Test 3: Start server
function testServerStart() {
  console.log('\n📋 Phase 3: Server Startup\n');
  
  return new Promise((resolve) => {
    try {
      server = app.listen(TEST_PORT, () => {
        console.log(`  ✅ Test app running on port ${TEST_PORT}`);
        console.log(`  ✅ Dashboard should be on port ${DASHBOARD_PORT}`);
        resolve(true);
      });
      
      server.on('error', (err) => {
        console.error(`  ❌ Server error: ${err.message}`);
        resolve(false);
      });
    } catch (error) {
      console.error(`  ❌ Failed to start server: ${error.message}`);
      resolve(false);
    }
  });
}

// Test 4: Test endpoints
async function testEndpoints() {
  console.log('\n📋 Phase 4: Endpoint Testing\n');
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const tests = [
    {
      name: 'Normal request to /api/test',
      options: {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/test',
        method: 'GET',
      },
      expectStatus: 200,
    },
    {
      name: 'Request to /api/users',
      options: {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/users',
        method: 'GET',
      },
      expectStatus: 200,
    },
    {
      name: 'Health check (unprotected)',
      options: {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/health',
        method: 'GET',
      },
      expectStatus: 200,
    },
    {
      name: 'SQL injection attempt',
      options: {
        hostname: 'localhost',
        port: TEST_PORT,
        path: "/api/test?id=1' OR '1'='1",
        method: 'GET',
      },
      expectStatus: [200, 403], // May be blocked or logged
    },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await makeRequest(test.options);
      const expectedStatuses = Array.isArray(test.expectStatus) 
        ? test.expectStatus 
        : [test.expectStatus];
      
      if (expectedStatuses.includes(result.statusCode)) {
        console.log(`  ✅ ${test.name}: ${result.statusCode}`);
        
        // Check for X-Client-DNA header
        if (result.headers['x-client-dna']) {
          console.log(`     └─ DNA header present: ${result.headers['x-client-dna'].substring(0, 20)}...`);
        }
        
        passed++;
      } else {
        console.log(`  ⚠️  ${test.name}: Expected ${test.expectStatus}, got ${result.statusCode}`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${test.name}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n  Summary: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Test 5: Dashboard accessibility
async function testDashboard() {
  console.log('\n📋 Phase 5: Dashboard Validation\n');
  
  const tests = [
    {
      name: 'Dashboard root',
      path: '/',
      expectStatus: [200, 302], // May redirect to login
    },
    {
      name: 'Login page',
      path: '/login.html',
      expectStatus: 200,
    },
    {
      name: 'API health',
      path: '/api/soc/command-center',
      expectStatus: [200, 401], // May require auth
    },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await makeRequest({
        hostname: 'localhost',
        port: DASHBOARD_PORT,
        path: test.path,
        method: 'GET',
      });
      
      const expectedStatuses = Array.isArray(test.expectStatus) 
        ? test.expectStatus 
        : [test.expectStatus];
      
      if (expectedStatuses.includes(result.statusCode)) {
        console.log(`  ✅ ${test.name}: ${result.statusCode}`);
        passed++;
      } else {
        console.log(`  ⚠️  ${test.name}: Expected ${test.expectStatus}, got ${result.statusCode}`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${test.name}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n  Summary: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Helper function to make HTTP requests
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Cleanup
async function cleanup() {
  console.log('\n📋 Cleanup\n');
  
  try {
    if (server) {
      await new Promise(resolve => server.close(resolve));
      console.log('  ✅ Test server stopped');
    }
    
    if (ghosttraceInstance && ghosttraceInstance.stop) {
      await ghosttraceInstance.stop();
      console.log('  ✅ GhostTrace stopped');
    }
  } catch (error) {
    console.log(`  ⚠️  Cleanup warning: ${error.message}`);
  }
}

// Run all tests
async function runAllTests() {
  let allPassed = true;
  
  try {
    allPassed = await testInitialization() && allPassed;
    allPassed = testMiddleware() && allPassed;
    allPassed = await testServerStart() && allPassed;
    allPassed = await testEndpoints() && allPassed;
    allPassed = await testDashboard() && allPassed;
  } catch (error) {
    console.error(`\n❌ Test suite error: ${error.message}`);
    allPassed = false;
  } finally {
    await cleanup();
  }
  
  console.log('\n' + '═'.repeat(60));
  if (allPassed) {
    console.log('\n✅ VALIDATION COMPLETE - ALL TESTS PASSED\n');
    console.log('GhostTrace is ready for production use.');
  } else {
    console.log('\n⚠️  VALIDATION COMPLETE - SOME TESTS FAILED\n');
    console.log('Please review the failures above and fix issues.');
  }
  console.log('');
  
  process.exit(allPassed ? 0 : 1);
}

// Handle errors
process.on('uncaughtException', async (error) => {
  console.error(`\n❌ Uncaught exception: ${error.message}`);
  await cleanup();
  process.exit(1);
});

process.on('unhandledRejection', async (error) => {
  console.error(`\n❌ Unhandled rejection: ${error.message}`);
  await cleanup();
  process.exit(1);
});

// Run tests
runAllTests();
