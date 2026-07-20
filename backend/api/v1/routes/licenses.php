<?php

$router->get('/admin/licenses', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db   = Database::getConnection();
    $stmt = $db->query("SELECT l.*, s.name as school_name FROM licenses l LEFT JOIN schools s ON l.school_id=s.id ORDER BY l.expires_at DESC");
    Auth::sendResponse($stmt->fetchAll());
});

// POST /admin/licenses
$router->post('/admin/licenses', function() {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['school_id']) || empty($input['plan']) || empty($input['expires_at'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "school_id, plan and expires_at are required."], 400);
    }
    Auth::validateDate($input['expires_at'], 'expires_at');

    $schoolId  = $input['school_id'];
    $plan      = trim($input['plan']);
    $expiresAt = trim($input['expires_at']) . " 00:00:00";
    $maxUsers  = isset($input['max_users']) ? (int)$input['max_users'] : 100;

    $db        = Database::getConnection();
    $stmtCheck = $db->prepare("SELECT id FROM schools WHERE id=?");
    $stmtCheck->execute([$schoolId]);
    if (!$stmtCheck->fetch()) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Target school not found."], 404);
    }

    $licenseKey = Auth::generateToken(["school_id" => $schoolId, "plan" => $plan, "max_users" => $maxUsers, "type" => "license"]);
    $db->prepare("UPDATE licenses SET status='expired' WHERE school_id=? AND status='active'")->execute([$schoolId]);

    $licenseId = Database::generateUniqueId('licenses');
    $db->prepare("INSERT INTO licenses (id, school_id, license_key, plan, status, expires_at, max_users, issued_by) VALUES (?,?,?,?,'active',?,?,?)")
       ->execute([$licenseId, $schoolId, $licenseKey, $plan, $expiresAt, $maxUsers, $user['id']]);
    $db->prepare("UPDATE schools SET status='active' WHERE id=?")->execute([$schoolId]);

    Auth::logAction(null, $user['id'], 'LICENSE_GENERATED', 'licenses', $licenseId, "Generated license for school {$schoolId}, plan: {$plan}, expires: {$expiresAt}");
    Auth::sendResponse(["id" => $licenseId, "license_key" => $licenseKey], null, 201);
});

// GET /schools/{schoolId}/license — school admin view of their own license
$router->get('/schools/{schoolId}/license', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db       = Database::getConnection();
    $stmtLic  = $db->prepare("SELECT l.plan, l.status, l.expires_at, l.max_users, l.issued_by FROM licenses l WHERE l.school_id=? AND l.status='active' ORDER BY l.expires_at DESC LIMIT 1");
    $stmtLic->execute([$schoolId]);
    $license  = $stmtLic->fetch();

    $stmtCounts = $db->prepare("SELECT COUNT(*) as users FROM users WHERE school_id=?");
    $stmtCounts->execute([$schoolId]);
    $counts = $stmtCounts->fetch();

    $stmtStudents = $db->prepare("SELECT COUNT(*) as enrolled FROM students WHERE school_id=? AND status='enrolled'");
    $stmtStudents->execute([$schoolId]);
    $studentCount = $stmtStudents->fetch();

    $daysLeft    = null;
    $isExpired   = false;
    $isExpiring  = false;
    if ($license) {
        $expiryTime = strtotime($license['expires_at']);
        $daysLeft   = ceil(($expiryTime - time()) / (24 * 60 * 60));
        $isExpired  = $daysLeft < 0;
        $isExpiring = !$isExpired && $daysLeft <= 30;
    }

    Auth::sendResponse([
        "license"    => $license,
        "days_left"  => $daysLeft,
        "is_expired" => $isExpired,
        "is_expiring"=> $isExpiring,
        "usage"      => [
            "users"           => (int)$counts['users'],
            "enrolled_students"=> (int)$studentCount['enrolled'],
            "max_users"       => $license ? (int)$license['max_users'] : null,
        ]
    ]);
});

