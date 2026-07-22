<?php
// Route handlers for Operational Expenses & Accounts Payable (Starlink, ZESA Electricity, Solar, Diesel, Internet, Utilities)

// ── GET /expenses (List all expenses and P&L Summary) ──────────────────────────
$router->get('/expenses', function() {
    $user = Auth::requireAuth();
    $db = Database::getConnection();
    $schoolId = $user['school_id'] ?: 'HARAREPR';

    $stmt = $db->prepare("
        SELECT e.*, u.username as recorded_by_user
        FROM expenses e
        LEFT JOIN users u ON e.recorded_by = u.id
        WHERE e.school_id = ?
        ORDER BY e.expense_date DESC
    ");
    $stmt->execute([$schoolId]);
    $expenses = $stmt->fetchAll();

    // Compute Expense Category Breakdown
    $stmtCat = $db->prepare("
        SELECT category, SUM(amount) as total_amount, COUNT(*) as count
        FROM expenses
        WHERE school_id = ?
        GROUP BY category
    ");
    $stmtCat->execute([$schoolId]);
    $categoryBreakdown = $stmtCat->fetchAll();

    // Total Fee Income vs Total Operational Expenditure Summary
    $stmtFeeRev = $db->prepare("SELECT COALESCE(SUM(amount_paid), 0) FROM fee_payments WHERE school_id = ?");
    $stmtFeeRev->execute([$schoolId]);
    $totalFeeRevenue = (float)$stmtFeeRev->fetchColumn();

    $totalExpenses = 0;
    foreach ($expenses as $e) {
        $totalExpenses += (float)$e['amount'];
    }
    $netProfitLoss = $totalFeeRevenue - $totalExpenses;

    Auth::sendResponse([
        "summary" => [
            "total_fee_revenue" => $totalFeeRevenue,
            "total_expenses"    => $totalExpenses,
            "net_profit_loss"   => $netProfitLoss
        ],
        "category_breakdown" => $categoryBreakdown,
        "expenses"           => $expenses
    ]);
});

// ── POST /expenses (Record new operational expense) ───────────────────────────
$router->post('/expenses', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    $data = getJsonInput();

    $title       = trim($data['title'] ?? '');
    $category    = trim($data['category'] ?? 'other');
    $amount      = (float)($data['amount'] ?? 0);
    $expenseDate = trim($data['expense_date'] ?? date('Y-m-d'));
    $vendorName  = trim($data['vendor_name'] ?? '');
    $receiptRef  = trim($data['receipt_ref'] ?? '');

    if (empty($title) || $amount <= 0) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Expense title and positive amount are required."], 400);
    }

    $db = Database::getConnection();
    $id = Database::generateId('EXP');

    $stmt = $db->prepare("INSERT INTO expenses (id, school_id, title, category, amount, expense_date, vendor_name, receipt_ref, recorded_by)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $id,
        $user['school_id'],
        $title,
        $category,
        $amount,
        $expenseDate,
        $vendorName ?: null,
        $receiptRef ?: null,
        $user['id']
    ]);

    Auth::sendResponse(["id" => $id, "message" => "Operational expense recorded successfully."], null, 201);
});
