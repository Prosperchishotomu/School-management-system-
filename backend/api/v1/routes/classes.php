<?php

$router->get('/schools/{schoolId}/classes', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db = Database::getConnection();
    if ($user['role'] === 'teacher') {
        $stmtStaff = $db->prepare("SELECT class_id FROM staff WHERE school_id = ? AND user_id = ? LIMIT 1");
        $stmtStaff->execute([$schoolId, $user['id']]);
        $staffRow = $stmtStaff->fetch();
        $teacherClassId = $staffRow ? $staffRow['class_id'] : null;
        if ($teacherClassId) {
            $stmt = $db->prepare("SELECT c.id, c.name, c.grade_level, c.stream, st.name as teacher_name
                                  FROM classes c LEFT JOIN staff st ON st.class_id=c.id AND st.school_id=c.school_id
                                  WHERE c.school_id=? AND c.id=?");
            $stmt->execute([$schoolId, $teacherClassId]);
        } else {
            Auth::sendResponse([]);
        }
    } else {
        $stmt = $db->prepare("SELECT c.id, c.name, c.grade_level, c.stream, st.name as teacher_name
                              FROM classes c LEFT JOIN staff st ON st.class_id=c.id AND st.school_id=c.school_id
                              WHERE c.school_id=? ORDER BY c.name ASC");
        $stmt->execute([$schoolId]);
    }
    Auth::sendResponse($stmt->fetchAll());
});

// POST /schools/{schoolId}/classes
$router->post('/schools/{schoolId}/classes', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['name']) || empty($input['grade_level'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "name and grade_level are required."], 400);
    }
    $id   = Database::generateUniqueId('classes');
    $db   = Database::getConnection();
    $stmt = $db->prepare("INSERT INTO classes (id, school_id, name, grade_level, stream) VALUES (?,?,?,?,?)");
    $stmt->execute([$id, $schoolId, $input['name'], $input['grade_level'], $input['stream'] ?? null]);
    Auth::logAction($schoolId, $user['id'], 'CLASS_CREATED', 'classes', $id, "Created class: {$input['name']}");
    Auth::sendResponse(["id" => $id], null, 201);
});

// DELETE /schools/{schoolId}/classes/{classId}
$router->delete('/schools/{schoolId}/classes/{classId}', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db = Database::getConnection();
    $stmtCheck = $db->prepare("SELECT id FROM classes WHERE id=? AND school_id=?");
    $stmtCheck->execute([$classId, $schoolId]);
    if (!$stmtCheck->fetch()) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Class not found."], 404);
    }
    $db->prepare("DELETE FROM classes WHERE id=?")->execute([$classId]);
    Auth::logAction($schoolId, $user['id'], 'CLASS_DELETED', 'classes', $classId, "Deleted class #{$classId}");
    Auth::sendResponse(null, null, 204);
});
