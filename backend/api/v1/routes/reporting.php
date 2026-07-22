<?php

$router->get('/reporting', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db = Database::getConnection();

    $totalSchools      = (int)$db->query("SELECT COUNT(*) FROM schools")->fetchColumn();
    $totalActiveSchools= (int)$db->query("SELECT COUNT(*) FROM schools WHERE status='active'")->fetchColumn();
    $totalStudents     = (int)$db->query("SELECT COUNT(*) FROM students WHERE status='enrolled'")->fetchColumn();
    $totalStaff        = (int)$db->query("SELECT COUNT(*) FROM staff")->fetchColumn();
    $totalGuardians    = (int)$db->query("SELECT COUNT(*) FROM guardians")->fetchColumn();
    $activeLicenses    = (int)$db->query("SELECT COUNT(*) FROM licenses WHERE status='active'")->fetchColumn();
    $expiringLicenses  = (int)$db->query("SELECT COUNT(*) FROM licenses WHERE status='active' AND expires_at < DATE_ADD(NOW(), INTERVAL 30 DAY)")->fetchColumn();

    // Attendance today (platform-wide)
    $today = date('Y-m-d');
    $attStmt = $db->prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present FROM attendance WHERE date=?");
    $attStmt->execute([$today]);
    $attRow  = $attStmt->fetch();
    $platformAttPct = ($attRow && $attRow['total'] > 0) ? round(($attRow['present'] / $attRow['total']) * 100, 1) : 0;

    // Fees collection platform-wide
    $feeStmt = $db->prepare("SELECT SUM(amount_due) as due, SUM(amount_paid) as paid FROM fees");
    $feeStmt->execute();
    $feeRow  = $feeStmt->fetch();
    $platformFeesPct = ($feeRow && $feeRow['due'] > 0) ? round(($feeRow['paid'] / $feeRow['due']) * 100, 1) : 0;

    // Students per school
    $studentsPerSchool = $db->query("SELECT s.name, COUNT(st.id) as count FROM schools s LEFT JOIN students st ON st.school_id=s.id AND st.status='enrolled' GROUP BY s.id ORDER BY s.name")->fetchAll();

    // Active licenses per plan
    $planBreakdown = $db->query("SELECT plan, COUNT(*) as count FROM licenses WHERE status='active' GROUP BY plan")->fetchAll();

    // Monthly school registrations (last 6 months)
    $monthlyRegs = $db->query("SELECT DATE_FORMAT(created_at,'%Y-%m') as month, COUNT(*) as count FROM schools WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month ASC")->fetchAll();

    // Open incidents per school
    $incidents = $db->query("SELECT s.name as school_name, COUNT(di.id) as open_incidents FROM schools s LEFT JOIN discipline_incidents di ON di.school_id=s.id AND di.status='open' GROUP BY s.id ORDER BY s.name")->fetchAll();

    Auth::sendResponse([
        "platform" => [
            "total_schools"        => $totalSchools,
            "active_schools"       => $totalActiveSchools,
            "total_students"       => $totalStudents,
            "total_staff"          => $totalStaff,
            "total_guardians"      => $totalGuardians,
            "active_licenses"      => $activeLicenses,
            "expiring_licenses"    => $expiringLicenses,
            "attendance_today_pct" => $platformAttPct,
            "fees_collected_pct"   => $platformFeesPct,
        ],
        "students_per_school"  => $studentsPerSchool,
        "plan_breakdown"       => $planBreakdown,
        "monthly_registrations"=> $monthlyRegs,
        "incidents_per_school" => $incidents,
    ]);
});

