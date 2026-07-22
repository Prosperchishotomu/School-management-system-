<?php
// Route handlers for Paynow, EcoCash & Remote Fee Payments

/**
 * Helper to generate random unique payment references
 */
function generatePaymentRef() {
    return 'PAY-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
}

// ── POST /payments/initiate (Initiate online fee payment) ─────────────────────
$router->post('/payments/initiate', function() {
    $user = Auth::getCurrentUser();
    $data = getJsonInput();

    $studentId    = trim($data['student_id'] ?? '');
    $amount       = (float)($data['amount'] ?? 0);
    $paymentMethod= trim($data['payment_method'] ?? 'mobile_money');
    $phoneNumber  = trim($data['phone_number'] ?? '');
    $term         = trim($data['term'] ?? Database::getCurrentTerm($user['school_id']));

    if (empty($studentId) || $amount <= 0) {
        Auth::sendResponse(null, ["code" => "INVALID_INPUT", "message" => "Student ID and positive amount required."], 400);
    }

    $db = Database::getConnection();

    // Verify student exists and belongs to school
    $stmtSt = $db->prepare("SELECT s.id, s.school_id, s.first_name, s.last_name, g.id as guardian_id, g.phone as guardian_phone
                            FROM students s
                            LEFT JOIN student_guardians sg ON s.id = sg.student_id
                            LEFT JOIN guardians g ON sg.guardian_id = g.id
                            WHERE s.id = ? AND s.school_id = ? LIMIT 1");
    $stmtSt->execute([$studentId, $user['school_id']]);
    $student = $stmtSt->fetch();

    if (!$student) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Student not found in your school."], 404);
    }

    $guardianId = $student['guardian_id'] ?: 'GDN00000';
    $paymentId  = Database::generateId('RPM');
    $reference  = generatePaymentRef();

    // Store in remote_payments
    $stmtIns = $db->prepare("INSERT INTO remote_payments (id, school_id, student_id, guardian_id, amount, payment_date, payment_method, reference, status)
                             VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, 'pending')");
    $stmtIns->execute([
        $paymentId,
        $user['school_id'],
        $studentId,
        $guardianId,
        $amount,
        $paymentMethod === 'ecocash' ? 'mobile_money' : 'bank_transfer',
        $reference
    ]);

    // Construct Paynow Pay URL / Simulated Sandbox USSD Push
    $paynowId  = getenv('PAYNOW_INTEGRATION_ID') ?: 'SANDBOX_ID';
    $redirectUrl = "/checkout/paynow?ref=" . urlencode($reference) . "&amount=" . urlencode($amount);

    Auth::sendResponse([
        "payment_id"       => $paymentId,
        "reference"        => $reference,
        "amount"           => $amount,
        "status"           => "pending",
        "paynow_url"       => $redirectUrl,
        "instructions"     => "Please approve the USSD payment prompt sent to " . ($phoneNumber ?: $student['guardian_phone'] ?: 'your phone') . " or complete payment via Paynow."
    ], null, 201);
});

// ── GET /payments/status/{reference} (Check payment status) ───────────────────
$router->get('/payments/status/{reference}', function($reference) {
    $user = Auth::getCurrentUser();
    $db = Database::getConnection();

    $stmt = $db->prepare("SELECT rp.*, s.first_name, s.last_name
                          FROM remote_payments rp
                          JOIN students s ON rp.student_id = s.id
                          WHERE rp.reference = ? AND rp.school_id = ? LIMIT 1");
    $stmt->execute([$reference, $user['school_id']]);
    $payment = $stmt->fetch();

    if (!$payment) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Payment reference not found."], 404);
    }

    Auth::sendResponse($payment);
});

