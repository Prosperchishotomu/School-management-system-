<?php

// GET /schools/{schoolId}/teaching-assignments
$router->get('/schools/{schoolId}/teaching-assignments', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $db = Database::getConnection();
    
    $teacherId = $_GET['teacher_id'] ?? null;
    
    $sql = "SELECT ta.*, u.username as teacher_username, s.name as teacher_name, c.name as class_name, sub.name as subject_name, sub.code as subject_code
            FROM teaching_assignments ta
            JOIN users u ON ta.teacher_id = u.id
            LEFT JOIN staff s ON u.id = s.user_id
            JOIN classes c ON ta.class_id = c.id
            JOIN subjects sub ON ta.subject_id = sub.id
            WHERE ta.school_id = ?";
            
    $params = [$schoolId];
    
    if ($teacherId) {
        $sql .= " AND ta.teacher_id = ?";
        $params[] = $teacherId;
    }
    
    $sql .= " ORDER BY c.name ASC, sub.name ASC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    Auth::sendResponse($stmt->fetchAll());
});

// POST /schools/{schoolId}/teaching-assignments
$router->post('/schools/{schoolId}/teaching-assignments', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['teacher_id']) || empty($input['class_id']) || empty($input['subject_id'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "teacher_id, class_id, and subject_id are required."], 400);
    }
    
    $db = Database::getConnection();
    
    // Verify teacher exists in the same school
    $stmtT = $db->prepare("SELECT id FROM users WHERE id = ? AND (school_id = ? OR school_id IS NULL)");
    $stmtT->execute([$input['teacher_id'], $schoolId]);
    if (!$stmtT->fetch()) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Teacher not found in this school."], 404);
    }
    
    // Verify class exists in the same school
    $stmtC = $db->prepare("SELECT id FROM classes WHERE id = ? AND school_id = ?");
    $stmtC->execute([$input['class_id'], $schoolId]);
    if (!$stmtC->fetch()) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Class not found in this school."], 404);
    }
    
    // Verify subject exists
    $stmtS = $db->prepare("SELECT id FROM subjects WHERE id = ?");
    $stmtS->execute([$input['subject_id']]);
    if (!$stmtS->fetch()) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Subject not found."], 404);
    }
    
    // Check if duplicate assignment exists
    $stmtCheck = $db->prepare("SELECT id FROM teaching_assignments WHERE teacher_id = ? AND class_id = ? AND subject_id = ?");
    $stmtCheck->execute([$input['teacher_id'], $input['class_id'], $input['subject_id']]);
    if ($stmtCheck->fetch()) {
        Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "This teaching assignment already exists."], 409);
    }
    
    $id = Database::generateUniqueId('teaching_assignments');
    
    $stmtInsert = $db->prepare("INSERT INTO teaching_assignments (id, school_id, teacher_id, class_id, subject_id) VALUES (?, ?, ?, ?, ?)");
    $stmtInsert->execute([$id, $schoolId, $input['teacher_id'], $input['class_id'], $input['subject_id']]);
    
    Auth::logAction($schoolId, $user['id'], 'TEACHING_ASSIGNMENT_CREATED', 'teaching_assignments', $id, "Assigned teacher #{$input['teacher_id']} to class #{$input['class_id']} for subject #{$input['subject_id']}");
    
    Auth::sendResponse(["id" => $id], null, 201);
});

// DELETE /schools/{schoolId}/teaching-assignments/{id}
$router->delete('/schools/{schoolId}/teaching-assignments/{id}', function($schoolId, $id) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $db = Database::getConnection();
    
    $stmtCheck = $db->prepare("SELECT id FROM teaching_assignments WHERE id = ? AND school_id = ?");
    $stmtCheck->execute([$id, $schoolId]);
    if (!$stmtCheck->fetch()) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Teaching assignment not found."], 404);
    }
    
    $stmtDel = $db->prepare("DELETE FROM teaching_assignments WHERE id = ?");
    $stmtDel->execute([$id]);
    
    Auth::logAction($schoolId, $user['id'], 'TEACHING_ASSIGNMENT_DELETED', 'teaching_assignments', $id, "Deleted teaching assignment #{$id}");
    
    Auth::sendResponse(null, null, 204);
});
