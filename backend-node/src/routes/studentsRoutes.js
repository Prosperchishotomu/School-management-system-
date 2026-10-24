const express = require('express');
const router = express.Router({ mergeParams: true });
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  normalizeName,
  normalizeEmail,
  normalizePhone,
  normalizeCode,
  normalizeGender,
  normalizeNationalId,
  normalizeText
} = require('../utils/normalizer');


// GET /schools/:schoolId/students
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { class_id, search, status } = req.query;
    const isParent = req.user.role === 'parent';

    // If requester is a parent, return all their linked children across all matched guardian records
    if (isParent) {
      const children = await query(
        `SELECT DISTINCT st.*, c.name as class_name,
                g.name as guardian_name, g.phone as guardian_phone, g.email as guardian_email
         FROM students st
         JOIN student_guardians sg ON st.id = sg.student_id
         JOIN guardians g ON sg.guardian_id = g.id
         LEFT JOIN classes c ON st.class_id = c.id
         WHERE (
           g.user_id = ?
           OR (g.email IS NOT NULL AND g.email != '' AND g.email = ?)
           OR (g.phone IS NOT NULL AND g.phone != '' AND g.phone = ?)
         ) AND st.school_id = ? AND st.status IN ('enrolled', 'active', 'suspended')
         ORDER BY st.first_name ASC`,
        [req.user.id, req.user.email || '', req.user.phone || '', schoolId]
      );
      return res.json({ data: children, meta: { total: children.length, per_page: children.length, page: 1 } });
    }

    // If requester is a teacher, restrict view to students in their classes or studying their subjects only
    if (req.user.role === 'teacher') {
      const staffRows = await query('SELECT id FROM staff WHERE user_id = ?', [req.user.id]);
      const empRows = await query('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
      const teacherIds = [req.user.id, ...staffRows.map(s => s.id), ...empRows.map(e => e.id)];
      const teacherPlaceholders = teacherIds.map(() => '?').join(',');

      let teacherSql = `
        SELECT st.*, c.name as class_name,
               GROUP_CONCAT(DISTINCT g.name SEPARATOR ', ') as guardian_name,
               MAX(g.phone) as guardian_phone,
               MAX(g.email) as guardian_email
        FROM students st
        LEFT JOIN classes c ON st.class_id = c.id
        LEFT JOIN student_guardians sg ON st.id = sg.student_id
        LEFT JOIN guardians g ON sg.guardian_id = g.id
        WHERE st.school_id = ?
          AND (
            c.form_master_id IN (${teacherPlaceholders})
            OR st.class_id IN (SELECT class_id FROM staff WHERE (user_id IN (${teacherPlaceholders}) OR id IN (${teacherPlaceholders})) AND class_id IS NOT NULL)
            OR st.class_id IN (SELECT class_id FROM teaching_assignments WHERE teacher_id IN (${teacherPlaceholders}))
            OR st.class_id IN (SELECT class_id FROM timetable WHERE teacher_id IN (${teacherPlaceholders}))
            OR st.id IN (SELECT ss.student_id FROM student_subjects ss JOIN teaching_assignments ta ON ss.subject_id = ta.subject_id WHERE ta.teacher_id IN (${teacherPlaceholders}))
          )
      `;
      const teacherParams = [schoolId, ...teacherIds, ...teacherIds, ...teacherIds, ...teacherIds, ...teacherIds, ...teacherIds];

      if (class_id) {
        teacherSql += ' AND st.class_id = ?';
        teacherParams.push(class_id);
      }
      if (status) {
        teacherSql += ' AND st.status = ?';
        teacherParams.push(status);
      }
      if (search) {
        teacherSql += ' AND (st.first_name LIKE ? OR st.last_name LIKE ? OR st.admission_number LIKE ?)';
        teacherParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      teacherSql += ' GROUP BY st.id ORDER BY st.first_name ASC, st.last_name ASC';

      const students = await query(teacherSql, teacherParams);
      return res.json({
        data: students,
        meta: { total: students.length, per_page: 15, page: 1 }
      });
    }

    let sql = `
      SELECT st.*, c.name as class_name,
             GROUP_CONCAT(DISTINCT g.name SEPARATOR ', ') as guardian_name,
             MAX(g.phone) as guardian_phone,
             MAX(g.email) as guardian_email
      FROM students st
      LEFT JOIN classes c ON st.class_id = c.id
      LEFT JOIN student_guardians sg ON st.id = sg.student_id
      LEFT JOIN guardians g ON sg.guardian_id = g.id
      WHERE st.school_id = ?
    `;
    const params = [schoolId];

    if (class_id) {
      sql += ' AND st.class_id = ?';
      params.push(class_id);
    }

    if (status) {
      sql += ' AND st.status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (st.first_name LIKE ? OR st.last_name LIKE ? OR st.admission_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' GROUP BY st.id ORDER BY st.first_name ASC, st.last_name ASC';

    const students = await query(sql, params);
    return res.json({
      data: students,
      meta: {
        total: students.length,
        per_page: students.length,
        page: 1
      }
    });
  } catch (err) {
    console.error('Get students error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch students roster.' } });
  }
});

