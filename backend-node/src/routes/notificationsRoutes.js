const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Schema Migration Helper
async function ensureSchema() {
  try { await query('ALTER TABLE notifications ADD COLUMN target_role VARCHAR(50) NULL'); } catch(e) {}
  try { await query('ALTER TABLE notifications ADD COLUMN sender_id VARCHAR(50) NULL'); } catch(e) {}
  try { await query('ALTER TABLE notifications ADD COLUMN sender_name VARCHAR(100) NULL'); } catch(e) {}
  try { await query('ALTER TABLE notifications ADD COLUMN type VARCHAR(50) DEFAULT "direct_message"'); } catch(e) {}
}
ensureSchema();

// GET /notifications — strictly targeted for current user or their role
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const schoolId = req.user.school_id;
    const role = req.user.role || 'user';

    const notifications = await query(
      `SELECT n.*, 
              COALESCE(n.sender_name, u.username, 'System Administrator') as resolved_sender_name,
              u.role as sender_role
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE (n.user_id = ? 
          OR (n.target_role = ?) 
          OR (n.school_id = ? AND n.user_id IS NULL AND (n.target_role IS NULL OR n.target_role = 'all')))
       ORDER BY n.created_at DESC LIMIT 100`,
      [userId, role, schoolId]
    );

    return res.json({ data: notifications });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch notifications.' } });
  }
});

// GET /notifications/recipients — get list of users in school to message (teachers, parents, admins)
router.get('/recipients', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const currentUserId = req.user.id;

    // Fetch users with their profiles (staff name or guardian name)
    const recipients = await query(
      `SELECT u.id, u.username, u.role, u.email,
              COALESCE(st.name, g.name, u.username) as display_name,
              st.role_title
       FROM users u
       LEFT JOIN staff st ON u.id = st.user_id
       LEFT JOIN guardians g ON u.id = g.user_id
       WHERE u.school_id = ? AND u.id != ? AND u.status = 'active'
       ORDER BY display_name ASC`,
      [schoolId, currentUserId]
    );

    return res.json({ data: recipients });
  } catch (err) {
    console.error('Get recipients error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch messaging contacts.' } });
  }
});

// POST /notifications — Send a targeted notification or direct message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const senderId = req.user.id;

    // Fetch sender's display name
    let senderName = req.user.username || 'System User';
    try {
      const senderInfo = await queryOne(
        `SELECT COALESCE(st.name, g.name, u.username) as name 
         FROM users u 
         LEFT JOIN staff st ON u.id = st.user_id 
         LEFT JOIN guardians g ON u.id = g.user_id 
         WHERE u.id = ?`,
        [senderId]
      );
      if (senderInfo && senderInfo.name) senderName = senderInfo.name;
    } catch(e) {}

    const { target_user_id, target_role, title, message, body, type } = req.body;
    const msgContent = message || body;

    if (!title || !msgContent) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Title and message content are required.' } });
    }

    if (!target_user_id && !target_role) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please specify a recipient user or target group.' } });
    }

    const notifId = 'NTF' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    await query(
      `INSERT INTO notifications (id, school_id, user_id, target_role, sender_id, sender_name, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        notifId,
        schoolId,
        target_user_id || null,
        target_role || null,
        senderId,
        senderName,
        title.trim(),
        msgContent.trim(),
        type || 'direct_message'
      ]
    );

    const created = await queryOne('SELECT * FROM notifications WHERE id = ?', [notifId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Send notification error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to send targeted notification.' } });
  }
});

// POST /notifications/reply — In-system direct reply to a notification/message sender
router.post('/reply', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const senderId = req.user.id;
    const { original_notification_id, recipient_id, reply_title, reply_message } = req.body;

    if (!recipient_id || !reply_message) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Recipient ID and reply message are required.' } });
    }

    // Sender display name
    let senderName = req.user.username || 'System User';
    try {
      const senderInfo = await queryOne(
        `SELECT COALESCE(st.name, g.name, u.username) as name 
         FROM users u 
         LEFT JOIN staff st ON u.id = st.user_id 
         LEFT JOIN guardians g ON u.id = g.user_id 
         WHERE u.id = ?`,
        [senderId]
      );
      if (senderInfo && senderInfo.name) senderName = senderInfo.name;
    } catch(e) {}

    const replyId = 'NTF' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const title = reply_title ? (reply_title.startsWith('Re:') ? reply_title : `Re: ${reply_title}`) : `Re: Message from ${senderName}`;

    await query(
      `INSERT INTO notifications (id, school_id, user_id, sender_id, sender_name, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'direct_message', 0, NOW())`,
      [replyId, schoolId, recipient_id, senderId, senderName, title, reply_message.trim()]
    );

    // Optionally mark original notification as read
    if (original_notification_id) {
      try {
        await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [original_notification_id]);
      } catch(e) {}
    }

    return res.status(201).json({ data: { message: 'Reply sent successfully.', reply_id: replyId } });
  } catch (err) {
    console.error('Reply notification error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to send reply.' } });
  }
});

// POST /notifications/:id/read — Mark single notification as read
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

// POST /notifications/read-all — Mark all notifications as read for current user
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = 1 
       WHERE user_id = ? OR target_role = ? OR (school_id = ? AND user_id IS NULL AND target_role IS NULL)`,
      [req.user.id, req.user.role, req.user.school_id]
    );
    return res.json({ data: { message: 'All notifications marked as read.' } });
  } catch (err) {
    console.error('Read all notifications error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to mark all notifications as read.' } });
  }
});

module.exports = router;

