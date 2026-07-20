<?php
$router->get('/schools/{schoolId}/announcements', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db      = Database::getConnection();
    $classId = $_GET['class_id'] ?? null;
    if ($classId) {
        $stmt = $db->prepare("SELECT a.*, c.name as class_name FROM announcements a LEFT JOIN classes c ON a.class_id=c.id WHERE a.school_id=? AND (a.class_id=? OR a.class_id IS NULL) ORDER BY a.created_at DESC LIMIT 50");
        $stmt->execute([$schoolId, $classId]);
    } else {
        $stmt = $db->prepare("SELECT a.*, c.name as class_name FROM announcements a LEFT JOIN classes c ON a.class_id=c.id WHERE a.school_id=? ORDER BY a.created_at DESC LIMIT 50");
        $stmt->execute([$schoolId]);
    }
    Auth::sendResponse($stmt->fetchAll());
});

$router->post('/schools/{schoolId}/announcements', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'teacher', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['title']) || empty($input['body'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "title and body are required."], 400);
    $annId = Database::generateUniqueId('announcements');
    $db    = Database::getConnection();
    $db->prepare("INSERT INTO announcements (id, school_id, class_id, title, body, expires_at, created_by) VALUES (?,?,?,?,?,?,?)")
       ->execute([$annId, $schoolId, $input['class_id'] ?? null, htmlspecialchars($input['title']), htmlspecialchars($input['body']), $input['expires_at'] ?? null, $user['id']]);
    Auth::sendResponse(["id" => $annId], null, 201);
});

$router->delete('/schools/{schoolId}/announcements/{annId}', function($schoolId, $annId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db = Database::getConnection();
    $db->prepare("DELETE FROM announcements WHERE id=? AND school_id=?")->execute([$annId, $schoolId]);
    Auth::sendResponse(null, null, 204);
});

// ── Discipline ────────────────────────────────────────────────────────────────
$router->get('/schools/{schoolId}/discipline', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin', 'teacher', 'parent']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db         = Database::getConnection();
    $conditions = ["di.school_id=?"];
    $params     = [$schoolId];

    if ($user['role'] === 'teacher') {
        $stmtStaff = $db->prepare("SELECT class_id FROM staff WHERE school_id=? AND user_id=? LIMIT 1");
        $stmtStaff->execute([$schoolId, $user['id']]);
        $staffRow = $stmtStaff->fetch();
        $tcId     = $staffRow ? $staffRow['class_id'] : null;
        if ($tcId) { $conditions[] = "s.class_id=?"; $params[] = $tcId; }
        else Auth::sendResponse([], null, 200, ["page" => 1, "per_page" => 20, "total" => 0]);
    } elseif ($user['role'] === 'parent') {
        $stmtG = $db->prepare("SELECT id FROM guardians WHERE user_id=? AND school_id=? LIMIT 1");
        $stmtG->execute([$user['id'], $schoolId]);
        $guardian = $stmtG->fetch();
        if ($guardian) {
            $stmtC = $db->prepare("SELECT student_id FROM student_guardians WHERE guardian_id=?");
            $stmtC->execute([$guardian['id']]);
            $childIds = array_column($stmtC->fetchAll(), 'student_id');
            if (!empty($childIds)) {
                $phs = implode(',', array_fill(0, count($childIds), '?'));
                $conditions[] = "di.student_id IN ($phs)";
                foreach ($childIds as $cid) { $params[] = $cid; }
            } else Auth::sendResponse([], null, 200, ["page" => 1, "per_page" => 20, "total" => 0]);
        } else Auth::sendResponse([], null, 200, ["page" => 1, "per_page" => 20, "total" => 0]);
    }

    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, (int)($_GET['per_page'] ?? 20));
    $offset  = ($page - 1) * $perPage;
    $where   = implode(" AND ", $conditions);

    $stmtCount = $db->prepare("SELECT COUNT(*) FROM discipline_incidents di LEFT JOIN students s ON di.student_id=s.id WHERE $where");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmt = $db->prepare("SELECT di.*, CONCAT(s.first_name,' ',s.last_name) as student_name FROM discipline_incidents di LEFT JOIN students s ON di.student_id=s.id WHERE $where ORDER BY di.incident_date DESC LIMIT ? OFFSET ?");
    $i = 1; foreach ($params as $p) { $stmt->bindValue($i++, $p); }
    $stmt->bindValue($i++, $perPage, PDO::PARAM_INT);
    $stmt->bindValue($i++, $offset, PDO::PARAM_INT);
    $stmt->execute();
    Auth::sendResponse($stmt->fetchAll(), null, 200, ["page" => $page, "per_page" => $perPage, "total" => $total]);
});

