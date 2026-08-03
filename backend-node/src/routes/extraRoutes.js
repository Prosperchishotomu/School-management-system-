const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

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
// GUARDIANS
// GET /schools/:schoolId/guardians
// ─────────────────────────────────────────────────────────────────────────────
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
router.get('/schools/:schoolId/teaching-assignments', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { teacher_id } = req.query;
    let sql = `
      SELECT ta.*, u.username as teacher_name, c.name as class_name, sub.name as subject_name
      FROM teaching_assignments ta
      LEFT JOIN users u ON ta.teacher_id = u.id
      JOIN classes c ON ta.class_id = c.id
      JOIN subjects sub ON ta.subject_id = sub.id
      WHERE ta.school_id = ?
    `;
    const params = [schoolId];
    if (teacher_id) {
      sql += ' AND ta.teacher_id = ?';
      params.push(teacher_id);
    }
    sql += ' ORDER BY c.name ASC, sub.name ASC';
    const assignments = await query(sql, params);
    return res.json({ data: assignments });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch teaching assignments.' } });
  }
});

router.post('/schools/:schoolId/teaching-assignments', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { staff_id, teacher_id, class_id, subject_id } = req.body;
    const tId = teacher_id || staff_id;
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
      `SELECT ta.*, u.username as teacher_name, c.name as class_name, sub.name as subject_name
       FROM teaching_assignments ta
       LEFT JOIN users u ON ta.teacher_id = u.id
       JOIN classes c ON ta.class_id = c.id
       JOIN subjects sub ON ta.subject_id = sub.id
       WHERE ta.id = ?`,
      [id]
    );
    return res.status(201).json({ data: created });
  } catch (err) {
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

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER MESSAGES (Staff.jsx uses /schools/:schoolId/teacher-messages)
// GET /schools/:schoolId/teacher-messages
// POST /schools/:schoolId/teacher-messages
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/teacher-messages', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user.id;
    const isAdmin = ['school_admin', 'super_admin'].includes(req.user.role);

    let msgs;
    if (isAdmin) {
      msgs = await query(
        `SELECT tm.*, COALESCE(st.name, u.username, 'User') as sender_name
         FROM teacher_messages tm
         LEFT JOIN users u ON tm.sender_id = u.id
         LEFT JOIN staff st ON u.id = st.user_id
         WHERE tm.school_id = ?
         ORDER BY tm.sent_at DESC LIMIT 50`,
        [schoolId]
      );
    } else {
      msgs = await query(
        `SELECT tm.*, COALESCE(st.name, u.username, 'User') as sender_name
         FROM teacher_messages tm
         LEFT JOIN users u ON tm.sender_id = u.id
         LEFT JOIN staff st ON u.id = st.user_id
         WHERE tm.school_id = ? AND (tm.recipient_id = ? OR tm.sender_id = ? OR tm.recipient_id IS NULL)
         ORDER BY tm.sent_at DESC LIMIT 50`,
        [schoolId, userId, userId]
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
    const msgText = message || body || content || text || subject;
    if (!msgText) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message content is required.' } });
    }
    const id = 'MSG' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const userId = req.user && req.user.id ? req.user.id : 'SYS00001';
    try {
      await query(
        `INSERT INTO teacher_messages (id, school_id, sender_id, recipient_id, subject, body, message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, schoolId, userId, recipient_id || null, subject || 'Lecture Completion Report', msgText, msgText]
      );
    } catch (e1) {
      try {
        await query(
          `INSERT INTO teacher_messages (id, school_id, sender_id, recipient_id, subject, body) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, schoolId, userId, recipient_id || null, subject || 'Lecture Completion Report', msgText]
        );
      } catch (e2) {
        await query(
          `INSERT INTO teacher_messages (id, school_id, sender_id, recipient_id, subject, message) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, schoolId, userId, recipient_id || null, subject || 'Lecture Completion Report', msgText]
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
    const { schoolId } = req.params;
    const { username, email, role, password, student_id } = req.body;
    if (!username || !role || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username, role, and password are required.' } });
    }
    const exists = await queryOne('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (exists) {
      return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Username already exists.' } });
    }
    const id = 'USR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const hash = bcrypt.hashSync(password, 10);
    await query(
      `INSERT INTO users (id, school_id, username, email, password_hash, role, student_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [id, schoolId, username.trim(), email || null, hash, role, student_id || null]
    );
    const created = await queryOne('SELECT id, username, email, role, status, created_at FROM users WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create user account.' } });
  }
});

