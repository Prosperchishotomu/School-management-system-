const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { requireIdempotencyKey, idempotencyMiddleware } = require('../utils/idempotency');
const { initializePayment } = require('../services/payments');
const { broadcastInvalidation } = require('../services/realtime');

// Resolve term strictly by date (or database terms if configured)
const getTermFromDate = (dateVal = new Date(), termsList = []) => {
  const d = new Date(dateVal);
  const month = d.getMonth(); // 0 = Jan, 11 = Dec
  const year = d.getFullYear();

  if (termsList && termsList.length > 0) {
    const dStr = d.toISOString().split('T')[0];
    const match = termsList.find(t => t.start_date <= dStr && t.end_date >= dStr);
    if (match) {
      const num = match.name.replace(/[^0-9]/g, '') || '1';
      return {
        term_name: `Term ${num}`,
        term_number: parseInt(num, 10),
        academic_year: year,
        start_date: match.start_date,
        end_date: match.end_date,
        is_current: 1
      };
    }
  }

  // Standard Zimbabwe Academic Calendar based on date month:
  // Jan 1 - Apr 30: Term 1
  // May 1 - Aug 31: Term 2
  // Sep 1 - Dec 31: Term 3
  let termNum = 1;
  if (month >= 8) termNum = 3;
  else if (month >= 4) termNum = 2;
  else termNum = 1;

  return {
    term_name: `Term ${termNum}`,
    term_number: termNum,
    academic_year: year,
    is_current: 1
  };
};

// GET /schools/:schoolId/terms/current — Resolve current term strictly by date
router.get('/schools/:schoolId/terms/current', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let terms = [];
    try {
      terms = await query('SELECT * FROM terms WHERE school_id = ? ORDER BY start_date ASC', [schoolId]);
    } catch (e) {}

    const currentTerm = getTermFromDate(new Date(), terms);
    return res.json({ data: currentTerm });
  } catch (err) {
    console.error('Get current term error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to resolve current term.' } });
  }
});

// GET /schools/:schoolId/students/:id/ledger — Accurate verified financial ledger
router.get('/schools/:schoolId/students/:id/ledger', authenticateToken, async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const userRole = req.user?.role;

    // Access control
    if (userRole === 'parent') {
      const isLinked = await queryOne(
        `SELECT 1 FROM student_guardians sg
         JOIN guardians g ON sg.guardian_id = g.id
         WHERE (g.user_id = ? OR (g.email IS NOT NULL AND g.email != '' AND g.email = ?) OR (g.phone IS NOT NULL AND g.phone != '' AND g.phone = ?))
           AND sg.student_id = ?`,
        [req.user.id, req.user.email || '', req.user.phone || '', id]
      );
      if (!isLinked) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied: You can only view ledger for linked students.' } });
      }
    } else if (userRole === 'student') {
      const isSelf = await queryOne(
        `SELECT 1 FROM students WHERE id = ? AND (id = ? OR user_id = ?)`,
        [id, req.user.id, req.user.id]
      );
      if (!isSelf) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied: You can only view your own student ledger.' } });
      }
    } else if (userRole === 'teacher') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Teachers do not have access to financial ledgers.' } });
    }

    const student = await queryOne(
      `SELECT st.*, c.name as class_name, s.name as school_name, COALESCE(s.currency, 'USD') as school_currency
       FROM students st
       JOIN schools s ON st.school_id = s.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE st.id = ? AND st.school_id = ?`,
      [id, schoolId]
    );

    if (!student) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Student not found.' } });
    }

    // Invoices / Fee Debits
    const feesRows = await query(
      `SELECT id, school_id, student_id, title, amount_due, amount_paid, term, due_date, status, created_at
       FROM fees
       WHERE student_id = ? AND school_id = ?
       ORDER BY created_at ASC`,
      [id, schoolId]
    );

    // Payments / Fee Credits
    const paymentRows = await query(
      `SELECT fp.id, fp.school_id, fp.student_id, fp.fee_id, fp.amount_paid, fp.payment_date,
              fp.payment_method, fp.payment_currency, fp.reference, fp.created_at,
              f.title as fee_title, f.term
       FROM fee_payments fp
       LEFT JOIN fees f ON fp.fee_id = f.id
       WHERE fp.student_id = ? AND fp.school_id = ?
       ORDER BY COALESCE(fp.payment_date, fp.created_at) ASC`,
      [id, schoolId]
    );

    const allEntries = [];

    for (const f of feesRows) {
      allEntries.push({
        id: f.id,
        transaction_date: f.created_at,
        reference: f.id,
        entry_type: 'debit',
        title: f.title || `${f.term || 'Term'} Fee Charge`,
        term: f.term || 'Current',
        due_date: f.due_date,
        payment_method: null,
        payment_currency: student.school_currency || 'USD',
        debit: parseFloat(f.amount_due || 0),
        credit: 0,
        status: f.status
      });
    }

    for (const p of paymentRows) {
      allEntries.push({
        id: p.id,
        transaction_date: p.payment_date || p.created_at,
        reference: p.reference || p.id,
        entry_type: 'credit',
        title: `Payment: ${p.fee_title || p.term || 'Tuition'}`,
        term: p.term || 'Current',
        due_date: null,
        payment_method: p.payment_method || 'cash',
        payment_currency: p.payment_currency || student.school_currency || 'USD',
        debit: 0,
        credit: parseFloat(p.amount_paid || 0),
        status: 'verified'
      });
    }

    // Sort chronologically to compute running balance
    allEntries.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

    let runningBalance = 0;
    let totalBilled = 0;
    let totalPaid = 0;

    const ledger = allEntries.map(entry => {
      if (entry.entry_type === 'debit') {
        runningBalance += entry.debit;
        totalBilled += entry.debit;
      } else {
        runningBalance -= entry.credit;
        totalPaid += entry.credit;
      }
      return {
        ...entry,
        running_balance: parseFloat(runningBalance.toFixed(2))
      };
    });

    const netBalance = parseFloat((totalBilled - totalPaid).toFixed(2));
    const ledgerStatus = totalBilled === 0 ? 'no_invoices' : (netBalance <= 0 ? 'cleared' : (totalPaid > 0 ? 'partial' : 'unpaid'));

    return res.json({
      data: {
        student: {
          id: student.id,
          admission_number: student.admission_number,
          name: `${student.first_name} ${student.last_name}`,
          class_name: student.class_name,
          school_name: student.school_name,
          is_boarding: Boolean(student.is_boarding)
        },
        summary: {
          total_billed: parseFloat(totalBilled.toFixed(2)),
          total_paid: parseFloat(totalPaid.toFixed(2)),
          balance_due: Math.max(0, netBalance),
          net_balance: netBalance,
          currency: student.school_currency || 'USD',
          status: ledgerStatus,
          total_transactions: ledger.length
        },
        ledger: [...ledger].reverse() // Return most recent first for display
      }
    });
  } catch (err) {
    console.error('Get student financial ledger error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to retrieve student financial ledger.' } });
  }
});

