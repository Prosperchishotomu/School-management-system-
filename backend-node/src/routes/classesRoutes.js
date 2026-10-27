const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { determineLevelCategory, processStudentSubjects, rankStudentResults } = require('../utils/gradeCalculator');
const { broadcastInvalidation } = require('../services/realtime');
const {
  normalizeName,
  normalizeCode,
  normalizeText
} = require('../utils/normalizer');

// GET /schools/:schoolId/classes
router.get('/classes', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const classes = await query(
      `SELECT c.*, stf.name as form_master_name,
              COUNT(st.id) as total_students,
              COUNT(st.id) as student_count
       FROM classes c
       LEFT JOIN staff stf ON c.form_master_id = stf.id
       LEFT JOIN students st ON c.id = st.class_id AND (st.status NOT IN ('withdrawn', 'graduated', 'transferred', 'dropped_out') OR st.status IS NULL)
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

// GET /schools/:schoolId/my-allocations
router.get('/my-allocations', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;
    const isAdmin = ['school_admin', 'super_admin', 'principal', 'head', 'headmaster', 'deputy_head', 'admin'].includes(userRole);

    if (isAdmin) {
      const allClasses = await query('SELECT id, name, level, grade_level FROM classes WHERE school_id = ? ORDER BY name ASC', [schoolId]);
      const allSubjects = await query('SELECT id, code, name, category, level FROM subjects WHERE school_id = ? OR school_id IS NULL ORDER BY name ASC', [schoolId]);
      return res.json({
        data: {
          is_admin: true,
          role: userRole,
          classes: allClasses,
          subjects: allSubjects,
          primary_classes: allClasses.filter(c => (c.level || '').toLowerCase().includes('primary') || (c.name || '').toLowerCase().includes('grade') || (c.name || '').toLowerCase().includes('ecd')),
          secondary_classes: allClasses.filter(c => (c.level || '').toLowerCase().includes('secondary') || (c.name || '').toLowerCase().includes('form')),
          teaching_assignments: []
        }
      });
    }

    // Teacher allocations
    // 1. Primary class teacher or form master
    const assignedClasses = await query(
      `SELECT c.*, stf.name as form_master_name
       FROM classes c
       LEFT JOIN staff stf ON c.form_master_id = stf.id OR c.form_master_id = stf.user_id
       WHERE c.school_id = ? AND (
         c.form_master_id = ?
         OR c.form_master_id IN (SELECT id FROM staff WHERE user_id = ?)
         OR c.form_master_id IN (SELECT id FROM employees WHERE user_id = ?)
         OR c.id IN (SELECT class_id FROM staff WHERE (user_id = ? OR id = ?) AND class_id IS NOT NULL)
       )
       ORDER BY c.name ASC`,
      [schoolId, userId, userId, userId, userId, userId]
    );

    // 2. Secondary subject teaching assignments
    const teachingAssignments = await query(
      `SELECT ta.*, c.name as class_name, c.level as class_level, sub.name as subject_name, sub.code as subject_code
       FROM teaching_assignments ta
       JOIN classes c ON ta.class_id = c.id
       JOIN subjects sub ON ta.subject_id = sub.id
       WHERE ta.school_id = ? AND (
         ta.teacher_id = ?
         OR ta.teacher_id IN (SELECT id FROM staff WHERE user_id = ?)
         OR ta.teacher_id IN (SELECT user_id FROM staff WHERE id = ?)
         OR ta.teacher_id IN (SELECT id FROM employees WHERE user_id = ?)
       )
       ORDER BY c.name ASC, sub.name ASC`,
      [schoolId, userId, userId, userId, userId]
    );

    return res.json({
      data: {
        is_admin: false,
        role: userRole,
        primary_classes: assignedClasses,
        teaching_assignments: teachingAssignments
      }
    });
  } catch (err) {
    console.error('Fetch allocations error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch allocations.' } });
  }
});

// POST /schools/:schoolId/classes
router.post('/classes', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, level, capacity, form_master_id, grade_level, stream } = req.body;

    const cleanName = normalizeText(name);
    if (!cleanName) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Class name is required.' } });
    }

    const school = await queryOne('SELECT school_type, has_alevel FROM schools WHERE id = ?', [schoolId]);
    const schoolType = (school?.school_type || 'primary').toLowerCase();
    const hasAlevel = Boolean(school?.has_alevel || schoolType === 'high_school' || schoolType === 'combined' || schoolType === 'a_level');
    const isOrdinaryLevel = (schoolType === 'secondary' || schoolType === 'o_level' || schoolType === 'secondary_o_level') && !hasAlevel;

    if (isOrdinaryLevel && (/form\s*[5-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b|advanced/i.test(cleanName) || /form\s*[5-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b/i.test(grade_level || ''))) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Ordinary level secondary schools offer Form 1 to Form 4 only. Form 5 and Form 6 (Advanced Level) are not available for Ordinary Level institutions.'
        }
      });
    }

    const dupClass = await queryOne('SELECT id FROM classes WHERE school_id = ? AND LOWER(name) = LOWER(?)', [schoolId, cleanName]);
    if (dupClass) return res.status(409).json({ error: { code: 'DUPLICATE', message: `Class '${cleanName}' already exists in this school.` } });

    const classId = 'CLS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const resolvedLevel = level || (cleanName.toLowerCase().includes('form') ? 'Secondary' : 'Primary');
    const resolvedGradeLevel = grade_level || (cleanName.toLowerCase().includes('form') ? cleanName.split(' ')[0] : 'Primary');

    const parsedCapacity = (capacity !== undefined && capacity !== '' && capacity !== null && !isNaN(parseInt(capacity))) 
      ? parseInt(capacity) 
      : null;

    await query(
      `INSERT INTO classes (id, school_id, name, level, grade_level, stream, capacity, form_master_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [classId, schoolId, cleanName, resolvedLevel, resolvedGradeLevel, stream ? normalizeText(stream) : null, parsedCapacity, form_master_id || null]
    );

    broadcastInvalidation(schoolId, ['classes', 'academics', 'dashboard', 'summary'], 'class_created');

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

// PATCH /schools/:schoolId/classes/:id
router.patch('/classes/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { name, level, capacity, form_master_id } = req.body;

    // Check if class exists
    const existing = await queryOne('SELECT * FROM classes WHERE id = ? AND school_id = ?', [id, schoolId]);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Class not found.' } });
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedLevel = level !== undefined ? level : existing.level;
    const updatedCapacity = capacity !== undefined ? parseInt(capacity) : existing.capacity;
    const updatedFormMaster = form_master_id !== undefined ? (form_master_id || null) : existing.form_master_id;

    if (name !== undefined && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const school = await queryOne('SELECT school_type, has_alevel FROM schools WHERE id = ?', [schoolId]);
      const schoolType = (school?.school_type || 'primary').toLowerCase();
      const hasAlevel = Boolean(school?.has_alevel || schoolType === 'high_school' || schoolType === 'combined' || schoolType === 'a_level');
      const isOrdinaryLevel = (schoolType === 'secondary' || schoolType === 'o_level' || schoolType === 'secondary_o_level') && !hasAlevel;

      if (isOrdinaryLevel && (/form\s*[5-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b|advanced/i.test(name.trim()) || /form\s*[5-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b/i.test(level || ''))) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Ordinary level secondary schools offer Form 1 to Form 4 only. Form 5 and Form 6 (Advanced Level) are not available for Ordinary Level institutions.'
          }
        });
      }

      const dupClass = await queryOne('SELECT id FROM classes WHERE school_id = ? AND LOWER(name) = LOWER(?)', [schoolId, name.trim()]);
      if (dupClass) return res.status(409).json({ error: { code: 'DUPLICATE', message: `Class '${name.trim()}' already exists.` } });
    }

    await query(
      `UPDATE classes SET name = ?, level = ?, capacity = ?, form_master_id = ? WHERE id = ? AND school_id = ?`,
      [updatedName, updatedLevel, updatedCapacity, updatedFormMaster, id, schoolId]
    );

    // If form_master_id is updated, also update staff record's class_id!
    if (form_master_id !== undefined) {
      // Clear previous class teacher's class assignment
      await query('UPDATE staff SET class_id = NULL WHERE class_id = ? AND school_id = ?', [id, schoolId]);
      if (form_master_id) {
        await query('UPDATE staff SET class_id = ? WHERE id = ? AND school_id = ?', [id, form_master_id, schoolId]);
      }
    }

    const updated = await queryOne(
      `SELECT c.*, stf.name as form_master_name 
       FROM classes c 
       LEFT JOIN staff stf ON c.form_master_id = stf.id 
       WHERE c.id = ?`,
      [id]
    );
    return res.json({ data: updated });
  } catch (err) {
    console.error('Update class error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update class details.' } });
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
    const { schoolId } = req.params;
    const { name, code, category, level } = req.body;

    const cleanName = normalizeName(name);
    if (!cleanName) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Subject name is required.' } });
    }

    const cleanCode = code ? String(code).trim().toUpperCase() : null;
    const dupSubj = await queryOne(
      'SELECT id FROM subjects WHERE (school_id = ? OR school_id IS NULL) AND LOWER(name) = LOWER(?)',
      [schoolId, cleanName]
    );
    if (dupSubj) return res.status(409).json({ error: { code: 'DUPLICATE', message: `Subject '${cleanName}' already exists.` } });

    const subjectId = 'SUB' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    await query(
      `INSERT INTO subjects (id, school_id, name, code, category, level, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [subjectId, schoolId, cleanName, cleanCode, category ? normalizeText(category) : 'general', level ? normalizeText(level) : 'all', req.user.id]
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

// PATCH / PUT /schools/:schoolId/subjects/:id (Edit Subject)
const handleEditSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, category, department, level } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (code !== undefined) { updates.push('code = ?'); params.push(code ? code.trim().toUpperCase() : null); }
    if (category !== undefined || department !== undefined) { updates.push('category = ?'); params.push(category || department); }
    if (level !== undefined) { updates.push('level = ?'); params.push(level); }

    if (updates.length > 0) {
      params.push(id);
      await query(`UPDATE subjects SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = await queryOne('SELECT * FROM subjects WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    console.error('Edit subject error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update subject.' } });
  }
};