// POST /schools/{schoolId}/license/renewal-request
$router->post('/schools/{schoolId}/license/renewal-request', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $db    = Database::getConnection();
    $stmt  = $db->prepare("SELECT name FROM schools WHERE id=?");
    $stmt->execute([$schoolId]);
    $schoolName = $stmt->fetchColumn();

    // Log the renewal request as a system event for super admin to see
    $eventId = Database::generateUniqueId('system_events');
    $db->prepare("INSERT INTO system_events (id, school_id, severity, event_type, message) VALUES (?,?,'warning','LICENSE_RENEWAL_REQUESTED',?)")
       ->execute([$eventId, $schoolId, "License renewal requested by '{$user['username']}' at school '{$schoolName}'. Preferred plan: " . ($input['preferred_plan'] ?? 'current') . ". Contact: " . ($input['contact_phone'] ?? 'N/A')]);

    Auth::logAction($schoolId, $user['id'], 'LICENSE_RENEWAL_REQUESTED', 'licenses', null, "Renewal request submitted for school '{$schoolName}'");
    Auth::sendResponse(["success" => true, "message" => "Renewal request submitted. Your administrator will contact you shortly."]);
});

// ── Super Admin Platform Routes ──────────────────────────────────────────────

// GET /admin/command-center
$router->get('/admin/command-center', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db = Database::getConnection();
    $totalSchools    = (int)$db->query("SELECT COUNT(*) FROM schools")->fetchColumn();
    $activeLicenses  = (int)$db->query("SELECT COUNT(*) FROM licenses WHERE status='active'")->fetchColumn();
    $activeAlerts    = (int)$db->query("SELECT COUNT(*) FROM system_events WHERE severity IN ('warning','critical')")->fetchColumn();
    Auth::sendResponse(["stats" => ["total_schools" => $totalSchools, "active_licenses" => $activeLicenses, "active_alerts" => $activeAlerts]]);
});

// GET /admin/stats
$router->get('/admin/stats', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db = Database::getConnection();

    $totalSchools     = (int)$db->query("SELECT COUNT(*) FROM schools")->fetchColumn();
    $totalStudents    = (int)$db->query("SELECT COUNT(*) FROM students WHERE status='enrolled'")->fetchColumn();
    $totalStaff       = (int)$db->query("SELECT COUNT(*) FROM staff")->fetchColumn();
    $activeLicenses   = (int)$db->query("SELECT COUNT(*) FROM licenses WHERE status='active'")->fetchColumn();
    $expiringLicenses = (int)$db->query("SELECT COUNT(*) FROM licenses WHERE status='active' AND expires_at < DATE_ADD(NOW(), INTERVAL 30 DAY)")->fetchColumn();
    $activeAlerts     = (int)$db->query("SELECT COUNT(*) FROM system_events WHERE severity IN ('warning','critical')")->fetchColumn();

    $studentsPerSchool  = $db->query("SELECT s.name AS school_name, COUNT(st.id) AS student_count FROM schools s LEFT JOIN students st ON st.school_id=s.id AND st.status='enrolled' GROUP BY s.id ORDER BY s.name")->fetchAll();
    $planBreakdown      = $db->query("SELECT plan, COUNT(*) AS count FROM licenses WHERE status='active' GROUP BY plan")->fetchAll();
    $schoolRegistrations= $db->query("SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS count FROM schools WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month ASC")->fetchAll();

    Auth::sendResponse([
        "totals" => [
            "schools" => $totalSchools, "students" => $totalStudents, "staff" => $totalStaff,
            "active_licenses" => $activeLicenses, "expiring_licenses" => $expiringLicenses, "active_alerts" => $activeAlerts,
        ],
        "students_per_school"  => $studentsPerSchool,
        "plan_breakdown"       => $planBreakdown,
        "school_registrations" => $schoolRegistrations,
    ]);
});

