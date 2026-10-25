const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const {
  calculatePrimaryUnits,
  calculateECDGrade,
  calculateZimsecOGrade,
  calculateZimsecAGrade,
  determineLevelCategory,
  processStudentSubjects,
  rankStudentResults
} = require('../utils/gradeCalculator');

const getTermFromDate = (dateVal = new Date()) => {
  const d = new Date(dateVal);
  const month = d.getMonth(); // 0 = Jan, 11 = Dec
  if (month >= 0 && month <= 3) return 'Term 1';
  if (month >= 4 && month <= 7) return 'Term 2';
  return 'Term 3';
};

// GET /schools/:schoolId/classes/:classId/grades
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { subject, term } = req.query;

    const cls = await queryOne(
      'SELECT c.*, s.school_type FROM classes c LEFT JOIN schools s ON c.school_id = s.id WHERE c.id = ? AND c.school_id = ?',
      [classId, schoolId]
    );
    const levelCategory = determineLevelCategory(cls?.name, cls?.level, cls?.school_type);

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

    // Subject & Student Scoping:
    // If subject is selected, fetch students taking this subject
    let studentFilterSql = `
      SELECT id, first_name, last_name, admission_number, gender
      FROM students
      WHERE school_id = ? AND class_id = ? AND (status IN ('active', 'enrolled') OR status IS NULL OR status != 'transferred')
    `;
    const studentFilterParams = [schoolId, classId];

    if (subject) {
      // Check if student_subjects has enrollments for this class and subject
      let enrolledStudentIds = [];
      try {
        enrolledStudentIds = await query(
          `SELECT ss.student_id
           FROM student_subjects ss
           JOIN students st ON ss.student_id = st.id
           LEFT JOIN subjects sub ON ss.subject_id = sub.id
           WHERE st.school_id = ? AND st.class_id = ?
             AND (ss.subject_id = ? OR LOWER(sub.name) = LOWER(?) OR LOWER(sub.code) = LOWER(?))
             AND (ss.status = 'active' OR ss.status IS NULL)`,
          [schoolId, classId, subject, subject, subject]
        );
      } catch (subErr) {
        console.warn('Student subjects lookup warning:', subErr.message);
      }

      if (enrolledStudentIds.length > 0) {
        const idPlaceholders = enrolledStudentIds.map(() => '?').join(',');
        studentFilterSql += ` AND id IN (${idPlaceholders})`;
        studentFilterParams.push(...enrolledStudentIds.map(e => e.student_id));
      }
    }
    studentFilterSql += ' ORDER BY first_name ASC';
    const scopedStudents = await query(studentFilterSql, studentFilterParams);

    // Teacher Allocation Scoping:
    let allocatedSubjects = [];
    let isClassTeacher = false;
    const userRole = req.user.role;
    const userId = req.user.id;
    const isAdmin = ['school_admin', 'super_admin', 'principal', 'head', 'headmaster', 'deputy_head', 'admin'].includes(userRole);

    if (isAdmin) {
      allocatedSubjects = await query('SELECT id, name, code FROM subjects WHERE school_id = ? OR school_id IS NULL ORDER BY name ASC', [schoolId]);
      isClassTeacher = true;
    } else {
      // Check if class teacher / form master
      if (cls?.form_master_id === userId) isClassTeacher = true;
      const staffRecord = await queryOne('SELECT class_id FROM staff WHERE user_id = ? OR id = ?', [userId, userId]);
      if (staffRecord?.class_id === classId) isClassTeacher = true;

      // Check teaching assignments for this class
      const teacherAssignments = await query(
        `SELECT sub.id, sub.name, sub.code
         FROM teaching_assignments ta
         JOIN subjects sub ON ta.subject_id = sub.id
         WHERE ta.school_id = ? AND ta.class_id = ? AND (
           ta.teacher_id = ? OR ta.teacher_id IN (SELECT id FROM staff WHERE user_id = ?)
         )
         ORDER BY sub.name ASC`,
        [schoolId, classId, userId, userId]
      );

      if (isClassTeacher && (!cls?.level || cls.level.toLowerCase().includes('primary') || (cls.name || '').toLowerCase().includes('grade'))) {
        // Primary class teacher teaches all subjects
        allocatedSubjects = await query('SELECT id, name, code FROM subjects WHERE school_id = ? OR school_id IS NULL ORDER BY name ASC', [schoolId]);
      } else {
        allocatedSubjects = teacherAssignments;
      }
    }

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
      let letterGrade = '';
      let unitValue = null;
      let pointsValue = null;
      let descriptor = '';

      if (levelCategory === 'primary_g4_g7' || levelCategory === 'primary' || levelCategory === 'ecd_to_g3') {
        const calc = calculatePrimaryUnits(avgMark);
        letterGrade = `Unit ${calc.units}`;
        unitValue = calc.units;
        descriptor = calc.descriptor;
      } else if (levelCategory === 'a_level') {
        const calc = calculateZimsecAGrade(avgMark, '5_point');
        letterGrade = calc.grade;
        pointsValue = calc.points;
        descriptor = calc.remark;
      } else {
        const calc = calculateZimsecOGrade(avgMark);
        letterGrade = calc.grade;
        descriptor = calc.remark;
      }

      return {
        ...item,
        unified_average: parseFloat(avgMark.toFixed(1)),
        letter_grade: letterGrade,
        unit_value: unitValue,
        points: pointsValue,
        descriptor,
        level_category: levelCategory
      };
    });

    return res.json({
      data: {
        raw_grades: grades,
        averaged_grades: averagedGrades,
        level_category: levelCategory,
        students: scopedStudents,
        allocated_subjects: allocatedSubjects,
        is_class_teacher: isClassTeacher
      }
    });
  } catch (err) {
    console.error('Get grades error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch grades.' } });
  }
});

