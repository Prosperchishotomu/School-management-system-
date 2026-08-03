const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Helper to notify all school admins when a teacher updates lesson plans
async function notifySchoolAdmins(schoolId, title, message) {
  const admins = await query("SELECT id FROM users WHERE school_id = ? AND role = 'school_admin'", [schoolId]);
  for (const admin of admins) {
    const notifId = 'NTF' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO notifications (id, school_id, user_id, title, message, is_read) VALUES (?, ?, ?, ?, ?, 0)`,
      [notifId, schoolId, admin.id, title, message]
    );
  }
}

// GET /schools/:schoolId/tasks
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const tasks = await query(
      `SELECT t.*, u.username as creator_name
       FROM tasks t
       LEFT JOIN users u ON t.teacher_id = u.id
       WHERE t.school_id = ?
       ORDER BY t.created_at DESC`,
      [schoolId]
    );
    return res.json({ data: tasks });
  } catch (err) {
    console.error('Get tasks error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch lesson tasks.' } });
  }
});

// POST /schools/:schoolId/tasks
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;

    // Allow teacher, school_admin, super_admin to manage tasks
    if (!['teacher', 'school_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'ACCESS_DENIED', message: 'You do not have permission to manage lesson tasks.' }
      });
    }

    const { title, description, due_date, class_id, subject_id } = req.body;
    if (!title) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Lesson task title is required.' } });
    }

    const taskId = 'TSK' + Math.random().toString(36).substr(2, 5).toUpperCase();
    await query(
      `INSERT INTO tasks (id, school_id, teacher_id, title, description, due_date, class_id, subject_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned')`,
      [taskId, schoolId, req.user.id, title.trim(), description || null, due_date || null, class_id || null, subject_id || null]
    );

    // Notify School Principal / Admin
    await notifySchoolAdmins(
      schoolId,
      'New Lesson Plan Submitted',
      `Teacher ${req.user.username} submitted a new lesson plan: "${title.trim()}".`
    );

    const created = await queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create task error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create lesson task.' } });
  }
});

// PUT/PATCH /schools/:schoolId/tasks/:id
const handleUpdateTask = async (req, res) => {
  try {
    const { schoolId, id } = req.params;

    if (!['teacher', 'school_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'ACCESS_DENIED', message: 'You do not have permission to update lesson tasks.' }
      });
    }

    const { title, description, status, due_date } = req.body;
    const updates = [];
    const params = [];

    if (title) { updates.push('title = ?'); params.push(title.trim()); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (due_date !== undefined) { updates.push('due_date = ?'); params.push(due_date); }

    if (updates.length > 0) {
      params.push(id, schoolId);
      await query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND school_id = ?`, params);

      // Notify Principal of modification
      await notifySchoolAdmins(
        schoolId,
        'Lesson Plan Modified',
        `User ${req.user.username} updated the lesson plan (ID: ${id}).`
      );
    }

    const updated = await queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
    return res.json({ data: updated });
  } catch (err) {
    console.error('Update task error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update lesson task.' } });
  }
};

router.put('/:id', authenticateToken, handleUpdateTask);
router.patch('/:id', authenticateToken, handleUpdateTask);

// DELETE /schools/:schoolId/tasks/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { schoolId, id } = req.params;

    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        error: { code: 'ACCESS_DENIED', message: 'Lesson plans are immutable by school administrators and can only be updated by the assigning teacher.' }
      });
    }

    await query('DELETE FROM tasks WHERE id = ? AND school_id = ?', [id, schoolId]);
    return res.json({ data: { message: 'Lesson plan task removed successfully.' } });
  } catch (err) {
    console.error('Delete task error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete lesson task.' } });
  }
});

module.exports = router;
