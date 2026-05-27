/**
 * Simple integration test for GhostTrace npm package
 * 
 * Run: node test-integration.js
 */

require('dotenv').config();
const express = require('express');

console.log('\n🧪 GhostTrace Integration Test\n');

// Test 1: Module imports
console.log('Test 1: Module imports...');
try {
  const ghosttrace = require('./index');
  console.log('  ✓ Main module loads');
  console.log('  ✓ Version:', ghosttrace.version);
  console.log('  ✓ init:', typeof ghosttrace.init);
  console.log('  ✓ secure:', typeof ghosttrace.secure);
} catch (err) {
  console.error('  ✗ Failed:', err.message);
  process.exit(1);
}

// Test 2: Config validation
console.log('\nTest 2: Configuration...');
try {
  const GhostTraceConfig = require('./lib/config');
  
  // Should fail without credentials
  try {
    const badConfig = new GhostTraceConfig({});
    badConfig.validate();
    console.error('  ✗ Should have thrown error for missing credentials');
    process.exit(1);
  } catch (err) {
    console.log('  ✓ Correctly rejects missing credentials');
  }
  
  // Should pass with valid credentials
  const goodConfig = new GhostTraceConfig({
    adminEmail: 'admin@test.com',
    adminPassword: 'test12345',
  });
  goodConfig.validate();
  console.log('  ✓ Accepts valid configuration');
  console.log('  ✓ Default port:', goodConfig.dashboardPort);
  console.log('  ✓ Default threshold:', goodConfig.blockThreshold);
  
} catch (err) {
  console.error('  ✗ Failed:', err.message);
  process.exit(1);
}

// Test 3: Middleware factory
console.log('\nTest 3: Middleware factory...');
try {
  const secure = require('./lib/middleware');
  
  // Create middleware with default options
  const middleware1 = secure();
  console.log('  ✓ Creates middleware with default options');
  
  // Create middleware with custom options
  const middleware2 = secure({
    riskThreshold: 80,
    rateLimit: 60,
    blockOnThreat: false,
  });
  console.log('  ✓ Creates middleware with custom options');
  
  // Verify it's a function
  if (typeof middleware1 !== 'function' || typeof middleware2 !== 'function') {
    throw new Error('Middleware factory should return functions');
  }
  console.log('  ✓ Returns valid Express middleware functions');
  
} catch (err) {
  console.error('  ✗ Failed:', err.message);
  process.exit(1);
}

// Test 4: Express integration (without starting server)
console.log('\nTest 4: Express integration...');
try {
  const ghosttrace = require('./index');
  const app = express();
  
  // Apply middleware
  const middleware = ghosttrace.secure({
    riskThreshold: 70,
    allowlist: ['/health'],
  });
  
  app.use('/api', middleware);
  
  app.get('/api/test', (req, res) => {
    res.json({ message: 'test' });
  });
  
  console.log('  ✓ Middleware integrates with Express');
  console.log('  ✓ Routes can be defined after middleware');
  
} catch (err) {
  console.error('  ✗ Failed:', err.message);
  process.exit(1);
}

// Test 5: TypeScript definitions exist
console.log('\nTest 5: TypeScript support...');
const fs = require('fs');
const path = require('path');
try {
  const dtsPath = path.join(__dirname, 'index.d.ts');
  if (!fs.existsSync(dtsPath)) {
    throw new Error('index.d.ts not found');
  }
  const dtsContent = fs.readFileSync(dtsPath, 'utf8');
  if (!dtsContent.includes('GhostTraceConfig') || !dtsContent.includes('function init')) {
    throw new Error('TypeScript definitions incomplete');
  }
  console.log('  ✓ TypeScript definitions exist');
  console.log('  ✓ Definitions include main types');
  
} catch (err) {
  console.error('  ✗ Failed:', err.message);
  process.exit(1);
}

// Test 6: Package.json configuration
console.log('\nTest 6: Package configuration...');
try {
  const pkg = require('./package.json');
  
  if (pkg.name !== 'ghosttrace') {
    throw new Error('Package name should be "ghosttrace"');
  }
  console.log('  ✓ Package name:', pkg.name);
  
  if (pkg.main !== 'index.js') {
    throw new Error('Main entry should be index.js');
  }
  console.log('  ✓ Main entry point:', pkg.main);
  
  if (pkg.types !== 'index.d.ts') {
    throw new Error('Types should point to index.d.ts');
  }
  console.log('  ✓ TypeScript types:', pkg.types);
  
  if (!pkg.keywords.includes('express-middleware')) {
    throw new Error('Should include express-middleware keyword');
  }
  console.log('  ✓ Keywords include express-middleware');
  
  if (!pkg.files.includes('lib/')) {
    throw new Error('Should include lib/ in files array');
  }
  console.log('  ✓ Includes lib/ directory in distribution');
  
} catch (err) {
  console.error('  ✗ Failed:', err.message);
  process.exit(1);
}

// Test 7: Example files exist
console.log('\nTest 7: Example files...');
try {
  const exampleFiles = [
    'examples/express-basic.js',
    'examples/express-social-media.js',
    'examples/express-ecommerce.js',
  ];
  
  for (const file of exampleFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Example file not found: ${file}`);
    }
    console.log(`  ✓ ${file} exists`);
  }
  
} catch (err) {
  console.error('  ✗ Failed:', err.message);
  process.exit(1);
}

// Test 8: Documentation files
console.log('\nTest 8: Documentation...');
try {
  const docFiles = ['README.md', '.env.example'];
  
  for (const file of docFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Documentation file not found: ${file}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (file === 'README.md') {
      if (!content.includes('npm install ghosttrace')) {
        throw new Error('README should mention npm install');
      }
      if (!content.includes('ghosttrace.init')) {
        throw new Error('README should show init() usage');
      }
      console.log('  ✓ README.md includes integration guide');
    }
    
    if (file === '.env.example') {
      if (!content.includes('GHOST_ADMIN_EMAIL')) {
        throw new Error('.env.example should include GHOST_ variables');
      }
      console.log('  ✓ .env.example includes GHOST_ variables');
    }
  }
  
} catch (err) {
  console.error('  ✗ Failed:', err.message);
  process.exit(1);
}

console.log('\n✅ All tests passed!\n');
console.log('GhostTrace is ready for npm package distribution.\n');
console.log('Next steps:');
console.log('  1. Test with a real Express app: node examples/express-basic.js');
console.log('  2. Publish to npm: npm publish');
console.log('  3. Install in another project: npm install ghosttrace\n');
