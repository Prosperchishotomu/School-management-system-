const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /schools
router.get('/schools', async (req, res) => {
  try {
    const schools = await query('SELECT * FROM schools ORDER BY name ASC');
    return res.json({ data: schools });
  } catch (err) {
    console.error('Get schools error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch schools.' } });
  }
});

// GET /schools/:id
router.get('/schools/:id', authenticateToken, async (req, res) => {
  try {
    const school = await queryOne('SELECT * FROM schools WHERE id = ?', [req.params.id]);
    if (!school) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'School not found.' } });
    return res.json({ data: school });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch school profile.' } });
  }
});

// GET /schools/:schoolId/users
router.get('/schools/:schoolId/users', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const users = await query('SELECT id, username, email, role, status, created_at FROM users WHERE school_id = ? ORDER BY username ASC', [req.params.schoolId]);
    return res.json({ data: users });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch user accounts.' } });
  }
});

// GET /schools/:schoolId/attendance
router.get('/schools/:schoolId/attendance', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { date, class_id } = req.query;
    let sql = 'SELECT a.*, st.first_name, st.last_name, st.admission_number FROM attendance a JOIN students st ON a.student_id = st.id WHERE a.school_id = ?';
    const params = [schoolId];
    if (date) { sql += ' AND a.date = ?'; params.push(date); }
    if (class_id) { sql += ' AND st.class_id = ?'; params.push(class_id); }
    const attendance = await query(sql, params);
    return res.json({ data: attendance });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch attendance.' } });
  }
});

// POST /schools/:schoolId/attendance
router.post('/schools/:schoolId/attendance', authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { date, entries } = req.body;
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Attendance entries array is required.' } });
    }

    const recordDate = date || new Date().toISOString().slice(0, 10);
    for (const entry of entries) {
      if (entry.student_id) {
        const attId = 'ATT' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        await query(
          `INSERT INTO attendance (id, school_id, student_id, date, status, remarks, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks)`,
          [attId, schoolId, entry.student_id, recordDate, entry.status || 'present', entry.remarks || null, req.user.id]
        );
      }
    }
    return res.json({ data: { message: `Attendance saved for ${entries.length} students.` } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to save attendance.' } });
  }
});

// GET /schools/:schoolId/expenses
router.get('/schools/:schoolId/expenses', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const expenses = await query('SELECT * FROM expenses WHERE school_id = ? ORDER BY expense_date DESC', [schoolId]);

    // Build category breakdown
    const catMap = {};
    expenses.forEach(e => {
      const cat = e.category || 'other';
      catMap[cat] = (catMap[cat] || 0) + parseFloat(e.amount || 0);
    });
    const category_breakdown = Object.entries(catMap).map(([category, total]) => ({ category, total }));

    // Fee revenue summary
    let totalFeeRevenue = 0;
    try {
      const [feeRes] = await query('SELECT COALESCE(SUM(amount_paid),0) as total FROM fees WHERE school_id = ?', [schoolId]);
      totalFeeRevenue = parseFloat(feeRes?.total || 0);
    } catch (e) {}

    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    return res.json({
      data: {
        expenses,
        category_breakdown,
        summary: {
          total_fee_revenue: totalFeeRevenue,
          total_expenses: totalExpenses,
          net_profit_loss: totalFeeRevenue - totalExpenses
        }
      }
    });
  } catch (err) {
    console.error('Get expenses error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to retrieve operational expenditure records.' } });
  }
});

