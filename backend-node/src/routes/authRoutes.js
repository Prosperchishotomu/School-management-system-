const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { queryOne, query } = require('../config/db');
const { generateToken, authenticateToken, resolveRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authRateLimit } = require('../middleware/rateLimit');

// Helper: Hash token
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieValue(req, name) {
  const header = req.headers.cookie || '';
  const item = header.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

function shortId() {
  return crypto.randomBytes(4).toString('hex');
}

// POST /login (or /auth/login)
router.post('/login',
  authRateLimit,
  validate.run({
    username: { required: true, minLen: 2, maxLen: 80 },
    password: { required: true, minLen: 4 },
  }),
  async (req, res) => {
    try {
      const { username, password } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      // 1. Check account & lockout
      const user = await queryOne(
        `SELECT u.*, s.name as school_name
         FROM users u
         LEFT JOIN schools s ON u.school_id = s.id
         WHERE u.username = ? OR u.email = ?`,
        [username.trim(), username.trim()]
      );

      if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
        return res.status(429).json({
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Account is temporarily locked due to multiple failed login attempts. Try again after ${new Date(user.locked_until).toLocaleTimeString()}.`
          }
        });
      }

      if (!user) {
        // Log attempt (safe execution)
        try {
          await query('INSERT INTO login_attempts (ip, username, success) VALUES (?,?,?)', [ip, username.trim(), false]);
        } catch (e) {}
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } });
      }

      if (user.status !== 'active') {
        return res.status(401).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'User account is inactive or suspended.' } });
      }

      const validPass = bcrypt.compareSync(password, user.password_hash);
      if (!validPass) {
        // Increment failed logins (safe execution)
        try {
          const failedCount = (user.failed_logins || 0) + 1;
          let lockUntil = null;
          if (failedCount >= 5) {
            lockUntil = new Date(Date.now() + 15 * 60 * 1000);
          }
          await query('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', [failedCount, lockUntil, user.id]);
          await query('INSERT INTO login_attempts (ip, username, success) VALUES (?,?,?)', [ip, username.trim(), false]);
        } catch (e) {}

        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } });
      }

      // 2. Check MFA if enabled
      if (user.mfa_enabled) {
        const tempSessionToken = crypto.randomBytes(32).toString('hex');
        return res.json({
          data: {
            mfa_required: true,
            mfa_session: tempSessionToken,
            user_id: user.uuid
          }
        });
      }

      // Reset failed logins & update last_login_at (safe execution)
      try {
        await query('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?', [user.id]);
        await query('INSERT INTO login_attempts (ip, username, success) VALUES (?,?,?)', [ip, username.trim(), true]);
      } catch (e) {
        try {
          await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
        } catch (e2) {}
      }

      // 3. Issue JWT Access Token
      const tokenPayload = {
        id: user.id,
        uuid: user.uuid,
        school_id: user.school_id,
        role: await resolveRole(user.id, user.role)
      };
      user.role = tokenPayload.role;
      const token = generateToken(tokenPayload);

      // 4. Issue Opaque Refresh Token (7 days)
      const refreshTokenPlain = crypto.randomBytes(40).toString('hex');
      const refreshTokenHash = hashToken(refreshTokenPlain);
      const familyId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      try {
        await query(
          `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, ip, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [shortId(), user.id, refreshTokenHash, familyId, expiresAt, ip, userAgent]
        );
      } catch (rfErr) {
        console.warn('Refresh token table write warning:', rfErr.message);
      }

      res.cookie('schoolbase_refresh', refreshTokenPlain, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth'
      });

      // Audit Log
      try {
        await query('INSERT INTO audit_logs (id, school_id, user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?,?,?)', [
          'LOG' + Math.random().toString(36).substr(2, 5).toUpperCase(),
          user.school_id || null,
          user.id,
          'USER_LOGIN',
          'users',
          user.id,
          JSON.stringify({ username: user.username, role: user.role, ip })
        ]);
      } catch (auditErr) {
        console.warn('Audit log write warning:', auditErr.message);
      }

      return res.json({
        data: {
          token,
          refresh_token: refreshTokenPlain,
          user: {
            id: user.id,
            uuid: user.uuid,
            school_id: user.school_id,
            school_name: user.school_name,
            username: user.username,
            role: user.role,
            email: user.email,
            status: user.status
          }
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Authentication server error.' } });
    }
  }
);

// POST /refresh
router.post('/refresh', authRateLimit, async (req, res) => {
  try {
    const refresh_token = req.body?.refresh_token || cookieValue(req, 'schoolbase_refresh');
    if (!refresh_token) {
      return res.status(400).json({ error: { code: 'MISSING_TOKEN', message: 'Refresh token is required.' } });
    }

    const tokenHash = hashToken(refresh_token);
    const existing = await queryOne('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);

    if (!existing) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token.' } });
    }

    // Check reuse / revoked
    if (existing.revoked_at) {
      // Security breach! Revoke all tokens in family
      await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = ?', [existing.family_id]);
      return res.status(401).json({ error: { code: 'TOKEN_REUSE_DETECTED', message: 'Token family revoked due to reuse detection.' } });
    }

    if (new Date(existing.expires_at) < new Date()) {
      return res.status(401).json({ error: { code: 'EXPIRED_TOKEN', message: 'Refresh token has expired.' } });
    }

    // Fetch user
    const user = await queryOne('SELECT u.*, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.id = ?', [existing.user_id]);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'User account is inactive.' } });
    }

    // Rotate refresh token
    const newRefreshTokenPlain = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = hashToken(newRefreshTokenPlain);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const newRefreshTokenId = shortId();
    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newRefreshTokenId, user.id, newRefreshTokenHash, existing.family_id, newExpiresAt, req.ip || '127.0.0.1', req.headers['user-agent'] || 'Unknown']
    );

    // Revoke old token and reference replacement
    await query('UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_id = ? WHERE id = ?', [newRefreshTokenId, existing.id]);

    // Issue new Access Token
    user.role = await resolveRole(user.id, user.role);
    const newToken = generateToken({
      id: user.id,
      uuid: user.uuid,
      school_id: user.school_id,
      role: user.role
    });

    res.cookie('schoolbase_refresh', newRefreshTokenPlain, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth'
    });

    return res.json({
      data: {
        token: newToken,
        refresh_token: newRefreshTokenPlain
      }
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Could not refresh authentication token.' } });
  }
});

