const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { broadcastInvalidation } = require('../services/realtime');

const ADMIN_OR_LIBRARIAN = ['school_admin', 'super_admin', 'librarian', 'head', 'head_teacher', 'deputy_head'];

// GET /schools/:schoolId/library/resources
router.get('/resources', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { search, category, resource_type, grade_level, subject } = req.query;

    let sql = `
      SELECT r.*,
             (SELECT COUNT(*) FROM library_download_requests WHERE resource_id = r.id AND status = 'pending') as pending_requests_count
      FROM library_resources r
      WHERE r.school_id = ? AND r.status = 'active'
    `;
    const params = [schoolId];

    if (category && category !== 'all') {
      sql += ' AND (r.category = ? OR r.resource_type = ?)';
      params.push(category, category);
    }
    if (resource_type && resource_type !== 'all') {
      sql += ' AND r.resource_type = ?';
      params.push(resource_type);
    }
    if (grade_level && grade_level !== 'all') {
      sql += ' AND r.grade_level = ?';
      params.push(grade_level);
    }
    if (subject && subject !== 'all') {
      sql += ' AND r.subject = ?';
      params.push(subject);
    }
    if (search) {
      sql += ' AND (r.title LIKE ? OR r.author LIKE ? OR r.description LIKE ? OR r.subject LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY r.created_at DESC';

    const resources = await query(sql, params);

    // Fetch active user's download requests to attach authorization status
    let userRequests = [];
    try {
      userRequests = await query(
        'SELECT id, resource_id, status, requested_at, actioned_at FROM library_download_requests WHERE school_id = ? AND user_id = ?',
        [schoolId, req.user.id]
      );
    } catch (_) {}

    const requestMap = new Map();
    userRequests.forEach(reqObj => {
      requestMap.set(reqObj.resource_id, reqObj);
    });

    const isStaffOrAdmin = ADMIN_OR_LIBRARIAN.includes(req.user.role) || req.user.role === 'teacher';

    const enriched = resources.map(r => {
      const userReq = requestMap.get(r.id);
      return {
        ...r,
        can_download: isStaffOrAdmin || (userReq && userReq.status === 'approved'),
        download_request: userReq || null
      };
    });

    return res.json({ data: enriched });
  } catch (err) {
    console.error('Fetch library resources error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch library resources.' } });
  }
});

// POST /schools/:schoolId/library/resources
router.post('/resources', authenticateToken, requireRoles(...ADMIN_OR_LIBRARIAN), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const {
      title, author, category, resource_type, file_url,
      file_name, file_type, file_size, description, grade_level, subject
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Resource title is mandatory.' } });
    }

    const resId = 'LIB' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const resolvedType = (file_type || (file_name && file_name.endsWith('.docx') ? 'docx' : 'pdf')).toLowerCase();
    const resolvedCategory = category || resource_type || 'textbook';

    await query(
      `INSERT INTO library_resources
        (id, school_id, title, author, category, resource_type, file_url, file_name, file_type, file_size, description, grade_level, subject, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        resId, schoolId, title, author || 'Faculty / MoPSE', resolvedCategory,
        resource_type || resolvedCategory, file_url || null,
        file_name || `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${resolvedType}`,
        resolvedType, file_size || '3.5 MB', description || null, grade_level || null, subject || null
      ]
    );

    broadcastInvalidation(schoolId, ['library', 'library_resources'], 'library_resource_added');

    const created = await queryOne('SELECT * FROM library_resources WHERE id = ?', [resId]);
    return res.status(201).json({ data: created, message: 'Digital library e-resource cataloged successfully.' });
  } catch (err) {
    console.error('Create library resource error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to add resource to library.' } });
  }
});

// POST /schools/:schoolId/library/resources/:id/request-download
router.post('/resources/:id/request-download', authenticateToken, async (req, res) => {
  try {
    const { schoolId, id: resourceId } = req.params;
    const { reason } = req.body;

    const resource = await queryOne('SELECT * FROM library_resources WHERE id = ? AND school_id = ?', [resourceId, schoolId]);
    if (!resource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Library resource not found.' } });
    }

    // Check existing request
    const existing = await queryOne(
      'SELECT id, status FROM library_download_requests WHERE school_id = ? AND resource_id = ? AND user_id = ?',
      [schoolId, resourceId, req.user.id]
    );

    if (existing) {
      if (existing.status === 'approved') {
        return res.json({ data: { message: 'Download already approved. You may download this file immediately.', status: 'approved' } });
      }
      if (existing.status === 'pending') {
        return res.json({ data: { message: 'Your download request is currently under librarian review.', status: 'pending' } });
      }
      // If rejected earlier, allow re-request
      await query(
        'UPDATE library_download_requests SET status = "pending", reason = ?, requested_at = NOW(), actioned_by = NULL, actioned_at = NULL WHERE id = ?',
        [reason || 'Study and revision purposes', existing.id]
      );
      return res.json({ data: { message: 'Download request re-submitted to librarian for review.', status: 'pending' } });
    }

    const reqId = 'LDR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const userName = req.user.name || req.user.username || 'Student';

    await query(
      `INSERT INTO library_download_requests
        (id, school_id, resource_id, user_id, user_name, user_role, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [reqId, schoolId, resourceId, req.user.id, userName, req.user.role || 'student', reason || 'Independent study and exam revision']
    );

    // Notify librarian and administrators
    const notifId = 'NOT' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    try {
      await query(
        `INSERT INTO notifications (id, school_id, user_id, title, message, is_read, target_role, sender_id, sender_name, type)
         VALUES (?, ?, NULL, ?, ?, 0, 'librarian', ?, ?, 'library_download_request')`,
        [
          notifId,
          schoolId,
          `Download Request: ${resource.title}`,
          `${userName} (${req.user.role || 'student'}) requested to download '${resource.title}'.`,
          req.user.id,
          userName
        ]
      );
    } catch (_) {}

    broadcastInvalidation(schoolId, ['library', 'library_requests'], 'library_request_submitted');

    return res.status(201).json({
      data: {
        message: 'Download request submitted successfully. The school librarian has been notified.',
        status: 'pending'
      }
    });
  } catch (err) {
    console.error('Request download error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to submit download request.' } });
  }
});

