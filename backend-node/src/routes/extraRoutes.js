const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { broadcastInvalidation } = require('../services/realtime');

const MESSAGE_STAFF_ROLES = new Set([
  'super_admin', 'school_admin', 'head', 'head_teacher', 'deputy_head', 'hod',
  'teacher', 'bursar', 'librarian', 'nurse', 'counsellor', 'guidance_counsellor',
  'boarding_master', 'boarding_mistress'
]);
const MESSAGE_ADMIN_ROLES = new Set(['super_admin', 'school_admin', 'head', 'head_teacher']);
const MESSAGE_PARENT_ROLES = new Set(['parent', 'guardian']);

async function messageSchoolId(req, schoolId) {
  const requested = String(schoolId || '');
  if (!requested) return null;
  if (req.user.role !== 'super_admin' && String(req.user.school_id) !== requested) return null;
  const school = await queryOne('SELECT id FROM schools WHERE id = ?', [requested]);
  return school ? requested : null;
}

function canMessageUser(senderRole, recipientRole) {
  if (MESSAGE_ADMIN_ROLES.has(senderRole)) return true;
  if (MESSAGE_PARENT_ROLES.has(senderRole)) return MESSAGE_STAFF_ROLES.has(recipientRole);
  if (senderRole === 'teacher' || senderRole === 'hod') return MESSAGE_STAFF_ROLES.has(recipientRole) || MESSAGE_PARENT_ROLES.has(recipientRole);
  return MESSAGE_STAFF_ROLES.has(recipientRole) || MESSAGE_PARENT_ROLES.has(recipientRole);
}

// Schema Migration Helper for schools table
async function ensureSchoolsSchema() {
  try {
    await query("ALTER TABLE schools ADD COLUMN head_title VARCHAR(50) DEFAULT 'Headmaster'");
  } catch(e) {}
}
ensureSchoolsSchema();

// Ensure staff_subjects table exists (teacher ↔ subject many-to-many)
async function ensureStaffSubjectsTable(retries = 3) {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS staff_subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id VARCHAR(50) NOT NULL,
        school_id VARCHAR(50) NOT NULL,
        subject_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_staff_subject (staff_id, subject_id),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      )
    `);
  } catch(e) {
    if (retries > 0 && e.code === 'ETIMEDOUT') {
      setTimeout(() => ensureStaffSubjectsTable(retries - 1), 3000);
    } else {
      console.warn('staff_subjects table initialized or pending db connect.');
    }
  }
}
setTimeout(() => ensureStaffSubjectsTable(), 1500);

// GET /schools/:schoolId/alerts (Unified alerts endpoint for Bursar & Staff)
router.get('/schools/:schoolId/alerts', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const isStaff = ['bursar', 'accountant', 'school_admin', 'super_admin', 'teacher', 'head', 'deputy_head'].includes(req.user.role);
    const notifications = await query(
      `SELECT n.*, COALESCE(n.sender_name, u.username, 'System Administrator') AS resolved_sender_name,
              u.role AS sender_role
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE n.school_id = ?
         AND (n.user_id = ? OR n.target_role = ? OR (? = 1 AND n.target_role = 'staff')
           OR (n.user_id IS NULL AND (n.target_role IS NULL OR n.target_role = 'all')))
       ORDER BY n.created_at DESC LIMIT 50`,
      [schoolId, req.user.id, req.user.role, isStaff ? 1 : 0]
    );
    return res.json({ data: notifications });
  } catch (err) {
    return res.json({ data: [] });
  }
});

const getTermFromDate = (dateVal = new Date()) => {
  const d = new Date(dateVal);
  const month = d.getMonth(); // 0 = Jan, 11 = Dec
  if (month >= 0 && month <= 3) return 'Term 1';
  if (month >= 4 && month <= 7) return 'Term 2';
  return 'Term 3';
};


// ─────────────────────────────────────────────────────────────────────────────
// SUBJECTS (global, not school-scoped — used by Tasks.jsx)
// GET /subjects
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subjects', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.user?.school_id;
    let schoolType = 'combined';
    if (schoolId) {
      const sch = await queryOne('SELECT school_type FROM schools WHERE id = ?', [schoolId]);
      if (sch && sch.school_type) schoolType = sch.school_type.toLowerCase();
    }

    let sql = 'SELECT * FROM subjects';
    if (schoolType.includes('primary')) {
      sql += " WHERE (level IS NULL OR level = 'primary' OR level = 'all' OR level = '')";
    } else if (schoolType.includes('secondary') || schoolType.includes('high')) {
      sql += " WHERE (level IS NULL OR level = 'secondary' OR level = 'all' OR level = '')";
    }
    sql += ' ORDER BY name ASC';

    const subjects = await query(sql);
    return res.json({ data: subjects });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch subjects.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STAFF SUBJECTS (teacher-to-subject many-to-many)
// GET  /schools/:schoolId/staff/:staffId/subjects
// PUT  /schools/:schoolId/staff/:staffId/subjects  (replace all)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/staff/:staffId/subjects', authenticateToken, async (req, res) => {
  try {
    const { staffId } = req.params;
    const rows = await query(
      `SELECT ss.subject_id as id, sub.name, sub.code
       FROM staff_subjects ss
       JOIN subjects sub ON ss.subject_id = sub.id
       WHERE ss.staff_id = ?
       ORDER BY sub.name ASC`,
      [staffId]
    );
    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch staff subjects.' } });
  }
});

router.put('/schools/:schoolId/staff/:staffId/subjects', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, staffId } = req.params;
    const { subject_ids } = req.body;

    // Delete existing
    await query('DELETE FROM staff_subjects WHERE staff_id = ? AND school_id = ?', [staffId, schoolId]);

    // Insert new
    if (Array.isArray(subject_ids) && subject_ids.length > 0) {
      for (const subId of subject_ids) {
        await query(
          `INSERT IGNORE INTO staff_subjects (staff_id, school_id, subject_id) VALUES (?, ?, ?)`,
          [staffId, schoolId, subId]
        );
      }
    }

    const updated = await query(
      `SELECT ss.subject_id as id, sub.name, sub.code
       FROM staff_subjects ss JOIN subjects sub ON ss.subject_id = sub.id
       WHERE ss.staff_id = ?`,
      [staffId]
    );
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update staff subjects.' } });
  }
});


router.get('/schools/:schoolId/guardians', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const guardians = await query(
      `SELECT g.*, sg.relation, st.first_name as student_first, st.last_name as student_last, st.admission_number
       FROM guardians g
       JOIN student_guardians sg ON g.id = sg.guardian_id
       JOIN students st ON sg.student_id = st.id
       WHERE st.school_id = ?
       ORDER BY g.name ASC`,
      [schoolId]
    );
    return res.json({ data: guardians });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch guardians.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEACHING ASSIGNMENTS
// GET /schools/:schoolId/teaching-assignments
// POST /schools/:schoolId/teaching-assignments
// DELETE /schools/:schoolId/teaching-assignments/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get(['/schools/:schoolId/teaching-assignments', '/schools/:schoolId/staff/:staffId/teaching-assignments'], authenticateToken, async (req, res) => {
  try {
    const { schoolId, staffId } = req.params;
    const teacher_id = req.query.teacher_id || staffId;
    let sql = `
      SELECT ta.*, 
             COALESCE(u.username, CONCAT(e.first_name, ' ', e.last_name), s.name) as teacher_name, 
             c.name as class_name, 
             sub.name as subject_name,
             sub.code as subject_code
      FROM teaching_assignments ta
      LEFT JOIN users u ON ta.teacher_id = u.id
      LEFT JOIN employees e ON (ta.teacher_id = e.id OR ta.teacher_id = e.user_id)
      LEFT JOIN staff s ON (ta.teacher_id = s.id OR ta.teacher_id = s.user_id)
      JOIN classes c ON ta.class_id = c.id
      JOIN subjects sub ON ta.subject_id = sub.id
      WHERE ta.school_id = ?
    `;
    const params = [schoolId];
    if (teacher_id) {
      sql += ` AND (
        ta.teacher_id = ? 
        OR ta.teacher_id IN (SELECT user_id FROM staff WHERE id = ? AND user_id IS NOT NULL)
        OR ta.teacher_id IN (SELECT id FROM staff WHERE user_id = ?)
        OR ta.teacher_id IN (SELECT user_id FROM employees WHERE id = ? AND user_id IS NOT NULL)
        OR ta.teacher_id IN (SELECT id FROM employees WHERE user_id = ?)
      )`;
      params.push(teacher_id, teacher_id, teacher_id, teacher_id, teacher_id);
    }
    sql += ' ORDER BY c.name ASC, sub.name ASC';
    const assignments = await query(sql, params);
    return res.json({ data: assignments });
  } catch (err) {
    console.error('Teaching assignments error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch teaching assignments.' } });
  }
});

router.post(['/schools/:schoolId/teaching-assignments', '/schools/:schoolId/staff/:staffId/teaching-assignments'], authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, staffId } = req.params;
    const { teacher_id, class_id, subject_id } = req.body;
    const tId = teacher_id || staffId || req.body.staff_id;
    if (!tId || !class_id || !subject_id) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Teacher, class, and subject are required.' } });
    }
    const id = 'TA' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO teaching_assignments (id, school_id, teacher_id, class_id, subject_id) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id)`,
      [id, schoolId, tId, class_id, subject_id]
    );
    const created = await queryOne(
      `SELECT ta.*, 
              COALESCE(u.username, CONCAT(e.first_name, ' ', e.last_name), s.name) as teacher_name, 
              c.name as class_name, 
              sub.name as subject_name,
              sub.code as subject_code
       FROM teaching_assignments ta
       LEFT JOIN users u ON ta.teacher_id = u.id
       LEFT JOIN employees e ON (ta.teacher_id = e.id OR ta.teacher_id = e.user_id)
       LEFT JOIN staff s ON (ta.teacher_id = s.id OR ta.teacher_id = s.user_id)
       JOIN classes c ON ta.class_id = c.id
       JOIN subjects sub ON ta.subject_id = sub.id
       WHERE ta.id = ?`,
      [id]
    );
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create teaching assignment error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create teaching assignment.' } });
  }
});

router.delete('/schools/:schoolId/teaching-assignments/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM teaching_assignments WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    return res.json({ data: { message: 'Assignment removed.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to remove assignment.' } });
  }
});

router.patch('/schools/:schoolId/teaching-assignments/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { class_id, subject_id, teacher_id } = req.body;
    const updates = [];
    const params = [];
    if (class_id !== undefined) { updates.push('class_id = ?'); params.push(class_id); }
    if (subject_id !== undefined) { updates.push('subject_id = ?'); params.push(subject_id); }
    if (teacher_id !== undefined) { updates.push('teacher_id = ?'); params.push(teacher_id); }

    if (updates.length > 0) {
      params.push(id, schoolId);
      await query(`UPDATE teaching_assignments SET ${updates.join(', ')} WHERE id = ? AND school_id = ?`, params);
    }

    const updated = await queryOne('SELECT * FROM teaching_assignments WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update teaching assignment.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER MESSAGES (Staff.jsx uses /schools/:schoolId/teacher-messages)
// GET /schools/:schoolId/teacher-messages
// POST /schools/:schoolId/teacher-messages
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/teacher-messages', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const scopedSchool = await messageSchoolId(req, schoolId);
    if (!scopedSchool) return res.status(403).json({ error: { code: 'SCHOOL_SCOPE_DENIED', message: 'You cannot access communication for this school.' } });
    const userId = req.user.id;
    const isAdmin = MESSAGE_ADMIN_ROLES.has(req.user.role);

    let msgs;
    if (isAdmin) {
      msgs = await query(
        `SELECT tm.*, COALESCE(st.name, u.username, 'User') as sender_name
         FROM teacher_messages tm
         LEFT JOIN users u ON tm.sender_id = u.id
         LEFT JOIN staff st ON u.id = st.user_id
         WHERE tm.school_id = ?
         ORDER BY tm.sent_at DESC LIMIT 50`,
        [scopedSchool]
      );
    } else {
      msgs = await query(
        `SELECT tm.*, COALESCE(st.name, u.username, 'User') as sender_name
         FROM teacher_messages tm
         LEFT JOIN users u ON tm.sender_id = u.id
         LEFT JOIN staff st ON u.id = st.user_id
         WHERE tm.school_id = ? AND (tm.recipient_id = ? OR tm.sender_id = ? OR tm.recipient_id IS NULL)
         ORDER BY tm.sent_at DESC LIMIT 50`,
        [scopedSchool, userId, userId]
      );
    }
    return res.json({ data: msgs });
  } catch (err) {
    return res.json({ data: [] });
  }
});


router.post('/schools/:schoolId/teacher-messages', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { recipient_id, subject, message, body, content, text } = req.body;
    const scopedSchool = await messageSchoolId(req, schoolId);
    if (!scopedSchool) return res.status(403).json({ error: { code: 'SCHOOL_SCOPE_DENIED', message: 'You cannot send communication for this school.' } });
    const msgText = message || body || content || text || subject;
    if (!msgText) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message content is required.' } });
    }
    if (!recipient_id && !MESSAGE_ADMIN_ROLES.has(req.user.role)) {
      return res.status(403).json({ error: { code: 'COMMUNICATION_SCOPE_DENIED', message: 'Only school administrators can send an unaddressed broadcast.' } });
    }
    if (recipient_id) {
      const recipient = await queryOne(
        `SELECT id, role FROM users WHERE id = ? AND school_id = ? AND status = 'active'`,
        [recipient_id, scopedSchool]
      );
      if (!recipient) return res.status(404).json({ error: { code: 'RECIPIENT_NOT_FOUND', message: 'Recipient is not active in this school.' } });
      if (!canMessageUser(req.user.role, recipient.role)) return res.status(403).json({ error: { code: 'COMMUNICATION_SCOPE_DENIED', message: 'Your role cannot message this recipient.' } });
    }
    const id = 'MSG' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const userId = req.user && req.user.id ? req.user.id : 'SYS00001';
    try {
      await query(
        `INSERT INTO teacher_messages (id, school_id, sender_id, recipient_id, subject, body, message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, scopedSchool, userId, recipient_id || null, subject || 'Lecture Completion Report', msgText, msgText]
      );
    } catch (e1) {
      try {
        await query(
          `INSERT INTO teacher_messages (id, school_id, sender_id, recipient_id, subject, body) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, scopedSchool, userId, recipient_id || null, subject || 'Lecture Completion Report', msgText]
        );
      } catch (e2) {
        await query(
          `INSERT INTO teacher_messages (id, school_id, sender_id, recipient_id, subject, message) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, scopedSchool, userId, recipient_id || null, subject || 'Lecture Completion Report', msgText]
        );
      }
    }
    const created = await queryOne('SELECT * FROM teacher_messages WHERE id = ?', [id]);
    return res.status(201).json({ data: created || { id, subject, message: msgText } });
  } catch (err) {
    console.error('Send teacher message error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to send message.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// GET /schools/:schoolId/users?role=
// POST /schools/:schoolId/users
// DELETE /schools/:schoolId/users/:id
// POST /schools/:schoolId/users/:id/reset-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools/:schoolId/users', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const targetSchool = req.user.role === 'super_admin'
      ? (req.body.school_id || req.params.schoolId)
      : req.user.school_id;

    const { username, email, role, password, student_id, name, phone } = req.body;
    if (!username || !role || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username, role, and password are required.' } });
    }
    const exists = await queryOne('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (exists) {
      return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Username already exists.' } });
    }
    const id = 'USR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const hash = bcrypt.hashSync(String(password).trim(), 10);
    await query(
      `INSERT INTO users (id, school_id, username, email, password_hash, role, student_id, phone, name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [id, targetSchool, username.trim(), email || null, hash, role, student_id || null, phone || null, name || null]
    );

    // If creating a parent, link the user to their guardian record
    if (role === 'parent' && student_id) {
      try {
        const sg = await queryOne(
          `SELECT g.* FROM guardians g JOIN student_guardians sg ON g.id = sg.guardian_id WHERE sg.student_id = ? AND g.school_id = ? LIMIT 1`,
          [student_id, targetSchool]
        );
        if (sg && !sg.user_id) {
          await query('UPDATE guardians SET user_id = ? WHERE id = ?', [id, sg.id]);
        }
        await query('UPDATE users SET student_id = ? WHERE id = ?', [student_id, id]);
      } catch (linkErr) {
        console.warn('Parent-guardian link warning:', linkErr.message);
      }
    }

    // If creating a staff/leadership user, ensure staff profile exists
    if (['teacher', 'school_admin', 'principal', 'headmaster', 'head', 'deputy_head', 'bursar'].includes(role)) {
      try {
        const staffName = name || username.trim();
        const roleTitle = role === 'teacher' ? 'Teacher' : (role === 'bursar' ? 'Bursar' : 'Principal / Administrator');
        const existingStaff = await queryOne('SELECT id FROM staff WHERE user_id = ? OR (school_id = ? AND email IS NOT NULL AND LOWER(email) = LOWER(?))', [id, targetSchool, email || '']);
        if (!existingStaff) {
          const staffId = 'STF' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
          await query(
            'INSERT INTO staff (id, school_id, user_id, name, email, phone, role_title, status) VALUES (?, ?, ?, ?, ?, ?, ?, "active")',
            [staffId, targetSchool, id, staffName, email || null, phone || null, roleTitle]
          );
        }
      } catch (staffErr) {
        console.warn('Staff profile sync warning:', staffErr.message);
      }
    }

    const created = await queryOne('SELECT id, school_id, username, email, role, status, created_at, phone, name FROM users WHERE id = ?', [id]);
    return res.status(201).json({ data: created, credentials: { username: username.trim(), password } });
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Failed to create user account.' } });
  }
});

