<?php

$router->get('/schools/{schoolId}/students', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }

    $db      = Database::getConnection();
    $page    = isset($_GET['page'])     ? max(1, (int)$_GET['page'])               : 1;
    $perPage = isset($_GET['per_page']) ? min(100, max(1, (int)$_GET['per_page'])) : 25;
    $offset  = ($page - 1) * $perPage;
    $search  = trim($_GET['search']   ?? '');
    $classId = trim($_GET['class_id'] ?? '');
    $status  = trim($_GET['status']   ?? '');

    $conditions = ["s.school_id = ?"];
    $params     = [$schoolId];

    if ($user['role'] === 'teacher') {
        $stmtStaff = $db->prepare("SELECT class_id FROM staff WHERE school_id=? AND user_id=? LIMIT 1");
        $stmtStaff->execute([$schoolId, $user['id']]);
        $staffRow = $stmtStaff->fetch();
        $teacherClassId = $staffRow ? $staffRow['class_id'] : null;
        if ($teacherClassId) {
            $conditions[] = "s.class_id = ?"; $params[] = $teacherClassId;
        } else {
            Auth::sendResponse([], null, 200, ["page" => 1, "per_page" => $perPage, "total" => 0]);
        }
    } elseif ($user['role'] === 'parent') {
        $stmtG = $db->prepare("SELECT id FROM guardians WHERE user_id=? AND school_id=? LIMIT 1");
        $stmtG->execute([$user['id'], $schoolId]);
        $guardian = $stmtG->fetch();
        if ($guardian) {
            $stmtC = $db->prepare("SELECT student_id FROM student_guardians WHERE guardian_id=?");
            $stmtC->execute([$guardian['id']]);
            $childIds = array_column($stmtC->fetchAll(), 'student_id');
            if (!empty($childIds)) {
                $placeholders = implode(',', array_fill(0, count($childIds), '?'));
                $conditions[] = "s.id IN ($placeholders)";
                foreach ($childIds as $cid) { $params[] = $cid; }
            } else {
                Auth::sendResponse([], null, 200, ["page" => 1, "per_page" => $perPage, "total" => 0]);
            }
        } else {
            Auth::sendResponse([], null, 200, ["page" => 1, "per_page" => $perPage, "total" => 0]);
        }
    } else {
        if (!empty($classId)) { $conditions[] = "s.class_id = ?"; $params[] = $classId; }
    }

    if (!empty($search)) {
        $conditions[] = "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)";
        $sp = "%{$search}%";
        $params[] = $sp; $params[] = $sp; $params[] = $sp;
    }
    if (!empty($status)) { $conditions[] = "s.status = ?"; $params[] = $status; }

    $whereClause = implode(" AND ", $conditions);
    $stmtCount   = $db->prepare("SELECT COUNT(*) FROM students s WHERE {$whereClause}");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $sql = "SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON s.class_id=c.id WHERE {$whereClause} ORDER BY s.last_name ASC, s.first_name ASC LIMIT ? OFFSET ?";
    $stmtData = $db->prepare($sql);
    $bindIdx  = 1;
    foreach ($params as $p) { $stmtData->bindValue($bindIdx++, $p); }
    $stmtData->bindValue($bindIdx++, $perPage, PDO::PARAM_INT);
    $stmtData->bindValue($bindIdx++, $offset,  PDO::PARAM_INT);
    $stmtData->execute();
    Auth::sendResponse($stmtData->fetchAll(), null, 200, ["page" => $page, "per_page" => $perPage, "total" => $total]);
});