// ── POST /payments/webhook (Paynow / EcoCash IPN Callback) ───────────────────
$router->post('/payments/webhook', function() {
    $data = $_POST;
    if (empty($data)) {
        $data = getJsonInput();
    }

    $reference = trim($data['reference'] ?? $data['paynowreference'] ?? '');
    $status    = strtolower(trim($data['status'] ?? ''));

    if (empty($reference)) {
        Auth::sendResponse(null, ["code" => "BAD_REQUEST", "message" => "Missing payment reference."], 400);
    }

    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM remote_payments WHERE reference = ? LIMIT 1");
    $stmt->execute([$reference]);
    $payment = $stmt->fetch();

    if (!$payment) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Transaction reference not found."], 404);
    }

    if ($payment['status'] === 'approved') {
        Auth::sendResponse(["message" => "Payment already processed."]);
    }

    if (in_array($status, ['paid', 'completed', 'approved', 'ok'])) {
        $db->beginTransaction();
        try {
            // Update remote payment status
            $stmtUpd = $db->prepare("UPDATE remote_payments SET status = 'approved', updated_at = NOW() WHERE id = ?");
            $stmtUpd->execute([$payment['id']]);

            // Add record to fee_payments
            $payId = Database::generateId('PAY');
            $term  = Database::getCurrentTerm($payment['school_id']);
            $stmtPay = $db->prepare("INSERT INTO fee_payments (id, school_id, student_id, amount_paid, payment_date, payment_method, reference, term, cashier_id)
                                     VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, NULL)");
            $stmtPay->execute([
                $payId,
                $payment['school_id'],
                $payment['student_id'],
                $payment['amount'],
                $payment['payment_method'],
                $payment['reference'],
                $term
            ]);

            // Update student fee balance in fees table
            $stmtFee = $db->prepare("UPDATE fees SET amount_paid = amount_paid + ?, balance = balance - ?, updated_at = NOW() WHERE student_id = ? AND term = ?");
            $stmtFee->execute([$payment['amount'], $payment['amount'], $payment['student_id'], $term]);

            $db->commit();

            Auth::sendResponse([
                "status"   => "success",
                "message"  => "Payment approved and fee balance updated successfully.",
                "receipt"  => $payId
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            Auth::sendResponse(null, ["code" => "SERVER_ERROR", "message" => "Failed to update ledger: " . $e->getMessage()], 500);
        }
    } else {
        // Payment failed or rejected
        $stmtRej = $db->prepare("UPDATE remote_payments SET status = 'rejected', rejection_reason = ? WHERE id = ?");
        $stmtRej->execute(['Gateway notification reported status: ' . $status, $payment['id']]);

        Auth::sendResponse(["status" => "rejected", "message" => "Payment transaction marked as rejected."]);
    }
});

// ── GET /payments/remote (List all remote payment submissions) ───────────────
$router->get('/payments/remote', function() {
    $user = Auth::getCurrentUser();
    Auth::requireRole(['school_admin', 'super_admin']);

    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT rp.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, s.admission_number, c.name as class_name
                          FROM remote_payments rp
                          JOIN students s ON rp.student_id = s.id
                          LEFT JOIN classes c ON s.class_id = c.id
                          WHERE rp.school_id = ?
                          ORDER BY rp.created_at DESC");
    $stmt->execute([$user['school_id']]);
    $payments = $stmt->fetchAll();

    Auth::sendResponse($payments);
});

// ── POST /payments/remote/{id}/approve (Manual admin approval) ───────────────
$router->post('/payments/remote/{id}/approve', function($id) {
    $user = Auth::getCurrentUser();
    Auth::requireRole(['school_admin', 'super_admin']);

    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM remote_payments WHERE id = ? AND school_id = ? LIMIT 1");
    $stmt->execute([$id, $user['school_id']]);
    $payment = $stmt->fetch();

    if (!$payment) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Payment record not found."], 404);
    }

    if ($payment['status'] === 'approved') {
        Auth::sendResponse(null, ["code" => "ALREADY_APPROVED", "message" => "Payment is already approved."], 400);
    }

    $db->beginTransaction();
    try {
        $stmtUpd = $db->prepare("UPDATE remote_payments SET status = 'approved', updated_at = NOW() WHERE id = ?");
        $stmtUpd->execute([$id]);

        $payId = Database::generateId('PAY');
        $term  = Database::getCurrentTerm($payment['school_id']);
        $stmtPay = $db->prepare("INSERT INTO fee_payments (id, school_id, student_id, amount_paid, payment_date, payment_method, reference, term, cashier_id)
                                 VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?)");
        $stmtPay->execute([
            $payId,
            $payment['school_id'],
            $payment['student_id'],
            $payment['amount'],
            $payment['payment_method'],
            $payment['reference'],
            $term,
            $user['id']
        ]);

        $stmtFee = $db->prepare("UPDATE fees SET amount_paid = amount_paid + ?, balance = balance - ?, updated_at = NOW() WHERE student_id = ? AND term = ?");
        $stmtFee->execute([$payment['amount'], $payment['amount'], $payment['student_id'], $term]);

        $db->commit();
        Auth::sendResponse(["message" => "Payment manually approved and student fee balance updated."]);
    } catch (Exception $e) {
        $db->rollBack();
        Auth::sendResponse(null, ["code" => "SERVER_ERROR", "message" => $e->getMessage()], 500);
    }
});
