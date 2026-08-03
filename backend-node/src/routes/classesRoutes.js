const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { calculatePrimaryUnits } = require('../utils/gradeCalculator');

// GET /schools/:schoolId/classes
router.get('/classes', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const classes = await query(
      `SELECT c.*, stf.name as form_master_name, COUNT(st.id) as total_students
       FROM classes c
       LEFT JOIN staff stf ON c.form_master_id = stf.id
       LEFT JOIN students st ON c.id = st.class_id AND st.status = 'active'
       WHERE c.school_id = ?
       GROUP BY c.id
       ORDER BY c.name ASC`,
      [schoolId]
    );
    return res.json({ data: classes });
  } catch (err) {
    console.error('Get classes error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch classes.' } });
  }
});

// POST /schools/:schoolId/classes
router.post('/classes', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, level, capacity, form_master_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Class name is required.' } });
    }

    const classId = 'CLS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO classes (id, school_id, name, level, capacity, form_master_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [classId, schoolId, name.trim(), level || 'Primary', parseInt(capacity || 40), form_master_id || null]
    );

    const created = await queryOne('SELECT c.*, stf.name as form_master_name FROM classes c LEFT JOIN staff stf ON c.form_master_id = stf.id WHERE c.id = ?', [classId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create class error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create class.' } });
  }
});

// DELETE /schools/:schoolId/classes/:id
router.delete('/classes/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    await query('DELETE FROM classes WHERE id = ? AND school_id = ?', [id, schoolId]);
    return res.json({ data: { message: 'Class removed successfully.' } });
  } catch (err) {
    console.error('Delete class error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete class.' } });
  }
});

// POST /schools/:schoolId/classes/promote
router.post('/classes/promote', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { source_class_id, target_class_id, student_ids } = req.body;

    if (!target_class_id || !student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Target class and student IDs array are required.' } });
    }

    const placeholders = student_ids.map(() => '?').join(',');
    await query(
      `UPDATE students SET class_id = ? WHERE id IN (${placeholders}) AND school_id = ?`,
      [target_class_id, ...student_ids, schoolId]
    );

    return res.json({ data: { message: `Successfully promoted ${student_ids.length} students to new class.` } });
  } catch (err) {
    console.error('Promote students error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to promote students.' } });
  }
});

// GET /schools/:schoolId/subjects
router.get('/subjects', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
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
    console.error('Get subjects error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch subjects.' } });
  }
});


// POST /schools/:schoolId/subjects
router.post('/subjects', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { name, code, category } = req.body;

    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Subject name is required.' } });
    }

    const subjectId = 'SUB' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO subjects (id, name, code, category, created_by) VALUES (?, ?, ?, ?, ?)`,
      [subjectId, name.trim(), code ? code.trim().toUpperCase() : name.substr(0, 3).toUpperCase(), category || 'general', req.user.id]
    );

    const created = await queryOne('SELECT * FROM subjects WHERE id = ?', [subjectId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create subject error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to add subject.' } });
  }
});

// DELETE /schools/:schoolId/subjects/:id
router.delete('/subjects/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM subjects WHERE id = ?', [id]);
    return res.json({ data: { message: 'Subject removed successfully.' } });
  } catch (err) {
    console.error('Delete subject error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete subject.' } });
  }
});

// GET /schools/:schoolId/classes/:classId/attendance
router.get('/classes/:classId/attendance', authenticateToken, async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { date } = req.query;
    const recordDate = date || new Date().toISOString().slice(0, 10);

    const students = await query(
      `SELECT id as student_id, CONCAT(first_name, ' ', last_name) as student_name, admission_number
       FROM students
       WHERE school_id = ? AND class_id = ? AND status = 'active'
       ORDER BY first_name ASC`,
      [schoolId, classId]
    );

    const records = await query(
      `SELECT a.*, st.first_name, st.last_name, CONCAT(st.first_name, ' ', st.last_name) as student_name
       FROM attendance a
       JOIN students st ON a.student_id = st.id
       WHERE a.school_id = ? AND st.class_id = ? AND a.date = ?`,
      [schoolId, classId, recordDate]
    );

    return res.json({
      data: {
        students,
        records
      }
    });
  } catch (err) {
    console.error('Get class attendance error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch class attendance.' } });
  }
});

// POST /schools/:schoolId/classes/:classId/attendance
router.post('/classes/:classId/attendance', authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
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
    console.error('Post class attendance error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to save attendance.' } });
  }
});

// GET /schools/:schoolId/classes/:classId/results/export
router.get('/classes/:classId/results/export', authenticateToken, async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { term } = req.query;

    const students = await query(
      `SELECT id as student_id, first_name, last_name, admission_number
       FROM students
       WHERE school_id = ? AND class_id = ? AND status = 'active'
       ORDER BY first_name ASC`,
      [schoolId, classId]
    );

    const studentResults = [];
    for (const st of students) {
      let sql = `
        SELECT SUM(g.grade_value * COALESCE(g.weight, 1.0)) / NULLIF(SUM(COALESCE(g.weight, 1.0)), 0) as subject_avg
        FROM grades g
        WHERE g.school_id = ? AND g.student_id = ?
      `;
      const params = [schoolId, st.student_id];
      if (term) {
        sql += ' AND g.term = ?';
        params.push(term);
      }
      sql += ' GROUP BY g.subject';

      const subjectResults = await query(sql, params);
      let totalMarkSum = 0;
      let subjectCount = 0;
      subjectResults.forEach(sub => {
        const avg = parseFloat(sub.subject_avg || 0);
        totalMarkSum += avg;
        subjectCount += 1;
      });

      const overallPercentage = subjectCount > 0 ? parseFloat((totalMarkSum / subjectCount).toFixed(1)) : 0;
      const overallCalc = calculatePrimaryUnits(overallPercentage);

      studentResults.push({
        student_id: st.student_id,
        admission_number: st.admission_number,
        student_name: `${st.first_name} ${st.last_name}`,
        overall_percentage: overallPercentage,
        grade: overallCalc.grade,
        pass_status: overallPercentage >= 50 ? 'Pass' : 'Fail'
      });
    }

    studentResults.sort((a, b) => b.overall_percentage - a.overall_percentage);
    studentResults.forEach((item, idx) => { item.rank = idx + 1; });

    let csvContent = 'Class Position,Admission Number,Student Name,Term Average (%),Grade,Status\n';
    studentResults.forEach(r => {
      csvContent += `${r.rank},"${r.admission_number}","${r.student_name}",${r.overall_percentage},"${r.grade}","${r.pass_status}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=results_${classId}_${term || 'term'}.csv`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export class results error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to export class results.' } });
  }
});