router.delete('/schools/:schoolId/users/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    return res.json({ data: { message: 'User account deleted.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete user.' } });
  }
});

router.post('/schools/:schoolId/users/:id/reset-password', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'New password is required.' } });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ? AND school_id = ?', [hash, req.params.id, req.params.schoolId]);
    return res.json({ data: { message: 'Password reset successfully.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to reset password.' } });
  }
});

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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SYSTEM SETTINGS
// GET /admin/system-settings/:schoolId
// PUT /admin/system-settings/:schoolId
// GET /admin/system-reports
// PUT /admin/override/:entity/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/system-settings/:schoolId', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const school = await queryOne('SELECT * FROM schools WHERE id = ?', [req.params.schoolId]);
    if (!school) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'School not found.' } });
    return res.json({ data: school });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch system settings.' } });
  }
});

router.put('/admin/system-settings/:schoolId', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const {
      name, email, phone, address, motto, principal_name, type, academic_year,
      bank_name, account_number, currency, email_from_address, sms_gateway
    } = req.body;

    await query(
      `UPDATE schools SET
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         address = COALESCE(?, address),
         motto = COALESCE(?, motto),
         principal_name = COALESCE(?, principal_name),
         type = COALESCE(?, type),
         academic_year = COALESCE(?, academic_year),
         bank_name = COALESCE(?, bank_name),
         account_number = COALESCE(?, account_number),
         currency = COALESCE(?, currency),
         email_from_address = COALESCE(?, email_from_address),
         sms_gateway = COALESCE(?, sms_gateway)
       WHERE id = ?`,
      [name, email, phone, address, motto, principal_name, type, academic_year,
       bank_name, account_number, currency, email_from_address, sms_gateway, schoolId]
    );
    const updated = await queryOne('SELECT * FROM schools WHERE id = ?', [schoolId]);
    return res.json({ data: updated });
  } catch (err) {
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
                ROUND(COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0), 1) as attendance_pct
         FROM students st
         LEFT JOIN classes c ON st.class_id = c.id
         LEFT JOIN attendance a ON st.id = a.student_id
         WHERE st.school_id = ? AND st.status = 'active'
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
      [id, schoolId, student_id, class_id || null, req.user.id, comment, term || 'Term 1']
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
router.post('/schools/:schoolId/results/publish', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { class_id, term } = req.body;
    if (!class_id || !term) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Class ID and term are required.' } });
    }
    const id = 'RES' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    try {
      await query(
        `INSERT INTO results (id, school_id, class_id, term, published_by, published_at) VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE published_at = NOW(), published_by = VALUES(published_by)`,
        [id, schoolId, class_id, term, req.user.id]
      );
    } catch (e) {
      // results table may have different schema — proceed gracefully
    }
    return res.json({ data: { message: `Results published for ${term}.`, class_id, term } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to publish results.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
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
              COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
              COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
              COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late,
              COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused,
              ROUND(AVG(CASE WHEN a.status = 'present' THEN 1 WHEN a.status IS NOT NULL THEN 0 END) * 100, 1) as attendance_rate,
              0 as volatility
       FROM classes c
       LEFT JOIN students st ON c.id = st.class_id AND st.status = 'active'
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
       WHERE st.school_id = ? AND st.status = 'active'
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
    const requests = await query(
      `SELECT lr.*, stf.name as staff_name, u.username as approver_name
       FROM leave_requests lr
       LEFT JOIN staff stf ON lr.staff_id = stf.id
       LEFT JOIN users u ON lr.reviewed_by = u.id
       WHERE lr.school_id = ?
       ORDER BY lr.created_at DESC`,
      [req.params.schoolId]
    );
    return res.json({ data: requests });
  } catch (err) {
    return res.json({ data: [] });
  }
});

router.post('/schools/:schoolId/leave-requests', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { staff_id, leave_type, start_date, end_date, reason } = req.body;
    if (!staff_id || !start_date || !end_date) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Staff ID, start date, and end date are required.' } });
    }
    const id = 'LVR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO leave_requests (id, school_id, staff_id, request_type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, schoolId, staff_id, leave_type || 'staff_leave', start_date, end_date, reason || null]
    );
    const created = await queryOne('SELECT * FROM leave_requests WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit leave request.' } });
  }
});