// GET /admin/alerts
$router->get('/admin/alerts', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db   = Database::getConnection();
    $stmt = $db->query("SELECT id, school_id, severity, event_type, message, created_at FROM system_events ORDER BY created_at DESC");
    Auth::sendResponse($stmt->fetchAll());
});

// PATCH /admin/alerts/{id}
$router->patch('/admin/alerts/{id}', function($id) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db   = Database::getConnection();
    $db->prepare("DELETE FROM system_events WHERE id=?")->execute([$id]);
    Auth::sendResponse(["success" => true]);
});

// GET /schools
$router->get('/schools', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db   = Database::getConnection();
    $stmt = $db->query("SELECT id, name, code, status, tuition_fee_benchmark FROM schools ORDER BY name ASC");
    Auth::sendResponse($stmt->fetchAll());
});

// POST /schools — create school
$router->post('/schools', function() {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $input = json_decode(file_get_contents('php://input'), true);

    $required = ['name', 'code', 'admin_username', 'admin_email', 'admin_password'];
    $errors   = [];
    foreach ($required as $f) { if (empty($input[$f])) $errors[$f] = 'required'; }
    if (!empty($errors)) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Required fields missing.", "fields" => $errors], 400);
    if (strlen($input['admin_password']) < 8) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Admin password must be at least 8 characters."], 400);

    $db = Database::getConnection();
    $stmtCode = $db->prepare("SELECT id FROM schools WHERE code=?");
    $stmtCode->execute([strtoupper(trim($input['code']))]);
    if ($stmtCode->fetch()) Auth::sendResponse(null, ["code" => "DUPLICATE_CODE", "message" => "School code is already registered."], 409);

    $stmtUser = $db->prepare("SELECT id FROM users WHERE username=?");
    $stmtUser->execute([trim($input['admin_username'])]);
    if ($stmtUser->fetch()) Auth::sendResponse(null, ["code" => "DUPLICATE_USERNAME", "message" => "Admin username is already taken."], 409);

    $schoolId = Database::generateIdFromName($input['name'], 'schools');
    $db->beginTransaction();
    try {
        $schoolType = $input['school_type'] ?? 'primary';
        $db->prepare("INSERT INTO schools (id, name, code, status, school_type, tuition_fee_benchmark) VALUES (?,?,?,?,?,?)")
           ->execute([$schoolId, trim($input['name']), strtoupper(trim($input['code'])), $input['status'] ?? 'active', $schoolType, $input['tuition_fee_benchmark'] ?? 500.00]);

        $classesToInsert = [];
        if ($schoolType === 'primary') {
            $classesToInsert[] = ['name' => 'ECD A', 'level' => 'ECD A', 'stream' => 'General'];
            $classesToInsert[] = ['name' => 'ECD B', 'level' => 'ECD B', 'stream' => 'General'];
            for ($i = 1; $i <= 7; $i++) {
                $classesToInsert[] = ['name' => "Grade $i", 'level' => "Grade $i", 'stream' => 'General'];
            }
        } else {
            for ($i = 1; $i <= 4; $i++) {
                $classesToInsert[] = ['name' => "Form $i", 'level' => "Form $i", 'stream' => 'General'];
            }
            foreach (['Arts', 'Commercials', 'Sciences'] as $stream) {
                $classesToInsert[] = ['name' => "Form 5 $stream", 'level' => 'Form 5', 'stream' => $stream];
                $classesToInsert[] = ['name' => "Form 6 $stream", 'level' => 'Form 6', 'stream' => $stream];
            }
        }

        foreach ($classesToInsert as $cls) {
            $clsId = Database::generateUniqueId('classes');
            $db->prepare("INSERT INTO classes (id, school_id, name, grade_level, stream) VALUES (?,?,?,?,?)")
               ->execute([$clsId, $schoolId, $cls['name'], $cls['level'], $cls['stream']]);
        }

        $adminUserId = Database::generateUniqueId('users');
        $hash        = password_hash($input['admin_password'], PASSWORD_DEFAULT);
        $db->prepare("INSERT INTO users (id, school_id, username, password_hash, role, email, status) VALUES (?,?,?,?,'school_admin',?,'active')")
           ->execute([$adminUserId, $schoolId, trim($input['admin_username']), $hash, trim($input['admin_email'])]);

        $notifId = Database::generateUniqueId('notification_settings');
        $db->prepare("INSERT INTO notification_settings (id, school_id, sms_gateway_url, sms_api_key, sms_sender_id, notify_attendance_absent, notify_results_published, notify_fees_overdue, notify_discipline_incident) VALUES (?,?,'http://localhost/mock-sms-gateway','mock-api-key','SCHOOLBASE',1,1,1,1)")
           ->execute([$notifId, $schoolId]);

        $termId = Database::generateUniqueId('term_config');
        $db->prepare("INSERT INTO term_config (id, school_id, term_name, term_code, start_date, end_date, is_current) VALUES (?,?,'Term 1 2026','2026-T1','2026-01-01','2026-04-30',1)")
           ->execute([$termId, $schoolId]);

        $licenseId  = Database::generateUniqueId('licenses');
        $licPayload = base64_encode(json_encode(['school_id' => $schoolId, 'plan' => 'full', 'expires_at' => date('Y-m-d', strtotime('+365 days'))]));
        $db->prepare("INSERT INTO licenses (id, school_id, license_key, plan, status, expires_at, max_users, issued_by) VALUES (?,?,?,'full','active',?,100,?)")
           ->execute([$licenseId, $schoolId, $licPayload, date('Y-m-d H:i:s', strtotime('+365 days')), $user['id']]);

        $db->commit();
        Auth::logAction($schoolId, $user['id'], 'SCHOOL_CREATED', 'schools', $schoolId, "Created school: {$input['name']} with admin: {$input['admin_username']}");
        Auth::sendResponse(["id" => $schoolId, "admin_user_id" => $adminUserId], null, 201);
    } catch (Exception $ex) {
        $db->rollBack();
        error_log("Failed creating school: " . $ex->getMessage());
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Database write failed during school registration."], 500);
    }
});