// POST /schools/:schoolId/expenses
router.post('/schools/:schoolId/expenses', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { title, category, amount, payment_method, expense_date, notes } = req.body;
    if (!title || !amount) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Title and amount are required.' } });
    }
    const expId = 'EXP' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const validCategory = ['internet_ict','utilities_electricity','fuel_maintenance','food_catering','rent_accommodation','supplies','other'].includes(category) ? category : 'other';
    await query(
      `INSERT INTO expenses (id, school_id, title, category, amount, expense_date, vendor_name, receipt_ref, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [expId, schoolId, title.trim(), validCategory, parseFloat(amount), expense_date || new Date().toISOString().slice(0, 10), notes || null, payment_method || null, req.user.id]
    );
    const created = await queryOne('SELECT * FROM expenses WHERE id = ?', [expId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create expense error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create expense entry.' } });
  }
});

// GET /schools/:schoolId/hostels
router.get('/schools/:schoolId/hostels', authenticateToken, async (req, res) => {
  try {
    const hostels = await query('SELECT * FROM hostels WHERE school_id = ? ORDER BY name ASC', [req.params.schoolId]);
    return res.json({ data: hostels });
  } catch (err) {
    // Return empty array if hostels table doesn't exist yet
    return res.json({ data: [] });
  }
});

// POST /schools/:schoolId/hostels
router.post('/schools/:schoolId/hostels', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, capacity, type, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Hostel name is required.' } });
    }
    const id = 'HST' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO hostels (id, school_id, name, capacity, type, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, schoolId, name.trim(), capacity || null, type || 'mixed', description || null]
    );
    const created = await queryOne('SELECT * FROM hostels WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create hostel.' } });
  }
});

// GET /schools/:schoolId/announcements
router.get('/schools/:schoolId/announcements', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { class_id } = req.query;
    let sql = `SELECT a.*, COALESCE(u.username, 'School Office') as author_name FROM announcements a
               LEFT JOIN users u ON a.created_by = u.id
               WHERE a.school_id = ?`;
    const params = [schoolId];

    if (class_id && class_id !== 'undefined' && class_id !== 'null') {
      sql += ' AND (a.class_id IS NULL OR a.class_id = ?)';
      params.push(class_id);
    }

    sql += ' ORDER BY a.created_at DESC';
    let announcements = [];
    try {
      announcements = await query(sql, params);
    } catch (dbErr) {
      // Fallback query if join on created_by fails
      announcements = await query('SELECT *, "School Office" as author_name FROM announcements WHERE school_id = ? ORDER BY created_at DESC', [schoolId]);
    }
    return res.json({ data: announcements || [] });
  } catch (err) {
    console.error('Get announcements error:', err);
    return res.json({ data: [] });
  }
});

// POST /schools/:schoolId/announcements
router.post('/schools/:schoolId/announcements', authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { title, body, content, class_id, expires_at, target_audience } = req.body;
    const messageBody = body || content;
    if (!title || !messageBody) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Title and message body are required.' } });
    }

    // Validate expires_at must be a future date
    if (expires_at) {
      const expDate = new Date(expires_at);
      if (expDate <= new Date()) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Expiry date must be a future date.' } });
      }
    }

    const annId = 'ANN' + Math.random().toString(36).substr(2, 5).toUpperCase();
    await query(
      `INSERT INTO announcements (id, school_id, title, body, class_id, expires_at, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [annId, schoolId, title.trim(), messageBody.trim(), class_id || null, expires_at || null, req.user.id]
    );
    const created = await queryOne(
      `SELECT a.*, u.username as author_name FROM announcements a LEFT JOIN users u ON a.created_by = u.id WHERE a.id = ?`,
      [annId]
    );
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create announcement error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to post announcement.' } });
  }
});

// DELETE /schools/:schoolId/announcements/:id
router.delete('/schools/:schoolId/announcements/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    await query('DELETE FROM announcements WHERE id = ? AND school_id = ?', [id, schoolId]);
    return res.json({ data: { message: 'Announcement deleted.' } });
  } catch (err) {
    console.error('Delete announcement error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete announcement.' } });
  }
});