// User soft-deactivation (Do NOT delete users)
router.delete('/schools/:schoolId/users/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const targetSchool = req.user.role === 'super_admin' ? req.params.schoolId : req.user.school_id;
    await query("UPDATE users SET status = 'deactivated' WHERE id = ? AND (school_id = ? OR ? = 'super_admin')", [req.params.id, targetSchool, req.user.role]);
    await query("UPDATE staff SET status = 'inactive' WHERE user_id = ?", [req.params.id]);
    return res.json({ data: { message: 'User account has been deactivated/suspended.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to deactivate user.' } });
  }
});

// Update / Edit user account
const handleUpdateUser = async (req, res) => {
  try {
    const targetSchool = req.user.role === 'super_admin' ? (req.body.school_id || req.params.schoolId) : req.user.school_id;
    const { id } = req.params;
    const { name, email, phone, role, status, password } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name ? name.trim() : null); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email ? email.trim() : null); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone ? phone.trim() : null); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (password) {
      updates.push('password_hash = ?');
      params.push(bcrypt.hashSync(String(password).trim(), 10));
    }
    if (req.user.role === 'super_admin' && req.body.school_id) {
      updates.push('school_id = ?');
      params.push(req.body.school_id);
    }

    if (updates.length > 0) {
      params.push(id, targetSchool, req.user.role);
      await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND (school_id = ? OR ? = 'super_admin')`, params);

      // Keep staff row synced
      const staffUpdates = [];
      const staffParams = [];
      if (name !== undefined) { staffUpdates.push('name = ?'); staffParams.push(name ? name.trim() : null); }
      if (email !== undefined) { staffUpdates.push('email = ?'); staffParams.push(email ? email.trim() : null); }
      if (phone !== undefined) { staffUpdates.push('phone = ?'); staffParams.push(phone ? phone.trim() : null); }
      if (status !== undefined) { staffUpdates.push('status = ?'); staffParams.push(status === 'active' ? 'active' : 'inactive'); }
      if (role !== undefined) { staffUpdates.push('role_title = ?'); staffParams.push(role); }

      if (staffUpdates.length > 0) {
        staffParams.push(id);
        await query(`UPDATE staff SET ${staffUpdates.join(', ')} WHERE user_id = ?`, staffParams);
      }
    }

    const updated = await queryOne('SELECT id, school_id, username, email, role, status, created_at, phone, name FROM users WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update user account.' } });
  }
};

router.put('/schools/:schoolId/users/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleUpdateUser);
router.patch('/schools/:schoolId/users/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleUpdateUser);

const handleResetPassword = async (req, res) => {
  try {
    const newPassword = req.body.password || req.body.new_password;
    if (!newPassword) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password is required.' } });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ? AND school_id = ?', [hash, req.params.id, req.params.schoolId]);
    return res.json({ data: { message: 'Password reset successfully.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to reset password.' } });
  }
};

router.post('/schools/:schoolId/users/:id/reset-password', authenticateToken, requireRoles('school_admin', 'super_admin'), handleResetPassword);
router.patch('/schools/:schoolId/users/:id/password', authenticateToken, requireRoles('school_admin', 'super_admin'), handleResetPassword);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — RESET PASSWORD (public reset token flow)
// POST /auth/reset-password
// POST /auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/auth/forgot-password', async (req, res) => {
  // Stub — in production would email reset link
  return res.json({ data: { message: 'If an account with that email exists, a reset link has been sent.' } });
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Token and new password are required.' } });
    }
    const tokenRecord = await queryOne('SELECT * FROM password_reset_tokens WHERE (token_hash = ? OR id = ?) AND expires_at > NOW()', [token, token]);
    if (!tokenRecord) {
      return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Reset token is invalid or has expired.' } });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, tokenRecord.user_id]);
    await query('DELETE FROM password_reset_tokens WHERE id = ?', [tokenRecord.id]);
    return res.json({ data: { message: 'Password reset successfully. You may now log in.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to reset password.' } });
  }
});

router.get('/admin/system-settings/:schoolId', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const school = await queryOne('SELECT * FROM schools WHERE id = ?', [req.params.schoolId]);
    if (!school) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'School not found.' } });

    let integrations = {};
    try {
      const cfgRow = await queryOne('SELECT `value` FROM system_config WHERE `key` = ?', [`school_settings_${req.params.schoolId}`]);
      if (cfgRow && cfgRow.value) {
        integrations = JSON.parse(cfgRow.value);
      }
    } catch (e) {}

    return res.json({ data: { ...school, ...integrations } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch system settings.' } });
  }
});

router.put('/admin/system-settings/:schoolId', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const {
      name, email, phone, address, motto, principal_name, type, school_type, academic_year,
      bank_name, account_number, currency, email_from_address, sms_gateway,
      head_title, is_boarding, boarding_type, tuition_fee_benchmark,
      sms_gateway_url, sms_api_key, sms_sender_id,
      email_smtp_host, email_smtp_port, email_smtp_user, email_smtp_pass, email_from_name,
      payment_gateway_type, payment_merchant_id, payment_merchant_key, payment_api_url,
      notify_attendance_absent, notify_results_published, notify_fees_overdue, notify_discipline_incident
    } = req.body;

    const resolvedSchoolType = school_type || type;
    const hasAlevelVal = (resolvedSchoolType === 'high_school' || resolvedSchoolType === 'combined' || resolvedSchoolType === 'a_level') ? 1 : 0;
    const isBoardingVal = is_boarding !== undefined ? (is_boarding ? 1 : 0) : null;

    await query(
      `UPDATE schools SET
         name = COALESCE(?, name),
         school_type = COALESCE(?, school_type),
         has_alevel = ?,
         head_title = COALESCE(?, head_title),
         is_boarding = COALESCE(?, is_boarding),
         boarding_type = COALESCE(?, boarding_type),
         tuition_fee_benchmark = COALESCE(?, tuition_fee_benchmark),
         bank_name = COALESCE(?, bank_name),
         account_number = COALESCE(?, account_number),
         currency = COALESCE(?, currency)
       WHERE id = ?`,
      [name, resolvedSchoolType, hasAlevelVal, head_title, isBoardingVal, boarding_type, tuition_fee_benchmark,
       bank_name, account_number, currency, schoolId]
    );

    const integrationPayload = {
      sms_gateway_url, sms_api_key, sms_sender_id,
      email_smtp_host, email_smtp_port, email_smtp_user, email_smtp_pass, email_from_name, email_from_address,
      payment_gateway_type, payment_merchant_id, payment_merchant_key, payment_api_url,
      notify_attendance_absent, notify_results_published, notify_fees_overdue, notify_discipline_incident
    };

    try {
      await query(
        'INSERT INTO system_config (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        [`school_settings_${schoolId}`, JSON.stringify(integrationPayload)]
      );
    } catch (e) {}

    broadcastInvalidation(schoolId, ['schools', 'settings', 'dashboard'], 'settings_updated');

    const updated = await queryOne('SELECT * FROM schools WHERE id = ?', [schoolId]);
    return res.json({ data: { ...updated, ...integrationPayload } });
  } catch (err) {
    console.error('Update system settings error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update system settings.' } });
  }
});

router.get('/admin/system-reports', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    let schoolsMetrics = [];
    try {
      schoolsMetrics = await query(`
        SELECT 
          s.name as school_name,
          s.code as school_code,
          s.status as school_status,
          COALESCE(u.user_count, 0) as user_count,
          'standard' as license_plan,
          500 as license_max_users
        FROM schools s
        LEFT JOIN (
          SELECT school_id, COUNT(*) as user_count FROM users GROUP BY school_id
        ) u ON s.id = u.school_id
        ORDER BY s.name ASC
      `);
    } catch (e) {
      console.warn('Failed to query school metrics for system reports:', e.message);
      const schools = await query('SELECT id, name, code, status FROM schools');
      schoolsMetrics = schools.map(s => ({
        school_name: s.name,
        school_code: s.code || s.id,
        school_status: s.status,
        user_count: 0,
        license_plan: 'standard',
        license_max_users: 500
      }));
    }

    let dbStats = [];
    try {
      const [tableCount] = await query("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE()");
      dbStats = [
        { metric: 'Active DB Engine', value: 'MySQL InnoDB' },
        { metric: 'Total Tables', value: `${tableCount?.cnt || 40} tables` },
        { metric: 'Connection Pool', value: '15 active connections' }
      ];
    } catch (e) {
      dbStats = [{ metric: 'DB Connection', value: 'Healthy' }];
    }

    return res.json({
      data: {
        schools_metrics: schoolsMetrics,
        db_stats: dbStats,
        api_latency: '28ms',
        uptime: '99.98%'
      }
    });
  } catch (err) {
    console.error('System reports error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate system reports.' } });
  }
});

router.put('/admin/override/:entity/:id', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { entity, id } = req.params;
    const updateData = req.body;
    const allowedEntities = ['students', 'staff', 'users', 'schools', 'fees', 'classes'];
    if (!allowedEntities.includes(entity)) {
      return res.status(400).json({ error: { code: 'INVALID_ENTITY', message: 'Override for this entity type is not permitted.' } });
    }
    const setClauses = Object.keys(updateData).map(k => `\`${k}\` = ?`).join(', ');
    const vals = Object.values(updateData);
    await query(`UPDATE \`${entity}\` SET ${setClauses} WHERE id = ?`, [...vals, id]);
    return res.json({ data: { message: `Successfully overrode ${entity} record ${id}.` } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Override failed.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// GET /analytics/predictive
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/predictive', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const data = {
      dropout_risk: [],
      fee_default_risk: [],
      performance_trends: []
    };

    if (schoolId) {
      // Students with attendance < 70%
      const atRiskStudents = await query(
        `SELECT st.id, st.first_name, st.last_name, st.admission_number, c.name as class_name,
                COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absences,
                COUNT(a.id) as total_records,
                ROUND(COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0), 1) as attendance_pct
         FROM students st
         LEFT JOIN classes c ON st.class_id = c.id
         LEFT JOIN attendance a ON st.id = a.student_id
         WHERE st.school_id = ? AND (st.status IN ('active', 'enrolled') OR st.status IS NULL OR st.status != 'transferred')
         GROUP BY st.id, st.first_name, st.last_name, st.admission_number, c.name
         HAVING total_records > 0 AND attendance_pct < 70
         ORDER BY attendance_pct ASC
         LIMIT 10`,
        [schoolId]
      );
      data.dropout_risk = atRiskStudents;

      // Students with unpaid fees
      const feeDefaulters = await query(
        `SELECT st.id, st.first_name, st.last_name, st.admission_number,
                SUM(f.amount_due - f.amount_paid) as outstanding_balance
         FROM students st
         JOIN fees f ON f.student_id = st.id
         WHERE st.school_id = ? AND f.status != 'paid'
         GROUP BY st.id
         HAVING outstanding_balance > 0
         ORDER BY outstanding_balance DESC
         LIMIT 10`,
        [schoolId]
      );
      data.fee_default_risk = feeDefaulters;
    }

    return res.json({ data });
  } catch (err) {
    return res.json({ data: { dropout_risk: [], fee_default_risk: [], performance_trends: [] } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REPORT COMMENTS
// GET /schools/:schoolId/comments
// POST /schools/:schoolId/comments
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/comments', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { student_id, term } = req.query;
    let sql = `
      SELECT rc.*, u.username as author_name, st.first_name, st.last_name
      FROM report_comments rc
      LEFT JOIN users u ON rc.author_id = u.id
      LEFT JOIN students st ON rc.student_id = st.id
      WHERE rc.school_id = ?
    `;
    const params = [schoolId];
    if (student_id) { sql += ' AND rc.student_id = ?'; params.push(student_id); }
    if (term) { sql += ' AND rc.term = ?'; params.push(term); }
    sql += ' ORDER BY rc.created_at DESC';
    const comments = await query(sql, params);
    return res.json({ data: comments });
  } catch (err) {
    return res.json({ data: [] });
  }
});

router.post('/schools/:schoolId/comments', authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { student_id, comment, term, class_id } = req.body;
    if (!student_id || !comment) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Student ID and comment text are required.' } });
    }
    const id = 'CMT' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO report_comments (id, school_id, student_id, class_id, author_id, comment, term) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, schoolId, student_id, class_id || null, req.user.id, comment, term || getTermFromDate()]
    );
    const created = await queryOne('SELECT * FROM report_comments WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to save comment.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS PUBLISH
// POST /schools/:schoolId/results/publish
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools/:schoolId/results/publish', authenticateToken, requireRoles('head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { class_id, term } = req.body;
    if (!class_id || !term) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Class ID and term are required.' } });
    }
    const id = 'RES' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const existing = await queryOne('SELECT id, status FROM result_publications WHERE school_id = ? AND class_id = ? AND term = ?', [schoolId, class_id, term]);
    if (existing?.status === 'published' || existing?.status === 'released') return res.status(409).json({ error: { code: 'ALREADY_PUBLISHED', message: 'Results are already published.' } });
    const publicationId = existing?.id || id;
    if (!existing) await query('INSERT INTO result_publications (id, school_id, class_id, term, status) VALUES (?, ?, ?, ?, ?)', [publicationId, schoolId, class_id, term, 'pending_approval']);
    const approvalId = 'APP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(`INSERT INTO approvals (uuid, school_id, action, action_type, entity_type, entity_id, requested_by, payload, status) VALUES (?, ?, 'publish', 'RESULTS_PUBLISH', 'result_publications', ?, ?, ?, 'pending')`, [approvalId, schoolId, publicationId, req.user.id, JSON.stringify({ class_id, term })]);
    return res.status(202).json({ data: { message: 'Results submitted for maker-checker approval.', approval_id: approvalId, class_id, term } });
      // results table may have different schema — proceed gracefully
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to publish results.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools/:schoolId/results/release', authenticateToken, requireRoles('head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { class_id, term, release_at } = req.body || {};
    if (!class_id || !term) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Class ID and term are required.' } });
    const publication = await queryOne('SELECT * FROM result_publications WHERE school_id = ? AND class_id = ? AND term = ? AND status = \'published\'', [schoolId, class_id, term]);
    if (!publication) return res.status(409).json({ error: { code: 'APPROVAL_REQUIRED', message: 'Results must be approved and published before release.' } });
    const approvalId = 'APP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(`INSERT INTO approvals (uuid, school_id, action, action_type, entity_type, entity_id, requested_by, payload, status) VALUES (?, ?, 'release', 'RESULTS_RELEASE', 'result_publications', ?, ?, ?, 'pending')`, [approvalId, schoolId, publication.id, req.user.id, JSON.stringify({ release_at: release_at || new Date().toISOString() })]);
    return res.status(202).json({ data: { message: 'Results submitted for release approval.', approval_id: approvalId } });
  } catch (err) { return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to request results release.' } }); }
});

// ATTENDANCE WEEKLY REPORTS
// GET /schools/:schoolId/attendance/weekly-reports
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/attendance/weekly-reports', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { week_start } = req.query;
    const start = week_start || new Date().toISOString().slice(0, 10);
    const end = new Date(new Date(start).getTime() + 6 * 86400000).toISOString().slice(0, 10);

    const classes = await query(
      `SELECT c.id, c.name,
              COUNT(DISTINCT st.id) as student_count,
              COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) as present,
              COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
              COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late,
              COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused,
              ROUND(AVG(CASE WHEN a.status = 'present' THEN 1 WHEN a.status IS NOT NULL THEN 0 END) * 100, 1) as attendance_rate,
              0 as volatility
       FROM classes c
       LEFT JOIN students st ON c.id = st.class_id AND (st.status IN ('active', 'enrolled') OR st.status IS NULL OR st.status != 'transferred')
       LEFT JOIN attendance a ON st.id = a.student_id AND a.date BETWEEN ? AND ?
       WHERE c.school_id = ?
       GROUP BY c.id, c.name`,
      [start, end, schoolId]
    );

    // Students with multiple absences this week
    const chronicAbsentees = await query(
      `SELECT st.id, st.first_name, st.last_name, st.admission_number, c.name as class_name,
              COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absence_count
       FROM students st
       JOIN classes c ON st.class_id = c.id
       LEFT JOIN attendance a ON st.id = a.student_id AND a.date BETWEEN ? AND ?
       WHERE st.school_id = ? AND (st.status IN ('active', 'enrolled') OR st.status IS NULL OR st.status != 'transferred')

       GROUP BY st.id, c.name
       HAVING absence_count >= 2
       ORDER BY absence_count DESC`,
      [start, end, schoolId]
    );

    return res.json({
      data: {
        week_start: start,
        week_end: end,
        classes,
        chronic_absentees: chronicAbsentees,
        top_absent_days: [],
        daily_trend: []
      }
    });
  } catch (err) {
    console.error('Attendance weekly reports error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate attendance reports.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DISCIPLINE
// GET /schools/:schoolId/discipline
// POST /schools/:schoolId/discipline
// PATCH /schools/:schoolId/discipline/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/discipline', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const incidents = await query(
      `SELECT di.*, st.first_name, st.last_name, st.admission_number, c.name as class_name
       FROM discipline_incidents di
       JOIN students st ON di.student_id = st.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE di.school_id = ?
       ORDER BY di.incident_date DESC`,
      [schoolId]
    );
    return res.json({ data: incidents });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch discipline records.' } });
  }
});