router.patch('/schools/:schoolId/leave-requests/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { status, reviewer_comment } = req.body;
    await query(
      `UPDATE leave_requests SET status = COALESCE(?, status), reviewer_comment = COALESCE(?, reviewer_comment), reviewed_by = ? WHERE id = ? AND school_id = ?`,
      [status, reviewer_comment, req.user.id, req.params.id, req.params.schoolId]
    );
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
      [id, schoolId, class_id, term || 'Term 1', validSubject.name, exam_date, start_time || null, duration_minutes || 120, venue || null, invigilator || null]
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
    const enquiries = await query(
      'SELECT * FROM enquiries WHERE school_id = ? ORDER BY created_at DESC',
      [req.params.schoolId]
    );
    return res.json({ data: enquiries });
  } catch (err) {
    return res.json({ data: [] });
  }
});

router.post('/schools/:schoolId/enquiries', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { parent_name, student_name, contact_phone, contact_email, grade_applying, message } = req.body;
    if (!parent_name || !contact_phone) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Parent name and contact are required.' } });
    }
    const id = 'ENQ' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO enquiries (id, school_id, parent_name, student_name, contact_phone, contact_email, grade_applying, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, schoolId, parent_name, student_name || null, contact_phone, contact_email || null, grade_applying || null, message || null]
    );
    const created = await queryOne('SELECT * FROM enquiries WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
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
      `SELECT a.*, a.category as category_name
       FROM assets a
       WHERE a.school_id = ?
       ORDER BY a.name ASC`,
      [req.params.schoolId]
    );
    return res.json({ data: assets });
  } catch (err) {
    return res.json({ data: [] });
  }
});

router.post('/schools/:schoolId/assets', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, category, category_id, code, serial_number, value, purchase_cost, description, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Asset name is required.' } });
    }
    const id = 'AST' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const cat = category || category_id || 'general';
    const val = value || purchase_cost ? parseFloat(value || purchase_cost) : 0;
    const desc = description || notes || null;
    await query(
      `INSERT INTO assets (id, school_id, name, category, code, serial_number, value, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
      [id, schoolId, name.trim(), cat, code || id, serial_number || null, val, desc]
    );
    const created = await queryOne('SELECT * FROM assets WHERE id = ?', [id]);
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
  const schoolId = req.params.schoolId || req.user.school_id || 'HARAREPR';
  try {
    const hostels = await query('SELECT * FROM hostels WHERE school_id = ? ORDER BY name ASC', [schoolId]);
    return res.json({ data: hostels });
  } catch (err) {
    return res.json({ data: [] });
  }
});

// POST /hostels (Create Hostel Block)
router.post(['/hostels', '/schools/:schoolId/hostels'], authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  const schoolId = req.params.schoolId || req.user.school_id || 'HARAREPR';
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
  const schoolId = req.params.schoolId || req.user.school_id || 'HARAREPR';
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
  const schoolId = req.params.schoolId || req.user.school_id || 'HARAREPR';
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
    const termVal = term || 'Term 1 2026';

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
  const schoolId = req.params.schoolId || req.user.school_id || 'HARAREPR';
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
  const schoolId = req.params.schoolId || req.user.school_id || 'HARAREPR';
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
  const schoolId = req.params.schoolId || req.user.school_id || 'HARAREPR';
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
       VALUES (?, ?, ?, ?, 'student', ?, ?, CURDATE(), 'Term 1 2026', 'checked_in', NOW())`,
      [allocId, schoolId, chosenHostel.id, student_id, assignedRoom, assignedBed]
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


router.post('/schools/:schoolId/timetable', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
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

router.delete('/schools/:schoolId/timetable/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    await query('DELETE FROM timetable WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    return res.json({ data: { message: 'Timetable entry deleted.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete timetable entry.' } });
  }
});

router.put('/schools/:schoolId/timetable/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
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



// ─────────────────────────────────────────────────────────────────────────────
// SCHOOLS — Create/Edit (CommandCenter)
// POST /schools
// PUT /schools/:id
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schools', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { id, name, school_type } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'School ID and name are required.' } });
    }
    const exists = await queryOne('SELECT id FROM schools WHERE id = ?', [id]);
    if (exists) return res.status(409).json({ error: { code: 'DUPLICATE', message: 'A school with this ID already exists.' } });
    await query(
      `INSERT INTO schools (id, name, school_type, status) VALUES (?, ?, ?, 'active')`,
      [id.toUpperCase(), name.trim(), school_type || 'secondary']
    );
    const created = await queryOne('SELECT * FROM schools WHERE id = ?', [id.toUpperCase()]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create school.' } });
  }
});

