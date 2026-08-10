const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/db');

const crypto = require('crypto');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL CONFIGURATION ERROR: process.env.JWT_SECRET is missing in production. Application will exit.');
    process.exit(1);
  } else {
    console.warn('WARNING: process.env.JWT_SECRET is missing in development. Generating a secure dynamic session fallback key.');
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
  }
}


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

    // License Enforcement Policy
    if (user.role !== 'super_admin' && user.school_id) {
      // Allow license status retrieval & renewal routes to bypass block
      const isLicenseRoute = req.path.includes('/license');
      if (!isLicenseRoute) {
        try {
          const license = await queryOne(
            'SELECT expires_at, status FROM licenses WHERE school_id = ? ORDER BY expires_at DESC LIMIT 1',
            [user.school_id]
          );
          if (license) {
            const now = new Date();
            const expires = new Date(license.expires_at);
            if (license.status === 'expired' || expires < now) {
              return res.status(403).json({
                error: { code: 'LICENSE_EXPIRED', message: 'The license subscription for this school has expired. Please contact support or renew the license.' }
              });
            }
          }
        } catch (licErr) {
          console.warn('License check query warning (table may not exist yet):', licErr.message);
        }
      }
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
