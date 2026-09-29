const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// EMIS & MOPSE STATUTORY RETURNS
// ─────────────────────────────────────────────────────────────────────────────

// GET /reports/emis/enrolment (MoPSE Statutory Enrolment Breakdown)
router.get('/reports/emis/enrolment', authenticateToken, requireRoles('head', 'deputy_head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;

    // Enrolment breakdown by Gender and Class Phase
    const breakdown = await query(
      `SELECT c.level, c.name as class_name,
              SUM(CASE WHEN st.gender = 'male' THEN 1 ELSE 0 END) as male_count,
              SUM(CASE WHEN st.gender = 'female' THEN 1 ELSE 0 END) as female_count,
              COUNT(st.id) as total_enrolled
       FROM classes c
       LEFT JOIN students st ON c.id = st.class_id AND st.status = 'active'
       WHERE c.school_id = ?
       GROUP BY c.id
       ORDER BY c.level ASC, c.name ASC`,
      [schoolId]
    );

    const totals = await queryOne(
      `SELECT 
         SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as total_male,
         SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as total_female,
         COUNT(id) as grand_total
       FROM students WHERE school_id = ? AND status = 'active'`,
      [schoolId]
    );

    return res.json({
      data: {
        school_id: schoolId,
        generated_at: new Date().toISOString(),
        summary: totals,
        by_class: breakdown
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate EMIS enrolment report.' } });
  }
});

// GET /reports/emis/staffing (MoPSE Staffing & Qualifications Return)
router.get('/reports/emis/staffing', authenticateToken, requireRoles('head', 'deputy_head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;

    const staffSummary = await query(
      `SELECT e.designation, d.name as department_name,
              COUNT(e.id) as count
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.school_id = ?
       GROUP BY e.designation, d.name`,
      [schoolId]
    );

    return res.json({
      data: {
        school_id: schoolId,
        generated_at: new Date().toISOString(),
        staffing: staffSummary
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate EMIS staffing report.' } });
  }
});

// POST /statutory-returns (File Official MoPSE Return Batch)
router.post('/statutory-returns', authenticateToken, requireRoles('head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { return_type, year, term, payload } = req.body;

    if (!return_type || !year) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'return_type and year are required.' } });
    }

    const uuid = 'RET' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO statutory_returns (uuid, school_id, return_type, year, term, payload, status, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?)`,
      [uuid, schoolId, return_type, parseInt(year), term || null, JSON.stringify(payload || {}), req.user.id]
    );

    return res.status(201).json({
      data: {
        return_id: uuid,
        message: 'Statutory return filed successfully.'
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit statutory return.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MAKER-CHECKER (DUAL APPROVAL) SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// GET /approvals
router.get('/approvals', authenticateToken, requireRoles('head', 'deputy_head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { status } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, Number.parseInt(req.query.per_page || req.query.limit, 10) || 25));

    let sql = `
      SELECT a.*, u_req.username as requester_name, u_app.username as approver_name
      FROM approvals a
      JOIN users u_req ON a.requested_by = u_req.id
      LEFT JOIN users u_app ON a.approved_by = u_app.id
      WHERE a.school_id = ?
    `;
    const params = [schoolId];

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    } else {
      sql += " AND a.status = 'pending'";
    }

    const offset = (page - 1) * perPage;
    sql += ` ORDER BY COALESCE(a.created_at, a.requested_at) DESC LIMIT ${perPage} OFFSET ${offset}`;

    const list = await query(sql, params);
    const totalRow = await queryOne('SELECT COUNT(*) AS total FROM approvals WHERE school_id = ?' + (status ? ' AND status = ?' : " AND status = 'pending'"), status ? [schoolId, status] : [schoolId]);
    return res.json({ data: list, meta: { page, per_page: perPage, total: Number(totalRow?.total || 0), request_id: req.requestId } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch pending approvals.' } });
  }
});

// POST /approvals/:id/approve (Checker approves action)
router.post('/approvals/:id/approve', authenticateToken, requireRoles('head', 'deputy_head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.params.schoolId || req.user.school_id;
    const approval = await queryOne('SELECT * FROM approvals WHERE (id = ? OR uuid = ?) AND school_id = ?', [id, id, schoolId]);

    if (!approval) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Approval request not found.' } });

    // MAKER-CHECKER RULE: Requester CANNOT approve their own request!
    if (approval.requested_by === req.user.id) {
      return res.status(403).json({
        error: { code: 'MAKER_CHECKER_VIOLATION', message: 'Maker-Checker policy violation: You cannot approve your own request.' }
      });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Request is no longer pending.' } });
    }

    // Execute requested action logic based on action_type
    if (approval.action_type === 'PAYMENT_REVERSAL') {
      try { await query("UPDATE payments SET status = 'reversed' WHERE id = ?", [approval.entity_id]); } catch (_) { await query("UPDATE fee_payments SET status = 'reversed' WHERE id = ?", [approval.entity_id]); }
    } else if (approval.action_type === 'ZIMSEC_ENTRY_SUBMISSION') {
      await query("UPDATE exam_entries SET status = 'submitted' WHERE id = ?", [approval.entity_id]);
    } else if (approval.action_type === 'EXAM_RESULTS_PUBLISH') {
      await query("UPDATE exams SET is_published = 1 WHERE id = ?", [approval.entity_id]);
    } else if (approval.action_type === 'RESULTS_PUBLISH') {
      await query("UPDATE result_publications SET status = 'published', published_by = ?, published_at = NOW() WHERE id = ?", [req.user.id, approval.entity_id]);
    } else if (approval.action_type === 'RESULTS_RELEASE') {
      const payload = typeof approval.payload === 'string' ? JSON.parse(approval.payload) : (approval.payload || {});
      await query("UPDATE result_publications SET status = 'released', release_at = ?, released_by = ? WHERE id = ? AND status = 'published'", [payload.release_at || new Date(), req.user.id, approval.entity_id]);
    } else if (approval.action_type === 'RESULTS_IMPORT') {
      const payload = typeof approval.payload === 'string' ? JSON.parse(approval.payload) : (approval.payload || {});
      for (const result of payload.results || []) {
        await query(`INSERT INTO entry_results (candidate_id, subject_id, marks, grade, points, source, imported_by)
          VALUES (?, ?, ?, ?, ?, 'import', ?)
          ON DUPLICATE KEY UPDATE marks = VALUES(marks), grade = VALUES(grade), points = VALUES(points), imported_by = VALUES(imported_by), imported_at = NOW()`, [result.candidate_id, result.subject_id, result.mark, result.grade, result.points, req.user.id]);
      }
      await query("UPDATE exam_entries SET status = 'results_received', import_file_hash = COALESCE(import_file_hash, '') WHERE id = ?", [approval.entity_id]);
    } else if (approval.action_type === 'FEE_STRUCTURE_ACTIVATION') {
      await query("UPDATE fee_structures SET status = 'active' WHERE id = ? AND status = 'pending_approval'", [approval.entity_id]);
    } else if (approval.action_type === 'INVOICE_VOID') {
      await query("UPDATE invoices SET status = 'voided' WHERE id = ? AND status <> 'voided'", [approval.entity_id]);
    }

    await query(
      "UPDATE approvals SET status = 'approved', approved_by = ?, decided_at = NOW(), processed_at = NOW() WHERE id = ? AND status = 'pending'",
      [req.user.id, approval.id]
    );
    try { await query('INSERT INTO audit_logs (id, school_id, user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?,?,?)', ['LOG' + Date.now().toString(36), approval.school_id, req.user.id, 'APPROVAL_APPROVED', approval.entity_type, approval.entity_id, JSON.stringify({ action_type: approval.action_type, requested_by: approval.requested_by })]); } catch (_) {}

    return res.json({ data: { message: `Action ${approval.action_type} approved and executed successfully.` } });
  } catch (err) {
    console.error('Approve error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Approval execution failed.' } });
  }
});

// POST /approvals/:id/reject
router.post('/approvals/:id/reject', authenticateToken, requireRoles('head', 'deputy_head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const schoolId = req.params.schoolId || req.user.school_id;
    const approval = await queryOne('SELECT * FROM approvals WHERE (id = ? OR uuid = ?) AND school_id = ?', [id, id, schoolId]);
    if (!approval) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Approval request not found.' } });
    if (approval.requested_by === req.user.id) return res.status(403).json({ error: { code: 'MAKER_CHECKER_VIOLATION', message: 'You cannot reject your own approval request.' } });

    await query(
      "UPDATE approvals SET status = 'rejected', approved_by = ?, rejection_reason = ?, decided_at = NOW(), processed_at = NOW() WHERE id = ? AND status = 'pending'",
      [req.user.id, reason || 'Rejected by administrator', approval.id]
    );
    try { await query('INSERT INTO audit_logs (id, school_id, user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?,?,?)', ['LOG' + Date.now().toString(36), approval.school_id, req.user.id, 'APPROVAL_REJECTED', approval.entity_type, approval.entity_id, JSON.stringify({ action_type: approval.action_type, requested_by: approval.requested_by, reason: reason || null })]); } catch (_) {}

    return res.json({ data: { message: 'Approval request rejected.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Rejection failed.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DATA PRIVACY (POTRAZ Data Protection Act [Chapter 12:07] / GDPR)
// ─────────────────────────────────────────────────────────────────────────────

// GET /privacy/my-data (Subject Access Request - SAR)
router.get('/privacy/my-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userData = await queryOne('SELECT id, uuid, username, email, phone, role, created_at FROM users WHERE id = ?', [userId]);
    const auditLogs = await query('SELECT action, entity_type, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [userId]);

    return res.json({
      data: {
        personal_info: userData,
        activity_history: auditLogs,
        rights_notice: 'Under Cyber and Data Protection Act [Chapter 12:07], you have the right to inspect and request correction/erasure of your personal data.'
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to compile data subject report.' } });
  }
});

// POST /privacy/erase (Right to be forgotten - Account Deletion Request)
router.post('/privacy/erase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Anonymize user record
    const anonUsername = 'deleted_user_' + Date.now();
    await query(
      "UPDATE users SET username = ?, email = NULL, phone = NULL, status = 'suspended', password_hash = '' WHERE id = ?",
      [anonUsername, userId]
    );
    await query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?", [userId]);

    return res.json({ data: { message: 'Personal identifiable data has been erased in compliance with privacy regulations.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Data erasure failed.' } });
  }
});

module.exports = router;
