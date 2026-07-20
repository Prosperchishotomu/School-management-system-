<?php

$router->get('/schools/{schoolId}/fees', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db      = Database::getConnection();
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, (int)($_GET['per_page'] ?? 25));
    $offset  = ($page - 1) * $perPage;
    $status  = trim($_GET['status'] ?? '');
    $search  = trim($_GET['search'] ?? '');

    $conditions = ["f.school_id = ?"];
    $params     = [$schoolId];

    if ($user['role'] === 'parent') {
        $stmtG = $db->prepare("SELECT id FROM guardians WHERE user_id=? AND school_id=? LIMIT 1");
        $stmtG->execute([$user['id'], $schoolId]);
        $guardian = $stmtG->fetch();
        if ($guardian) {
            $stmtC = $db->prepare("SELECT student_id FROM student_guardians WHERE guardian_id=?");
            $stmtC->execute([$guardian['id']]);
            $childIds = array_column($stmtC->fetchAll(), 'student_id');
            if (!empty($childIds)) {
                $placeholders  = implode(',', array_fill(0, count($childIds), '?'));
                $conditions[] = "f.student_id IN ($placeholders)";
                foreach ($childIds as $cid) { $params[] = $cid; }
            } else {
                Auth::sendResponse([], null, 200, ["page" => 1, "per_page" => $perPage, "total" => 0]);
            }
        } else {
            Auth::sendResponse([], null, 200, ["page" => 1, "per_page" => $perPage, "total" => 0]);
        }
    }

    if (!empty($status)) { $conditions[] = "f.status = ?"; $params[] = $status; }
    if (!empty($search)) {
        $conditions[] = "(s.first_name LIKE ? OR s.last_name LIKE ?)";
        $params[] = "%{$search}%"; $params[] = "%{$search}%";
    }

    $where      = implode(" AND ", $conditions);
    $stmtCount  = $db->prepare("SELECT COUNT(*) FROM fees f JOIN students s ON f.student_id=s.id WHERE {$where}");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $sql = "SELECT f.*, s.first_name as student_first_name, s.last_name as student_last_name, s.id as student_id, s.credit_balance as student_credit_balance
            FROM fees f JOIN students s ON f.student_id=s.id WHERE {$where} ORDER BY f.status ASC, s.last_name ASC LIMIT ? OFFSET ?";
    $stmtData = $db->prepare($sql);
    $i = 1;
    foreach ($params as $p) { $stmtData->bindValue($i++, $p); }
    $stmtData->bindValue($i++, $perPage, PDO::PARAM_INT);
    $stmtData->bindValue($i++, $offset,  PDO::PARAM_INT);
    $stmtData->execute();
    Auth::sendResponse($stmtData->fetchAll(), null, 200, ["page" => $page, "per_page" => $perPage, "total" => $total]);
});

// GET /schools/{schoolId}/fees/export — CSV
$router->get('/schools/{schoolId}/fees/export', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT s.admission_number, CONCAT(s.first_name,' ',s.last_name) as student_name,
                                 c.name as class_name, f.term, f.amount_due, f.amount_paid,
                                 ROUND(f.amount_due - f.amount_paid, 2) as balance, f.status
                          FROM fees f
                          JOIN students s ON f.student_id=s.id
                          LEFT JOIN classes c ON s.class_id=c.id
                          WHERE f.school_id=? ORDER BY f.status ASC, s.last_name ASC");
    $stmt->execute([$schoolId]);
    $rows = $stmt->fetchAll();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="fees_' . $schoolId . '_' . date('Ymd') . '.csv"');
    header('X-API-Version: v1');

    $output = fopen('php://output', 'w');
    fputcsv($output, ['Admission No', 'Student Name', 'Class', 'Term', 'Amount Due', 'Amount Paid', 'Balance', 'Status']);
    foreach ($rows as $row) { fputcsv($output, array_values($row)); }
    fclose($output);
    Auth::logAction($schoolId, $user['id'], 'FEES_EXPORTED', 'fees', null, "Exported fees ledger to CSV");
    exit;
});

// GET /schools/{schoolId}/fees/{feeId}/payments
$router->get('/schools/{schoolId}/fees/{feeId}/payments', function($schoolId, $feeId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT fp.*, COALESCE(stf.name, u.username) as recorded_by 
                          FROM fee_payments fp 
                          LEFT JOIN users u ON fp.created_by=u.id 
                          LEFT JOIN staff stf ON u.id = stf.user_id 
                          WHERE fp.fee_id=? AND fp.school_id=? 
                          ORDER BY fp.payment_date DESC");
    $stmt->execute([$feeId, $schoolId]);
    Auth::sendResponse($stmt->fetchAll());
});