$router->post('/schools/{schoolId}/students/{studentId}/discipline', function($schoolId, $studentId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['teacher', 'school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['incident_type']) || empty($input['description'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "incident_type and description are required."], 400);
    $id = Database::generateUniqueId('discipline_incidents');
    $db = Database::getConnection();
    $db->prepare("INSERT INTO discipline_incidents (id, school_id, student_id, incident_type, severity, description, action_taken, incident_date, status) VALUES (?,?,?,?,?,?,?,?,'open')")
       ->execute([$id, $schoolId, $studentId, $input['incident_type'], $input['severity'] ?? 'minor', $input['description'], $input['action_taken'] ?? null, $input['incident_date'] ?? date('Y-m-d')]);
    Auth::logAction($schoolId, $user['id'], 'INCIDENT_LOGGED', 'discipline_incidents', $id, "Incident logged for student #{$studentId}");
    Auth::sendResponse(["id" => $id], null, 201);
});

$router->patch('/schools/{schoolId}/discipline/{incidentId}', function($schoolId, $incidentId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['teacher', 'school_admin', 'super_admin']);
    $input = json_decode(file_get_contents('php://input'), true);
    $db    = Database::getConnection();
    $db->prepare("UPDATE discipline_incidents SET status=?, updated_at=NOW() WHERE id=? AND school_id=?")->execute([$input['status'] ?? 'resolved', $incidentId, $schoolId]);
    Auth::logAction($schoolId, $user['id'], 'INCIDENT_UPDATED', 'discipline_incidents', $incidentId, "Status → " . ($input['status'] ?? 'resolved'));
    Auth::sendResponse(["updated" => true]);
});

// ── Enquiries ─────────────────────────────────────────────────────────────────
$router->get('/schools/{schoolId}/enquiries', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db      = Database::getConnection();
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, (int)($_GET['per_page'] ?? 20));
    $offset  = ($page - 1) * $perPage;
    $status  = trim($_GET['status'] ?? '');
    $conditions = ["school_id=?"]; $params = [$schoolId];
    if (!empty($status)) { $conditions[] = "status=?"; $params[] = $status; }
    $where = implode(" AND ", $conditions);
    $stmtCount = $db->prepare("SELECT COUNT(*) FROM enquiries WHERE $where");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();
    $stmt = $db->prepare("SELECT * FROM enquiries WHERE $where ORDER BY created_at DESC LIMIT ? OFFSET ?");
    $i = 1; foreach ($params as $p) { $stmt->bindValue($i++, $p); }
    $stmt->bindValue($i++, $perPage, PDO::PARAM_INT);
    $stmt->bindValue($i++, $offset, PDO::PARAM_INT);
    $stmt->execute();
    Auth::sendResponse($stmt->fetchAll(), null, 200, ["page" => $page, "per_page" => $perPage, "total" => $total]);
});

$router->post('/schools/{schoolId}/enquiries', function($schoolId) {
    $user  = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['applicant_name']) || empty($input['grade_applying_for']) || empty($input['guardian_name'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "applicant_name, grade_applying_for, guardian_name are required."], 400);
    $id = Database::generateUniqueId('enquiries');
    $db = Database::getConnection();
    $db->prepare("INSERT INTO enquiries (id, school_id, applicant_name, grade_applying_for, guardian_name, guardian_phone, guardian_email, notes, status) VALUES (?,?,?,?,?,?,?,?,'new')")
       ->execute([$id, $schoolId, $input['applicant_name'], $input['grade_applying_for'], $input['guardian_name'], $input['guardian_phone'] ?? null, $input['guardian_email'] ?? null, $input['notes'] ?? null]);
    
    Auth::logAction($schoolId, $user['id'], 'ENQUIRY_CREATED', 'enquiries', $id, "New enquiry: {$input['applicant_name']}");

    // Notify school admins about the new admissions enquiry
    $stmtAdmins = $db->prepare("SELECT id FROM users WHERE school_id=? AND role='school_admin' AND status='active'");
    $stmtAdmins->execute([$schoolId]);
    $admins = $stmtAdmins->fetchAll();
    foreach ($admins as $admin) {
        Auth::sendNotification($schoolId, $admin['id'], "New Admissions Enquiry", "A new admission enquiry has been submitted for applicant {$input['applicant_name']} by {$input['guardian_name']} (Grade: {$input['grade_applying_for']}).");
    }

    Auth::sendResponse(["id" => $id], null, 201);
});

$router->patch('/schools/{schoolId}/enquiries/{enquiryId}', function($schoolId, $enquiryId) {
    $user  = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input   = json_decode(file_get_contents('php://input'), true);
    $db      = Database::getConnection();
    $allowed = ['new','contacted','tour','offered','enrolled','declined'];
    $status  = in_array($input['status'] ?? '', $allowed) ? $input['status'] : null;
    if (!$status) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Invalid status."], 400);
    $db->prepare("UPDATE enquiries SET status=?, updated_at=NOW() WHERE id=? AND school_id=?")->execute([$status, $enquiryId, $schoolId]);
    Auth::logAction($schoolId, $user['id'], 'ENQUIRY_STATUS_UPDATED', 'enquiries', $enquiryId, "Status → $status");
    Auth::sendResponse(["updated" => true]);
});

