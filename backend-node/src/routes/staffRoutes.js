const express = require('express');
const router = express.Router({ mergeParams: true });
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { broadcastInvalidation } = require('../services/realtime');
const {
  normalizeName,
  normalizeEmail,
  normalizePhone,
  normalizeCode,
  normalizeText
} = require('../utils/normalizer');

// GET /schools/:schoolId/staff
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const staff = await query(
      `SELECT stf.*, c.name as assigned_class_name, u.username, u.role as user_role, u.status as account_status
       FROM staff stf
       LEFT JOIN classes c ON stf.class_id = c.id
       LEFT JOIN users u ON stf.user_id = u.id
       WHERE stf.school_id = ?
       ORDER BY stf.name ASC`,
      [schoolId]
    );
    return res.json({ data: staff });
  } catch (err) {
    console.error('Get staff error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch staff roster.' } });
  }
});

// GET /schools/:schoolId/staff/:id — detailed staff profile
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const staff = await queryOne(
      `SELECT stf.*, c.name as assigned_class_name, u.username, u.role as user_role, u.status as account_status, u.email as user_email
       FROM staff stf
       LEFT JOIN classes c ON stf.class_id = c.id
       LEFT JOIN users u ON stf.user_id = u.id
       WHERE stf.id = ? AND stf.school_id = ?`,
      [id, schoolId]
    );
    if (!staff) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Staff member not found.' } });

    // Teaching assignments
    let assignments = [];
    try {
      assignments = await query(
        `SELECT ta.*, c.name as class_name, sub.name as subject_name
         FROM teaching_assignments ta
         LEFT JOIN classes c ON ta.class_id = c.id
         LEFT JOIN subjects sub ON ta.subject_id = sub.id
         WHERE ta.school_id = ? AND ta.teacher_id = ?
         ORDER BY c.name ASC`,
        [schoolId, staff.user_id || id]
      );
    } catch(e) {}

    // Sent messages
    let messages = [];
    try {
      messages = await query(
        `SELECT * FROM teacher_messages WHERE school_id = ? AND (sender_id = ? OR recipient_id = ?)
         ORDER BY created_at DESC LIMIT 20`,
        [schoolId, staff.user_id || id, staff.user_id || id]
      );
    } catch(e) {}

    return res.json({ data: { staff, assignments, messages } });
  } catch (err) {
    console.error('Get staff profile error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load staff profile.' } });
  }
});