// PATCH /schools/{schoolId}
$router->patch('/schools/{schoolId}', function($schoolId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $input = json_decode(file_get_contents('php://input'), true);
    $db    = Database::getConnection();
    if (!empty($input['status']))              $db->prepare("UPDATE schools SET status=? WHERE id=?")->execute([$input['status'], $schoolId]);
    if (!empty($input['name']))                $db->prepare("UPDATE schools SET name=? WHERE id=?")->execute([$input['name'], $schoolId]);
    if (isset($input['tuition_fee_benchmark'])) $db->prepare("UPDATE schools SET tuition_fee_benchmark=? WHERE id=?")->execute([$input['tuition_fee_benchmark'], $schoolId]);
    Auth::logAction(null, $user['id'], 'SCHOOL_UPDATED', 'schools', $schoolId, "Updated school #{$schoolId}");
    Auth::sendResponse(["updated" => true]);
});

// GET /admin/subjects
$router->get('/admin/subjects', function() {
    $user = Auth::requireAuth();
    $db   = Database::getConnection();
    Auth::sendResponse($db->query("SELECT * FROM subjects ORDER BY level, name")->fetchAll());
});

// POST /admin/subjects
$router->post('/admin/subjects', function() {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['name']) || empty($input['code'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "name and code required."], 400);
    $db        = Database::getConnection();
    $subjectId = Database::generateUniqueId('subjects');
    $db->prepare("INSERT INTO subjects (id, name, code, level, is_active, created_by) VALUES (?,?,?,?,1,?)")
       ->execute([$subjectId, $input['name'], strtoupper($input['code']), $input['level'] ?? 'all', $user['id']]);
    Auth::sendResponse(["id" => $subjectId], null, 201);
});