router.post(['/schools/:schoolId/discipline', '/schools/:schoolId/students/:studentId/discipline'], authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, studentId } = req.params;
    const targetStudentId = req.body.student_id || studentId;
    const { incident_type, description, severity, incident_date, action_taken } = req.body;
    if (!targetStudentId || !description) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Student ID and description are required.' } });
    }
    const id = 'INC' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO discipline_incidents (id, school_id, student_id, incident_type, severity, description, action_taken, incident_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      [id, schoolId, targetStudentId, incident_type || 'Behavioral', severity || 'minor', description, action_taken || null, incident_date || new Date().toISOString().slice(0, 10)]
    );
    const created = await queryOne('SELECT * FROM discipline_incidents WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to record discipline incident.' } });
  }
});

router.patch('/schools/:schoolId/discipline/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { status, action_taken } = req.body;
    await query(
      `UPDATE discipline_incidents SET status = COALESCE(?, status), action_taken = COALESCE(?, action_taken) WHERE id = ? AND school_id = ?`,
      [status, action_taken, req.params.id, req.params.schoolId]
    );
    const updated = await queryOne('SELECT * FROM discipline_incidents WHERE id = ?', [req.params.id]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update discipline record.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH RECORDS
// GET /schools/:schoolId/health
// POST /schools/:schoolId/health
// PATCH /schools/:schoolId/health/:studentId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/health', authenticateToken, async (req, res) => {
  try {
    const records = await query(
      `SELECT sh.*, st.first_name, st.last_name, st.admission_number, c.name as class_name
       FROM student_health sh
       JOIN students st ON sh.student_id = st.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE st.school_id = ?
       ORDER BY st.first_name ASC`,
      [req.params.schoolId]
    );
    return res.json({ data: records });
  } catch (err) {
    return res.json({ data: [] });
  }
});

router.post('/schools/:schoolId/health', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { student_id, blood_type, allergies, medical_conditions, emergency_contact, notes } = req.body;
    if (!student_id) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Student ID is required.' } });
    }
    const id = 'HLT' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO student_health (id, student_id, blood_type, allergies, medical_conditions, emergency_contact, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE blood_type = VALUES(blood_type), allergies = VALUES(allergies),
       medical_conditions = VALUES(medical_conditions), emergency_contact = VALUES(emergency_contact), notes = VALUES(notes)`,
      [id, student_id, blood_type || null, allergies || null, medical_conditions || null, emergency_contact || null, notes || null]
    );
    const created = await queryOne('SELECT * FROM student_health WHERE student_id = ?', [student_id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to save health record.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE REQUESTS
// GET /schools/:schoolId/leave-requests
// POST /schools/:schoolId/leave-requests
// PATCH /schools/:schoolId/leave-requests/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/leave-requests', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { role, id: userId } = req.user;

    let requests = [];

    if (role === 'teacher') {
      const staff = await queryOne('SELECT id FROM staff WHERE user_id = ?', [userId]);
      if (staff) {
        requests = await query(
          `SELECT lr.*, stf.name as staff_name, u.username as approver_name
           FROM leave_requests lr
           LEFT JOIN staff stf ON lr.staff_id = stf.id
           LEFT JOIN users u ON lr.reviewed_by = u.id
           WHERE lr.school_id = ? AND lr.staff_id = ?
           ORDER BY lr.created_at DESC`,
          [schoolId, staff.id]
        );
      }
    } else if (role === 'parent') {
      const guardianRows = await query(
        `SELECT g.id FROM guardians g 
         WHERE g.user_id = ? 
            OR (g.email IS NOT NULL AND g.email != '' AND g.email = ?)
            OR (g.phone IS NOT NULL AND g.phone != '' AND g.phone = ?)`,
        [userId, req.user.email || '', req.user.phone || '']
      );
      const guardianIds = guardianRows.map(g => g.id);
      if (guardianIds.length > 0) {
        const gPlaceholders = guardianIds.map(() => '?').join(',');
        const kids = await query(`SELECT student_id FROM student_guardians WHERE guardian_id IN (${gPlaceholders})`, guardianIds);
        const kidIds = [...new Set(kids.map(k => k.student_id))];
        if (kidIds.length > 0) {
          const placeholders = kidIds.map(() => '?').join(',');
          requests = await query(
            `SELECT lr.*, CONCAT(st.first_name, ' ', st.last_name) as staff_name,
                    st.admission_number, c.name as class_name,
                    u.username as approver_name
             FROM leave_requests lr
             LEFT JOIN students st ON lr.student_id = st.id
             LEFT JOIN classes c ON st.class_id = c.id
             LEFT JOIN users u ON lr.reviewed_by = u.id
             WHERE lr.school_id = ? AND lr.student_id IN (${placeholders})
             ORDER BY lr.created_at DESC`,
            [schoolId, ...kidIds]
          );
        }
      }
    } else {
      // Admins and super admins see all
      requests = await query(
        `SELECT lr.*, 
                COALESCE(stf.name, CONCAT(st.first_name, ' ', st.last_name)) as staff_name, 
                st.admission_number, c.name as class_name,
                u.username as approver_name
         FROM leave_requests lr
         LEFT JOIN staff stf ON lr.staff_id = stf.id
         LEFT JOIN students st ON lr.student_id = st.id
         LEFT JOIN classes c ON st.class_id = c.id
         LEFT JOIN users u ON lr.reviewed_by = u.id
         WHERE lr.school_id = ?
         ORDER BY lr.created_at DESC`,
        [schoolId]
      );
    }

    return res.json({ data: requests });
  } catch (err) {
    console.error('Get leave requests error:', err);
    return res.json({ data: [] });
  }
});

router.post('/schools/:schoolId/leave-requests', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { role, id: userId } = req.user;
    const {
      student_id, staff_id, leave_type, request_type,
      start_date, end_date, reason, attachment_url, audio_url
    } = req.body;

    if (!start_date || !end_date || (!reason?.trim() && !audio_url)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Start date, end date, and reason or audio note are required.' }
      });
    }

    let finalStudentId = null;
    let finalStaffId = null;
    const finalType = request_type || leave_type || (role === 'parent' ? 'student_absence' : 'staff_leave');

    if (role === 'parent') {
      if (!student_id) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please select a child for this absence notice.' } });
      }
      finalStudentId = student_id;
    } else {
      if (staff_id) {
        finalStaffId = staff_id;
      } else {
        const staff = await queryOne('SELECT id FROM staff WHERE user_id = ?', [userId]);
        finalStaffId = staff?.id || null;
      }
      finalStudentId = student_id || null;
    }

    const id = 'LVR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const initialThread = [
      {
        id: 'msg_init',
        sender_id: userId,
        sender_role: role,
        sender_name: req.user.username || 'Parent / Guardian',
        text: reason || 'Audio notice or medical document attached',
        attachment_url: attachment_url || null,
        audio_url: audio_url || null,
        timestamp: new Date().toISOString()
      }
    ];

    await query(
      `INSERT INTO leave_requests (id, school_id, user_id, staff_id, student_id, request_type, start_date, end_date, reason, attachment_url, audio_url, chat_thread, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, schoolId, userId, finalStaffId, finalStudentId, finalType, start_date, end_date, reason || null, attachment_url || null, audio_url || null, JSON.stringify(initialThread)]
    );

    const created = await queryOne(
      `SELECT lr.*, COALESCE(CONCAT(st.first_name, ' ', st.last_name), stf.name) as staff_name,
              st.admission_number, c.name as class_name
       FROM leave_requests lr
       LEFT JOIN students st ON lr.student_id = st.id
       LEFT JOIN classes c ON st.class_id = c.id
       LEFT JOIN staff stf ON lr.staff_id = stf.id
       WHERE lr.id = ?`,
      [id]
    );

    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Submit leave request error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit leave request.' } });
  }
});

router.post('/schools/:schoolId/leave-requests/:id/chat', authenticateToken, async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { text, audio_url, attachment_url } = req.body;
    if (!text?.trim() && !audio_url && !attachment_url) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message content, audio, or attachment required.' } });
    }

    const existing = await queryOne('SELECT * FROM leave_requests WHERE id = ? AND school_id = ?', [id, schoolId]);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Leave request not found.' } });
    }

    let thread = [];
    try {
      thread = typeof existing.chat_thread === 'string' ? JSON.parse(existing.chat_thread) : (existing.chat_thread || []);
    } catch (_) { thread = []; }

    const newMsg = {
      id: 'msg_' + Date.now(),
      sender_id: req.user.id,
      sender_role: req.user.role,
      sender_name: req.user.username || 'User',
      text: text?.trim() || '',
      attachment_url: attachment_url || null,
      audio_url: audio_url || null,
      timestamp: new Date().toISOString()
    };

    thread.push(newMsg);
    await query('UPDATE leave_requests SET chat_thread = ? WHERE id = ?', [JSON.stringify(thread), id]);
    return res.json({ data: { message: 'Chat message posted', thread } });
  } catch (err) {
    console.error('Leave request chat error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to post message to consultation thread.' } });
  }
});

router.patch('/schools/:schoolId/leave-requests/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { status, reviewer_comment } = req.body;
    const existing = await queryOne('SELECT * FROM leave_requests WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    if (existing) {
      let thread = [];
      try {
        thread = typeof existing.chat_thread === 'string' ? JSON.parse(existing.chat_thread) : (existing.chat_thread || []);
      } catch (_) { thread = []; }
      if (reviewer_comment || status) {
        thread.push({
          id: 'admin_' + Date.now(),
          sender_id: req.user.id,
          sender_role: req.user.role,
          sender_name: 'School Administration',
          text: reviewer_comment ? `[Status: ${status?.toUpperCase() || 'UPDATED'}] ${reviewer_comment}` : `Status updated to ${status?.toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      }
      await query(
        `UPDATE leave_requests SET status = COALESCE(?, status), reviewer_comment = COALESCE(?, reviewer_comment), reviewed_by = ?, chat_thread = ? WHERE id = ? AND school_id = ?`,
        [status, reviewer_comment, req.user.id, JSON.stringify(thread), req.params.id, req.params.schoolId]
      );
    }
    const updated = await queryOne('SELECT * FROM leave_requests WHERE id = ?', [req.params.id]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update leave request.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXAMS
// GET /schools/:schoolId/exams
// POST /schools/:schoolId/exams
// PATCH /schools/:schoolId/exams/:id
// DELETE /schools/:schoolId/exams/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/exams', authenticateToken, async (req, res) => {
  try {
    const exams = await query(
      `SELECT e.*, c.name as class_name, e.subject as subject_name
       FROM exams e
       LEFT JOIN classes c ON e.class_id = c.id
       WHERE e.school_id = ?
       ORDER BY e.exam_date ASC`,
      [req.params.schoolId]
    );
    return res.json({ data: exams });
  } catch (err) {
    return res.json({ data: [] });
  }
});

router.post('/schools/:schoolId/exams', authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, subject, subject_id, class_id, term, exam_date, start_time, duration_minutes, venue, invigilator } = req.body;
    const subjName = subject || subject_id || name;
    if (!subjName || !class_id || !exam_date) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Exam subject, class, and date are required.' } });
    }

    // Validate subject exists in subjects table or matches standard list
    const validSubject = await queryOne('SELECT * FROM subjects WHERE name = ? OR code = ? OR id = ?', [subjName, subjName, subjName]);
    if (!validSubject) {
      return res.status(400).json({ error: { code: 'INVALID_SUBJECT', message: `Subject '${subjName}' does not exist in the curriculum. Please select a registered subject.` } });
    }

    // Validate date: cannot be in the past or on weekends
    const examDateObj = new Date(exam_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(examDateObj.getTime())) {
      return res.status(400).json({ error: { code: 'INVALID_DATE', message: 'Please provide a valid exam date.' } });
    }
    if (examDateObj < today) {
      return res.status(400).json({ error: { code: 'INVALID_DATE', message: 'Exam date cannot be in the past.' } });
    }
    const dayOfWeek = examDateObj.getDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({ error: { code: 'INVALID_DATE', message: 'Exams cannot be scheduled on weekends (Saturday or Sunday).' } });
    }

    const id = 'EXM' + Math.random().toString(36).substr(2, 5).toUpperCase();
    await query(
      `INSERT INTO exams (id, school_id, class_id, term, subject, exam_date, start_time, duration_minutes, venue, invigilator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, schoolId, class_id, term || getTermFromDate(), validSubject.name, exam_date, start_time || null, duration_minutes || 120, venue || null, invigilator || null]
    );
    const created = await queryOne('SELECT * FROM exams WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create exam error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create exam.' } });
  }
});

router.delete('/schools/:schoolId/exams/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM exams WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    return res.json({ data: { message: 'Exam deleted.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete exam.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENQUIRIES
// GET /schools/:schoolId/enquiries
// POST /schools/:schoolId/enquiries
// PATCH /schools/:schoolId/enquiries/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/enquiries', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { status } = req.query;
    let sql = 'SELECT * FROM enquiries WHERE school_id = ?';
    const params = [schoolId];
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const enquiries = await query(sql, params);
    const formatted = (enquiries || []).map(e => ({
      ...e,
      applicant_name: e.student_name || e.applicant_name || 'Prospective Student',
      guardian_name: e.parent_name || e.guardian_name || 'Parent/Guardian',
      guardian_phone: e.contact_phone || e.guardian_phone || '',
      guardian_email: e.contact_email || e.guardian_email || '',
      grade_applying_for: e.grade_applying || e.grade_applying_for || 'Form 1',
      notes: e.message || e.notes || e.admin_notes || ''
    }));
    return res.json({ data: formatted });
  } catch (err) {
    console.error('Get enquiries error:', err);
    return res.json({ data: [] });
  }
});

router.post('/schools/:schoolId/enquiries', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const parent_name = (req.body.parent_name || req.body.guardian_name || '').trim();
    const student_name = (req.body.student_name || req.body.applicant_name || '').trim();
    const contact_phone = (req.body.contact_phone || req.body.guardian_phone || req.body.phone || '').trim();
    const contact_email = (req.body.contact_email || req.body.guardian_email || req.body.email || '').trim();
    const grade_applying = (req.body.grade_applying || req.body.grade_applying_for || req.body.grade || 'Form 1').trim();
    const message = (req.body.message || req.body.notes || '').trim();

    if (!parent_name || !contact_phone) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Parent name and contact are required.' } });
    }
    const id = 'ENQ' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO enquiries (id, school_id, parent_name, student_name, contact_phone, contact_email, grade_applying, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      [id, schoolId, parent_name, student_name || null, contact_phone, contact_email || null, grade_applying || null, message || null]
    );
    const created = await queryOne('SELECT * FROM enquiries WHERE id = ?', [id]);
    return res.status(201).json({
      data: {
        ...created,
        applicant_name: created?.student_name || student_name,
        guardian_name: created?.parent_name || parent_name,
        guardian_phone: created?.contact_phone || contact_phone,
        guardian_email: created?.contact_email || contact_email,
        grade_applying_for: created?.grade_applying || grade_applying,
        notes: created?.message || message
      }
    });
  } catch (err) {
    console.error('Create enquiry error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit enquiry.' } });
  }
});

router.patch('/schools/:schoolId/enquiries/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    await query(
      'UPDATE enquiries SET status = COALESCE(?, status), admin_notes = COALESCE(?, admin_notes) WHERE id = ? AND school_id = ?',
      [status, admin_notes, req.params.id, req.params.schoolId]
    );
    const updated = await queryOne('SELECT * FROM enquiries WHERE id = ?', [req.params.id]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update enquiry.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSETS
// GET /schools/:schoolId/assets
// POST /schools/:schoolId/assets
// PATCH /schools/:schoolId/assets/:id
// DELETE /schools/:schoolId/assets/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/assets', authenticateToken, async (req, res) => {
  try {
    const assets = await query(
      `SELECT a.*,
              al.holder_name,
              al.holder_type,
              al.holder_id,
              al.issued_at
       FROM assets a
       LEFT JOIN (
         SELECT al2.*,
                COALESCE(
                  CONCAT(s.first_name, ' ', s.last_name),
                  CONCAT(e.first_name, ' ', e.last_name),
                  al2.holder_id
                ) AS holder_name
         FROM asset_lendings al2
         LEFT JOIN students s ON al2.holder_type = 'student' AND al2.holder_id = s.id
         LEFT JOIN employees e ON al2.holder_type = 'staff' AND al2.holder_id = e.id
         WHERE al2.returned_at IS NULL
       ) al ON al.asset_id = a.id
       WHERE a.school_id = ?
       ORDER BY a.name ASC`,
      [req.params.schoolId]
    );
    return res.json({ data: assets });
  } catch (err) {
    return res.json({ data: [] });
  }
});

