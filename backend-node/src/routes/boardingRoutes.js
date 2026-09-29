const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// HOUSES & HOUSE POINTS (Inter-House Sports / Competitions)
// ─────────────────────────────────────────────────────────────────────────────

// GET /houses
router.get('/houses', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const houses = await query(
      `SELECT h.*, u.username as house_master_name,
              COALESCE(SUM(hp.points), 0) as total_points,
              COUNT(DISTINCT st.id) as total_students
       FROM houses h
       LEFT JOIN employees e ON h.house_master_employee_id = e.id
       LEFT JOIN users u ON e.user_id = u.id
       LEFT JOIN house_points hp ON h.id = hp.house_id
       LEFT JOIN students st ON h.id = st.house_id
       WHERE h.school_id = ?
       GROUP BY h.id
       ORDER BY total_points DESC`,
      [schoolId]
    );
    return res.json({ data: houses });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch houses.' } });
  }
});

// POST /houses
router.post('/houses', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { name, color, house_master_employee_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'House name is required.' } });
    }

    const result = await query(
      'INSERT INTO houses (school_id, name, color, house_master_employee_id) VALUES (?, ?, ?, ?)',
      [schoolId, name.trim(), color || '#3B82F6', house_master_employee_id || null]
    );

    const created = await queryOne('SELECT * FROM houses WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create house.' } });
  }
});

// POST /houses/points (Award or deduct points)
router.post('/houses/points', authenticateToken, requireRoles('teacher', 'boarding_master', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { house_id, student_id, points, reason, category } = req.body;

    if (!house_id || points === undefined || !reason) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'house_id, points, and reason are required.' } });
    }

    const emp = await queryOne('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    const awardedBy = emp ? emp.id : req.user.id;

    const result = await query(
      `INSERT INTO house_points (school_id, house_id, student_id, points, reason, category, awarded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, house_id, student_id || null, parseInt(points), reason.trim(), category || 'general', awardedBy]
    );

    return res.status(201).json({ data: { id: result.insertId, house_id, points, reason } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to record house points.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXEAT PASS LIFECYCLE (Request -> Approval -> Warden Gate Check-Out -> Return Gate Check-In)
// ─────────────────────────────────────────────────────────────────────────────

// GET /exeats
router.get('/exeats', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { student_id, status } = req.query;

    let sql = `
      SELECT ex.*, st.admission_no, st.first_name, st.last_name, c.name as class_name,
             u_app.username as approver_name
      FROM exeats ex
      JOIN students st ON ex.student_id = st.id
      LEFT JOIN classes c ON st.class_id = c.id
      LEFT JOIN users u_app ON ex.approved_by = u_app.id
      WHERE ex.school_id = ?
    `;
    const params = [schoolId];

    if (student_id) { sql += ' AND ex.student_id = ?'; params.push(student_id); }
    if (status) { sql += ' AND ex.status = ?'; params.push(status); }

    sql += ' ORDER BY ex.created_at DESC';

    const records = await query(sql, params);
    return res.json({ data: records });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch exeat passes.' } });
  }
});

// POST /exeats (Request Exeat)
router.post('/exeats', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { student_id, exeat_type, reason, destination, departure_date, expected_return_date, emergency_contact_phone } = req.body;

    if (!student_id || !exeat_type || !departure_date || !expected_return_date) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'student_id, exeat_type, departure_date, and expected_return_date required.' } });
    }

    const uuid = 'EX' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const result = await query(
      `INSERT INTO exeats (uuid, school_id, student_id, exeat_type, reason, destination, departure_date, expected_return_date, emergency_contact_phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [uuid, schoolId, student_id, exeat_type, reason || '', destination || '', departure_date, expected_return_date, emergency_contact_phone || null]
    );

    const created = await queryOne('SELECT * FROM exeats WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create exeat error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to request exeat pass.' } });
  }
});

// POST /exeats/:id/approve (Boarding Master / Head Approval)
router.post('/exeats/:id/approve', authenticateToken, requireRoles('boarding_master', 'deputy_head', 'head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "Status must be 'approved' or 'rejected'." } });
    }

    await query(
      `UPDATE exeats 
       SET status = ?, approved_by = ?, approval_comments = ?, approved_at = NOW()
       WHERE id = ? OR uuid = ?`,
      [status, req.user.id, comments || null, id, id]
    );

    if (status === 'approved') {
      const exeat = await queryOne(`SELECT ex.id, ex.school_id, ex.student_id, st.first_name, st.last_name, g.user_id AS guardian_user_id
        FROM exeats ex INNER JOIN students st ON st.id = ex.student_id
        LEFT JOIN student_guardians sg ON sg.student_id = ex.student_id AND sg.is_primary = 1
        LEFT JOIN guardians g ON g.id = sg.guardian_id WHERE ex.id = ? OR ex.uuid = ?`, [id, id]);
      if (exeat?.guardian_user_id) {
        try { await query(`INSERT IGNORE INTO delivery_outbox (id, school_id, recipient_id, channel, event_type, reference_id, payload) VALUES (?, ?, ?, 'sms', 'exeat.approved', ?, ?)`, [`DLV${Date.now().toString(36)}`, exeat.school_id, exeat.guardian_user_id, String(exeat.id), JSON.stringify({ body: `Exeat approved for ${exeat.first_name} ${exeat.last_name}.` })]); } catch (_) {}
      }
    }

    return res.json({ data: { message: `Exeat pass ${status}.` } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to process exeat approval.' } });
  }
});

// POST /exeats/:id/check-out (Warden Gate Check-Out)
router.post('/exeats/:id/check-out', authenticateToken, requireRoles('boarding_master', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      `UPDATE exeats SET actual_departure_at = NOW(), status = 'checked_out' WHERE (id = ? OR uuid = ?) AND status = 'approved'`,
      [id, id]
    );
    return res.json({ data: { message: 'Student successfully checked out at gate.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Gate check-out failed.' } });
  }
});

// POST /exeats/:id/check-in (Warden Return Check-In)
router.post('/exeats/:id/check-in', authenticateToken, requireRoles('boarding_master', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      `UPDATE exeats SET actual_return_at = NOW(), status = 'returned' WHERE (id = ? OR uuid = ?) AND status = 'checked_out'`,
      [id, id]
    );
    return res.json({ data: { message: 'Student successfully checked back in.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Gate check-in failed.' } });
  }
});

module.exports = router;