// POST /schools/:schoolId/students/:id/charges — Add charge / debit to student ledger
router.post('/schools/:schoolId/students/:id/charges', authenticateToken, requireRoles('school_admin', 'bursar', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { title, amount, term, due_date } = req.body;

    if (!title || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Charge title and valid amount are required.' } });
    }

    const currentTermObj = getTermFromDate(new Date());
    const resolvedTerm = term || currentTermObj.term_name;
    const feeId = 'CHG' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

    await query(
      `INSERT INTO fees (id, school_id, student_id, title, amount_due, amount_paid, term, due_date, status)
       VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, 'unpaid')`,
      [feeId, schoolId, id, title.trim(), parseFloat(amount), resolvedTerm, due_date || null]
    );

    broadcastInvalidation(schoolId, [
      'fees',
      'fees_ledger',
      'fees_summary',
      `student_profile_${schoolId}_${id}`,
      `student_ledger_${schoolId}_${id}`
    ], 'fee_charged');

    const created = await queryOne('SELECT * FROM fees WHERE id = ?', [feeId]);
    return res.status(201).json({ data: created, message: 'Fee charge successfully posted to student financial ledger.' });
  } catch (err) {
    console.error('Add charge error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to post charge to student ledger.' } });
  }
});

// GET /schools/:schoolId/fees/calculator
router.get('/schools/:schoolId/fees/calculator', authenticateToken, requireRoles('school_admin', 'bursar', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;

    const phaseRows = await query(`
      SELECT 
        COALESCE(c.level, 'junior') as phase,
        COUNT(st.id) as total_students,
        SUM(CASE WHEN st.is_boarding = 1 THEN 1 ELSE 0 END) as boarding_students,
        SUM(CASE WHEN st.gender = 'female' THEN 1 ELSE 0 END) as female_students,
        SUM(CASE WHEN st.gender = 'male' THEN 1 ELSE 0 END) as male_students
      FROM students st
      LEFT JOIN classes c ON st.class_id = c.id
      WHERE st.school_id = ? AND st.status NOT IN ('withdrawn', 'graduated', 'transferred', 'dropped_out')
      GROUP BY COALESCE(c.level, 'junior')
    `, [schoolId]);

    const defaultTuition = {
      infant: 180.00,
      junior: 260.00,
      ordinary: 380.00,
      advanced: 460.00
    };

    const alevelStudents = await query(`
      SELECT 
        st.id,
        st.first_name,
        st.last_name,
        c.name as class_name,
        COUNT(DISTINCT ss.subject_id) as subject_count,
        GROUP_CONCAT(DISTINCT s.code SEPARATOR ', ') as subjects_list,
        CASE 
          WHEN c.name LIKE '%Sci%' OR c.name LIKE '%Science%' THEN 'SCIENCES'
          WHEN c.name LIKE '%Com%' OR c.name LIKE '%Commercial%' THEN 'COMMERCIAL'
          ELSE 'ARTS'
        END as stream
      FROM students st
      JOIN classes c ON st.class_id = c.id
      JOIN student_subjects ss ON st.id = ss.student_id
      JOIN subjects s ON ss.subject_id = s.id
      WHERE st.school_id = ? AND c.level = 'advanced' AND st.status NOT IN ('withdrawn', 'graduated', 'transferred', 'dropped_out')
      GROUP BY st.id, st.first_name, st.last_name, c.name
    `, [schoolId]);

    const alevelStats = {
      total: alevelStudents.length,
      streams: {
        ARTS: { count: 0, taking_3: 0, taking_4: 0, taking_5_plus: 0, sample_students: [] },
        COMMERCIAL: { count: 0, taking_3: 0, taking_4: 0, taking_5_plus: 0, sample_students: [] },
        SCIENCES: { count: 0, taking_3: 0, taking_4: 0, taking_5_plus: 0, sample_students: [] }
      },
      distribution: {
        taking_3: 0,
        taking_4: 0,
        taking_5_plus: 0
      }
    };

    alevelStudents.forEach(st => {
      const stream = st.stream;
      const count = Number(st.subject_count);
      if (alevelStats.streams[stream]) {
        alevelStats.streams[stream].count++;
        if (count <= 3) {
          alevelStats.streams[stream].taking_3++;
          alevelStats.distribution.taking_3++;
        } else if (count === 4) {
          alevelStats.streams[stream].taking_4++;
          alevelStats.distribution.taking_4++;
        } else {
          alevelStats.streams[stream].taking_5_plus++;
          alevelStats.distribution.taking_5_plus++;
        }
        if (alevelStats.streams[stream].sample_students.length < 5) {
          alevelStats.streams[stream].sample_students.push({
            id: st.id,
            name: `${st.first_name} ${st.last_name}`,
            class_name: st.class_name,
            subject_count: count,
            subjects: st.subjects_list
          });
        }
      }
    });

    const chargedSubjects = await query(`
      SELECT 
        s.id,
        s.code,
        s.name,
        s.category,
        s.level,
        CAST(s.subject_fee AS DECIMAL(10,2)) as fee,
        COUNT(DISTINCT ss.student_id) as enrolled_students,
        CAST(COUNT(DISTINCT ss.student_id) * s.subject_fee AS DECIMAL(10,2)) as total_subject_revenue
      FROM subjects s
      JOIN student_subjects ss ON s.id = ss.subject_id
      JOIN students st ON ss.student_id = st.id AND st.school_id = ? AND st.status NOT IN ('withdrawn', 'graduated', 'transferred', 'dropped_out')
      WHERE s.subject_fee > 0
      GROUP BY s.id, s.code, s.name, s.category, s.level, s.subject_fee
      ORDER BY s.subject_fee DESC
    `, [schoolId]);

    const ledgerTotals = await queryOne(`
      SELECT 
        COUNT(f.id) as total_invoices,
        COALESCE(SUM(f.amount_due), 0) as total_billed,
        COALESCE(SUM(f.amount_paid), 0) as total_collected,
        COALESCE(SUM(f.amount_due - f.amount_paid), 0) as total_outstanding,
        COUNT(CASE WHEN f.status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN f.status = 'partially_paid' OR f.status = 'part_paid' THEN 1 END) as part_paid_invoices,
        COUNT(CASE WHEN f.status = 'unpaid' THEN 1 END) as unpaid_invoices
      FROM fees f
      WHERE f.school_id = ?
    `, [schoolId]);

    const phaseMap = {};
    let grandTotalStudents = 0;
    let grandTotalBoarding = 0;
    let grandTuitionRevenue = 0;

    phaseRows.forEach(row => {
      const p = row.phase;
      const count = Number(row.total_students || 0);
      const boarding = Number(row.boarding_students || 0);
      const rate = defaultTuition[p] || 250;
      const tuitionRev = count * rate;

      grandTotalStudents += count;
      grandTotalBoarding += boarding;
      grandTuitionRevenue += tuitionRev;

      phaseMap[p] = {
        phase: p,
        label: p === 'infant' ? 'Early Childhood Development (ECD)'
             : p === 'junior' ? 'Primary School (Grades 1-7)'
             : p === 'ordinary' ? 'O-Level (Forms 1-4)'
             : 'A-Level (Forms 5-6)',
        student_count: count,
        boarding_count: boarding,
        rate_per_student: rate,
        projected_tuition: tuitionRev
      };
    });

    ['infant', 'junior', 'ordinary', 'advanced'].forEach(ph => {
      if (!phaseMap[ph]) {
        phaseMap[ph] = {
          phase: ph,
          label: ph === 'infant' ? 'Early Childhood Development (ECD)'
               : ph === 'junior' ? 'Primary School (Grades 1-7)'
               : ph === 'ordinary' ? 'O-Level (Forms 1-4)'
               : 'A-Level (Forms 5-6)',
          student_count: 0,
          boarding_count: 0,
          rate_per_student: defaultTuition[ph],
          projected_tuition: 0
        };
      }
    });

    const totalSubjectFeeRevenue = chargedSubjects.reduce((acc, curr) => acc + Number(curr.total_subject_revenue || 0), 0);
    const boardingFeeRate = 550.00;
    const totalBoardingRevenue = grandTotalBoarding * boardingFeeRate;
    const sdaLevyRate = 30.00;
    const totalSdaRevenue = grandTotalStudents * sdaLevyRate;

    const projectedGrandTotal = grandTuitionRevenue + totalSubjectFeeRevenue + totalBoardingRevenue + totalSdaRevenue;

    return res.json({
      data: {
        summary: {
          total_students: grandTotalStudents,
          boarding_students: grandTotalBoarding,
          day_students: grandTotalStudents - grandTotalBoarding,
          projected_total_revenue: projectedGrandTotal,
          projected_tuition_revenue: grandTuitionRevenue,
          projected_subject_fees: totalSubjectFeeRevenue,
          projected_boarding_revenue: totalBoardingRevenue,
          projected_sda_levy: totalSdaRevenue,
          actual_billed: Number(ledgerTotals?.total_billed || 0),
          actual_collected: Number(ledgerTotals?.total_collected || 0),
          actual_outstanding: Number(ledgerTotals?.total_outstanding || 0),
          collection_rate_pct: ledgerTotals?.total_billed > 0 
            ? Math.round((Number(ledgerTotals.total_collected) / Number(ledgerTotals.total_billed)) * 100)
            : 0
        },
        phases: Object.values(phaseMap),
        alevel_breakdown: alevelStats,
        charged_subjects: chargedSubjects,
        rates_applied: {
          tuition: defaultTuition,
          boarding_fee: boardingFeeRate,
          sda_levy: sdaLevyRate
        }
      }
    });
  } catch (err) {
    console.error('Fees calculator error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to compute dynamic fees.' } });
  }
});