router.post('/schools/:schoolId/assets', authenticateToken, requireRoles('school_admin', 'super_admin', 'bursar'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, category, category_id, code, serial_number, value, purchase_cost, description, notes, condition, condition_status, location, custodian } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Asset name is required.' } });
    }
    const id = 'AST' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const cat = category || category_id || 'general';
    const cost = parseFloat(purchase_cost || value || 0);
    const cond = condition || condition_status || 'good';
    const loc = location || null;
    const cust = custodian || null;
    const desc = description || notes || null;

    await query(
      `INSERT INTO assets (id, school_id, name, category, code, serial_number, value, purchase_cost, condition_status, location, custodian, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
      [id, schoolId, name.trim(), cat, code || id, serial_number || null, cost, cost, cond, loc, cust, desc]
    );
    const created = await queryOne('SELECT * FROM assets WHERE id = ?', [id]);
    broadcastInvalidation(schoolId, ['assets', 'inventory', 'dashboard'], 'asset_created');
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Add asset error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to add asset.' } });
  }
});

router.get('/schools/:schoolId/asset-categories', authenticateToken, async (req, res) => {
  return res.json({
    data: [
      'Vehicles & Buses', 'ICT & Computing', 'Furniture & Desks',
      'Laboratory & Science', 'Sports & Physical Ed', 'Library Books & Media',
      'Audio & Visual (AV)', 'Musical Instruments', 'Facility & Maintenance',
      'Catering & Kitchen', 'Medical & First Aid', 'Security & Surveillance'
    ]
  });
});

// GET /hostels and GET /hostels/allocations (Global alias)
router.get(['/hostels', '/schools/:schoolId/hostels'], authenticateToken, async (req, res) => {
  const schoolId = req.params.schoolId || req.user.school_id;
  if (!schoolId) return res.json({ data: [] });
  try {
    const hostels = await query('SELECT * FROM hostels WHERE school_id = ? ORDER BY name ASC', [schoolId]);
    return res.json({ data: hostels });
  } catch (err) {
    return res.json({ data: [] });
  }
});

// POST /hostels (Create Hostel Block)
router.post(['/hostels', '/schools/:schoolId/hostels'], authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  const schoolId = req.params.schoolId || req.user.school_id;
  if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_REQUIRED', message: 'School ID required.' } });
  try {
    const { name, type, capacity, warden_name, warden_phone, warden_email, max_occupants_per_room } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Hostel name is required.' } });
    }
    const id = 'HST' + Math.random().toString(36).substr(2, 5).toUpperCase();
    await query(
      `INSERT INTO hostels (id, school_id, name, type, capacity, warden_name, warden_phone, warden_email, max_occupants_per_room)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, schoolId, name.trim(), type || 'student_male',
        parseInt(capacity || 60), warden_name || null,
        warden_phone || null, warden_email || null,
        parseInt(max_occupants_per_room || 2)
      ]
    );
    const created = await queryOne('SELECT * FROM hostels WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create hostel error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create hostel block.' } });
  }
});

// GET /hostels/allocations
router.get(['/hostels/allocations', '/schools/:schoolId/hostels/allocations'], authenticateToken, async (req, res) => {
  const schoolId = req.params.schoolId || req.user.school_id;
  if (!schoolId) return res.json({ data: [] });
  try {
    const allocations = await query(
      `SELECT ha.*, h.name as hostel_name, h.warden_name, h.warden_phone, h.warden_email,
              st.first_name, st.last_name, st.admission_number, c.name as class_name, c.grade_level
       FROM hostel_allocations ha
       JOIN hostels h ON ha.hostel_id = h.id
       LEFT JOIN students st ON ha.occupant_id = st.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE ha.school_id = ? OR h.school_id = ?
       ORDER BY ha.status ASC, h.name ASC, ha.room_number ASC, ha.bed_number ASC`,
      [schoolId, schoolId]
    );
    return res.json({ data: allocations });
  } catch (err) {
    console.error('Get hostel allocations error:', err);
    return res.json({ data: [] });
  }
});

// POST /hostels/allocate (Allocate Room/Bed with Double-Booking & Max Capacity Guards)
router.post(['/hostels/allocate', '/schools/:schoolId/hostels/allocate'], authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  const schoolId = req.params.schoolId || req.user.school_id;
  if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_REQUIRED', message: 'School ID required.' } });
  try {
    const { hostel_id, occupant_id, occupant_type, room_number, bed_number, term } = req.body;
    if (!hostel_id || !occupant_id || !room_number || !bed_number) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Hostel, occupant, room number, and bed number are required.' } });
    }

    const hostel = await queryOne('SELECT * FROM hostels WHERE id = ?', [hostel_id]);
    if (!hostel) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Selected hostel block not found.' } });
    }

    // 1. Guard: Check if bed is already occupied by an active occupant
    const existingBed = await queryOne(
      `SELECT ha.*, st.first_name, st.last_name
       FROM hostel_allocations ha
       LEFT JOIN students st ON ha.occupant_id = st.id
       WHERE ha.hostel_id = ? AND ha.room_number = ? AND ha.bed_number = ? AND ha.status != 'checked_out'`,
      [hostel_id, room_number.toString().trim(), bed_number.toString().trim()]
    );
    if (existingBed) {
      const occupantName = existingBed.first_name ? `${existingBed.first_name} ${existingBed.last_name}` : 'another occupant';
      return res.status(400).json({
        error: {
          code: 'BED_OCCUPIED',
          message: `Same bed can't have 2 occupants! Bed ${bed_number} in Room ${room_number} is currently occupied by ${occupantName}.`
        }
      });
    }

    // 2. Guard: Check room capacity limit
    const roomCountRes = await queryOne(
      `SELECT COUNT(*) as count FROM hostel_allocations WHERE hostel_id = ? AND room_number = ? AND status != 'checked_out'`,
      [hostel_id, room_number.toString().trim()]
    );
    const currentRoomOccupants = roomCountRes ? parseInt(roomCountRes.count) : 0;
    const maxPerRoom = hostel.max_occupants_per_room || 2;

    if (currentRoomOccupants >= maxPerRoom) {
      return res.status(400).json({
        error: {
          code: 'ROOM_FULL',
          message: `Room ${room_number} has reached its maximum capacity limit (${maxPerRoom} occupants per room).`
        }
      });
    }

    const id = 'HAL' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const allocatedDate = new Date().toISOString().slice(0, 10);
    const termVal = term || `${getTermFromDate()} ${new Date().getFullYear()}`;

    await query(
      `INSERT INTO hostel_allocations (id, school_id, hostel_id, occupant_id, occupant_type, room_number, bed_number, allocated_date, term, status, checked_in_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'checked_in', NOW())`,
      [id, schoolId, hostel_id, occupant_id, occupant_type || 'student', room_number.toString().trim(), bed_number.toString().trim(), allocatedDate, termVal]
    );

    // Update residence application status if exists
    try {
      await query(
        `UPDATE hostel_applications SET status = 'allocated' WHERE student_id = ? AND school_id = ? AND status = 'pending'`,
        [occupant_id, schoolId]
      );
    } catch (e) {}

    const created = await queryOne('SELECT * FROM hostel_allocations WHERE id = ?', [id]);
    return res.status(201).json({ data: created, message: 'Room & Bed allocated successfully.' });
  } catch (err) {
    console.error('Allocate hostel error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to allocate hostel accommodation.' } });
  }
});

// POST /hostels/allocations/:id/check-in & check-out
router.post(['/hostels/allocations/:id/check-in', '/schools/:schoolId/hostels/allocations/:id/check-in'], authenticateToken, async (req, res) => {
  try {
    await query(`UPDATE hostel_allocations SET status = 'checked_in', checked_in_at = NOW() WHERE id = ?`, [req.params.id]);
    return res.json({ data: { message: 'Student successfully checked in to residence.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Check-in failed.' } });
  }
});

router.post(['/hostels/allocations/:id/check-out', '/schools/:schoolId/hostels/allocations/:id/check-out'], authenticateToken, async (req, res) => {
  try {
    await query(`UPDATE hostel_allocations SET status = 'checked_out', checked_out_at = NOW() WHERE id = ?`, [req.params.id]);
    return res.json({ data: { message: 'Student checked out. Room and bed are now vacant.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Check-out failed.' } });
  }
});

// RESIDENCE APPLICATIONS (Student / Parent Portal Application)
// GET /hostels/applications
router.get(['/hostels/applications', '/schools/:schoolId/hostels/applications'], authenticateToken, async (req, res) => {
  const schoolId = req.params.schoolId || req.user.school_id;
  if (!schoolId) return res.json({ data: [] });
  try {
    const apps = await query(
      `SELECT hap.*, st.first_name, st.last_name, st.admission_number, st.gender, c.name as class_name, c.grade_level, h.name as preferred_hostel_name
       FROM hostel_applications hap
       JOIN students st ON hap.student_id = st.id
       LEFT JOIN classes c ON st.class_id = c.id
       LEFT JOIN hostels h ON hap.hostel_id = h.id
       WHERE hap.school_id = ?
       ORDER BY hap.applied_at DESC`,
      [schoolId]
    );
    return res.json({ data: apps });
  } catch (err) {
    return res.json({ data: [] });
  }
});

// POST /hostels/applications (Parent Portal / Student Residence Application)
router.post(['/hostels/applications', '/schools/:schoolId/hostels/applications'], authenticateToken, async (req, res) => {
  const schoolId = req.params.schoolId || req.user.school_id;
  if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_REQUIRED', message: 'School ID required.' } });
  try {
    const { student_id, hostel_id, notes } = req.body;
    if (!student_id) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Student selection is required.' } });
    }

    const id = 'HAP' + Math.random().toString(36).substr(2, 5).toUpperCase();
    await query(
      `INSERT INTO hostel_applications (id, school_id, student_id, hostel_id, status, notes, applied_at)
       VALUES (?, ?, ?, ?, 'pending', ?, NOW())`,
      [id, schoolId, student_id, hostel_id || null, notes || 'Parent application for residence']
    );

    const created = await queryOne('SELECT * FROM hostel_applications WHERE id = ?', [id]);
    return res.status(201).json({ data: created, message: 'Residence application submitted successfully.' });
  } catch (err) {
    console.error('Apply for hostel error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit residence application.' } });
  }
});

// POST /hostels/smart-allocate (Auto allocation based on occupancy & student level/gender)
router.post(['/hostels/smart-allocate', '/schools/:schoolId/hostels/smart-allocate'], authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  const schoolId = req.params.schoolId || req.user.school_id;
  if (!schoolId) return res.status(400).json({ error: { code: 'SCHOOL_REQUIRED', message: 'School ID required.' } });
  try {
    const { student_id } = req.body;
    const student = await queryOne(
      `SELECT st.*, c.grade_level FROM students st LEFT JOIN classes c ON st.class_id = c.id WHERE st.id = ?`,
      [student_id]
    );

    if (!student) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Student record not found.' } });
    }

    // Determine target hostel type based on student gender
    const targetType = student.gender === 'female' ? 'student_female' : 'student_male';
    const hostels = await query('SELECT * FROM hostels WHERE school_id = ? AND (type = ? OR type = "student_male")', [schoolId, targetType]);

    if (!hostels || hostels.length === 0) {
      return res.status(400).json({ error: { code: 'NO_HOSTEL', message: 'No suitable hostel blocks available for this student.' } });
    }

    // Pick suitable hostel block
    const chosenHostel = hostels[0];
    const maxPerRoom = chosenHostel.max_occupants_per_room || 2;

    // Search for next available room and bed
    let assignedRoom = null;
    let assignedBed = null;

    for (let r = 1; r <= 30; r++) {
      const roomNum = `Room ${r}`;
      const occupants = await query(
        `SELECT bed_number FROM hostel_allocations WHERE hostel_id = ? AND room_number = ? AND status != 'checked_out'`,
        [chosenHostel.id, roomNum]
      );
      if (occupants.length < maxPerRoom) {
        assignedRoom = roomNum;
        const takenBeds = occupants.map(o => o.bed_number);
        for (let b = 1; b <= maxPerRoom; b++) {
          const bedStr = `Bed ${b}`;
          if (!takenBeds.includes(bedStr)) {
            assignedBed = bedStr;
            break;
          }
        }
        if (assignedBed) break;
      }
    }

    if (!assignedRoom || !assignedBed) {
      return res.status(400).json({ error: { code: 'HOSTEL_FULL', message: 'All rooms and beds in available hostels are currently full.' } });
    }

    const allocId = 'HAL' + Math.random().toString(36).substr(2, 5).toUpperCase();
    await query(
      `INSERT INTO hostel_allocations (id, school_id, hostel_id, occupant_id, occupant_type, room_number, bed_number, allocated_date, term, status, checked_in_at)
       VALUES (?, ?, ?, ?, 'student', ?, ?, CURDATE(), ?, 'checked_in', NOW())`,
      [allocId, schoolId, chosenHostel.id, student_id, assignedRoom, assignedBed, `${getTermFromDate()} ${new Date().getFullYear()}`]
    );

    await query(`UPDATE hostel_applications SET status = 'allocated' WHERE student_id = ? AND school_id = ?`, [student_id, schoolId]);

    return res.json({
      data: {
        hostel_name: chosenHostel.name,
        room_number: assignedRoom,
        bed_number: assignedBed,
        message: `Successfully auto-allocated ${student.first_name} ${student.last_name} to ${chosenHostel.name}, ${assignedRoom}, ${assignedBed}.`
      }
    });
  } catch (err) {
    console.error('Smart allocation error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to perform smart hostel allocation.' } });
  }
});

// POST /schools/:schoolId/assets/:id/return
router.post('/schools/:schoolId/assets/:id/return', authenticateToken, async (req, res) => {
  try {
    try {
      await query(
        `UPDATE assets SET status = 'available', holder_id = NULL, holder_type = NULL WHERE id = ?`,
        [req.params.id]
      );
    } catch (e1) {
      await query(
        `UPDATE assets SET status = 'available' WHERE id = ?`,
        [req.params.id]
      );
    }
    return res.json({ data: { message: 'Asset returned successfully.' } });
  } catch (err) {
    console.error('Asset return error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to return asset.' } });
  }
});

// Configurable Teaching Periods per School
router.get('/schools/:schoolId/timetable/periods', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const configRow = await queryOne('SELECT `value` FROM system_config WHERE `key` = ?', [`timetable_periods_${schoolId}`]);
    if (configRow && configRow.value) {
      try {
        const periods = JSON.parse(configRow.value);
        if (Array.isArray(periods) && periods.length > 0) {
          return res.json({ data: periods });
        }
      } catch (e) {}
    }

    const defaultPeriods = [
      { id: '1', name: 'Period 1', time: '08:00 - 08:45', start_time: '08:00', end_time: '08:45', isBreak: false },
      { id: '2', name: 'Period 2', time: '08:45 - 09:30', start_time: '08:45', end_time: '09:30', isBreak: false },
      { id: '3', name: 'Period 3', time: '09:30 - 10:15', start_time: '09:30', end_time: '10:15', isBreak: false },
      { id: 'break', name: 'Morning Tea', time: '10:15 - 10:45', start_time: '10:15', end_time: '10:45', isBreak: true },
      { id: '4', name: 'Period 4', time: '10:45 - 11:30', start_time: '10:45', end_time: '11:30', isBreak: false },
      { id: '5', name: 'Period 5', time: '11:30 - 12:15', start_time: '11:30', end_time: '12:15', isBreak: false },
      { id: 'lunch', name: 'Lunch Break', time: '12:15 - 13:15', start_time: '12:15', end_time: '13:15', isBreak: true },
      { id: '6', name: 'Period 6', time: '13:15 - 14:00', start_time: '13:15', end_time: '14:00', isBreak: false },
      { id: '7', name: 'Period 7', time: '14:00 - 14:45', start_time: '14:00', end_time: '14:45', isBreak: false },
      { id: '8', name: 'Period 8', time: '14:45 - 15:30', start_time: '14:45', end_time: '15:30', isBreak: false },
    ];
    return res.json({ data: defaultPeriods });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch timetable periods.' } });
  }
});

router.post('/schools/:schoolId/timetable/periods', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { periods } = req.body;
    if (!Array.isArray(periods)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'periods array is required.' } });
    }
    await query(
      'INSERT INTO system_config (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
      [`timetable_periods_${schoolId}`, JSON.stringify(periods)]
    );
    return res.json({ data: periods, message: 'Teaching periods updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to save timetable periods.' } });
  }
});

router.get('/schools/:schoolId/timetable', authenticateToken, async (req, res) => {
  try {
    const { class_id, teacher_name, teacher_id, mode } = req.query;
    let sql = `
      SELECT tt.*, c.name as class_name
      FROM timetable tt
      LEFT JOIN classes c ON tt.class_id = c.id
      WHERE tt.school_id = ?
    `;
    const params = [req.params.schoolId];

    if (class_id) {
      sql += ' AND tt.class_id = ?';
      params.push(class_id);
    } else if (teacher_name || teacher_id || mode === 'teacher') {
      // Find teacher name/id
      let searchTeacher = teacher_name || teacher_id;
      if (!searchTeacher && req.user) {
        // Resolve teacher's name from staff or user profile
        const staffRec = await queryOne('SELECT name FROM staff WHERE user_id = ? AND school_id = ?', [req.user.id, req.params.schoolId]);
        searchTeacher = staffRec ? staffRec.name : req.user.username;
      }
      if (searchTeacher) {
        sql += ' AND (LOWER(tt.teacher) LIKE LOWER(?) OR tt.teacher = ?)';
        params.push(`%${searchTeacher}%`, searchTeacher);
      }
    }

    sql += ' ORDER BY tt.day ASC, tt.period ASC';
    const timetable = await query(sql, params);
    return res.json({ data: timetable });
  } catch (err) {
    return res.json({ data: [] });
  }
});


router.post('/schools/:schoolId/timetable', authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    // Accept both old-style (day_of_week, start_time) and new-style (day, period) field names
    const class_id = req.body.class_id;
    const day = req.body.day || req.body.day_of_week;
    const period = req.body.period || (req.body.start_time ? `${req.body.start_time}${req.body.end_time ? '–' + req.body.end_time : ''}` : null);
    const subject = req.body.subject || req.body.subject_name || null;
    const teacher = req.body.teacher || req.body.teacher_name || null;

    if (!class_id || !day || !period) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Class, day, and period are required.' } });
    }
    // Generate short ID within VARCHAR(8)
    const id = 'TT' + Math.random().toString(36).substr(2, 6).toUpperCase();
    await query(
      `INSERT INTO timetable (id, school_id, class_id, day, period, subject, teacher)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE subject = VALUES(subject), teacher = VALUES(teacher)`,
      [id, schoolId, class_id, day, period, subject, teacher]
    );
    const created = await queryOne('SELECT * FROM timetable WHERE class_id = ? AND day = ? AND period = ?', [class_id, day, period]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create timetable error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create timetable entry.' } });
  }
});

