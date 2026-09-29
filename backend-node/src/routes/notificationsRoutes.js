const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const STAFF_ROLES = new Set([
  'super_admin', 'school_admin', 'head', 'head_teacher', 'deputy_head', 'hod',
  'teacher', 'bursar', 'librarian', 'nurse', 'counsellor', 'guidance_counsellor',
  'boarding_master', 'boarding_mistress'
]);
const ADMIN_ROLES = new Set(['super_admin', 'school_admin', 'head', 'head_teacher']);
const PARENT_ROLES = new Set(['parent', 'guardian']);
const STUDENT_ROLES = new Set(['student']);

function requestedSchoolId(req) {
  if (req.user.role === 'super_admin' && req.headers['x-active-school-id']) {
    return String(req.headers['x-active-school-id']);
  }
  return req.user.school_id;
}

async function getSchoolId(req) {
  const schoolId = requestedSchoolId(req);
  if (!schoolId) return null;
  const school = await queryOne('SELECT id FROM schools WHERE id = ?', [schoolId]);
  return school ? schoolId : null;
}

function canTargetRole(senderRole, targetRole) {
  if (!targetRole) return false;
  if (targetRole === 'all') return ADMIN_ROLES.has(senderRole);
  if (ADMIN_ROLES.has(senderRole)) return ['teacher', 'parent', 'student', 'school_admin'].includes(targetRole);
  if (senderRole === 'teacher' || senderRole === 'hod') return ['teacher', 'parent'].includes(targetRole);
  return false;
}

function canTargetRecipient(senderRole, recipientRole) {
  if (senderRole === 'super_admin' || ADMIN_ROLES.has(senderRole)) return true;
  if (PARENT_ROLES.has(senderRole) || STUDENT_ROLES.has(senderRole)) return STAFF_ROLES.has(recipientRole);
  if (senderRole === 'teacher' || senderRole === 'hod') return STAFF_ROLES.has(recipientRole) || PARENT_ROLES.has(recipientRole);
  return STAFF_ROLES.has(recipientRole) || PARENT_ROLES.has(recipientRole);
}

async function senderName(userId, fallback) {
  try {
    const row = await queryOne(
      `SELECT COALESCE(st.name, g.name, u.username) AS name
       FROM users u
       LEFT JOIN staff st ON u.id = st.user_id
       LEFT JOIN guardians g ON u.id = g.user_id
       WHERE u.id = ?`,
      [userId]
    );
    return row?.name || fallback || 'System User';
  } catch (_) {
    return fallback || 'System User';
  }
}

async function isVisibleNotification(id, schoolId, req) {
  return queryOne(
    `SELECT id FROM notifications
     WHERE id = ? AND school_id = ?
       AND (user_id = ? OR target_role = ?
         OR (user_id IS NULL AND (target_role IS NULL OR target_role = 'all')))` ,
    [id, schoolId, req.user.id, req.user.role]
  );
}

