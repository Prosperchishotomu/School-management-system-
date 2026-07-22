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

// POST /schools/{schoolId}/classes/{classId}/promote (Batch Student Promotion / End-of-Year Rollover)
$router->post('/schools/{schoolId}/classes/{classId}/promote', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);

    $input = json_decode(file_get_contents('php://input'), true);
    $targetClassId = trim($input['target_class_id'] ?? '');
    $isGraduate    = !empty($input['is_graduate']);

    if (empty($targetClassId) && !$isGraduate) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Target class ID or graduate flag required."], 400);
    }

    $db = Database::getConnection();

    if ($isGraduate) {
        $stmtPromote = $db->prepare("UPDATE students SET status = 'graduated', updated_at = NOW() WHERE school_id = ? AND class_id = ? AND status = 'enrolled'");
        $stmtPromote->execute([$schoolId, $classId]);
        $promotedCount = $stmtPromote->rowCount();
        $msg = "Graduated {$promotedCount} students from class #{$classId}.";
    } else {
        $stmtTarget = $db->prepare("SELECT id, name FROM classes WHERE id = ? AND school_id = ? LIMIT 1");
        $stmtTarget->execute([$targetClassId, $schoolId]);
        $targetClass = $stmtTarget->fetch();
        if (!$targetClass) {
            Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Target class not found."], 404);
        }

        $stmtPromote = $db->prepare("UPDATE students SET class_id = ?, updated_at = NOW() WHERE school_id = ? AND class_id = ? AND status = 'enrolled'");
        $stmtPromote->execute([$targetClassId, $schoolId, $classId]);
        $promotedCount = $stmtPromote->rowCount();
        $msg = "Promoted {$promotedCount} students to {$targetClass['name']}.";
    }

    Auth::logAction($schoolId, $user['id'], 'CLASS_PROMOTION', 'classes', $classId, $msg);
    Auth::sendResponse([
        "promoted_count" => $promotedCount,
        "message"        => $msg
    ]);
});
