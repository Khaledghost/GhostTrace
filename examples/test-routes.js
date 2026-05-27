const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
app.use(express.json());

(async () => {
  // Initialize GhostTrace
  await ghosttrace.init();
  
  // Apply GhostTrace security to all /api routes
  app.use('/api', ghosttrace.secure());
  
  // Define your API routes AFTER the middleware
  app.get('/api/hello', (req, res) => {
    res.json({ 
      message: 'Hello from GhostTrace!',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/users', (req, res) => {
    res.json({ 
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
      ]
    });
  });

  app.get('/api/users/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    res.json({ 
      user: { id: userId, name: `User ${userId}` }
    });
  });

  app.post('/api/users', (req, res) => {
    res.json({ 
      success: true,
      message: 'User created',
      user: req.body
    });
  });

  app.put('/api/users/:id', (req, res) => {
    res.json({ 
      success: true,
      message: 'User updated',
      id: req.params.id,
      data: req.body
    });
  });

  app.delete('/api/users/:id', (req, res) => {
    res.json({ 
      success: true,
      message: 'User deleted',
      id: req.params.id
    });
  });
  
  // Public route (not protected)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ Test Application Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  🌐 Test App:  http://localhost:${PORT}`);
    console.log(`  📊 Dashboard: http://localhost:3001`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('  📋 Try these commands:');
    console.log('');
    console.log('  curl http://localhost:3000/api/hello');
    console.log('  curl http://localhost:3000/api/users');
    console.log('  curl http://localhost:3000/api/users/1');
    console.log('  curl -X POST http://localhost:3000/api/users \\');
    console.log('       -H "Content-Type: application/json" \\');
    console.log('       -d \'{"name":"Dave"}\'');
    console.log('');
    console.log('  Then check the Route Monitor in the dashboard!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
})();
