const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { queryOne, query } = require('../config/db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validate');

// POST /login
router.post('/login',
  validate.run({
    username: { required: true, minLen: 2, maxLen: 80 },
    password: { required: true, minLen: 4 },
  }),
  async (req, res) => {
  try {
    const { username, password } = req.body;


    const user = await queryOne('SELECT u.*, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.username = ?', [username.trim()]);
    if (!user) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'User account is inactive or deactivated.' } });
    }

    const validPass = bcrypt.compareSync(password, user.password_hash);
    if (!validPass) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } });
    }

    const tokenPayload = {
      id: user.id,
      school_id: user.school_id,
      role: user.role
    };

    const token = generateToken(tokenPayload);

    // Audit log entry (safe execution)
    try {
      await query('INSERT INTO audit_logs (id, school_id, user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?,?,?)', [
        'LOG' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        user.school_id || null,
        user.id,
        'USER_LOGIN',
        'users',
        user.id,
        JSON.stringify({ username: user.username, role: user.role })
      ]);
    } catch (auditErr) {
      console.warn('Audit log write warning:', auditErr.message);
    }

    return res.json({
      data: {
        token,
        user: {
          id: user.id,
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
});

// GET /me
router.get('/me', authenticateToken, async (req, res) => {
  return res.json({ data: req.user });
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

    return res.json({ data: { message: 'Password updated successfully.' } });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Password change error.' } });
  }
});

module.exports = router;