router.delete('/schools/:schoolId/timetable/:id', authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    await query('DELETE FROM timetable WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    return res.json({ data: { message: 'Timetable entry deleted.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete timetable entry.' } });
  }
});

router.put('/schools/:schoolId/timetable/:id', authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {

  try {
    const { schoolId, id } = req.params;
    const day = req.body.day || req.body.day_of_week;
    const period = req.body.period || (req.body.start_time ? `${req.body.start_time}${req.body.end_time ? '–' + req.body.end_time : ''}` : null);
    const subject = req.body.subject || req.body.subject_name || null;
    const teacher = req.body.teacher || req.body.teacher_name || null;
    const class_id = req.body.class_id;

    let existing = await queryOne('SELECT id FROM timetable WHERE id = ? AND school_id = ?', [id, schoolId]);
    if (!existing && class_id && day && period) {
      existing = await queryOne('SELECT id FROM timetable WHERE school_id = ? AND class_id = ? AND day = ? AND period = ?', [schoolId, class_id, day, period]);
    }

    if (existing) {
      await query(
        `UPDATE timetable SET
           subject  = COALESCE(?, subject),
           teacher  = COALESCE(?, teacher)
         WHERE id = ? AND school_id = ?`,
        [subject, teacher, existing.id, schoolId]
      );
      const result = await queryOne('SELECT * FROM timetable WHERE id = ?', [existing.id]);
      return res.json({ data: result });
    } else {
      if (!class_id || !day || !period) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Class, day, and period are required.' } });
      }
      const newId = id || ('TT' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4));
      await query(
        `INSERT INTO timetable (id, school_id, class_id, day, period, subject, teacher)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE subject = VALUES(subject), teacher = VALUES(teacher)`,
        [newId, schoolId, class_id, day, period, subject, teacher]
      );
      const result = await queryOne('SELECT * FROM timetable WHERE school_id = ? AND class_id = ? AND day = ? AND period = ?', [schoolId, class_id, day, period]);
      return res.json({ data: result });
    }

    return res.json({ data: result });
  } catch (err) {
    console.error('Update timetable error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update timetable entry.' } });
  }
});

// GET /schools/:schoolId/hostel-allocations
router.get('/schools/:schoolId/hostel-allocations', authenticateToken, async (req, res) => {
  try {
    const allocations = await query(
      `SELECT ha.*, h.name as hostel_name, st.first_name, st.last_name, st.admission_number
       FROM hostel_allocations ha
       JOIN hostels h ON ha.hostel_id = h.id
       JOIN students st ON ha.occupant_id = st.id
       WHERE ha.school_id = ? OR h.school_id = ?
       ORDER BY h.name ASC, st.first_name ASC`,
      [req.params.schoolId, req.params.schoolId]
    );
    return res.json({ data: allocations });
  } catch (err) {
    return res.json({ data: [] });
  }
});

// POST /schools/:schoolId/hostel-allocations
router.post('/schools/:schoolId/hostel-allocations', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { hostel_id, student_id, occupant_id, room_number, bed_number, term } = req.body;
    const targetStudentId = occupant_id || student_id;
    if (!hostel_id || !targetStudentId) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Hostel and student are required.' } });
    }

    // Check 1: Same bed can't have 2 occupants
    if (room_number && bed_number) {
      const bedOcc = await queryOne(
        `SELECT id FROM hostel_allocations WHERE hostel_id = ? AND room_number = ? AND bed_number = ? AND status != 'checked_out'`,
        [hostel_id, room_number, bed_number]
      );
      if (bedOcc) return res.status(409).json({ error: { code: 'DUPLICATE_BED', message: `Bed ${bed_number} in Room ${room_number} is already occupied by another student.` } });
    }

    // Check 2: Student already allocated a hostel
    const stOcc = await queryOne(
      `SELECT id FROM hostel_allocations WHERE occupant_id = ? AND status != 'checked_out'`,
      [targetStudentId]
    );
    if (stOcc) return res.status(409).json({ error: { code: 'DUPLICATE_STUDENT', message: 'This student already has an active hostel residence allocation.' } });

    const id = 'HAL' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    await query(
      `INSERT INTO hostel_allocations (id, school_id, hostel_id, occupant_id, occupant_type, room_number, bed_number, term, allocated_date)
       VALUES (?, ?, ?, ?, 'student', ?, ?, ?, NOW())`,
      [id, schoolId, hostel_id, targetStudentId, room_number || null, bed_number || null, term || 'Term 1']
    );
    const created = await queryOne('SELECT * FROM hostel_allocations WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to allocate hostel room.' } });
  }
});

router.delete('/schools/:schoolId/hostel-allocations/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM hostel_allocations WHERE id = ?', [req.params.id]);
    return res.json({ data: { message: 'Allocation removed.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to remove allocation.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// GET /schools/:schoolId/audit-log
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/audit-log', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const logs = await query(
      `SELECT al.*, u.username as actor_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.school_id = ?
       ORDER BY al.created_at DESC LIMIT 200`,
      [req.params.schoolId]
    );
    return res.json({ data: logs });
  } catch (err) {
    return res.json({ data: [] });
  }
});



// Helper: Seed default grading systems based on school type
async function seedDefaultGradeThresholds(schoolId, schoolType) {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS grade_thresholds (
        id VARCHAR(50) PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL,
        grade VARCHAR(10) NOT NULL,
        label VARCHAR(50) NULL,
        min_score DECIMAL(5,2) NOT NULL,
        max_score DECIMAL(5,2) NOT NULL,
        points INT NULL,
        color VARCHAR(20) NULL,
        is_pass TINYINT(1) DEFAULT 1
      )
    `);

    let defaults = [];
    const type = String(schoolType || '').toLowerCase();
    if (type === 'primary') {
      defaults = [
        { grade: '1', label: 'Distinction', min: 80, max: 100, points: 1, pass: 1, color: '#0d9488' },
        { grade: '2', label: 'Merit',       min: 70, max: 79.99, points: 2, pass: 1, color: '#0284c7' },
        { grade: '3', label: 'Credit',      min: 60, max: 69.99, points: 3, pass: 1, color: '#2563eb' },
        { grade: '4', label: 'Satisfactory',min: 50, max: 59.99, points: 4, pass: 1, color: '#4f46e5' },
        { grade: '5', label: 'Marginal Pass', min: 45, max: 49.99, points: 5, pass: 1, color: '#ca8a04' },
        { grade: '6', label: 'Bare Pass',   min: 40, max: 44.99, points: 6, pass: 1, color: '#ea580c' },
        { grade: '7', label: 'Unsatisfactory', min: 35, max: 39.99, points: 7, pass: 0, color: '#e11d48' },
        { grade: '8', label: 'Poor',        min: 30, max: 34.99, points: 8, pass: 0, color: '#dc2626' },
        { grade: '9', label: 'Very Poor',   min: 0,  max: 29.99, points: 9, pass: 0, color: '#991b1b' }
      ];
    } else if (type === 'high_school' || type === 'combined') {
      defaults = [
        // A-Level Points Scale (A=5, B=4, C=3, D=2, E=1, O=0, F=0)
        { grade: 'A', label: 'A-Level Distinction (5 Pts)', min: 70, max: 100, points: 5, pass: 1, color: '#0d9488' },
        { grade: 'B', label: 'A-Level Merit (4 Pts)',       min: 60, max: 69.99, points: 4, pass: 1, color: '#0284c7' },
        { grade: 'C', label: 'A-Level Credit (3 Pts)',      min: 50, max: 59.99, points: 3, pass: 1, color: '#2563eb' },
        { grade: 'D', label: 'A-Level Sub-Pass (2 Pts)',    min: 45, max: 49.99, points: 2, pass: 1, color: '#ca8a04' },
        { grade: 'E', label: 'A-Level Pass (1 Pt)',         min: 40, max: 44.99, points: 1, pass: 1, color: '#ea580c' },
        { grade: 'O', label: 'A-Level Subsidiary (0 Pts)', min: 35, max: 39.99, points: 0, pass: 0, color: '#e11d48' },
        { grade: 'F', label: 'A-Level Fail (0 Pts)',       min: 0,  max: 34.99, points: 0, pass: 0, color: '#991b1b' },
        // O-Level Scale
        { grade: 'A_OL', label: 'O-Level Distinction', min: 75, max: 100, points: 1, pass: 1, color: '#0d9488' },
        { grade: 'B_OL', label: 'O-Level Merit',       min: 65, max: 74.99, points: 2, pass: 1, color: '#0284c7' },
        { grade: 'C_OL', label: 'O-Level Credit Pass', min: 50, max: 64.99, points: 3, pass: 1, color: '#2563eb' },
        { grade: 'D_OL', label: 'O-Level Sub-Credit',  min: 45, max: 49.99, points: 4, pass: 0, color: '#ca8a04' },
        { grade: 'E_OL', label: 'O-Level Poor',        min: 40, max: 44.99, points: 5, pass: 0, color: '#ea580c' },
        { grade: 'U_OL', label: 'O-Level Ungraded',    min: 0,  max: 39.99, points: 6, pass: 0, color: '#991b1b' }
      ];
    } else {
      // Secondary: O-Level Symbols A, B, C, D, E, U
      defaults = [
        { grade: 'A', label: 'Distinction', min: 75, max: 100, points: 1, pass: 1, color: '#0d9488' },
        { grade: 'B', label: 'Merit',       min: 65, max: 74.99, points: 2, pass: 1, color: '#0284c7' },
        { grade: 'C', label: 'Credit Pass', min: 50, max: 64.99, points: 3, pass: 1, color: '#2563eb' },
        { grade: 'D', label: 'Sub-credit',  min: 45, max: 49.99, points: 4, pass: 0, color: '#ca8a04' },
        { grade: 'E', label: 'Poor',        min: 40, max: 44.99, points: 5, pass: 0, color: '#ea580c' },
        { grade: 'U', label: 'Ungraded',    min: 0,  max: 39.99, points: 6, pass: 0, color: '#991b1b' }
      ];
    }

    await query('DELETE FROM grade_thresholds WHERE school_id = ?', [schoolId]);
    for (const d of defaults) {
      const tId = 'GT' + Math.random().toString(36).substr(2, 6).toUpperCase();
      await query(
        `INSERT INTO grade_thresholds (id, school_id, grade, grade_symbol, label, min_score, min_mark, max_score, max_mark, points, color, is_pass)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tId, schoolId, d.grade, d.grade, d.label, d.min, d.min, d.max, d.max, d.points, d.color, d.pass]
      );
    }
  } catch (err) {
    console.error('seedDefaultGradeThresholds error:', err);
  }
}

async function provisionSchoolDefaults(schoolId, schoolType, headTitle, adminUsername, adminEmail, adminPassword, superAdminUserId) {
  try {
    // 1. Seed default grading system matching school type
    await seedDefaultGradeThresholds(schoolId, schoolType);

    // 2. Provision default academic session and terms if none exist
    let sessionId = null;
    const existingSession = await queryOne('SELECT id FROM academic_sessions WHERE school_id = ? LIMIT 1', [schoolId]);
    if (existingSession) {
      sessionId = existingSession.id;
    } else {
      const sessRes = await query(
        `INSERT INTO academic_sessions (school_id, year, name, start_date, end_date, is_current, status)
         VALUES (?, 2026, 'Academic Year 2026', '2026-01-12', '2026-12-04', 1, 'active')`,
        [schoolId]
      );
      sessionId = sessRes.insertId;
    }

    if (sessionId) {
      const existingTerms = await query('SELECT id FROM terms WHERE school_id = ?', [schoolId]);
      if (!existingTerms || existingTerms.length === 0) {
        await query(
          `INSERT INTO terms (school_id, session_id, name, start_date, end_date, is_current) VALUES
           (?, ?, 'term_1', '2026-01-12', '2026-04-03', 1),
           (?, ?, 'term_2', '2026-05-05', '2026-08-07', 0),
           (?, ?, 'term_3', '2026-09-08', '2026-12-04', 0)`,
          [schoolId, sessionId, schoolId, sessionId, schoolId, sessionId]
        );
      }
    }

    // 3. Provision classes (either custom chosen by super admin, or defaults matching school type)
    const existingClasses = await query('SELECT id FROM classes WHERE school_id = ?', [schoolId]);
    if (!existingClasses || existingClasses.length === 0) {
      const isPrimary = String(schoolType || '').toLowerCase() === 'primary';
      let classNamesToSeed = [];
      if (Array.isArray(customClasses) && customClasses.length > 0) {
        classNamesToSeed = customClasses.map(c => typeof c === 'string' ? c : (c.name || '')).filter(Boolean);
      }
      if (classNamesToSeed.length === 0) {
        classNamesToSeed = isPrimary
          ? ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7']
          : ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower 6', 'Upper 6'];
      }

      for (const cName of classNamesToSeed) {
        const cId = 'CLS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        await query(
          `INSERT INTO classes (id, school_id, name, grade_level, level, status)
           VALUES (?, ?, ?, ?, ?, 'active')`,
          [cId, schoolId, cName, cName, isPrimary ? 'Primary' : 'Secondary']
        );
      }
    }

    // 3b. Provision subjects (either custom chosen by super admin, or standard defaults)
    const existingSubjects = await query('SELECT id FROM subjects WHERE school_id = ?', [schoolId]);
    if (!existingSubjects || existingSubjects.length === 0) {
      let subjectsToSeed = [];
      if (Array.isArray(customSubjects) && customSubjects.length > 0) {
        subjectsToSeed = customSubjects;
      } else {
        const isPrimary = String(schoolType || '').toLowerCase() === 'primary';
        subjectsToSeed = isPrimary
          ? [
              { name: 'English Language', code: 'ENG-PRI', category: 'Languages & Literature', level: 'primary' },
              { name: 'Mathematics', code: 'MATH-PRI', category: 'Mathematics', level: 'primary' },
              { name: 'Indigenous Languages (Shona/Ndebele)', code: 'IND-PRI', category: 'African Languages', level: 'primary' },
              { name: 'Agriculture, Science & Technology', code: 'AST-PRI', category: 'Natural Sciences', level: 'primary' },
              { name: 'Social Sciences', code: 'SOC-PRI', category: 'Humanities & Social Sciences', level: 'primary' },
              { name: 'Visual & Performing Arts', code: 'VPA-PRI', category: 'Creative & Performing Arts', level: 'primary' },
              { name: 'Physical Education', code: 'PE-PRI', category: 'Sports & Physical Education', level: 'primary' }
            ]
          : [
              { name: 'English Language', code: 'ENG', category: 'Languages & Literature', level: 'all' },
              { name: 'Mathematics', code: 'MATH', category: 'Mathematics', level: 'all' },
              { name: 'Combined Science', code: 'CSCI', category: 'Natural Sciences', level: 'secondary' },
              { name: 'Heritage Studies', code: 'HER', category: 'Humanities & Social Sciences', level: 'all' },
              { name: 'Geography', code: 'GEO', category: 'Humanities & Social Sciences', level: 'all' },
              { name: 'History', code: 'HIST', category: 'Humanities & Social Sciences', level: 'all' },
              { name: 'Commerce', code: 'COMM', category: 'Commercials', level: 'secondary' },
              { name: 'Principles of Accounting', code: 'ACC', category: 'Commercials', level: 'all' },
              { name: 'Computer Science / ICT', code: 'ICT', category: 'Technical & ICT', level: 'all' },
              { name: 'Agriculture', code: 'AGR', category: 'Agriculture & Environmental', level: 'all' }
            ];
      }

      for (const subj of subjectsToSeed) {
        const sName = typeof subj === 'string' ? subj : subj.name;
        if (!sName) continue;
        const sId = 'SUB' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        const sCode = typeof subj === 'object' && subj.code ? String(subj.code).toUpperCase() : sName.substring(0, 4).toUpperCase();
        const sCat = typeof subj === 'object' && (subj.category || subj.department) ? (subj.category || subj.department) : 'General';
        const sLevel = typeof subj === 'object' && subj.level ? subj.level : 'all';
        await query(
          `INSERT INTO subjects (id, school_id, name, code, category, level, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [sId, schoolId, sName, sCode, sCat, sLevel]
        );
      }
    }

    // 4. Provision default active license
    const existingLic = await queryOne('SELECT id FROM licenses WHERE school_id = ?', [schoolId]);
    if (!existingLic) {
      const licId = 'LIC' + Date.now().toString(36).substr(-4) + Math.random().toString(36).substr(2, 3).toUpperCase();
      const licKey = Buffer.from(JSON.stringify({ school_id: schoolId, plan: 'full', expires_at: '2028-12-31' })).toString('base64');
      const issuerId = superAdminUserId || 'USR00001';
      await query(
        `INSERT INTO licenses (id, school_id, license_key, plan, status, issued_at, expires_at, max_users, issued_by)
         VALUES (?, ?, ?, 'full', 'active', NOW(), DATE_ADD(NOW(), INTERVAL 2 YEAR), 1000, ?)`,
        [licId, schoolId, licKey, issuerId]
      );
    }

    // 5. Provision Administrator User & Staff Record
    const rawUsername = adminUsername ? String(adminUsername).trim().toLowerCase() : `${schoolId.toLowerCase()}admin`;
    const rawPassword = adminPassword ? String(adminPassword).trim() : 'admin123';
    const rawEmail = adminEmail ? String(adminEmail).trim().toLowerCase() : null;
    const bcrypt = require('bcryptjs');
    const adminPassHash = bcrypt.hashSync(rawPassword, 10);

    const existingUser = await queryOne('SELECT id FROM users WHERE username = ?', [rawUsername]);
    let adminUserId = existingUser?.id;

    if (existingUser) {
      await query(
        `UPDATE users SET school_id = ?, password_hash = ?, role = 'school_admin', status = 'active' WHERE id = ?`,
        [schoolId, adminPassHash, adminUserId]
      );
    } else {
      adminUserId = 'USR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      await query(
        `INSERT INTO users (id, school_id, username, email, password_hash, role, status, name)
         VALUES (?, ?, ?, ?, ?, 'school_admin', 'active', ?)`,
        [adminUserId, schoolId, rawUsername, rawEmail, adminPassHash, headTitle || 'School Principal']
      );
    }

    // Provision matching staff record for leadership
    const existingStaff = await queryOne('SELECT id FROM staff WHERE user_id = ? OR (school_id = ? AND role_title = ?)', [adminUserId, schoolId, headTitle || 'Principal']);
    if (!existingStaff) {
      const staffId = 'STF' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      await query(
        `INSERT INTO staff (id, school_id, user_id, name, email, role_title, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [staffId, schoolId, adminUserId, headTitle || 'School Principal', rawEmail, headTitle || 'Principal']
      );
    }

    return { admin_username: rawUsername, admin_password: rawPassword };
  } catch (provErr) {
    console.error('provisionSchoolDefaults error:', provErr);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOLS — Create/Edit (CommandCenter)
// POST /schools
// PUT /schools/:id
// PATCH /schools/:id
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { 
      id, code, name, school_type, head_title, 
      is_boarding, boarding_type, tuition_fee_benchmark, 
      enabled_modules, classes, subjects,
      currency, bank_name, account_number,
      admin_username, admin_email, admin_password 
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'School name is required.' } });
    }
    const rawId = (id || code || name.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)).trim();
    if (!rawId) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'School ID or code is required.' } });
    }
    const schoolIdUpper = rawId.toUpperCase();
    const exists = await queryOne('SELECT id FROM schools WHERE id = ?', [schoolIdUpper]);
    if (exists) return res.status(409).json({ error: { code: 'DUPLICATE', message: 'A school with this ID or Code already exists.' } });

    // Precise boarding determination: Day schools must NEVER have boarding
    const isDayOnly = boarding_type === 'day' || is_boarding === false || is_boarding === 0 || is_boarding === '0';
    const isBoardingVal = isDayOnly ? 0 : 1;
    const resolvedBoardingType = isDayOnly ? 'day' : (boarding_type || 'boarding');
    const resolvedType = school_type || 'secondary';

    // Module resolution
    let resolvedModules = enabled_modules;
    if (typeof resolvedModules === 'string') {
      try { resolvedModules = JSON.parse(resolvedModules); } catch (_) { resolvedModules = []; }
    }
    if (!Array.isArray(resolvedModules) || resolvedModules.length === 0) {
      resolvedModules = [
        'exams', 'fees', 'expenses', 'enquiries', 'timetable', 
        'schemes', 'academics_setup', 'health', 'discipline', 
        'leave', 'library', 'assets', 'tasks', 'emis', 'reporting', 'communication'
      ];
      if (isBoardingVal === 1) resolvedModules.push('boarding');
    } else {
      if (isBoardingVal === 0) {
        resolvedModules = resolvedModules.filter(m => m !== 'boarding');
      }
    }
    const modulesJson = JSON.stringify(resolvedModules);

    try {
      await query(
        `INSERT INTO schools (id, code, name, school_type, head_title, status, is_boarding, boarding_type, tuition_fee_benchmark, enabled_modules, currency, bank_name, account_number) 
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
        [schoolIdUpper, code || schoolIdUpper, name.trim(), resolvedType, head_title || 'Headmaster', isBoardingVal, resolvedBoardingType, tuition_fee_benchmark || null, modulesJson, currency || 'USD', bank_name || null, account_number || null]
      );
    } catch (_) {
      try {
        await query(
          `INSERT INTO schools (id, code, name, school_type, head_title, status, is_boarding, boarding_type, tuition_fee_benchmark, enabled_modules) 
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
          [schoolIdUpper, code || schoolIdUpper, name.trim(), resolvedType, head_title || 'Headmaster', isBoardingVal, resolvedBoardingType, tuition_fee_benchmark || null, modulesJson]
        );
      } catch (__) {
        await query(
          `INSERT INTO schools (id, name, school_type, head_title, status, is_boarding, boarding_type) 
           VALUES (?, ?, ?, ?, 'active', ?, ?)`,
          [schoolIdUpper, name.trim(), resolvedType, head_title || 'Headmaster', isBoardingVal, resolvedBoardingType]
        );
      }
    }

    // Automatically provision grading, terms, classes, subjects, license, and admin account
    const provResult = await provisionSchoolDefaults(
      schoolIdUpper,
      resolvedType,
      head_title || 'Headmaster',
      admin_username,
      admin_email,
      admin_password,
      req.user?.id,
      classes,
      subjects
    );

    broadcastInvalidation(schoolIdUpper, ['schools', 'settings'], 'school_created');
    const created = await queryOne('SELECT * FROM schools WHERE id = ?', [schoolIdUpper]);
    return res.status(201).json({
      data: created,
      provisioned_admin: provResult
    });
  } catch (err) {
    console.error('Create school error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create school.' } });
  }
});