// GET /schools/:schoolId/library/download-requests
router.get('/download-requests', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { status } = req.query;
    const isStaff = ADMIN_OR_LIBRARIAN.includes(req.user.role);

    let sql = `
      SELECT ldr.*, r.title as resource_title, r.file_name, r.file_type, r.file_size,
             s.admission_number, c.name as class_name
      FROM library_download_requests ldr
      JOIN library_resources r ON ldr.resource_id = r.id
      LEFT JOIN students s ON ldr.user_id = s.user_id OR ldr.user_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE ldr.school_id = ?
    `;
    const params = [schoolId];

    if (!isStaff) {
      sql += ' AND ldr.user_id = ?';
      params.push(req.user.id);
    }

    if (status && status !== 'all') {
      sql += ' AND ldr.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY ldr.requested_at DESC';

    const requests = await query(sql, params);
    return res.json({ data: requests });
  } catch (err) {
    console.error('Fetch download requests error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch download requests.' } });
  }
});

// PATCH /schools/:schoolId/library/download-requests/:id
router.patch('/download-requests/:id', authenticateToken, requireRoles(...ADMIN_OR_LIBRARIAN), async (req, res) => {
  try {
    const { schoolId, id: requestId } = req.params;
    const { status, admin_notes } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Status must be approved, rejected, or pending.' } });
    }

    const reqRecord = await queryOne('SELECT * FROM library_download_requests WHERE id = ? AND school_id = ?', [requestId, schoolId]);
    if (!reqRecord) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Download request not found.' } });
    }

    await query(
      `UPDATE library_download_requests
       SET status = ?, actioned_by = ?, actioned_at = NOW(), admin_notes = ?
       WHERE id = ? AND school_id = ?`,
      [status, req.user.id, admin_notes || null, requestId, schoolId]
    );

    // Notify student/user
    const notifId = 'NOT' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    try {
      const resObj = await queryOne('SELECT title FROM library_resources WHERE id = ?', [reqRecord.resource_id]);
      await query(
        `INSERT INTO notifications (id, school_id, user_id, title, message, is_read, target_role, sender_id, sender_name, type)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'School Librarian', 'download_request_updated')`,
        [
          notifId,
          schoolId,
          reqRecord.user_id,
          `Download Request ${status === 'approved' ? 'Approved' : 'Declined'}: ${resObj?.title || 'Resource'}`,
          status === 'approved'
            ? `Your download request for '${resObj?.title || 'the file'}' was approved. You can now download and save the file.`
            : `Your download request for '${resObj?.title || 'the file'}' was declined. Note: ${admin_notes || 'Read online directly in the portal.'}`,
          reqRecord.user_role || 'student',
          req.user.id
        ]
      );
    } catch (_) {}

    broadcastInvalidation(schoolId, ['library', 'library_requests', 'library_resources'], 'download_request_actioned');

    return res.json({
      data: {
        message: `Download request ${status}.`,
        request: await queryOne('SELECT * FROM library_download_requests WHERE id = ?', [requestId])
      }
    });
  } catch (err) {
    console.error('Action download request error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update download request.' } });
  }
});

// GET /schools/:schoolId/library/resources/:id/download
router.get('/resources/:id/download', authenticateToken, async (req, res) => {
  try {
    const { schoolId, id: resourceId } = req.params;

    const resource = await queryOne('SELECT * FROM library_resources WHERE id = ? AND school_id = ?', [resourceId, schoolId]);
    if (!resource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Library resource not found.' } });
    }

    const isStaff = ADMIN_OR_LIBRARIAN.includes(req.user.role) || req.user.role === 'teacher';
    if (!isStaff) {
      const approval = await queryOne(
        'SELECT id FROM library_download_requests WHERE school_id = ? AND resource_id = ? AND user_id = ? AND status = "approved"',
        [schoolId, resourceId, req.user.id]
      );
      if (!approval) {
        return res.status(403).json({
          error: {
            code: 'DOWNLOAD_APPROVAL_REQUIRED',
            message: 'E-Library files cannot be downloaded directly. Please click "Request Download" to request approval from the school librarian.'
          }
        });
      }
    }

    // Serve file or redirect to file_url
    if (resource.file_url) {
      return res.redirect(resource.file_url);
    }

    return res.json({
      data: {
        message: 'Download authorized.',
        file_name: resource.file_name,
        file_type: resource.file_type,
        download_url: resource.file_url || null
      }
    });
  } catch (err) {
    console.error('Download resource error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to process download.' } });
  }
});

// DELETE /schools/:schoolId/library/resources/:id
router.delete('/resources/:id', authenticateToken, requireRoles(...ADMIN_OR_LIBRARIAN), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    await query('UPDATE library_resources SET status = "archived" WHERE id = ? AND school_id = ?', [id, schoolId]);
    broadcastInvalidation(schoolId, ['library', 'library_resources'], 'library_resource_deleted');
    return res.json({ data: { message: 'Library resource archived.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete resource.' } });
  }
});

module.exports = router;