$router->post('/schools/{schoolId}/enquiries/{enquiryId}/convert', function($schoolId, $enquiryId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM enquiries WHERE id=? AND school_id=?");
    $stmt->execute([$enquiryId, $schoolId]);
    $enq = $stmt->fetch();
    if (!$enq) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Enquiry not found."], 404);
    $nameParts = explode(' ', $enq['applicant_name'], 2);
    $studentId = Database::generateUniqueId('students');
    $admNum    = 'ADM-' . mt_rand(100000, 999999);
    $db->prepare("INSERT INTO students (id, school_id, admission_number, first_name, last_name, status) VALUES (?,?,?,?,?,'enrolled')")
       ->execute([$studentId, $schoolId, $admNum, $nameParts[0], $nameParts[1] ?? '']);
    $db->prepare("UPDATE enquiries SET status='enrolled' WHERE id=?")->execute([$enquiryId]);
    Auth::logAction($schoolId, $user['id'], 'ENQUIRY_CONVERTED', 'students', $studentId, "Converted enquiry #{$enquiryId} → student #{$studentId}");
    Auth::sendResponse(["student_id" => $studentId], null, 201);
});

// ── Timetable ─────────────────────────────────────────────────────────────────
$router->get('/schools/{schoolId}/timetable', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db      = Database::getConnection();
    $classId = $_GET['class_id'] ?? null;
    if (!$classId) Auth::sendResponse([], null, 200);
    $stmt = $db->prepare("SELECT * FROM timetable WHERE school_id=? AND class_id=? ORDER BY FIELD(day,'Monday','Tuesday','Wednesday','Thursday','Friday'), period ASC");
    $stmt->execute([$schoolId, $classId]);
    Auth::sendResponse($stmt->fetchAll());
});

$router->put('/schools/{schoolId}/timetable/{slotId}', function($schoolId, $slotId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input = json_decode(file_get_contents('php://input'), true);
    $db    = Database::getConnection();
    $check = $db->prepare("SELECT id FROM timetable WHERE school_id=? AND class_id=? AND day=? AND period=?");
    $check->execute([$schoolId, $input['class_id'], $input['day'], $input['period']]);
    $existing = $check->fetch();
    if ($existing) {
        $db->prepare("UPDATE timetable SET subject=?, teacher=?, updated_at=NOW() WHERE id=?")->execute([$input['subject'], $input['teacher'], $existing['id']]);
    } else {
        $newId = Database::generateUniqueId('timetable');
        $db->prepare("INSERT INTO timetable (id, school_id, class_id, day, period, subject, teacher) VALUES (?,?,?,?,?,?,?)")->execute([$newId, $schoolId, $input['class_id'], $input['day'], $input['period'], $input['subject'], $input['teacher']]);
    }
    Auth::logAction($schoolId, $user['id'], 'TIMETABLE_UPDATED', 'timetable', null, "Slot {$input['day']} {$input['period']} class #{$input['class_id']}");
    Auth::sendResponse(["updated" => true]);
});

$router->delete('/schools/{schoolId}/timetable/{slotId}', function($schoolId, $slotId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db    = Database::getConnection();
    $check = $db->prepare("SELECT id FROM timetable WHERE id=? AND school_id=?");
    $check->execute([$slotId, $schoolId]);
    if (!$check->fetch()) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Timetable slot not found."], 404);
    $db->prepare("DELETE FROM timetable WHERE id=? AND school_id=?")->execute([$slotId, $schoolId]);
    Auth::logAction($schoolId, $user['id'], 'TIMETABLE_SLOT_DELETED', 'timetable', $slotId, "Deleted timetable slot #{$slotId}");
    Auth::sendResponse(null, null, 204);
});

// ── Exams ─────────────────────────────────────────────────────────────────────
$router->get('/schools/{schoolId}/exams', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db   = Database::getConnection();
    $term = trim($_GET['term'] ?? '');
    if ($term) {
        $stmt = $db->prepare("SELECT e.*, c.name as class_name FROM exams e LEFT JOIN classes c ON e.class_id=c.id WHERE e.school_id=? AND e.term=? ORDER BY e.exam_date ASC, e.start_time ASC");
        $stmt->execute([$schoolId, $term]);
    } else {
        $stmt = $db->prepare("SELECT e.*, c.name as class_name FROM exams e LEFT JOIN classes c ON e.class_id=c.id WHERE e.school_id=? ORDER BY e.exam_date DESC LIMIT 50");
        $stmt->execute([$schoolId]);
    }
    Auth::sendResponse($stmt->fetchAll());
});

$router->post('/schools/{schoolId}/exams', function($schoolId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'teacher', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['class_id']) || empty($input['subject']) || empty($input['exam_date']) || empty($input['start_time'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "class_id, subject, exam_date, start_time are required."], 400);
    Auth::validateDate($input['exam_date'], 'exam_date');
    $db          = Database::getConnection();
    $currentTerm = Database::getCurrentTerm($schoolId);
    $examId      = Database::generateUniqueId('exams');
    $db->prepare("INSERT INTO exams (id, school_id, class_id, term, subject, exam_date, start_time, duration_minutes, room, invigilator) VALUES (?,?,?,?,?,?,?,?,?,?)")
       ->execute([$examId, $schoolId, $input['class_id'], $input['term'] ?? $currentTerm, $input['subject'], $input['exam_date'], $input['start_time'], $input['duration_minutes'] ?? 120, $input['room'] ?? null, $input['invigilator'] ?? null]);
    Auth::sendResponse(["id" => $examId], null, 201);
});