router.patch('/subjects/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleEditSubject);
router.put('/subjects/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleEditSubject);

// GET /schools/:schoolId/classes/:classId/attendance
router.get('/classes/:classId/attendance', authenticateToken, async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { date } = req.query;
    const recordDate = date || new Date().toISOString().slice(0, 10);

    const students = await query(
      `SELECT id as student_id, CONCAT(first_name, ' ', last_name) as student_name, admission_number
       FROM students
       WHERE school_id = ? AND class_id = ? AND (status IN ('active', 'enrolled') OR status IS NULL OR status != 'transferred')
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

    // Check class teacher ownership
    const classRecord = await queryOne('SELECT form_master_id FROM classes WHERE id = ? AND school_id = ?', [classId, schoolId]);
    let staffRecord = null;
    if (req.user) {
      staffRecord = await queryOne('SELECT id FROM staff WHERE user_id = ? OR id = ?', [req.user.id, req.user.id]);
    }
    const isClassTeacher = Boolean(
      req.user?.role === 'school_admin' ||
      req.user?.role === 'super_admin' ||
      (classRecord && staffRecord && String(classRecord.form_master_id) === String(staffRecord.id)) ||
      (classRecord && String(classRecord.form_master_id) === String(req.user?.id))
    );

    return res.json({
      data: {
        students,
        records,
        is_class_teacher: isClassTeacher,
        form_master_id: classRecord?.form_master_id || null
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
    const { schoolId, classId } = req.params;
    const { date, entries, records } = req.body;
    const targetEntries = entries || records;

    if (!targetEntries || !Array.isArray(targetEntries)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Attendance entries array is required.' } });
    }

    // Enforce: Class teachers are the ones who mark registers only!
    if (req.user?.role === 'teacher') {
      const classRecord = await queryOne('SELECT form_master_id FROM classes WHERE id = ? AND school_id = ?', [classId, schoolId]);
      const staffRecord = await queryOne('SELECT id FROM staff WHERE user_id = ? OR id = ?', [req.user.id, req.user.id]);
      
      const isMaster = Boolean(
        (classRecord && staffRecord && String(classRecord.form_master_id) === String(staffRecord.id)) ||
        (classRecord && String(classRecord.form_master_id) === String(req.user.id))
      );
                       
      if (!isMaster) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied: Only designated Class Teachers (Form Masters) can mark attendance registers for this class.'
          }
        });
      }
    }

    const recordDate = date || new Date().toISOString().slice(0, 10);
    for (const entry of targetEntries) {
      if (entry.student_id) {
        const attId = 'ATT' + Math.random().toString(36).substr(2, 6).toUpperCase();
        await query(
          `INSERT INTO attendance (id, school_id, student_id, class_id, date, status, remarks, taken_by, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), taken_by = VALUES(taken_by), recorded_by = VALUES(recorded_by)`,
          [attId, schoolId, entry.student_id, classId, recordDate, entry.status || 'present', entry.remarks || null, req.user.id, req.user.id]
        );
      }
    }

    broadcastInvalidation(schoolId, ['attendance', 'att_matrix', 'student_profile', 'dashboard', 'summary'], 'attendance_taken');

    return res.json({ data: { message: `Attendance register saved for ${targetEntries.length} students.` } });
  } catch (err) {
    console.error('Post class attendance error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to save attendance.' } });
  }
});


// Helper to compute results and universal rankings for a class
async function computeClassResults(schoolId, classId, term, userRole, userId, userEmail, requestedStudentId = null, userPhone = null, year = null) {
  // ==========================================
  // CASE 1: PARENT / GUARDIAN ACCESS
  // Parents ONLY see marks of their own kids. They NEVER see other students.
  // ==========================================
  if (['parent', 'student', 'guardian'].includes(userRole)) {
    const guardians = await query(
      `SELECT id FROM guardians 
       WHERE school_id = ? AND (
         user_id = ? 
         OR (email IS NOT NULL AND email != '' AND email = ?)
         OR (phone IS NOT NULL AND phone != '' AND phone = ?)
       )`,
      [schoolId, userId, userEmail || '', userPhone || '']
    );

    if (!guardians || guardians.length === 0) {
      return { 
        data: [], 
        children_list: [], 
        is_parent: true,
        error: { code: 'NO_LINKED_CHILDREN', message: 'No student profiles are linked to this parent account.' }, 
        status: 200 
      };
    }

    const gIds = guardians.map(g => g.id);
    const gPlaceholders = gIds.map(() => '?').join(',');

    const linkedKids = await query(
      `SELECT DISTINCT st.*, c.name as class_name, c.level as class_level, s.school_type,
              s.name as school_name,
              stf.name as form_master_name
       FROM students st
       JOIN student_guardians sg ON st.id = sg.student_id
       LEFT JOIN classes c ON st.class_id = c.id
       LEFT JOIN schools s ON st.school_id = s.id
       LEFT JOIN staff stf ON c.form_master_id = stf.id OR c.form_master_id = stf.user_id
       WHERE sg.guardian_id IN (${gPlaceholders})
         AND st.school_id = ?
         AND (st.status IN ('enrolled', 'active', 'suspended') OR st.status IS NULL)
       ORDER BY st.first_name ASC`,
      [...gIds, schoolId]
    );

    if (linkedKids.length === 0) {
      return { data: [], children_list: [], is_parent: true };
    }

    const childrenList = linkedKids.map(k => ({
      id: k.id,
      student_id: k.id,
      first_name: k.first_name,
      last_name: k.last_name,
      student_name: `${k.first_name} ${k.last_name}`,
      admission_number: k.admission_number,
      class_id: k.class_id,
      class_name: k.class_name,
      photo_path: k.photo_path
    }));

    let targetKids = linkedKids;
    if (requestedStudentId) {
      const match = linkedKids.find(k => k.id === requestedStudentId);
      if (!match) {
        return {
          error: { code: 'FORBIDDEN', message: 'Access denied: You can only view marks and results of your own children.' },
          status: 403
        };
      }
      targetKids = [match];
    }

    const parentResults = [];

    for (const kid of targetKids) {
      const kidClassId = kid.class_id;
      const resolvedTerm = term || '2026-T1';

      let isPublished = false;
      try {
        const pub = await queryOne(
          `SELECT * FROM result_publications 
           WHERE school_id = ? AND class_id = ? AND term = ? 
             AND status IN ('published', 'released') 
             AND (status = 'released' OR (release_at IS NOT NULL AND release_at <= NOW()))`,
          [schoolId, kidClassId, resolvedTerm]
        );
        if (pub) isPublished = true;
      } catch (e) {}

      const levelCategory = determineLevelCategory(kid.class_name, kid.class_level, kid.school_type);

      let gSql = `
        SELECT g.subject as subject_id, 
               COALESCE(sub.name, g.subject) as subject_name,
               COALESCE(sub.code, '') as subject_code,
               SUM(g.grade_value * COALESCE(g.weight, 1.0)) / NULLIF(SUM(COALESCE(g.weight, 1.0)), 0) as subject_avg,
               MAX(CASE WHEN LOWER(g.assessment_name) LIKE '%test%' OR LOWER(g.assessment_name) LIKE '%ca1%' THEN g.grade_value END) as test_score,
               MAX(CASE WHEN LOWER(g.assessment_name) LIKE '%cala%' OR LOWER(g.assessment_name) LIKE '%project%' OR LOWER(g.assessment_name) LIKE '%ca2%' THEN g.grade_value END) as project_score,
               MAX(CASE WHEN LOWER(g.assessment_name) LIKE '%exam%' THEN g.grade_value END) as exam_score
        FROM grades g
        LEFT JOIN subjects sub ON (g.subject = sub.id OR g.subject = sub.name OR g.subject = sub.code)
        WHERE g.school_id = ? AND g.student_id = ?
      `;
      const gParams = [schoolId, kid.id];
      if (term) {
        gSql += ' AND (g.term = ? OR g.term LIKE ?)';
        gParams.push(term, `%${term}%`);
      }
      if (year) {
        gSql += ' AND (YEAR(g.created_at) = ? OR g.term LIKE ?)';
        gParams.push(year, `%${year}%`);
      }
      gSql += ' GROUP BY g.subject, sub.name, sub.code';
      const subjectResults = await query(gSql, gParams);

      const processed = processStudentSubjects(subjectResults, levelCategory);

      let childRank = null;
      let classTotalStudents = 0;
      if (kidClassId) {
        const classStudents = await query(
          `SELECT id FROM students 
           WHERE school_id = ? AND class_id = ? AND (status IN ('active', 'enrolled') OR status IS NULL OR status != 'transferred')`,
          [schoolId, kidClassId]
        );
        classTotalStudents = classStudents.length;

        if (isPublished && classStudents.length > 0) {
          const peerScores = [];
          for (const peer of classStudents) {
            let pSql = `
              SELECT g.subject as subject_id, g.subject as subject_name,
                     SUM(g.grade_value * COALESCE(g.weight, 1.0)) / NULLIF(SUM(COALESCE(g.weight, 1.0)), 0) as subject_avg
              FROM grades g
              WHERE g.school_id = ? AND g.student_id = ?
            `;
            const pParams = [schoolId, peer.id];
            if (term) {
              pSql += ' AND (g.term = ? OR g.term LIKE ?)';
              pParams.push(term, `%${term}%`);
            }
            if (year) {
              pSql += ' AND (YEAR(g.created_at) = ? OR g.term LIKE ?)';
              pParams.push(year, `%${year}%`);
            }
            pSql += ' GROUP BY g.subject';
            const pSubjs = await query(pSql, pParams);
            const pProc = processStudentSubjects(pSubjs, levelCategory);
            peerScores.push({
              student_id: peer.id,
              overall_percentage: pProc.overallPercentage,
              total_units: pProc.totalUnits,
              total_points: pProc.totalPoints,
              total_marks: pProc.totalMarks,
              passes_count: pProc.passesCount
            });
          }
          const rankedPeers = rankStudentResults(peerScores, levelCategory);
          const found = rankedPeers.find(p => p.student_id === kid.id);
          if (found) childRank = found.rank;
        }
      }

      const attSummary = await queryOne(
        `SELECT 
           COUNT(*) as total_days,
           SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as present_days,
           SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days
         FROM attendance
         WHERE school_id = ? AND student_id = ?`,
        [schoolId, kid.id]
      );
      const totalDays = Number(attSummary?.total_days || 0);
      const presentDays = Number(attSummary?.present_days || 0);
      const absentDays = Number(attSummary?.absent_days || 0);
      const attRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      const detailedSubjects = processed.formattedSubjects.map(sub => {
        const raw = subjectResults.find(r => r.subject_name === sub.subject_name || r.subject_id === sub.subject_name);
        return {
          ...sub,
          test_score: raw?.test_score !== null && raw?.test_score !== undefined ? parseFloat(raw.test_score) : null,
          project_score: raw?.project_score !== null && raw?.project_score !== undefined ? parseFloat(raw.project_score) : null,
          exam_score: raw?.exam_score !== null && raw?.exam_score !== undefined ? parseFloat(raw.exam_score) : null
        };
      });

      parentResults.push({
        student_id: kid.id,
        first_name: kid.first_name,
        last_name: kid.last_name,
        student_name: `${kid.first_name} ${kid.last_name}`,
        admission_number: kid.admission_number,
        class_id: kid.class_id,
        class_name: kid.class_name,
        school_name: kid.school_name || '',
        center_no: kid.center_no || '',
        form_master_name: kid.form_master_name || 'Class Teacher',
        level_category: levelCategory,
        term: term || 'Term 3',
        academic_year: year || 2026,
        academic_period: `${term || 'Term 3'}, ${year || 2026}`,
        is_published: isPublished,
        status: isPublished ? 'published' : 'draft',
        rank: isPublished ? childRank : null,
        class_size: classTotalStudents,
        overall_percentage: processed.overallPercentage,
        grade: processed.grade,
        grade_symbol: processed.grade_symbol,
        pass_status: processed.passStatus,
        total_units: processed.totalUnits,
        total_points: processed.totalPoints,
        total_marks: processed.totalMarks,
        passes_count: processed.passesCount,
        subjects: detailedSubjects,
        counted_subjects: processed.countedSubjects,
        attendance: {
          total_days: totalDays,
          present_days: presentDays,
          absent_days: absentDays,
          rate: attRate
        }
      });
    }

    return { 
      data: parentResults, 
      children_list: childrenList, 
      is_parent: true,
      level_category: parentResults[0]?.level_category || 'o_level'
    };
  }

  // ==========================================
  // CASE 2: TEACHER & ADMIN ACCESS
  // ==========================================
  let isCohortAggregated = false;
  let cohortName = null;
  let targetClasses = [];

  if (classId && String(classId).startsWith('cohort:')) {
    isCohortAggregated = true;
    cohortName = String(classId).replace('cohort:', '').trim();
    targetClasses = await query(
      `SELECT c.*, s.school_type, s.name as school_name, s.code as center_no, stf.name as form_master_name
       FROM classes c
       LEFT JOIN schools s ON c.school_id = s.id
       LEFT JOIN staff stf ON c.form_master_id = stf.id OR c.form_master_id = stf.user_id
       WHERE c.school_id = ? AND (c.grade_level = ? OR c.name LIKE ? OR c.name LIKE ?)
       ORDER BY c.name ASC`,
      [schoolId, cohortName, `${cohortName}%`, `%${cohortName}%`]
    );
  } else if (!classId) {
    const firstClass = await queryOne('SELECT id FROM classes WHERE school_id = ? ORDER BY name ASC LIMIT 1', [schoolId]);
    classId = firstClass?.id;
    if (classId) {
      const cls = await queryOne(
        `SELECT c.*, s.school_type, s.name as school_name, s.code as center_no, stf.name as form_master_name
         FROM classes c 
         LEFT JOIN schools s ON c.school_id = s.id 
         LEFT JOIN staff stf ON c.form_master_id = stf.id OR c.form_master_id = stf.user_id
         WHERE c.id = ? AND c.school_id = ?`,
        [classId, schoolId]
      );
      if (cls) targetClasses = [cls];
    }
  } else {
    const cls = await queryOne(
      `SELECT c.*, s.school_type, s.name as school_name, s.code as center_no, stf.name as form_master_name
       FROM classes c 
       LEFT JOIN schools s ON c.school_id = s.id 
       LEFT JOIN staff stf ON c.form_master_id = stf.id OR c.form_master_id = stf.user_id
       WHERE c.id = ? AND c.school_id = ?`,
      [classId, schoolId]
    );
    if (cls) targetClasses = [cls];
  }

  if (targetClasses.length === 0) {
    return { data: [], stream_comparison: [], is_admin: true };
  }

  const primaryCls = targetClasses[0];
  const levelCategory = determineLevelCategory(primaryCls.name, primaryCls.level, primaryCls.school_type);
  const isSecondary = (primaryCls.level && String(primaryCls.level).toLowerCase().includes('sec')) ||
                      (primaryCls.name && /form\s*[1-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b|ordinary|advanced/i.test(primaryCls.name)) ||
                      (primaryCls.school_type && (primaryCls.school_type.includes('secondary') || primaryCls.school_type.includes('high')));

  let isClassTeacher = false;
  let isSubjectTeacher = false;
  let assignedSubjects = [];

  const isAdmin = ['school_admin', 'super_admin', 'principal', 'head', 'headmaster', 'deputy_head', 'admin'].includes(userRole);

  if (isAdmin) {
    isClassTeacher = true; // Admin has full broadsheet access
  } else if (userRole === 'teacher') {
    const staffRecord = await queryOne('SELECT id, class_id FROM staff WHERE user_id = ? OR id = ?', [userId, userId]);
    const empRecord = await queryOne('SELECT id FROM employees WHERE user_id = ? OR id = ?', [userId, userId]);
    const teacherIds = [String(userId), staffRecord?.id ? String(staffRecord.id) : null, empRecord?.id ? String(empRecord.id) : null].filter(Boolean);

    isClassTeacher = targetClasses.some(c => 
      (c.form_master_id && teacherIds.includes(String(c.form_master_id))) ||
      (staffRecord?.class_id && String(staffRecord.class_id) === String(c.id))
    );

    const targetClassIds = targetClasses.map(c => c.id);
    const placeholders = targetClassIds.map(() => '?').join(',');
    const taRows = await query(
      `SELECT ta.subject_id, sub.name as subject_name, sub.code as subject_code
       FROM teaching_assignments ta
       JOIN subjects sub ON ta.subject_id = sub.id
       WHERE ta.school_id = ? AND ta.class_id IN (${placeholders}) AND (
         ta.teacher_id = ?
         OR ta.teacher_id IN (SELECT id FROM staff WHERE user_id = ?)
         OR ta.teacher_id IN (SELECT user_id FROM staff WHERE id = ?)
         OR ta.teacher_id IN (SELECT id FROM employees WHERE user_id = ?)
       )`,
      [schoolId, ...targetClassIds, userId, userId, userId, userId]
    );

    if (taRows && taRows.length > 0) {
      isSubjectTeacher = true;
      assignedSubjects = taRows;
    }

    if (!isClassTeacher && !isSubjectTeacher && !isCohortAggregated) {
      return {
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: You are not assigned to this class.'
        },
        status: 403
      };
    }
  }

  // Find all sister streams in this grade level for visual comparison charts
  const comparisonCohort = cohortName || primaryCls.grade_level || primaryCls.name.split(' ')[0];
  const sisterClasses = await query(
    `SELECT c.*, s.school_type, s.name as school_name, stf.name as form_master_name
     FROM classes c
     LEFT JOIN schools s ON c.school_id = s.id
     LEFT JOIN staff stf ON c.form_master_id = stf.id OR c.form_master_id = stf.user_id
     WHERE c.school_id = ? AND (c.grade_level = ? OR c.name LIKE ? OR c.name LIKE ?)
     ORDER BY c.name ASC`,
    [schoolId, comparisonCohort, `${comparisonCohort}%`, `%${comparisonCohort}%`]
  );
  const classesForComparison = sisterClasses.length > 0 ? sisterClasses : targetClasses;

  // Retrieve all students across target classes
  const targetClassIds = targetClasses.map(c => c.id);
  const tcPlaceholders = targetClassIds.map(() => '?').join(',');
  const students = await query(
    `SELECT id as student_id, first_name, last_name, admission_number, class_id
     FROM students
     WHERE school_id = ? AND class_id IN (${tcPlaceholders}) AND (status IN ('active', 'enrolled') OR status IS NULL OR status != 'transferred')
     ORDER BY first_name ASC`,
    [schoolId, ...targetClassIds]
  );

  // Load Real Report Card Terminal Evaluations
  let evalMap = new Map();
  try {
    const resolvedTerm = term || 'Term 3';
    const evaluations = await query(
      `SELECT student_id, conduct, class_teacher_remark, head_remark, next_term_date, status, published_at
       FROM report_cards
       WHERE school_id = ? AND (term = ? OR term LIKE ? OR term IS NULL)`,
      [schoolId, resolvedTerm, `%${resolvedTerm}%`]
    );
    evaluations.forEach(ev => evalMap.set(ev.student_id, ev));
  } catch (evalErr) {
    console.warn('Evaluation load notice:', evalErr.message);
  }

  // Load Student Elective Subject Enrollments
  let enrolledSubjMap = new Map();
  if (students.length > 0) {
    try {
      const stIds = students.map(s => s.student_id);
      const stPlaceholders = stIds.map(() => '?').join(',');
      const enrolledSubjs = await query(
        `SELECT ss.student_id, ss.subject_id, sub.name as subject_name, sub.code as subject_code
         FROM student_subjects ss
         JOIN subjects sub ON ss.subject_id = sub.id
         WHERE ss.school_id = ? AND ss.student_id IN (${stPlaceholders}) AND (ss.status = 'active' OR ss.status IS NULL)`,
        [schoolId, ...stIds]
      );
      enrolledSubjs.forEach(es => {
        if (!enrolledSubjMap.has(es.student_id)) enrolledSubjMap.set(es.student_id, []);
        enrolledSubjMap.get(es.student_id).push(es);
      });
    } catch (ssErr) {
      console.warn('Student subjects load notice:', ssErr.message);
    }
  }

  // Helper to detect curriculum subject combination
  const detectSubjectCombination = (subjects) => {
    const names = (subjects || []).map(s => (s.subject_name || s.name || '').toLowerCase());
    const sciences = ['physics', 'chemistry', 'biology', 'pure mathematics', 'mechanics', 'computer science'].filter(k => names.some(n => n.includes(k))).length;
    const commercials = ['accounting', 'accounts', 'commerce', 'business studies', 'economics', 'statistics'].filter(k => names.some(n => n.includes(k))).length;
    const arts = ['history', 'literature', 'divinity', 'religious studies', 'geography', 'sociology', 'shona', 'ndebele'].filter(k => names.some(n => n.includes(k))).length;

    if (sciences >= 2 && sciences >= commercials && sciences >= arts) return 'Sciences';
    if (commercials >= 2 && commercials >= sciences && commercials >= arts) return 'Commercials';
    if (arts >= 2 && arts >= sciences && arts >= commercials) return 'Arts & Humanities';
    if (sciences > 0 || commercials > 0 || arts > 0) return 'Elective Combination';
    return 'General Core';
  };

  const classMap = new Map();
  classesForComparison.forEach(c => classMap.set(c.id, c));

  const studentResults = [];
  for (const st of students) {
    const stClass = classMap.get(st.class_id) || primaryCls;
    const stEval = evalMap.get(st.student_id);
    const assignedForStudent = enrolledSubjMap.get(st.student_id) || [];

    let sql = `
      SELECT g.subject as subject_id, 
             COALESCE(sub.name, g.subject) as subject_name,
             COALESCE(sub.code, '') as subject_code,
             SUM(g.grade_value * COALESCE(g.weight, 1.0)) / NULLIF(SUM(COALESCE(g.weight, 1.0)), 0) as subject_avg,
             MAX(CASE WHEN LOWER(g.assessment_name) LIKE '%test%' OR LOWER(g.assessment_name) LIKE '%ca1%' THEN g.grade_value END) as test_score,
             MAX(CASE WHEN LOWER(g.assessment_name) LIKE '%cala%' OR LOWER(g.assessment_name) LIKE '%project%' OR LOWER(g.assessment_name) LIKE '%ca2%' THEN g.grade_value END) as project_score,
             MAX(CASE WHEN LOWER(g.assessment_name) LIKE '%exam%' THEN g.grade_value END) as exam_score
      FROM grades g
      LEFT JOIN subjects sub ON (g.subject = sub.id OR g.subject = sub.name OR g.subject = sub.code)
      WHERE g.school_id = ? AND g.student_id = ?
    `;
    const params = [schoolId, st.student_id];
    if (term) {
      sql += ' AND (g.term = ? OR g.term LIKE ?)';
      params.push(term, `%${term}%`);
    }
    if (year) {
      sql += ' AND (YEAR(g.created_at) = ? OR g.term LIKE ?)';
      params.push(year, `%${year}%`);
    }
    sql += ' GROUP BY g.subject, sub.name, sub.code';

    const subjectResults = await query(sql, params);

    // If student has assigned subjects in student_subjects that haven't received marks yet, include them with null/pending
    assignedForStudent.forEach(as => {
      const exists = subjectResults.some(sr => 
        (sr.subject_name || '').toLowerCase() === (as.subject_name || '').toLowerCase() ||
        String(sr.subject_id).toLowerCase() === String(as.subject_id).toLowerCase()
      );
      if (!exists) {
        subjectResults.push({
          subject_id: as.subject_id,
          subject_name: as.subject_name,
          subject_code: as.subject_code,
          subject_avg: null,
          test_score: null,
          project_score: null,
          exam_score: null,
          is_enrolled: true
        });
      }
    });

    const processed = processStudentSubjects(subjectResults, levelCategory);

    let outputSubjects = processed.formattedSubjects.map(sub => {
      const raw = subjectResults.find(r => 
        (r.subject_name || '').toLowerCase() === (sub.subject_name || '').toLowerCase() ||
        (r.subject_code && sub.subject_code && r.subject_code.toLowerCase() === sub.subject_code.toLowerCase())
      );
      const isAssigned = assignedForStudent.length === 0 || assignedForStudent.some(as => 
        (as.subject_name || '').toLowerCase() === (sub.subject_name || '').toLowerCase() ||
        String(as.subject_id) === String(sub.subject_id)
      );
      return {
        ...sub,
        test_score: raw?.test_score !== null && raw?.test_score !== undefined ? parseFloat(raw.test_score) : null,
        project_score: raw?.project_score !== null && raw?.project_score !== undefined ? parseFloat(raw.project_score) : null,
        exam_score: raw?.exam_score !== null && raw?.exam_score !== undefined ? parseFloat(raw.exam_score) : null,
        is_assigned: isAssigned
      };
    });

    // Subject Teacher filtering (only restrict if user is strictly subject teacher and not class teacher)
    if (userRole === 'teacher' && isSecondary && !isClassTeacher && isSubjectTeacher && !isCohortAggregated) {
      const allowedNames = assignedSubjects.map(s => s.subject_name.toLowerCase());
      const allowedCodes = assignedSubjects.map(s => (s.subject_code || '').toLowerCase()).filter(Boolean);
      const allowedIds = assignedSubjects.map(s => String(s.subject_id).toLowerCase());

      outputSubjects = outputSubjects.filter(sub =>
        allowedNames.includes(sub.subject_name.toLowerCase()) ||
        allowedCodes.includes((sub.subject_code || '').toLowerCase()) ||
        allowedIds.includes(String(sub.subject_id || '').toLowerCase())
      );
    }

    const combination = detectSubjectCombination(outputSubjects);

    studentResults.push({
      student_id: st.student_id,
      first_name: st.first_name,
      last_name: st.last_name,
      student_name: `${st.first_name} ${st.last_name}`,
      admission_number: st.admission_number,
      class_id: st.class_id,
      class_name: stClass?.name || primaryCls.name,
      stream: stClass?.stream || stClass?.name?.replace(comparisonCohort, '').trim() || 'Main',
      form_master_name: stClass?.form_master_name || primaryCls.form_master_name || 'Class Teacher',
      class_size: students.filter(s => s.class_id === st.class_id).length,
      school_name: stClass?.school_name || primaryCls.school_name || '',
      center_no: stClass?.center_no || primaryCls.center_no || '',
      subjects: outputSubjects,
      counted_subjects: processed.countedSubjects,
      overall_percentage: processed.overallPercentage,
      total_units: processed.totalUnits,
      total_marks: processed.totalMarks,
      total_points: processed.totalPoints,
      passes_count: processed.passesCount,
      grade: processed.grade,
      grade_symbol: processed.grade_symbol,
      pass_status: processed.passStatus,
      status: stEval?.status || 'draft',
      term: term || 'Term 3',
      academic_year: year || 2026,
      academic_period: `${term || 'Term 3'}, ${year || 2026}`,
      level_category: levelCategory,
      combination,
      assigned_subjects_count: assignedForStudent.length > 0 ? assignedForStudent.length : outputSubjects.length,
      conduct: stEval?.conduct || 'Good',
      class_teacher_remark: stEval?.class_teacher_remark || '',
      head_remark: stEval?.head_remark || '',
      next_term_date: stEval?.next_term_date || '',
      evaluation_status: stEval?.status || 'draft'
    });
  }

  // 1. Overall cohort rank (Form Rank across all streams)
  const ranked = rankStudentResults(studentResults, levelCategory);

  // 2. Class rank (within-stream rank)
  const byClass = {};
  ranked.forEach(s => {
    if (!byClass[s.class_id]) byClass[s.class_id] = [];
    byClass[s.class_id].push(s);
  });
  Object.values(byClass).forEach(clsList => {
    clsList.forEach((st, idx) => {
      st.class_rank = idx + 1;
      st.form_rank = st.rank; // Overall cohort rank
    });
  });

  // 3. Build Stream Comparison Data
  const streamComparison = classesForComparison.map(c => {
    const cStudents = ranked.filter(s => s.class_id === c.id);
    const count = cStudents.length;
    const avgPct = count > 0 
      ? Math.round(cStudents.reduce((acc, s) => acc + (s.overall_percentage || 0), 0) / count) 
      : 0;
    const passes = cStudents.filter(s => s.pass_status === 'pass' || (s.overall_percentage || 0) >= 50).length;
    const passRate = count > 0 ? Math.round((passes / count) * 100) : 0;
    const distinctions = cStudents.filter(s => 
      (s.overall_percentage >= 75) || 
      (s.grade === 'A') || 
      (s.total_units && s.total_units <= 12) || 
      (s.total_points && s.total_points >= 10)
    ).length;
    const topStudent = count > 0 ? cStudents[0] : null;

    return {
      class_id: c.id,
      class_name: c.name,
      stream: c.stream || c.name.replace(comparisonCohort, '').trim() || c.name,
      total_students: count,
      average_score: avgPct,
      pass_rate: passRate,
      distinctions_count: distinctions,
      top_student_name: topStudent ? topStudent.student_name : '—',
      top_student_score: topStudent ? `${topStudent.overall_percentage}%` : '—'
    };
  });

  return {
    data: ranked,
    level_category: levelCategory,
    class_info: primaryCls,
    is_aggregated: isCohortAggregated,
    cohort_name: comparisonCohort,
    stream_comparison: streamComparison,
    is_class_teacher: isClassTeacher,
    is_subject_teacher: isSubjectTeacher,
    assigned_subjects: assignedSubjects,
    is_secondary: isSecondary
  };
}

// GET /schools/:schoolId/classes/:classId/results/export
router.get(['/classes/:classId/results/export', '/results/export'], authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let classId = req.params.classId || req.query.class_id;
    const userRole = req.user.role;

    const result = await computeClassResults(
      schoolId,
      classId,
      req.query.term,
      userRole,
      req.user.id,
      req.user.email,
      req.query.student_id,
      req.user.phone,
      req.query.year
    );

    if (result.error) return res.status(result.status || 400).json({ error: result.error });

    const { data: ranked, level_category, is_parent, is_subject_teacher, assigned_subjects } = result;

    let csvContent = '';
    if (is_parent) {
      csvContent = 'Student Name,Admission Number,Class,Subject,Average (%),Grade,Status\n';
      ranked.forEach(child => {
        (child.subjects || []).forEach(sub => {
          csvContent += `"${child.student_name}","${child.admission_number}","${child.class_name}","${sub.subject_name}",${sub.average},"${sub.grade}","${sub.remark || ''}"\n`;
        });
      });
    } else if (is_subject_teacher && assigned_subjects && assigned_subjects.length > 0) {
      const subjName = assigned_subjects[0].subject_name;
      csvContent = `Admission Number,Student Name,${subjName} Score (%),Grade,Status\n`;
      ranked.forEach(r => {
        const sub = (r.subjects || []).find(s => s.subject_name.toLowerCase() === subjName.toLowerCase()) || r.subjects?.[0];
        csvContent += `"${r.admission_number}","${r.student_name}",${sub?.average || 0},"${sub?.grade || ''}","${r.pass_status}"\n`;
      });
    } else if (level_category === 'primary_g4_g7') {
      csvContent = 'Cohort Rank,Class Rank,Admission Number,Student Name,Stream,Total Units (Best 6),Term Average (%),Grade,Status\n';
      ranked.forEach(r => {
        csvContent += `${r.rank},${r.class_rank || r.rank},"${r.admission_number}","${r.student_name}","${r.stream || ''}",${r.total_units || 0},${r.overall_percentage},"${r.grade}","${r.pass_status}"\n`;
      });
    } else if (level_category === 'a_level') {
      csvContent = 'Cohort Rank,Class Rank,Admission Number,Student Name,Stream,Combination,Total Points,Quality Passes,Term Average (%),Grade,Status\n';
      ranked.forEach(r => {
        csvContent += `${r.rank},${r.class_rank || r.rank},"${r.admission_number}","${r.student_name}","${r.stream || ''}","${r.combination || ''}",${r.total_points || 0},${r.passes_count || 0},${r.overall_percentage},"${r.grade}","${r.pass_status}"\n`;
      });
    } else if (level_category === 'ecd_to_g3') {
      csvContent = 'Cohort Rank,Class Rank,Admission Number,Student Name,Stream,Total Marks,Term Average (%),Status\n';
      ranked.forEach(r => {
        csvContent += `${r.rank},${r.class_rank || r.rank},"${r.admission_number}","${r.student_name}","${r.stream || ''}",${r.total_marks || 0},${r.overall_percentage},"${r.pass_status}"\n`;
      });
    } else {
      csvContent = 'Cohort Rank,Class Rank,Admission Number,Student Name,Stream,Combination,Passes (A-C),Term Average (%),Grade,Status\n';
      ranked.forEach(r => {
        csvContent += `${r.rank},${r.class_rank || r.rank},"${r.admission_number}","${r.student_name}","${r.stream || ''}","${r.combination || ''}",${r.passes_count || 0},${r.overall_percentage},"${r.grade}","${r.pass_status}"\n`;
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=results_${classId || 'report'}_${req.query.term || 'term'}.csv`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export class results error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to export results.' } });
  }
});

// GET /schools/:schoolId/classes/:classId/results AND GET /schools/:schoolId/results
router.get(['/classes/:classId/results', '/results'], authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const userRole = req.user.role;
    let classId = req.params.classId || req.query.class_id;

    const result = await computeClassResults(
      schoolId,
      classId,
      req.query.term,
      userRole,
      req.user.id,
      req.user.email,
      req.query.student_id,
      req.user.phone,
      req.query.year
    );

    if (result.error && result.status !== 200) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    return res.json({
      data: {
        results: result.data || [],
        children_list: result.children_list || [],
        is_parent: Boolean(result.is_parent),
        is_class_teacher: Boolean(result.is_class_teacher),
        is_subject_teacher: Boolean(result.is_subject_teacher),
        assigned_subjects: result.assigned_subjects || [],
        is_secondary: Boolean(result.is_secondary),
        level_category: result.level_category,
        class_info: result.class_info,
        is_aggregated: Boolean(result.is_aggregated),
        cohort_name: result.cohort_name || null,
        stream_comparison: result.stream_comparison || []
      },
      results: result.data || [],
      children_list: result.children_list || [],
      is_parent: Boolean(result.is_parent),
      is_class_teacher: Boolean(result.is_class_teacher),
      is_subject_teacher: Boolean(result.is_subject_teacher),
      assigned_subjects: result.assigned_subjects || [],
      is_secondary: Boolean(result.is_secondary),
      level_category: result.level_category,
      class_info: result.class_info,
      is_aggregated: Boolean(result.is_aggregated),
      cohort_name: result.cohort_name || null,
      stream_comparison: result.stream_comparison || []
    });
  } catch (err) {
    console.error('Get class results error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch results.' } });
  }
});