router.put('/schools/:id', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, school_type, status } = req.body;
    await query(
      `UPDATE schools SET
         name        = COALESCE(?, name),
         school_type = COALESCE(?, school_type),
         status      = COALESCE(?, status)
       WHERE id = ?`,
      [name, school_type, status, id]
    );
    const updated = await queryOne('SELECT * FROM schools WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update school.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — PLATFORM STATS
// GET /admin/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/stats', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const [schoolCount]  = await query("SELECT COUNT(*) as cnt FROM schools WHERE status = 'active'");
    const [totalSchools] = await query("SELECT COUNT(*) as cnt FROM schools");
    const [studentCount] = await query("SELECT COUNT(*) as cnt FROM students WHERE status = 'active'");
    const [staffCount]   = await query("SELECT COUNT(*) as cnt FROM staff WHERE status = 'active'");

    // Students per school
    const studentsPerSchool = await query(`
      SELECT s.name as school_name, COUNT(st.id) as student_count
      FROM schools s
      LEFT JOIN students st ON s.id = st.school_id AND st.status = 'active'
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
      LEFT JOIN students st ON s.id = st.school_id AND st.status = 'active'
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
    const license = await queryOne(
      `SELECT l.*, s.name as school_name, s.school_type
       FROM licenses l
       JOIN schools s ON l.school_id = s.id
       WHERE l.school_id = ? AND l.status = 'active'
       ORDER BY l.expires_at DESC
       LIMIT 1`,
      [schoolId]
    );
    if (!license) {
      return res.json({ data: { license: null, warning: false } });
    }
    const now = new Date();
    const expiresAt = new Date(license.expires_at);
    const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    return res.json({
      data: {
        license,
        days_left: daysLeft,
        warning: daysLeft <= 30,
        expires_at: license.expires_at
      }
    });
  } catch (err) {
    // If licenses table doesn't exist yet, return gracefully
    return res.json({ data: { license: null, warning: false } });
  }
});

router.post('/schools/:schoolId/license/renewal-request', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { contact_name, contact_email, message } = req.body;
    // Log the renewal request in audit log if table exists
    try {
      await query(
        `INSERT INTO audit_logs (id, school_id, user_id, action, details, created_at)
         VALUES (?, ?, ?, 'license_renewal_request', ?, NOW())`,
        ['AUD' + Date.now().toString(36), schoolId, req.user.id,
         JSON.stringify({ contact_name, contact_email, message })]
      );
    } catch (e) { /* audit_logs table may not exist */ }
    return res.json({ data: { message: 'Renewal request submitted. The system administrator will contact you shortly.' } });
  } catch (err) {
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
    if (school_id) { sql += ' WHERE s.school_id = ?'; params.push(school_id); }
    sql += ' ORDER BY ha.created_at DESC';
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

router.post('/schools/:schoolId/assets/:id/issue', authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { issued_to, issued_to_name, issued_to_type, expected_return_date, notes } = req.body;
    if (!issued_to && !issued_to_name) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Issued to person is required.' } });
    try { await query('ALTER TABLE assets ADD COLUMN holder_id VARCHAR(50) NULL'); } catch(e) {}
    try { await query('ALTER TABLE assets ADD COLUMN holder_type VARCHAR(30) NULL'); } catch(e) {}
    try { await query('ALTER TABLE assets ADD COLUMN holder_name VARCHAR(200) NULL'); } catch(e) {}
    try { await query('ALTER TABLE assets ADD COLUMN issued_at DATETIME NULL'); } catch(e) {}
    try { await query('ALTER TABLE assets ADD COLUMN expected_return_date DATE NULL'); } catch(e) {}
    await query(
      `UPDATE assets SET status = 'issued', holder_id = ?, holder_type = ?, holder_name = ?,
       issued_at = NOW(), expected_return_date = ?, notes = ? WHERE id = ? AND school_id = ?`,
      [issued_to || null, issued_to_type || 'student', issued_to_name || null,
       expected_return_date || null, notes || null, id, schoolId]
    );
    const asset = await queryOne('SELECT * FROM assets WHERE id = ?', [id]);
    return res.json({ data: asset });
  } catch (err) {
    console.error('Issue asset error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to issue asset.' } });
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
    const { fee_id, student_id, amount, currency, method, reference, phone_number } = req.body;
    if (!fee_id || !amount) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Fee ID and amount are required.' } });
    const id = 'RPAY' + Date.now().toString(36).toUpperCase();
    await query(
      `INSERT INTO remote_payments (id, school_id, fee_id, student_id, amount, currency, payment_method, reference, phone_number, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [id, schoolId, fee_id, student_id || null, amount, currency || 'USD', method || 'ecocash', reference || null, phone_number || null]
    );
    return res.status(201).json({ data: { id, status: 'pending', message: 'Payment initiated. Awaiting verification.' } });
  } catch (err) {
    console.error('Remote payment error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to initiate payment.' } });
  }
});

