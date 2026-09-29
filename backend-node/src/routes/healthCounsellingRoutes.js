const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH PROFILES & CLINIC VISITS
// ─────────────────────────────────────────────────────────────────────────────

// GET /health/:studentId
router.get('/health/:studentId', authenticateToken, requireRoles('nurse', 'head', 'deputy_head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await queryOne('SELECT id, admission_no, first_name, last_name, blood_group FROM students WHERE id = ? OR uuid = ?', [studentId, studentId]);

    if (!student) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Student not found.' } });

    const profile = await queryOne('SELECT * FROM health_profiles WHERE student_id = ?', [student.id]);
    const visits = await query('SELECT * FROM health_visits WHERE student_id = ? ORDER BY visit_date DESC', [student.id]);

    // Audit Log for sensitive health data read
    await query(
      'INSERT INTO audit_logs (id, school_id, user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?,?,?)',
      ['LOG' + Math.random().toString(36).substr(2, 5).toUpperCase(), req.user.school_id, req.user.id, 'HEALTH_RECORD_READ', 'students', student.id, `Read health record for ${student.admission_no}`]
    );

    return res.json({
      data: {
        student: { id: student.id, admission_no: student.admission_no, name: `${student.first_name} ${student.last_name}`, blood_group: student.blood_group },
        profile: profile || null,
        visits: visits
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch health records.' } });
  }
});

// POST /health/visits
router.post('/health/visits', authenticateToken, requireRoles('nurse', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { student_id, visit_date, symptoms, diagnosis, treatment, medication_given, referred_to_hospital, notes } = req.body;

    if (!student_id || !symptoms) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'student_id and symptoms are required.' } });
    }

    const result = await query(
      `INSERT INTO health_visits (school_id, student_id, visit_date, symptoms, diagnosis, treatment, medication_given, referred_to_hospital, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, student_id, visit_date || new Date().toISOString().slice(0, 10), symptoms.trim(), diagnosis || null, treatment || null, medication_given || null, referred_to_hospital ? 1 : 0, notes || null, req.user.id]
    );

    return res.status(201).json({ data: { id: result.insertId, student_id, visit_date } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to record clinic visit.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GUIDANCE & COUNSELLING SESSIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /counselling/sessions
router.get('/counselling/sessions', authenticateToken, requireRoles('counsellor', 'head', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { student_id } = req.query;

    let sql = `
      SELECT cs.*, st.admission_no, st.first_name, st.last_name, u.username as counsellor_name
      FROM counselling_sessions cs
      JOIN students st ON cs.student_id = st.id
      JOIN users u ON cs.counsellor_user_id = u.id
      WHERE cs.school_id = ?
    `;
    const params = [schoolId];

    if (student_id) { sql += ' AND cs.student_id = ?'; params.push(student_id); }
    sql += ' ORDER BY cs.session_date DESC';

    const sessions = await query(sql, params);

    // Audit confidential read
    await query(
      'INSERT INTO audit_logs (id, school_id, user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?,?,?)',
      ['LOG' + Math.random().toString(36).substr(2, 5).toUpperCase(), schoolId, req.user.id, 'COUNSELLING_READ', 'counselling_sessions', 0, 'Accessed guidance & counselling logs']
    );

    return res.json({ data: sessions });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch counselling sessions.' } });
  }
});

// POST /counselling/sessions
router.post('/counselling/sessions', authenticateToken, requireRoles('counsellor', 'head', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { student_id, session_date, session_type, summary_notes, action_plan, follow_up_date } = req.body;

    if (!student_id || !summary_notes) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'student_id and summary_notes are required.' } });
    }

    const uuid = 'CS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO counselling_sessions (uuid, school_id, student_id, counsellor_user_id, session_date, session_type, summary_notes, action_plan, follow_up_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, schoolId, student_id, req.user.id, session_date || new Date().toISOString().slice(0, 10), session_type || 'general', summary_notes.trim(), action_plan || null, follow_up_date || null]
    );

    return res.status(201).json({ data: { id: result.insertId, uuid, student_id } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to record counselling session.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// GET /documents
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { entity_type, entity_id } = req.query;

    let sql = 'SELECT * FROM documents WHERE school_id = ?';
    const params = [schoolId];

    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    if (entity_id) { sql += ' AND entity_id = ?'; params.push(entity_id); }

    const docs = await query(sql, params);
    return res.json({ data: docs });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch documents.' } });
  }
});

// POST /documents
router.post('/documents', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { entity_type, entity_id, title, document_type, file_path, mime_type, file_size } = req.body;

    if (!entity_type || !entity_id || !title || !file_path) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'entity_type, entity_id, title, and file_path are required.' } });
    }

    const uuid = 'DOC' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO documents (uuid, school_id, entity_type, entity_id, title, document_type, file_path, mime_type, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, schoolId, entity_type, entity_id, title.trim(), document_type || 'other', file_path, mime_type || 'application/octet-stream', parseInt(file_size || 0), req.user.id]
    );

    return res.status(201).json({ data: { id: result.insertId, uuid, title } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to upload document reference.' } });
  }
});

module.exports = router;
