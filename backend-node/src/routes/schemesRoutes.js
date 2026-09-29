const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMES OF WORK (MoPSE Curriculum Schemes)
// ─────────────────────────────────────────────────────────────────────────────

// GET /schemes
router.get('/schemes', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { term_id, class_id, subject_id, teacher_id, status } = req.query;

    let sql = `
      SELECT s.*, c.name as class_name, sub.name as subject_name, sub.code as subject_code,
             u.username as teacher_name, app_u.username as reviewer_name
      FROM schemes_of_work s
      JOIN classes c ON s.class_id = c.id
      JOIN subjects sub ON s.subject_id = sub.id
      JOIN employees e ON s.teacher_employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN employees app_e ON s.approved_by = app_e.id
      LEFT JOIN users app_u ON app_e.user_id = app_u.id
      WHERE s.school_id = ?
    `;
    const params = [schoolId];

    if (term_id) { sql += ' AND s.term_id = ?'; params.push(term_id); }
    if (class_id) { sql += ' AND s.class_id = ?'; params.push(class_id); }
    if (subject_id) { sql += ' AND s.subject_id = ?'; params.push(subject_id); }
    if (status) { sql += ' AND s.status = ?'; params.push(status); }

    const schemes = await query(sql, params);
    return res.json({ data: schemes });
  } catch (err) {
    console.error('Fetch schemes error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch schemes of work.' } });
  }
});

// POST /schemes
router.post('/schemes', authenticateToken, requireRoles('teacher', 'hod', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { term_id, class_id, subject_id, week_number, topic, sub_topic, objectives, competencies, SOM, evaluation, status } = req.body;

    if (!term_id || !class_id || !subject_id || !topic) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'term_id, class_id, subject_id, and topic are required.' } });
    }

    // Get employee record for req.user
    const emp = await queryOne('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    const teacherId = emp ? emp.id : req.user.id;

    const uuid = 'SCH' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO schemes_of_work 
       (uuid, school_id, term_id, class_id, subject_id, teacher_employee_id, week_number, topic, sub_topic, objectives, competencies, SOM, evaluation, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, schoolId, term_id, class_id, subject_id, teacherId, parseInt(week_number || 1), topic, sub_topic || null, objectives || '', competencies || '', SOM || '', evaluation || null, status || 'draft']
    );

    const created = await queryOne('SELECT * FROM schemes_of_work WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create scheme error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create scheme of work.' } });
  }
});

// POST /schemes/:id/submit
router.post('/schemes/:id/submit', authenticateToken, requireRoles('teacher', 'hod', 'school_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await query("UPDATE schemes_of_work SET status = 'submitted' WHERE id = ? OR uuid = ?", [id, id]);
    return res.json({ data: { message: 'Scheme of work submitted to HOD for review.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit scheme.' } });
  }
});

// POST /schemes/:id/review (HOD approval workflow)
router.post('/schemes/:id/review', authenticateToken, requireRoles('hod', 'deputy_head', 'head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body; // status: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "Status must be 'approved' or 'rejected'." } });
    }

    const scheme = await queryOne('SELECT id, teacher_employee_id FROM schemes_of_work WHERE id = ? OR uuid = ?', [id, id]);
    if (!scheme) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scheme of work not found.' } });

    const emp = await queryOne('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    const reviewerId = emp ? emp.id : req.user.id;
    if (scheme.teacher_employee_id === reviewerId) return res.status(403).json({ error: { code: 'MAKER_CHECKER_VIOLATION', message: 'The scheme author cannot approve or reject their own scheme.' } });

    await query(
      `UPDATE schemes_of_work 
       SET status = ?, approved_by = ?, approval_comments = ?, approved_at = NOW() 
       WHERE id = ? OR uuid = ?`,
      [status, reviewerId, comments || null, scheme.id, scheme.id]
    );

    return res.json({ data: { message: `Scheme of work ${status}.` } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to review scheme.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LESSON PLANS
// ─────────────────────────────────────────────────────────────────────────────

// GET /lesson-plans
router.get('/lesson-plans', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { scheme_id, class_id, subject_id, status } = req.query;

    let sql = `
      SELECT lp.*, c.name as class_name, sub.name as subject_name, u.username as teacher_name
      FROM lesson_plans lp
      JOIN classes c ON lp.class_id = c.id
      JOIN subjects sub ON lp.subject_id = sub.id
      JOIN employees e ON lp.teacher_employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE lp.school_id = ?
    `;
    const params = [schoolId];

    if (scheme_id) { sql += ' AND lp.scheme_id = ?'; params.push(scheme_id); }
    if (class_id) { sql += ' AND lp.class_id = ?'; params.push(class_id); }
    if (subject_id) { sql += ' AND lp.subject_id = ?'; params.push(subject_id); }
    if (status) { sql += ' AND lp.status = ?'; params.push(status); }

    const plans = await query(sql, params);
    return res.json({ data: plans });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch lesson plans.' } });
  }
});

// POST /lesson-plans
router.post('/lesson-plans', authenticateToken, requireRoles('teacher', 'hod', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { scheme_id, class_id, subject_id, lesson_date, duration_minutes, topic, sub_topic, lesson_objectives, introduction, main_activities, conclusion, assessment_task, media_aids, evaluation, status } = req.body;

    if (!class_id || !subject_id || !topic || !lesson_date) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'class_id, subject_id, topic, and lesson_date are required.' } });
    }

    const emp = await queryOne('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    const teacherId = emp ? emp.id : req.user.id;
    const uuid = 'LP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO lesson_plans 
       (uuid, school_id, scheme_id, class_id, subject_id, teacher_employee_id, lesson_date, duration_minutes, topic, sub_topic, lesson_objectives, introduction, main_activities, conclusion, assessment_task, media_aids, evaluation, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, schoolId, scheme_id || null, class_id, subject_id, teacherId, lesson_date, parseInt(duration_minutes || 40), topic, sub_topic || null, lesson_objectives || '', introduction || '', main_activities || '', conclusion || '', assessment_task || null, media_aids || null, evaluation || null, status || 'draft']
    );

    const created = await queryOne('SELECT * FROM lesson_plans WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create lesson plan error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create lesson plan.' } });
  }
});

// POST /lesson-plans/:id/review
router.post('/lesson-plans/:id/review', authenticateToken, requireRoles('hod', 'deputy_head', 'head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;

    const emp = await queryOne('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    const reviewerId = emp ? emp.id : req.user.id;

    await query(
      'UPDATE lesson_plans SET status = ?, approved_by = ?, evaluation = ? WHERE id = ? OR uuid = ?',
      [status, reviewerId, comments || null, id, id]
    );

    return res.json({ data: { message: `Lesson plan ${status}.` } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to review lesson plan.' } });
  }
});

module.exports = router;