// POST /schools/:schoolId/staff
router.post('/', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, email, phone, role_title, class_id, username, password, subject_ids, qualification, experience_years, ec_number, employment_type } = req.body;

    const cleanName = normalizeName(name);
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = normalizePhone(phone);
    const cleanEcNumber = ec_number ? normalizeCode(ec_number) : null;
    const cleanRoleTitle = role_title ? normalizeText(role_title) : 'Teacher';

    if (!cleanName) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Full name is required.' } });
    }

    // Determine final username (preserve provided username or build cleanly)
    let finalUsername;
    if (username && username.trim()) {
      finalUsername = username.trim().toLowerCase();
    } else {
      const baseUsername = (cleanEmail ? cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '') : null) ||
        cleanName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').substring(0, 20);
      const exists = await queryOne('SELECT id FROM users WHERE username = ?', [baseUsername]);
      finalUsername = exists ? (baseUsername + Math.random().toString(36).substr(2, 3)) : baseUsername;
    }

    // Use provided password or generate a random temporary password
    const finalPassword = password?.trim() || (crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, 'a') + '!9A');

    // Enforce email uniqueness across all staff and users
    if (cleanEmail) {
      const existingStaffEmail = await queryOne('SELECT id FROM staff WHERE LOWER(email) = ?', [cleanEmail]);
      const existingUserEmail = await queryOne('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (existingStaffEmail || existingUserEmail) {
        return res.status(400).json({ error: { code: 'DUPLICATE_EMAIL', message: `Email '${cleanEmail}' is already registered by another staff member.` } });
      }
    }

    // Check existing name in school (case-insensitive & trimmed)
    if (cleanName) {
      const existingName = await queryOne('SELECT id FROM staff WHERE school_id = ? AND LOWER(name) = LOWER(?)', [schoolId, cleanName]);
      if (existingName) {
        return res.status(409).json({ error: { code: 'DUPLICATE', message: `Staff member '${cleanName}' is already registered in this school.` } });
      }
    }

    // Check existing username
    const existingUser = await queryOne('SELECT id FROM users WHERE username = ?', [finalUsername]);
    if (existingUser) {
      return res.status(400).json({ error: { code: 'DUPLICATE_USERNAME', message: `Username '${finalUsername}' is already taken. Please choose another username.` } });
    }

    const userId = 'USR' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const staffId = 'STF' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const passHash = bcrypt.hashSync(finalPassword, 10);

    // Determine account role based on role_title
    const titleLower = cleanRoleTitle.toLowerCase();
    const isLeadership = titleLower.includes('principal') || 
                         titleLower.includes('head') || 
                         titleLower.includes('admin') ||
                         titleLower.includes('deputy');
    const userRole = req.body.role || (isLeadership ? 'school_admin' : 'teacher');

    // Create user login account
    await query(
      `INSERT INTO users (id, school_id, username, email, password_hash, role, name, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [userId, schoolId, finalUsername, cleanEmail || null, passHash, userRole, cleanName, cleanPhone || null]
    );

    // Create staff record with qualification and experience
    await query(
      `INSERT INTO staff (id, school_id, user_id, class_id, name, email, phone, role_title, qualification, experience_years, ec_number, employment_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [staffId, schoolId, userId, class_id || null, cleanName, cleanEmail || null, cleanPhone || null, cleanRoleTitle, qualification ? normalizeText(qualification) : null, experience_years ? parseInt(experience_years) : null, cleanEcNumber, employment_type || 'permanent']
    );

    // If subject_ids provided, create teaching_assignments (no class_id required here — class can be assigned later via timetable)
    if (Array.isArray(subject_ids) && subject_ids.length > 0) {
      for (const subjectId of subject_ids) {
        try {
          const taId = 'TA' + Math.random().toString(36).substr(2, 6).toUpperCase();
          // Use class_id if provided, otherwise a placeholder (we allow null by making a nullable class_id or skip)
          // teaching_assignments has class_id NOT NULL, so we only insert if class_id is provided
          if (class_id) {
            await query(
              `INSERT IGNORE INTO teaching_assignments (id, school_id, teacher_id, class_id, subject_id) VALUES (?, ?, ?, ?, ?)`,
              [taId, schoolId, userId, class_id, subjectId]
            );
          }
          // Store the teacher's preferred subjects in a looser way — store in a staff_subjects table or as a JSON note
          // As a safe fallback, also store in a staff_subjects junction table if it exists
          try {
            await query(
              `INSERT IGNORE INTO staff_subjects (staff_id, school_id, subject_id) VALUES (?, ?, ?)`,
              [staffId, schoolId, subjectId]
            );
          } catch (_) { /* table may not exist yet — will be created below */ }
        } catch (e) { console.error('Subject assignment error:', e); }
      }
    }

    const created = await queryOne(
      `SELECT stf.*, c.name as assigned_class_name, u.username
       FROM staff stf
       LEFT JOIN classes c ON stf.class_id = c.id
       LEFT JOIN users u ON stf.user_id = u.id
       WHERE stf.id = ?`,
      [staffId]
    );

    try {
      broadcastInvalidation(schoolId, ['staff', 'classes', 'users'], 'staff_created');
    } catch (_) {}

    // Return the generated credentials so admin can share them
    return res.status(201).json({
      data: {
        ...created,
        generated_username: finalUsername,
        generated_password: password ? null : finalPassword
      }
    });
  } catch (err) {
    console.error('Create staff error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to add staff member.' } });
  }
});

// PUT/PATCH /schools/:schoolId/staff/:id
const handleUpdateStaff = async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { name, email, phone, role_title, class_id, status, qualification, experience_years, ec_number, employment_type } = req.body;

    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (role_title) { updates.push('role_title = ?'); params.push(role_title.trim()); }
    if (class_id !== undefined) { updates.push('class_id = ?'); params.push(class_id); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (qualification !== undefined) { updates.push('qualification = ?'); params.push(qualification); }
    if (experience_years !== undefined) { updates.push('experience_years = ?'); params.push(experience_years ? parseInt(experience_years) : null); }
    if (ec_number !== undefined) { updates.push('ec_number = ?'); params.push(ec_number); }
    if (employment_type !== undefined) { updates.push('employment_type = ?'); params.push(employment_type); }

    if (updates.length > 0) {
      params.push(id, schoolId);
      await query(`UPDATE staff SET ${updates.join(', ')} WHERE id = ? AND school_id = ?`, params);

      // Also toggle user account status if status changed
      if (status) {
        const staff = await queryOne('SELECT user_id FROM staff WHERE id = ?', [id]);
        if (staff && staff.user_id) {
          await query('UPDATE users SET status = ? WHERE id = ?', [status, staff.user_id]);
        }
      }
    }

    try {
      broadcastInvalidation(schoolId, ['staff', 'classes', 'users'], 'staff_updated');
    } catch (_) {}

    const updated = await queryOne('SELECT * FROM staff WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    console.error('Update staff error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update staff member.' } });
  }
};