// DELETE /admin/subjects/{subjectId}
$router->delete('/admin/subjects/{subjectId}', function($subjectId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db   = Database::getConnection();
    $db->prepare("DELETE FROM subjects WHERE id=?")->execute([$subjectId]);
    Auth::sendResponse(null, null, 204);
});

// GET /admin/audit-log
$router->get('/admin/audit-log', function() {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db    = Database::getConnection();
    
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, (int)($_GET['per_page'] ?? 10)); // Default to 10 rows
    $offset  = ($page - 1) * $perPage;
    
    $entityType = trim($_GET['entity_type'] ?? '');
    $search     = trim($_GET['search'] ?? '');

    $conditions = [];
    $params     = [];

    if (!empty($entityType)) {
        $conditions[] = "al.entity_type=?";
        $params[] = $entityType;
    }
    if (!empty($search)) {
        $conditions[] = "(u.username LIKE ? OR al.action LIKE ? OR al.description LIKE ? OR al.ip_address LIKE ?)";
        $searchWild = "%$search%";
        $params[] = $searchWild;
        $params[] = $searchWild;
        $params[] = $searchWild;
        $params[] = $searchWild;
    }

    $where = count($conditions) > 0 ? "WHERE " . implode(" AND ", $conditions) : "";

    $countSql = "SELECT COUNT(*) FROM audit_logs al JOIN users u ON al.user_id=u.id $where";
    $stmtCount = $db->prepare($countSql);
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $dataSql = "SELECT al.id, al.action, al.entity_type, al.entity_id, al.description, al.ip_address, al.created_at,
                       u.username, u.role, s.name AS school_name
                FROM audit_logs al 
                JOIN users u ON al.user_id=u.id 
                LEFT JOIN schools s ON al.school_id=s.id
                $where 
                ORDER BY al.created_at DESC 
                LIMIT ? OFFSET ?";
                
    $stmtData = $db->prepare($dataSql);
    $i = 1;
    foreach ($params as $p) {
        $stmtData->bindValue($i++, $p);
    }
    $stmtData->bindValue($i++, $perPage, PDO::PARAM_INT);
    $stmtData->bindValue($i++, $offset, PDO::PARAM_INT);
    $stmtData->execute();
    
    Auth::sendResponse($stmtData->fetchAll(), null, 200, ["page" => $page, "per_page" => $perPage, "total" => $total]);
});

// GET /admin/system-reports
$router->get('/admin/system-reports', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $db   = Database::getConnection();
    $schoolsMetrics = $db->query("SELECT s.id AS school_id, s.name AS school_name, s.code AS school_code, s.status AS school_status,
                                         (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id) AS user_count,
                                         l.plan AS license_plan, l.max_users AS license_max_users, l.status AS license_status, l.expires_at AS license_expires_at
                                  FROM schools s LEFT JOIN licenses l ON l.school_id=s.id AND l.status='active' ORDER BY s.name")->fetchAll();
    $tables  = ['schools','users','licenses','classes','students','staff','attendance','grades','exams','system_events','audit_logs'];
    $dbStats = [];
    foreach ($tables as $t) { $dbStats[] = ["table_name" => $t, "row_count" => (int)$db->query("SELECT COUNT(*) FROM `$t`")->fetchColumn()]; }
    $alertsBreakdown = $db->query("SELECT severity, COUNT(*) as count FROM system_events GROUP BY severity")->fetchAll();
    Auth::sendResponse(["schools_metrics" => $schoolsMetrics, "db_stats" => $dbStats, "alerts_breakdown" => $alertsBreakdown]);
});

// Term config routes
$router->get('/schools/{schoolId}/terms', function($schoolId) {
    $user = Auth::requireAuth();
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM term_config WHERE school_id=? ORDER BY start_date DESC");
    $stmt->execute([$schoolId]);
    Auth::sendResponse($stmt->fetchAll());
});