// POST /schools/{schoolId}/students
$router->post('/schools/{schoolId}/students', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input  = json_decode(file_get_contents('php://input'), true);
    $required = ['admission_number', 'first_name', 'last_name', 'date_of_birth', 'gender'];
    $errors = [];
    foreach ($required as $f) { if (empty($input[$f])) $errors[$f] = 'required'; }
    if (!empty($errors)) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Required fields missing.", "fields" => $errors], 400);
    }
    // Validate date_of_birth format
    Auth::validateDate($input['date_of_birth'], 'date_of_birth');

    $db = Database::getConnection();
    $stmtCheck = $db->prepare("SELECT id FROM students WHERE school_id=? AND admission_number=?");
    $stmtCheck->execute([$schoolId, trim($input['admission_number'])]);
    if ($stmtCheck->fetch()) {
        Auth::sendResponse(null, ["code" => "DUPLICATE_ADMISSION", "message" => "Admission number already registered in this school."], 409);
    }

    $studentId = Database::generateUniqueId('students');
    $stmt = $db->prepare("INSERT INTO students (id, school_id, class_id, admission_number, first_name, last_name, middle_name, date_of_birth, gender, status, nationality, home_address, religion, previous_school, medical_notes)
                          VALUES (?,?,?,?,?,?,?,?,?,'enrolled',?,?,?,?,?)");
    $stmt->execute([
        $studentId, $schoolId,
        !empty($input['class_id']) ? $input['class_id'] : null,
        trim($input['admission_number']),
        trim($input['first_name']), trim($input['last_name']),
        !empty($input['middle_name'])     ? trim($input['middle_name'])     : null,
        $input['date_of_birth'], $input['gender'],
        !empty($input['nationality'])     ? trim($input['nationality'])     : null,
        !empty($input['home_address'])    ? trim($input['home_address'])    : null,
        !empty($input['religion'])        ? trim($input['religion'])        : null,
        !empty($input['previous_school']) ? trim($input['previous_school']) : null,
        !empty($input['medical_notes'])   ? trim($input['medical_notes'])   : null,
    ]);

    // Initialize fee record for current term
    $currentTerm = Database::getCurrentTerm($schoolId);
    $stmtBench   = $db->prepare("SELECT tuition_fee_benchmark FROM schools WHERE id=?");
    $stmtBench->execute([$schoolId]);
    $benchmark   = (float)($stmtBench->fetchColumn() ?: 500.00);
    $feeId       = Database::generateUniqueId('fees');
    $stmtFee     = $db->prepare("INSERT INTO fees (id, school_id, student_id, term, amount_due, amount_paid, status) VALUES (?,?,?,?,?,0.00,'unpaid')");
    $stmtFee->execute([$feeId, $schoolId, $studentId, $currentTerm, $benchmark]);

    // Guardian linking
    if (!empty($input['guardian_name'])) {
        $gName     = trim($input['guardian_name']);
        $gPhone    = !empty($input['guardian_phone'])       ? trim($input['guardian_phone'])       : null;
        $gEmail    = !empty($input['guardian_email'])       ? trim($input['guardian_email'])       : null;
        $gNatId    = !empty($input['guardian_national_id']) ? trim($input['guardian_national_id']) : null;
        $gRelation = !empty($input['guardian_relation'])    ? trim($input['guardian_relation'])    : 'Guardian';

        $guardianId = null;
        if ($gNatId) {
            $stmtFindG = $db->prepare("SELECT id FROM guardians WHERE school_id=? AND national_id=? LIMIT 1");
            $stmtFindG->execute([$schoolId, $gNatId]);
            $found = $stmtFindG->fetch();
            if ($found) $guardianId = $found['id'];
        }
        if (!$guardianId && $gPhone) {
            $stmtFindG = $db->prepare("SELECT id FROM guardians WHERE school_id=? AND phone=? LIMIT 1");
            $stmtFindG->execute([$schoolId, $gPhone]);
            $found = $stmtFindG->fetch();
            if ($found) $guardianId = $found['id'];
        }
        if (!$guardianId) {
            $guardianId  = Database::generateUniqueId('guardians');
            $stmtInsG    = $db->prepare("INSERT INTO guardians (id, school_id, national_id, name, phone, email, relation) VALUES (?,?,?,?,?,?,?)");
            $stmtInsG->execute([$guardianId, $schoolId, $gNatId, $gName, $gPhone, $gEmail, $gRelation]);
        }
        $stmtLink = $db->prepare("INSERT INTO student_guardians (student_id, guardian_id, relation) VALUES (?,?,?) ON DUPLICATE KEY UPDATE relation=VALUES(relation)");
        $stmtLink->execute([$studentId, $guardianId, $gRelation]);
    }

    Auth::logAction($schoolId, $user['id'], 'STUDENT_CREATED', 'students', $studentId, "Created student: {$input['first_name']} {$input['last_name']}");
    Auth::sendResponse(["id" => $studentId], null, 201);
});

