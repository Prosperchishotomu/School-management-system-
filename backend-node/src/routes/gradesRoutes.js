const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { calculatePrimaryUnits, calculateALevelPoints } = require('../utils/gradeCalculator');

// GET /schools/:schoolId/classes/:classId/grades
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { subject, term } = req.query;

    let sql = `
      SELECT g.*, st.first_name, st.last_name, st.admission_number, g.subject as subject_name
      FROM grades g
      JOIN students st ON g.student_id = st.id
      WHERE g.school_id = ? AND st.class_id = ?
    `;
    const params = [schoolId, classId];

    if (subject) {
      sql += ' AND g.subject = ?';
      params.push(subject);
    }
    if (term) {
      sql += ' AND g.term = ?';
      params.push(term);
    }

    sql += ' ORDER BY st.first_name ASC, g.assessment_type ASC';

    const grades = await query(sql, params);

    const grouped = {};
    grades.forEach(g => {
      const key = `${g.student_id}_${g.subject}`;
      if (!grouped[key]) {
        grouped[key] = {
          student_id: g.student_id,
          first_name: g.first_name,
          last_name: g.last_name,
          admission_number: g.admission_number,
          subject_id: g.subject,
          subject_name: g.subject,
          scores: [],
          test_count: 0,
          total_weighted_mark: 0,
          total_weight: 0
        };
      }
      grouped[key].scores.push(g);
      grouped[key].test_count += 1;
      const weight = parseFloat(g.weight || 1.0);
      const markVal = parseFloat(g.grade_value || 0);
      grouped[key].total_weighted_mark += (markVal * weight);
      grouped[key].total_weight += weight;
    });

    const averagedGrades = Object.values(grouped).map(item => {
      const avgMark = item.total_weight > 0 ? (item.total_weighted_mark / item.total_weight) : 0;
      const calc = calculatePrimaryUnits(avgMark);
      return {
        ...item,
        unified_average: parseFloat(avgMark.toFixed(1)),
        letter_grade: calc.grade,
        unit_value: calc.units
      };
    });

    return res.json({
      data: {
        raw_grades: grades,
        averaged_grades: averagedGrades
      }
    });
  } catch (err) {
    console.error('Get grades error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch grades.' } });
  }
});

// POST /schools/:schoolId/classes/:classId/grades
router.post('/', authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { student_id, subject, grade_value, assessment_type, term, weight } = req.body;

    if (!student_id || (!subject && !req.body.subject_id) || grade_value === undefined) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Student ID, Subject, and Grade Value are required.' } });
    }

        const gradeId = 'GRD' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    const mark = parseFloat(grade_value);
    const subjName = subject || req.body.subject_id;

    await query(
      `INSERT INTO grades (id, school_id, student_id, class_id, subject, grade_value, assessment_type, term, weight)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [gradeId, schoolId, student_id, classId, subjName, mark, assessment_type || 'test', term || 'Term 1', parseFloat(weight || 1.0)]
    );

    const created = await queryOne('SELECT * FROM grades WHERE id = ?', [gradeId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Post grade error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to record grade.' } });
  }
});

// POST /schools/:schoolId/classes/:classId/grades/batch
router.post('/batch', authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { subject, subject_id, assessment_type, term, weight, entries } = req.body;
    const subjName = subject || subject_id;

    if (!subjName || !entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Subject and grade entries array are required.' } });
    }

    // Normalize assessment_type to valid ENUM ('test', 'exam', 'coursework')
    const rawType = (assessment_type || 'test').toString().toLowerCase();
    let validAssType = 'test';
    if (['exam', 'final', 'midterm'].includes(rawType)) validAssType = 'exam';
    else if (['coursework', 'assignment', 'project', 'homework'].includes(rawType)) validAssType = 'coursework';

    const currentTerm = term || 'Term 1';
    const numWeight = parseFloat(weight || 1.0);

    let savedCount = 0;
    for (const entry of entries) {
      const studentId = entry.student_id || entry.id;
      if (studentId && entry.grade_value !== undefined && entry.grade_value !== '' && entry.grade_value !== null) {
        const mark = parseFloat(entry.grade_value);
        if (isNaN(mark)) continue;

        try {
          // Check if existing grade entry exists
          const existing = await queryOne(
            `SELECT id FROM grades WHERE school_id = ? AND student_id = ? AND class_id = ? AND subject = ? AND term = ? AND assessment_type = ?`,
            [schoolId, studentId, classId, subjName, currentTerm, validAssType]
          );

          if (existing) {
            await query(
              `UPDATE grades SET grade_value = ?, weight = ? WHERE id = ?`,
              [mark, numWeight, existing.id]
            );
          } else {
            const gradeId = 'GRD' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
            await query(
              `INSERT INTO grades (id, school_id, student_id, class_id, subject, grade_value, assessment_type, term, weight)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [gradeId, schoolId, studentId, classId, subjName, mark, validAssType, currentTerm, numWeight]
            );
          }
          savedCount++;
        } catch (entryErr) {
          console.warn(`Error saving grade for student ${studentId}:`, entryErr.message);
        }
      }
    }

    return res.json({ data: { message: `Recorded ${savedCount} grades successfully.` } });
  } catch (err) {
    console.error('Batch grades error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to record batch grades.' } });
  }
});