// POST /schools/:schoolId/fees/calculator/simulate
router.post('/schools/:schoolId/fees/calculator/simulate', authenticateToken, async (req, res) => {
  try {
    const {
      infant_count = 0, infant_rate = 180,
      junior_count = 0, junior_rate = 260,
      ordinary_count = 0, ordinary_rate = 380,
      advanced_arts_count = 0, advanced_com_count = 0, advanced_sci_count = 0, advanced_rate = 460,
      boarding_count = 0, boarding_rate = 550,
      sda_rate = 30,
      subject_charges = []
    } = req.body;

    const nInfant = Math.max(0, Number(infant_count) || 0);
    const nJunior = Math.max(0, Number(junior_count) || 0);
    const nOrdinary = Math.max(0, Number(ordinary_count) || 0);
    const nArts = Math.max(0, Number(advanced_arts_count) || 0);
    const nCom = Math.max(0, Number(advanced_com_count) || 0);
    const nSci = Math.max(0, Number(advanced_sci_count) || 0);
    const nAdvanced = nArts + nCom + nSci;
    const totalStudents = nInfant + nJunior + nOrdinary + nAdvanced;

    const rInfant = Number(infant_rate) || 0;
    const rJunior = Number(junior_rate) || 0;
    const rOrdinary = Number(ordinary_rate) || 0;
    const rAdvanced = Number(advanced_rate) || 0;
    const rBoarding = Number(boarding_rate) || 0;
    const rSda = Number(sda_rate) || 0;

    const infantRev = nInfant * rInfant;
    const juniorRev = nJunior * rJunior;
    const ordinaryRev = nOrdinary * rOrdinary;
    const advancedRev = nAdvanced * rAdvanced;
    const tuitionRev = infantRev + juniorRev + ordinaryRev + advancedRev;

    const boardingRev = Math.max(0, Number(boarding_count) || 0) * rBoarding;
    const sdaRev = totalStudents * rSda;

    let subjectRev = 0;
    const processedSubjects = (subject_charges || []).map(sc => {
      const count = Math.max(0, Number(sc.enrolled_count) || 0);
      const fee = Math.max(0, Number(sc.fee) || 0);
      const rev = count * fee;
      subjectRev += rev;
      return {
        id: sc.id,
        name: sc.name,
        category: sc.category,
        fee,
        enrolled_count: count,
        total_revenue: rev
      };
    });

    const grandTotal = tuitionRev + boardingRev + sdaRev + subjectRev;

    return res.json({
      data: {
        simulation: {
          total_students: totalStudents,
          projected_total: grandTotal,
          average_fee_per_student: totalStudents > 0 ? Math.round(grandTotal / totalStudents) : 0,
          tuition_breakdown: {
            infant: { count: nInfant, rate: rInfant, total: infantRev },
            junior: { count: nJunior, rate: rJunior, total: juniorRev },
            ordinary: { count: nOrdinary, rate: rOrdinary, total: ordinaryRev },
            advanced: {
              count: nAdvanced,
              rate: rAdvanced,
              total: advancedRev,
              arts_count: nArts,
              commercial_count: nCom,
              sciences_count: nSci
            },
            total_tuition: tuitionRev
          },
          ancillary_fees: {
            boarding: { count: Number(boarding_count) || 0, rate: rBoarding, total: boardingRev },
            sda_levy: { count: totalStudents, rate: rSda, total: sdaRev },
            subject_charges: { items: processedSubjects, total: subjectRev }
          }
        }
      }
    });
  } catch (err) {
    console.error('Simulate fees error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to simulate fee calculation.' } });
  }
});