// GET /schools/:schoolId/students/:studentId/evaluation (Get report card evaluation)
router.get('/students/:studentId/evaluation', authenticateToken, async (req, res) => {
  try {
    const { schoolId, studentId } = req.params;
    const term = req.query.term || 'Term 3';
    const evalRecord = await queryOne(
      `SELECT * FROM report_cards WHERE school_id = ? AND student_id = ? AND (term = ? OR term LIKE ?) ORDER BY id DESC LIMIT 1`,
      [schoolId, studentId, term, `%${term}%`]
    );
    return res.json({
      data: evalRecord || {
        conduct: 'Good',
        class_teacher_remark: '',
        head_remark: '',
        next_term_date: ''
      }
    });
  } catch (err) {
    console.error('Get evaluation error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch student evaluation.' } });
  }
});

// PUT /schools/:schoolId/students/:studentId/evaluation (Save report card appraisal)
router.put('/students/:studentId/evaluation', authenticateToken, requireRoles('teacher', 'head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, studentId } = req.params;
    const { term, academic_year, conduct, class_teacher_remark, head_remark, next_term_date } = req.body;
    const resolvedTerm = term || 'Term 3';
    const resolvedYear = academic_year || new Date().getFullYear();

    const existing = await queryOne(
      `SELECT id FROM report_cards WHERE school_id = ? AND student_id = ? AND (term = ? OR term LIKE ?)`,
      [schoolId, studentId, resolvedTerm, `%${resolvedTerm}%`]
    );

    if (existing) {
      await query(
        `UPDATE report_cards 
         SET conduct = ?, class_teacher_remark = ?, head_remark = ?, next_term_date = ?, academic_year = ?, status = 'evaluated'
         WHERE id = ?`,
        [conduct || 'Good', class_teacher_remark || '', head_remark || '', next_term_date || '', resolvedYear, existing.id]
      );
    } else {
      await query(
        `INSERT INTO report_cards (school_id, student_id, term, academic_year, conduct, class_teacher_remark, head_remark, next_term_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'evaluated')`,
        [schoolId, studentId, resolvedTerm, resolvedYear, conduct || 'Good', class_teacher_remark || '', head_remark || '', next_term_date || '']
      );
    }

    broadcastInvalidation(schoolId, ['results', 'report_cards', 'dashboard'], 'evaluation_updated');
    return res.json({ success: true, message: 'Terminal appraisal saved successfully.' });
  } catch (err) {
    console.error('Save evaluation error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to save evaluation.' } });
  }
});