// ── Health Records ─────────────────────────────────────────────────────────────
$router->get('/schools/{schoolId}/students/{studentId}/health', function($schoolId, $studentId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'teacher', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM student_health WHERE student_id=? AND school_id=?");
    $stmt->execute([$studentId, $schoolId]);
    Auth::sendResponse($stmt->fetch() ?: (object)[]);
});

$router->put('/schools/{schoolId}/students/{studentId}/health', function($schoolId, $studentId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input = json_decode(file_get_contents('php://input'), true);
    $db    = Database::getConnection();
    $fields = [$input['blood_group'] ?? null, $input['allergies'] ?? null, $input['medical_conditions'] ?? null, $input['emergency_contact_name'] ?? null, $input['emergency_contact_phone'] ?? null, $input['confidential_notes'] ?? null];
    $check = $db->prepare("SELECT id FROM student_health WHERE student_id=? AND school_id=?");
    $check->execute([$studentId, $schoolId]);
    if ($check->fetch()) {
        $db->prepare("UPDATE student_health SET blood_group=?, allergies=?, medical_conditions=?, emergency_contact_name=?, emergency_contact_phone=?, confidential_notes=?, updated_at=NOW() WHERE student_id=? AND school_id=?")
           ->execute(array_merge($fields, [$studentId, $schoolId]));
    } else {
        $healthId = Database::generateUniqueId('student_health');
        $db->prepare("INSERT INTO student_health (id, school_id, student_id, blood_group, allergies, medical_conditions, emergency_contact_name, emergency_contact_phone, confidential_notes) VALUES (?,?,?,?,?,?,?,?,?)")
           ->execute(array_merge([$healthId, $schoolId, $studentId], $fields));
    }
    Auth::logAction($schoolId, $user['id'], 'HEALTH_RECORD_UPDATED', 'student_health', $studentId, "Updated health record for student #{$studentId}");
    Auth::sendResponse(["updated" => true]);
});

// ── Assets ────────────────────────────────────────────────────────────────────
$router->get('/schools/{schoolId}/assets', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db      = Database::getConnection();
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, (int)($_GET['per_page'] ?? 20));
    $offset  = ($page - 1) * $perPage;
    $category = trim($_GET['category'] ?? '');
    $status   = trim($_GET['status']   ?? '');
    $search   = trim($_GET['search']   ?? '');
    $conditions = ["a.school_id=?"]; $params = [$schoolId];
    if ($category) { $conditions[] = "a.category=?"; $params[] = $category; }
    if ($status)   { $conditions[] = "a.status=?";   $params[] = $status; }
    if ($search)   { $conditions[] = "(a.name LIKE ? OR a.code LIKE ? OR a.serial_number LIKE ?)"; $sp="%$search%"; $params[]=$sp;$params[]=$sp;$params[]=$sp; }
    $where = implode(" AND ", $conditions);
    $stmtC = $db->prepare("SELECT COUNT(*) FROM assets a WHERE {$where}"); $stmtC->execute($params);
    $total = (int)$stmtC->fetchColumn();
    $sql   = "SELECT a.*, CASE WHEN a.holder_type='student' THEN CONCAT(s.first_name,' ',s.last_name) WHEN a.holder_type='staff' THEN st.name ELSE NULL END as holder_name FROM assets a LEFT JOIN students s ON a.holder_id=s.id AND a.holder_type='student' LEFT JOIN staff st ON a.holder_id=st.id AND a.holder_type='staff' WHERE {$where} ORDER BY a.name ASC LIMIT ? OFFSET ?";
    $stmt  = $db->prepare($sql);
    $bindIdx = 1; foreach ($params as $p) { $stmt->bindValue($bindIdx++, $p); }
    $stmt->bindValue($bindIdx++, $perPage, PDO::PARAM_INT);
    $stmt->bindValue($bindIdx++, $offset, PDO::PARAM_INT);
    $stmt->execute();
    $stmtMetrics = $db->prepare("SELECT COALESCE(SUM(value),0.00) as total_value, COUNT(*) as total_count, COUNT(CASE WHEN status='available' THEN 1 END) as available_count, COUNT(CASE WHEN status='issued' THEN 1 END) as issued_count, COUNT(CASE WHEN status='damaged' THEN 1 END) as damaged_count, COUNT(CASE WHEN status='lost' THEN 1 END) as lost_count FROM assets WHERE school_id=?");
    $stmtMetrics->execute([$schoolId]);
    Auth::sendResponse($stmt->fetchAll(), null, 200, ["page" => $page, "per_page" => $perPage, "total" => $total, "metrics" => $stmtMetrics->fetch()]);
});