// GET /schools/:schoolId/fees
router.get('/schools/:schoolId/fees', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { class_id, term, student_id } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, Number.parseInt(req.query.per_page || req.query.limit, 10) || 50));
    const userRole = req.user?.role;

    // Teachers do not manage school accounting
    if (userRole === 'teacher') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Teachers do not have access to fee ledgers.' } });
    }

    let sql = `
      SELECT f.*, c.name as class_name, st.first_name, st.last_name, st.admission_number
      FROM fees f
      JOIN students st ON f.student_id = st.id
      LEFT JOIN classes c ON st.class_id = c.id
      WHERE f.school_id = ?
    `;
    const params = [schoolId];

    // PARENT SCOPING: A parent MUST ONLY see invoices and fees belonging to their linked children
    if (userRole === 'parent') {
      const parentUser = req.user;
      const linkedStudents = await query(
        `SELECT DISTINCT st.id FROM students st
         JOIN student_guardians sg ON st.id = sg.student_id
         JOIN guardians g ON sg.guardian_id = g.id
         WHERE (
           g.user_id = ?
           OR (g.email IS NOT NULL AND g.email != '' AND g.email = ?)
           OR (g.phone IS NOT NULL AND g.phone != '' AND g.phone = ?)
         ) AND st.school_id = ?`,
        [parentUser.id, parentUser.email || '', parentUser.phone || '', schoolId]
      );

      if (!linkedStudents || linkedStudents.length === 0) {
        return res.json({ data: [], meta: { page: 1, per_page: perPage, total: 0, request_id: req.requestId } });
      }

      const allowedIds = linkedStudents.map(s => s.id);
      if (student_id) {
        if (!allowedIds.includes(student_id)) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied: You can only view fees for your linked children.' } });
        }
        sql += ' AND f.student_id = ?';
        params.push(student_id);
      } else {
        const placeholders = allowedIds.map(() => '?').join(',');
        sql += ` AND f.student_id IN (${placeholders})`;
        params.push(...allowedIds);
      }
    } else if (userRole === 'student') {
      // Student can only see their own fees
      sql += ' AND (f.student_id = ? OR st.user_id = ?)';
      params.push(req.user.id, req.user.id);
    } else {
      // Admin / Bursar can filter by student_id or class_id
      if (student_id) {
        sql += ' AND f.student_id = ?';
        params.push(student_id);
      }
      if (class_id) {
        sql += ' AND st.class_id = ?';
        params.push(class_id);
      }
    }

    if (term) {
      sql += ' AND f.term = ?';
      params.push(term);
    }

    const offset = (page - 1) * perPage;
    sql += ` ORDER BY st.first_name ASC, f.created_at DESC LIMIT ${perPage} OFFSET ${offset}`;

    const fees = await query(sql, params);
    return res.json({ data: fees, meta: { page, per_page: perPage, total: fees.length, request_id: req.requestId } });
  } catch (err) {
    console.error('Get fees error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch fee ledgers.' } });
  }
});

