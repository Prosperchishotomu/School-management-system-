const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'SCHOOLBASE_JWT_SUPER_SECRET_KEY_2026';

function generateToken(userPayload) {
  return jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Bearer token missing.' }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh status and role from DB
    const user = await queryOne('SELECT u.id, u.school_id, u.username, u.role, u.status, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.id = ?', [decoded.id]);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User account is inactive or disabled.' }
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired.' }
    });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }

    if (req.user.role === 'super_admin') {
      return next(); // Super Admin has access to all routes
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'ACCESS_DENIED', message: `Role '${req.user.role}' is not authorized for this operation.` }
      });
    }

    next();
  };
}

module.exports = {
  generateToken,
  authenticateToken,
  requireRoles
};