// POST /schools/{schoolId}/fees/{feeId}/payments
$router->post('/schools/{schoolId}/fees/{feeId}/payments', function($schoolId, $feeId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['amount_paid']) || (float)$input['amount_paid'] <= 0) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "amount_paid must be a positive number."], 400);
    }

    $db = Database::getConnection();
    $stmtFee = $db->prepare("SELECT * FROM fees WHERE id=? AND school_id=?");
    $stmtFee->execute([$feeId, $schoolId]);
    $fee = $stmtFee->fetch();
    if (!$fee) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Fee record not found."], 404);
    }

    // Idempotency key to prevent duplicate payments
    $idempotencyKey = $input['idempotency_key'] ?? bin2hex(random_bytes(8));
    $checkDup = $db->prepare("SELECT id FROM fee_payments WHERE idempotency_key=?");
    $checkDup->execute([$idempotencyKey]);
    if ($checkDup->fetch()) {
        Auth::sendResponse(null, ["code" => "DUPLICATE_PAYMENT", "message" => "This payment has already been recorded (duplicate idempotency key)."], 409);
    }

    $db->beginTransaction();
    try {
        $paymentId   = Database::generateUniqueId('fee_payments');
        $amountPaid  = (float)$input['amount_paid'];
        $paymentDate = $input['payment_date'] ?? date('Y-m-d H:i:s');
        Auth::validateDate(substr($paymentDate, 0, 10), 'payment_date');

        $paymentMethod = $input['payment_method'] ?? 'cash';
        if (!in_array($paymentMethod, ['cash', 'bank_transfer', 'mobile_money'])) {
            $db->rollBack();
            Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "payment_method must be one of: cash, bank_transfer, mobile_money."], 400);
        }

        $currency = $input['payment_currency'] ?? 'USD';
        $exchangeRate = isset($input['exchange_rate']) ? (float)$input['exchange_rate'] : 1.0000;
        if ($exchangeRate <= 0) $exchangeRate = 1.0000;
        $amountInPaymentCurrency = isset($input['amount_in_payment_currency']) ? (float)$input['amount_in_payment_currency'] : $amountPaid;

        $stmtPay = $db->prepare("INSERT INTO fee_payments (id, school_id, student_id, fee_id, amount_paid, payment_date, reference, payment_method, payment_currency, exchange_rate, amount_in_payment_currency, idempotency_key, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmtPay->execute([$paymentId, $schoolId, $fee['student_id'], $feeId, $amountPaid, $paymentDate, $input['reference'] ?? null, $paymentMethod, $currency, $exchangeRate, $amountInPaymentCurrency, $idempotencyKey, $user['id']]);

        $newPaid = (float)$fee['amount_paid'] + $amountPaid;
        $newStatus = 'partial';
        $surplus = 0.0;
        if ($newPaid >= (float)$fee['amount_due']) {
            $newStatus = 'cleared';
            $surplus = $newPaid - (float)$fee['amount_due'];
            $newPaid = (float)$fee['amount_due'];
        }

        $db->prepare("UPDATE fees SET amount_paid=?, status=? WHERE id=?")->execute([$newPaid, $newStatus, $feeId]);

        if ($surplus > 0) {
            $db->prepare("UPDATE students SET credit_balance = credit_balance + ? WHERE id=?")->execute([$surplus, $fee['student_id']]);
            Auth::logAction($schoolId, $user['id'], 'CREDIT_ADDED', 'students', $fee['student_id'], "Carried forward credit surplus of {$surplus} to student {$fee['student_id']}");
        }

        // Notify linked guardians
        $stmtGuardians = $db->prepare("SELECT g.user_id, s.first_name FROM guardians g JOIN student_guardians sg ON g.id = sg.guardian_id JOIN students s ON s.id = sg.student_id WHERE sg.student_id=?");
        $stmtGuardians->execute([$fee['student_id']]);
        $guardians = $stmtGuardians->fetchAll();
        foreach ($guardians as $g) {
            if ($g['user_id']) {
                $notificationMsg = "Payment of $" . number_format($amountPaid, 2) . " has been successfully recorded for " . $g['first_name'] . ". Term Fee Status: " . strtoupper($newStatus);
                if ($surplus > 0) {
                    $notificationMsg .= ". A credit of $" . number_format($surplus, 2) . " has been carried forward to future terms.";
                }
                Auth::sendNotification($schoolId, $g['user_id'], "Tuition Payment Confirmed", $notificationMsg);
            }
        }

        Auth::logAction($schoolId, $user['id'], 'PAYMENT_ADDED', 'fee_payments', $paymentId, "Recorded payment of {$amountPaid} for fee #{$feeId}");
        $db->commit();
        Auth::sendResponse(["id" => $paymentId, "new_status" => $newStatus, "total_paid" => $newPaid, "surplus" => $surplus], null, 201);
    } catch (Exception $e) {
        $db->rollBack();
        error_log("Payment recording failed: " . $e->getMessage());
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Failed to record payment."], 500);
    }
});