// POST /schools/:schoolId/fees
router.post('/schools/:schoolId/fees', authenticateToken, requireRoles('school_admin', 'bursar', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { student_id, title, amount_due, term, due_date } = req.body;

    if (!student_id || !title || !amount_due) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Student ID, Title, and Amount Due are required.' } });
    }

    const feeId = 'FEE' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO fees (id, school_id, student_id, title, amount_due, amount_paid, term, due_date, status)
       VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, 'unpaid')`,
      [feeId, schoolId, student_id, title.trim(), parseFloat(amount_due), term || getTermFromDate(), due_date || null]
    );

    broadcastInvalidation(schoolId, ['fees', 'fees_ledger', 'fees_summary', 'summary', 'top_debtors', 'ageing_fees'], 'fee_billed');

    const created = await queryOne('SELECT * FROM fees WHERE id = ?', [feeId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create fee error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create fee ledger.' } });
  }
});


// POST /schools/:schoolId/fees/:feeId/payments
router.post('/schools/:schoolId/fees/:feeId/payments', authenticateToken, requireIdempotencyKey, idempotencyMiddleware, requireRoles('bursar', 'school_admin', 'parent', 'student', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, feeId } = req.params;
    const { amount_paid, payment_method, reference, notes } = req.body;

    if (!amount_paid || parseFloat(amount_paid) <= 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid payment amount is required.' } });
    }

    let fee = await queryOne('SELECT * FROM fees WHERE id = ? AND school_id = ?', [feeId, schoolId]);
    if (!fee) {
      // Auto-initialize fee record if student exists (or feeId is synthetic like FEE-<studentId>)
      const extractedStudentId = req.body.student_id || (feeId && feeId.startsWith('FEE-') ? feeId.replace('FEE-', '') : null);
      if (extractedStudentId) {
        const student = await queryOne('SELECT * FROM students WHERE id = ? AND school_id = ?', [extractedStudentId, schoolId]);
        if (student) {
          // Look for existing fee record for student
          fee = await queryOne('SELECT * FROM fees WHERE student_id = ? AND school_id = ? ORDER BY created_at DESC LIMIT 1', [extractedStudentId, schoolId]);
          if (!fee) {
            const actualFeeId = feeId.startsWith('FEE-') ? feeId : ('FEE-' + extractedStudentId);
            await query(
              `INSERT INTO fees (id, school_id, student_id, term, year, amount_due, amount_paid, status, currency)
               VALUES (?, ?, ?, 'Term 1', YEAR(NOW()), 450.00, 0.00, 'unpaid', ?)`,
              [actualFeeId, schoolId, extractedStudentId, req.body.currency || 'USD']
            );
            fee = await queryOne('SELECT * FROM fees WHERE id = ?', [actualFeeId]);
          }
        }
      }
    }
    if (!fee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fee record not found.' } });
    }

    const actualFeeId = fee.id;
    const payAmount = parseFloat(amount_paid);
    const newPaid = parseFloat(fee.amount_paid || 0) + payAmount;
    const dueAmount = parseFloat(fee.amount_due || 0);

    let newStatus = 'unpaid';
    if (newPaid >= dueAmount) {
      newStatus = 'cleared';
    } else if (newPaid > 0) {
      newStatus = 'partial';
    }

    const paymentId = 'PAY' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const paymentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const idempotencyKey = (req.headers['idempotency-key'] || ('IDEM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6))).slice(0, 95);
    const userId = req.user && req.user.id ? req.user.id : null;
    const payCurrency = req.body.currency || 'USD';

    try {
      await query(
        `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, payment_currency, reference, idempotency_key, payment_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, schoolId, actualFeeId, fee.student_id, payAmount, payment_method || 'cash', payCurrency, reference || null, idempotencyKey, paymentDate, userId]
      );
    } catch (dbErr) {
      // Fallback without created_by if FK fails
      await query(
        `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, payment_currency, reference, idempotency_key, payment_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, schoolId, actualFeeId, fee.student_id, payAmount, payment_method || 'cash', payCurrency, reference || null, idempotencyKey, paymentDate]
      );
    }

    await query(
      `UPDATE fees SET amount_paid = ?, status = ? WHERE id = ?`,
      [newPaid, newStatus, actualFeeId]
    );

    broadcastInvalidation(schoolId, ['fees', 'fees_ledger', 'fees_summary', 'summary', 'top_debtors', 'ageing_fees', 'dashboard'], 'payment_recorded');

    const receipt = await queryOne(
      `SELECT fp.*, s.name as school_name, st.first_name, st.last_name, st.admission_number, f.amount_due, f.term,
              COALESCE(stf.name, u.username, 'System Cashier') as cashier_name
       FROM fee_payments fp
       JOIN schools s ON fp.school_id = s.id
       JOIN students st ON fp.student_id = st.id
       JOIN fees f ON fp.fee_id = f.id
       LEFT JOIN users u ON fp.created_by = u.id
       LEFT JOIN staff stf ON u.id = stf.user_id
       WHERE fp.id = ?`,
      [paymentId]
    );

    const secretSalt = 'SCHOOLBASE-RECEIPT-SALT-' + schoolId;
    const sigPayload = `${receipt.id}|${receipt.amount_paid}|${receipt.reference}|${receipt.payment_date}|${receipt.student_id}`;
    receipt.authenticity_signature = crypto.createHmac('sha256', secretSalt).update(sigPayload).digest('hex');

    return res.status(201).json({ data: receipt });
  } catch (err) {
    console.error('Record payment error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to record fee payment.' } });
  }
});

// GET /schools/:schoolId/remote-payments
router.get('/schools/:schoolId/remote-payments', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    let parentKidFilter = '';
    const queryParams = [schoolId];

    if (req.user.role === 'parent') {
      const guardianRows = await query(
        `SELECT g.id FROM guardians g 
         WHERE g.user_id = ? 
            OR (g.email IS NOT NULL AND g.email != '' AND g.email = ?)
            OR (g.phone IS NOT NULL AND g.phone != '' AND g.phone = ?)`,
        [req.user.id, req.user.email || '', req.user.phone || '']
      );
      const guardianIds = guardianRows.map(g => g.id);
      if (guardianIds.length > 0) {
        const gPlaceholders = guardianIds.map(() => '?').join(',');
        const kids = await query(`SELECT student_id FROM student_guardians WHERE guardian_id IN (${gPlaceholders})`, guardianIds);
        const kidIds = [...new Set(kids.map(k => k.student_id))];
        if (kidIds.length > 0) {
          const kPlaceholders = kidIds.map(() => '?').join(',');
          parentKidFilter = ` AND rp.student_id IN (${kPlaceholders})`;
          queryParams.push(...kidIds);
        } else {
          return res.json({ data: [] });
        }
      } else {
        return res.json({ data: [] });
      }
    }

    const payments = await query(
      `SELECT rp.*, st.first_name, st.last_name, st.admission_number, c.name as class_name
       FROM remote_payments rp
       LEFT JOIN students st ON rp.student_id = st.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE rp.school_id = ? ${parentKidFilter}
       ORDER BY rp.created_at DESC`,
      queryParams
    );
    return res.json({ data: payments });
  } catch (err) {
    console.error('Fetch remote payments error:', err);
    return res.json({ data: [] });
  }
});

// POST /schools/:schoolId/remote-payments/:id/approve
router.post(['/schools/:schoolId/remote-payments/:id/approve', '/schools/:schoolId/remote-payments/:id/verify'], authenticateToken, requireRoles('bursar', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { notes } = req.body || {};

    const rp = await queryOne('SELECT * FROM remote_payments WHERE id = ? AND school_id = ?', [id, schoolId]);
    if (!rp) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Remote payment declaration record not found.' } });
    }

    try { await query('ALTER TABLE remote_payments ADD COLUMN verified_at DATETIME NULL'); } catch(e) {}
    try { await query('ALTER TABLE remote_payments ADD COLUMN verified_by VARCHAR(50) NULL'); } catch(e) {}
    try { await query('ALTER TABLE remote_payments ADD COLUMN notes TEXT NULL'); } catch(e) {}

    await query(
      `UPDATE remote_payments SET status = 'approved', notes = ?, verified_at = NOW(), verified_by = ? WHERE id = ? AND school_id = ?`,
      [notes || 'Declaration approved by cashier / administration', req.user?.id || null, id, schoolId]
    );

    // Credit student fee ledger
    let targetFeeId = rp.fee_id;
    if (!targetFeeId && rp.student_id) {
      const studentFee = await queryOne('SELECT id FROM fees WHERE student_id = ? AND school_id = ? ORDER BY created_at DESC LIMIT 1', [rp.student_id, schoolId]);
      targetFeeId = studentFee?.id || null;
      if (!targetFeeId) {
        targetFeeId = 'FEE-' + rp.student_id;
        await query(
          `INSERT INTO fees (id, school_id, student_id, term, year, amount_due, amount_paid, status, currency)
           VALUES (?, ?, ?, 'Term 1', YEAR(NOW()), 450.00, 0, 'unpaid', ?)`,
          [targetFeeId, schoolId, rp.student_id, rp.currency || 'USD']
        );
      }
    }

    if (targetFeeId) {
      const payId = 'PAY' + Date.now().toString(36).toUpperCase();
      const amountPaid = parseFloat(rp.amount || 0);
      try {
        await query(
          `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, payment_currency, reference, payment_date, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`,
          [payId, schoolId, targetFeeId, rp.student_id, amountPaid, rp.payment_method || 'bank_transfer', rp.currency || 'USD', rp.reference || id, req.user?.id || null]
        );
      } catch (insertErr) {
        await query(
          `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, payment_currency, reference, payment_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
          [payId, schoolId, targetFeeId, rp.student_id, amountPaid, rp.payment_method || 'bank_transfer', rp.currency || 'USD', rp.reference || id]
        );
      }

      await query(
        `UPDATE fees SET amount_paid = amount_paid + ?, status = CASE WHEN amount_paid + ? >= amount_due THEN 'cleared' ELSE 'partial' END WHERE id = ?`,
        [amountPaid, amountPaid, targetFeeId]
      );
    }

    broadcastInvalidation(schoolId, ['remote_payments', 'fees', 'fees_ledger', 'fees_summary', 'summary', 'top_debtors', 'dashboard'], 'payment_approved');

    return res.json({
      data: {
        id,
        status: 'approved',
        message: 'Payment approved and successfully credited to student ledger.'
      }
    });
  } catch (err) {
    console.error('Approve remote payment error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to approve remote payment.' } });
  }
});

