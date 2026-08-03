const express = require('express');
const router = express.Router({ mergeParams: true });
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

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
    const { name, email, phone, role_title, class_id, username, password } = req.body;

    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Full name is required.' } });
    }

    // Auto-generate username from name if not provided
    const baseUsername = (username?.trim()) ||
      (email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : null) ||
      name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').substring(0, 20);
    const finalUsername = baseUsername + (Math.random().toString(36).substr(2, 3));

    // Use provided password or generate a default one
    const finalPassword = password?.trim() || 'Password123!';

    // Enforce email uniqueness across all staff and schools
    if (email && email.trim()) {
      const existingStaffEmail = await queryOne('SELECT id FROM staff WHERE LOWER(email) = ?', [email.trim().toLowerCase()]);
      const existingUserEmail = await queryOne('SELECT id FROM users WHERE LOWER(email) = ?', [email.trim().toLowerCase()]);
      if (existingStaffEmail || existingUserEmail) {
        return res.status(400).json({ error: { code: 'DUPLICATE_EMAIL', message: `Email '${email}' is already registered by another staff member.` } });
      }
    }

    // Check existing username
    const existingUser = await queryOne('SELECT id FROM users WHERE username = ?', [finalUsername]);
    if (existingUser) {
      return res.status(400).json({ error: { code: 'DUPLICATE_USERNAME', message: 'Username already taken. Please provide a custom username.' } });
    }

    const userId = 'USR' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const staffId = 'STF' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const passHash = bcrypt.hashSync(finalPassword, 10);

    // Create user login account
    await query(
      `INSERT INTO users (id, school_id, username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, 'teacher', 'active')`,
      [userId, schoolId, finalUsername, email || null, passHash]
    );

    // Create staff record
    await query(
      `INSERT INTO staff (id, school_id, user_id, class_id, name, email, phone, role_title, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [staffId, schoolId, userId, class_id || null, name.trim(), email || null, phone || null, role_title || 'Teacher']
    );

    const created = await queryOne(
      `SELECT stf.*, c.name as assigned_class_name, u.username
       FROM staff stf
       LEFT JOIN classes c ON stf.class_id = c.id
       LEFT JOIN users u ON stf.user_id = u.id
       WHERE stf.id = ?`,
      [staffId]
    );

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
    const { name, email, phone, role_title, class_id, status } = req.body;

    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (role_title) { updates.push('role_title = ?'); params.push(role_title.trim()); }
    if (class_id !== undefined) { updates.push('class_id = ?'); params.push(class_id); }
    if (status) { updates.push('status = ?'); params.push(status); }

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

    return res.json({ data: { message: 'Staff member and account removed successfully.' } });
  } catch (err) {
    console.error('Delete staff error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete staff member.' } });
  }
});

module.exports = router;
