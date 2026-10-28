const express = require('express');
const router = express.Router({ mergeParams: true });
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { parseTableData } = require('../utils/importParser');
const { broadcastInvalidation } = require('../services/realtime');
const {
  normalizeName,
  normalizeEmail,
  normalizePhone,
  normalizeCode,
  normalizeText
} = require('../utils/normalizer');

const { validateClassForSchool } = require('../utils/classValidator');

// ─────────────────────────────────────────────────────────────────────────────
// 1. PREVIEW IMPORT DATA
// ─────────────────────────────────────────────────────────────────────────────
router.post('/preview', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { text, entity } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No file data or text provided for preview.' } });
    }

    const parsed = parseTableData(text);
    return res.json({
      data: {
        raw_headers: parsed.rawHeaders,
        headers: parsed.headers,
        total_rows: parsed.rawCount,
        preview_rows: parsed.rows.slice(0, 10),
        entity: entity || 'detected'
      }
    });
  } catch (err) {
    console.error('Import preview error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to parse import preview.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. BULK IMPORT STUDENTS
// ─────────────────────────────────────────────────────────────────────────────
router.post('/students', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    let { rows, text } = req.body;

    if (!rows && text) {
      const parsed = parseTableData(text);
      rows = parsed.rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No student rows provided for import.' } });
    }

    // Fetch school settings to enforce institutional level & stream policies
    const school = await queryOne('SELECT id, name, school_type, has_alevel, has_streams FROM schools WHERE id = ?', [schoolId]);

    // Cache existing classes for quick lookup
    const existingClasses = await query('SELECT id, name, level FROM classes WHERE school_id = ?', [schoolId]);
    const classMap = new Map();
    existingClasses.forEach(c => {
      classMap.set(c.name.trim().toLowerCase(), c.id);
      classMap.set(c.id.toLowerCase(), c.id);
    });

    // Cache existing guardians for deduplication (by phone and email)
    const existingGuardians = await query('SELECT id, user_id, phone, email, name FROM guardians WHERE school_id = ?', [schoolId]);
    const guardianPhoneMap = new Map();
    const guardianEmailMap = new Map();
    existingGuardians.forEach(g => {
      if (g.phone) guardianPhoneMap.set(g.phone.trim().replace(/[\s\-\(\)]/g, ''), g);
      if (g.email) guardianEmailMap.set(g.email.trim().toLowerCase(), g);
    });

    let imported = 0;
    let skipped = 0;
    const errors = [];
    const parentCredentials = [];
    const year = new Date().getFullYear();

    // Helper: Normalize date format to YYYY-MM-DD
    const normalizeDate = (raw) => {
      if (!raw) return '2012-01-01';
      if (raw instanceof Date && !isNaN(raw.getTime())) {
        return raw.toISOString().slice(0, 10);
      }
      if (typeof raw === 'number') {
        const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      }
      const s = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
      if (m) {
        const day = m[1].padStart(2, '0');
        const month = m[2].padStart(2, '0');
        const year = m[3];
        return `${year}-${month}-${day}`;
      }
      const parsedD = new Date(s);
      if (!isNaN(parsedD.getTime())) return parsedD.toISOString().slice(0, 10);
      return '2012-01-01';
    };

    // Helper: Normalize gender
    const normalizeGender = (raw) => {
      if (!raw) return 'other';
      const g = String(raw).trim().toLowerCase();
      if (g.startsWith('m') || g === 'boy') return 'male';
      if (g.startsWith('f') || g === 'girl') return 'female';
      return 'other';
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      // Extract and validate student names
      let firstName = (r.first_name || '').trim();
      let lastName = (r.last_name || '').trim();
      if (!firstName && r.name) {
        const parts = r.name.trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || (parts[0] ? 'Student' : '');
      }

      firstName = normalizeName(firstName);
      lastName = normalizeName(lastName);

      if (!firstName || !lastName) {
        errors.push({ row: rowNum, error: 'First name and Last name are mandatory.' });
        skipped++;
        continue;
      }

      // Resolve Class stream with institutional validation
      let classId = null;
      const rawClass = normalizeText(r.class_name || r.class || r.grade || r.form || '');
      if (!rawClass) {
        errors.push({ row: rowNum, error: 'Class stream is required for student enrollment.' });
        skipped++;
        continue;
      }

      const classValidation = validateClassForSchool(rawClass, school);
      if (!classValidation.valid) {
        errors.push({ row: rowNum, error: classValidation.error });
        skipped++;
        continue;
      }

      classId = classMap.get(classValidation.cleanName.toLowerCase()) || null;
      if (!classId) {
        // Auto-create validated class matching school type & stream settings
        try {
          const newClassId = 'CLS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
          const levelVal = classValidation.isSecondary ? 'Secondary' : 'Primary';
          await query(
            'INSERT INTO classes (id, school_id, name, level, grade_level, stream, capacity, status) VALUES (?, ?, ?, ?, ?, ?, 45, "active")',
            [newClassId, schoolId, classValidation.cleanName, levelVal, classValidation.gradeLevel, classValidation.stream]
          );
          classId = newClassId;
          classMap.set(classValidation.cleanName.toLowerCase(), classId);
        } catch (_) {
          classId = existingClasses[0]?.id || null;
        }
      }

      // Resolve Admission Number
      let admNo = normalizeCode(r.admission_number || r.admission_no || r.adm_no || '');
      if (!admNo) {
        admNo = `${schoolId}-${year}-${String(i + 1).padStart(4, '0')}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
      }

      // Check collision
      const existingAdm = await queryOne('SELECT id FROM students WHERE school_id = ? AND admission_number = ?', [schoolId, admNo]);
      if (existingAdm) {
        admNo = `${admNo}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
      }

      const studentId = 'STD' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      const gender = normalizeGender(r.gender);
      const dob = normalizeDate(r.date_of_birth || r.dob);

      try {
        await query(
          `INSERT INTO students (id, school_id, class_id, first_name, last_name, admission_number, gender, date_of_birth, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'enrolled')`,
          [studentId, schoolId, classId, firstName, lastName, admNo, gender, dob]
        );

        // Guardian linkage & Parent User Account Provisioning
        const guardianName = normalizeName(r.guardian_name || r.parent_name || '');
        const rawPhone = String(r.guardian_phone || r.parent_phone || r.phone || '');
        const guardianPhone = normalizePhone(rawPhone) || null;
        const guardianEmail = normalizeEmail(r.guardian_email || r.parent_email || r.email || '') || null;

        if (guardianName || guardianPhone || guardianEmail) {
          try {
            // Sibling deduplication: Check if guardian already registered in this school
            let existingG = null;
            if (cleanPhone && guardianPhoneMap.has(cleanPhone)) {
              existingG = guardianPhoneMap.get(cleanPhone);
            } else if (guardianEmail && guardianEmailMap.has(guardianEmail)) {
              existingG = guardianEmailMap.get(guardianEmail);
            }

            let guardianId = existingG ? existingG.id : null;
            let parentUserId = existingG ? existingG.user_id : null;

            if (!guardianId) {
              // Create new guardian record
              guardianId = 'GRD' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
              await query(
                `INSERT INTO guardians (id, school_id, name, phone, email, relationship) VALUES (?, ?, ?, ?, ?, 'parent')`,
                [guardianId, schoolId, guardianName || `${lastName} Guardian`, guardianPhone, guardianEmail]
              );

              // Update cache maps
              const gObj = { id: guardianId, user_id: null, phone: guardianPhone, email: guardianEmail, name: guardianName };
              if (cleanPhone) guardianPhoneMap.set(cleanPhone, gObj);
              if (guardianEmail) guardianEmailMap.set(guardianEmail, gObj);
            }

            // Provision Parent Login Account if email or phone is present and no account exists
            if (!parentUserId && (guardianEmail || guardianPhone)) {
              try {
                const baseUser = (guardianEmail ? guardianEmail.split('@')[0] : (guardianName || `${lastName}.parent`).toLowerCase().replace(/[^a-z0-9]/g, '.'))
                  .substring(0, 15)
                  .replace(/\.+/g, '.');
                const username = `${baseUser}.${Math.random().toString(36).substr(2, 3)}`;
                const rawPassword = 'Pr' + Math.floor(100000 + Math.random() * 900000) + '!';
                const passHash = bcrypt.hashSync(rawPassword, 10);
                parentUserId = 'USR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

                await query(
                  `INSERT INTO users (id, school_id, username, email, password_hash, role, phone, status)
                   VALUES (?, ?, ?, ?, ?, 'parent', ?, 'active')`,
                  [parentUserId, schoolId, username, guardianEmail, passHash, guardianPhone]
                );

                await query('UPDATE guardians SET user_id = ? WHERE id = ?', [parentUserId, guardianId]);

                parentCredentials.push({
                  name: guardianName || `${lastName} Guardian`,
                  student: `${firstName} ${lastName}`,
                  username,
                  password: rawPassword,
                  role: 'Parent / Guardian',
                  email: guardianEmail || 'N/A',
                  phone: guardianPhone || 'N/A'
                });
              } catch (uErr) {
                console.warn('Parent user provision warning:', uErr.message);
              }
            }

            // Link student to guardian
            await query(
              `INSERT INTO student_guardians (student_id, guardian_id, is_primary) VALUES (?, ?, 1)
               ON DUPLICATE KEY UPDATE is_primary = 1`,
              [studentId, guardianId]
            );
          } catch (gErr) {
            console.warn('Import guardian link warning:', gErr.message);
          }
        }

        imported++;
      } catch (insertErr) {
        console.error('Import student row error:', insertErr);
        errors.push({ row: rowNum, error: insertErr.message });
        skipped++;
      }
    }

    try {
      broadcastInvalidation(schoolId, ['students', 'classes', 'guardians', 'summary'], 'students_imported');
    } catch (_) {}

    return res.json({
      data: {
        total_processed: rows.length,
        imported,
        skipped,
        credentials: parentCredentials,
        errors
      }
    });
  } catch (err) {
    console.error('Import students error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to import students.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. BULK IMPORT TEACHERS / STAFF
// ─────────────────────────────────────────────────────────────────────────────
router.post('/staff', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    let { rows, text } = req.body;

    if (!rows && text) {
      const parsed = parseTableData(text);
      rows = parsed.rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No staff rows provided for import.' } });
    }

    const existingClasses = await query('SELECT id, name FROM classes WHERE school_id = ?', [schoolId]);
    const classMap = new Map();
    existingClasses.forEach(c => {
      classMap.set(c.name.trim().toLowerCase(), c.id);
      classMap.set(c.id.toLowerCase(), c.id);
    });

    const existingSubjects = await query('SELECT id, name, code FROM subjects WHERE school_id = ? OR school_id IS NULL', [schoolId]);
    const subjectMap = new Map();
    existingSubjects.forEach(s => {
      subjectMap.set(s.name.trim().toLowerCase(), s.id);
      if (s.code) subjectMap.set(s.code.trim().toLowerCase(), s.id);
    });

    let imported = 0;
    let skipped = 0;
    const errors = [];
    const credentials = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      const name = normalizeName(String(r.name || `${r.first_name || ''} ${r.last_name || ''}`));
      if (!name) {
        errors.push({ row: rowNum, error: 'Teacher name is required.' });
        skipped++;
        continue;
      }

      const email = normalizeEmail(r.email) || null;
      const phone = normalizePhone(r.phone) || null;
      const roleTitle = normalizeText(r.role_title || r.title || r.designation || 'Teacher');

      // Check for duplicate staff member in this school
      const dupStaff = await queryOne('SELECT id FROM staff WHERE school_id = ? AND (LOWER(name) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?)))', [schoolId, name, email || '']);
      if (dupStaff) {
        errors.push({ row: rowNum, error: `Staff member '${name}' is already registered in this school roster.` });
        skipped++;
        continue;
      }

      // Resolve Assigned Class (e.g. Primary Class Teacher or Secondary Form Master)
      let classId = null;
      const rawClass = normalizeText(r.class_name || r.class || r.assigned_class || r.grade || r.form || '');
      if (rawClass) {
        const classValidation = validateClassForSchool(rawClass, school);
        if (!classValidation.valid) {
          errors.push({ row: rowNum, error: `Assigned class warning: ${classValidation.error}` });
        } else {
          classId = classMap.get(classValidation.cleanName.toLowerCase()) || null;
          if (!classId) {
            try {
              const newClassId = 'CLS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
              const levelVal = classValidation.isSecondary ? 'Secondary' : 'Primary';
              await query(
                'INSERT INTO classes (id, school_id, name, level, grade_level, stream, capacity, status) VALUES (?, ?, ?, ?, ?, ?, 45, "active")',
                [newClassId, schoolId, classValidation.cleanName, levelVal, classValidation.gradeLevel, classValidation.stream]
              );
              classId = newClassId;
              classMap.set(classValidation.cleanName.toLowerCase(), classId);
            } catch (_) {
              classId = existingClasses[0]?.id || null;
            }
          }
        }
      }

      // Generate credentials
      const baseUser = (email ? email.split('@')[0] : name.toLowerCase().replace(/[^a-z0-9]/g, '.'))
        .substring(0, 15)
        .replace(/\.+/g, '.');
      const username = `${baseUser}.${Math.random().toString(36).substr(2, 3)}`;
      const rawPassword = 'Sb' + Math.floor(100000 + Math.random() * 900000) + '!';
      const passHash = bcrypt.hashSync(rawPassword, 10);

      const userId = 'USR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      const staffId = 'STF' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

      try {
        // 1. Create user account
        await query(
          `INSERT INTO users (id, school_id, username, email, password_hash, role, phone, status)
           VALUES (?, ?, ?, ?, ?, 'teacher', ?, 'active')`,
          [userId, schoolId, username, email, passHash, phone]
        );

        const qualification = (r.qualification || r.qualifications || r.degree || '').trim() || null;
        const rawExp = String(r.experience_years || r.experience || r.years_experience || '').replace(/[^0-9]/g, '');
        const experienceYears = rawExp ? parseInt(rawExp, 10) : null;
        const ecNumber = (r.ec_number || r.ec_no || r.staff_number || r.staff_no || '').trim() || null;
        const employmentType = (r.employment_type || r.type || 'permanent').trim();

        // 2. Create staff record with qualification and experience
        await query(
          `INSERT INTO staff (id, school_id, user_id, class_id, name, email, phone, role_title, qualification, experience_years, ec_number, employment_type, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [staffId, schoolId, userId, classId, name, email, phone, roleTitle, qualification, experienceYears, ecNumber, employmentType]
        );

        // 3. If primary class teacher or form master assigned, link to class
        if (classId) {
          try {
            await query('UPDATE classes SET form_master_id = ? WHERE id = ? AND school_id = ?', [userId, classId, schoolId]);
          } catch (_) {}
        }

        // 4. Secondary subject teaching assignments
        const rawSubjects = (r.subjects || r.subjects_taught || r.teaching_subjects || '').trim();
        if (rawSubjects) {
          const subjectTokens = rawSubjects.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
          for (const token of subjectTokens) {
            let matchedSubjectId = subjectMap.get(token.toLowerCase());
            if (!matchedSubjectId) {
              // Auto-create subject if not found so the link succeeds
              try {
                const newSubId = 'SUB' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
                const code = token.replace(/[^A-Za-z0-9]/g, '').substring(0, 5).toUpperCase() || 'SUB';
                await query(
                  'INSERT INTO subjects (id, school_id, code, name, category, is_active) VALUES (?, ?, ?, ?, "general_studies", 1) ON DUPLICATE KEY UPDATE name = VALUES(name)',
                  [newSubId, schoolId, `${code}_${Math.random().toString(36).substr(2, 3).toUpperCase()}`, token]
                );
                matchedSubjectId = newSubId;
                subjectMap.set(token.toLowerCase(), newSubId);
              } catch (_) {}
            }

            if (matchedSubjectId && classId) {
              try {
                const taId = 'TA' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
                await query(
                  `INSERT INTO teaching_assignments (id, school_id, teacher_id, class_id, subject_id)
                   VALUES (?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id)`,
                  [taId, schoolId, userId, classId, matchedSubjectId]
                );
              } catch (_) {}
            }
          }
        }

        credentials.push({ name, username, password: rawPassword, role: roleTitle, class: rawClass || 'None' });
        imported++;
      } catch (insertErr) {
        console.error('Import staff row error:', insertErr);
        errors.push({ row: rowNum, error: insertErr.message });
        skipped++;
      }
    }

    try {
      broadcastInvalidation(schoolId, ['staff', 'classes', 'users', 'summary'], 'staff_imported');
    } catch (_) {}

    return res.json({
      data: {
        total_processed: rows.length,
        imported,
        skipped,
        credentials,
        errors
      }
    });
  } catch (err) {
    console.error('Import staff error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to import staff.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. BULK IMPORT SUBJECTS
// ─────────────────────────────────────────────────────────────────────────────
router.post('/subjects', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    let { rows, text } = req.body;

    if (!rows && text) {
      const parsed = parseTableData(text);
      rows = parsed.rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No subject rows provided for import.' } });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      const name = (r.name || r.subject || r.subject_name || '').trim();
      let code = (r.code || r.subject_code || '').trim().toUpperCase();

      if (!name) {
        errors.push({ row: rowNum, error: 'Subject name is required.' });
        skipped++;
        continue;
      }

      if (!code) {
        code = name.substring(0, 4).toUpperCase();
      }

      const category = (r.category || r.department || 'General').trim();
      const level = (r.level || r.phase || 'All').trim();
      const subjectId = 'SUB' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

      try {
        await query(
          `INSERT INTO subjects (id, school_id, code, name, category, level, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category)`,
          [subjectId, schoolId, code, name, category, level]
        );
        imported++;
      } catch (insertErr) {
        console.error('Import subject row error:', insertErr);
        errors.push({ row: rowNum, error: insertErr.message });
        skipped++;
      }
    }

    try {
      broadcastInvalidation(schoolId, ['subjects'], 'subjects_imported');
    } catch (_) {}

    return res.json({
      data: {
        total_processed: rows.length,
        imported,
        skipped,
        errors
      }
    });
  } catch (err) {
    console.error('Import subjects error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to import subjects.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. BULK IMPORT ASSETS & INVENTORY
// ─────────────────────────────────────────────────────────────────────────────
router.post('/assets', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    let { rows, text } = req.body;

    if (!rows && text) {
      const parsed = parseTableData(text);
      rows = parsed.rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No asset rows provided for import.' } });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      const name = (r.name || r.item_name || r.asset_name || '').trim();
      if (!name) {
        errors.push({ row: rowNum, error: 'Asset/Equipment name is required.' });
        skipped++;
        continue;
      }

      let code = (r.code || r.asset_tag || r.tag || '').trim().toUpperCase();
      if (!code) {
        code = 'AST' + Math.random().toString(36).substr(2, 6).toUpperCase();
      }

      const category = (r.category || r.category_id || 'general').trim();
      const serialNumber = (r.serial_number || r.serial || '').trim() || null;
      const val = parseFloat(r.value || r.purchase_cost || r.cost || 0) || 0;
      const description = (r.description || r.notes || r.location ? `Location: ${r.location || 'Campus'}` : '').trim() || null;
      const assetId = 'AST' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

      try {
        await query(
          `INSERT INTO assets (id, school_id, name, category, code, serial_number, value, description, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available')
           ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), value=VALUES(value)`,
          [assetId, schoolId, name, category, code, serialNumber, val, description]
        );
        imported++;
      } catch (insertErr) {
        console.error('Import asset row error:', insertErr);
        errors.push({ row: rowNum, error: insertErr.message });
        skipped++;
      }
    }

    try {
      broadcastInvalidation(schoolId, ['assets', 'inventory'], 'assets_imported');
    } catch (_) {}

    return res.json({
      data: {
        total_processed: rows.length,
        imported,
        skipped,
        errors
      }
    });
  } catch (err) {
    console.error('Import assets error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to import assets.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. BULK IMPORT LIBRARY BOOKS
// ─────────────────────────────────────────────────────────────────────────────
router.post('/library', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    let { rows, text } = req.body;

    if (!rows && text) {
      const parsed = parseTableData(text);
      rows = parsed.rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No library book rows provided for import.' } });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      const title = (r.name || r.title || r.book_title || '').trim();
      if (!title) {
        errors.push({ row: rowNum, error: 'Book title is required.' });
        skipped++;
        continue;
      }

      let code = (r.code || r.isbn || r.accession_no || '').trim().toUpperCase();
      if (!code) {
        code = 'BK' + Math.random().toString(36).substr(2, 6).toUpperCase();
      }

      const author = (r.author || r.writer || '').trim();
      const shelf = (r.shelf_location || r.shelf || 'Main Library').trim();
      const resourceType = (r.resource_type || r.type || 'textbook').trim();
      const description = `Author: ${author || 'Unknown'} | Shelf: ${shelf} | Type: ${resourceType}`;
      const assetId = 'LIB' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

      try {
        await query(
          `INSERT INTO assets (id, school_id, name, category, code, serial_number, value, description, status)
           VALUES (?, ?, ?, 'book', ?, ?, 0, ?, 'available')
           ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)`,
          [assetId, schoolId, title, code, author || null, description]
        );
        imported++;
      } catch (insertErr) {
        console.error('Import library book row error:', insertErr);
        errors.push({ row: rowNum, error: insertErr.message });
        skipped++;
      }
    }

    try {
      broadcastInvalidation(schoolId, ['library', 'assets'], 'library_imported');
    } catch (_) {}

    return res.json({
      data: {
        total_processed: rows.length,
        imported,
        skipped,
        errors
      }
    });
  } catch (err) {
    console.error('Import library error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to import library books.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. BULK IMPORT CLASSES
// ─────────────────────────────────────────────────────────────────────────────
router.post('/classes', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    let { rows, text } = req.body;

    if (!rows && text) {
      const parsed = parseTableData(text);
      rows = parsed.rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No class rows provided for import.' } });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    const school = await queryOne('SELECT id, name, school_type, has_alevel, has_streams FROM schools WHERE id = ?', [schoolId]);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      const name = (r.name || r.class_name || r.class || '').trim();
      if (!name) {
        errors.push({ row: rowNum, error: 'Class name is required.' });
        skipped++;
        continue;
      }

      const classValidation = validateClassForSchool(name, school);
      if (!classValidation.valid) {
        errors.push({ row: rowNum, error: classValidation.error });
        skipped++;
        continue;
      }

      const level = (r.level || (classValidation.isSecondary ? 'Secondary' : 'Primary')).trim();
      const gradeLevel = (r.grade_level || r.grade || r.form || classValidation.gradeLevel).trim();
      const stream = (r.stream || classValidation.stream || null);
      const capacity = (r.capacity !== undefined && r.capacity !== '' && !isNaN(parseInt(r.capacity, 10))) ? parseInt(r.capacity, 10) : 45;
      const classId = 'CLS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

      try {
        await query(
          `INSERT INTO classes (id, school_id, name, level, grade_level, stream, capacity, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE level = VALUES(level), grade_level = VALUES(grade_level), stream = VALUES(stream), capacity = VALUES(capacity)`,
          [classId, schoolId, classValidation.cleanName, level, gradeLevel, stream, capacity]
        );
        imported++;
      } catch (insertErr) {
        console.error('Import class row error:', insertErr);
        errors.push({ row: rowNum, error: insertErr.message });
        skipped++;
      }
    }

    try {
      broadcastInvalidation(schoolId, ['classes', 'summary'], 'classes_imported');
    } catch (_) {}

    return res.json({
      data: {
        total_processed: rows.length,
        imported,
        skipped,
        errors
      }
    });
  } catch (err) {
    console.error('Import classes error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to import classes.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. BULK IMPORT FEES / BILLINGS
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fees', authenticateToken, requireRoles('school_admin', 'super_admin', 'bursar'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    let { rows, text } = req.body;

    if (!rows && text) {
      const parsed = parseTableData(text);
      rows = parsed.rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fee rows provided for import.' } });
    }

    // Helper: Normalize date format to YYYY-MM-DD
    const normalizeDate = (raw) => {
      if (!raw) return '2026-02-15';
      if (raw instanceof Date && !isNaN(raw.getTime())) {
        return raw.toISOString().slice(0, 10);
      }
      if (typeof raw === 'number') {
        const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      }
      const s = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
      if (m) {
        const day = m[1].padStart(2, '0');
        const month = m[2].padStart(2, '0');
        const year = m[3];
        return `${year}-${month}-${day}`;
      }
      const parsedD = new Date(s);
      if (!isNaN(parsedD.getTime())) return parsedD.toISOString().slice(0, 10);
      return '2026-02-15';
    };

    // Cache students for lookup by admission number or ID
    const studentRows = await query('SELECT id, admission_number FROM students WHERE school_id = ?', [schoolId]);
    const studentMap = new Map();
    studentRows.forEach(s => {
      if (s.admission_number) studentMap.set(s.admission_number.trim().toLowerCase(), s.id);
      studentMap.set(s.id.toLowerCase(), s.id);
    });

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      const admNo = (r.admission_number || r.admission_no || r.adm_no || r.student_id || '').trim();
      if (!admNo) {
        errors.push({ row: rowNum, error: 'Admission number or Student ID is required.' });
        skipped++;
        continue;
      }

      const studentId = studentMap.get(admNo.toLowerCase());
      if (!studentId) {
        errors.push({ row: rowNum, error: `Student with admission number "${admNo}" not found.` });
        skipped++;
        continue;
      }

      const term = (r.term || 'Term 1 2026').trim();
      const title = (r.title || r.fee_type || 'Term Tuition & Levies').trim();
      const amountDue = parseFloat(r.amount_due || r.amount || 0) || 0;
      const amountPaid = parseFloat(r.amount_paid || 0) || 0;
      const dueDate = normalizeDate(r.due_date);

      if (amountDue <= 0) {
        errors.push({ row: rowNum, error: 'Amount due must be greater than 0.' });
        skipped++;
        continue;
      }

      const status = amountPaid >= amountDue ? 'cleared' : (amountPaid > 0 ? 'partial' : 'unpaid');

      try {
        let existingFee = await queryOne(
          'SELECT id, amount_paid FROM fees WHERE school_id = ? AND student_id = ? AND term = ?',
          [schoolId, studentId, term]
        );
        let feeId = existingFee ? existingFee.id : ('FEE' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4));

        if (existingFee) {
          await query(
            `UPDATE fees SET amount_due = ?, amount_paid = GREATEST(amount_paid, ?), title = ?, due_date = ?, status = ? WHERE id = ?`,
            [amountDue, amountPaid, title, dueDate, status, feeId]
          );
        } else {
          await query(
            `INSERT INTO fees (id, school_id, student_id, term, title, fee_type, amount_due, amount_paid, status, due_date)
             VALUES (?, ?, ?, ?, ?, 'tuition', ?, ?, ?, ?)`,
            [feeId, schoolId, studentId, term, title, amountDue, amountPaid, status, dueDate]
          );
        }

        // If an initial payment amount is recorded, insert a matching receipt in fee_payments if not already present
        if (amountPaid > 0) {
          const existingPay = await queryOne('SELECT id FROM fee_payments WHERE fee_id = ?', [feeId]);
          if (!existingPay) {
            const payId = 'PMT' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
            const ref = 'REC-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            const idemp = 'IDEMP-' + payId;
            await query(
              `INSERT INTO fee_payments (id, school_id, student_id, fee_id, amount, amount_paid, payment_date, reference, payment_method, payment_currency, idempotency_key, created_by)
               VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, 'cash', 'USD', ?, ?)`,
              [payId, schoolId, studentId, feeId, amountPaid, amountPaid, ref, idemp, req.user?.id || 'SYSTEM']
            );
          }
        }

        imported++;
      } catch (insertErr) {
        console.error('Import fee row error:', insertErr);
        errors.push({ row: rowNum, error: insertErr.message });
        skipped++;
      }
    }

    try {
      broadcastInvalidation(schoolId, ['fees', 'summary', 'finance'], 'fees_imported');
    } catch (_) {}

    return res.json({
      data: {
        total_processed: rows.length,
        imported,
        skipped,
        errors
      }
    });
  } catch (err) {
    console.error('Import fees error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to import fees.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. DOWNLOAD SAMPLE CSV TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/templates/:entity', authenticateToken, async (req, res) => {
  const { schoolId, entity } = req.params;
  const school = await queryOne('SELECT id, name, school_type, has_alevel, has_streams FROM schools WHERE id = ?', [schoolId]);
  const schoolType = (school?.school_type || 'secondary').toLowerCase();
  const hasAlevel = Boolean(school?.has_alevel || schoolType === 'high_school' || schoolType === 'a_level');
  const hasStreams = school?.has_streams !== 0 && school?.has_streams !== false;

  let headers = '';
  let sampleRows = '';

  if (entity === 'students') {
    headers = 'admission_number,first_name,last_name,gender,date_of_birth,class_name,guardian_name,guardian_phone,guardian_email\n';
    if (schoolType === 'primary') {
      sampleRows = hasStreams
        ? 'ADM2026-001,Tendai,Mutasa,male,2017-05-12,Grade 1 East,Mr. C. Mutasa,+263771234567,cmutasa@gmail.com\n' +
          'ADM2026-002,Ruvimbo,Chirandu,female,2015-08-24,Grade 3 Blue,Mrs. S. Chirandu,+263772345678,chirandu@yahoo.com\n' +
          'ADM2026-003,Farai,Moyo,male,2012-02-15,Grade 7 Gold,Dr. P. Moyo,+263773456789,pmoyo@health.gov.zw\n'
        : 'ADM2026-001,Tendai,Mutasa,male,2017-05-12,Grade 1,Mr. C. Mutasa,+263771234567,cmutasa@gmail.com\n' +
          'ADM2026-002,Ruvimbo,Chirandu,female,2015-08-24,Grade 3,Mrs. S. Chirandu,+263772345678,chirandu@yahoo.com\n' +
          'ADM2026-003,Farai,Moyo,male,2012-02-15,Grade 7,Dr. P. Moyo,+263773456789,pmoyo@health.gov.zw\n';
    } else if (schoolType === 'combined' || schoolType === 'mixed') {
      sampleRows = hasStreams
        ? 'ADM2026-001,Tendai,Mutasa,male,2015-05-12,Grade 3 Blue,Mr. C. Mutasa,+263771234567,cmutasa@gmail.com\n' +
          'ADM2026-002,Kudakwashe,Ncube,male,2012-03-14,Form 1A,Mr. T. Ncube,+263772345678,kncube@gmail.com\n' +
          'ADM2026-003,Tafadzwa,Ndlovu,male,2010-11-05,Form 3 Commercials,Dr. S. Ndlovu,+263773456789,sndlovu@zim.gov.zw\n'
        : 'ADM2026-001,Tendai,Mutasa,male,2015-05-12,Grade 3,Mr. C. Mutasa,+263771234567,cmutasa@gmail.com\n' +
          'ADM2026-002,Kudakwashe,Ncube,male,2012-03-14,Form 1,Mr. T. Ncube,+263772345678,kncube@gmail.com\n' +
          'ADM2026-003,Tafadzwa,Ndlovu,male,2010-11-05,Form 3,Dr. S. Ndlovu,+263773456789,sndlovu@zim.gov.zw\n';
    } else {
      sampleRows = hasStreams
        ? 'ADM2026-001,Kudakwashe,Ncube,male,2012-03-14,Form 1A,Mr. T. Ncube,+263771234567,kncube@gmail.com\n' +
          'ADM2026-002,Chiedza,Musarurwa,female,2011-07-22,Form 2 East,Mrs. E. Musarurwa,+263772345678,emusarurwa@yahoo.com\n' +
          'ADM2026-003,Tafadzwa,Ndlovu,male,2010-11-05,Form 3 Commercials,Dr. S. Ndlovu,+263773456789,sndlovu@zim.gov.zw\n' +
          (hasAlevel ? 'ADM2026-004,Nyasha,Moyo,female,2008-04-18,Lower 6 Sciences,Mr. P. Moyo,+263774567890,pmoyo@health.gov.zw\n' : '')
        : 'ADM2026-001,Kudakwashe,Ncube,male,2012-03-14,Form 1,Mr. T. Ncube,+263771234567,kncube@gmail.com\n' +
          'ADM2026-002,Chiedza,Musarurwa,female,2011-07-22,Form 2,Mrs. E. Musarurwa,+263772345678,emusarurwa@yahoo.com\n' +
          'ADM2026-003,Tafadzwa,Ndlovu,male,2010-11-05,Form 3,Dr. S. Ndlovu,+263773456789,sndlovu@zim.gov.zw\n' +
          'ADM2026-004,Tatenda,Moyo,female,2009-09-12,Form 4,Mr. P. Moyo,+263774567890,pmoyo@health.gov.zw\n';
    }
  } else if (entity === 'staff') {
    headers = 'name,email,phone,role_title,class_name,subjects\n';
    if (schoolType === 'primary') {
      sampleRows = hasStreams
        ? 'Mr. Blessmore Sibanda,bsibanda@school.ac.zw,+263774567890,Senior Teacher,Grade 3 Blue,All Primary Subjects\n' +
          'Mrs. Susan Ncube,sncube@school.ac.zw,+263775678901,Deputy Head,Grade 7 Gold,English; Mathematics\n' +
          'Mrs. Grace Sithole,gsithole@school.ac.zw,+263777890123,Head Librarian,None,None\n'
        : 'Mr. Blessmore Sibanda,bsibanda@school.ac.zw,+263774567890,Senior Teacher,Grade 3,All Primary Subjects\n' +
          'Mrs. Susan Ncube,sncube@school.ac.zw,+263775678901,Deputy Head,Grade 7,English; Mathematics\n' +
          'Mrs. Grace Sithole,gsithole@school.ac.zw,+263777890123,Head Librarian,None,None\n';
    } else {
      sampleRows = hasStreams
        ? 'Ms. Tariro Moyo,tmoyo@school.ac.zw,+263775678901,Subject Teacher,Form 1A,Shona; Heritage Studies\n' +
          'Mr. Tawanda Dube,tdube@school.ac.zw,+263776789012,HOD Sciences,Form 3 Commercials,Mathematics; Physical Science\n' +
          'Mrs. Grace Sithole,gsithole@school.ac.zw,+263777890123,Head Librarian,None,None\n'
        : 'Ms. Tariro Moyo,tmoyo@school.ac.zw,+263775678901,Subject Teacher,Form 1,Shona; Heritage Studies\n' +
          'Mr. Tawanda Dube,tdube@school.ac.zw,+263776789012,HOD Sciences,Form 3,Mathematics; Physical Science\n' +
          'Mrs. Grace Sithole,gsithole@school.ac.zw,+263777890123,Head Librarian,None,None\n';
    }
  } else if (entity === 'subjects') {
    headers = 'code,name,category,level\n';
    if (schoolType === 'primary') {
      sampleRows =
        'ENG,English Language,Languages,Primary\n' +
        'MATH,Mathematics,Sciences,Primary\n' +
        'SHON,Indigenous Language (Shona),Languages,Primary\n' +
        'SCIE,Science and Technology,Sciences,Primary\n' +
        'GENP,General Paper,Social Sciences,Primary\n' +
        'AGRI,Agriculture,Vocational,Primary\n';
    } else {
      sampleRows =
        'ENG,English Language,Languages,Secondary\n' +
        'MATH,Mathematics,Sciences,Secondary\n' +
        'GEOG,Geography,Humanities,Secondary\n' +
        'HIST,History,Humanities,Secondary\n' +
        'COMM,Commerce,Commercials,Secondary\n' +
        'ACCS,Principles of Accounts,Commercials,Secondary\n' +
        'PHYS,Physical Science,Sciences,Secondary\n' +
        (hasAlevel ? 'CHEM,Chemistry,Pure Sciences,Form 3-6\n' : '');
    }
  } else if (entity === 'assets') {
    headers = 'name,category,code,serial_number,value,location\n';
    sampleRows =
      'Dell OptiPlex 7090,it_hardware,AST-IT-001,SN-DELL-9921,650.00,Computer Lab 1\n' +
      'Student Double Desks (Wooden),furniture,AST-FUR-012,TAG-DSK-44,45.00,Block C Room 4\n' +
      'Compound Microscope Olympus,science_lab,AST-LAB-005,SN-OLY-552,380.00,Chemistry Lab\n' +
      'Toyota Coaster School Bus 32 Seater,plant_vehicle,AST-VEH-001,AEH-4412,42000.00,Main Parking\n';
  } else if (entity === 'library') {
    headers = 'name,author,isbn,shelf_location,resource_type\n';
    sampleRows =
      'Step Ahead: O-Level Mathematics,M. Chitsike,978-0-7974-1234-5,Bay 1 Shelf A,textbook\n' +
      'Focus on Shona: Form 3 & 4,D. Mutasa,978-0-7974-5678-9,Bay 2 Shelf C,textbook\n' +
      'Things Fall Apart,Chinua Achebe,978-0-3854-7454-2,Bay 4 Shelf B,fiction\n' +
      'ZIMSEC Science Past Papers Vol 1,ZIMSEC Editorial,978-1-9982-1111-0,Reference Bay,past_paper\n';
  } else if (entity === 'classes') {
    headers = hasStreams ? 'name,level,capacity,stream\n' : 'name,level,capacity\n';
    if (schoolType === 'primary') {
      sampleRows = hasStreams
        ? 'Grade 1 East,Primary,40,East\nGrade 2 Blue,Primary,40,Blue\nGrade 7 Gold,Primary,45,Gold\n'
        : 'Grade 1,Primary,40\nGrade 2,Primary,40\nGrade 7,Primary,45\n';
    } else if (schoolType === 'combined' || schoolType === 'mixed') {
      sampleRows = hasStreams
        ? 'Grade 7 Blue,Primary,40,Blue\nForm 1A,Secondary,45,A\nForm 3 Commercials,Secondary,40,Commercials\n'
        : 'Grade 7,Primary,40\nForm 1,Secondary,45\nForm 3,Secondary,40\n';
    } else {
      sampleRows = hasStreams
        ? 'Form 1A,Secondary,45,A\nForm 2 East,Secondary,45,East\nForm 3 Commercials,Secondary,40,Commercials\n' +
          (hasAlevel ? 'Lower 6 Sciences,High School,35,Sciences\n' : '')
        : 'Form 1,Secondary,45\nForm 2,Secondary,45\nForm 3,Secondary,40\nForm 4,Secondary,40\n';
    }
  } else if (entity === 'fees') {
    headers = 'admission_number,term,amount_due,amount_paid,due_date\n';
    sampleRows =
      'ADM2026-001,Term 1 2026,450.00,450.00,2026-01-31\n' +
      'ADM2026-002,Term 1 2026,450.00,200.00,2026-01-31\n' +
      'ADM2026-003,Term 1 2026,520.00,0.00,2026-01-31\n';
  } else {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown template entity.' } });
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="schoolbase_${entity}_template.csv"`);
  return res.send(headers + sampleRows);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DETAILED DATA FORMAT SPECIFICATIONS & VALIDATION SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
router.get('/specifications/:entity', authenticateToken, async (req, res) => {
  const { schoolId, entity } = req.params;
  const school = await queryOne('SELECT id, name, school_type, has_alevel, has_streams FROM schools WHERE id = ?', [schoolId]);
  const schoolType = (school?.school_type || 'secondary').toLowerCase();
  const hasAlevel = Boolean(school?.has_alevel || schoolType === 'high_school' || schoolType === 'a_level');
  const hasStreams = school?.has_streams !== 0 && school?.has_streams !== false;

  const sampleClassName = schoolType === 'primary'
    ? (hasStreams ? 'Grade 3 Blue' : 'Grade 3')
    : (hasStreams ? 'Form 2 East' : 'Form 2');

  const specifications = {
    students: {
      entity: 'students',
      title: 'Students & Guardian Roster Specification',
      description: 'Ingests student demographic profiles, assigns class stream rosters, and auto-links primary guardians with contact phone/email.',
      mandatoryColumns: ['first_name', 'last_name', 'gender', 'class_name'],
      fields: [
        {
          name: 'first_name',
          required: true,
          type: 'text',
          description: 'Official student first name (as recorded on birth certificate).',
          example: 'Tadiwanashe'
        },
        {
          name: 'last_name',
          required: true,
          type: 'text',
          description: 'Official student surname / family name.',
          example: 'Moyo'
        },
        {
          name: 'gender',
          required: true,
          type: 'enum',
          description: 'Student gender. Accepts "male", "female", "M", or "F".',
          example: 'male'
        },
        {
          name: 'class_name',
          required: true,
          type: 'text',
          description: `Class cohort allocation. Must follow ${schoolType === 'primary' ? 'Primary (ECD/Grade 1-7)' : 'Secondary (Form 1-4/6)'} guidelines.${hasStreams ? ' Streams permitted.' : ' No streams allowed (single cohort).' }`,
          example: sampleClassName
        },
        {
          name: 'admission_number',
          required: false,
          type: 'text',
          description: 'Unique school admission ID. If omitted, the system generates an official auto-incremented number.',
          example: 'ADM2026-001'
        },
        {
          name: 'date_of_birth',
          required: false,
          type: 'date',
          description: 'Date of birth formatted as YYYY-MM-DD.',
          example: '2012-05-18'
        },
        {
          name: 'guardian_name',
          required: false,
          type: 'text',
          description: 'Full name of the primary parent or legal guardian.',
          example: 'Dr. Peter Moyo'
        },
        {
          name: 'guardian_phone',
          required: false,
          type: 'phone',
          description: 'Guardian phone number for SMS emergency alerts and fee reminders.',
          example: '+263772345678'
        },
        {
          name: 'guardian_email',
          required: false,
          type: 'email',
          description: 'Guardian email address for parent portal login & digital report card dispatch.',
          example: 'pmoyo@health.gov.zw'
        }
      ],
      linkingRules: [
        `Institutional Guidelines: Enforces ${schoolType.toUpperCase()} cohort policies. ${schoolType === 'primary' ? 'Only ECD and Grade 1-7 allowed.' : 'Only Form 1 to Form 4/6 allowed. Primary grades are strictly blocked.'}`,
        `Stream Guidelines: ${hasStreams ? 'Streams are enabled for this institution.' : 'Single cohort only — streams will be rejected.'}`,
        'Guardian Account Provisioning: Automatically links parent records with student IDs so unlinked parents can NEVER view other students.',
        'Zero Collision Guarantee: Automatically verifies and deduplicates admission numbers across the school dataset.'
      ]
    },
    staff: {
      entity: 'staff',
      title: 'Teachers & Academic Staff Specification',
      description: 'Provisions staff user credentials, designates Form Master / Class Teacher roles, and establishes teaching subject allocations.',
      mandatoryColumns: ['name', 'email', 'role_title'],
      fields: [
        {
          name: 'name',
          required: true,
          type: 'text',
          description: 'Full official name and professional title of the teacher.',
          example: 'Mr. Tawanda Dube'
        },
        {
          name: 'email',
          required: true,
          type: 'email',
          description: 'Unique institutional email address used for login and notifications.',
          example: 'tdube@school.ac.zw'
        },
        {
          name: 'role_title',
          required: true,
          type: 'text',
          description: 'Designation or post (e.g. "Senior Teacher", "HOD Sciences", "Form Master"). Defaults to "Teacher".',
          example: 'HOD Sciences'
        },
        {
          name: 'phone',
          required: false,
          type: 'phone',
          description: 'Contact phone number for school directory.',
          example: '+263774567890'
        },
        {
          name: 'class_name',
          required: false,
          type: 'text',
          description: 'Assigned class for Form Master / Class Teacher responsibilities. Links teacher as the class head.',
          example: sampleClassName
        },
        {
          name: 'subjects',
          required: false,
          type: 'list',
          description: 'Semicolon or comma-separated list of subjects taught. Links teaching assignments automatically.',
          example: schoolType === 'primary' ? 'All Primary Subjects' : 'Mathematics; Physical Science'
        }
      ],
      linkingRules: [
        'Form Master Linkage: If class_name is provided, automatically assigns teacher as Form Master for that class.',
        'Teaching Assignment Matrix: Automatically maps subjects to teaching_assignments so grade entry and schemes of work link immediately.',
        'Instant Credentials: Generates secure temporary login credentials (username + password) returned upon import completion.'
      ]
    },
    subjects: {
      entity: 'subjects',
      title: 'Curriculum Subjects Specification',
      description: 'Ingests academic curriculum subject codes and descriptions.',
      mandatoryColumns: ['name'],
      fields: [
        { name: 'name', required: true, type: 'text', description: 'Full subject title.', example: schoolType === 'primary' ? 'Science and Technology' : 'Physical Science' },
        { name: 'code', required: false, type: 'text', description: 'Subject abbreviation code.', example: schoolType === 'primary' ? 'SCIE' : 'PHYS' },
        { name: 'category', required: false, type: 'text', description: 'Subject faculty or department.', example: 'Sciences' },
        { name: 'level', required: false, type: 'text', description: 'Academic phase or level.', example: schoolType === 'primary' ? 'Primary' : 'Secondary' }
      ],
      linkingRules: [
        'Unique Subject Codes: Automatically assigns 4-letter uppercase code if omitted.',
        'Curriculum Integration: Makes subjects available across all class syllabus configurations.'
      ]
    },
    classes: {
      entity: 'classes',
      title: 'Class Streams Specification',
      description: 'Creates stream cohorts, grades, forms, and seating capacity quotas.',
      mandatoryColumns: ['name', 'level'],
      fields: [
        { name: 'name', required: true, type: 'text', description: 'Class name or stream.', example: sampleClassName },
        { name: 'level', required: true, type: 'text', description: 'Academic level: Primary, Secondary, or High School.', example: schoolType === 'primary' ? 'Primary' : 'Secondary' },
        { name: 'capacity', required: false, type: 'number', description: 'Maximum student enrolment.', example: '45' }
      ],
      linkingRules: [
        `Strict Institutional Validation: Only accepts ${schoolType === 'primary' ? 'Primary grades (ECD, Grade 1-7)' : 'Secondary forms (Form 1-4/6)'}.`,
        `Stream Policy: ${hasStreams ? 'Streams are permitted.' : 'Single-cohort only; stream suffixes are rejected.'}`
      ]
    },
    assets: {
      entity: 'assets',
      title: 'School Assets & Inventory Specification',
      description: 'Ingests institutional fixed assets, computer lab equipment, science lab apparatus, furniture, and vehicles.',
      mandatoryColumns: ['name'],
      fields: [
        { name: 'name', required: true, type: 'text', description: 'Asset/Equipment name and model.', example: 'Dell OptiPlex 7090 Desktop' },
        { name: 'category', required: false, type: 'text', description: 'Category: it_hardware, science_lab, furniture, plant_vehicle, general.', example: 'it_hardware' },
        { name: 'code', required: false, type: 'text', description: 'Asset tag or barcode ID. Auto-generated if blank.', example: 'AST-IT-001' },
        { name: 'serial_number', required: false, type: 'text', description: 'Manufacturer serial number.', example: 'SN-DELL-9921' },
        { name: 'value', required: false, type: 'number', description: 'Purchase cost or current book valuation (USD).', example: '650.00' },
        { name: 'location', required: false, type: 'text', description: 'Current campus location / room.', example: 'Computer Lab 1' }
      ],
      linkingRules: [
        'Custodian & Lending: Ingested assets are instantly ready for staff custody checkouts and maintenance logs.'
      ]
    },
    library: {
      entity: 'library',
      title: 'Library Books & Media Catalogue Specification',
      description: 'Ingests library books, curriculum textbooks, literature sets, and past examination papers.',
      mandatoryColumns: ['name'],
      fields: [
        { name: 'name', required: true, type: 'text', description: 'Book or media title.', example: 'Step Ahead: O-Level Mathematics' },
        { name: 'author', required: false, type: 'text', description: 'Author or editorial contributor.', example: 'M. Chitsike' },
        { name: 'isbn', required: false, type: 'text', description: 'ISBN or library accession barcode.', example: '978-0-7974-1234-5' },
        { name: 'shelf_location', required: false, type: 'text', description: 'Library bay, shelf, or stack location.', example: 'Bay 1 Shelf A' },
        { name: 'resource_type', required: false, type: 'text', description: 'Type: textbook, revision_guide, fiction, past_paper.', example: 'textbook' }
      ],
      linkingRules: [
        'Direct Library Lending Integration: Books are tagged as category "book" and immediately become available for student loans, barcode scanning, and overdue tracking.'
      ]
    },
    fees: {
      entity: 'fees',
      title: 'Tuition & Fee Billing Invoices Specification',
      description: 'Ingests student fee invoices, billings, and initial receipt allocations.',
      mandatoryColumns: ['admission_number', 'term', 'amount_due'],
      fields: [
        { name: 'admission_number', required: true, type: 'text', description: 'Student admission number to link invoice.', example: 'ADM2026-001' },
        { name: 'term', required: true, type: 'text', description: 'Academic billing term.', example: 'Term 1 2026' },
        { name: 'amount_due', required: true, type: 'number', description: 'Total fee invoice amount.', example: '450.00' },
        { name: 'amount_paid', required: false, type: 'number', description: 'Initial payment amount if prepaid.', example: '200.00' },
        { name: 'due_date', required: false, type: 'date', description: 'Payment deadline formatted as YYYY-MM-DD.', example: '2026-01-31' },
        { name: 'title', required: false, type: 'text', description: 'Fee billing description.', example: 'Term Tuition Fee' }
      ],
      linkingRules: [
        'Admission Number Resolution: Automatically links billing items directly to the student ledger account.',
        'Payment Reconciliation: If amount_paid is provided and > 0, an official receipt transaction is generated and reflected in ledger.'
      ]
    }
  };

  const spec = specifications[entity];
  if (!spec) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: `No format specification for entity "${entity}".` } });
  }

  return res.json({ data: spec });
});

module.exports = router;