// GET /schools/:schoolId/students/:studentId/subjects (Get student's enrolled subjects)
router.get('/students/:studentId/subjects', authenticateToken, async (req, res) => {
  try {
    const { schoolId, studentId } = req.params;
    const student = await queryOne('SELECT id, first_name, last_name, admission_number, class_id FROM students WHERE id = ? AND school_id = ?', [studentId, schoolId]);
    if (!student) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Student not found.' } });

    const assigned = await query(
      `SELECT ss.id as assignment_id, ss.subject_id, sub.name as subject_name, sub.code as subject_code, ss.status
       FROM student_subjects ss
       JOIN subjects sub ON ss.subject_id = sub.id
       WHERE ss.school_id = ? AND ss.student_id = ? AND (ss.status = 'active' OR ss.status IS NULL)
       ORDER BY sub.name ASC`,
      [schoolId, studentId]
    );

    const allSubjects = await query(
      'SELECT id, name, code, category FROM subjects WHERE school_id = ? OR school_id IS NULL ORDER BY name ASC',
      [schoolId]
    );

    return res.json({
      data: {
        student,
        assigned_subjects: assigned,
        available_subjects: allSubjects
      }
    });
  } catch (err) {
    console.error('Get student subjects error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch student subjects.' } });
  }
});

