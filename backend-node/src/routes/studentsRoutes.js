const express = require('express');
const router = express.Router({ mergeParams: true });
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');

// GET /schools/:schoolId/students
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { class_id, search, status } = req.query;
    const isParent = req.user.role === 'parent';

    // If requester is a parent, only return their linked children
    if (isParent) {
      // Find the guardian record linked to this user's email or user_id
      const guardian = await queryOne(
        `SELECT g.id FROM guardians g WHERE g.email = ? OR g.user_id = ? LIMIT 1`,
        [req.user.email || '', req.user.id]
      );

      if (!guardian) {
        return res.json({ data: [], meta: { total: 0 } });
      }

      const children = await query(
        `SELECT st.*, c.name as class_name
         FROM students st
         JOIN student_guardians sg ON st.id = sg.student_id
         LEFT JOIN classes c ON st.class_id = c.id
         WHERE sg.guardian_id = ? AND st.school_id = ? AND st.status = 'active'
         ORDER BY st.first_name ASC`,
        [guardian.id, schoolId]
      );
      return res.json({ data: children, meta: { total: children.length } });
    }

    let sql = `
      SELECT st.*, c.name as class_name,
             g.name as guardian_name, g.phone as guardian_phone, g.email as guardian_email
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

    sql += ' ORDER BY st.first_name ASC, st.last_name ASC';

    const students = await query(sql, params);
    return res.json({
      data: students,
      meta: {
        total: students.length,
        per_page: 15,
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
      middle_name
    } = req.body;

    // Validate: guardian name is required
    if (!guardian_name || !guardian_name.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Guardian name is required. Every student must have a parent or guardian on record.' }
      });
    }

    // Validate: guardian must have at least phone or email
    if (!guardian_phone && !guardian_email) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Guardian contact is required. Please provide at least a phone number or email address.' }
      });
    }

    // Auto-generate admission number if not provided
    const year = new Date().getFullYear();
    const finalAdmNumber = (admission_number && admission_number.trim())
      ? admission_number.trim()
      : `ADM-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Duplicate admission number check
    const dup = await queryOne('SELECT id FROM students WHERE admission_number = ? AND school_id = ?', [finalAdmNumber, schoolId]);
    if (dup) return res.status(409).json({ error: { code: 'DUPLICATE', message: `Admission number '${finalAdmNumber}' is already registered.` } });

    const studentId = 'STD' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const dobVal = dob || date_of_birth || null;
    const addrVal = address || home_address || null;

    await query(
      `INSERT INTO students (id, school_id, class_id, first_name, last_name, middle_name, admission_number, gender, date_of_birth, home_address, nationality, religion, previous_school, medical_notes, leadership_position, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enrolled')`,
      [studentId, schoolId, class_id, first_name.trim(), last_name.trim(), middle_name?.trim() || null,
       finalAdmNumber, gender || 'other', dobVal, addrVal,
       nationality || null, religion || null, previous_school || null, medical_notes || null,
       leadership_position || null]
    );

    // Create guardian record
    let guardianId = null;
    // Check if guardian with this phone/email already exists in this school
    let existingGuardian = null;
    if (guardian_phone) {
      existingGuardian = await queryOne(
        'SELECT id FROM guardians WHERE school_id = ? AND phone = ?',
        [schoolId, guardian_phone.trim()]
      );
    }
    if (!existingGuardian && guardian_email) {
      existingGuardian = await queryOne(
        'SELECT id FROM guardians WHERE school_id = ? AND email = ?',
        [schoolId, guardian_email.trim()]
      );
    }

    if (existingGuardian) {
      guardianId = existingGuardian.id;
    } else {
      guardianId = 'GDN' + Math.random().toString(36).substr(2, 5).toUpperCase();
      await query(
        `INSERT INTO guardians (id, school_id, name, phone, email, national_id, relation) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [guardianId, schoolId, guardian_name.trim(), guardian_phone || null, guardian_email || null, guardian_national_id || null, guardian_relation || 'Parent']
      );
    }

    await query(
      `INSERT INTO student_guardians (student_id, guardian_id) VALUES (?, ?)`,
      [studentId, guardianId]
    );

    // Auto-generate parent user account credentials
    let parentCredentials = null;
    try {
      const gdn = await queryOne('SELECT * FROM guardians WHERE id = ?', [guardianId]);
      if (gdn && !gdn.user_id) {
        const userId = 'USR' + Math.random().toString(36).substr(2, 5).toUpperCase();
        const usernameStr = 'parent.' + finalAdmNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        const rawPass = 'Parent' + Math.floor(1000 + Math.random() * 9000) + '!';
        const hash = bcrypt.hashSync(rawPass, 10);
        
        await query(
          `INSERT INTO users (id, school_id, username, password_hash, role, email, status)
           VALUES (?, ?, ?, ?, 'parent', ?, 'active')`,
          [userId, schoolId, usernameStr, hash, guardian_email || null]
        );
        await query('UPDATE guardians SET user_id = ? WHERE id = ?', [userId, guardianId]);
        parentCredentials = {
          username: usernameStr,
          temp_password: rawPass
        };
      }
    } catch (passErr) {
      console.warn('Failed to auto-generate parent credentials:', passErr.message);
    }

    // Send enrollment notification to guardian
    try {
      const notifId = 'NTF' + Math.random().toString(36).substr(2, 5).toUpperCase();
      const message = `Dear ${guardian_name.trim()}, ${first_name.trim()} ${last_name.trim()} (Adm: ${finalAdmNumber}) has been successfully enrolled. Welcome to our school community.`;
      await query(
        `INSERT INTO notifications (id, school_id, user_id, title, message, is_read, created_at)
         VALUES (?, ?, NULL, ?, ?, 0, NOW())`,
        [notifId, schoolId, 'Enrollment Confirmation', message]
      );
    } catch (e) {
      console.warn('Failed to create enrollment notification:', e.message);
    }

    const created = await queryOne(
      `SELECT st.*, c.name as class_name
       FROM students st LEFT JOIN classes c ON st.class_id = c.id WHERE st.id = ?`,
      [studentId]
    );
    if (created && parentCredentials) {
      created.parent_credentials = parentCredentials;
    }
    return res.status(201).json({ data: created });
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
      const guardian = await queryOne(
        'SELECT g.id FROM guardians g WHERE g.email = ? OR g.user_id = ? LIMIT 1',
        [req.user.email || '', req.user.id]
      );
      if (guardian) {
        const link = await queryOne(
          'SELECT student_id FROM student_guardians WHERE guardian_id = ? AND student_id = ?',
          [guardian.id, id]
        );
        if (!link) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not authorised to view this student profile.' } });
        }
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
      `SELECT fp.*, f.term as fee_title, f.term
       FROM fee_payments fp
       JOIN fees f ON fp.fee_id = f.id
       WHERE fp.student_id = ?
       ORDER BY fp.payment_date DESC`,
      [id]
    );

    // Build fee summary
    const feeRecords = await query(
      'SELECT * FROM fees WHERE student_id = ?',
      [id]
    );
    const totalDue = feeRecords.reduce((sum, f) => sum + parseFloat(f.amount_due || 0), 0);
    const totalPaid = feeRecords.reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0);
    const feeSummary = {
      total_due: parseFloat(totalDue.toFixed(2)),
      total_paid: parseFloat(totalPaid.toFixed(2)),
      balance: parseFloat(Math.max(0, totalDue - totalPaid).toFixed(2)),
      records: feeRecords
    };

    return res.json({
      data: {
        student,
        guardians,
        grades,
        feePayments,
        feeSummary
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
    status:     { required: false, enum: ['active','inactive','graduated','suspended','expelled','enrolled','withdrawn','transferred','dropped_out'] },
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
    // promotions: [{ student_id, new_class_id, action: 'promote' | 'repeat' }]
    if (!promotions || !Array.isArray(promotions) || promotions.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Promotions array is required.' } });
    }

    let promoted = 0;
    let repeated = 0;
    for (const p of promotions) {
      if (!p.student_id || !p.new_class_id) continue;
      await query(
        'UPDATE students SET class_id = ?, previous_class_id = class_id WHERE id = ? AND school_id = ?',
        [p.new_class_id, p.student_id, schoolId]
      );
      if (p.action === 'repeat') {
        repeated++;
      } else {
        promoted++;
      }
    }

    return res.json({
      data: {
        message: `Promotion complete: ${promoted} student(s) promoted, ${repeated} student(s) set to repeat level.`,
        promoted,
        repeated
      }
    });
  } catch (err) {
    console.error('Promote students error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to process student promotions.' } });
  }
});

// GET /schools/:schoolId/guardians
router.get('/guardians', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const guardians = await query(
      `SELECT g.*, COUNT(sg.student_id) as children_count
       FROM guardians g
       LEFT JOIN student_guardians sg ON g.id = sg.guardian_id
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

// PATCH /schools/:schoolId/guardians/:id
router.patch('/guardians/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
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
      [name || null, phone || null, email || null, national_id || null, relation || null, id]
    );
    const updated = await queryOne('SELECT * FROM guardians WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    console.error('Update guardian error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update parent/guardian information.' } });
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