// GET /reporting/export — Platform-wide CSV export for super admin
$router->get('/reporting/export', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db   = Database::getConnection();
    $type = $_GET['type'] ?? 'schools';

    switch ($type) {
        case 'schools':
            $stmt = $db->query("SELECT s.id, s.name, s.code, s.status, s.tuition_fee_benchmark,
                                       l.plan as license_plan, l.status as license_status, l.expires_at as license_expires,
                                       (SELECT COUNT(*) FROM students st WHERE st.school_id=s.id AND st.status='enrolled') as enrolled_students,
                                       (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id) as user_count
                                FROM schools s LEFT JOIN licenses l ON l.school_id=s.id AND l.status='active' ORDER BY s.name");
            header('Content-Disposition: attachment; filename="platform_schools_' . date('Ymd') . '.csv"');
            $headers = ['School ID','Name','Code','Status','Fee Benchmark','License Plan','License Status','License Expires','Enrolled Students','User Count'];
            break;

        case 'licenses':
            $stmt = $db->query("SELECT l.id, s.name as school_name, l.plan, l.status, l.expires_at, l.max_users FROM licenses l LEFT JOIN schools s ON l.school_id=s.id ORDER BY l.expires_at DESC");
            header('Content-Disposition: attachment; filename="platform_licenses_' . date('Ymd') . '.csv"');
            $headers = ['License ID','School Name','Plan','Status','Expires At','Max Users'];
            break;

        case 'students':
            $stmt = $db->query("SELECT s.admission_number, CONCAT(s.first_name,' ',s.last_name) as name, c.name as class, sc.name as school, s.gender, s.status, s.created_at
                                FROM students s LEFT JOIN classes c ON s.class_id=c.id LEFT JOIN schools sc ON s.school_id=sc.id WHERE s.status='enrolled' ORDER BY sc.name, s.last_name");
            header('Content-Disposition: attachment; filename="platform_students_' . date('Ymd') . '.csv"');
            $headers = ['Admission No','Name','Class','School','Gender','Status','Enrolled On'];
            break;

        default:
            Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Invalid export type. Allowed: schools, licenses, students."], 400);
    }

    $rows = $stmt->fetchAll();
    header('Content-Type: text/csv; charset=utf-8');
    header('X-API-Version: v1');
    $output = fopen('php://output', 'w');
    fputcsv($output, $headers);
    foreach ($rows as $row) { fputcsv($output, array_values($row)); }
    fclose($output);
    Auth::logAction(null, $user['id'], 'PLATFORM_EXPORT', 'reporting', null, "Exported platform {$type} data as CSV");
    exit;
});

// GET /reporting/school/analytics — School multi-term & subject performance analytics
$router->get('/reporting/school/analytics', function() {
    $user = Auth::getCurrentUser();
    Auth::requireRole(['school_admin', 'super_admin', 'teacher']);
    $db = Database::getConnection();
    $schoolId = $user['school_id'] ?: 'HARAREPR';

    // Multi-term average performance comparison
    $stmtTerms = $db->prepare("
        SELECT term, 
               ROUND(AVG(overall_percentage), 2) as average_percentage,
               SUM(CASE WHEN pass_status='pass' THEN 1 ELSE 0 END) as pass_count,
               COUNT(*) as total_students
        FROM results
        WHERE school_id = ?
        GROUP BY term
        ORDER BY term ASC
    ");
    $stmtTerms->execute([$schoolId]);
    $termPerformance = $stmtTerms->fetchAll();

    // Subject pass rate & average score breakdown
    $stmtSubjects = $db->prepare("
        SELECT subject,
               ROUND(AVG(grade_value), 2) as average_score,
               COUNT(*) as total_assessments
        FROM grades
        WHERE school_id = ?
        GROUP BY subject
        ORDER BY average_score DESC
    ");
    $stmtSubjects->execute([$schoolId]);
    $subjectBreakdown = $stmtSubjects->fetchAll();

    Auth::sendResponse([
        "term_performance" => $termPerformance,
        "subject_breakdown" => $subjectBreakdown
    ]);
});

// GET /schools/{schoolId}/reporting — Per-school reporting
$router->get('/schools/{schoolId}/reporting', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db          = Database::getConnection();
    $today       = date('Y-m-d');
    $currentTerm = Database::getCurrentTerm($schoolId);

    $enrolled   = (int)$db->prepare("SELECT COUNT(*) FROM students WHERE school_id=? AND status='enrolled'")->execute([$schoolId]);
    // proper counts
    $s1 = $db->prepare("SELECT COUNT(*) FROM students WHERE school_id=? AND status='enrolled'"); $s1->execute([$schoolId]); $enrolled = (int)$s1->fetchColumn();
    $s2 = $db->prepare("SELECT COUNT(*) FROM classes WHERE school_id=?"); $s2->execute([$schoolId]); $classes = (int)$s2->fetchColumn();
    $s3 = $db->prepare("SELECT COUNT(*) FROM staff WHERE school_id=?"); $s3->execute([$schoolId]); $staff = (int)$s3->fetchColumn();
    $s4 = $db->prepare("SELECT SUM(amount_due) as due, SUM(amount_paid) as paid FROM fees WHERE school_id=? AND term=?"); $s4->execute([$schoolId, $currentTerm]); $fees = $s4->fetch();
    $s5 = $db->prepare("SELECT COUNT(CASE WHEN status IN ('present','late') THEN 1 END) as present, COUNT(*) as total FROM attendance WHERE school_id=? AND date=?"); $s5->execute([$schoolId, $today]); $attToday = $s5->fetch();
    $s6 = $db->prepare("SELECT COUNT(*) FROM discipline_incidents WHERE school_id=? AND status='open'"); $s6->execute([$schoolId]); $openIncidents = (int)$s6->fetchColumn();

    $genderBreakdown = $db->prepare("SELECT gender, COUNT(*) as count FROM students WHERE school_id=? AND status='enrolled' GROUP BY gender"); $genderBreakdown->execute([$schoolId]);
    $statusBreakdown = $db->prepare("SELECT status, COUNT(*) as count FROM students WHERE school_id=? GROUP BY status"); $statusBreakdown->execute([$schoolId]);
    $attendanceTrend = $db->prepare("SELECT date, ROUND(COUNT(CASE WHEN status='present' THEN 1 END)*100.0/NULLIF(COUNT(*),0),1) as pct FROM attendance WHERE school_id=? AND date BETWEEN DATE_SUB(?,INTERVAL 30 DAY) AND ? GROUP BY date ORDER BY date ASC"); $attendanceTrend->execute([$schoolId, $today, $today]);

    Auth::sendResponse([
        "summary" => [
            "enrolled_students"   => $enrolled,
            "classes"             => $classes,
            "staff"               => $staff,
            "current_term"        => $currentTerm,
            "fees_due"            => (float)($fees['due'] ?? 0),
            "fees_paid"           => (float)($fees['paid'] ?? 0),
            "fees_collected_pct"  => ($fees['due'] > 0) ? round(($fees['paid']/$fees['due'])*100, 1) : 0,
            "attendance_today_pct"=> ($attToday['total'] > 0) ? round(($attToday['present']/$attToday['total'])*100, 1) : 0,
            "open_incidents"      => $openIncidents,
        ],
        "gender_breakdown"  => $genderBreakdown->fetchAll(),
        "status_breakdown"  => $statusBreakdown->fetchAll(),
        "attendance_trend"  => $attendanceTrend->fetchAll(),
    ]);
});