// PUT /schools/:schoolId/students/:studentId/subjects (Update student's assigned subjects)
router.put('/students/:studentId/subjects', authenticateToken, requireRoles('teacher', 'head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, studentId } = req.params;
    const { subject_ids, class_id } = req.body;
    if (!Array.isArray(subject_ids)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'subject_ids must be an array of subject IDs.' } });
    }

    const student = await queryOne('SELECT id, class_id FROM students WHERE id = ? AND school_id = ?', [studentId, schoolId]);
    const targetClassId = class_id || student?.class_id || null;

    // Reset student subjects
    await query('DELETE FROM student_subjects WHERE school_id = ? AND student_id = ?', [schoolId, studentId]);

    for (const sId of subject_ids) {
      if (sId) {
        await query(
          `INSERT INTO student_subjects (school_id, student_id, class_id, subject_id, status)
           VALUES (?, ?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE status = 'active'`,
          [schoolId, studentId, targetClassId, sId]
        );
      }
    }

    broadcastInvalidation(schoolId, ['results', 'students', 'classes'], 'student_subjects_updated');
    return res.json({ success: true, message: `Updated elective subject enrollment for ${student?.first_name || 'student'}.` });
  } catch (err) {
    console.error('Update student subjects error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update student subjects.' } });
  }
});

// POST /schools/:schoolId/classes/:classId/bulk-assign-subjects (Bulk assign subjects to class or combo)
router.post('/classes/:classId/bulk-assign-subjects', authenticateToken, requireRoles('teacher', 'head', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, classId } = req.params;
    const { student_ids, subject_ids } = req.body;
    if (!Array.isArray(student_ids) || !Array.isArray(subject_ids) || student_ids.length === 0 || subject_ids.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'student_ids and subject_ids are required arrays.' } });
    }

    for (const stId of student_ids) {
      for (const subId of subject_ids) {
        if (stId && subId) {
          await query(
            `INSERT INTO student_subjects (school_id, student_id, class_id, subject_id, status)
             VALUES (?, ?, ?, ?, 'active')
             ON DUPLICATE KEY UPDATE status = 'active'`,
            [schoolId, stId, classId, subId]
          );
        }
      }
    }

    broadcastInvalidation(schoolId, ['results', 'students', 'classes'], 'student_subjects_updated');
    return res.json({ success: true, message: `Successfully enrolled ${student_ids.length} students into ${subject_ids.length} subjects.` });
  } catch (err) {
    console.error('Bulk assign subjects error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to bulk assign subjects.' } });
  }
});

module.exports = router;