// GET /schools/{schoolId}/fees/dashboard
$router->get('/schools/{schoolId}/fees/dashboard', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db          = Database::getConnection();
    $currentTerm = Database::getCurrentTerm($schoolId);

    $stmt = $db->prepare("SELECT
        COUNT(*) as total_students,
        SUM(amount_due) as total_due,
        SUM(amount_paid) as total_paid,
        COUNT(CASE WHEN status='cleared' THEN 1 END) as cleared_count,
        COUNT(CASE WHEN status='partial' THEN 1 END) as partial_count,
        COUNT(CASE WHEN status='unpaid' THEN 1 END) as unpaid_count
        FROM fees WHERE school_id=? AND term=?");
    $stmt->execute([$schoolId, $currentTerm]);
    $summary = $stmt->fetch();
    $summary['current_term']      = $currentTerm;
    $summary['collection_percent'] = $summary['total_due'] > 0 ? round(($summary['total_paid'] / $summary['total_due']) * 100, 1) : 0;
    Auth::sendResponse($summary);
});

// PUT /schools/{schoolId}/bank-account
$router->put('/schools/{schoolId}/bank-account', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $db    = Database::getConnection();
    
    $stmt = $db->prepare("UPDATE schools SET bank_name=?, account_number=?, account_name=?, payment_instructions=? WHERE id=?");
    $stmt->execute([
        $input['bank_name'] ?? null,
        $input['account_number'] ?? null,
        $input['account_name'] ?? null,
        $input['payment_instructions'] ?? null,
        $schoolId
    ]);
    
    Auth::logAction($schoolId, $user['id'], 'BANK_DETAILS_UPDATED', 'schools', $schoolId, "Updated banking settings for school {$schoolId}");
    Auth::sendResponse(["success" => true]);
});