// GET /schools/{schoolId}/students/{studentId}
$router->get('/schools/{schoolId}/students/{studentId}', function($schoolId, $studentId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON s.class_id=c.id WHERE s.id=? AND s.school_id=?");
    $stmt->execute([$studentId, $schoolId]);
    $student = $stmt->fetch();
    if (!$student) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Student not found."], 404);

    // Fetch guardian info
    $stmtG = $db->prepare("SELECT g.* FROM guardians g JOIN student_guardians sg ON g.id=sg.guardian_id WHERE sg.student_id=?");
    $stmtG->execute([$studentId]);
    $student['guardians'] = $stmtG->fetchAll();
    Auth::sendResponse($student);
});

// GET /schools/{schoolId}/students/{studentId}/profile
$router->get('/schools/{schoolId}/students/{studentId}/profile', function($schoolId, $studentId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db = Database::getConnection();

    // 1. Student details
    $stmt = $db->prepare("SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON s.class_id=c.id WHERE s.id=? AND s.school_id=?");
    $stmt->execute([$studentId, $schoolId]);
    $student = $stmt->fetch();
    if (!$student) Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Student not found."], 404);

    // Fetch guardian info to match the schema
    $stmtG = $db->prepare("SELECT g.* FROM guardians g JOIN student_guardians sg ON g.id=sg.guardian_id WHERE sg.student_id=?");
    $stmtG->execute([$studentId]);
    $student['guardians'] = $stmtG->fetchAll();

    // 2. Attendance summary
    $stmtAtt = $db->prepare("SELECT COUNT(*) as total_days,
                                    SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
                                    SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent
                             FROM attendance WHERE student_id=?");
    $stmtAtt->execute([$studentId]);
    $attData = $stmtAtt->fetch();
    $totalDays = (int)($attData['total_days'] ?? 0);
    $present = (int)($attData['present'] ?? 0);
    $absent = (int)($attData['absent'] ?? 0);
    $percentage = $totalDays > 0 ? round(($present / $totalDays) * 100, 1) : 100.0;
    $attendanceSummary = [
        "percentage" => $percentage,
        "present" => $present,
        "absent" => $absent,
        "total_days" => $totalDays
    ];

    // 2b. Detailed daily attendance list
    $stmtAttList = $db->prepare("SELECT date, status, remarks FROM attendance WHERE student_id=? ORDER BY date DESC LIMIT 60");
    $stmtAttList->execute([$studentId]);
    $attendanceList = $stmtAttList->fetchAll() ?: [];

    // 3. Grades summary
    $stmtGrades = $db->prepare("SELECT subject, term, assessment_type, grade_value FROM grades WHERE student_id=? ORDER BY term DESC, created_at DESC");
    $stmtGrades->execute([$studentId]);
    $gradesSummary = $stmtGrades->fetchAll();

    // 4. Fee summary
    $stmtFee = $db->prepare("SELECT id, term, amount_due, amount_paid, status FROM fees WHERE student_id=? ORDER BY term DESC LIMIT 1");
    $stmtFee->execute([$studentId]);
    $feeSummary = $stmtFee->fetch() ?: [
        "id" => null,
        "term" => "N/A",
        "amount_due" => 0.00,
        "amount_paid" => 0.00,
        "status" => "unpaid"
    ];

    // 5. Fee payments history
    $stmtFeeHistory = $db->prepare("SELECT fp.*, COALESCE(stf.name, u.username) as recorded_by 
                                    FROM fee_payments fp 
                                    LEFT JOIN users u ON fp.created_by=u.id 
                                    LEFT JOIN staff stf ON u.id = stf.user_id 
                                    WHERE fp.student_id=? 
                                    ORDER BY fp.payment_date DESC");
    $stmtFeeHistory->execute([$studentId]);
    $feeHistory = $stmtFeeHistory->fetchAll();

    // 6. Discipline history
    $stmtDiscipline = $db->prepare("SELECT * FROM discipline_incidents WHERE student_id=? ORDER BY incident_date DESC");
    $stmtDiscipline->execute([$studentId]);
    $disciplineHistory = $stmtDiscipline->fetchAll();

    // 7. Health history
    $stmtHealth = $db->prepare("SELECT * FROM student_health WHERE student_id=? AND school_id=? LIMIT 1");
    $stmtHealth->execute([$studentId, $schoolId]);
    $healthHistory = $stmtHealth->fetch() ?: null;

    // 8. Report comments (principal / admin feedback) where ref_id is this student's ID
    $stmtComments = $db->prepare("SELECT rc.*, u.username as author_name, COALESCE(stf.name, u.username) as author_full_name 
                                  FROM report_comments rc
                                  JOIN users u ON rc.created_by = u.id
                                  LEFT JOIN staff stf ON u.id = stf.user_id
                                  WHERE rc.ref_id=? AND rc.school_id=?
                                  ORDER BY rc.created_at DESC");
    $stmtComments->execute([$studentId, $schoolId]);
    $comments = $stmtComments->fetchAll() ?: [];

    Auth::sendResponse([
        "student" => $student,
        "attendance_summary" => $attendanceSummary,
        "attendance_list" => $attendanceList,
        "grades_summary" => $gradesSummary,
        "fee_summary" => $feeSummary,
        "fee_history" => $feeHistory,
        "discipline_history" => $disciplineHistory,
        "health_history" => $healthHistory,
        "comments" => $comments
    ]);
});

// PATCH /schools/{schoolId}/students/{studentId}
$router->patch('/schools/{schoolId}/students/{studentId}', function($schoolId, $studentId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $db    = Database::getConnection();
    $fields = [];
    $params = [];
    $allowed = ['first_name','last_name','middle_name','date_of_birth','gender','class_id','status','nationality','home_address','religion','previous_school','medical_notes'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $input)) {
            $fields[] = "`$f` = ?";
            $params[] = $f === 'class_id' && empty($input[$f]) ? null : (isset($input[$f]) ? trim($input[$f]) : null);
        }
    }
    if (empty($fields)) Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "No valid fields to update."], 400);
    $params[] = $studentId; $params[] = $schoolId;
    $db->prepare("UPDATE students SET " . implode(', ', $fields) . " WHERE id=? AND school_id=?")->execute($params);
    Auth::logAction($schoolId, $user['id'], 'STUDENT_UPDATED', 'students', $studentId, "Updated student #{$studentId}");
    Auth::sendResponse(["updated" => true]);
});

