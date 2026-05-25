/**
 * BehavioralDNA — Mock Upstream Backend
 * =====================================
 * This is a lightweight mock application designed to simulate your real upstream
 * production backend. BehavioralDNA acts as an inline security reverse-proxy
 * in front of this server.
 *
 * How to Run and Test:
 * --------------------
 * 1. Start this mock backend:
 *    $ node mock-backend.js
 *    It will start listening on http://localhost:3002.
 *
 * 2. Configure BehavioralDNA to point to this mock backend:
 *    Create a `.env` file in the root of the project (if not present) and define:
 *    PORT=3001
 *    TARGET_ORIGIN=http://localhost:3002
 *
 * 3. Start/Restart the BehavioralDNA gateway:
 *    $ npm run dev
 *    It will start listening on http://localhost:3001.
 *
 * 4. Perform proxy requests:
 *    - Open http://localhost:3001/backend/api/users in your browser or curl:
 *      $ curl http://localhost:3001/backend/api/users
 *      BehavioralDNA will intercept, compute client DNA, log the request,
 *      and proxy it to this mock backend!
 *
 *    - Open http://localhost:3001/backend/api/sensitive-vault (requires admin simulation).
 */

const express = require('express');
const app = express();
const PORT = parseInt(process.env.MOCK_BACKEND_PORT || process.env.PORT || '3002', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());

// Request logging to console
app.use((req, res, next) => {
  console.log(`[Mock Backend] Received ${req.method} ${req.url} at ${new Date().toLocaleTimeString()}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'mock-upstream-backend', timestamp: new Date().toISOString() });
});

// Root welcome message
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the Upstream Production Mock Backend!',
    version: '1.0.0',
    status: 'ONLINE',
    integrationMode: 'BehavioralDNA Reverse-Proxy Protection Layer Active',
    endpoints: {
      public: [
        'GET /api/users - Retrieve client user listings',
        'GET /api/products - Retrieve current store products inventory'
      ],
      protected: [
        'GET /api/sensitive-vault - Access high-privilege configuration records',
        'POST /api/payment - Simulate card payment authorization'
      ]
    }
  });
});

// Mock Users Listing Endpoint
app.get('/api/users', (req, res) => {
  res.json({
    success: true,
    source: 'Mock Production DB',
    count: 3,
    data: [
      { id: 1, name: 'Alice Johnson', role: 'Support Engineer', email: 'alice@company.com' },
      { id: 2, name: 'Bob Smith', role: 'DevOps Lead', email: 'bob@company.com' },
      { id: 3, name: 'Charlie Miller', role: 'Business Analyst', email: 'charlie@company.com' }
    ]
  });
});

// Mock Products Catalog Endpoint
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    source: 'Mock Catalog Inventory Service',
    count: 2,
    data: [
      { id: 'prod_901', name: 'Premium Cloud VPN License', price: 120.00, stock: 'unlimited' },
      { id: 'prod_102', name: 'Behavioral Threat Scanner (Hardware node)', price: 1450.00, stock: 12 }
    ]
  });
});

// Mock Sensitive Vault Endpoint
app.get('/api/sensitive-vault', (req, res) => {
  // Simulate high security endpoint access
  res.json({
    success: true,
    classification: 'RESTRICTED / ADMIN SECURE',
    vaultItem: {
      primaryDatabaseUrl: 'postgres://production_user:superSecurePassword123@prod-cluster.internal:5432/main_prod',
      encryptionKey: 'pb_dna_key_6a9b4c2e8f0a3c7d1e8f9b0c',
      backupStatus: 'Healthy (Last sync 2 hours ago)'
    }
  });
});

// Mock Payment Execution
app.post('/api/payment', (req, res) => {
  const { amount, cardNumber, holderName } = req.body;

  if (!amount || !cardNumber) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payment parameters. Required: amount, cardNumber'
    });
  }

  // Simulate payment processing delay
  setTimeout(() => {
    res.json({
      success: true,
      transactionId: 'tx_pay_' + Math.random().toString(36).substr(2, 9),
      amount: parseFloat(amount),
      status: 'APPROVED',
      message: `Successfully processed transaction of $${amount} for ${holderName || 'Guest customer'}`
    });
  }, 300);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Mock Backend endpoint not found.'
  });
});

app.listen(PORT, HOST, () => {
  console.log(`\n  🟢 [Mock Upstream Backend] Running on http://${HOST}:${PORT}`);
  console.log(`  🚀  Ready to accept proxied transactions from BehavioralDNA!`);
  console.log(`  ───────────────────────────────────────────────────────────\n`);
});