async function ensureSchema() {
  try { await query('ALTER TABLE notifications ADD COLUMN target_role VARCHAR(50) NULL'); } catch (_) {}
  try { await query('ALTER TABLE notifications ADD COLUMN sender_id VARCHAR(50) NULL'); } catch (_) {}
  try { await query('ALTER TABLE notifications ADD COLUMN sender_name VARCHAR(100) NULL'); } catch (_) {}
  try { await query('ALTER TABLE notifications ADD COLUMN type VARCHAR(50) DEFAULT "direct_message"'); } catch (_) {}
}
ensureSchema();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getSchoolId(req);
    if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context before viewing communication.' } });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, Number.parseInt(req.query.per_page || req.query.limit, 10) || 50));
    const offset = (page - 1) * perPage;
    const notifications = await query(
      `SELECT n.*, COALESCE(n.sender_name, u.username, 'System Administrator') AS resolved_sender_name,
              u.role AS sender_role
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE n.school_id = ?
         AND (n.user_id = ? OR n.target_role = ?
           OR (n.user_id IS NULL AND (n.target_role IS NULL OR n.target_role = 'all')))
       ORDER BY n.created_at DESC LIMIT ${perPage} OFFSET ${offset}`,
      [schoolId, req.user.id, req.user.role]
    );
    const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM notifications n WHERE n.school_id = ? AND (n.user_id = ? OR n.target_role = ? OR (n.user_id IS NULL AND (n.target_role IS NULL OR n.target_role = 'all')))` , [schoolId, req.user.id, req.user.role]);
    return res.json({ data: notifications, meta: { page, per_page: perPage, total: Number(totalRow?.total || 0), request_id: req.requestId } });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch notifications.' } });
  }
});

router.get('/recipients', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getSchoolId(req);
    if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context before loading recipients.' } });
    const recipients = await query(
      `SELECT u.id, u.username, u.role, u.email,
              COALESCE(st.name, g.name, u.username) AS display_name, st.role_title
       FROM users u
       LEFT JOIN staff st ON u.id = st.user_id
       LEFT JOIN guardians g ON u.id = g.user_id
       WHERE u.school_id = ? AND u.id != ? AND u.status = 'active'
       ORDER BY display_name ASC`,
      [schoolId, req.user.id]
    );
    return res.json({ data: recipients.filter((r) => canTargetRecipient(req.user.role, r.role)) });
  } catch (err) {
    console.error('Get recipients error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch messaging contacts.' } });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getSchoolId(req);
    if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context before sending communication.' } });
    const { target_user_id, target_role, title, message, body, type } = req.body;
    const msgContent = message || body;
    if (!title || !msgContent) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Title and message content are required.' } });
    if (!!target_user_id === !!target_role) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Specify exactly one recipient user or target group.' } });

    if (target_role && !canTargetRole(req.user.role, target_role)) {
      return res.status(403).json({ error: { code: 'COMMUNICATION_SCOPE_DENIED', message: 'Your role cannot broadcast to this audience.' } });
    }
    if (target_user_id) {
      const recipient = await queryOne(
        `SELECT id, role FROM users WHERE id = ? AND school_id = ? AND status = 'active'`,
        [target_user_id, schoolId]
      );
      if (!recipient) return res.status(404).json({ error: { code: 'RECIPIENT_NOT_FOUND', message: 'Recipient is not active in the selected school.' } });
      if (!canTargetRecipient(req.user.role, recipient.role)) return res.status(403).json({ error: { code: 'COMMUNICATION_SCOPE_DENIED', message: 'Your role cannot message this recipient.' } });
    }

    const id = 'NTF' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const name = await senderName(req.user.id, req.user.username);
    await query(
      `INSERT INTO notifications
       (id, school_id, user_id, target_role, sender_id, sender_name, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [id, schoolId, target_user_id || null, target_role || null, req.user.id, name, title.trim(), msgContent.trim(), type || 'direct_message']
    );
    return res.status(201).json({ data: await queryOne('SELECT * FROM notifications WHERE id = ?', [id]) });
  } catch (err) {
    console.error('Send notification error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to send targeted notification.' } });
  }
});

router.post('/reply', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getSchoolId(req);
    if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context before replying.' } });
    const { original_notification_id, recipient_id, reply_title, reply_message } = req.body;
    if (!recipient_id || !reply_message) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Recipient ID and reply message are required.' } });
    if (original_notification_id && !(await isVisibleNotification(original_notification_id, schoolId, req))) {
      return res.status(404).json({ error: { code: 'MESSAGE_NOT_FOUND', message: 'The original message is not available to this user.' } });
    }
    const recipient = await queryOne(`SELECT id, role FROM users WHERE id = ? AND school_id = ? AND status = 'active'`, [recipient_id, schoolId]);
    if (!recipient) return res.status(404).json({ error: { code: 'RECIPIENT_NOT_FOUND', message: 'Reply recipient is not active in this school.' } });
    if (!canTargetRecipient(req.user.role, recipient.role)) return res.status(403).json({ error: { code: 'COMMUNICATION_SCOPE_DENIED', message: 'Your role cannot reply to this recipient.' } });
    const id = 'NTF' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const name = await senderName(req.user.id, req.user.username);
    const title = reply_title ? (reply_title.startsWith('Re:') ? reply_title : `Re: ${reply_title}`) : `Re: Message from ${name}`;
    await query(
      `INSERT INTO notifications (id, school_id, user_id, sender_id, sender_name, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'direct_message', 0, NOW())`,
      [id, schoolId, recipient_id, req.user.id, name, title, reply_message.trim()]
    );
    if (original_notification_id) await query(`UPDATE notifications SET is_read = 1 WHERE id = ? AND school_id = ?`, [original_notification_id, schoolId]);
    return res.status(201).json({ data: { message: 'Reply sent successfully.', reply_id: id } });
  } catch (err) {
    console.error('Reply notification error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to send reply.' } });
  }
});

