const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/db');

const crypto = require('crypto');

let JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
let JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
if (!JWT_PRIVATE_KEY || !JWT_PUBLIC_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL CONFIGURATION ERROR: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production. Application will exit.');
    process.exit(1);
  } else {
    console.warn('WARNING: JWT key pair is missing in development. Generating an ephemeral RS256 key pair.');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    JWT_PRIVATE_KEY = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    JWT_PUBLIC_KEY = pair.publicKey.export({ type: 'spki', format: 'pem' });
  }
}


function generateToken(userPayload) {
  return jwt.sign(userPayload, JWT_PRIVATE_KEY, { algorithm: 'RS256', expiresIn: '15m' });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
}

async function resolveRole(userId, legacyRole) {
  try {
    const role = await queryOne(
      `SELECT r.name FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? ORDER BY r.id LIMIT 1`,
      [userId]
    );
    if (role?.name) return role.name;
  } catch (_) {}
  return legacyRole || null;
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
    const decoded = jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
    
    // Fetch fresh status and role from DB
    const user = await queryOne('SELECT u.*, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.id = ?', [decoded.id]);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User account is inactive or disabled.' }
      });
    }

    user.role = await resolveRole(user.id, user.role || decoded.role);
    if (!user.role) {
      return res.status(403).json({ error: { code: 'ACCESS_DENIED', message: 'No role is assigned to this account.' } });
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
  verifyAccessToken,
  authenticateToken,
  requireRoles,
  resolveRole
};
