/**
 * GhostTrace - Social Media Backend Example
 * 
 * This demonstrates GhostTrace integration with a typical
 * social media backend with authentication, posts, and profiles.
 */

require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Mock data stores
const users = new Map();
const posts = new Map();
let postIdCounter = 1;

// Initialize GhostTrace
(async () => {
  await ghosttrace.init({
    adminEmail: process.env.GHOST_ADMIN_EMAIL || 'admin@socialmedia.com',
    adminPassword: process.env.GHOST_ADMIN_PASS || 'SecurePassword123!',
    dashboardPort: process.env.GHOST_PORT || 3001,
    blockThreshold: 65, // Slightly more strict for social media
  });

  // High security for authentication routes (lower threshold = stricter)
  app.use('/api/auth', ghosttrace.secure({ 
    riskThreshold: 50,
    rateLimit: 20, // Stricter rate limit for auth
  }));

  // Standard security for post creation
  app.use('/api/posts', ghosttrace.secure({ 
    riskThreshold: 65,
  }));

  // Standard security for user profiles
  app.use('/api/users', ghosttrace.secure());

  // Monitor-only mode for public feed (don't block, just track)
  app.use('/api/feed', ghosttrace.secure({ 
    blockOnThreat: false,
  }));

  // === Authentication Routes ===

  app.post('/api/auth/register', (req, res) => {
    const { email, password, username } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (users.has(email)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    users.set(email, { email, username, password, createdAt: new Date() });
    res.json({ 
      success: true, 
      message: 'Registration successful',
      user: { email, username }
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    const user = users.get(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ 
      success: true, 
      token: 'mock-jwt-token',
      user: { email: user.email, username: user.username }
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
  });

  // === Post Routes ===

  app.get('/api/posts', (req, res) => {
    const allPosts = Array.from(posts.values());
    res.json({ posts: allPosts });
  });

  app.post('/api/posts', (req, res) => {
    const { content, userId } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    const post = {
      id: postIdCounter++,
      content,
      userId: userId || 'anonymous',
      createdAt: new Date(),
      likes: 0,
    };

    posts.set(post.id, post);
    res.json({ success: true, post });
  });

  app.put('/api/posts/:id/like', (req, res) => {
    const post = posts.get(parseInt(req.params.id));
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.likes++;
    res.json({ success: true, likes: post.likes });
  });

  app.delete('/api/posts/:id', (req, res) => {
    const deleted = posts.delete(parseInt(req.params.id));
    
    if (!deleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ success: true });
  });

  // === User Profile Routes ===

  app.get('/api/users/:email', (req, res) => {
    const user = users.get(req.params.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userPosts = Array.from(posts.values())
      .filter(p => p.userId === user.email);

    res.json({
      user: {
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      posts: userPosts,
      stats: {
        totalPosts: userPosts.length,
        totalLikes: userPosts.reduce((sum, p) => sum + p.likes, 0),
      }
    });
  });

  // === Public Feed (Monitor-Only) ===

  app.get('/api/feed', (req, res) => {
    const allPosts = Array.from(posts.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);

    res.json({ feed: allPosts });
  });

  // === Health Check ===

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', users: users.size, posts: posts.size });
  });

  // Start application
  app.listen(PORT, () => {
    console.log(`\n  🚀 Social Media Backend running on http://localhost:${PORT}`);
    console.log(`  👻 GhostTrace dashboard at http://localhost:${process.env.GHOST_PORT || 3001}`);
    console.log(`\n  📱 Try these endpoints:`);
    console.log(`     POST /api/auth/register - Register new user`);
    console.log(`     POST /api/auth/login - Login`);
    console.log(`     GET  /api/feed - View public feed`);
    console.log(`     POST /api/posts - Create post`);
    console.log(`     GET  /api/users/:email - View profile\n`);
  });
})().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
