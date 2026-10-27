const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// ACADEMIC SESSIONS (Calendar Years, e.g. 2025, 2026)
// ─────────────────────────────────────────────────────────────────────────────

// GET /academics/sessions or /schools/:schoolId/sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const sessions = await query(
      'SELECT * FROM academic_sessions WHERE school_id = ? OR school_id IS NULL ORDER BY year DESC',
      [schoolId]
    );
    return res.json({ data: sessions });
  } catch (err) {
    console.error('Fetch academic sessions error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch academic sessions.' } });
  }
});

// POST /academics/sessions
router.post('/sessions', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { year, name, start_date, end_date, is_current } = req.body;

    if (!year || !start_date || !end_date) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Year, start_date, and end_date are required.' } });
    }

    if (is_current) {
      await query('UPDATE academic_sessions SET is_current = FALSE WHERE school_id = ?', [schoolId]);
    }

    const sessionName = name || `Academic Year ${year}`;
    const result = await query(
      `INSERT INTO academic_sessions (school_id, year, name, start_date, end_date, is_current)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [schoolId, parseInt(year), sessionName, start_date, end_date, is_current ? 1 : 0]
    );

    const created = await queryOne('SELECT * FROM academic_sessions WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create academic session error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create academic session.' } });
  }
});

// PATCH /academics/sessions/:id
router.patch('/sessions/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.params.schoolId || req.user.school_id;
    const { name, start_date, end_date, is_current, status } = req.body;

    if (is_current) {
      await query('UPDATE academic_sessions SET is_current = FALSE WHERE school_id = ?', [schoolId]);
    }

    await query(
      `UPDATE academic_sessions 
       SET name = COALESCE(?, name),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           is_current = COALESCE(?, is_current),
           status = COALESCE(?, status)
       WHERE id = ? AND (school_id = ? OR school_id IS NULL)`,
      [name, start_date, end_date, is_current, status, id, schoolId]
    );

    const updated = await queryOne('SELECT * FROM academic_sessions WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update academic session.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TERMS (Terms 1, 2, 3 per MoPSE Calendar)
// ─────────────────────────────────────────────────────────────────────────────

// GET /academics/terms
router.get('/terms', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const terms = await query(
      `SELECT t.id, t.school_id, t.session_id,
              CASE 
                WHEN LOWER(t.name) LIKE '%1%' THEN 'Term 1'
                WHEN LOWER(t.name) LIKE '%2%' THEN 'Term 2'
                WHEN LOWER(t.name) LIKE '%3%' THEN 'Term 3'
                ELSE REPLACE(t.name, '_', ' ')
              END as name,
              CASE 
                WHEN LOWER(t.name) LIKE '%1%' THEN 1
                WHEN LOWER(t.name) LIKE '%2%' THEN 2
                WHEN LOWER(t.name) LIKE '%3%' THEN 3
                ELSE 1
              END as term_number,
              t.start_date, t.end_date, s.year as session_year, s.name as session_name,
              CASE WHEN CURRENT_DATE BETWEEN t.start_date AND t.end_date THEN 1 ELSE 0 END as is_current_by_date,
              CASE WHEN CURRENT_DATE BETWEEN t.start_date AND t.end_date THEN 1 ELSE COALESCE(t.is_current, 0) END as is_current,
              CASE WHEN CURRENT_DATE BETWEEN t.start_date AND t.end_date THEN 'active' ELSE 'inactive' END as status
       FROM terms t 
       LEFT JOIN academic_sessions s ON t.session_id = s.id 
       WHERE t.school_id = ? OR t.school_id IS NULL 
       ORDER BY t.start_date ASC`,
      [schoolId]
    );
    return res.json({ data: terms });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch terms.' } });
  }
});

// GET /academics/terms/current
router.get('/terms/current', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
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
      // Find upcoming or latest term
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

// POST /academics/terms
router.post('/terms', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { session_id, name, term_number, start_date, end_date, half_term_start, half_term_end, is_current } = req.body;

    if (!session_id || !name || !term_number || !start_date || !end_date) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'session_id, name, term_number, start_date, and end_date required.' } });
    }

    if (is_current) {
      await query('UPDATE terms SET is_current = FALSE WHERE school_id = ?', [schoolId]);
    }

    const result = await query(
      `INSERT INTO terms (school_id, session_id, name, term_number, start_date, end_date, half_term_start, half_term_end, is_current)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, session_id, name, parseInt(term_number), start_date, end_date, half_term_start || null, half_term_end || null, is_current ? 1 : 0]
    );

    const created = await queryOne('SELECT * FROM terms WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create term.' } });
  }
});

// PUT / PATCH /academics/terms/:id (Edit Term)
const handleEditTerm = async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { id } = req.params;
    const { name, start_date, end_date, is_current, session_id, term_number } = req.body;

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (start_date !== undefined) { updates.push('start_date = ?'); params.push(start_date); }
    if (end_date !== undefined) { updates.push('end_date = ?'); params.push(end_date); }
    if (session_id !== undefined) { updates.push('session_id = ?'); params.push(session_id); }
    if (term_number !== undefined) { updates.push('term_number = ?'); params.push(term_number); }
    if (is_current !== undefined) {
      if (is_current) {
        await query('UPDATE terms SET is_current = FALSE WHERE school_id = ?', [schoolId]);
      }
      updates.push('is_current = ?');
      params.push(is_current ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(id, schoolId, req.user.role);
      await query(`UPDATE terms SET ${updates.join(', ')} WHERE id = ? AND (school_id = ? OR ? = 'super_admin')`, params);
    }

    const updated = await queryOne('SELECT * FROM terms WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update term.' } });
  }
};