// Helper for saving batch or single grades
async function saveGradeEntry(schoolId, targetClassId, body) {
  const { student_id, subject, grade_value, assessment_type, term, weight, scores } = body;
  const resolvedTerm = term || getTermFromDate();
  const resolvedType = assessment_type || 'test';
  const resolvedSubject = subject || body.subject_id;

  if (scores && typeof scores === 'object') {
    // Batch scores save: { [student_id]: { ca1: 20, exam: 50 } } OR { [student_id]: 75 }
    const saved = [];
    for (const [stId, sVal] of Object.entries(scores)) {
      if (typeof sVal === 'object' && sVal !== null) {
        for (const [colName, val] of Object.entries(sVal)) {
          const num = parseFloat(val);
          if (!isNaN(num)) {
            const existing = await queryOne(
              'SELECT id FROM grades WHERE school_id = ? AND student_id = ? AND class_id = ? AND subject = ? AND term = ? AND assessment_name = ?',
              [schoolId, stId, targetClassId, resolvedSubject, resolvedTerm, colName]
            );
            if (existing) {
              await query('UPDATE grades SET grade_value = ?, synced_at = NOW() WHERE id = ?', [num, existing.id]);
              saved.push(existing.id);
            } else {
              const gid = 'GRD' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
              await query(
                'INSERT INTO grades (id, school_id, student_id, class_id, subject, assessment_type, assessment_name, grade_value, weight, term) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [gid, schoolId, stId, targetClassId, resolvedSubject, resolvedType, colName, num, 1.0, resolvedTerm]
              );
              saved.push(gid);
            }
          }
        }
      } else {
        const num = parseFloat(sVal);
        if (!isNaN(num)) {
          const existing = await queryOne(
            'SELECT id FROM grades WHERE school_id = ? AND student_id = ? AND class_id = ? AND subject = ? AND term = ? AND assessment_name = ?',
            [schoolId, stId, targetClassId, resolvedSubject, resolvedTerm, 'Total']
          );
          if (existing) {
            await query('UPDATE grades SET grade_value = ?, synced_at = NOW() WHERE id = ?', [num, existing.id]);
            saved.push(existing.id);
          } else {
            const gid = 'GRD' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
            await query(
              'INSERT INTO grades (id, school_id, student_id, class_id, subject, assessment_type, assessment_name, grade_value, weight, term) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [gid, schoolId, stId, targetClassId, resolvedSubject, resolvedType, 'Total', num, 1.0, resolvedTerm]
            );
            saved.push(gid);
          }
        }
      }
    }
    return { count: saved.length, message: 'Grades saved successfully.' };
  }

  // Single grade save
  if (!student_id || !resolvedSubject || grade_value === undefined) {
    throw new Error('Student ID, Subject, and Grade Value are required.');
  }

  const mark = parseFloat(grade_value);
  const resolvedWeight = weight !== undefined ? parseFloat(weight) : 1.0;
  const gradeId = 'GRD' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

  await query(
    `INSERT INTO grades (id, school_id, student_id, class_id, subject, assessment_type, assessment_name, grade_value, weight, term)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [gradeId, schoolId, student_id, targetClassId, resolvedSubject, resolvedType, body.assessment_name || 'Test 1', mark, resolvedWeight, resolvedTerm]
  );
  return await queryOne('SELECT * FROM grades WHERE id = ?', [gradeId]);
}

// POST /schools/:schoolId/classes/:classId/grades
router.post('/', authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const targetClassId = classId || req.body.class_id;
    const result = await saveGradeEntry(schoolId, targetClassId, req.body);
    return res.status(201).json({ data: result });
  } catch (err) {
    console.error('Create grade entry error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Failed to record grade.' } });
  }
});

// PUT /schools/:schoolId/classes/:classId/grades/:id
router.put('/:id', authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { grade_value, assessment_type, weight, term } = req.body;

    await query(
      `UPDATE grades SET
         grade_value     = COALESCE(?, grade_value),
         assessment_type = COALESCE(?, assessment_type),
         weight          = COALESCE(?, weight),
         term            = COALESCE(?, term)
       WHERE id = ? AND school_id = ?`,
      [
        grade_value !== undefined ? parseFloat(grade_value) : null,
        assessment_type,
        weight !== undefined ? parseFloat(weight) : null,
        term,
        id,
        schoolId
      ]
    );

    const updated = await queryOne('SELECT * FROM grades WHERE id = ?', [id]);
    if (!updated) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Grade record not found.' } });
    return res.json({ data: updated });
  } catch (err) {
    console.error('Update grade error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update grade.' } });
  }
});

// DELETE /schools/:schoolId/classes/:classId/grades/:id
router.delete('/:id', authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    await query('DELETE FROM grades WHERE id = ? AND school_id = ?', [id, schoolId]);
    return res.json({ data: { message: 'Grade deleted successfully.' } });
  } catch (err) {
    console.error('Delete grade error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete grade.' } });
  }
});

// GET /schools/:schoolId/classes/:classId/results (ledger)
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { term } = req.query;

    const cls = await queryOne(
      'SELECT c.*, s.school_type FROM classes c LEFT JOIN schools s ON c.school_id = s.id WHERE c.id = ? AND c.school_id = ?',
      [classId, schoolId]
    );
    const levelCategory = determineLevelCategory(cls?.name, cls?.level, cls?.school_type);

    const students = await query(
      'SELECT id, first_name, last_name, admission_number FROM students WHERE school_id = ? AND class_id = ? AND (status IN ("active", "enrolled") OR status IS NULL OR status != "transferred") ORDER BY first_name ASC',
      [schoolId, classId]
    );

    const studentResults = [];
    for (const st of students) {
      let sql = `
        SELECT g.subject as subject_id, g.subject as subject_name,
               SUM(g.grade_value * COALESCE(g.weight, 1.0)) / NULLIF(SUM(COALESCE(g.weight, 1.0)), 0) as subject_avg
        FROM grades g
        WHERE g.school_id = ? AND g.student_id = ?
      `;
      const params = [schoolId, st.id];

      if (term) {
        sql += ' AND g.term = ?';
        params.push(term);
      }

      sql += ' GROUP BY g.subject';

      const subjectResults = await query(sql, params);
      const processed = processStudentSubjects(subjectResults, levelCategory);

      studentResults.push({
        student: st,
        student_id: st.id,
        admission_number: st.admission_number,
        student_name: `${st.first_name} ${st.last_name}`,
        subjects: processed.formattedSubjects,
        counted_subjects: processed.countedSubjects,
        overall_percentage: processed.overallPercentage,
        total_units: processed.totalUnits,
        total_marks: processed.totalMarks,
        total_points: processed.totalPoints,
        passes_count: processed.passesCount,
        grade: processed.grade,
        pass_status: processed.passStatus,
        level_category: levelCategory
      });
    }

    const ranked = rankStudentResults(studentResults, levelCategory);
    return res.json({ data: ranked, level_category: levelCategory });
  } catch (err) {
    console.error('Get results ledger error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate results ledger.' } });
  }
});

// GET /schools/:schoolId/grade-thresholds
const thresholdsRouter = express.Router({ mergeParams: true });

thresholdsRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const school = await queryOne('SELECT id, school_type FROM schools WHERE id = ?', [schoolId]);
    const schoolType = school?.school_type || 'primary';

    let thresholds = [];
    try {
      thresholds = await query(
        'SELECT * FROM grade_thresholds WHERE school_id = ? ORDER BY min_score DESC',
        [schoolId]
      );
    } catch (e) {}

    if (!thresholds || thresholds.length === 0) {
      if (schoolType === 'primary') {
        // Primary Units 1 to 9 (Grade 4 to 7)
        thresholds = [
          { grade: '1', grade_symbol: '1', label: 'Distinction',       min_score: 80, max_score: 100, min_mark: 80, max_mark: 100, points: 1, is_pass: 1, color: '#0d9488' },
          { grade: '2', grade_symbol: '2', label: 'Merit',             min_score: 70, max_score: 79.99, min_mark: 70, max_mark: 79.99, points: 2, is_pass: 1, color: '#0284c7' },
          { grade: '3', grade_symbol: '3', label: 'Credit',            min_score: 60, max_score: 69.99, min_mark: 60, max_mark: 69.99, points: 3, is_pass: 1, color: '#2563eb' },
          { grade: '4', grade_symbol: '4', label: 'Satisfactory',      min_score: 50, max_score: 59.99, min_mark: 50, max_mark: 59.99, points: 4, is_pass: 1, color: '#4f46e5' },
          { grade: '5', grade_symbol: '5', label: 'Marginal Pass',     min_score: 45, max_score: 49.99, min_mark: 45, max_mark: 49.99, points: 5, is_pass: 1, color: '#ca8a04' },
          { grade: '6', grade_symbol: '6', label: 'Bare Pass',         min_score: 40, max_score: 44.99, min_mark: 40, max_mark: 44.99, points: 6, is_pass: 1, color: '#ea580c' },
          { grade: '7', grade_symbol: '7', label: 'Unsatisfactory',    min_score: 35, max_score: 39.99, min_mark: 35, max_mark: 39.99, points: 7, is_pass: 0, color: '#e11d48' },
          { grade: '8', grade_symbol: '8', label: 'Poor',              min_score: 30, max_score: 34.99, min_mark: 30, max_mark: 34.99, points: 8, is_pass: 0, color: '#dc2626' },
          { grade: '9', grade_symbol: '9', label: 'Very Poor',         min_score: 0,  max_score: 29.99, min_mark: 0,  max_mark: 29.99, points: 9, is_pass: 0, color: '#991b1b' },
        ];
      } else if (schoolType === 'high_school' || schoolType === 'combined') {
        // High School: Ordinary Level + A-Level Points Scale (A=5, B=4, C=3, D=2, E=1, O=0, F=0)
        thresholds = [
          // A-Level scale
          { grade: 'A', grade_symbol: 'A', label: 'A-Level Distinction (5 Pts)', min_score: 70, max_score: 100, min_mark: 70, max_mark: 100, points: 5, is_pass: 1, color: '#0d9488' },
          { grade: 'B', grade_symbol: 'B', label: 'A-Level Merit (4 Pts)',       min_score: 60, max_score: 69.99, min_mark: 60, max_mark: 69.99, points: 4, is_pass: 1, color: '#0284c7' },
          { grade: 'C', grade_symbol: 'C', label: 'A-Level Credit (3 Pts)',      min_score: 50, max_score: 59.99, min_mark: 50, max_mark: 59.99, points: 3, is_pass: 1, color: '#2563eb' },
          { grade: 'D', grade_symbol: 'D', label: 'A-Level Sub-Pass (2 Pts)',    min_score: 45, max_score: 49.99, min_mark: 45, max_mark: 49.99, points: 2, is_pass: 1, color: '#ca8a04' },
          { grade: 'E', grade_symbol: 'E', label: 'A-Level Pass (1 Pt)',         min_score: 40, max_score: 44.99, min_mark: 40, max_mark: 44.99, points: 1, is_pass: 1, color: '#ea580c' },
          { grade: 'O', grade_symbol: 'O', label: 'A-Level Subsidiary (0 Pts)', min_score: 35, max_score: 39.99, min_mark: 35, max_mark: 39.99, points: 0, is_pass: 0, color: '#e11d48' },
          { grade: 'F', grade_symbol: 'F', label: 'A-Level Fail (0 Pts)',       min_score: 0,  max_score: 34.99, min_mark: 0,  max_mark: 34.99, points: 0, is_pass: 0, color: '#991b1b' },
          // O-Level scale symbols
          { grade: 'A_OL', grade_symbol: 'A', label: 'O-Level Distinction', min_score: 75, max_score: 100, min_mark: 75, max_mark: 100, points: 1, is_pass: 1, color: '#0d9488' },
          { grade: 'B_OL', grade_symbol: 'B', label: 'O-Level Merit',       min_score: 65, max_score: 74.99, min_mark: 65, max_mark: 74.99, points: 2, is_pass: 1, color: '#0284c7' },
          { grade: 'C_OL', grade_symbol: 'C', label: 'O-Level Credit Pass', min_score: 50, max_score: 64.99, min_mark: 50, max_mark: 64.99, points: 3, is_pass: 1, color: '#2563eb' },
          { grade: 'D_OL', grade_symbol: 'D', label: 'O-Level Sub-Credit',  min_score: 45, max_score: 49.99, min_mark: 45, max_mark: 49.99, points: 4, is_pass: 0, color: '#ca8a04' },
          { grade: 'E_OL', grade_symbol: 'E', label: 'O-Level Poor',        min_score: 40, max_score: 44.99, min_mark: 40, max_mark: 44.99, points: 5, is_pass: 0, color: '#ea580c' },
          { grade: 'U_OL', grade_symbol: 'U', label: 'O-Level Ungraded',    min_score: 0,  max_score: 39.99, min_mark: 0,  max_mark: 39.99, points: 6, is_pass: 0, color: '#991b1b' }
        ];
      } else {
        // Secondary: O-Level Symbols A, B, C, D, E, U
        thresholds = [
          { grade: 'A', grade_symbol: 'A', label: 'Distinction', min_score: 75, max_score: 100, min_mark: 75, max_mark: 100, points: 1, is_pass: 1, color: '#0d9488' },
          { grade: 'B', grade_symbol: 'B', label: 'Merit',       min_score: 65, max_score: 74.99, min_mark: 65, max_mark: 74.99, points: 2, is_pass: 1, color: '#0284c7' },
          { grade: 'C', grade_symbol: 'C', label: 'Credit Pass', min_score: 50, max_score: 64.99, min_mark: 50, max_mark: 64.99, points: 3, is_pass: 1, color: '#2563eb' },
          { grade: 'D', grade_symbol: 'D', label: 'Sub-credit',  min_score: 45, max_score: 49.99, min_mark: 45, max_mark: 49.99, points: 4, is_pass: 0, color: '#ca8a04' },
          { grade: 'E', grade_symbol: 'E', label: 'Poor',        min_score: 40, max_score: 44.99, min_mark: 40, max_mark: 44.99, points: 5, is_pass: 0, color: '#ea580c' },
          { grade: 'U', grade_symbol: 'U', label: 'Ungraded',    min_score: 0,  max_score: 39.99, min_mark: 0,  max_mark: 39.99, points: 6, is_pass: 0, color: '#991b1b' },
        ];
      }
    }

    return res.json({
      data: {
        thresholds,
        school_type: schoolType
      }
    });
  } catch (err) {
    console.error('Get grade thresholds error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch grade thresholds.' } });
  }
});

// POST /schools/:schoolId/grade-thresholds
thresholdsRouter.post('/', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { thresholds, school_type } = req.body;

    if (school_type) {
      await query('UPDATE schools SET school_type = ? WHERE id = ?', [school_type, schoolId]);
    }

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS grade_thresholds (
          id VARCHAR(50) PRIMARY KEY,
          school_id VARCHAR(50) NOT NULL,
          grade VARCHAR(10) NOT NULL,
          label VARCHAR(50) NULL,
          min_score DECIMAL(5,2) NOT NULL,
          max_score DECIMAL(5,2) NOT NULL,
          points INT NULL,
          color VARCHAR(20) NULL,
          is_pass TINYINT(1) DEFAULT 1
        )
      `);
    } catch (_) {}

    if (Array.isArray(thresholds)) {
      await query('DELETE FROM grade_thresholds WHERE school_id = ?', [schoolId]);
      for (const t of thresholds) {
        const tId = 'GT' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const gradeSymbol = t.grade_symbol || t.grade || '';
        const minVal = parseFloat(t.min_score ?? t.min_mark ?? 0);
        const maxVal = parseFloat(t.max_score ?? t.max_mark ?? 100);
        const points = t.points !== undefined ? t.points : 0;
        const isPass = t.is_pass !== undefined ? (t.is_pass ? 1 : 0) : 1;
        await query(
          `INSERT INTO grade_thresholds (id, school_id, grade, grade_symbol, label, min_score, min_mark, max_score, max_mark, points, color, is_pass)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tId, schoolId, gradeSymbol, gradeSymbol, t.label || '', minVal, minVal, maxVal, maxVal, points, t.color || '#0d9488', isPass]
        );
      }
    }

    return res.json({ data: { message: 'Grade thresholds saved successfully.' } });
  } catch (err) {
    console.error('Save grade thresholds error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update grade thresholds.' } });
  }
});

const schoolGradesRouter = express.Router({ mergeParams: true });
schoolGradesRouter.post('/', authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const targetClassId = req.body.class_id;
    if (!targetClassId) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Class ID is required.' } });
    }
    const result = await saveGradeEntry(schoolId, targetClassId, req.body);
    return res.status(201).json({ data: result });
  } catch (err) {
    console.error('Save grades batch error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Failed to record grades.' } });
  }
});

module.exports = { router, thresholdsRouter, schoolGradesRouter, saveGradeEntry };