// GET /schools/:schoolId/classes/:classId/results
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { term } = req.query;

    const students = await query('SELECT id, first_name, last_name, admission_number FROM students WHERE school_id = ? AND class_id = ? AND status = "active" ORDER BY first_name ASC', [schoolId, classId]);
    
    const results = [];
    for (const st of students) {
      let sql = `
        SELECT g.subject as subject_id, g.subject as subject_name,
               SUM(g.grade_value * COALESCE(g.weight, 1.0)) / NULLIF(SUM(COALESCE(g.weight, 1.0)), 0) as subject_avg
        FROM grades g
        WHERE g.student_id = ?
      `;
      const params = [st.id];

      if (term) {
        sql += ' AND g.term = ?';
        params.push(term);
      }

      sql += ' GROUP BY g.subject';

      const subjectResults = await query(sql, params);

      let totalUnits = 0;
      const formattedSubjects = subjectResults.map(sub => {
        const avg = parseFloat(sub.subject_avg || 0);
        const calc = calculatePrimaryUnits(avg);
        totalUnits += calc.units;
        return {
          subject_id: sub.subject_id,
          subject_name: sub.subject_name,
          average: parseFloat(avg.toFixed(1)),
          grade: calc.grade,
          units: calc.units
        };
      });

      results.push({
        student: st,
        subjects: formattedSubjects,
        total_units: totalUnits
      });
    }

    return res.json({ data: results });
  } catch (err) {
    console.error('Get results ledger error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate results ledger.' } });
  }
});

// GET /schools/:schoolId/grade-thresholds  (school-level route — mounted separately in app.js)
// Returns the grading scale thresholds for display and grade calculation
const thresholdsRouter = express.Router({ mergeParams: true });

thresholdsRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    // Check if the school has custom thresholds stored
    let thresholds = [];
    try {
      thresholds = await query(
        'SELECT * FROM grade_thresholds WHERE school_id = ? ORDER BY min_score DESC',
        [schoolId]
      );
    } catch (e) {
      // Table may not exist — return system defaults
    }

    if (!thresholds || thresholds.length === 0) {
      // Default Zimbabwe ZIMSEC Primary grading scale
      thresholds = [
        { grade: 'A', label: 'Distinction',  min_score: 75, max_score: 100, points: 1, color: '#0d9488' },
        { grade: 'B', label: 'Merit',         min_score: 65, max_score: 74,  points: 2, color: '#3b82f6' },
        { grade: 'C', label: 'Credit',        min_score: 55, max_score: 64,  points: 3, color: '#6366f1' },
        { grade: 'D', label: 'Pass',          min_score: 45, max_score: 54,  points: 4, color: '#f59e0b' },
        { grade: 'E', label: 'Borderline',    min_score: 40, max_score: 44,  points: 5, color: '#f97316' },
        { grade: 'U', label: 'Ungraded',      min_score: 0,  max_score: 39,  points: 9, color: '#ef4444' },
      ];
    }

    return res.json({ data: thresholds });
  } catch (err) {
    console.error('Get grade thresholds error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch grade thresholds.' } });
  }
});

module.exports = { router, thresholdsRouter };