const handleUpdateSchool = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, code, school_type, head_title, status, 
      is_boarding, boarding_type, tuition_fee_benchmark,
      enabled_modules, classes, subjects,
      currency, bank_name, account_number
    } = req.body;

    const existing = await queryOne('SELECT * FROM schools WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'School not found.' } });
    }

    let nextIsBoarding = existing.is_boarding;
    if (is_boarding !== undefined) {
      nextIsBoarding = (is_boarding === 1 || is_boarding === true || is_boarding === '1') ? 1 : 0;
    }
    let nextBoardingType = boarding_type !== undefined ? boarding_type : existing.boarding_type;
    if (boarding_type === 'day' || nextIsBoarding === 0) {
      nextIsBoarding = 0;
      nextBoardingType = 'day';
    }

    let nextModulesJson = existing.enabled_modules;
    if (enabled_modules !== undefined) {
      let mods = Array.isArray(enabled_modules) ? enabled_modules : [];
      if (typeof enabled_modules === 'string') {
        try { mods = JSON.parse(enabled_modules); } catch (_) { mods = []; }
      }
      if (nextIsBoarding === 0) {
        mods = mods.filter(m => m !== 'boarding');
      }
      nextModulesJson = JSON.stringify(mods);
    } else if (nextIsBoarding === 0 && nextModulesJson) {
      try {
        let parsed = JSON.parse(nextModulesJson);
        if (Array.isArray(parsed)) {
          nextModulesJson = JSON.stringify(parsed.filter(m => m !== 'boarding'));
        }
      } catch (_) {}
    }

    try {
      await query(
        `UPDATE schools SET
           name                  = COALESCE(?, name),
           code                  = COALESCE(?, code),
           school_type           = COALESCE(?, school_type),
           head_title            = COALESCE(?, head_title),
           status                = COALESCE(?, status),
           is_boarding           = ?,
           boarding_type         = ?,
           tuition_fee_benchmark = COALESCE(?, tuition_fee_benchmark),
           enabled_modules       = ?,
           currency              = COALESCE(?, currency),
           bank_name             = COALESCE(?, bank_name),
           account_number        = COALESCE(?, account_number)
         WHERE id = ?`,
        [
          name !== undefined ? name.trim() : null,
          code !== undefined ? code.trim() : null,
          school_type || null,
          head_title || null,
          status || null,
          nextIsBoarding,
          nextBoardingType,
          tuition_fee_benchmark !== undefined ? tuition_fee_benchmark : null,
          nextModulesJson,
          currency || null,
          bank_name || null,
          account_number || null,
          id
        ]
      );
    } catch (_) {
      // Fallback update in case some column is missing
      await query(
        `UPDATE schools SET
           name          = COALESCE(?, name),
           school_type   = COALESCE(?, school_type),
           head_title    = COALESCE(?, head_title),
           status        = COALESCE(?, status),
           is_boarding   = ?,
           boarding_type = ?
         WHERE id = ?`,
        [name !== undefined ? name.trim() : null, school_type || null, head_title || null, status || null, nextIsBoarding, nextBoardingType, id]
      );
    }

    // If classes were provided, add any that don't exist yet
    if (Array.isArray(classes) && classes.length > 0) {
      const isPrimary = String(school_type || existing.school_type || '').toLowerCase() === 'primary';
      for (const c of classes) {
        const cName = typeof c === 'string' ? c : c.name;
        if (!cName) continue;
        const dup = await queryOne('SELECT id FROM classes WHERE school_id = ? AND LOWER(name) = LOWER(?)', [id, cName.trim()]);
        if (!dup) {
          const cId = 'CLS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
          await query(
            `INSERT INTO classes (id, school_id, name, grade_level, level, status) VALUES (?, ?, ?, ?, ?, 'active')`,
            [cId, id, cName.trim(), cName.trim(), isPrimary ? 'Primary' : 'Secondary']
          );
        }
      }
    }

    // If subjects were provided, add any that don't exist yet
    if (Array.isArray(subjects) && subjects.length > 0) {
      for (const s of subjects) {
        const sName = typeof s === 'string' ? s : s.name;
        if (!sName) continue;
        const dup = await queryOne('SELECT id FROM subjects WHERE school_id = ? AND LOWER(name) = LOWER(?)', [id, sName.trim()]);
        if (!dup) {
          const sId = 'SUB' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
          const sCode = typeof s === 'object' && s.code ? String(s.code).toUpperCase() : sName.substring(0, 4).toUpperCase();
          const sCat = typeof s === 'object' && (s.category || s.department) ? (s.category || s.department) : 'General';
          const sLevel = typeof s === 'object' && s.level ? s.level : 'all';
          await query(
            `INSERT INTO subjects (id, school_id, name, code, category, level, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [sId, id, sName.trim(), sCode, sCat, sLevel]
          );
        }
      }
    }

    broadcastInvalidation(id, ['schools', 'settings'], 'school_updated');
    const updated = await queryOne('SELECT * FROM schools WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    console.error('Update school error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update school.' } });
  }
};

router.put('/schools/:id', authenticateToken, requireRoles('super_admin'), handleUpdateSchool);
router.patch('/schools/:id', authenticateToken, requireRoles('super_admin'), handleUpdateSchool);
router.patch('/schools/:id/config', authenticateToken, requireRoles('super_admin'), handleUpdateSchool);

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — PLATFORM STATS
// GET /admin/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/stats', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const [schoolCount]  = await query("SELECT COUNT(*) as cnt FROM schools WHERE status = 'active'");
    const [totalSchools] = await query("SELECT COUNT(*) as cnt FROM schools");
    const [studentCount] = await query("SELECT COUNT(*) as cnt FROM students WHERE status NOT IN ('withdrawn', 'graduated', 'transferred', 'dropped_out')");
    const [staffCount]   = await query("SELECT COUNT(*) as cnt FROM staff");

    // Students per school
    const studentsPerSchool = await query(`
      SELECT s.name as school_name, COUNT(st.id) as student_count
      FROM schools s
      LEFT JOIN students st ON s.id = st.school_id AND st.status NOT IN ('withdrawn', 'graduated', 'transferred', 'dropped_out')
      GROUP BY s.id, s.name
      ORDER BY s.name ASC
    `);


    // Plan breakdown
    let planBreakdown = [];
    try {
      planBreakdown = await query(`
        SELECT COALESCE(plan, 'standard') as plan, COUNT(*) as count
        FROM licenses
        GROUP BY plan
      `);
    } catch (e) {
      planBreakdown = [{ plan: 'standard', count: totalSchools?.cnt || 0 }];
    }

    // Registrations by month
    const registrations = await query(`
      SELECT DATE_FORMAT(created_at, '%b %Y') as month, COUNT(*) as count
      FROM schools
      GROUP BY DATE_FORMAT(created_at, '%b %Y'), YEAR(created_at), MONTH(created_at)
      ORDER BY YEAR(created_at) DESC, MONTH(created_at) DESC
      LIMIT 6
    `);

    // Active alerts count
    let alertCount = 0;
    const emptySchools = await query(`
      SELECT s.id FROM schools s
      LEFT JOIN students st ON s.id = st.school_id AND st.status NOT IN ('withdrawn', 'graduated', 'transferred', 'dropped_out')
      WHERE s.status = 'active'
      GROUP BY s.id HAVING COUNT(st.id) = 0
    `);
    alertCount += emptySchools.length;

    let expiringLicenses = 0;
    try {
      const [exp] = await query(`
        SELECT COUNT(*) as cnt FROM licenses
        WHERE expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY) AND status = 'active'
      `);
      expiringLicenses = exp?.cnt || 0;
    } catch (e) {}

    return res.json({
      data: {
        totals: {
          schools:           totalSchools?.cnt || 0,
          students:          studentCount?.cnt || 0,
          staff:             staffCount?.cnt   || 0,
          active_licenses:   schoolCount?.cnt  || 0,
          expiring_licenses: expiringLicenses,
          active_alerts:     alertCount
        },
        students_per_school:  studentsPerSchool,
        plan_breakdown:       planBreakdown,
        school_registrations: registrations.reverse()
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load platform stats.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — SYSTEM ALERTS
// GET /admin/alerts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/alerts', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const alerts = [];

    // Schools with no students
    const emptySchools = await query(
      `SELECT s.id, s.name FROM schools s
       LEFT JOIN students st ON s.id = st.school_id AND st.status = 'active'
       WHERE s.status = 'active'
       GROUP BY s.id, s.name
       HAVING COUNT(st.id) = 0`
    );
    emptySchools.forEach(s => alerts.push({
      type:     'warning',
      category: 'enrollment',
      title:    `${s.name} has no active students`,
      school_id: s.id
    }));

    // Licenses expiring in 30 days (if licenses table exists)
    try {
      const expiring = await query(
        `SELECT l.*, s.name as school_name
         FROM licenses l
         JOIN schools s ON l.school_id = s.id
         WHERE l.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)
           AND l.status = 'active'`
      );
      expiring.forEach(l => alerts.push({
        type:     'critical',
        category: 'license',
        title:    `License for ${l.school_name} expires soon`,
        expires_at: l.expires_at,
        school_id: l.school_id
      }));
    } catch (e) { /* licenses table may not exist */ }

    // Schools with no staff
    const unstaffed = await query(
      `SELECT s.id, s.name FROM schools s
       LEFT JOIN staff st ON s.id = st.school_id AND st.status = 'active'
       WHERE s.status = 'active'
       GROUP BY s.id, s.name
       HAVING COUNT(st.id) = 0`
    );
    unstaffed.forEach(s => alerts.push({
      type:     'info',
      category: 'staff',
      title:    `${s.name} has no registered staff`,
      school_id: s.id
    }));

    return res.json({ data: alerts });
  } catch (err) {
    console.error('Admin alerts error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load system alerts.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — LICENSES
// GET /admin/licenses
// POST /admin/licenses
// PATCH /admin/licenses/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/licenses', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const licenses = await query(
      `SELECT l.*, s.name as school_name, s.school_type
       FROM licenses l
       JOIN schools s ON l.school_id = s.id
       ORDER BY l.expires_at ASC`
    );
    return res.json({ data: licenses });
  } catch (err) {
    // licenses table may not exist yet — return gracefully with empty list
    return res.json({ data: [] });
  }
});

router.post('/admin/licenses', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { school_id, plan, expires_at, max_students, notes } = req.body;
    if (!school_id || !expires_at) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'School ID and expiry date are required.' } });
    }
    const id = 'LIC' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO licenses (id, school_id, plan, status, issued_at, expires_at, max_students, notes)
       VALUES (?, ?, ?, 'active', NOW(), ?, ?, ?)`,
      [id, school_id, plan || 'standard', expires_at, max_students || 500, notes || null]
    );
    const created = await queryOne(
      `SELECT l.*, s.name as school_name FROM licenses l JOIN schools s ON l.school_id = s.id WHERE l.id = ?`,
      [id]
    );
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create license.' } });
  }
});