// POST /schools/:schoolId/students
router.post('/',
  authenticateToken,
  requireRoles('school_admin', 'super_admin'),
  validate.run({
    first_name:       { required: true,  minLen: 2,  maxLen: 80  },
    last_name:        { required: true,  minLen: 2,  maxLen: 80  },
    admission_number: { required: false, minLen: 1,  maxLen: 30  },
    class_id:         { required: true  },
    gender:           { required: false, enum: ['male','female','other'] },
    dob:              { required: false, isDate: true },
    guardian_email:   { required: false, isEmail: true },
  }),
  async (req, res) => {
  try {
    const { schoolId } = req.params;
    const {
      first_name, last_name, admission_number, class_id, gender, dob, address,
      leadership_position, guardian_name, guardian_phone, guardian_email,
      guardian_national_id, guardian_relation,
      // Accept alternate field names from multi-section form
      date_of_birth, home_address, nationality, religion, previous_school, medical_notes,
      middle_name,
      // Manual parent credentials (admin-supplied)
      parent_username, parent_password
    } = req.body;

    // Normalize all input strings
    const cleanFirstName = normalizeName(first_name);
    const cleanLastName = normalizeName(last_name);
    const cleanMiddleName = middle_name ? normalizeName(middle_name) : null;
    const cleanGuardianName = normalizeName(guardian_name);
    const cleanGuardianPhone = guardian_phone ? normalizePhone(guardian_phone) : null;
    const cleanGuardianEmail = guardian_email ? normalizeEmail(guardian_email) : null;
    const cleanGuardianNatId = guardian_national_id ? normalizeNationalId(guardian_national_id) : null;
    const cleanGender = normalizeGender(gender);
    const cleanAddress = address || home_address ? normalizeText(address || home_address) : null;

    // Validate: guardian name is required
    if (!cleanGuardianName) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Guardian name is required. Every student must have a parent or guardian on record.' }
      });
    }

    // Validate: guardian must have at least phone or email
    if (!cleanGuardianPhone && !cleanGuardianEmail) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Guardian contact is required. Please provide at least a phone number or email address.' }
      });
    }

    // Derive or validate parent portal credentials
    let finalParentUsername = (parent_username || '').trim().toLowerCase();
    let finalParentPassword = (parent_password || '').trim();

    if (!finalParentUsername) {
      const cleanGName = cleanGuardianName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
      finalParentUsername = `p.${cleanGName.substring(0, 15)}.${Math.random().toString(36).substr(2, 4)}`;
    }
    if (!finalParentPassword) {
      finalParentPassword = 'Sb' + Math.floor(100000 + Math.random() * 900000) + '!';
    }

    // Check username uniqueness
    const existingUsername = await queryOne('SELECT id FROM users WHERE username = ?', [finalParentUsername]);
    if (existingUsername) {
      if (parent_username && parent_username.trim()) {
        return res.status(409).json({
          error: { code: 'DUPLICATE_USERNAME', message: `Username '${parent_username.trim()}' is already taken. Please choose a different username for the parent.` }
        });
      } else {
        finalParentUsername = `${finalParentUsername}.${Math.random().toString(36).substr(2, 3)}`;
      }
    }

    // Auto-generate admission number starting with current year + 2 digits + 1 uppercase letter
    const year = new Date().getFullYear();
    const randDigits = Math.floor(10 + Math.random() * 90);
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const finalAdmNumber = admission_number ? normalizeCode(admission_number) : `${year}${randDigits}${letter}`;

    // Duplicate admission number check
    const dup = await queryOne('SELECT id FROM students WHERE admission_number = ? AND school_id = ?', [finalAdmNumber, schoolId]);
    if (dup) return res.status(409).json({ error: { code: 'DUPLICATE', message: `Admission number '${finalAdmNumber}' is already in use. Please use a unique admission number.` } });

    // Duplicate student name & class check (case & whitespace insensitive)
    const nameDup = await queryOne(
      'SELECT id FROM students WHERE school_id = ? AND LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND class_id = ? AND status != "transferred"',
      [schoolId, cleanFirstName, cleanLastName, class_id]
    );
    if (nameDup) return res.status(409).json({ error: { code: 'DUPLICATE', message: `Student '${cleanFirstName} ${cleanLastName}' is already registered in this class.` } });

    const studentId = 'STD' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const dobVal = dob || date_of_birth || null;

    await query(
      `INSERT INTO students (id, school_id, class_id, first_name, last_name, middle_name, admission_number, gender, date_of_birth, home_address, nationality, religion, previous_school, medical_notes, leadership_position, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enrolled')`,
      [studentId, schoolId, class_id, cleanFirstName, cleanLastName, cleanMiddleName,
       finalAdmNumber, cleanGender, dobVal, cleanAddress,
       nationality ? normalizeText(nationality) : null, religion ? normalizeText(religion) : null,
       previous_school ? normalizeText(previous_school) : null, medical_notes ? normalizeText(medical_notes) : null,
       leadership_position ? normalizeText(leadership_position) : null]
    );

    // Create or link guardian record
    let guardianId = null;
    let existingGuardian = null;
    if (cleanGuardianPhone) {
      existingGuardian = await queryOne(
        'SELECT id, user_id FROM guardians WHERE school_id = ? AND (phone = ? OR REPLACE(phone, " ", "") = ?)',
        [schoolId, cleanGuardianPhone, cleanGuardianPhone.replace(/\s+/g, '')]
      );
    }
    if (!existingGuardian && cleanGuardianEmail) {
      existingGuardian = await queryOne(
        'SELECT id, user_id FROM guardians WHERE school_id = ? AND LOWER(email) = ?',
        [schoolId, cleanGuardianEmail]
      );
    }

    let parentCredentials = null;

    if (existingGuardian) {
      guardianId = existingGuardian.id;
      // If guardian exists but doesn't have a linked user account, create one using admin-supplied credentials
      if (!existingGuardian.user_id) {
        const passHash = bcrypt.hashSync(finalParentPassword, 10);
        const userId = 'USR' + Math.random().toString(36).substr(2, 5).toUpperCase();

        await query(
          `INSERT INTO users (id, username, password_hash, role, school_id, status, phone, email) 
           VALUES (?, ?, ?, 'parent', ?, 'active', ?, ?)`,
          [userId, finalParentUsername, passHash, schoolId, cleanGuardianPhone || null, cleanGuardianEmail || null]
        );

        await query('UPDATE guardians SET user_id = ? WHERE id = ?', [userId, guardianId]);
        
        parentCredentials = { 
          username: finalParentUsername,
          password: finalParentPassword
        };
      } else {
        // Guardian already has an account — just link the student, no new credentials needed
        parentCredentials = null;
      }
    } else {
      guardianId = 'GDN' + Math.random().toString(36).substr(2, 5).toUpperCase();
      
      const passHash = bcrypt.hashSync(finalParentPassword, 10);
      const userId = 'USR' + Math.random().toString(36).substr(2, 5).toUpperCase();

      await query(
        `INSERT INTO users (id, username, password_hash, role, school_id, status, phone, email) 
         VALUES (?, ?, ?, 'parent', ?, 'active', ?, ?)`,
        [userId, finalParentUsername, passHash, schoolId, cleanGuardianPhone || null, cleanGuardianEmail || null]
      );

      await query(
        `INSERT INTO guardians (id, school_id, name, phone, email, national_id, relation, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [guardianId, schoolId, cleanGuardianName, cleanGuardianPhone || null, cleanGuardianEmail || null, cleanGuardianNatId || null, guardian_relation ? normalizeText(guardian_relation) : 'Parent', userId]
      );

      parentCredentials = { 
        username: finalParentUsername,
        password: finalParentPassword
      };
    }


    await query(
      `INSERT INTO student_guardians (student_id, guardian_id) VALUES (?, ?)`,
      [studentId, guardianId]
    );

    const student = await queryOne(
      `SELECT st.*, c.name as class_name
       FROM students st LEFT JOIN classes c ON st.class_id = c.id WHERE st.id = ?`,
      [studentId]
    );

    return res.status(201).json({ 
      data: student, 
      credentials: parentCredentials 
    });
  } catch (err) {
    console.error('Create student error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create student.' } });
  }

});


// GET /schools/:schoolId/students/:id/profile
router.get('/:id/profile', authenticateToken, async (req, res) => {
  try {
    const { schoolId, id } = req.params;

    // Parents can only view their own children
    if (req.user.role === 'parent') {
      const guardianRows = await query(
        `SELECT g.id FROM guardians g 
         WHERE g.user_id = ? 
            OR (g.email IS NOT NULL AND g.email != '' AND g.email = ?)
            OR (g.phone IS NOT NULL AND g.phone != '' AND g.phone = ?)`,
        [req.user.id, req.user.email || '', req.user.phone || '']
      );
      const guardianIds = guardianRows.map(r => r.id);
      if (guardianIds.length === 0) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No guardian link is associated with this account.' } });
      }
      const gPlaceholders = guardianIds.map(() => '?').join(',');
      const link = await queryOne(
        `SELECT student_id FROM student_guardians WHERE guardian_id IN (${gPlaceholders}) AND student_id = ?`,
        [...guardianIds, id]
      );
      if (!link) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not authorised to view this student profile.' } });
      }
    }

    // Teachers can only view students in their classes or studying their subjects
    if (req.user.role === 'teacher') {
      const staffRows = await query('SELECT id FROM staff WHERE user_id = ?', [req.user.id]);
      const empRows = await query('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
      const teacherIds = [req.user.id, ...staffRows.map(s => s.id), ...empRows.map(e => e.id)];
      const teacherPlaceholders = teacherIds.map(() => '?').join(',');
      const permitted = await queryOne(
        `SELECT st.id FROM students st
         LEFT JOIN classes c ON st.class_id = c.id
         WHERE st.id = ? AND st.school_id = ?
           AND (
             c.form_master_id IN (${teacherPlaceholders})
             OR st.class_id IN (SELECT class_id FROM staff WHERE (user_id IN (${teacherPlaceholders}) OR id IN (${teacherPlaceholders})) AND class_id IS NOT NULL)
             OR st.class_id IN (SELECT class_id FROM teaching_assignments WHERE teacher_id IN (${teacherPlaceholders}))
             OR st.class_id IN (SELECT class_id FROM timetable WHERE teacher_id IN (${teacherPlaceholders}))
             OR st.id IN (SELECT ss.student_id FROM student_subjects ss JOIN teaching_assignments ta ON ss.subject_id = ta.subject_id WHERE ta.teacher_id IN (${teacherPlaceholders}))
           )`,
        [id, schoolId, ...teacherIds, ...teacherIds, ...teacherIds, ...teacherIds, ...teacherIds, ...teacherIds]
      );
      if (!permitted) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are only permitted to view students within your assigned classes and subjects.' } });
      }
    }

    const student = await queryOne(
      `SELECT st.*, c.name as class_name, s.name as school_name
       FROM students st
       JOIN schools s ON st.school_id = s.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE st.id = ? AND st.school_id = ?`,
      [id, schoolId]
    );

    if (!student) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Student profile not found.' } });
    }

    const guardians = await query(
      `SELECT g.* FROM guardians g JOIN student_guardians sg ON g.id = sg.guardian_id WHERE sg.student_id = ?`,
      [id]
    );

    const grades = await query(
      `SELECT g.*, g.subject as subject_name
       FROM grades g
       WHERE g.student_id = ?
       ORDER BY g.created_at DESC`,
      [id]
    );

    const feePayments = await query(
      `SELECT fp.*, f.term as fee_title, f.term, f.id as fee_id
       FROM fee_payments fp
       JOIN fees f ON fp.fee_id = f.id
       WHERE fp.student_id = ?
       ORDER BY fp.payment_date DESC`,
      [id]
    );

    // Build fee summary — include both naming conventions for backward-compat
    const feeRecords = await query(
      'SELECT * FROM fees WHERE student_id = ? ORDER BY created_at DESC',
      [id]
    );
    const totalDue  = feeRecords.reduce((sum, f) => sum + parseFloat(f.amount_due  || 0), 0);
    const totalPaid = feeRecords.reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0);
    const balance   = Math.max(0, totalDue - totalPaid);
    // Pick the most recent unpaid fee id for online payment button
    const latestFeePendingId = feeRecords.find(f => parseFloat(f.amount_paid || 0) < parseFloat(f.amount_due || 0))?.id
                             || feeRecords[0]?.id
                             || null;
    const feeSummary = {
      id:          latestFeePendingId,                      // needed for pay-online button
      total_due:   parseFloat(totalDue.toFixed(2)),
      total_paid:  parseFloat(totalPaid.toFixed(2)),
      balance:     parseFloat(balance.toFixed(2)),
      amount_due:  parseFloat(totalDue.toFixed(2)),         // legacy frontend field
      amount_paid: parseFloat(totalPaid.toFixed(2)),        // legacy frontend field
      status:      balance <= 0 ? 'cleared' : (totalPaid > 0 ? 'partial' : 'unpaid'),
      records:     feeRecords
    };

    // Attendance summary
    let attendanceSummary = { present: 0, absent: 0, late: 0, total: 0, percentage: 100 };
    try {
      const attRecords = await query(
        'SELECT status FROM attendance WHERE student_id = ?', [id]
      );
      const present = attRecords.filter(a => a.status === 'present').length;
      const absent  = attRecords.filter(a => a.status === 'absent').length;
      const late    = attRecords.filter(a => a.status === 'late').length;
      const total   = attRecords.length;
      attendanceSummary = {
        present, absent, late, total,
        percentage: total > 0 ? Math.round(((present + late) / total) * 100) : 100
      };
    } catch(e) {}

    // Discipline history
    let disciplineRecords = [];
    try {
      disciplineRecords = await query(
        'SELECT * FROM discipline WHERE student_id = ? ORDER BY date DESC LIMIT 20', [id]
      );
    } catch(e) {}

    return res.json({
      data: {
        student,
        guardians,
        grades,
        feePayments,
        feeSummary,
        attendanceSummary,
        disciplineRecords
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load student profile.' } });
  }
});

// PATCH /schools/:schoolId/students/:id
router.patch('/:id',
  authenticateToken,
  requireRoles('school_admin', 'super_admin', 'teacher'),
  validate.run({
    first_name: { required: false, minLen: 2, maxLen: 80  },
    last_name:  { required: false, minLen: 2, maxLen: 80  },
    status:     { required: false, enum: ['enrolled','suspended','withdrawn','graduated','transferred','dropped_out'] },
    gender:     { required: false, enum: ['male','female','other'] },
  }),
  async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { first_name, last_name, middle_name, class_id, status, leadership_position, gender, dob, date_of_birth, nationality, religion, home_address, previous_school, medical_notes } = req.body;

    const updates = [];
    const params = [];

    if (first_name) { updates.push('first_name = ?'); params.push(first_name.trim()); }
    if (last_name) { updates.push('last_name = ?'); params.push(last_name.trim()); }
    if (middle_name !== undefined) { updates.push('middle_name = ?'); params.push(middle_name); }
    if (class_id !== undefined) { updates.push('class_id = ?'); params.push(class_id); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (leadership_position !== undefined) { updates.push('leadership_position = ?'); params.push(leadership_position); }
    if (gender) { updates.push('gender = ?'); params.push(gender); }
    const dobVal = dob || date_of_birth;
    if (dobVal) { updates.push('date_of_birth = ?'); params.push(dobVal); }
    if (nationality !== undefined) { updates.push('nationality = ?'); params.push(nationality); }
    if (religion !== undefined) { updates.push('religion = ?'); params.push(religion); }
    if (home_address !== undefined) { updates.push('home_address = ?'); params.push(home_address); }
    if (previous_school !== undefined) { updates.push('previous_school = ?'); params.push(previous_school); }
    if (medical_notes !== undefined) { updates.push('medical_notes = ?'); params.push(medical_notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No valid update fields provided.' } });
    }

    params.push(id, schoolId);
    await query(`UPDATE students SET ${updates.join(', ')} WHERE id = ? AND school_id = ?`, params);

    const updated = await queryOne('SELECT * FROM students WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    console.error('Update student error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update student profile.' } });
  }
});

// DELETE /schools/:schoolId/students/:id
router.delete('/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    await query('DELETE FROM students WHERE id = ? AND school_id = ?', [id, schoolId]);
    return res.json({ data: { message: 'Student record deleted successfully.' } });
  } catch (err) {
    console.error('Delete student error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete student.' } });
  }
});

// POST /schools/:schoolId/promote-students
router.post('/promote', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { promotions } = req.body;
    // promotions: [{ student_id, new_class_id, action: 'promote' | 'repeat' | 'graduate' }]
    if (!promotions || !Array.isArray(promotions) || promotions.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Promotions array is required.' } });
    }

    let promoted = 0;
    let repeated = 0;
    let graduated = 0;
    for (const p of promotions) {
      if (!p.student_id) continue;

      if (p.action === 'graduate') {
        await query(
          "UPDATE students SET class_id = NULL, previous_class_id = class_id, status = 'graduated' WHERE id = ? AND school_id = ?",
          [p.student_id, schoolId]
        );
        graduated++;
      } else if (p.action === 'repeat') {
        await query(
          "UPDATE students SET previous_class_id = class_id WHERE id = ? AND school_id = ?",
          [p.student_id, schoolId]
        );
        repeated++;
      } else {
        // promote
        if (!p.new_class_id) continue;
        await query(
          'UPDATE students SET class_id = ?, previous_class_id = class_id WHERE id = ? AND school_id = ?',
          [p.new_class_id, p.student_id, schoolId]
        );
        promoted++;
      }
    }

    return res.json({
      data: {
        message: `Promotion complete: ${promoted} student(s) promoted, ${repeated} student(s) set to repeat, ${graduated} student(s) graduated.`,
        promoted,
        repeated,
        graduated
      }
    });
  } catch (err) {
    console.error('Promote students error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to process student promotions.' } });
  }
});

// GET /schools/:schoolId/guardians
// GET /schools/:schoolId/guardians
router.get('/guardians', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const guardians = await query(
      `SELECT g.*, 
              COUNT(sg.student_id) as children_count,
              GROUP_CONCAT(DISTINCT CONCAT(st.first_name, ' ', st.last_name) SEPARATOR ', ') as linked_children
       FROM guardians g
       LEFT JOIN student_guardians sg ON g.id = sg.guardian_id
       LEFT JOIN students st ON sg.student_id = st.id
       WHERE g.school_id = ?
       GROUP BY g.id
       ORDER BY g.name ASC`,
      [schoolId]
    );
    return res.json({ data: guardians });
  } catch (err) {
    console.error('Get guardians error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch guardians directory.' } });
  }
});

// GET /schools/:schoolId/students/export
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const students = await query(
      `SELECT st.*, c.name as class_name
       FROM students st
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE st.school_id = ?
       ORDER BY st.first_name ASC`,
      [schoolId]
    );

    let csvContent = 'Admission Number,First Name,Last Name,Gender,Class,Status\n';
    students.forEach(st => {
      csvContent += `"${st.admission_number || ''}","${st.first_name || ''}","${st.last_name || ''}","${st.gender || ''}","${st.class_name || ''}","${st.status || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=students_${schoolId}.csv`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export students error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to export student roster.' } });
  }
});