// DELETE /schools/{schoolId}/students/{studentId}
$router->delete('/schools/{schoolId}/students/{studentId}', function($schoolId, $studentId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db = Database::getConnection();
    $db->prepare("UPDATE students SET status='withdrawn' WHERE id=? AND school_id=?")->execute([$studentId, $schoolId]);
    Auth::logAction($schoolId, $user['id'], 'STUDENT_WITHDRAWN', 'students', $studentId, "Marked student #{$studentId} as withdrawn");
    Auth::sendResponse(null, null, 204);
});

// GET /schools/{schoolId}/students/export — CSV export
$router->get('/schools/{schoolId}/students/export', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT s.admission_number, s.first_name, s.last_name, s.middle_name, s.date_of_birth, s.gender, s.status, c.name as class_name, s.nationality, s.home_address, s.created_at
                          FROM students s LEFT JOIN classes c ON s.class_id=c.id WHERE s.school_id=? ORDER BY s.last_name, s.first_name");
    $stmt->execute([$schoolId]);
    $rows = $stmt->fetchAll();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="students_' . $schoolId . '_' . date('Ymd') . '.csv"');
    header('X-API-Version: v1');

    $output = fopen('php://output', 'w');
    fputcsv($output, ['Admission No', 'First Name', 'Last Name', 'Middle Name', 'Date of Birth', 'Gender', 'Status', 'Class', 'Nationality', 'Home Address', 'Enrolled On']);
    foreach ($rows as $row) {
        fputcsv($output, array_values($row));
    }
    fclose($output);
    Auth::logAction($schoolId, $user['id'], 'STUDENTS_EXPORTED', 'students', null, "Exported students roster to CSV");
    exit;
});