// GET /schools/{schoolId}/remote-payments
$router->get('/schools/{schoolId}/remote-payments', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db = Database::getConnection();
    
    if ($user['role'] === 'parent') {
        $stmtG = $db->prepare("SELECT id FROM guardians WHERE user_id=? AND school_id=?");
        $stmtG->execute([$user['id'], $schoolId]);
        $g = $stmtG->fetch();
        if (!$g) {
            Auth::sendResponse([]);
        }
        $stmt = $db->prepare("SELECT rp.*, s.first_name, s.last_name, fp.id as fee_payment_id
                              FROM remote_payments rp 
                              JOIN students s ON rp.student_id = s.id 
                              LEFT JOIN fee_payments fp ON fp.idempotency_key = CONCAT('RP-', rp.id)
                              WHERE rp.guardian_id=? AND rp.school_id=? 
                              ORDER BY rp.created_at DESC");
        $stmt->execute([$g['id'], $schoolId]);
    } else {
        $stmt = $db->prepare("SELECT rp.*, s.first_name, s.last_name, g.name as parent_name, g.phone as parent_phone, fp.id as fee_payment_id
                              FROM remote_payments rp 
                              JOIN students s ON rp.student_id = s.id 
                              JOIN guardians g ON rp.guardian_id = g.id 
                              LEFT JOIN fee_payments fp ON fp.idempotency_key = CONCAT('RP-', rp.id)
                              WHERE rp.school_id=? 
                              ORDER BY rp.created_at DESC");
        $stmt->execute([$schoolId]);
    }
    Auth::sendResponse($stmt->fetchAll());
});

// POST /schools/{schoolId}/remote-payments
$router->post('/schools/{schoolId}/remote-payments', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['parent']);
    if ($user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['amount']) || empty($input['reference']) || empty($input['student_id']) || empty($input['payment_method'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "amount, reference, student_id, and payment_method are required."], 400);
    }
    
    $db = Database::getConnection();
    
    $checkRef = $db->prepare("SELECT id FROM remote_payments WHERE reference=?");
    $checkRef->execute([$input['reference']]);
    if ($checkRef->fetch()) {
        Auth::sendResponse(null, ["code" => "DUPLICATE_REFERENCE", "message" => "This reference code has already been declared."], 409);
    }

    $stmtG = $db->prepare("SELECT id FROM guardians WHERE user_id=? AND school_id=?");
    $stmtG->execute([$user['id'], $schoolId]);
    $g = $stmtG->fetch();
    if (!$g) {
        Auth::sendResponse(null, ["code" => "ACCESS_DENIED", "message" => "No linked guardian record found for your user login."], 403);
    }

    $rpId = Database::generateUniqueId('remote_payments');
    $stmt = $db->prepare("INSERT INTO remote_payments (id, school_id, student_id, guardian_id, amount, payment_date, payment_method, reference, status) VALUES (?,?,?,?,?,?,?,?, 'pending')");
    $stmt->execute([
        $rpId,
        $schoolId,
        $input['student_id'],
        $g['id'],
        $input['amount'],
        $input['payment_date'] ?? date('Y-m-d'),
        $input['payment_method'],
        $input['reference']
    ]);

    $stmtAdmins = $db->prepare("SELECT id FROM users WHERE school_id=? AND role='school_admin'");
    $stmtAdmins->execute([$schoolId]);
    $admins = $stmtAdmins->fetchAll();
    foreach ($admins as $admin) {
        Auth::sendNotification($schoolId, $admin['id'], "New Remote Payment Received", "A parent has declared a payment of $" . number_format($input['amount'], 2) . " with reference " . $input['reference'] . ". Verification required.");
    }

    Auth::logAction($schoolId, $user['id'], 'REMOTE_PAYMENT_DECLARED', 'remote_payments', $rpId, "Parent declared remote payment of {$input['amount']} with ref {$input['reference']}");
    Auth::sendResponse(["id" => $rpId], null, 201);
});