// POST /schools/:schoolId/students/bulk-delete
router.post('/bulk-delete', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { student_ids } = req.body;
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No student IDs provided for bulk deletion.' } });
    }
    const placeholders = student_ids.map(() => '?').join(',');
    await query(`DELETE FROM students WHERE id IN (${placeholders}) AND school_id = ?`, [...student_ids, schoolId]);
    return res.json({ data: { message: `Successfully deleted ${student_ids.length} student records.` } });
  } catch (err) {
    console.error('Bulk delete students error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to perform bulk student deletion.' } });
  }
});

// PUT / PATCH /schools/:schoolId/guardians/:id
const handleUpdateGuardian = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, national_id, relation } = req.body;
    await query(
      `UPDATE guardians SET
         name        = COALESCE(?, name),
         phone       = COALESCE(?, phone),
         email       = COALESCE(?, email),
         national_id = COALESCE(?, national_id),
         relation    = COALESCE(?, relation)
       WHERE id = ?`,
      [
        name ? normalizeName(name) : null,
        phone ? normalizePhone(phone) : null,
        email ? normalizeEmail(email) : null,
        national_id ? normalizeNationalId(national_id) : null,
        relation ? normalizeText(relation) : null,
        id
      ]
    );
    const updated = await queryOne('SELECT * FROM guardians WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    console.error('Update guardian error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update parent/guardian information.' } });
  }
};