$router->post('/schools/{schoolId}/terms', function($schoolId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['term_name']) || empty($input['term_code']) || empty($input['start_date']) || empty($input['end_date'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "term_name, term_code, start_date, end_date required."], 400);
    }
    Auth::validateDate($input['start_date'], 'start_date');
    Auth::validateDate($input['end_date'], 'end_date');

    $start = strtotime($input['start_date']);
    $end   = strtotime($input['end_date']);

    if ($start >= $end) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "End date must be chronologically after the start date."], 400);
    }

    if (($end - $start) < (30 * 86400)) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "An academic term duration must be at least 30 days."], 400);
    }

    $startMonth = (int)date('n', $start);
    $endMonth   = (int)date('n', $end);

    if ($startMonth === 1) {
        if ($endMonth !== 3 && $endMonth !== 4) {
            Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Term 1 starting in January must end in March or April."], 400);
        }
    } elseif ($startMonth === 5) {
        if ($endMonth !== 7 && $endMonth !== 8) {
            Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Term 2 starting in May must end in July or August."], 400);
        }
    } elseif ($startMonth === 9) {
        if ($endMonth !== 11 && $endMonth !== 12) {
            Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Term 3 starting in September must end in November or December."], 400);
        }
    } else {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Invalid term start month. Standard academic terms must start in January (Term 1), May (Term 2), or September (Term 3)."], 400);
    }

    $db     = Database::getConnection();
    $termId = Database::generateUniqueId('term_config');
    $isCurrent = (int)($input['is_current'] ?? 0);
    // If marking as current, unmark others
    if ($isCurrent) {
        $db->prepare("UPDATE term_config SET is_current=0 WHERE school_id=?")->execute([$schoolId]);
    }
    $db->prepare("INSERT INTO term_config (id, school_id, term_name, term_code, start_date, end_date, is_current) VALUES (?,?,?,?,?,?,?)")
       ->execute([$termId, $schoolId, $input['term_name'], $input['term_code'], $input['start_date'], $input['end_date'], $isCurrent]);
    Auth::sendResponse(["id" => $termId], null, 201);
});

// Report Comments
$router->get('/schools/{schoolId}/comments', function($schoolId) {
    $user    = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    $db      = Database::getConnection();
    $type    = $_GET['type']     ?? null;
    $ref_id  = $_GET['ref_id']   ?? null;
    $ref_date= $_GET['ref_date'] ?? null;
    $sql     = "SELECT rc.*, u.username as author FROM report_comments rc JOIN users u ON rc.created_by=u.id WHERE rc.school_id=?";
    $params  = [$schoolId];
    if ($type)     { $sql .= " AND rc.report_type=?"; $params[] = $type; }
    if ($ref_id)   { $sql .= " AND rc.ref_id=?";     $params[] = $ref_id; }
    if ($ref_date) { $sql .= " AND rc.ref_date=?";   $params[] = $ref_date; }
    $sql .= " ORDER BY rc.created_at DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    Auth::sendResponse($stmt->fetchAll());
});

