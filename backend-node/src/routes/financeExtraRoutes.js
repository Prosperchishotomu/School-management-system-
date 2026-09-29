const express = require('express');
const router = express.Router({ mergeParams: true });
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { requireIdempotencyKey, idempotencyMiddleware } = require('../utils/idempotency');
const { initializePayment, webhookSignature } = require('../services/payments');

// ─────────────────────────────────────────────────────────────────────────────
// CURRENCIES & EXCHANGE RATES (Zimbabwe Multi-currency System USD / ZiG / ZAR)
// ─────────────────────────────────────────────────────────────────────────────

// GET /finance/currencies
router.get('/finance/currencies', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const currencies = await query(
      'SELECT * FROM currencies WHERE school_id = ? OR school_id IS NULL ORDER BY is_base DESC, code ASC',
      [schoolId]
    );
    return res.json({ data: currencies });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch currencies.' } });
  }
});

// POST /finance/currencies
router.post('/finance/currencies', authenticateToken, requireRoles('bursar', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { code, name, symbol, is_base } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Currency code and name are required.' } });
    }

    if (is_base) {
      await query('UPDATE currencies SET is_base = FALSE WHERE school_id = ?', [schoolId]);
    }

    const result = await query(
      `INSERT INTO currencies (school_id, code, name, symbol, is_base) VALUES (?, ?, ?, ?, ?)`,
      [schoolId, code.toUpperCase().trim(), name.trim(), symbol || '$', is_base ? 1 : 0]
    );

    const created = await queryOne('SELECT * FROM currencies WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to add currency.' } });
  }
});

// GET /finance/exchange-rates
router.get('/finance/exchange-rates', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const rates = await query(
      `SELECT er.*, fc.code as from_code, tc.code as to_code
       FROM exchange_rates er
       JOIN currencies fc ON er.from_currency_id = fc.id
       JOIN currencies tc ON er.to_currency_id = tc.id
       WHERE er.school_id = ?
       ORDER BY er.effective_date DESC`,
      [schoolId]
    );
    return res.json({ data: rates });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch exchange rates.' } });
  }
});

// POST /finance/exchange-rates
router.post('/finance/exchange-rates', authenticateToken, requireRoles('bursar', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { from_currency_id, to_currency_id, rate, effective_date } = req.body;

    if (!from_currency_id || !to_currency_id || !rate) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'from_currency_id, to_currency_id, and rate are required.' } });
    }

    const result = await query(
      `INSERT INTO exchange_rates (school_id, from_currency_id, to_currency_id, rate, effective_date)
       VALUES (?, ?, ?, ?, ?)`,
      [schoolId, from_currency_id, to_currency_id, parseFloat(rate), effective_date || new Date().toISOString().slice(0, 10)]
    );

    const created = await queryOne('SELECT * FROM exchange_rates WHERE id = ?', [result.insertId]);
    return res.status(201).json({ data: created });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to record exchange rate.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE GENERATOR & BATCH BILLING
// ─────────────────────────────────────────────────────────────────────────────