router.put('/terms/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleEditTerm);
router.patch('/terms/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleEditTerm);

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /departments
router.get('/departments', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const departments = await query(
      `SELECT d.*, e.designation, u.username as head_name 
       FROM departments d 
       LEFT JOIN employees e ON d.head_employee_id = e.id 
       LEFT JOIN users u ON e.user_id = u.id 
       WHERE d.school_id = ? OR d.school_id IS NULL`,
      [schoolId]
    );
    return res.json({ data: departments });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch departments.' } });
  }
});

// POST /departments
router.post('/departments', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { name, code, head_employee_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Department name is required.' } });
    }

    const result = await query(
      'INSERT INTO departments (school_id, name, code, head_employee_id) VALUES (?, ?, ?, ?)',
      [schoolId, name.trim(), code ? code.trim() : null, head_employee_id || null]
    );

    const created = await queryOne('SELECT * FROM departments WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create department.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLASS-SUBJECTS (Mapping subjects to classes & teachers)
// ─────────────────────────────────────────────────────────────────────────────

// GET /class-subjects
router.get('/class-subjects', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { class_id, teacher_id } = req.query;

    let sql = `
      SELECT cs.*, c.name as class_name, s.name as subject_name, s.code as subject_code,
             u.username as teacher_name, st.name as staff_name
      FROM class_subjects cs
      JOIN classes c ON cs.class_id = c.id
      JOIN subjects s ON cs.subject_id = s.id
      LEFT JOIN employees e ON cs.teacher_employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN staff st ON cs.teacher_employee_id = st.id
      WHERE cs.school_id = ?
    `;
    const params = [schoolId];

    if (class_id) {
      sql += ' AND cs.class_id = ?';
      params.push(class_id);
    }
    if (teacher_id) {
      sql += ' AND (cs.teacher_employee_id = ? OR st.id = ?)';
      params.push(teacher_id, teacher_id);
    }

    const records = await query(sql, params);
    return res.json({ data: records });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch class subjects.' } });
  }
});

// POST /class-subjects
router.post('/class-subjects', authenticateToken, requireRoles('school_admin', 'super_admin', 'hod'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { class_id, subject_id, teacher_employee_id, periods_per_week, is_compulsory } = req.body;

    if (!class_id || !subject_id) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'class_id and subject_id are required.' } });
    }

    const uuid = 'CS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO class_subjects (uuid, school_id, class_id, subject_id, teacher_employee_id, periods_per_week, is_compulsory)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid, schoolId, class_id, subject_id, teacher_employee_id || null, parseInt(periods_per_week || 4), is_compulsory ? 1 : 0]
    );

    const created = await queryOne('SELECT * FROM class_subjects WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to assign subject to class.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENROLLMENTS (Student termly/annual class enrollments)
// ─────────────────────────────────────────────────────────────────────────────

// GET /enrollments
router.get('/enrollments', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { session_id, class_id, student_id } = req.query;

    let sql = `
      SELECT en.*, st.admission_no, st.first_name, st.last_name, c.name as class_name, sess.year as session_year
      FROM enrollments en
      JOIN students st ON en.student_id = st.id
      JOIN classes c ON en.class_id = c.id
      JOIN academic_sessions sess ON en.session_id = sess.id
      WHERE en.school_id = ?
    `;
    const params = [schoolId];

    if (session_id) {
      sql += ' AND en.session_id = ?';
      params.push(session_id);
    }
    if (class_id) {
      sql += ' AND en.class_id = ?';
      params.push(class_id);
    }
    if (student_id) {
      sql += ' AND en.student_id = ?';
      params.push(student_id);
    }

    const records = await query(sql, params);
    return res.json({ data: records });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch enrollments.' } });
  }
});

// POST /enrollments
router.post('/enrollments', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { student_id, session_id, class_id, section_id, roll_no, status } = req.body;

    if (!student_id || !session_id || !class_id) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'student_id, session_id, and class_id are required.' } });
    }

    const uuid = 'ENR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO enrollments (uuid, school_id, student_id, session_id, class_id, section_id, roll_no, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE class_id = VALUES(class_id), section_id = VALUES(section_id), status = VALUES(status)`,
      [uuid, schoolId, student_id, session_id, class_id, section_id || null, roll_no || null, status || 'active']
    );

    // Update current class_id on student profile for quick reference
    await query('UPDATE students SET class_id = ? WHERE id = ?', [class_id, student_id]);

    return res.status(201).json({ data: { id: result.insertId, uuid, student_id, class_id } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create enrollment.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROMOTION RULES
// ─────────────────────────────────────────────────────────────────────────────

// GET /promotion-rules
router.get('/promotion-rules', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const rules = await query('SELECT * FROM promotion_rules WHERE school_id = ? OR school_id IS NULL', [schoolId]);
    return res.json({ data: rules });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch promotion rules.' } });
  }
});

// POST /promotion-rules
router.post('/promotion-rules', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { from_phase, to_phase, min_passes, mandatory_subject_ids } = req.body;

    const result = await query(
      `INSERT INTO promotion_rules (school_id, from_phase, to_phase, min_passes, mandatory_subject_ids)
       VALUES (?, ?, ?, ?, ?)`,
      [schoolId, from_phase, to_phase, parseInt(min_passes || 5), JSON.stringify(mandatory_subject_ids || [])]
    );

    const created = await queryOne('SELECT * FROM promotion_rules WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create promotion rule.' } });
  }
});

module.exports = router;
