const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query, queryOne, withTransaction } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { enqueueMessageDeliveries } = require('../services/delivery');
const { broadcastToUsers } = require('../services/realtime');

const ADMIN_ROLES = new Set(['super_admin', 'school_admin', 'head', 'head_teacher']);
const STAFF_ROLES = new Set(['super_admin', 'school_admin', 'head', 'head_teacher', 'deputy_head', 'hod', 'teacher', 'bursar', 'librarian', 'nurse', 'counsellor', 'guidance_counsellor', 'boarding_master', 'boarding_mistress']);
const PARENT_ROLES = new Set(['parent', 'guardian']);

function id(prefix) { return `${prefix}${crypto.randomBytes(8).toString('hex')}`; }
function schoolFor(req) {
  return req.user.role === 'super_admin' && req.headers['x-active-school-id']
    ? String(req.headers['x-active-school-id']) : req.user.school_id;
}
function canMessage(sender, recipient) {
  if (sender === 'super_admin' || ADMIN_ROLES.has(sender)) return true;
  if (PARENT_ROLES.has(sender)) return STAFF_ROLES.has(recipient);
  if (sender === 'teacher' || sender === 'hod') return STAFF_ROLES.has(recipient) || PARENT_ROLES.has(recipient);
  return STAFF_ROLES.has(recipient) || PARENT_ROLES.has(recipient);
}
async function validSchool(schoolId) { return schoolId && await queryOne('SELECT id FROM schools WHERE id = ?', [schoolId]); }
async function participant(conversationId, userId, schoolId) {
  return queryOne(`SELECT c.id, c.subject, c.school_id FROM conversations c
    INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE c.id = ? AND c.school_id = ? AND cp.user_id = ?`, [conversationId, schoolId, userId]);
}

router.use(authenticateToken);

router.get('/', (req, res) => res.redirect('/api/v1/messages/conversations'));

router.get('/conversations', async (req, res) => {
  try {
    const schoolId = schoolFor(req);
    if (!await validSchool(schoolId)) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context.' }, request_id: req.requestId });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const rows = await query(`SELECT c.id, c.subject, c.created_by, c.created_at, c.updated_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL) AS message_count,
      (SELECT m.body FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL ORDER BY m.sent_at DESC LIMIT 1) AS last_message
      FROM conversations c INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE cp.user_id = ? AND c.school_id = ? ORDER BY c.updated_at DESC LIMIT ${limit} OFFSET ${offset}`, [req.user.id, schoolId]);
    const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM conversations c INNER JOIN conversation_participants cp ON cp.conversation_id = c.id WHERE cp.user_id = ? AND c.school_id = ?`, [req.user.id, schoolId]);
    return res.json({ data: rows, meta: { page, limit, total: Number(totalRow?.total || 0), pages: Math.ceil(Number(totalRow?.total || 0) / limit) } });
  } catch (err) { console.error('List conversations error:', err); return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load conversations.' }, request_id: req.requestId }); }
});

