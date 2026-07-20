<?php

// GET /schools/{schoolId}/leave-requests
$router->get('/schools/{schoolId}/leave-requests', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $db = Database::getConnection();
    
    if ($user['role'] === 'parent') {
        // Find guardian matching user_id
        $stmtG = $db->prepare("SELECT id FROM guardians WHERE user_id=? AND school_id=? LIMIT 1");
        $stmtG->execute([$user['id'], $schoolId]);
        $g = $stmtG->fetch();
        if ($g) {
            $stmtS = $db->prepare("SELECT student_id FROM student_guardians WHERE guardian_id=?");
            $stmtS->execute([$g['id']]);
            $sIds = $stmtS->fetchAll(PDO::FETCH_COLUMN);
            if (empty($sIds)) {
                Auth::sendResponse([]);
            }
            $inQuery = implode(',', array_fill(0, count($sIds), '?'));
            $stmt = $db->prepare("SELECT l.*, s.first_name, s.last_name FROM leave_requests l JOIN students s ON l.student_id = s.id WHERE l.school_id=? AND l.student_id IN ($inQuery) ORDER BY l.created_at DESC");
            $stmt->execute(array_merge([$schoolId], $sIds));
            Auth::sendResponse($stmt->fetchAll());
        } else {
            Auth::sendResponse([]);
        }
    } elseif ($user['role'] === 'teacher') {
        // Find staff record for user_id
        $stmtSt = $db->prepare("SELECT id FROM staff WHERE user_id=? AND school_id=? LIMIT 1");
        $stmtSt->execute([$user['id'], $schoolId]);
        $st = $stmtSt->fetch();
        if ($st) {
            $stmt = $db->prepare("SELECT l.*, st.name AS staff_name FROM leave_requests l JOIN staff st ON l.staff_id = st.id WHERE l.school_id=? AND l.staff_id=? ORDER BY l.created_at DESC");
            $stmt->execute([$schoolId, $st['id']]);
            Auth::sendResponse($stmt->fetchAll());
        } else {
            Auth::sendResponse([]);
        }
    } else {
        // school_admin or super_admin sees all
        $stmt = $db->prepare("SELECT l.*, s.first_name, s.last_name, st.name AS staff_name FROM leave_requests l 
                              LEFT JOIN students s ON l.student_id = s.id 
                              LEFT JOIN staff st ON l.staff_id = st.id 
                              WHERE l.school_id=? ORDER BY l.created_at DESC");
        $stmt->execute([$schoolId]);
        Auth::sendResponse($stmt->fetchAll());
    }
});

// POST /schools/{schoolId}/leave-requests
$router->post('/schools/{schoolId}/leave-requests', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['request_type']) || empty($input['start_date']) || empty($input['end_date']) || empty($input['reason'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "request_type, start_date, end_date, reason are required."], 400);
    }
    
    $db = Database::getConnection();
    $requestId = Database::generateUniqueId('leave_requests');
    
    if ($input['request_type'] === 'student_absence') {
        Auth::requireRoles($user, ['parent', 'school_admin', 'super_admin']);
        if (empty($input['student_id'])) {
            Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "student_id is required for student absence notices."], 400);
        }
        
        $stmt = $db->prepare("INSERT INTO leave_requests (id, school_id, request_type, student_id, staff_id, user_id, start_date, end_date, reason, status) VALUES (?,?,'student_absence',?,NULL,?,?,?,'pending')");
        $stmt->execute([$requestId, $schoolId, $input['student_id'], $user['id'], $input['start_date'], $input['end_date'], $input['reason']]);
        
        Auth::logAction($schoolId, $user['id'], 'STUDENT_ABSENCE_SUBMITTED', 'leave_requests', $requestId, "Student absence notice submitted for student {$input['student_id']}");
        Auth::sendResponse(["id" => $requestId], null, 201);
        
    } elseif ($input['request_type'] === 'exeat_pass') {
        Auth::requireRoles($user, ['parent', 'school_admin', 'super_admin']);
        if (empty($input['student_id'])) {
            Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "student_id is required for exeat passes."], 400);
        }
        if (empty($input['hostel_name'])) {
            Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "hostel_name is required for exeat passes."], 400);
        }
        
        $stmt = $db->prepare("INSERT INTO leave_requests (id, school_id, request_type, student_id, staff_id, hostel_name, user_id, start_date, end_date, reason, status) VALUES (?,?,'exeat_pass',?,NULL,?,?,?,?,?,'pending')");
        $stmt->execute([$requestId, $schoolId, $input['student_id'], $input['hostel_name'], $user['id'], $input['start_date'], $input['end_date'], $input['reason']]);
        
        Auth::logAction($schoolId, $user['id'], 'EXEAT_PASS_SUBMITTED', 'leave_requests', $requestId, "Exeat pass notice submitted for student {$input['student_id']} in hostel {$input['hostel_name']}");
        Auth::sendResponse(["id" => $requestId], null, 201);
        
    } elseif ($input['request_type'] === 'staff_leave') {
        Auth::requireRoles($user, ['teacher', 'school_admin', 'super_admin']);
        
        // Find staff record for user
        $stmtSt = $db->prepare("SELECT id FROM staff WHERE user_id=? AND school_id=? LIMIT 1");
        $stmtSt->execute([$user['id'], $schoolId]);
        $st = $stmtSt->fetch();
        if (!$st) {
            Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Staff profile not found."], 404);
        }
        
        $stmt = $db->prepare("INSERT INTO leave_requests (id, school_id, request_type, student_id, staff_id, user_id, start_date, end_date, reason, status) VALUES (?,?, 'staff_leave', NULL,?,?,?,?,'pending')");
        $stmt->execute([$requestId, $schoolId, $st['id'], $user['id'], $input['start_date'], $input['end_date'], $input['reason']]);
        
        Auth::logAction($schoolId, $user['id'], 'STAFF_LEAVE_SUBMITTED', 'leave_requests', $requestId, "Staff leave request submitted by staff member {$st['id']}");
        Auth::sendResponse(["id" => $requestId], null, 201);
        
    } else {
        Auth::sendResponse(null, ["code" => "BAD_REQUEST", "message" => "Invalid request_type."], 400);
    }
});

// POST /schools/{schoolId}/leave-requests/{requestId}/review
$router->post('/schools/{schoolId}/leave-requests/{requestId}/review', function($schoolId, $requestId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['status']) || !in_array($input['status'], ['approved', 'rejected'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "status (approved/rejected) is required."], 400);
    }
    
    $db = Database::getConnection();
    
    // Check if exists
    $stmtCheck = $db->prepare("SELECT id FROM leave_requests WHERE id=? AND school_id=?");
    $stmtCheck->execute([$requestId, $schoolId]);
    if (!$stmtCheck->fetch()) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Leave request not found."], 404);
    }
    
    $comment = $input['reviewer_comment'] ?? '';
    
    $stmt = $db->prepare("UPDATE leave_requests SET status=?, reviewer_comment=?, reviewed_by=? WHERE id=? AND school_id=?");
    $stmt->execute([$input['status'], $comment, $user['id'], $requestId, $schoolId]);
    
    Auth::logAction($schoolId, $user['id'], 'LEAVE_REQUEST_REVIEWED', 'leave_requests', $requestId, "Leave request {$requestId} set to {$input['status']}");
    Auth::sendResponse(["success" => true]);
});
