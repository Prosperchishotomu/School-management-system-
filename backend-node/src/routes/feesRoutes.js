const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// GET /schools/:schoolId/fees
router.get('/schools/:schoolId/fees', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { class_id, term } = req.query;

    let sql = `
      SELECT f.*, c.name as class_name, st.first_name, st.last_name, st.admission_number
      FROM fees f
      JOIN students st ON f.student_id = st.id
      LEFT JOIN classes c ON st.class_id = c.id
      WHERE f.school_id = ?
    `;
    const params = [schoolId];

    if (class_id) {
      sql += ' AND st.class_id = ?';
      params.push(class_id);
    }
    if (term) {
      sql += ' AND f.term = ?';
      params.push(term);
    }

    sql += ' ORDER BY st.first_name ASC, f.created_at DESC';

    const fees = await query(sql, params);
    return res.json({ data: fees });
  } catch (err) {
    console.error('Get fees error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch fee ledgers.' } });
  }
});

// POST /schools/:schoolId/fees
router.post('/schools/:schoolId/fees', authenticateToken, requireRoles('school_admin', 'super_admin'), async (req, res) => {
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
      [feeId, schoolId, student_id, title.trim(), parseFloat(amount_due), term || 'Term 1', due_date || null]
    );

    const created = await queryOne('SELECT * FROM fees WHERE id = ?', [feeId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create fee error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create fee ledger.' } });
  }
});

// POST /schools/:schoolId/fees/:feeId/payments
router.post('/schools/:schoolId/fees/:feeId/payments', authenticateToken, requireRoles('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const { schoolId, feeId } = req.params;
    const { amount_paid, payment_method, reference, notes } = req.body;

    if (!amount_paid || parseFloat(amount_paid) <= 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid payment amount is required.' } });
    }

    const fee = await queryOne('SELECT * FROM fees WHERE id = ? AND school_id = ?', [feeId, schoolId]);
    if (!fee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fee record not found.' } });
    }

    const payAmount = parseFloat(amount_paid);
    const newPaid = parseFloat(fee.amount_paid || 0) + payAmount;
    const dueAmount = parseFloat(fee.amount_due || 0);

    let newStatus = 'unpaid';
    if (newPaid >= dueAmount) {
      newStatus = 'paid';
    } else if (newPaid > 0) {
      newStatus = 'partially_paid';
    }

    const paymentId = 'PAY' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const paymentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const idempotencyKey = (req.headers['idempotency-key'] || ('IDEM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6))).slice(0, 95);
    const userId = req.user && req.user.id ? req.user.id : null;

    try {
      await query(
        `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, reference, idempotency_key, payment_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, schoolId, feeId, fee.student_id, payAmount, payment_method || 'cash', reference || null, idempotencyKey, paymentDate, userId]
      );
    } catch (dbErr) {
      // Fallback without created_by if FK fails
      await query(
        `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, reference, idempotency_key, payment_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, schoolId, feeId, fee.student_id, payAmount, payment_method || 'cash', reference || null, idempotencyKey, paymentDate]
      );
    }

    await query(
      `UPDATE fees SET amount_paid = ?, status = ? WHERE id = ?`,
      [newPaid, newStatus, feeId]
    );

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
    const payments = await query(
      `SELECT fp.*, st.first_name, st.last_name, st.admission_number, c.name as class_name
       FROM fee_payments fp
       JOIN students st ON fp.student_id = st.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE fp.school_id = ? AND fp.payment_method IN ('mobile_money', 'bank_transfer', 'online')
       ORDER BY fp.payment_date DESC`,
      [schoolId]
    );
    return res.json({ data: payments });
  } catch (err) {
    return res.json({ data: [] });
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
router.post('/schools/:schoolId/fees/:feeId/pay-online', authenticateToken, async (req, res) => {
  try {
    const { schoolId, feeId } = req.params;
    const { amount_paid, currency, method, idempotency_key } = req.body;

    const fee = await queryOne('SELECT * FROM fees WHERE id = ? AND school_id = ?', [feeId, schoolId]);
    if (!fee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fee record not found.' } });
    }

    const payAmount = parseFloat(amount_paid || 0);
    const newPaid = parseFloat(fee.amount_paid || 0) + payAmount;
    const dueAmount = parseFloat(fee.amount_due || 0);

    let newStatus = 'unpaid';
    if (newPaid >= dueAmount) {
      newStatus = 'paid';
    } else if (newPaid > 0) {
      newStatus = 'partially_paid';
    }

    const paymentId = 'PAY' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const paymentDate = new Date().toISOString().slice(0, 10);
    const reference = 'PAY-ONLINE-' + Date.now().toString(36).toUpperCase();

    try {
      await query(
        `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, reference, notes, payment_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, schoolId, feeId, fee.student_id, payAmount, method || 'online', reference, `Online Payment (${currency || 'USD'})`, paymentDate, req.user.id]
      );
    } catch (e) {
      await query(
        `INSERT INTO fee_payments (id, school_id, fee_id, student_id, amount_paid, payment_method, reference, notes, payment_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, schoolId, feeId, fee.student_id, payAmount, method || 'online', reference, `Online Payment (${currency || 'USD'})`, paymentDate]
      );
    }

    await query(
      `UPDATE fees SET amount_paid = ?, status = ? WHERE id = ?`,
      [newPaid, newStatus, feeId]
    );

    return res.status(201).json({
      data: {
        id: paymentId,
        fee_id: feeId,
        amount_paid: payAmount,
        currency: currency || 'USD',
        reference: reference,
        status: 'success'
      }
    });
  } catch (err) {
    console.error('Online payment error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Online payment failed.' } });
  }
});

// GET /schools/:schoolId/fees/export
router.get('/schools/:schoolId/fees/export', authenticateToken, async (req, res) => {
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

