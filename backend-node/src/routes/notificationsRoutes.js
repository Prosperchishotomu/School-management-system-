const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET /notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await query(
      `SELECT * FROM notifications
       WHERE user_id = ? OR (school_id = ? AND user_id IS NULL)
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id, req.user.school_id]
    );
    return res.json({ data: notifications });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch notifications.' } });
  }
});

// POST /notifications/:id/read
router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    return res.json({ data: { message: 'Notification marked as read.' } });
  } catch (err) {
    console.error('Read notification error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to mark notification as read.' } });
  }
});

// POST /notifications/read-all
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR (school_id = ? AND user_id IS NULL)', [req.user.id, req.user.school_id]);
    return res.json({ data: { message: 'All notifications marked as read.' } });
  } catch (err) {
    console.error('Read all notifications error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to mark all notifications as read.' } });
  }
});

module.exports = router;
