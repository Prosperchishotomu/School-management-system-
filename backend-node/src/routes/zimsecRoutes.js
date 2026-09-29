const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { requireIdempotencyKey, idempotencyMiddleware } = require('../utils/idempotency');

// ─────────────────────────────────────────────────────────────────────────────
// EXAM ENTRIES (ZIMSEC / Cambridge Registration Batches)
// ─────────────────────────────────────────────────────────────────────────────

// GET /exam-boards
router.get('/exam-boards', authenticateToken, async (req, res) => {
  try {
    const boards = await query(
      'SELECT id, name, code FROM exam_boards WHERE is_active = 1 ORDER BY name ASC',
      []
    );
    return res.json({ data: boards });
  } catch (err) {
    console.error('Fetch examination boards error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch examination boards.' } });
  }
});

// GET /exam-entries
router.get('/exam-entries', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const entries = await query(
      `SELECT ee.*, eb.name as board_name, eb.code as board_code,
              COUNT(DISTINCT eec.id) as total_candidates,
              COUNT(DISTINCT ees.id) as total_subject_entries
       FROM exam_entries ee
       JOIN schools sch ON sch.id = ee.school_id
       JOIN exam_boards eb ON ee.board_id = eb.id
       LEFT JOIN exam_entry_candidates eec ON ee.id = eec.entry_id
       LEFT JOIN exam_entry_subjects ees ON eec.id = ees.candidate_id
       WHERE ee.school_id = ?
         AND NOT (LOWER(COALESCE(sch.school_type, 'combined')) = 'primary' AND LOWER(ee.exam_series) = 'june')
       GROUP BY ee.id
       ORDER BY ee.session_year DESC, ee.created_at DESC`,
      [schoolId]
    );
    return res.json({ data: entries });
  } catch (err) {
    console.error('Fetch exam entries error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch examination entries.' } });
  }
});

// POST /exam-entries
router.post('/exam-entries', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { board_id, session_year, exam_series, center_no } = req.body;

    if (!board_id || !session_year || !exam_series || !center_no) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'board_id, session_year, exam_series, and center_no are required.' } });
    }

    const school = await queryOne('SELECT school_type FROM schools WHERE id = ?', [schoolId]);
    if (school?.school_type === 'primary' && String(exam_series).toLowerCase() === 'june') {
      return res.status(422).json({ error: { code: 'EXAM_SERIES_NOT_AVAILABLE', message: 'Primary schools do not have a June ZIMSEC examination sitting. Use the November sitting.' } });
    }

    const uuid = 'ZIM' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO exam_entries (uuid, school_id, board_id, session_year, exam_series, center_no, status)
       VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      [uuid, schoolId, board_id, parseInt(session_year), exam_series, center_no.trim()]
    );

    const created = await queryOne('SELECT * FROM exam_entries WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create exam entry error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create examination entry batch.' } });
  }
});

// POST /exam-entries/:id/candidates
router.post('/exam-entries/:id/candidates', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { student_ids } = req.body; // Array of student IDs

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'student_ids array is required.' } });
    }

    const entry = await queryOne('SELECT * FROM exam_entries WHERE id = ? OR uuid = ?', [id, id]);
    if (!entry) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Exam entry batch not found.' } });

    let addedCount = 0;
    for (const studentId of student_ids) {
      try {
        await query(
          'INSERT INTO exam_entry_candidates (entry_id, student_id, center_no, status) VALUES (?, ?, ?, ?)',
          [entry.id, studentId, entry.center_no, 'registered']
        );
        addedCount++;
      } catch (dupErr) {
        // Skip duplicates
      }
    }

    return res.json({ data: { message: `Added ${addedCount} candidates to entry batch.`, added_count: addedCount } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to add candidates.' } });
  }
});

// POST /exam-entries/:id/assign-candidate-numbers
router.post('/exam-entries/:id/assign-candidate-numbers', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { start_number } = req.body;

    const entry = await queryOne('SELECT * FROM exam_entries WHERE id = ? OR uuid = ?', [id, id]);
    if (!entry) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Exam entry batch not found.' } });

    const candidates = await query(
      `SELECT eec.id, st.last_name, st.first_name 
       FROM exam_entry_candidates eec 
       JOIN students st ON eec.student_id = st.id 
       WHERE eec.entry_id = ? 
       ORDER BY st.last_name ASC, st.first_name ASC`,
      [entry.id]
    );

    let currentNo = parseInt(start_number || 1001);
    for (const cand of candidates) {
      const candStr = String(currentNo).padStart(4, '0');
      await query('UPDATE exam_entry_candidates SET candidate_no = ? WHERE id = ?', [candStr, cand.id]);
      currentNo++;
    }

    return res.json({ data: { message: `Assigned candidate numbers to ${candidates.length} candidates.`, total_assigned: candidates.length } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to assign candidate numbers.' } });
  }
});