// POST /schools/:schoolId/remote-payments/:id/reject
router.post('/schools/:schoolId/remote-payments/:id/reject', authenticateToken, requireRoles('bursar', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { schoolId, id } = req.params;
    const { notes, rejection_reason } = req.body || {};
    const reason = notes || rejection_reason || 'Proof of payment rejected.';

    try { await query('ALTER TABLE remote_payments ADD COLUMN verified_at DATETIME NULL'); } catch(e) {}
    try { await query('ALTER TABLE remote_payments ADD COLUMN verified_by VARCHAR(50) NULL'); } catch(e) {}
    try { await query('ALTER TABLE remote_payments ADD COLUMN notes TEXT NULL'); } catch(e) {}

    await query(
      `UPDATE remote_payments SET status = 'rejected', notes = ?, verified_at = NOW(), verified_by = ? WHERE id = ? AND school_id = ?`,
      [reason, req.user?.id || null, id, schoolId]
    );

    broadcastInvalidation(schoolId, ['remote_payments', 'fees_summary', 'summary', 'dashboard'], 'payment_rejected');

    return res.json({ data: { id, status: 'rejected', message: 'Remote payment declaration rejected.' } });
  } catch (err) {
    console.error('Reject remote payment error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to reject remote payment.' } });
  }
});

