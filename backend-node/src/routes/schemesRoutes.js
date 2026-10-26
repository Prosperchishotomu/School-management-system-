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
      SELECT s.*, 
             COALESCE(c.name, s.class_id) as class_name, 
             COALESCE(sub.name, s.subject_id) as subject_name, 
             COALESCE(sub.code, '') as subject_code,
             COALESCE(stf.name, u.name, u.username, 'Teacher') as teacher_name, 
             COALESCE(app_stf.name, app_u.name, app_u.username, '') as reviewer_name
      FROM schemes_of_work s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN subjects sub ON (s.subject_id = sub.id OR s.subject_id = sub.code OR s.subject_id = sub.name)
      LEFT JOIN employees e ON s.teacher_employee_id = e.id
      LEFT JOIN staff stf ON (s.teacher_employee_id = stf.id OR s.teacher_employee_id = stf.user_id)
      LEFT JOIN users u ON (e.user_id = u.id OR stf.user_id = u.id OR s.teacher_employee_id = u.id)
      LEFT JOIN employees app_e ON s.approved_by = app_e.id
      LEFT JOIN staff app_stf ON (s.approved_by = app_stf.id OR s.approved_by = app_stf.user_id)
      LEFT JOIN users app_u ON (app_e.user_id = app_u.id OR app_stf.user_id = app_u.id OR s.approved_by = app_u.id)
      WHERE s.school_id = ?
    `;
    const params = [schoolId];

    if (term_id) { sql += ' AND s.term_id = ?'; params.push(term_id); }
    if (class_id) { sql += ' AND (s.class_id = ? OR c.name = ?)'; params.push(class_id, class_id); }
    if (subject_id) { sql += ' AND (s.subject_id = ? OR sub.name = ? OR sub.code = ?)'; params.push(subject_id, subject_id, subject_id); }
    if (status) { sql += ' AND s.status = ?'; params.push(status); }

    sql += ' ORDER BY s.week_number ASC, s.created_at DESC';

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
    let { 
      term_id, class_id, subject_id, week_number, topic, sub_topic, 
      objectives, competencies, SOM, evaluation, status,
      subject, class_level, term, resources, evaluation_remarks
    } = req.body;

    const topicFinal = (topic || req.body.topic_title || '').trim();
    if (!topicFinal) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Topic is required.' } });
    }

    // Resolve class_id: support class_level or class name
    const rawClass = (class_id || class_level || req.body.class_name || '').trim();
    let resolvedClassId = null;
    if (rawClass) {
      const cls = await queryOne(
        'SELECT id FROM classes WHERE school_id = ? AND (id = ? OR LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?))',
        [schoolId, rawClass, rawClass, `%${rawClass}%`]
      );
      if (cls) resolvedClassId = cls.id;
    }
    if (!resolvedClassId) {
      const anyCls = await queryOne('SELECT id FROM classes WHERE school_id = ? LIMIT 1', [schoolId]);
      resolvedClassId = anyCls ? anyCls.id : (rawClass || 'CLS-GEN');
    }

    // Resolve subject_id: support subject name or code
    const rawSubject = (subject_id || subject || req.body.subject_name || '').trim();
    let resolvedSubjectId = null;
    if (rawSubject) {
      const sub = await queryOne(
        'SELECT id FROM subjects WHERE id = ? OR LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?) OR LOWER(name) LIKE LOWER(?)',
        [rawSubject, rawSubject, rawSubject, `%${rawSubject}%`]
      );
      if (sub) resolvedSubjectId = sub.id;
    }
    if (!resolvedSubjectId) {
      const anySub = await queryOne('SELECT id FROM subjects LIMIT 1');
      resolvedSubjectId = anySub ? anySub.id : (rawSubject || 'SUB-GEN');
    }

    // Resolve term_id: support numeric string or term label (e.g. 'Term 1 2026')
    let resolvedTermId = parseInt(term_id, 10);
    if (isNaN(resolvedTermId)) {
      const termMatch = String(term || '').match(/\d+/);
      resolvedTermId = termMatch ? parseInt(termMatch[0], 10) : 1;
    }

    // Get teacher / staff identifier for req.user
    const emp = await queryOne('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    const stf = await queryOne('SELECT id FROM staff WHERE user_id = ? OR id = ?', [req.user.id, req.user.id]);
    const teacherId = emp ? emp.id : (stf ? stf.id : req.user.id);

    const somVal = (SOM || resources || '').trim();
    const evalVal = evaluation || evaluation_remarks || null;

    const uuid = 'SCH' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO schemes_of_work 
       (uuid, school_id, term_id, class_id, subject_id, teacher_employee_id, week_number, topic, sub_topic, objectives, competencies, SOM, evaluation, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, 
        schoolId, 
        resolvedTermId, 
        resolvedClassId, 
        resolvedSubjectId, 
        teacherId, 
        parseInt(week_number || 1, 10), 
        topicFinal, 
        sub_topic || null, 
        objectives || '', 
        competencies || '', 
        somVal, 
        evalVal, 
        status || 'draft'
      ]
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
    const { status, comments } = req.body;

    if (!['approved', 'rejected', 'revision_requested'].includes(status)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "Status must be 'approved', 'rejected', or 'revision_requested'." } });
    }

    const scheme = await queryOne('SELECT id, teacher_employee_id FROM schemes_of_work WHERE id = ? OR uuid = ?', [id, id]);
    if (!scheme) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scheme of work not found.' } });

    const emp = await queryOne('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    const reviewerId = emp ? emp.id : req.user.id;
    if (scheme.teacher_employee_id === reviewerId && req.user.role !== 'super_admin' && req.user.role !== 'school_admin') {
      return res.status(403).json({ error: { code: 'MAKER_CHECKER_VIOLATION', message: 'The scheme author cannot approve or reject their own scheme.' } });
    }

    const normalizedStatus = status === 'revision_requested' ? 'rejected' : status;
    await query(
      `UPDATE schemes_of_work 
       SET status = ?, approved_by = ?, approval_comments = ?, approved_at = NOW() 
       WHERE id = ? OR uuid = ?`,
      [normalizedStatus, reviewerId, comments || null, scheme.id, scheme.id]
    );

    return res.json({ data: { message: `Scheme of work marked as ${normalizedStatus}.` } });
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
      SELECT lp.*, 
             COALESCE(c.name, lp.class_id) as class_name, 
             COALESCE(sub.name, lp.subject_id) as subject_name, 
             COALESCE(stf.name, u.name, u.username, 'Teacher') as teacher_name
      FROM lesson_plans lp
      LEFT JOIN classes c ON lp.class_id = c.id
      LEFT JOIN subjects sub ON (lp.subject_id = sub.id OR lp.subject_id = sub.code OR lp.subject_id = sub.name)
      LEFT JOIN employees e ON lp.teacher_employee_id = e.id
      LEFT JOIN staff stf ON (lp.teacher_employee_id = stf.id OR lp.teacher_employee_id = stf.user_id)
      LEFT JOIN users u ON (e.user_id = u.id OR stf.user_id = u.id OR lp.teacher_employee_id = u.id)
      WHERE lp.school_id = ?
    `;
    const params = [schoolId];

    if (scheme_id) { sql += ' AND lp.scheme_id = ?'; params.push(scheme_id); }
    if (class_id) { sql += ' AND (lp.class_id = ? OR c.name = ?)'; params.push(class_id, class_id); }
    if (subject_id) { sql += ' AND (lp.subject_id = ? OR sub.name = ? OR sub.code = ?)'; params.push(subject_id, subject_id, subject_id); }
    if (status) { sql += ' AND lp.status = ?'; params.push(status); }

    sql += ' ORDER BY lp.lesson_date DESC, lp.created_at DESC';

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
    let { 
      scheme_id, class_id, subject_id, lesson_date, duration_minutes, 
      topic, sub_topic, lesson_objectives, introduction, main_activities, 
      conclusion, assessment_task, media_aids, evaluation, status,
      subject, class_level, objectives, resources
    } = req.body;

    const topicFinal = (topic || req.body.topic_title || '').trim();
    if (!topicFinal) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Topic is required.' } });
    }

    // Resolve class_id:
    const rawClass = (class_id || class_level || req.body.class_name || '').trim();
    let resolvedClassId = null;
    if (rawClass) {
      const cls = await queryOne('SELECT id FROM classes WHERE school_id = ? AND (id = ? OR LOWER(name) = LOWER(?))', [schoolId, rawClass, rawClass]);
      if (cls) resolvedClassId = cls.id;
    }
    if (!resolvedClassId) {
      const anyCls = await queryOne('SELECT id FROM classes WHERE school_id = ? LIMIT 1', [schoolId]);
      resolvedClassId = anyCls ? anyCls.id : (rawClass || 'CLS-GEN');
    }

    // Resolve subject_id:
    const rawSubject = (subject_id || subject || req.body.subject_name || '').trim();
    let resolvedSubjectId = null;
    if (rawSubject) {
      const sub = await queryOne('SELECT id FROM subjects WHERE id = ? OR LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)', [rawSubject, rawSubject, rawSubject]);
      if (sub) resolvedSubjectId = sub.id;
    }
    if (!resolvedSubjectId) {
      const anySub = await queryOne('SELECT id FROM subjects LIMIT 1');
      resolvedSubjectId = anySub ? anySub.id : (rawSubject || 'SUB-GEN');
    }

    const emp = await queryOne('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    const stf = await queryOne('SELECT id FROM staff WHERE user_id = ? OR id = ?', [req.user.id, req.user.id]);
    const teacherId = emp ? emp.id : (stf ? stf.id : req.user.id);

    const lessonDateFinal = lesson_date || new Date().toISOString().split('T')[0];
    const uuid = 'LP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO lesson_plans 
       (uuid, school_id, scheme_id, class_id, subject_id, teacher_employee_id, lesson_date, duration_minutes, topic, sub_topic, lesson_objectives, introduction, main_activities, conclusion, assessment_task, media_aids, evaluation, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, 
        schoolId, 
        scheme_id || null, 
        resolvedClassId, 
        resolvedSubjectId, 
        teacherId, 
        lessonDateFinal, 
        parseInt(duration_minutes || 40, 10), 
        topicFinal, 
        sub_topic || null, 
        lesson_objectives || objectives || '', 
        introduction || '', 
        main_activities || '', 
        conclusion || '', 
        assessment_task || null, 
        media_aids || resources || null, 
        evaluation || null, 
        status || 'draft'
      ]
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