router.patch('/guardians/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleUpdateGuardian);
router.put('/guardians/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleUpdateGuardian);

// DELETE /schools/:schoolId/guardians/:id
router.delete('/guardians/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM student_guardians WHERE guardian_id = ?', [id]);
    await query('DELETE FROM guardians WHERE id = ?', [id]);
    return res.json({ data: { message: 'Parent record removed successfully.' } });
  } catch (err) {
    console.error('Delete guardian error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete parent record.' } });
  }
});


// GET /schools/:schoolId/students/:studentId/discipline
router.get('/:studentId/discipline', authenticateToken, async (req, res) => {
  try {
    const { schoolId, studentId } = req.params;
    const incidents = await query(
      `SELECT di.*, st.first_name, st.last_name, st.admission_number
       FROM discipline_incidents di
       JOIN students st ON di.student_id = st.id
       WHERE di.school_id = ? AND di.student_id = ?
       ORDER BY di.incident_date DESC`,
      [schoolId, studentId]
    );
    return res.json({ data: incidents });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch student discipline incidents.' } });
  }
});

// POST /schools/:schoolId/students/:studentId/discipline
router.post('/:studentId/discipline', authenticateToken, requireRoles('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, studentId } = req.params;
    const { incident_type, severity, description, action_taken, incident_date } = req.body;
    if (!incident_type || !description) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Incident type and description are required.' } });
    }
    const id = 'DIS' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const dateVal = incident_date || new Date().toISOString().slice(0, 10);
    await query(
      `INSERT INTO discipline_incidents (id, school_id, student_id, incident_type, severity, description, action_taken, incident_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      [id, schoolId, studentId, incident_type, severity || 'minor', description, action_taken || null, dateVal]
    );
    const created = await queryOne('SELECT * FROM discipline_incidents WHERE id = ?', [id]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Record student discipline incident error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to record discipline incident.' } });
  }
});

module.exports = router;