$router->post('/schools/{schoolId}/assets', function($schoolId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input   = json_decode(file_get_contents('php://input'), true);
    if (empty($input['name'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "name is required."], 400);
    $assetId = Database::generateUniqueId('assets');
    $db      = Database::getConnection();
    $db->prepare("INSERT INTO assets (id, school_id, name, category, code, serial_number, value, description, metadata, status) VALUES (?,?,?,?,?,?,?,?,?,'available')")
       ->execute([$assetId, $schoolId, trim($input['name']), $input['category'] ?? 'book', $input['code'] ?? null, $input['serial_number'] ?? null, (float)($input['value'] ?? 0), $input['description'] ?? null, isset($input['metadata']) ? (is_string($input['metadata']) ? $input['metadata'] : json_encode($input['metadata'])) : null]);
    Auth::logAction($schoolId, $user['id'], 'ASSET_CREATED', 'assets', $assetId, "Added asset: " . trim($input['name']));
    Auth::sendResponse(["id" => $assetId], null, 201);
});

$router->patch('/schools/{schoolId}/assets/{assetId}', function($schoolId, $assetId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input = json_decode(file_get_contents('php://input'), true);
    $db    = Database::getConnection();
    $check = $db->prepare("SELECT id FROM assets WHERE id=? AND school_id=?"); $check->execute([$assetId,$schoolId]);
    if (!$check->fetch()) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Asset not found."], 404);
    $db->prepare("UPDATE assets SET name=?, category=?, code=?, serial_number=?, value=?, description=?, metadata=?, status=? WHERE id=? AND school_id=?")
       ->execute([trim($input['name']), $input['category'] ?? 'book', $input['code'] ?? null, $input['serial_number'] ?? null, (float)($input['value'] ?? 0), $input['description'] ?? null, isset($input['metadata']) ? (is_string($input['metadata']) ? $input['metadata'] : json_encode($input['metadata'])) : null, $input['status'] ?? 'available', $assetId, $schoolId]);
    Auth::logAction($schoolId, $user['id'], 'ASSET_UPDATED', 'assets', $assetId, "Updated asset #{$assetId}");
    Auth::sendResponse(["updated" => true]);
});

$router->delete('/schools/{schoolId}/assets/{assetId}', function($schoolId, $assetId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db    = Database::getConnection();
    $check = $db->prepare("SELECT name FROM assets WHERE id=? AND school_id=?"); $check->execute([$assetId, $schoolId]);
    $asset = $check->fetch();
    if (!$asset) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Asset not found."], 404);
    $db->prepare("DELETE FROM assets WHERE id=? AND school_id=?")->execute([$assetId, $schoolId]);
    Auth::logAction($schoolId, $user['id'], 'ASSET_DELETED', 'assets', $assetId, "Deleted asset: {$asset['name']}");
    Auth::sendResponse(null, null, 204);
});

$router->post('/schools/{schoolId}/assets/{assetId}/issue', function($schoolId, $assetId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['holder_id']) || empty($input['holder_type'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "holder_id and holder_type are required."], 400);
    if (!in_array($input['holder_type'], ['student','staff'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "holder_type must be 'student' or 'staff'."], 400);
    $db = Database::getConnection();
    $check = $db->prepare("SELECT name, status FROM assets WHERE id=? AND school_id=?"); $check->execute([$assetId, $schoolId]);
    $asset = $check->fetch();
    if (!$asset) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Asset not found."], 404);
    if ($asset['status'] !== 'available') Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "Asset not available (Status: {$asset['status']})."], 409);
    $db->prepare("UPDATE assets SET status='issued', holder_id=?, holder_type=? WHERE id=? AND school_id=?")->execute([$input['holder_id'], $input['holder_type'], $assetId, $schoolId]);
    Auth::logAction($schoolId, $user['id'], 'ASSET_ISSUED', 'assets', $assetId, "Issued asset '{$asset['name']}' to {$input['holder_type']} #{$input['holder_id']}");
    Auth::sendResponse(["issued" => true]);
});

$router->post('/schools/{schoolId}/assets/{assetId}/return', function($schoolId, $assetId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db    = Database::getConnection();
    $check = $db->prepare("SELECT name FROM assets WHERE id=? AND school_id=?"); $check->execute([$assetId, $schoolId]);
    $asset = $check->fetch();
    if (!$asset) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Asset not found."], 404);
    $db->prepare("UPDATE assets SET status='available', holder_id=NULL, holder_type=NULL WHERE id=? AND school_id=?")->execute([$assetId, $schoolId]);
    Auth::logAction($schoolId, $user['id'], 'ASSET_RETURNED', 'assets', $assetId, "Returned asset '{$asset['name']}' to stock");
    Auth::sendResponse(["updated" => true]);
});

$router->get('/schools/{schoolId}/asset-categories', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM asset_categories WHERE school_id IS NULL OR school_id=? ORDER BY name ASC");
    $stmt->execute([$schoolId]);
    Auth::sendResponse($stmt->fetchAll());
});