// GET /fee-payments/:paymentId/receipt
router.get('/fee-payments/:paymentId/receipt', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const receipt = await queryOne(
      `SELECT fp.*, s.name as school_name,
              st.first_name, st.last_name, st.admission_number,
              f.amount_due, f.amount_paid as total_fee_paid, f.term,
              COALESCE(stf.name, u.username, 'System Cashier') as cashier_name,
              g.email as parent_email, g.name as parent_name
       FROM fee_payments fp
       JOIN schools s ON fp.school_id = s.id
       JOIN students st ON fp.student_id = st.id
       JOIN fees f ON fp.fee_id = f.id
       LEFT JOIN users u ON fp.created_by = u.id
       LEFT JOIN staff stf ON u.id = stf.user_id
       LEFT JOIN student_guardians sg ON st.id = sg.student_id
       LEFT JOIN guardians g ON sg.guardian_id = g.id
       WHERE fp.id = ? OR fp.idempotency_key = ?`,
      [paymentId, paymentId]
    );

    if (!receipt) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payment transaction receipt not found.' } });
    }

    const secretSalt = 'SCHOOLBASE-RECEIPT-SALT-' + receipt.school_id;
    const sigPayload = `${receipt.id}|${receipt.amount_paid}|${receipt.reference}|${receipt.payment_date}|${receipt.student_id}`;
    receipt.authenticity_signature = crypto.createHmac('sha256', secretSalt).update(sigPayload).digest('hex');

    return res.json({ data: receipt });
  } catch (err) {
    console.error('Get receipt error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate receipt.' } });
  }
});