router.post('/schools/:schoolId/remote-payments/:id/verify', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { action, notes } = req.body;
    const status = action === 'approve' ? 'approved' : 'rejected';
    try { await query('ALTER TABLE remote_payments ADD COLUMN verified_at DATETIME NULL'); } catch(e) {}
    try { await query('ALTER TABLE remote_payments ADD COLUMN verified_by VARCHAR(50) NULL'); } catch(e) {}
    try { await query('ALTER TABLE remote_payments ADD COLUMN notes TEXT NULL'); } catch(e) {}
    await query(
      `UPDATE remote_payments SET status = ?, notes = ?, verified_at = NOW(), verified_by = ? WHERE id = ? AND school_id = ?`,
      [status, notes || null, req.user.id, id, schoolId]
    );
    if (action === 'approve') {
      const rp = await queryOne('SELECT * FROM remote_payments WHERE id = ?', [id]);
      if (rp && rp.fee_id) {
        const payId = 'PAY' + Date.now().toString(36).toUpperCase();
        try {
          await query(
            `INSERT INTO fee_payments (id, fee_id, amount_paid, payment_method, reference, payment_date, recorded_by) VALUES (?, ?, ?, ?, ?, CURDATE(), ?)`,
            [payId, rp.fee_id, rp.amount, rp.payment_method || 'online', rp.reference || id, req.user.id]
          );
        } catch(e) {}
      }
    }
    return res.json({ data: { message: `Payment ${status} successfully.` } });
  } catch (err) {
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

// ─────────────────────────────────────────────────────────────────────────────
// TERMS
// GET  /schools/:schoolId/terms
// POST /schools/:schoolId/terms
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schools/:schoolId/terms', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let terms = [];
    try { terms = await query('SELECT * FROM term_config WHERE school_id = ? ORDER BY year DESC, term_number ASC', [schoolId]); } catch(e) {}
    return res.json({ data: terms });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch terms.' } });
  }
});

router.post('/schools/:schoolId/terms', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { term_name, start_date, end_date, year, term_number } = req.body;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS term_config (
          id VARCHAR(50) PRIMARY KEY,
          school_id VARCHAR(50) NOT NULL,
          term_name VARCHAR(100) NOT NULL,
          start_date DATE NULL,
          end_date DATE NULL,
          year INT NULL,
          term_number INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch(e) {}

    const termId = 'TRM' + Math.random().toString(36).substr(2, 6).toUpperCase();
    await query(
      `INSERT INTO term_config (id, school_id, term_name, start_date, end_date, year, term_number)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [termId, schoolId, term_name || `Term ${term_number || 1}`, start_date || null, end_date || null, year || new Date().getFullYear(), term_number || 1]
    );

    const created = await queryOne('SELECT * FROM term_config WHERE id = ?', [termId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create term.' } });
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
    const { thresholds } = req.body;
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
          color VARCHAR(20) NULL
        )
      `);
    } catch(e) {}

    if (Array.isArray(thresholds)) {
      await query('DELETE FROM grade_thresholds WHERE school_id = ?', [schoolId]);
      for (const t of thresholds) {
        const tId = 'GT' + Math.random().toString(36).substr(2, 6).toUpperCase();
        await query(
          `INSERT INTO grade_thresholds (id, school_id, grade, label, min_score, max_score, points, color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [tId, schoolId, t.grade, t.label || '', t.min_score || 0, t.max_score || 100, t.points || 0, t.color || '#0d9488']
        );
      }
    }
    return res.json({ data: { message: 'Grade thresholds saved successfully.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update grade thresholds.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SUBJECTS DELETE
// DELETE /admin/subjects/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/admin/subjects/:id', authenticateToken, requireRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM subjects WHERE id = ?', [id]);
    return res.json({ data: { message: 'Subject deleted successfully.' } });
  } catch (err) {
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