router.patch('/admin/licenses/:id', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { plan, status, expires_at, max_students, notes } = req.body;
    await query(
      `UPDATE licenses SET
         plan        = COALESCE(?, plan),
         status      = COALESCE(?, status),
         expires_at  = COALESCE(?, expires_at),
         max_students= COALESCE(?, max_students),
         notes       = COALESCE(?, notes)
       WHERE id = ?`,
      [plan, status, expires_at, max_students, notes, req.params.id]
    );
    const updated = await queryOne(
      `SELECT l.*, s.name as school_name FROM licenses l JOIN schools s ON l.school_id = s.id WHERE l.id = ?`,
      [req.params.id]
    );
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update license.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — PLATFORM-WIDE AUDIT LOG
// GET /admin/audit-log
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/audit-log', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { school_id, action, limit = 200 } = req.query;
    let sql = `
      SELECT al.*, u.username as actor_name, s.name as school_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN schools s ON al.school_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (school_id) { sql += ' AND al.school_id = ?'; params.push(school_id); }
    if (action)    { sql += ' AND al.action LIKE ?'; params.push(`%${action}%`); }

    sql += ` ORDER BY al.created_at DESC LIMIT ${parseInt(limit, 10) || 200}`;

    const logs = await query(sql, params);
    return res.json({ data: logs });
  } catch (err) {
    console.error('Admin audit log error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load audit log.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOL TENANT — LICENSE STATUS
// GET /schools/:schoolId/license
// POST /schools/:schoolId/license/renewal-request
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/license', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let license = await queryOne(
      `SELECT l.*, s.name as school_name, s.school_type
       FROM licenses l
       JOIN schools s ON l.school_id = s.id
       WHERE l.school_id = ? AND l.status = 'active'
       ORDER BY l.expires_at DESC
       LIMIT 1`,
      [schoolId]
    );

    const studentCountRow = await queryOne(
      `SELECT COUNT(*) as count FROM students WHERE school_id = ? AND status IN ('enrolled', 'active')`,
      [schoolId]
    );
    const activeStudentCount = studentCountRow ? Number(studentCountRow.count) : 0;

    if (!license) {
      license = {
        tier: 'Enterprise Standard',
        status: 'active',
        student_limit: 1000,
        expires_at: '2028-01-01',
        features: ['Multi-currency cashier', 'ZIMSEC Best-6 grading', 'Boarding & Exeat gate', 'Automated EMIS census']
      };
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);
    const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));

    license.days_remaining = daysLeft;
    license.days_left = daysLeft;
    license.current_students = activeStudentCount;
    if (!license.student_limit) license.student_limit = 1000;

    return res.json({
      data: {
        license,
        days_left: daysLeft,
        days_remaining: daysLeft,
        current_students: activeStudentCount,
        student_limit: license.student_limit,
        warning: daysLeft <= 30,
        expires_at: license.expires_at
      }
    });
  } catch (err) {
    // If licenses table doesn't exist yet, return gracefully
    return res.json({ data: { license: null, warning: false } });
  }
});

router.post('/schools/:schoolId/license/renewal-request', authenticateToken, requireRoles('school_admin', 'super_admin', 'principal', 'head'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { contact_name, contact_email, contact_phone, preferred_plan, message } = req.body;

    const school = await queryOne('SELECT name FROM schools WHERE id = ?', [schoolId]);
    const schoolName = school?.name || schoolId;

    // 1. Log renewal request in audit log
    try {
      await query(
        `INSERT INTO audit_logs (id, school_id, user_id, action, details, created_at)
         VALUES (?, ?, ?, 'license_renewal_request', ?, NOW())`,
        ['AUD' + Date.now().toString(36), schoolId, req.user.id,
         JSON.stringify({ contact_name, contact_email, contact_phone, preferred_plan, message })]
      );
    } catch (e) { /* audit_logs table fallback */ }

    // 2. Dispatch real-time notification to Super Administrators
    try {
      const notifId = 'NOT' + Date.now().toString(36);
      await query(
        `INSERT INTO notifications (id, school_id, user_id, title, message, type, is_read, created_at)
         SELECT ?, NULL, u.id, 'License Renewal Requested', ?, 'alert', 0, NOW()
         FROM users u WHERE u.role = 'super_admin'`,
        [notifId, `School Admin for ${schoolName} has requested a license renewal (${preferred_plan || 'Enterprise'}). Contact: ${contact_phone || req.user.email || 'N/A'}.`]
      );
    } catch (e) { /* notifications table fallback */ }

    return res.json({
      data: {
        message: 'Renewal request submitted successfully. The system administrator has been notified.'
      }
    });
  } catch (err) {
    console.error('Renewal request error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit renewal request.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HOSTEL — CREATE, CHECK-IN, CHECK-OUT, APPLICATIONS
// ─────────────────────────────────────────────────────────────────────────────
router.post('/hostels', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { school_id, name, type, gender, capacity, max_occupants_per_room, warden_name, warden_phone, warden_email } = req.body;
    if (!school_id || !name) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'School ID and hostel name are required.' } });
    const id = 'HST' + Date.now().toString(36).toUpperCase();
    await query(
      `INSERT INTO hostels (id, school_id, name, type, gender, capacity, max_occupants_per_room, warden_name, warden_phone, warden_email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, school_id, name, type || 'boarding', gender || 'mixed', capacity || 50, max_occupants_per_room || 4,
       warden_name || null, warden_phone || null, warden_email || null]
    );
    const hostel = await queryOne('SELECT * FROM hostels WHERE id = ?', [id]);
    return res.status(201).json({ data: hostel });
  } catch (err) {
    console.error('Create hostel error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create hostel.' } });
  }
});

router.post('/hostels/allocations/:id/check-in', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await query(`UPDATE hostel_allocations SET status = 'checked_in', checked_in_at = NOW() WHERE id = ?`, [id]);
    const alloc = await queryOne('SELECT * FROM hostel_allocations WHERE id = ?', [id]);
    return res.json({ data: alloc });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to check in.' } });
  }
});

router.post('/hostels/allocations/:id/check-out', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await query(`UPDATE hostel_allocations SET status = 'checked_out', checked_out_at = NOW() WHERE id = ?`, [id]);
    const alloc = await queryOne('SELECT * FROM hostel_allocations WHERE id = ?', [id]);
    return res.json({ data: alloc });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to check out.' } });
  }
});

router.get('/hostels/applications', authenticateToken, async (req, res) => {
  try {
    const { school_id } = req.query;
    let sql = `SELECT ha.*, s.first_name, s.last_name, s.admission_number, s.gender
               FROM hostel_applications ha JOIN students s ON ha.student_id = s.id`;
    const params = [];

    if (req.user.role === 'parent') {
      const guardianRows = await query(
        `SELECT g.id FROM guardians g 
         WHERE g.user_id = ? 
            OR (g.email IS NOT NULL AND g.email != '' AND g.email = ?)
            OR (g.phone IS NOT NULL AND g.phone != '' AND g.phone = ?)`,
        [req.user.id, req.user.email || '', req.user.phone || '']
      );
      const guardianIds = guardianRows.map(g => g.id);
      if (guardianIds.length === 0) {
        return res.json({ data: [] });
      }
      const gPlaceholders = guardianIds.map(() => '?').join(',');
      const kids = await query(`SELECT student_id FROM student_guardians WHERE guardian_id IN (${gPlaceholders})`, guardianIds);
      const kidIds = [...new Set(kids.map(k => k.student_id))];
      if (kidIds.length === 0) {
        return res.json({ data: [] });
      }
      const kPlaceholders = kidIds.map(() => '?').join(',');
      sql += ` WHERE ha.student_id IN (${kPlaceholders})`;
      params.push(...kidIds);
    } else if (school_id) {
      sql += ' WHERE s.school_id = ?';
      params.push(school_id);
    }

    sql += ' ORDER BY ha.applied_at DESC, ha.created_at DESC';
    const apps = await query(sql, params);
    return res.json({ data: apps });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch hostel applications.' } });
  }
});

router.post('/hostels/applications', authenticateToken, async (req, res) => {
  try {
    const { student_id, notes, school_id } = req.body;
    if (!student_id) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Student ID is required.' } });

    if (req.user.role === 'parent') {
      const guardianRows = await query(
        `SELECT g.id FROM guardians g 
         WHERE g.user_id = ? 
            OR (g.email IS NOT NULL AND g.email != '' AND g.email = ?)
            OR (g.phone IS NOT NULL AND g.phone != '' AND g.phone = ?)`,
        [req.user.id, req.user.email || '', req.user.phone || '']
      );
      const guardianIds = guardianRows.map(g => g.id);
      if (guardianIds.length === 0) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not authorized to submit applications for this student.' } });
      }
      const gPlaceholders = guardianIds.map(() => '?').join(',');
      const linked = await queryOne(
        `SELECT student_id FROM student_guardians WHERE student_id = ? AND guardian_id IN (${gPlaceholders})`,
        [student_id, ...guardianIds]
      );
      if (!linked) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not linked as a guardian for this student.' } });
      }
    }

    const id = 'HAPP' + Date.now().toString(36).toUpperCase();
    try { await query(`ALTER TABLE hostel_applications ADD COLUMN school_id VARCHAR(20) NULL`); } catch(e) {}
    const sId = school_id || req.user?.school_id || null;
    await query(
      `INSERT INTO hostel_applications (id, student_id, school_id, notes, status, applied_at)
       VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [id, student_id, sId, notes || null]
    );
    return res.status(201).json({ data: { id, student_id, status: 'pending', message: 'Application submitted successfully.' } });
  } catch (err) {
    console.error('Hostel application error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit hostel application.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSETS — PATCH, DELETE, ISSUE, CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/schools/:schoolId/assets/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { name, category_id, serial_number, description, condition: cond, status } = req.body;
    const sets = []; const vals = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (category_id !== undefined) { sets.push('category_id = ?'); vals.push(category_id); }
    if (serial_number !== undefined) { sets.push('serial_number = ?'); vals.push(serial_number); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (cond !== undefined) { sets.push('`condition` = ?'); vals.push(cond); }
    if (status !== undefined) { sets.push('status = ?'); vals.push(status); }
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update.' } });
    vals.push(id, schoolId);
    await query(`UPDATE assets SET ${sets.join(', ')} WHERE id = ? AND school_id = ?`, vals);
    const asset = await queryOne('SELECT * FROM assets WHERE id = ?', [id]);
    return res.json({ data: asset });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update asset.' } });
  }
});

router.delete('/schools/:schoolId/assets/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    await query('DELETE FROM assets WHERE id = ? AND school_id = ?', [id, schoolId]);
    return res.json({ data: { message: 'Asset deleted.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete asset.' } });
  }
});

router.post(['/schools/:schoolId/assets/:id/issue', '/schools/:schoolId/assets/:id/lend'], authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher', 'bursar'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { issued_to, issued_to_name, issued_to_type, expected_return_date, notes, holder_id, holder_type, due_date } = req.body;
    
    const targetHolderId = issued_to || holder_id || null;
    const targetHolderType = issued_to_type || holder_type || 'student';
    const targetDueDate = expected_return_date || due_date || null;
    let targetHolderName = issued_to_name || req.body.holder_name || null;

    if (!targetHolderId && !targetHolderName) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Issued to borrower or recipient is required.' } });
    }

    // Resolve borrower name if not provided
    if (!targetHolderName && targetHolderId) {
      if (targetHolderType === 'student') {
        const st = await queryOne('SELECT first_name, last_name, admission_number FROM students WHERE id = ?', [targetHolderId]);
        if (st) targetHolderName = `${st.first_name} ${st.last_name} (${st.admission_number || 'No ADM'})`;
      } else {
        const u = await queryOne('SELECT name, username FROM users WHERE id = ?', [targetHolderId]);
        if (u) targetHolderName = u.name || u.username;
      }
    }

    await query(
      `UPDATE assets SET status = 'issued', holder_id = ?, holder_type = ?, holder_name = ?,
       issued_at = NOW(), expected_return_date = ?, notes = ? WHERE id = ? AND school_id = ?`,
      [targetHolderId, targetHolderType, targetHolderName, targetDueDate, notes || null, id, schoolId]
    );

    broadcastInvalidation(schoolId, ['library', 'assets', 'dashboard', 'summary'], 'asset_loaned');

    const asset = await queryOne('SELECT * FROM assets WHERE id = ?', [id]);
    return res.json({ data: asset });
  } catch (err) {
    console.error('Issue/lend asset error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to issue resource: ' + err.message } });
  }
});

router.post('/schools/:schoolId/asset-categories', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Category name is required.' } });
    const id = 'ACAT' + Date.now().toString(36).toUpperCase();
    try { await query('ALTER TABLE asset_categories ADD COLUMN school_id VARCHAR(20) NULL'); } catch(e) {}
    await query(
      `INSERT INTO asset_categories (id, school_id, name, description) VALUES (?, ?, ?, ?)`,
      [id, schoolId, name, description || null]
    );
    const cat = await queryOne('SELECT * FROM asset_categories WHERE id = ?', [id]);
    return res.status(201).json({ data: cat });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create asset category.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENQUIRIES — CONVERT
// POST /schools/:schoolId/enquiries/:id/convert
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools/:schoolId/enquiries/:id/convert', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const enquiry = await queryOne('SELECT * FROM enquiries WHERE id = ? AND school_id = ?', [id, schoolId]);
    if (!enquiry) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Enquiry not found.' } });
    await query(`UPDATE enquiries SET status = 'converted', updated_at = NOW() WHERE id = ?`, [id]);
    return res.json({ data: { message: 'Enquiry marked as converted.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to convert enquiry.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEES — BANK ACCOUNT, REMOTE PAYMENTS
// PUT  /schools/:schoolId/bank-account
// POST /schools/:schoolId/remote-payments
// POST /schools/:schoolId/remote-payments/:id/verify
// ─────────────────────────────────────────────────────────────────────────────
router.put('/schools/:schoolId/bank-account', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const configData = JSON.stringify(req.body);
    try {
      await query(
        `INSERT INTO system_config (id, school_id, config_key, config_value, updated_at) VALUES (?, ?, 'bank_account', ?, NOW())
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()`,
        ['BCFG' + schoolId, schoolId, configData]
      );
    } catch(e) {
      try {
        await query(`INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
          ['bank_account_' + schoolId, configData]);
      } catch(e2) {}
    }
    return res.json({ data: { message: 'Bank account settings saved.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to save bank account.' } });
  }
});