// POST /schools/{schoolId}/remote-payments/{id}/verify
$router->post('/schools/{schoolId}/remote-payments/{id}/verify', function($schoolId, $id) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $status = $input['status'] ?? '';
    if (!in_array($status, ['approved', 'rejected'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "status must be 'approved' or 'rejected'."], 400);
    }
    
    $db = Database::getConnection();
    
    $stmtRp = $db->prepare("SELECT rp.*, g.user_id as guardian_user_id FROM remote_payments rp JOIN guardians g ON rp.guardian_id = g.id WHERE rp.id=? AND rp.school_id=?");
    $stmtRp->execute([$id, $schoolId]);
    $rp = $stmtRp->fetch();
    if (!$rp) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Remote payment declaration not found."], 404);
    }
    if ($rp['status'] !== 'pending') {
        Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "This remote payment has already been verified (Status: {$rp['status']})."], 409);
    }

    $db->beginTransaction();
    try {
        if ($status === 'rejected') {
            $reason = $input['rejection_reason'] ?? 'Reference not found in bank statements.';
            $db->prepare("UPDATE remote_payments SET status='rejected', rejection_reason=? WHERE id=?")->execute([$reason, $id]);
            
            if ($rp['guardian_user_id']) {
                Auth::sendNotification($schoolId, $rp['guardian_user_id'], "Payment Declaration Rejected", "Your payment declaration of $" . number_format($rp['amount'], 2) . " (Ref: " . $rp['reference'] . ") was rejected: " . $reason);
            }
            Auth::logAction($schoolId, $user['id'], 'REMOTE_PAYMENT_REJECTED', 'remote_payments', $id, "Rejected remote payment: {$reason}");
            $db->commit();
            Auth::sendResponse(["status" => "rejected"]);
        } else {
            $currentTerm = Database::getCurrentTerm($schoolId);
            $stmtFee = $db->prepare("SELECT id, amount_due, amount_paid FROM fees WHERE student_id=? AND term=? AND school_id=?");
            $stmtFee->execute([$rp['student_id'], $currentTerm, $schoolId]);
            $fee = $stmtFee->fetch();
            
            if (!$fee) {
                $feeId = Database::generateUniqueId('fees');
                $tuitionBenchmark = (float)$db->query("SELECT tuition_fee_benchmark FROM schools WHERE id='$schoolId'")->fetchColumn();
                $db->prepare("INSERT INTO fees (id, school_id, student_id, term, amount_due, amount_paid, status) VALUES (?,?,?,?,?, 0.00, 'unpaid')")
                   ->execute([$feeId, $schoolId, $rp['student_id'], $currentTerm, $tuitionBenchmark]);
                $fee = ["id" => $feeId, "amount_due" => $tuitionBenchmark, "amount_paid" => 0.00];
            }

            $amountPaid = (float)$rp['amount'];
            $newPaid = (float)$fee['amount_paid'] + $amountPaid;
            $newStatus = 'partial';
            $surplus = 0.0;
            if ($newPaid >= (float)$fee['amount_due']) {
                $newStatus = 'cleared';
                $surplus = $newPaid - (float)$fee['amount_due'];
                $newPaid = (float)$fee['amount_due'];
            }

            $paymentId = Database::generateUniqueId('fee_payments');
            $idempotencyKey = "RP-" . $id;
            
            $stmtPay = $db->prepare("INSERT INTO fee_payments (id, school_id, student_id, fee_id, amount_paid, payment_date, reference, payment_method, idempotency_key, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)");
            $stmtPay->execute([$paymentId, $schoolId, $rp['student_id'], $fee['id'], $amountPaid, $rp['payment_date'], $rp['reference'], $rp['payment_method'], $idempotencyKey, $user['id']]);

            $db->prepare("UPDATE fees SET amount_paid=?, status=? WHERE id=?")->execute([$newPaid, $newStatus, $fee['id']]);

            if ($surplus > 0) {
                $db->prepare("UPDATE students SET credit_balance = credit_balance + ? WHERE id=?")->execute([$surplus, $rp['student_id']]);
                Auth::logAction($schoolId, $user['id'], 'CREDIT_ADDED', 'students', $rp['student_id'], "Carried forward credit surplus of {$surplus} from approved remote payment");
            }

            $db->prepare("UPDATE remote_payments SET status='approved' WHERE id=?")->execute([$id]);

            if ($rp['guardian_user_id']) {
                $notificationMsg = "Remote payment of $" . number_format($amountPaid, 2) . " (Ref: " . $rp['reference'] . ") was verified and approved. New balance status: " . strtoupper($newStatus);
                if ($surplus > 0) {
                    $notificationMsg .= ". surplus credit of $" . number_format($surplus, 2) . " was carried forward.";
                }
                Auth::sendNotification($schoolId, $rp['guardian_user_id'], "Remote Payment Verified", $notificationMsg);
            }

            Auth::logAction($schoolId, $user['id'], 'REMOTE_PAYMENT_APPROVED', 'remote_payments', $id, "Approved remote payment Ref: {$rp['reference']} for student {$rp['student_id']}");
            $db->commit();
            Auth::sendResponse(["status" => "approved", "payment_id" => $paymentId]);
        }
    } catch (Exception $e) {
        $db->rollBack();
        error_log("Remote verification failed: " . $e->getMessage());
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Failed to verify remote payment: " . $e->getMessage()], 500);
    }
});

// GET /fee-payments/{paymentId}/receipt
$router->get('/fee-payments/{paymentId}/receipt', function($paymentId) {
    $user = Auth::requireAuth();
    $db   = Database::getConnection();

    $stmt = $db->prepare("SELECT fp.*, s.name as school_name, s.bank_name, s.account_number, st.first_name, st.last_name, st.admission_number, st.credit_balance,
                                 f.amount_due, f.amount_paid as total_fee_paid, f.term,
                                 COALESCE(stf.name, u.username) as cashier_name
                          FROM fee_payments fp
                          JOIN schools s ON fp.school_id = s.id
                          JOIN students st ON fp.student_id = st.id
                          JOIN fees f ON fp.fee_id = f.id
                          JOIN users u ON fp.created_by = u.id
                          LEFT JOIN staff stf ON u.id = stf.user_id
                          WHERE fp.id=? OR fp.idempotency_key=?");
    $stmt->execute([$paymentId, $paymentId]);
    $payment = $stmt->fetch();
    
    if (!$payment) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Payment transaction record not found."], 404);
    }

    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $payment['school_id']) {
        Auth::sendResponse(null, ["code" => "ACCESS_DENIED", "message" => "Access denied to transaction history."], 403);
    }

    $secretSalt = "SCHOOLBASE-RECEIPT-SALT-" . $payment['school_id'];
    $signaturePayload = $payment['id'] . '|' . $payment['amount_paid'] . '|' . $payment['reference'] . '|' . $payment['payment_date'] . '|' . $payment['student_id'];
    $authSignature = hash_hmac('sha256', $signaturePayload, $secretSalt);

    $payment['authenticity_signature'] = $authSignature;

    Auth::sendResponse($payment);
});