$router->post('/schools/{schoolId}/asset-categories', function($schoolId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['name']) || empty($input['code'])) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "name and code are required."], 400);
    $db = Database::getConnection();
    $dup = $db->prepare("SELECT id FROM asset_categories WHERE code=?"); $dup->execute([trim($input['code'])]);
    if ($dup->fetch()) Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "Category code already exists."], 409);
    $catId = Database::generateUniqueId('asset_categories');
    $db->prepare("INSERT INTO asset_categories (id, school_id, name, code, color_class) VALUES (?,?,?,?,?)")
       ->execute([$catId, $schoolId, trim($input['name']), trim($input['code']), $input['color_class'] ?? 'text-blue-500 bg-blue-50']);
    Auth::logAction($schoolId, $user['id'], 'ASSET_CATEGORY_CREATED', 'asset_categories', $catId, "Created category: " . trim($input['name']));
    Auth::sendResponse(["id" => $catId], null, 201);
});

// ── Notification Settings ──────────────────────────────────────────────────────
$router->get('/schools/{schoolId}/notification-settings', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM notification_settings WHERE school_id=?");
    $stmt->execute([$schoolId]);
    Auth::sendResponse($stmt->fetch() ?: (object)[]);
});

$router->put('/schools/{schoolId}/notification-settings', function($schoolId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $input = json_decode(file_get_contents('php://input'), true);
    $db    = Database::getConnection();
    $check = $db->prepare("SELECT id FROM notification_settings WHERE school_id=?"); $check->execute([$schoolId]);
    $vals  = [$input['sms_gateway_url']??null,$input['sms_api_key']??null,$input['sms_sender_id']??null,$input['email_smtp_host']??null,(int)($input['email_smtp_port']??587),$input['email_smtp_user']??null,$input['email_smtp_pass']??null,$input['email_from_address']??null,$input['email_from_name']??null,$input['payment_gateway_type']??'mock',$input['payment_merchant_id']??null,$input['payment_merchant_key']??null,$input['payment_api_url']??null,(int)($input['notify_attendance_absent']??1),(int)($input['notify_results_published']??1),(int)($input['notify_fees_overdue']??1),(int)($input['notify_discipline_incident']??1)];
    if ($check->fetch()) {
        $stmt = $db->prepare("UPDATE notification_settings SET sms_gateway_url=?,sms_api_key=?,sms_sender_id=?,email_smtp_host=?,email_smtp_port=?,email_smtp_user=?,email_smtp_pass=?,email_from_address=?,email_from_name=?,payment_gateway_type=?,payment_merchant_id=?,payment_merchant_key=?,payment_api_url=?,notify_attendance_absent=?,notify_results_published=?,notify_fees_overdue=?,notify_discipline_incident=?,updated_at=NOW() WHERE school_id=?");
        $stmt->execute(array_merge($vals, [$schoolId]));
    } else {
        $settingsId = Database::generateUniqueId('notification_settings');
        $stmt = $db->prepare("INSERT INTO notification_settings (id,school_id,sms_gateway_url,sms_api_key,sms_sender_id,email_smtp_host,email_smtp_port,email_smtp_user,email_smtp_pass,email_from_address,email_from_name,payment_gateway_type,payment_merchant_id,payment_merchant_key,payment_api_url,notify_attendance_absent,notify_results_published,notify_fees_overdue,notify_discipline_incident) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute(array_merge([$settingsId, $schoolId], $vals));
    }
    Auth::logAction($schoolId, $user['id'], 'GATEWAY_SETTINGS_UPDATED', 'notification_settings', null, "Updated SMS, Email & Payment configurations");
    Auth::sendResponse(["updated" => true]);
});

// ── Principal Dashboard Extended ──────────────────────────────────────────────
$router->get('/schools/{schoolId}/dashboard/extended', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin', 'teacher', 'parent']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    $db    = Database::getConnection();
    $today = date('Y-m-d');

    $totalStudents    = (int)$db->prepare("SELECT COUNT(*) FROM students WHERE school_id=? AND status='enrolled'")->execute([$schoolId]) && $db->prepare("SELECT COUNT(*) FROM students WHERE school_id=? AND status='enrolled'")->execute([$schoolId]) ? 0 : 0;
    // --- re-query properly ---
    $s1 = $db->prepare("SELECT COUNT(*) FROM students WHERE school_id=? AND status='enrolled'"); $s1->execute([$schoolId]); $totalStudents = (int)$s1->fetchColumn();
    $s2 = $db->prepare("SELECT COUNT(DISTINCT class_id) FROM attendance WHERE school_id=? AND date=?"); $s2->execute([$schoolId, $today]); $registersSubmitted = (int)$s2->fetchColumn();
    $s3 = $db->prepare("SELECT COUNT(*) FROM classes WHERE school_id=?"); $s3->execute([$schoolId]); $totalClasses = (int)$s3->fetchColumn();
    $s4 = $db->prepare("SELECT ROUND(COUNT(CASE WHEN a.status='present' THEN 1 END)*100.0/NULLIF(COUNT(*),0),1) FROM attendance a WHERE a.school_id=? AND a.date=?"); $s4->execute([$schoolId, $today]); $attendanceTodayPct = $s4->fetchColumn() ?? 0;
    $s5 = $db->prepare("SELECT ROUND(SUM(amount_paid)*100.0/NULLIF(SUM(amount_due),0),1) FROM fees WHERE school_id=?"); $s5->execute([$schoolId]); $feesCollectedPct = $s5->fetchColumn() ?? 0;
    $s6 = $db->prepare("SELECT COUNT(*) FROM exams WHERE school_id=? AND exam_date BETWEEN ? AND DATE_ADD(?,INTERVAL 7 DAY)"); $s6->execute([$schoolId, $today, $today]); $upcomingExams = (int)$s6->fetchColumn();
    $s7 = $db->prepare("SELECT COUNT(*) FROM discipline_incidents WHERE school_id=? AND status='open'"); $s7->execute([$schoolId]); $openIncidents = (int)$s7->fetchColumn();
    $s8 = $db->prepare("SELECT COUNT(*) FROM staff WHERE school_id=?"); $s8->execute([$schoolId]); $totalStaff = (int)$s8->fetchColumn();

    $stmtClasses = $db->prepare("SELECT c.id, c.name, c.grade_level,
        (SELECT name FROM staff WHERE class_id=c.id LIMIT 1) AS teacher_name,
        (SELECT COUNT(*) FROM attendance a WHERE a.class_id=c.id AND a.date=? AND a.status='present') AS present,
        (SELECT COUNT(*) FROM attendance a WHERE a.class_id=c.id AND a.date=?) AS total
        FROM classes c WHERE c.school_id=? ORDER BY c.grade_level, c.name");
    $stmtClasses->execute([$today, $today, $schoolId]);
    $attendanceDetail = $stmtClasses->fetchAll();
    foreach ($attendanceDetail as &$cls) {
        $cls['absent'] = $cls['total'] - $cls['present'];
        $cls['pct']    = $cls['total'] > 0 ? round($cls['present'] * 100 / $cls['total'], 1) : 0;
        $cls['status'] = $cls['total'] > 0 ? 'submitted' : 'pending';
    }

    $stmtLic = $db->prepare("SELECT plan, status, expires_at FROM licenses WHERE school_id=? AND status='active' ORDER BY expires_at DESC LIMIT 1");
    $stmtLic->execute([$schoolId]);
    $licenseData = $stmtLic->fetch();
    $licenseInfo = null;
    if ($licenseData) {
        $daysLeft   = ceil((strtotime($licenseData['expires_at']) - time()) / (24*60*60));
        $licenseInfo = ["plan" => $licenseData['plan'], "status" => $licenseData['status'], "expires_at" => $licenseData['expires_at'], "days_left" => $daysLeft, "warning" => ($daysLeft <= 30 && $daysLeft >= 0)];
    }

    // Extended Stats queries for Dashboard hydration
    $stmtGrades = $db->prepare("SELECT c.name as class_name, g.subject, ROUND(AVG(g.grade_value), 1) as avg_score
                                FROM grades g
                                JOIN classes c ON g.class_id = c.id
                                WHERE g.school_id = ?
                                GROUP BY c.id, c.name, g.subject
                                ORDER BY c.name ASC, avg_score DESC");
    $stmtGrades->execute([$schoolId]);
    $gradeAverages = $stmtGrades->fetchAll();

    $stmtTop = $db->prepare("SELECT s.id, CONCAT(s.first_name, ' ', s.last_name) as name, c.name as class_name, ROUND(AVG(g.grade_value), 1) as avg_grade
                             FROM grades g
                             JOIN students s ON g.student_id = s.id
                             JOIN classes c ON s.class_id = c.id
                             WHERE g.school_id = ?
                             GROUP BY s.id, s.first_name, s.last_name, c.name
                             ORDER BY avg_grade DESC LIMIT 5");
    $stmtTop->execute([$schoolId]);
    $topStudents = $stmtTop->fetchAll();

    $stmtBottom = $db->prepare("SELECT s.id, CONCAT(s.first_name, ' ', s.last_name) as name, c.name as class_name, ROUND(AVG(g.grade_value), 1) as avg_grade
                                FROM grades g
                                JOIN students s ON g.student_id = s.id
                                JOIN classes c ON s.class_id = c.id
                                WHERE g.school_id = ?
                                GROUP BY s.id, s.first_name, s.last_name, c.name
                                ORDER BY avg_grade ASC LIMIT 5");
    $stmtBottom->execute([$schoolId]);
    $bottomStudents = $stmtBottom->fetchAll();

    $stmtFeeDonut = $db->prepare("SELECT status, COUNT(*) as count FROM fees WHERE school_id = ? GROUP BY status");
    $stmtFeeDonut->execute([$schoolId]);
    $feeDonutRaw = $stmtFeeDonut->fetchAll();
    $feeDonut = ["paid" => 0, "partial" => 0, "unpaid" => 0];
    foreach ($feeDonutRaw as $r) {
        $feeDonut[$r['status']] = (int)$r['count'];
    }

    $stmtFeeBreakdown = $db->prepare("SELECT c.name as class_name,
                                             COUNT(s.id) as total_students,
                                             SUM(CASE WHEN f.status='paid' THEN 1 ELSE 0 END) as fully_paid,
                                             SUM(CASE WHEN f.status='partial' THEN 1 ELSE 0 END) as partial,
                                             SUM(CASE WHEN f.status='unpaid' THEN 1 ELSE 0 END) as unpaid,
                                             ROUND(SUM(f.amount_paid)*100.0/NULLIF(SUM(f.amount_due),0),1) as collection_pct
                                      FROM fees f
                                      JOIN students s ON f.student_id = s.id
                                      JOIN classes c ON s.class_id = c.id
                                      WHERE f.school_id = ?
                                      GROUP BY c.id, c.name ORDER BY c.name");
    $stmtFeeBreakdown->execute([$schoolId]);
    $feeBreakdown = $stmtFeeBreakdown->fetchAll();

    $stmtStaff = $db->prepare("SELECT u.username, u.role, NULL as last_login,
                                      COALESCE(st.name, 'Admin') as name,
                                      (SELECT COUNT(*) FROM attendance WHERE taken_by = u.id AND date = ?) as registers_today,
                                      (SELECT COUNT(*) FROM grades WHERE school_id = ? AND date(created_at) = ?) as grades_today
                               FROM users u
                               LEFT JOIN staff st ON u.id = st.user_id
                               WHERE u.school_id = ? AND u.role IN ('teacher', 'school_admin')
                               ORDER BY st.name ASC");
    $stmtStaff->execute([$today, $schoolId, $today, $schoolId]);
    $staffActivity = $stmtStaff->fetchAll();

    $stmtExams = $db->prepare("SELECT e.subject, e.exam_date, e.exam_type, e.start_time, c.name as class_name
                               FROM exams e
                               JOIN classes c ON e.class_id = c.id
                               WHERE e.school_id = ? AND e.exam_date >= ?
                               ORDER BY e.exam_date ASC LIMIT 5");
    $stmtExams->execute([$schoolId, $today]);
    $upcomingExamsList = $stmtExams->fetchAll();

    $stmtDiscipline = $db->prepare("SELECT CONCAT(s.first_name, ' ', s.last_name) as student_name, c.name as class_name,
                                           di.incident_type, di.action_taken, di.status, di.incident_date
                                    FROM discipline_incidents di
                                    JOIN students s ON di.student_id = s.id
                                    JOIN classes c ON s.class_id = c.id
                                    WHERE di.school_id = ?
                                    ORDER BY di.incident_date DESC LIMIT 5");
    $stmtDiscipline->execute([$schoolId]);
    $disciplineFeed = $stmtDiscipline->fetchAll();

    $stmtComments = $db->prepare("SELECT rc.report_type, rc.comment, u.username as author, rc.created_at
                                  FROM report_comments rc
                                  JOIN users u ON rc.created_by = u.id
                                  WHERE rc.school_id = ?
                                  ORDER BY rc.created_at DESC LIMIT 10");
    $stmtComments->execute([$schoolId]);
    $recentComments = $stmtComments->fetchAll();

    // Query overdue tasks for admin dashboard oversight
    $stmtOverdue = $db->prepare("SELECT t.*, c.name as class_name, sub.name as subject_name, s.name as teacher_name
                                 FROM tasks t
                                 JOIN classes c ON t.class_id = c.id
                                 JOIN subjects sub ON t.subject_id = sub.id
                                 JOIN users u ON t.teacher_id = u.id
                                 LEFT JOIN staff s ON u.id = s.user_id
                                 WHERE t.school_id = ? AND t.status = 'overdue'
                                 ORDER BY t.due_date ASC LIMIT 10");
    $stmtOverdue->execute([$schoolId]);
    $overdueTasksList = $stmtOverdue->fetchAll();

    Auth::sendResponse([
        "kpis" => ["total_students" => $totalStudents, "total_classes" => $totalClasses, "total_staff" => $totalStaff, "registers_submitted" => $registersSubmitted, "registers_pending" => $totalClasses - $registersSubmitted, "attendance_today_pct" => (float)$attendanceTodayPct, "fees_collected_pct" => (float)$feesCollectedPct, "upcoming_exams" => $upcomingExams, "open_incidents" => $openIncidents],
        "attendance_detail" => $attendanceDetail,
        "license"           => $licenseInfo,
        "grade_averages"    => $gradeAverages,
        "top_students"      => $topStudents,
        "bottom_students"   => $bottomStudents,
        "fee_donut"         => $feeDonut,
        "fee_breakdown"     => $feeBreakdown,
        "staff_activity"    => $staffActivity,
        "upcoming_exams"    => $upcomingExamsList,
        "discipline_feed"   => $disciplineFeed,
        "recent_comments"   => $recentComments,
        "overdue_tasks"     => $overdueTasksList
    ]);
});