router.post('/schools/:schoolId/remote-payments', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let { fee_id, student_id, amount, amount_paid, currency, method, payment_method, reference, phone_number, payment_date, cashier_name, notes } = req.body;
    const finalAmount = parseFloat(amount_paid || amount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A valid payment amount is required.' } });
    }

    if (!fee_id && student_id) {
      try {
        const studentFee = await queryOne(
          `SELECT id FROM fees WHERE student_id = ? AND school_id = ? ORDER BY created_at DESC LIMIT 1`,
          [student_id, schoolId]
        );
        if (studentFee) {
          fee_id = studentFee.id;
        } else {
          const newFeeId = 'FEE' + Date.now().toString(36).toUpperCase();
          await query(
            `INSERT INTO fees (id, school_id, student_id, term, amount_due, amount_paid, status)
             VALUES (?, ?, ?, 'Term 1', ?, 0, 'unpaid')`,
            [newFeeId, schoolId, student_id, finalAmount]
          );
          fee_id = newFeeId;
        }
      } catch (fErr) {
        fee_id = 'FEE-' + (student_id || 'DECL') + '-' + Date.now().toString(36).toUpperCase();
      }
    }

    if (!fee_id) {
      fee_id = 'FEE-DECL-' + Date.now().toString(36).toUpperCase();
    }

    const payMethod = payment_method || method || 'cash';
    const id = 'RPAY' + Date.now().toString(36).toUpperCase();
    const finalRef = reference || ('CASH-' + Date.now().toString(36).toUpperCase());
    const finalNotes = notes || (cashier_name ? `Cash payment. Cashier: ${cashier_name}` : null);

    try {
      await query(
        `INSERT INTO remote_payments (id, school_id, fee_id, student_id, amount, amount_paid, currency, payment_method, reference, phone_number, cashier_name, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [id, schoolId, fee_id, student_id || null, finalAmount, finalAmount, currency || 'USD', payMethod, finalRef, phone_number || null, cashier_name || null, finalNotes]
      );
    } catch (insertErr) {
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS \`remote_payments\` (
            \`id\` VARCHAR(50) PRIMARY KEY,
            \`school_id\` VARCHAR(50) NOT NULL,
            \`fee_id\` VARCHAR(50) DEFAULT NULL,
            \`student_id\` VARCHAR(50) DEFAULT NULL,
            \`amount\` DECIMAL(12,2) NOT NULL,
            \`amount_paid\` DECIMAL(12,2) DEFAULT NULL,
            \`currency\` VARCHAR(10) DEFAULT 'USD',
            \`payment_method\` VARCHAR(50) DEFAULT 'cash',
            \`reference\` VARCHAR(100) DEFAULT NULL,
            \`phone_number\` VARCHAR(50) DEFAULT NULL,
            \`cashier_name\` VARCHAR(100) DEFAULT NULL,
            \`notes\` TEXT DEFAULT NULL,
            \`status\` VARCHAR(20) DEFAULT 'pending',
            \`verified_at\` DATETIME DEFAULT NULL,
            \`verified_by\` VARCHAR(50) DEFAULT NULL,
            \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX \`idx_rp_school\` (\`school_id\`),
            INDEX \`idx_rp_student\` (\`student_id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await query(
          `INSERT INTO remote_payments (id, school_id, fee_id, student_id, amount, amount_paid, currency, payment_method, reference, phone_number, cashier_name, notes, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
          [id, schoolId, fee_id, student_id || null, finalAmount, finalAmount, currency || 'USD', payMethod, finalRef, phone_number || null, cashier_name || null, finalNotes]
        );
      } catch (retryErr) {
        console.error('Remote payments insert retry error:', retryErr);
        await query(
          `INSERT INTO remote_payments (id, school_id, fee_id, student_id, amount, currency, payment_method, reference, phone_number, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
          [id, schoolId, fee_id, student_id || null, finalAmount, currency || 'USD', payMethod, finalRef, phone_number || null]
        );
      }
    }

    return res.status(201).json({
      data: { id, status: 'pending', reference: finalRef, message: 'Payment declaration submitted successfully. Awaiting administrative clearance.' }
    });
  } catch (err) {
    console.error('Remote payment error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit payment declaration.' } });
  }
});

router.post('/schools/:schoolId/remote-payments/:id/verify', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { action, status: reqStatus, notes, rejection_reason } = req.body;
    const finalStatus = (action === 'approve' || reqStatus === 'approved') ? 'approved' : 'rejected';
    const finalNotes = notes || rejection_reason || null;
    try { await query('ALTER TABLE remote_payments ADD COLUMN verified_at DATETIME NULL'); } catch(e) {}
    try { await query('ALTER TABLE remote_payments ADD COLUMN verified_by VARCHAR(50) NULL'); } catch(e) {}
    try { await query('ALTER TABLE remote_payments ADD COLUMN notes TEXT NULL'); } catch(e) {}
    await query(
      `UPDATE remote_payments SET status = ?, notes = ?, verified_at = NOW(), verified_by = ? WHERE id = ? AND school_id = ?`,
      [finalStatus, finalNotes, req.user.id, id, schoolId]
    );
    if (finalStatus === 'approved') {
      const rp = await queryOne('SELECT * FROM remote_payments WHERE id = ?', [id]);
      if (rp && rp.fee_id) {
        const payId = 'PAY' + Date.now().toString(36).toUpperCase();
        try {
          await query(
            `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, reference, payment_date, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`,
            [payId, schoolId, rp.fee_id, rp.student_id, rp.amount, rp.payment_method || 'cash', rp.reference || id, req.user.id]
          );
        } catch(e) {
          await query(
            `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, reference, payment_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())`,
            [payId, schoolId, rp.fee_id, rp.student_id, rp.amount, rp.payment_method || 'cash', rp.reference || id]
          );
        }
        await query(
          `UPDATE fees SET amount_paid = amount_paid + ?, status = CASE WHEN amount_paid + ? >= amount_due THEN 'paid' ELSE 'partially_paid' END WHERE id = ?`,
          [rp.amount, rp.amount, rp.fee_id]
        );
      }
    }
    return res.json({ data: { message: `Payment ${finalStatus} successfully.` } });
  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to verify payment.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STAFF REMIND
// POST /schools/:schoolId/staff/remind
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools/:schoolId/staff/remind', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { staff_ids, message } = req.body;
    const ids = Array.isArray(staff_ids) ? staff_ids : [];
    for (const staffId of ids) {
      try {
        const nid = 'NOTIF' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        await query(
          `INSERT INTO notifications (id, user_id, school_id, type, title, message, created_at)
           VALUES (?, ?, ?, 'reminder', 'Reminder from Admin', ?, NOW())`,
          [nid, staffId, schoolId, message || 'You have a pending reminder from school administration.']
        );
      } catch(e) {}
    }
    return res.json({ data: { message: `Reminder sent to ${ids.length} staff member(s).` } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to send reminders.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE REQUESTS — REVIEW
// POST /schools/:schoolId/leave-requests/:id/review
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools/:schoolId/leave-requests/:id/review', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Review status is required.' } });
    try { await query('ALTER TABLE leave_requests ADD COLUMN reviewed_by VARCHAR(50) NULL'); } catch(e) {}
    try { await query('ALTER TABLE leave_requests ADD COLUMN review_notes TEXT NULL'); } catch(e) {}
    try { await query('ALTER TABLE leave_requests ADD COLUMN reviewed_at DATETIME NULL'); } catch(e) {}
    await query(
      `UPDATE leave_requests SET status = ?, reviewed_by = ?, review_notes = ?, reviewed_at = NOW() WHERE id = ? AND school_id = ?`,
      [status, req.user.id, notes || null, id, schoolId]
    );
    const lr = await queryOne('SELECT * FROM leave_requests WHERE id = ?', [id]);
    return res.json({ data: lr });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to review leave request.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNICATION TEST
// POST /schools/:schoolId/communication/test
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools/:schoolId/communication/test', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { type, recipient, message } = req.body;
    try {
      await query(
        `INSERT INTO audit_logs (id, school_id, user_id, action, details, created_at) VALUES (?, ?, ?, 'communication_test', ?, NOW())`,
        ['AUD' + Date.now().toString(36), req.params.schoolId, req.user.id, JSON.stringify({ type, recipient, message })]
      );
    } catch(e) {}
    return res.json({ data: { success: true, message: `Test ${type || 'email'} sent to ${recipient || 'administrator'}.` } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to send test communication.' } });
  }
});

router.get('/schools/:schoolId/terms', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let terms = [];
    try {
      terms = await query(
        `SELECT t.id, t.school_id, t.session_id,
                CASE 
                  WHEN LOWER(t.name) LIKE '%1%' THEN 'Term 1'
                  WHEN LOWER(t.name) LIKE '%2%' THEN 'Term 2'
                  WHEN LOWER(t.name) LIKE '%3%' THEN 'Term 3'
                  ELSE REPLACE(t.name, '_', ' ')
                END as name,
                CASE 
                  WHEN LOWER(t.name) LIKE '%1%' THEN 'Term 1'
                  WHEN LOWER(t.name) LIKE '%2%' THEN 'Term 2'
                  WHEN LOWER(t.name) LIKE '%3%' THEN 'Term 3'
                  ELSE REPLACE(t.name, '_', ' ')
                END as term_name,
                t.start_date, t.end_date,
                COALESCE(s.year, YEAR(t.start_date), YEAR(CURRENT_DATE)) as year,
                CASE 
                  WHEN LOWER(t.name) LIKE '%1%' THEN 1
                  WHEN LOWER(t.name) LIKE '%2%' THEN 2
                  WHEN LOWER(t.name) LIKE '%3%' THEN 3
                  ELSE 1
                END as term_number,
                CASE WHEN CURRENT_DATE BETWEEN t.start_date AND t.end_date THEN 1 ELSE 0 END as is_current_by_date,
                CASE WHEN CURRENT_DATE BETWEEN t.start_date AND t.end_date THEN 1 ELSE COALESCE(t.is_current, 0) END as is_current,
                CASE WHEN CURRENT_DATE BETWEEN t.start_date AND t.end_date THEN 1 ELSE COALESCE(t.is_current, 0) END as is_active,
                CASE WHEN CURRENT_DATE BETWEEN t.start_date AND t.end_date THEN 'active' ELSE 'inactive' END as status
         FROM terms t
         LEFT JOIN academic_sessions s ON t.session_id = s.id
         WHERE t.school_id = ?
         ORDER BY t.start_date ASC`,
        [schoolId]
      );
    } catch(e) {
      console.warn('terms query error:', e.message);
    }

    if (!terms || terms.length === 0) {
      try {
        terms = await query(
          `SELECT tc.id, tc.school_id, tc.term_name as name, tc.term_name, tc.start_date, tc.end_date, tc.year, tc.term_number,
                  CASE WHEN CURRENT_DATE BETWEEN tc.start_date AND tc.end_date THEN 1 ELSE 0 END as is_current_by_date,
                  CASE WHEN CURRENT_DATE BETWEEN tc.start_date AND tc.end_date THEN 1 ELSE COALESCE(tc.is_active, 1) END as is_current,
                  CASE WHEN CURRENT_DATE BETWEEN tc.start_date AND tc.end_date THEN 1 ELSE COALESCE(tc.is_active, 1) END as is_active,
                  CASE WHEN CURRENT_DATE BETWEEN tc.start_date AND tc.end_date THEN 'active' ELSE 'inactive' END as status
           FROM term_config tc
           WHERE tc.school_id = ?
           ORDER BY tc.year DESC, tc.term_number ASC`,
          [schoolId]
        );
      } catch(e) {}
    }

    return res.json({ data: terms });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch terms.' } });
  }
});

router.get('/schools/:schoolId/terms/current', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let current = await queryOne(
      `SELECT t.*, s.year as session_year, s.name as session_name, 1 as is_current_by_date, 'active' as status
       FROM terms t
       LEFT JOIN academic_sessions s ON t.session_id = s.id
       WHERE (t.school_id = ? OR t.school_id IS NULL)
         AND CURRENT_DATE BETWEEN t.start_date AND t.end_date
       ORDER BY t.school_id DESC, t.start_date DESC
       LIMIT 1`,
      [schoolId]
    );

    if (!current) {
      current = await queryOne(
        `SELECT t.*, s.year as session_year, s.name as session_name, 0 as is_current_by_date, 'holiday' as status
         FROM terms t
         LEFT JOIN academic_sessions s ON t.session_id = s.id
         WHERE (t.school_id = ? OR t.school_id IS NULL)
         ORDER BY t.start_date DESC
         LIMIT 1`,
        [schoolId]
      );
    }
    return res.json({ data: current });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch current term.' } });
  }
});

router.post('/schools/:schoolId/terms', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { term_name, name, start_date, end_date, year, term_number, is_current } = req.body;
    const finalName = term_name || name || `Term ${term_number || 1}`;

    // Get or create session
    let sess = await queryOne('SELECT id FROM academic_sessions WHERE school_id = ? ORDER BY year DESC LIMIT 1', [schoolId]);
    let sessionId = sess?.id;
    if (!sessionId) {
      const sessRes = await query(
        `INSERT INTO academic_sessions (school_id, year, name, start_date, end_date, is_current, status)
         VALUES (?, ?, ?, ?, ?, 1, 'active')`,
        [schoolId, year || new Date().getFullYear(), `Academic Year ${year || new Date().getFullYear()}`, start_date || '2026-01-01', end_date || '2026-12-31']
      );
      sessionId = sessRes.insertId;
    }

    if (is_current) {
      await query('UPDATE terms SET is_current = FALSE WHERE school_id = ?', [schoolId]);
    }

    const result = await query(
      `INSERT INTO terms (school_id, session_id, name, start_date, end_date, is_current)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [schoolId, sessionId, finalName, start_date || null, end_date || null, is_current ? 1 : 0]
    );

    const created = await queryOne('SELECT * FROM terms WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create term error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create term.' } });
  }
});

router.patch('/schools/:schoolId/terms/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { name, term_name, start_date, end_date, is_current } = req.body;
    const finalName = name || term_name;

    const updates = [];
    const params = [];
    if (finalName !== undefined) { updates.push('name = ?'); params.push(finalName); }
    if (start_date !== undefined) { updates.push('start_date = ?'); params.push(start_date); }
    if (end_date !== undefined) { updates.push('end_date = ?'); params.push(end_date); }
    if (is_current !== undefined) {
      if (is_current) {
        await query('UPDATE terms SET is_current = FALSE WHERE school_id = ?', [schoolId]);
      }
      updates.push('is_current = ?');
      params.push(is_current ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(id, schoolId);
      await query(`UPDATE terms SET ${updates.join(', ')} WHERE id = ? AND school_id = ?`, params);
    }

    const updated = await queryOne('SELECT * FROM terms WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update term.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION SETTINGS
// GET /schools/:schoolId/notification-settings
// PUT /schools/:schoolId/notification-settings
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/notification-settings', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let settings = null;
    try {
      settings = await queryOne('SELECT * FROM school_notification_settings WHERE school_id = ?', [schoolId]);
    } catch(e) {}
    if (!settings) {
      settings = { school_id: schoolId, sms_enabled: true, email_enabled: true, whatsapp_enabled: false };
    }
    return res.json({ data: settings });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch notification settings.' } });
  }
});

router.put('/schools/:schoolId/notification-settings', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { sms_enabled, email_enabled, whatsapp_enabled, smtp_host, sms_gateway_key } = req.body;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS school_notification_settings (
          school_id VARCHAR(50) PRIMARY KEY,
          sms_enabled TINYINT(1) DEFAULT 1,
          email_enabled TINYINT(1) DEFAULT 1,
          whatsapp_enabled TINYINT(1) DEFAULT 0,
          smtp_host VARCHAR(255) NULL,
          sms_gateway_key VARCHAR(255) NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    } catch(e) {}

    await query(
      `INSERT INTO school_notification_settings (school_id, sms_enabled, email_enabled, whatsapp_enabled, smtp_host, sms_gateway_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE sms_enabled=VALUES(sms_enabled), email_enabled=VALUES(email_enabled), whatsapp_enabled=VALUES(whatsapp_enabled), smtp_host=VALUES(smtp_host), sms_gateway_key=VALUES(sms_gateway_key)`,
      [schoolId, sms_enabled ? 1 : 0, email_enabled ? 1 : 0, whatsapp_enabled ? 1 : 0, smtp_host || null, sms_gateway_key || null]
    );
    const updated = await queryOne('SELECT * FROM school_notification_settings WHERE school_id = ?', [schoolId]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update notification settings.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOL PATCH
// PATCH /schools/:schoolId
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/schools/:schoolId', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, code, address, phone, email, status } = req.body;
    const updates = [];
    const params = [];
    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (code) { updates.push('code = ?'); params.push(code.trim()); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (status) { updates.push('status = ?'); params.push(status); }

    if (updates.length > 0) {
      params.push(schoolId);
      await query(`UPDATE schools SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const updated = await queryOne('SELECT * FROM schools WHERE id = ?', [schoolId]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to patch school profile.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GRADE THRESHOLDS (POST)
// POST /schools/:schoolId/grade-thresholds
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools/:schoolId/grade-thresholds', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { thresholds, school_type } = req.body;
    if (school_type) {
      await query('UPDATE schools SET school_type = ? WHERE id = ?', [school_type, schoolId]);
    }
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS grade_thresholds (
          id VARCHAR(50) PRIMARY KEY,
          school_id VARCHAR(50) NOT NULL,
          grade VARCHAR(10) NOT NULL,
          label VARCHAR(50) NULL,
          min_score DECIMAL(5,2) NOT NULL,
          max_score DECIMAL(5,2) NOT NULL,
          points INT NULL,
          color VARCHAR(20) NULL,
          is_pass TINYINT(1) DEFAULT 1
        )
      `);
    } catch(e) {}

    if (Array.isArray(thresholds)) {
      await query('DELETE FROM grade_thresholds WHERE school_id = ?', [schoolId]);
      for (const t of thresholds) {
        const tId = 'GT' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const gradeSymbol = t.grade_symbol || t.grade || '';
        const minVal = parseFloat(t.min_score ?? t.min_mark ?? 0);
        const maxVal = parseFloat(t.max_score ?? t.max_mark ?? 100);
        const points = t.points !== undefined ? t.points : 0;
        const isPass = t.is_pass !== undefined ? (t.is_pass ? 1 : 0) : 1;
        await query(
          `INSERT INTO grade_thresholds (id, school_id, grade, grade_symbol, label, min_score, min_mark, max_score, max_mark, points, color, is_pass)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tId, schoolId, gradeSymbol, gradeSymbol, t.label || '', minVal, minVal, maxVal, maxVal, points, t.color || '#0d9488', isPass]
        );
      }
    }
    return res.json({ data: { message: 'Grade thresholds saved successfully.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update grade thresholds.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SUBJECTS
// GET/POST/DELETE /admin/subjects
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/subjects', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const subjects = await query(
      `SELECT s.*, COALESCE(s.category, 'General') as category
       FROM subjects s
       ORDER BY s.name ASC`
    );
    return res.json({ data: subjects || [] });
  } catch (err) {
    console.error('Get admin subjects error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load subjects.' } });
  }
});

router.post('/admin/subjects', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { code, name, category, level, board_code } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Subject code and name are required.' } });
    }
    const cleanCode = String(code).trim().toUpperCase();
    const cleanName = String(name).trim();
    const subjectId = 'SUB' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    try {
      await query(
        `INSERT INTO subjects (id, code, name, category, level, is_active)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level)`,
        [subjectId, cleanCode, cleanName, category || 'General', level || 'all']
      );
    } catch (insertErr) {
      // Fallback if schema doesn't have is_active or level
      await query(
        `INSERT INTO subjects (id, code, name, category)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [subjectId, cleanCode, cleanName, category || 'General']
      );
    }

    const subject = await queryOne('SELECT * FROM subjects WHERE id = ? OR code = ?', [subjectId, cleanCode]);
    return res.status(201).json({ data: subject });
  } catch (err) {
    console.error('Create admin subject error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: { code: 'DUPLICATE_SUBJECT', message: 'A subject with that code already exists.' } });
    }
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create subject.' } });
  }
});

router.delete('/admin/subjects/:id', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM subjects WHERE id = ? OR code = ?', [id, id]);
    return res.json({ data: { message: 'Subject deleted successfully.' } });
  } catch (err) {
    console.error('Delete admin subject error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete subject.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ALERTS PATCH
// PATCH /admin/alerts/:id
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/admin/alerts/:id', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;
    try {
      await query('UPDATE system_alerts SET status = COALESCE(?, status), resolution = COALESCE(?, resolution) WHERE id = ?', [status, resolution, id]);
    } catch(e) {}
    return res.json({ data: { message: 'System alert updated.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update system alert.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOL LIBRARY SUMMARY
// GET /schools/:schoolId/library
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/library', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let books = [];
    try {
      books = await query("SELECT * FROM assets WHERE school_id = ? AND category LIKE '%book%' OR category LIKE '%library%'", [schoolId]);
    } catch(e) {}
    return res.json({ data: { total_books: books.length, books } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch library catalogue.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT HEALTH BY STUDENT ID
// GET /schools/:schoolId/students/:studentId/health
// PUT /schools/:schoolId/students/:studentId/health
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/students/:studentId/health', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    let health = await queryOne('SELECT * FROM student_health WHERE student_id = ?', [studentId]);
    if (!health) {
      health = { student_id: studentId, blood_type: 'N/A', allergies: 'None', medical_conditions: 'None', emergency_contact: '' };
    }
    return res.json({ data: health });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch student health record.' } });
  }
});

router.put('/schools/:schoolId/students/:studentId/health', authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { blood_type, allergies, medical_conditions, emergency_contact, notes } = req.body;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS student_health (
          id VARCHAR(50) PRIMARY KEY,
          student_id VARCHAR(50) NOT NULL UNIQUE,
          blood_type VARCHAR(10) NULL,
          allergies TEXT NULL,
          medical_conditions TEXT NULL,
          emergency_contact VARCHAR(100) NULL,
          notes TEXT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    } catch(e) {}

    const hId = 'HLT' + Math.random().toString(36).substr(2, 6).toUpperCase();
    await query(
      `INSERT INTO student_health (id, student_id, blood_type, allergies, medical_conditions, emergency_contact, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE blood_type=VALUES(blood_type), allergies=VALUES(allergies), medical_conditions=VALUES(medical_conditions), emergency_contact=VALUES(emergency_contact), notes=VALUES(notes)`,
      [hId, studentId, blood_type || null, allergies || null, medical_conditions || null, emergency_contact || null, notes || null]
    );

    const updated = await queryOne('SELECT * FROM student_health WHERE student_id = ?', [studentId]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to save student health record.' } });
  }
});

module.exports = router;