// GET /exam-entries/:id/sba-export (Export School-Based Assessment Marks)
router.get('/exam-entries/:id/sba-export', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await queryOne('SELECT * FROM exam_entries WHERE id = ? OR uuid = ?', [id, id]);
    if (!entry) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Exam entry batch not found.' } });

    const sbaMarks = await query(
      `SELECT eec.candidate_no, eec.center_no, st.admission_no, st.first_name, st.last_name, st.national_id,
              s.code as syllabus_code, s.name as subject_name, ees.sba_mark, ees.paper_codes
       FROM exam_entry_candidates eec
       JOIN students st ON eec.student_id = st.id
       JOIN exam_entry_subjects ees ON eec.id = ees.candidate_id
       JOIN subjects s ON ees.subject_id = s.id
       WHERE eec.entry_id = ?
       ORDER BY eec.candidate_no ASC, s.code ASC`,
      [entry.id]
    );

    return res.json({
      data: {
        center_no: entry.center_no,
        session_year: entry.session_year,
        exam_series: entry.exam_series,
        records: sbaMarks
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate SBA export.' } });
  }
});

// POST /exam-entries/:id/submit (Requires Maker-Checker approval if configured)
router.post('/exam-entries/:id/submit', authenticateToken, requireIdempotencyKey, idempotencyMiddleware, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await queryOne('SELECT * FROM exam_entries WHERE id = ? OR uuid = ?', [id, id]);
    if (!entry) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Exam entry batch not found.' } });

    // Request dual-approval (Maker-Checker)
    const approvalUuid = 'APP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO approvals (uuid, school_id, action, action_type, entity_type, entity_id, requested_by, payload, status)
       VALUES (?, ?, 'submit', 'ZIMSEC_ENTRY_SUBMISSION', 'exam_entries', ?, ?, ?, 'pending')`,
      [approvalUuid, entry.school_id, entry.id, req.user.id, JSON.stringify({ center_no: entry.center_no, session_year: entry.session_year })]
    );

    await query("UPDATE exam_entries SET status = 'pending_approval' WHERE id = ?", [entry.id]);

    return res.json({
      data: {
        message: 'ZIMSEC Examination Entry submitted for dual-approval (Maker-Checker).',
        approval_id: approvalUuid
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Submission failed.' } });
  }
});

// POST /exam-entries/:id/results-import (Import Board Examination Results)
router.post('/exam-entries/:id/results-import', authenticateToken, requireIdempotencyKey, idempotencyMiddleware, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { results } = req.body; // Array of { candidate_no, subject_code, mark, grade, points }

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'results array is required.' } });
    }

    const entry = await queryOne('SELECT * FROM exam_entries WHERE id = ? OR uuid = ?', [id, id]);
    if (!entry) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Exam entry batch not found.' } });

    const validationErrors = [];
    const validResults = [];
    for (const [index, r] of results.entries()) {
      const cand = await queryOne(
        'SELECT id FROM exam_entry_candidates WHERE entry_id = ? AND candidate_no = ?',
        [entry.id, String(r.candidate_no).padStart(4, '0')]
      );
      if (!cand) { validationErrors.push({ row: index + 1, code: 'UNKNOWN_CANDIDATE', message: `Candidate ${r.candidate_no} is not registered in this entry.` }); continue; }
      const subj = await queryOne('SELECT id FROM subjects WHERE code = ? OR name = ?', [r.subject_code, r.subject_code]);
      if (!subj) { validationErrors.push({ row: index + 1, code: 'UNKNOWN_SUBJECT', message: `Subject ${r.subject_code} does not exist.` }); continue; }
      if (r.grade && !/^(A\*|A|B|C|D|E|U|[1-9])$/i.test(String(r.grade))) validationErrors.push({ row: index + 1, code: 'INVALID_GRADE', message: `Grade ${r.grade} is invalid.` });
      validResults.push({ candidate_id: cand.id, subject_id: subj.id, mark: r.mark ?? null, grade: r.grade || 'U', points: r.points ?? 0 });
    }
    if (validationErrors.length) return res.status(422).json({ error: { code: 'IMPORT_VALIDATION_FAILED', message: 'Results import dry-run found validation errors.', fields: { rows: validationErrors } }, data: { valid_rows: validResults.length, invalid_rows: validationErrors.length } });
    const approvalUuid = 'APP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(`INSERT INTO approvals (uuid, school_id, action, action_type, entity_type, entity_id, requested_by, payload, status)
      VALUES (?, ?, 'import', 'RESULTS_IMPORT', 'exam_entries', ?, ?, ?, 'pending')`, [approvalUuid, entry.school_id, entry.id, req.user.id, JSON.stringify({ results: validResults })]);
    return res.status(202).json({ data: { message: 'Results import passed dry-run and is awaiting maker-checker approval.', approval_id: approvalUuid, valid_rows: validResults.length } });
  } catch (err) {
    console.error('ZIMSEC results import error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to import exam results.' } });
  }
});

module.exports = router;