// GET /schools/:schoolId/classes/:classId/results
router.get('/classes/:classId/results', authenticateToken, async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { term } = req.query;

    const students = await query(
      `SELECT id as student_id, first_name, last_name, admission_number
       FROM students
       WHERE school_id = ? AND class_id = ? AND status = 'active'
       ORDER BY first_name ASC`,
      [schoolId, classId]
    );

    let isPublished = false;
    try {
      const pubRes = await queryOne(
        `SELECT * FROM results WHERE school_id = ? AND class_id = ? AND term = ?`,
        [schoolId, classId, term || '2026-T1']
      );
      if (pubRes) isPublished = true;
    } catch (e) {}

    const studentResults = [];
    for (const st of students) {
      let sql = `
        SELECT g.subject as subject_id, g.subject as subject_name,
               SUM(g.grade_value * COALESCE(g.weight, 1.0)) / NULLIF(SUM(COALESCE(g.weight, 1.0)), 0) as subject_avg
        FROM grades g
        WHERE g.school_id = ? AND g.student_id = ?
      `;
      const params = [schoolId, st.student_id];
      if (term) {
        sql += ' AND g.term = ?';
        params.push(term);
      }
      sql += ' GROUP BY g.subject';

      const subjectResults = await query(sql, params);
      let totalMarkSum = 0;
      let subjectCount = 0;

      const subjects = subjectResults.map(sub => {
        const avg = parseFloat(sub.subject_avg || 0);
        const calc = calculatePrimaryUnits(avg);
        totalMarkSum += avg;
        subjectCount += 1;
        return {
          subject_id: sub.subject_id,
          subject_name: sub.subject_name,
          average: parseFloat(avg.toFixed(1)),
          grade: calc.grade,
          units: calc.units
        };
      });

      const overallPercentage = subjectCount > 0 ? parseFloat((totalMarkSum / subjectCount).toFixed(1)) : 0;
      const overallCalc = calculatePrimaryUnits(overallPercentage);

      studentResults.push({
        student_id: st.student_id,
        first_name: st.first_name,
        last_name: st.last_name,
        student_name: `${st.first_name} ${st.last_name}`,
        admission_number: st.admission_number,
        subjects,
        overall_percentage: overallPercentage,
        grade: overallCalc.grade,
        pass_status: overallPercentage >= 50 ? 'pass' : 'fail',
        status: isPublished ? 'published' : 'draft'
      });
    }

    const sorted = [...studentResults].sort((a, b) => b.overall_percentage - a.overall_percentage);
    const classTotal = sorted.length;

    sorted.forEach((item, idx) => {
      item.rank = idx + 1;
      item.class_total = classTotal;
      item.form_rank = idx + 1;
      item.form_total = classTotal;
    });

    return res.json({ data: sorted });
  } catch (err) {
    console.error('Get class results error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch class results.' } });
  }
});

module.exports = router;