// POST /logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const tokenHash = hashToken(refresh_token);
      await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [tokenHash]);
    }
    return res.json({ data: { message: 'Logged out successfully.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Logout failed.' } });
  }
});

// POST /logout-all
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?', [req.user.id]);
    return res.json({ data: { message: 'All active sessions revoked successfully.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to revoke sessions.' } });
  }
});

// GET /me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const fullUser = await queryOne(
      `SELECT u.id, u.uuid, u.school_id, u.username, u.email, u.phone, u.status, u.mfa_enabled, u.locale, u.avatar_path, s.name as school_name
       FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.id = ?`,
      [req.user.id]
    );
    fullUser.role = req.user.role;
    return res.json({ data: fullUser });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Error retrieving user profile.' } });
  }
});

// POST /change-password
router.post('/change-password',
  authenticateToken,
  validate.run({
    current_password: { required: true, minLen: 4 },
    new_password:     { required: true, minLen: 8, label: 'New password' },
  }),
  async (req, res) => {
    try {
      const { current_password, new_password } = req.body;

      const user = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      if (!bcrypt.compareSync(current_password, user.password_hash)) {
        return res.status(400).json({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect.' } });
      }

      const newHash = bcrypt.hashSync(new_password, 10);
      await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

      // Revoke all refresh tokens on password change
      await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?', [req.user.id]);

      return res.json({ data: { message: 'Password updated successfully. Please log in again.' } });
    } catch (err) {
      console.error('Change password error:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Password change error.' } });
    }
  }
);

// POST /forgot-password
router.post('/forgot-password',
  authRateLimit,
  validate.run({ email: { required: true } }),
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await queryOne('SELECT id FROM users WHERE email = ?', [email.trim()]);

      // Always respond with success to prevent account enumeration
      if (!user) {
        return res.json({ data: { message: 'If an account with that email exists, a password reset link has been sent.' } });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetHash = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await query('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?,?)', [shortId(), user.id, resetHash, expiresAt]);

      // In real prod, send email. Here return message:
      return res.json({
        data: {
          message: 'If an account with that email exists, a password reset link has been sent.',
          reset_token_dev: process.env.NODE_ENV !== 'production' ? resetToken : undefined
        }
      });
    } catch (err) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Forgot password request failed.' } });
    }
  }
);

// POST /reset-password
router.post('/reset-password',
  authRateLimit,
  validate.run({
    token: { required: true },
    new_password: { required: true, minLen: 8 }
  }),
  async (req, res) => {
    try {
      const { token, new_password } = req.body;
      const tokenHash = hashToken(token);

      const reset = await queryOne('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used = 0 AND expires_at > NOW()', [tokenHash]);

      if (!reset) {
        return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Password reset token is invalid or has expired.' } });
      }

      const newHash = bcrypt.hashSync(new_password, 10);
      await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, reset.user_id]);
      await query('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [reset.id]);
      await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?', [reset.user_id]);

      return res.json({ data: { message: 'Password reset successful. You can now log in with your new password.' } });
    } catch (err) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Reset password failed.' } });
    }
  }
);

// GET /sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await query(
      `SELECT id, ip, user_agent, created_at, expires_at, revoked_at
       FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ data: sessions });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Could not fetch active sessions.' } });
  }
});

// DELETE /sessions/:id
router.delete('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    return res.json({ data: { message: 'Session revoked successfully.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Could not revoke session.' } });
  }
});

// MFA Endpoints: POST /mfa/enable, POST /mfa/verify, DELETE /mfa/disable
router.post('/mfa/enable', authenticateToken, async (req, res) => {
  try {
    const secret = crypto.randomBytes(20).toString('hex').toUpperCase();
    const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());

    await query(
      'UPDATE users SET mfa_secret_enc = ?, mfa_backup_codes_enc = ? WHERE id = ?',
      [secret, JSON.stringify(backupCodes), req.user.id]
    );

    return res.json({
      data: {
        secret,
        qr_code_url: `otpauth://totp/SchoolBase:${req.user.username}?secret=${secret}&issuer=SchoolBase`,
        backup_codes: backupCodes
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to initialize MFA.' } });
  }
});

router.post('/mfa/verify', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Verification code required.' } });
    }

    await query('UPDATE users SET mfa_enabled = 1 WHERE id = ?', [req.user.id]);
    return res.json({ data: { message: 'MFA enabled successfully.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'MFA verification failed.' } });
  }
});

router.delete('/mfa/disable', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_backup_codes_enc = NULL WHERE id = ?', [req.user.id]);
    return res.json({ data: { message: 'MFA disabled successfully.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to disable MFA.' } });
  }
});

module.exports = router;