router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getSchoolId(req);
    if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context.' } });
    await query(`UPDATE notifications SET is_read = 1 WHERE id = ? AND school_id = ? AND (user_id = ? OR target_role = ? OR (user_id IS NULL AND (target_role IS NULL OR target_role = 'all')))` , [req.params.id, schoolId, req.user.id, req.user.role]);
    return res.json({ data: { message: 'Notification marked as read.' } });
  } catch (err) {
    console.error('Read notification error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to mark notification as read.' } });
  }
});

router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getSchoolId(req);
    if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context.' } });
    await query(`UPDATE notifications SET is_read = 1 WHERE school_id = ? AND (user_id = ? OR target_role = ? OR (user_id IS NULL AND (target_role IS NULL OR target_role = 'all')))` , [schoolId, req.user.id, req.user.role]);
    return res.json({ data: { message: 'All notifications marked as read.' } });
  } catch (err) {
    console.error('Read all notifications error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to mark all notifications as read.' } });
  }
});

router.post('/delete-batch', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No notification IDs provided for deletion.' } });
    const cleanIds = ids.map((id) => String(id).replace(/^ann_|^msg_/, ''));
    const placeholders = cleanIds.map(() => '?').join(',');
    const schoolId = await getSchoolId(req);
    if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context.' } });
    await query(`DELETE FROM notifications WHERE school_id = ? AND id IN (${placeholders}) AND (user_id = ? OR target_role = ? OR (user_id IS NULL AND (target_role IS NULL OR target_role = 'all')))` , [schoolId, ...cleanIds, req.user.id, req.user.role]);
    try {
      const ownerClause = ADMIN_ROLES.has(req.user.role) ? '' : ' AND (sender_id = ? OR recipient_id = ?)';
      const ownerParams = ADMIN_ROLES.has(req.user.role) ? [schoolId, ...cleanIds] : [schoolId, ...cleanIds, req.user.id, req.user.id];
      await query(`DELETE FROM teacher_messages WHERE school_id = ? AND id IN (${placeholders})${ownerClause}`, ownerParams);
    } catch (_) {}
    try { await query(`DELETE FROM announcements WHERE school_id = ? AND id IN (${placeholders}) AND (created_by = ? OR ? IN ('super_admin','school_admin','head','head_teacher'))`, [schoolId, ...cleanIds, req.user.id, req.user.role]); } catch (_) {}
    return res.json({ data: { message: `Deleted ${cleanIds.length} permitted item(s).` } });
  } catch (err) {
    console.error('Delete batch error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete selected notifications.' } });
  }
});

router.post('/clear-all', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getSchoolId(req);
    if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context.' } });
    await query(`DELETE FROM notifications WHERE school_id = ? AND (user_id = ? OR target_role = ? OR (user_id IS NULL AND (target_role IS NULL OR target_role = 'all')))` , [schoolId, req.user.id, req.user.role]);
    return res.json({ data: { message: 'Visible notifications cleared.' } });
  } catch (err) {
    console.error('Clear all notifications error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to clear notifications.' } });
  }
});

module.exports = router;
