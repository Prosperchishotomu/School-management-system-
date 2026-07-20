<?php

$router->get('/schools/{schoolId}/dashboard', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }

    $db    = Database::getConnection();
    $today = date('Y-m-d');

    // Dynamic current term
    $currentTerm = Database::getCurrentTerm($schoolId);

    // 1. Total Students
    $stmtStudents = $db->prepare("SELECT COUNT(*) FROM students WHERE school_id = ? AND status = 'enrolled'");
    $stmtStudents->execute([$schoolId]);
    $totalStudents = (int)$stmtStudents->fetchColumn();

    // 2. Total Classes
    $stmtClasses = $db->prepare("SELECT COUNT(*) FROM classes WHERE school_id = ?");
    $stmtClasses->execute([$schoolId]);
    $totalClasses = (int)$stmtClasses->fetchColumn();

    // 3. Attendance Today
    $stmtAtt = $db->prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('present','late','excused') THEN 1 ELSE 0 END) as present
                              FROM attendance WHERE school_id = ? AND date = ?");
    $stmtAtt->execute([$schoolId, $today]);
    $attData       = $stmtAtt->fetch();
    $attPercentage = 100.00;
    if ($attData && $attData['total'] > 0) {
        $attPercentage = round(($attData['present'] / $attData['total']) * 100, 1);
    }

    // 4. Fees Collected Percentage — dynamic current term
    $stmtFees = $db->prepare("SELECT SUM(amount_due) as due, SUM(amount_paid) as paid FROM fees WHERE school_id = ? AND term = ?");
    $stmtFees->execute([$schoolId, $currentTerm]);
    $feeData      = $stmtFees->fetch();
    $feePercentage = 0;
    if ($feeData && $feeData['due'] > 0) {
        $feePercentage = round(($feeData['paid'] / $feeData['due']) * 100, 1);
    }

    // 5. Daily Register Strip
    $stmtAllClasses = $db->prepare("SELECT id, name FROM classes WHERE school_id = ?");
    $stmtAllClasses->execute([$schoolId]);
    $classesList    = $stmtAllClasses->fetchAll();
    $attendanceStrip = [];
    foreach ($classesList as $c) {
        $stmtCls = $db->prepare("SELECT COUNT(*) as total,
                                        SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
                                        SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent
                                 FROM attendance WHERE school_id=? AND class_id=? AND date=?");
        $stmtCls->execute([$schoolId, $c['id'], $today]);
        $classAtt = $stmtCls->fetch();
        $attendanceStrip[] = [
            'class_id'   => $c['id'],
            'class_name' => $c['name'],
            'status'     => ($classAtt && $classAtt['total'] > 0) ? 'taken' : 'pending',
            'present'    => $classAtt ? (int)$classAtt['present'] : 0,
            'absent'     => $classAtt ? (int)$classAtt['absent']  : 0,
        ];
    }

    // 6. Real Announcements from DB (not mock data)
    $stmtAnn = $db->prepare(
        "SELECT a.id, a.title, a.body as content, a.class_id, c.name as class_name, a.created_at as date
         FROM announcements a
         LEFT JOIN classes c ON a.class_id = c.id
         WHERE a.school_id = ?
           AND (a.expires_at IS NULL OR a.expires_at >= CURDATE())
         ORDER BY a.created_at DESC
         LIMIT 10"
    );
    $stmtAnn->execute([$schoolId]);
    $announcements = $stmtAnn->fetchAll();

    Auth::sendResponse([
        'stats' => [
            'total_students'    => $totalStudents,
            'total_classes'     => $totalClasses,
            'attendance_today'  => $attPercentage,
            'fees_collected_pct'=> $feePercentage,
            'current_term'      => $currentTerm,
        ],
        'attendance_strip' => $attendanceStrip,
        'announcements'    => $announcements,
    ]);
});

// GET /schools/{schoolId}
$router->get('/schools/{schoolId}', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT id, name, code, status, tuition_fee_benchmark, bank_name, account_number, account_name, payment_instructions FROM schools WHERE id=?");
    $stmt->execute([$schoolId]);
    $school = $stmt->fetch();
    if (!$school) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    Auth::sendResponse($school);
});