router.post('/conversations', async (req, res) => {
  try {
    const schoolId = schoolFor(req);
    const { subject, participant_ids: requestedParticipants, initial_message } = req.body || {};
    const participantIds = [...new Set([req.user.id, ...(Array.isArray(requestedParticipants) ? requestedParticipants : [])].map(String))];
    if (!await validSchool(schoolId)) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context.' } });
    if (!subject?.trim() || !initial_message?.trim() || participantIds.length < 2) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Subject, message, and at least one recipient are required.' } });
    const placeholders = participantIds.map(() => '?').join(',');
    const recipients = await query(`SELECT id, role FROM users WHERE id IN (${placeholders}) AND school_id = ? AND status = 'active'`, [...participantIds, schoolId]);
    if (recipients.length !== participantIds.length) return res.status(404).json({ error: { code: 'RECIPIENT_NOT_FOUND', message: 'Every recipient must be an active user in this school.' } });
    if (recipients.some(user => user.id !== req.user.id && !canMessage(req.user.role, user.role))) return res.status(403).json({ error: { code: 'COMMUNICATION_SCOPE_DENIED', message: 'Your role cannot message one or more recipients.' } });
    const conversationId = id('CON');
    const messageId = id('MSG');
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO conversations (id, school_id, subject, created_by) VALUES (?, ?, ?, ?)', [conversationId, schoolId, subject.trim(), req.user.id]);
      await tx.query(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${participantIds.map(() => '(?, ?)').join(',')}`, participantIds.flatMap(userId => [conversationId, userId]));
      await tx.query('INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)', [messageId, conversationId, req.user.id, initial_message.trim()]);
    });
    await enqueueMessageDeliveries({ schoolId, conversationId, messageId, senderId: req.user.id, body: initial_message.trim() });
    broadcastToUsers(participantIds, { type: 'conversation.message.created', data: { conversation_id: conversationId, message_id: messageId, sender_id: req.user.id } });
    return res.status(201).json({ data: { id: conversationId, subject: subject.trim(), message_id: messageId }, meta: { participant_count: participantIds.length } });
  } catch (err) { console.error('Create conversation error:', err); return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create conversation.' } }); }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const schoolId = schoolFor(req);
    const conversation = await participant(req.params.id, req.user.id, schoolId);
    if (!conversation) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const messages = await query(`SELECT m.id, m.body, m.sent_at, m.edited_at, m.sender_id,
      m.attachment_url, m.attachment_type, m.audio_url, m.audio_duration,
      COALESCE(st.name, g.name, u.username) AS sender_name
      FROM messages m INNER JOIN users u ON u.id = m.sender_id
      LEFT JOIN staff st ON st.user_id = u.id LEFT JOIN guardians g ON g.user_id = u.id
      WHERE m.conversation_id = ? AND m.deleted_at IS NULL ORDER BY m.sent_at ASC LIMIT ${limit} OFFSET ${offset}`, [req.params.id]);
    const totalRow = await queryOne('SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ? AND deleted_at IS NULL', [req.params.id]);
    return res.json({ data: { ...conversation, messages }, meta: { page, limit, total: Number(totalRow?.total || 0) } });
  } catch (err) { console.error('Get conversation error:', err); return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load conversation.' } }); }
});

router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const schoolId = schoolFor(req);
    const conversation = await participant(req.params.id, req.user.id, schoolId);
    if (!conversation) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } });
    const { body, attachment_url, attachment_type, audio_url, audio_duration } = req.body || {};
    if (!body?.trim() && !attachment_url && !audio_url) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message content, audio, or attachment required.' } });
    const messageId = id('MSG');
    const msgText = body?.trim() || (audio_url ? 'Voice message' : 'File attachment');
    await withTransaction(async (tx) => {
      await tx.query(
        'INSERT INTO messages (id, conversation_id, sender_id, body, attachment_url, attachment_type, audio_url, audio_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [messageId, req.params.id, req.user.id, msgText, attachment_url || null, attachment_type || null, audio_url || null, audio_duration || null]
      );
      await tx.query('UPDATE conversations SET updated_at = NOW() WHERE id = ?', [req.params.id]);
    });
    await enqueueMessageDeliveries({ schoolId, conversationId: req.params.id, messageId, senderId: req.user.id, body: msgText });
    const participantRows = await query('SELECT user_id FROM conversation_participants WHERE conversation_id = ?', [req.params.id]);
    broadcastToUsers(participantRows.map(row => row.user_id), {
      type: 'conversation.message.created',
      data: {
        conversation_id: req.params.id,
        message_id: messageId,
        sender_id: req.user.id,
        body: msgText,
        attachment_url: attachment_url || null,
        audio_url: audio_url || null
      }
    });
    return res.status(201).json({
      data: {
        id: messageId,
        conversation_id: req.params.id,
        sender_id: req.user.id,
        body: msgText,
        attachment_url,
        audio_url
      }
    });
  } catch (err) { console.error('Send conversation message error:', err); return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to send message.' } }); }
});

router.post('/conversations/:id/read', async (req, res) => {
  try {
    const schoolId = schoolFor(req);
    if (!await participant(req.params.id, req.user.id, schoolId)) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } });
    await query('UPDATE conversation_participants SET last_read_at = NOW() WHERE conversation_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    return res.json({ data: { read: true } });
  } catch (err) { return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to mark conversation read.' } }); }
});

// GET /contacts - strictly permitted contacts for this user in this school
router.get('/contacts', async (req, res) => {
  try {
    const schoolId = schoolFor(req);
    if (!await validSchool(schoolId)) return res.status(400).json({ error: { code: 'SCHOOL_CONTEXT_REQUIRED', message: 'Select a valid school context.' } });

    const role = req.user.role;
    let contacts = [];

    if (role === 'parent') {
      // Parents see teachers of their children and school admins
      contacts = await query(
        `SELECT DISTINCT u.id, u.username, u.role, u.email,
                COALESCE(st.name, u.username) AS display_name,
                COALESCE(st.role_title, 'Teacher') AS role_title,
                c.name as context_info
         FROM users u
         JOIN staff st ON u.id = st.user_id
         LEFT JOIN classes c ON c.form_master_id = st.id
         WHERE u.school_id = ? AND u.status = 'active'
           AND (
             u.role IN ('school_admin', 'super_admin', 'head', 'head_teacher', 'deputy_head')
             OR c.id IN (
               SELECT st_inner.class_id FROM students st_inner
               JOIN student_guardians sg ON st_inner.id = sg.student_id
               JOIN guardians g ON sg.guardian_id = g.id
               WHERE g.user_id = ? OR g.email = ? OR g.phone = ?
             )
             OR st.id IN (
               SELECT cs.teacher_id FROM class_subjects cs
               JOIN students st_inner ON cs.class_id = st_inner.class_id
               JOIN student_guardians sg ON st_inner.id = sg.student_id
               JOIN guardians g ON sg.guardian_id = g.id
               WHERE g.user_id = ? OR g.email = ? OR g.phone = ?
             )
           )
         ORDER BY display_name ASC`,
        [schoolId, req.user.id, req.user.email || '', req.user.phone || '', req.user.id, req.user.email || '', req.user.phone || '']
      );
    } else if (role === 'teacher' || role === 'hod') {
      // Teachers see parents of students in their classes/subjects, plus staff
      const staffRows = await query('SELECT id FROM staff WHERE user_id = ?', [req.user.id]);
      const empRows = await query('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
      const teacherIds = [req.user.id, ...staffRows.map(s => s.id), ...empRows.map(e => e.id)];
      const teacherPlaceholders = teacherIds.map(() => '?').join(',');

      // 1. Staff and administration contacts
      const colleagueStaff = await query(
        `SELECT DISTINCT u.id, u.username, u.role, u.email,
                COALESCE(st.name, u.username) AS display_name,
                COALESCE(st.role_title, 'Staff') AS role_title,
                'School Staff' as context_info
         FROM users u
         JOIN staff st ON u.id = st.user_id
         WHERE u.school_id = ? AND u.id != ? AND u.status = 'active'
         ORDER BY display_name ASC`,
        [schoolId, req.user.id]
      );

      // 2. Parents of students in this teacher's cohort
      const parentContacts = await query(
        `SELECT DISTINCT u.id, u.username, u.role, u.email,
                COALESCE(g.name, u.username) AS display_name,
                'Parent / Guardian' AS role_title,
                CONCAT('Parent of ', s.first_name, ' ', s.last_name, ' (', COALESCE(c.name, 'Class'), ')') as context_info
         FROM users u
         JOIN guardians g ON u.id = g.user_id
         JOIN student_guardians sg ON g.id = sg.guardian_id
         JOIN students s ON sg.student_id = s.id
         LEFT JOIN classes c ON s.class_id = c.id
         WHERE u.school_id = ? AND u.status = 'active'
           AND (
             c.form_master_id IN (${teacherPlaceholders})
             OR s.class_id IN (SELECT class_id FROM class_subjects WHERE teacher_id IN (${teacherPlaceholders}))
             OR s.class_id IN (SELECT class_id FROM timetable WHERE teacher_id IN (${teacherPlaceholders}))
             OR s.id IN (SELECT student_id FROM student_subjects ss JOIN class_subjects cs ON ss.subject_id = cs.subject_id WHERE cs.teacher_id IN (${teacherPlaceholders}))
           )
         ORDER BY display_name ASC`,
        [schoolId, ...teacherIds, ...teacherIds, ...teacherIds, ...teacherIds]
      );

      contacts = [...colleagueStaff, ...parentContacts];
    } else {
      // Admins see all active staff and parents
      contacts = await query(
        `SELECT u.id, u.username, u.role, u.email,
                COALESCE(st.name, g.name, u.username) AS display_name,
                COALESCE(st.role_title, CASE WHEN u.role = 'parent' THEN 'Parent / Guardian' ELSE u.role END) AS role_title,
                CASE WHEN u.role = 'parent' THEN 'School Parent' ELSE 'School Staff' END as context_info
         FROM users u
         LEFT JOIN staff st ON u.id = st.user_id
         LEFT JOIN guardians g ON u.id = g.user_id
         WHERE u.school_id = ? AND u.id != ? AND u.status = 'active'
         ORDER BY display_name ASC`,
        [schoolId, req.user.id]
      );
    }

    return res.json({ data: contacts });
  } catch (err) {
    console.error('Get contacts error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch permitted contacts.' } });
  }
});

module.exports = router;
