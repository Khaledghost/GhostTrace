const express = require('express');
const userService = require('../services/userService');
const { isDbReady } = require('../config/database');
const { authenticate, requireAdmin, signToken, setAuthCookie } = require('../middleware/auth');

const router = express.Router();

router.get('/setup-status', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ success: false, needsSetup: true, error: 'Database unavailable' });
  }
  const needsSetup = await userService.needsSetup();
  res.json({ success: true, needsSetup });
});

router.post('/setup', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }
    if (!(await userService.needsSetup())) {
      return res.status(400).json({ success: false, error: 'Setup already completed' });
    }

    const { email, password, name } = req.body;
    const user = await userService.createAdmin({ email, password, name });
    const token = signToken(user);
    setAuthCookie(res, token);

    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }

    if (await userService.needsSetup()) {
      return res.status(400).json({ success: false, error: 'Setup required', needsSetup: true });
    }

    const email = req.body.email || req.body.username;
    const { password } = req.body;

    const user = await userService.authenticate(email, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) return res.json({ authenticated: false });

  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      authenticated: true,
      user: decoded.email,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      id: decoded.sub,
    });
  } catch (err) {
    res.json({ authenticated: false });
  }
});

// ─── User management (admin only) ───────────────────────────────────────────

router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await userService.listUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await userService.createUser(req.body, req.user.email);
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.user.email);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await userService.deleteUser(req.params.id, req.user.id, req.user.email);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
