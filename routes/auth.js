const express = require('express');
const rateLimit = require('express-rate-limit');
const userService = require('../services/userService');
const { isDbReady } = require('../config/database');
const { authenticate, requireAdmin, signToken, setAuthCookie } = require('../middleware/auth');
const { wrapRouter } = require('../utils/wrapRouter');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many authentication attempts. Try again later.' },
});

router.get('/setup-status', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ success: false, needsSetup: true, error: 'Database unavailable' });
  }
  const needsSetup = await userService.needsSetup();
  res.json({ success: true, needsSetup });
});

router.post('/setup', authLimiter, async (req, res, next) => {
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
    if (err.message && !err.statusCode) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }

    if (await userService.needsSetup()) {
      return res.status(400).json({ success: false, error: 'Setup required', needsSetup: true });
    }

    const email = req.body.email || req.body.username;
    const { password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await userService.authenticate(email, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  });
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

router.get('/users', authenticate, requireAdmin, async (req, res) => {
  const users = await userService.listUsers();
  res.json({ success: true, users });
});

router.post('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body, req.user.email);
    res.status(201).json({ success: true, user });
  } catch (err) {
    if (err.message && !err.statusCode) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

router.patch('/users/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.user.email);
    res.json({ success: true, user });
  } catch (err) {
    if (err.message && !err.statusCode) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

router.delete('/users/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id, req.user.id, req.user.email);
    res.json({ success: true });
  } catch (err) {
    if (err.message && !err.statusCode) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

module.exports = wrapRouter(router);