// GET /schools/:schoolId/dashboard/extended
router.get('/schools/:schoolId/dashboard/extended', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const today = new Date().toISOString().slice(0, 10);

    let totalStudents = 0;
    try {
      const resSt = await query("SELECT COUNT(*) as cnt FROM students WHERE school_id = ? AND status IN ('active', 'enrolled')", [schoolId]);
      totalStudents = resSt[0]?.cnt || 0;
    } catch (e) {}

    let totalStaff = 0;
    try {
      const resStf = await query("SELECT COUNT(*) as cnt FROM staff WHERE school_id = ? AND (status IS NULL OR status IN ('active', 'enrolled'))", [schoolId]);
      totalStaff = resStf[0]?.cnt || 0;
    } catch (e) {}

    let totalClasses = 0;
    try {
      const resCls = await query('SELECT COUNT(*) as cnt FROM classes WHERE school_id = ?', [schoolId]);
      totalClasses = resCls[0]?.cnt || 0;
    } catch (e) {}

    let attPct = 0;
    let registersSubmitted = 0;
    try {
      const resAtt = await query(
        `SELECT
           COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
           COUNT(*) as total_records
         FROM attendance WHERE school_id = ? AND date = ?`,
        [schoolId, today]
      );
      if (resAtt[0] && resAtt[0].total_records > 0) {
        attPct = Math.round((resAtt[0].present_count / resAtt[0].total_records) * 100);
      }

      const resReg = await query(
        `SELECT COUNT(DISTINCT st.class_id) as cnt
         FROM attendance a
         JOIN students st ON a.student_id = st.id
         WHERE a.school_id = ? AND a.date = ?`,
        [schoolId, today]
      );
      registersSubmitted = resReg[0]?.cnt || 0;
    } catch (e) {}

    let totalCollected = 0, totalDue = 0, feesCollectedPct = 0;
    try {
      const resFee = await query(
        `SELECT
           COALESCE(SUM(amount_due), 0) as total_due,
           COALESCE(SUM(amount_paid), 0) as total_collected
         FROM fees WHERE school_id = ?`,
        [schoolId]
      );
      if (resFee[0]) {
        totalDue = parseFloat(resFee[0].total_due || 0);
        totalCollected = parseFloat(resFee[0].total_collected || 0);
        if (totalDue > 0) {
          feesCollectedPct = Math.min(100, Math.round((totalCollected / totalDue) * 100));
        }
      }
    } catch (e) {}

    let classesAttendance = [];
    try {
      classesAttendance = await query(
        `SELECT c.id, c.name, COALESCE(c.level, 'Primary') as grade_level,
                IF(COUNT(a.id) > 0, 'submitted', 'pending') as status,
                COALESCE(COUNT(CASE WHEN a.status = 'present' THEN 1 END), 0) as present,
                COALESCE(COUNT(CASE WHEN a.status = 'absent' THEN 1 END), 0) as absent,
                COALESCE(ROUND(COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0), 0), 0) as pct
         FROM classes c
         LEFT JOIN students st ON c.id = st.class_id AND st.status = 'active'
         LEFT JOIN attendance a ON st.id = a.student_id AND a.date = ?
         WHERE c.school_id = ?
         GROUP BY c.id, c.name, c.level`,
        [today, schoolId]
      );
    } catch (e) {}

    let gradeAverages = [];
    try {
      gradeAverages = await query(
        `SELECT c.name as class_name, g.subject, ROUND(AVG(g.grade_value), 1) as avg_score
         FROM grades g
         JOIN students st ON g.student_id = st.id
         JOIN classes c ON st.class_id = c.id
         WHERE g.school_id = ?
         GROUP BY c.id, c.name, g.subject`,
        [schoolId]
      );
    } catch (e) {}

    let topStudents = [];
    try {
      topStudents = await query(
        `SELECT st.id, CONCAT(st.first_name, ' ', st.last_name) as name, c.name as class_name, ROUND(AVG(g.grade_value), 1) as avg_grade
         FROM grades g
         JOIN students st ON g.student_id = st.id
         JOIN classes c ON st.class_id = c.id
         WHERE g.school_id = ?
         GROUP BY st.id, st.first_name, st.last_name, c.name
         ORDER BY avg_grade DESC
         LIMIT 5`,
        [schoolId]
      );
    } catch (e) {}

    let bottomStudents = [];
    try {
      bottomStudents = await query(
        `SELECT st.id, CONCAT(st.first_name, ' ', st.last_name) as name, c.name as class_name, ROUND(AVG(g.grade_value), 1) as avg_grade
         FROM grades g
         JOIN students st ON g.student_id = st.id
         JOIN classes c ON st.class_id = c.id
         WHERE g.school_id = ?
         GROUP BY st.id, st.first_name, st.last_name, c.name
         HAVING avg_grade < 50
         ORDER BY avg_grade ASC
         LIMIT 5`,
        [schoolId]
      );
    } catch (e) {}

    let staffActivity = [];
    try {
      staffActivity = await query(
        `SELECT stf.id, stf.name, COALESCE(stf.role, 'Teacher') as role, u.username, u.updated_at as last_login
         FROM staff stf
         LEFT JOIN users u ON u.school_id = stf.school_id AND (u.email = stf.email OR u.username = stf.name)
         WHERE stf.school_id = ?
         ORDER BY stf.name ASC`,
        [schoolId]
      );
    } catch (e) {}

    let overdueTasks = [];
    try {
      overdueTasks = await query(
        `SELECT t.*, u.username as teacher_name, c.name as class_name
         FROM tasks t
         LEFT JOIN users u ON t.created_by = u.id
         LEFT JOIN classes c ON t.class_id = c.id
         WHERE t.school_id = ? AND t.due_date < ? AND t.status != 'completed'`,
        [schoolId, today]
      );
    } catch (e) {}

    let upcomingExamsCount = 0;
    try {
      const [ex] = await query('SELECT COUNT(*) as cnt FROM exams WHERE school_id = ? AND exam_date >= ?', [schoolId, today]);
      upcomingExamsCount = ex?.cnt || 0;
    } catch (e) {}

    let openIncidentsCount = 0;
    try {
      const [inc] = await query("SELECT COUNT(*) as cnt FROM discipline_incidents WHERE school_id = ? AND status = 'open'", [schoolId]);
      openIncidentsCount = inc?.cnt || 0;
    } catch (e) {}

    let disciplineFeed = [];
    try {
      disciplineFeed = await query("SELECT * FROM discipline_incidents WHERE school_id = ? ORDER BY incident_date DESC LIMIT 10", [schoolId]);
    } catch (e) {}

    let recentComments = [];
    try {
      recentComments = await query("SELECT * FROM report_comments WHERE school_id = ? ORDER BY created_at DESC LIMIT 10", [schoolId]);
    } catch (e) {}

    let licenseData = { warning: false, days_left: 365, expires_at: null };
    try {
      const lic = await queryOne('SELECT * FROM licenses WHERE school_id = ? ORDER BY expires_at DESC LIMIT 1', [schoolId]);
      if (lic && lic.expires_at) {
        const expDate = new Date(lic.expires_at);
        const now = new Date();
        const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
        licenseData = {
          warning: daysLeft <= 30,
          days_left: Math.max(0, daysLeft),
          expires_at: lic.expires_at
        };
      }
    } catch (e) {}

    return res.json({
      data: {
        kpis: {
          total_students:       totalStudents,
          total_staff:          totalStaff,
          total_classes:        totalClasses,
          attendance_today_pct: attPct,
          registers_submitted:  registersSubmitted,
          registers_pending:    Math.max(0, totalClasses - registersSubmitted),
          fees_collected_pct:   feesCollectedPct,
          total_fees_collected: totalCollected,
          total_fees_due:       totalDue,
          upcoming_exams:       upcomingExamsCount,
          open_incidents:       openIncidentsCount
        },
        attendance_detail: classesAttendance,
        grade_averages: gradeAverages,
        top_students: topStudents,
        bottom_students: bottomStudents,
        fee_donut: { collected: totalCollected, due: Math.max(0, totalDue - totalCollected) },
        fee_breakdown: [],
        staff_activity: staffActivity,
        overdue_tasks: overdueTasks,
        upcoming_exams: [],
        discipline_feed: disciplineFeed,
        recent_comments: recentComments,
        license: licenseData
      }
    });
  } catch (err) {
    console.error('Extended dashboard metrics error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate extended dashboard metrics.' } });
  }
});

module.exports = router;
