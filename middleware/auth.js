const jwt = require('jsonwebtoken');
const userService = require('../services/userService');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Auth Middleware — protects dashboard routes
 */
const authenticate = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    return res.redirect('/login.html');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name || decoded.email,
      username: decoded.email,
    };
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, error: 'Session expired' });
    }
    return res.redirect('/login.html');
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

/**
 * Redirect to setup when no users exist (HTML routes).
 */
const redirectIfNeedsSetup = async (req, res, next) => {
  try {
    if (await userService.needsSetup()) {
      return res.redirect('/setup.html');
    }
  } catch (_) {
    /* continue — DB may be down */
  }
  next();
};

module.exports = {
  authenticate,
  requireAdmin,
  redirectIfNeedsSetup,
  signToken,
  setAuthCookie,
  JWT_SECRET,
};