// POST /schools/{schoolId}/fees/{feeId}/pay-online
$router->post('/schools/{schoolId}/fees/{feeId}/pay-online', function($schoolId, $feeId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['parent']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['amount_paid']) || (float)$input['amount_paid'] <= 0) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "amount_paid must be a positive number."], 400);
    }
    if (empty($input['method'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "method (ecocash/paynow/innbucks/etc) is required."], 400);
    }

    $db = Database::getConnection();
    
    // Check if this student belongs to parent
    $stmtFee = $db->prepare("SELECT * FROM fees WHERE id=? AND school_id=?");
    $stmtFee->execute([$feeId, $schoolId]);
    $fee = $stmtFee->fetch();
    if (!$fee) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Fee record not found."], 404);
    }

    $stmtG = $db->prepare("SELECT id FROM guardians WHERE user_id=? AND school_id=? LIMIT 1");
    $stmtG->execute([$user['id'], $schoolId]);
    $g = $stmtG->fetch();
    if (!$g) {
        Auth::sendResponse(null, ["code" => "FORBIDDEN", "message" => "Guardian record not found."], 403);
    }

    $stmtLink = $db->prepare("SELECT relation FROM student_guardians WHERE student_id=? AND guardian_id=?");
    $stmtLink->execute([$fee['student_id'], $g['id']]);
    if (!$stmtLink->fetch()) {
        Auth::sendResponse(null, ["code" => "FORBIDDEN", "message" => "This pupil does not belong to you."], 403);
    }

    $currency = $input['currency'] ?? 'USD';
    $amountInPaymentCurrency = (float)$input['amount_paid'];
    
    $exchangeRate = 1.0000;
    if ($currency === 'ZiG') {
        $exchangeRate = 25.0000;
    } elseif ($currency === 'ZAR') {
        $exchangeRate = 18.0000;
    }
    
    // Convert to USD base currency
    $amountPaidUSD = round($amountInPaymentCurrency / $exchangeRate, 2);

    $idempotencyKey = $input['idempotency_key'] ?? bin2hex(random_bytes(8));
    $checkDup = $db->prepare("SELECT id FROM fee_payments WHERE idempotency_key=?");
    $checkDup->execute([$idempotencyKey]);
    if ($checkDup->fetch()) {
        Auth::sendResponse(null, ["code" => "DUPLICATE_PAYMENT", "message" => "This payment has already been recorded."], 409);
    }

    $db->beginTransaction();
    try {
        $paymentId = Database::generateUniqueId('fee_payments');
        $reference = strtoupper($input['method']) . '-REF-' . bin2hex(random_bytes(4));
        
        $stmtPay = $db->prepare("INSERT INTO fee_payments (id, school_id, student_id, fee_id, payment_date, amount_paid, payment_method, reference, payment_currency, exchange_rate, amount_in_payment_currency, idempotency_key, created_by)
                                 VALUES (?,?,?,?,NOW(),?,?,?,?,?,?,?,?)");
        $stmtPay->execute([
            $paymentId, $schoolId, $fee['student_id'], $feeId,
            $amountPaidUSD,
            'mobile_money',
            $reference,
            $currency,
            $exchangeRate,
            $amountInPaymentCurrency,
            $idempotencyKey,
            $user['id']
        ]);

        // Update fee record totals
        $newPaid = (float)$fee['amount_paid'] + $amountPaidUSD;
        $status = 'unpaid';
        if ($newPaid >= (float)$fee['amount_due']) {
            $status = 'cleared';
        } elseif ($newPaid > 0) {
            $status = 'partial';
        }

        $stmtUp = $db->prepare("UPDATE fees SET amount_paid=?, status=? WHERE id=?");
        $stmtUp->execute([$newPaid, $status, $feeId]);

        $db->commit();
        Auth::logAction($schoolId, $user['id'], 'FEE_PAYMENT_ONLINE', 'fee_payments', $paymentId, "Online payment of {$amountPaidUSD} USD (converted from {$amountInPaymentCurrency} {$currency}) via {$input['method']} for student {$fee['student_id']}");
        Auth::sendResponse(["success" => true, "payment_id" => $paymentId, "reference" => $reference]);
    } catch (Exception $e) {
        $db->rollBack();
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => $e->getMessage()], 500);
    }
});