router.put('/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleUpdateStaff);
router.patch('/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), handleUpdateStaff);

// POST /schools/:schoolId/staff/bulk-delete
router.post('/bulk-delete', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { staff_ids } = req.body;
    if (!Array.isArray(staff_ids) || staff_ids.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No staff IDs provided for bulk deletion.' } });
    }
    const placeholders = staff_ids.map(() => '?').join(',');
    // Fetch associated user_ids
    const staffMembers = await query(`SELECT user_id FROM staff WHERE id IN (${placeholders}) AND school_id = ?`, [...staff_ids, schoolId]);
    const userIds = staffMembers.map(s => s.user_id).filter(Boolean);

    await query(`DELETE FROM staff WHERE id IN (${placeholders}) AND school_id = ?`, [...staff_ids, schoolId]);
    if (userIds.length > 0) {
      const uPlaceholders = userIds.map(() => '?').join(',');
      await query(`DELETE FROM users WHERE id IN (${uPlaceholders})`, userIds);
    }

    try {
      broadcastInvalidation(schoolId, ['staff', 'classes', 'users'], 'staff_deleted');
    } catch (_) {}

    return res.json({ data: { message: `Successfully deleted ${staff_ids.length} staff records.` } });
  } catch (err) {
    console.error('Bulk delete staff error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to perform bulk staff deletion.' } });
  }
});

// DELETE /schools/:schoolId/staff/:id
router.delete('/:id', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const staff = await queryOne('SELECT user_id FROM staff WHERE id = ? AND school_id = ?', [id, schoolId]);
    
    await query('DELETE FROM staff WHERE id = ? AND school_id = ?', [id, schoolId]);
    if (staff && staff.user_id) {
      await query('DELETE FROM users WHERE id = ?', [staff.user_id]);
    }

    try {
      broadcastInvalidation(schoolId, ['staff', 'classes', 'users'], 'staff_deleted');
    } catch (_) {}

    return res.json({ data: { message: 'Staff member and account removed successfully.' } });
  } catch (err) {
    console.error('Delete staff error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete staff member.' } });
  }
});

// GET /schools/:schoolId/staff/:id/subjects — get subjects assigned to a staff member
router.get('/:id/subjects', authenticateToken, async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const subjects = await query(
      `SELECT s.id, s.name, s.code, s.level
       FROM staff_subjects ss
       JOIN subjects s ON ss.subject_id = s.id
       WHERE ss.staff_id = ? AND ss.school_id = ?
       ORDER BY s.name ASC`,
      [id, schoolId]
    );
    return res.json({ data: subjects });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch staff subjects.' } });
  }
});

// PUT /schools/:schoolId/staff/:id/subjects — replace all subject assignments for a staff member
router.put('/:id/subjects', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { subject_ids } = req.body;
    if (!Array.isArray(subject_ids)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'subject_ids must be an array.' } });
    }
    // Replace all assignments for this staff member
    await query('DELETE FROM staff_subjects WHERE staff_id = ? AND school_id = ?', [id, schoolId]);
    for (const subjectId of subject_ids) {
      await query(
        'INSERT IGNORE INTO staff_subjects (staff_id, school_id, subject_id) VALUES (?, ?, ?)',
        [id, schoolId, subjectId]
      );
    }
    const subjects = await query(
      `SELECT s.id, s.name, s.code, s.level
       FROM staff_subjects ss
       JOIN subjects s ON ss.subject_id = s.id
       WHERE ss.staff_id = ? AND ss.school_id = ?
       ORDER BY s.name ASC`,
      [id, schoolId]
    );
    return res.json({ data: subjects });
  } catch (err) {
    console.error('Update staff subjects error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update staff subject assignments.' } });
  }
});

module.exports = router;