// POST /fees/invoices/generate (Batch generate term invoices for class/school)
router.post('/fees/invoices/generate', authenticateToken, requireIdempotencyKey, idempotencyMiddleware, requireRoles('bursar', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { term_id, class_id, fee_structure_id, due_date } = req.body;

    if (!term_id || !fee_structure_id || !due_date) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'term_id, fee_structure_id, and due_date are required.' } });
    }

    // Fetch fee items for structure
    const feeItems = await query('SELECT * FROM fee_items WHERE fee_structure_id = ?', [fee_structure_id]);
    if (feeItems.length === 0) {
      return res.status(400).json({ error: { code: 'NO_FEE_ITEMS', message: 'The selected fee structure has no line items.' } });
    }

    let totalAmountUsd = feeItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    // Fetch students to invoice
    let studentSql = `SELECT st.id, st.admission_no FROM students st WHERE st.school_id = ? AND st.status = 'active'`;
    const params = [schoolId];
    if (class_id) {
      studentSql += ' AND st.class_id = ?';
      params.push(class_id);
    }

    const activeStudents = await query(studentSql, params);
    let invoiceCount = 0;

    for (const student of activeStudents) {
      const invUuid = 'INV' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      const invNo = 'INV-' + student.admission_no + '-' + Date.now().toString().slice(-4);

      // Create Invoice
      const invResult = await query(
        `INSERT INTO invoices (uuid, school_id, student_id, term_id, fee_structure_id, invoice_no, total_amount, balance_due, currency_code, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, 'unpaid')`,
        [invUuid, schoolId, student.id, term_id, fee_structure_id, invNo, totalAmountUsd, totalAmountUsd, due_date]
      );

      // Create Invoice Line Items
      for (const item of feeItems) {
        await query(
          `INSERT INTO invoice_items (invoice_id, description, amount, currency_code)
           VALUES (?, ?, ?, 'USD')`,
          [invResult.insertId, item.name, item.amount]
        );
      }
      invoiceCount++;
    }

    return res.status(201).json({
      data: {
        message: `Successfully generated ${invoiceCount} invoices.`,
        invoices_generated: invoiceCount,
        total_per_student: totalAmountUsd
      }
    });
  } catch (err) {
    console.error('Generate invoices error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to batch generate invoices.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT REVERSAL & RECEIPT PDF
// ─────────────────────────────────────────────────────────────────────────────

// POST /payments/:id/reverse (Requires Maker-Checker approval)
router.post('/payments/:id/reverse', authenticateToken, requireRoles('bursar', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Reason for payment reversal is required.' } });
    }

    let payment = null;
    try { payment = await queryOne('SELECT * FROM payments WHERE id = ? OR uuid = ?', [id, id]); } catch (_) {}
    if (!payment) {
      try { payment = await queryOne('SELECT * FROM fee_payments WHERE id = ? AND school_id = ?', [id, req.params.schoolId || req.user.school_id]); } catch (_) {}
    }
    if (!payment) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payment record not found.' } });

    if (payment.status === 'reversed') {
      return res.status(400).json({ error: { code: 'ALREADY_REVERSED', message: 'Payment has already been reversed.' } });
    }

    // Submit Maker-Checker Approval Request
    const approvalUuid = 'APP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(
      `INSERT INTO approvals (uuid, school_id, action, action_type, entity_type, entity_id, requested_by, payload, status)
       VALUES (?, ?, 'reverse', 'PAYMENT_REVERSAL', 'payments', ?, ?, ?, 'pending')`,
      [approvalUuid, payment.school_id, payment.id, req.user.id, JSON.stringify({ receipt_no: payment.receipt_no, amount: payment.amount, reason })]
    );

    return res.json({
      data: {
        message: 'Payment reversal submitted for dual-approval (Maker-Checker).',
        approval_id: approvalUuid
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to initiate payment reversal.' } });
  }
});

router.post('/fees/structures/:id/activate', authenticateToken, requireRoles('bursar', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const structure = await queryOne('SELECT id, status, school_id FROM fee_structures WHERE (id = ? OR uuid = ?) AND school_id = ?', [req.params.id, req.params.id, schoolId]);
    if (!structure) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fee structure not found.' } });
    if (structure.status === 'active') return res.status(409).json({ error: { code: 'ALREADY_ACTIVE', message: 'Fee structure is already active.' } });
    const approvalId = 'APP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(`INSERT INTO approvals (uuid, school_id, action, action_type, entity_type, entity_id, requested_by, payload, status) VALUES (?, ?, 'activate', 'FEE_STRUCTURE_ACTIVATION', 'fee_structures', ?, ?, ?, 'pending')`, [approvalId, schoolId, structure.id, req.user.id, JSON.stringify({ requested_status: 'active' })]);
    await query("UPDATE fee_structures SET status = 'pending_approval' WHERE id = ?", [structure.id]);
    return res.status(202).json({ data: { message: 'Fee structure submitted for activation approval.', approval_id: approvalId } });
  } catch (err) { return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to request fee structure activation.' } }); }
});

router.post('/fees/invoices/:id/void', authenticateToken, requireRoles('bursar', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const invoice = await queryOne('SELECT id, status FROM invoices WHERE (id = ? OR uuid = ?) AND school_id = ?', [req.params.id, req.params.id, schoolId]);
    if (!invoice) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invoice not found.' } });
    if (invoice.status === 'voided') return res.status(409).json({ error: { code: 'ALREADY_VOIDED', message: 'Invoice is already voided.' } });
    const approvalId = 'APP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    await query(`INSERT INTO approvals (uuid, school_id, action, action_type, entity_type, entity_id, requested_by, payload, status) VALUES (?, ?, 'void', 'INVOICE_VOID', 'invoices', ?, ?, ?, 'pending')`, [approvalId, schoolId, invoice.id, req.user.id, JSON.stringify({ reason: req.body?.reason || null })]);
    return res.status(202).json({ data: { message: 'Invoice submitted for void approval.', approval_id: approvalId } });
  } catch (err) { return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to request invoice voiding.' } }); }
});

router.post('/payments/webhooks/:provider', async (req, res) => {
  try {
    const signature = req.headers['x-payment-signature'];
    if (!signature || signature !== webhookSignature(req.body || {})) return res.status(401).json({ error: { code: 'INVALID_WEBHOOK', message: 'Payment webhook signature is invalid.' } });
    const { reference, status } = req.body || {};
    if (!reference || !['success', 'failed', 'pending'].includes(status)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'reference and valid status are required.' } });
    const payment = await queryOne('SELECT * FROM fee_payments WHERE reference = ?', [reference]);
    if (!payment) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payment reference not found.' } });
    const nextStatus = status === 'success' ? 'success' : status;
    await query('UPDATE fee_payments SET status = ?, amount_paid = CASE WHEN ? = \'success\' THEN COALESCE(amount_paid, 0) + ? ELSE amount_paid END WHERE reference = ?', [nextStatus, status, Number(payment.requested_amount || payment.amount_paid || 0), reference]);
    if (status === 'success') {
      const fee = await queryOne('SELECT amount_due, amount_paid FROM fees WHERE id = ?', [payment.fee_id]);
      if (fee) {
        const paid = Number(fee.amount_paid || 0) + Number(payment.requested_amount || payment.amount_paid || 0);
        await query('UPDATE fees SET amount_paid = ?, status = ? WHERE id = ?', [paid, paid >= Number(fee.amount_due || 0) ? 'paid' : 'partially_paid', payment.fee_id]);
      }
    }
    return res.json({ data: { accepted: true } });
  } catch (err) { return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Payment webhook processing failed.' } }); }
});

// GET /payments/:id/receipt/pdf (Download Official Digital Payment Receipt JSON/PDF)
router.get('/payments/:id/receipt/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await queryOne(
      `SELECT p.*, st.admission_no, st.first_name, st.last_name, s.name as school_name, s.address as school_address
       FROM payments p
       JOIN students st ON p.student_id = st.id
       LEFT JOIN schools s ON p.school_id = s.id
       WHERE p.id = ? OR p.uuid = ?`,
      [id, id]
    );

    if (!payment) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payment receipt not found.' } });

    return res.json({
      data: {
        receipt_no: payment.receipt_no,
        school_name: payment.school_name || 'SchoolBase Academy',
        school_address: payment.school_address || 'Harare, Zimbabwe',
        student_admission_no: payment.admission_no,
        student_name: `${payment.first_name} ${payment.last_name}`,
        amount_paid: payment.amount,
        currency: payment.currency_code || 'USD',
        payment_method: payment.payment_method,
        payment_date: payment.created_at,
        status: payment.status,
        issued_by: req.user.username
      }
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to generate receipt PDF.' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BANK STATEMENT RECONCILIATION
// ─────────────────────────────────────────────────────────────────────────────

// POST /finance/bank-statements/import
router.post('/finance/bank-statements/import', authenticateToken, requireRoles('bursar', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.schoolId || req.user.school_id;
    const { account_number, statement_date, transactions } = req.body; // transactions array

    if (!account_number || !Array.isArray(transactions)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'account_number and transactions array are required.' } });
    }

    const uuid = 'BS' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const stmtResult = await query(
      `INSERT INTO bank_statements (uuid, school_id, account_number, statement_date, total_lines, status)
       VALUES (?, ?, ?, ?, ?, 'imported')`,
      [uuid, schoolId, account_number, statement_date || new Date().toISOString().slice(0, 10), transactions.length]
    );

    let lineCount = 0;
    for (const tx of transactions) {
      await query(
        `INSERT INTO bank_statement_lines (statement_id, transaction_date, reference_no, description, amount, currency_code, status)
         VALUES (?, ?, ?, ?, ?, ?, 'unmatched')`,
        [stmtResult.insertId, tx.date, tx.reference_no, tx.description, parseFloat(tx.amount), tx.currency || 'USD']
      );
      lineCount++;
    }

    return res.status(201).json({
      data: {
        statement_id: uuid,
        total_imported: lineCount,
        message: `Imported ${lineCount} bank statement line items for reconciliation.`
      }
    });
  } catch (err) {
    console.error('Import bank statement error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to import bank statement.' } });
  }
});

module.exports = router;