$router->post('/schools/{schoolId}/comments', function($schoolId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['report_type']) || empty($input['comment'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "report_type and comment are required."], 400);
    $db        = Database::getConnection();
    $commentId = Database::generateUniqueId('report_comments');
    $refId     = $input['ref_id'] ?? null;
    $commentText = $input['comment'];

    $db->prepare("INSERT INTO report_comments (id, school_id, report_type, ref_id, ref_date, comment, created_by) VALUES (?,?,?,?,?,?,?)")
       ->execute([$commentId, $schoolId, $input['report_type'], $refId, $input['ref_date'] ?? null, $commentText, $user['id']]);
    
    Auth::logAction($schoolId, $user['id'], 'COMMENT_ADDED', 'report_comments', $commentId, "Principal comment on {$input['report_type']} report");

    // Direct notifications to the actual recipient if ref_id is set
    if (!empty($refId)) {
        // 1. Try student lookup
        $stmtStudent = $db->prepare("SELECT first_name, last_name FROM students WHERE id=? AND school_id=?");
        $stmtStudent->execute([$refId, $schoolId]);
        $student = $stmtStudent->fetch();
        if ($student) {
            $studentName = $student['first_name'] . ' ' . $student['last_name'];
            $stmtGuardians = $db->prepare("SELECT g.user_id, g.email, g.phone, g.name 
                                           FROM guardians g 
                                           JOIN student_guardians sg ON g.id = sg.guardian_id 
                                           WHERE sg.student_id=?");
            $stmtGuardians->execute([$refId]);
            $guardians = $stmtGuardians->fetchAll();
            foreach ($guardians as $g) {
                if ($g['user_id']) {
                    Auth::sendNotification($schoolId, $g['user_id'], "Principal's Comment", "Principal left a comment regarding {$studentName}: \"{$commentText}\"");
                }
                if ($g['phone']) {
                    Auth::logAction($schoolId, $user['id'], 'SMS_SIMULATED', 'guardians', $g['user_id'], "SMS simulated to guardian {$g['name']} ({$g['phone']}): Principal comment on {$studentName}.");
                }
                if ($g['email']) {
                    Auth::logAction($schoolId, $user['id'], 'EMAIL_SIMULATED', 'guardians', $g['user_id'], "Email simulated to guardian {$g['name']} ({$g['email']}): Principal comment on {$studentName}.");
                }
            }
        }

        // 2. Try class lookup
        $stmtClass = $db->prepare("SELECT name FROM classes WHERE id=? AND school_id=?");
        $stmtClass->execute([$refId, $schoolId]);
        $class = $stmtClass->fetch();
        if ($class) {
            $className = $class['name'];
            $stmtTeacher = $db->prepare("SELECT st.user_id, st.email, st.phone, st.name 
                                         FROM staff st 
                                         WHERE st.class_id=? AND st.school_id=?");
            $stmtTeacher->execute([$refId, $schoolId]);
            $teachers = $stmtTeacher->fetchAll();
            foreach ($teachers as $t) {
                if ($t['user_id']) {
                    Auth::sendNotification($schoolId, $t['user_id'], "Principal's Comment", "Principal left a comment on class {$className}: \"{$commentText}\"");
                }
                if ($t['phone']) {
                    Auth::logAction($schoolId, $user['id'], 'SMS_SIMULATED', 'staff', $t['user_id'], "SMS simulated to teacher {$t['name']} ({$t['phone']}): Principal comment on {$className}.");
                }
                if ($t['email']) {
                    Auth::logAction($schoolId, $user['id'], 'EMAIL_SIMULATED', 'staff', $t['user_id'], "Email simulated to teacher {$t['name']} ({$t['email']}): Principal comment on {$className}.");
                }
            }
        }

        // 3. Try staff lookup
        $stmtStaff = $db->prepare("SELECT name, user_id, email, phone FROM staff WHERE id=? AND school_id=?");
        $stmtStaff->execute([$refId, $schoolId]);
        $staff = $stmtStaff->fetch();
        if ($staff) {
            if ($staff['user_id']) {
                Auth::sendNotification($schoolId, $staff['user_id'], "Principal Feedback", "Principal left a comment: \"{$commentText}\"");
            }
            if ($staff['phone']) {
                Auth::logAction($schoolId, $user['id'], 'SMS_SIMULATED', 'staff', $staff['user_id'], "SMS simulated to staff {$staff['name']} ({$staff['phone']}): \"{$commentText}\"");
            }
            if ($staff['email']) {
                Auth::logAction($schoolId, $user['id'], 'EMAIL_SIMULATED', 'staff', $staff['user_id'], "Email simulated to staff {$staff['name']} ({$staff['email']}): \"{$commentText}\"");
            }
        }
    }

    Auth::sendResponse(["id" => $commentId], null, 201);
});

// Subjects per school
$router->get('/schools/{schoolId}/subjects', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db   = Database::getConnection();
    Auth::sendResponse($db->query("SELECT id, name, code, level FROM subjects WHERE is_active=1 ORDER BY name ASC")->fetchAll());
});