// GET /schools/:schoolId/fee-payments
router.get('/schools/:schoolId/fee-payments', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const payments = await query(
      `SELECT fp.*,
              st.first_name, st.last_name, st.admission_number,
              f.term as fee_title,
              c.name as class_name,
              COALESCE(stf.name, u.username, 'System') as cashier_name
       FROM fee_payments fp
       JOIN students st ON fp.student_id = st.id
       JOIN fees f ON fp.fee_id = f.id
       LEFT JOIN classes c ON st.class_id = c.id
       LEFT JOIN users u ON fp.created_by = u.id
       LEFT JOIN staff stf ON u.id = stf.user_id
       WHERE fp.school_id = ?
       ORDER BY fp.payment_date DESC, fp.created_at DESC`,
      [schoolId]
    );
    return res.json({ data: payments });
  } catch (err) {
    console.error('Get payments error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch payment history.' } });
  }
});

// POST /schools/:schoolId/fees/:feeId/pay-online
router.post('/schools/:schoolId/fees/:feeId/pay-online', authenticateToken, requireIdempotencyKey, idempotencyMiddleware, async (req, res) => {
  try {
    const { schoolId, feeId } = req.params;
    const { amount_paid, currency, method, idempotency_key } = req.body;

    const fee = await queryOne('SELECT * FROM fees WHERE id = ? AND school_id = ?', [feeId, schoolId]);
    if (!fee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fee record not found.' } });
    }

    const payAmount = parseFloat(amount_paid || 0);
    const paymentId = 'PAY' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const paymentDate = new Date().toISOString().slice(0, 10);
    const reference = 'PAY-ONLINE-' + Date.now().toString(36).toUpperCase();
    const gateway = await initializePayment({ provider: method, amount: payAmount, currency: currency || 'USD', reference, callbackUrl: `${process.env.PUBLIC_API_URL || ''}/api/v1/payments/webhooks/${method}` });

    try {
      await query(
        `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, requested_amount, payment_method, reference, notes, payment_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, schoolId, feeId, fee.student_id, 0, payAmount, method || 'online', reference, `Payment initiated (${currency || 'USD'})`, paymentDate, req.user.id]
      );
    } catch (e) {
      await query(
        `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, requested_amount, payment_method, reference, notes, payment_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, schoolId, feeId, fee.student_id, 0, payAmount, method || 'online', reference, `Payment initiated (${currency || 'USD'})`, paymentDate]
      );
    }

    return res.status(202).json({
      data: {
        id: paymentId,
        fee_id: feeId,
        amount_paid: payAmount,
        currency: currency || 'USD',
        reference: reference,
        status: gateway.status,
        gateway: gateway.gateway || null,
        message: gateway.message || 'Payment is awaiting gateway confirmation.'
      }
    });
  } catch (err) {
    console.error('Online payment error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Online payment failed.' } });
  }
});

// GET /schools/:schoolId/fees/export
router.get('/schools/:schoolId/fees/export', authenticateToken, requireRoles('school_admin', 'bursar', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const fees = await query(
      `SELECT f.*, st.first_name, st.last_name, st.admission_number, c.name as class_name
       FROM fees f
       JOIN students st ON f.student_id = st.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE f.school_id = ?
       ORDER BY st.first_name ASC`,
      [schoolId]
    );

    let csvContent = 'Admission Number,Student Name,Class,Fee Type,Term,Amount Due,Amount Paid,Balance,Status\n';
    fees.forEach(f => {
      const due = parseFloat(f.amount_due || 0);
      const paid = parseFloat(f.amount_paid || 0);
      const balance = Math.max(0, due - paid);
      csvContent += `"${f.admission_number || ''}","${f.first_name} ${f.last_name}","${f.class_name || ''}","${f.fee_type || 'Tuition'}","${f.term || ''}",${due},${paid},${balance},"${f.status}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=fees_${schoolId}.csv`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export fees error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to export fee records.' } });
  }
});

module.exports = router;

