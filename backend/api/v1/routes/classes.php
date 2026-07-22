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

/**
 * Helper to discover or auto-create corresponding next class (e.g. Grade 2 Yellow -> Grade 3 Yellow, Form 1 B -> Form 2 B)
 * or identify terminal graduation grades (Grade 7, Form 4, Form 6)
 */
function getCorrespondingNextClass($db, $schoolId, $currentClass) {
    $gradeLevel = $currentClass['grade_level'];
    $stream     = $currentClass['stream'] ?: '';
    $className  = $currentClass['name'];

    if (preg_match('/(Grade|Form)\s*(\d+)/i', $gradeLevel, $matches)) {
        $type = ucfirst(strtolower($matches[1])); // "Grade" or "Form"
        $num  = (int)$matches[2];
        
        // Terminal grades: Grade 7, Form 4 (O-Level), Form 6 (A-Level)
        if (($type === 'Grade' && $num >= 7) || ($type === 'Form' && ($num === 4 || $num >= 6))) {
            return ['is_terminal' => true, 'next_grade' => $type . ' ' . $num];
        }

        $nextNum   = $num + 1;
        $nextGrade = $type . ' ' . $nextNum; // "Grade 3" or "Form 2"
        $nextName  = trim($nextGrade . ' ' . $stream);

        // Search for existing corresponding class in same stream
        $stmtSearch = $db->prepare("SELECT id, name FROM classes WHERE school_id = ? AND grade_level = ? AND (stream = ? OR name = ?) LIMIT 1");
        $stmtSearch->execute([$schoolId, $nextGrade, $stream, $nextName]);
        $existing = $stmtSearch->fetch();

        if ($existing) {
            return ['is_terminal' => false, 'class_id' => $existing['id'], 'class_name' => $existing['name']];
        }

        // Auto-create corresponding next class if missing
        $newClassId = Database::generateId('CLS', 'classes', $schoolId);
        $stmtIns = $db->prepare("INSERT INTO classes (id, school_id, name, grade_level, stream) VALUES (?, ?, ?, ?, ?)");
        $stmtIns->execute([$newClassId, $schoolId, $nextName, $nextGrade, $stream ?: null]);

        return ['is_terminal' => false, 'class_id' => $newClassId, 'class_name' => $nextName];
    }

    return ['is_terminal' => true, 'next_grade' => $gradeLevel];
}

// POST /schools/{schoolId}/classes/{classId}/promote (Batch Student Promotion / End-of-Year Rollover)
$router->post('/schools/{schoolId}/classes/{classId}/promote', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);

    $input = json_decode(file_get_contents('php://input'), true);
    $targetClassId     = trim($input['target_class_id'] ?? '');
    $repeatStudentIds  = is_array($input['repeat_student_ids'] ?? null) ? $input['repeat_student_ids'] : [];

    $db = Database::getConnection();

    // Fetch current class details
    $stmtCur = $db->prepare("SELECT * FROM classes WHERE id = ? AND school_id = ? LIMIT 1");
    $stmtCur->execute([$classId, $schoolId]);
    $currentClass = $stmtCur->fetch();

    if (!$currentClass) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Current class not found."], 404);
    }

    // Determine target class or terminal graduation
    if (!empty($targetClassId)) {
        $stmtTarget = $db->prepare("SELECT id, name FROM classes WHERE id = ? AND school_id = ? LIMIT 1");
        $stmtTarget->execute([$targetClassId, $schoolId]);
        $targetClass = $stmtTarget->fetch();
        if (!$targetClass) {
            Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Target class not found."], 404);
        }
        $isTerminal = false;
        $destClassId = $targetClass['id'];
        $destClassName = $targetClass['name'];
    } else {
        // Auto-discover corresponding next class (e.g. Grade 2 Yellow -> Grade 3 Yellow, Form 1 B -> Form 2 B)
        $nextInfo = getCorrespondingNextClass($db, $schoolId, $currentClass);
        $isTerminal    = $nextInfo['is_terminal'];
        $destClassId   = $nextInfo['class_id'] ?? null;
        $destClassName = $nextInfo['class_name'] ?? 'Completed';
    }

    // Prepare placeholders for repeating student exclusion
    $repeatCount = count($repeatStudentIds);
    $excludeClause = "";
    $params = [$schoolId, $classId];

    if ($repeatCount > 0) {
        $placeholders = implode(',', array_fill(0, $repeatCount, '?'));
        $excludeClause = " AND id NOT IN ({$placeholders})";
        $params = array_merge($params, $repeatStudentIds);
    }

    if ($isTerminal) {
        // Terminal grade (Grade 7, Form 4, Form 6): Mark non-repeating students as completed/graduated
        $sqlPromote = "UPDATE students SET status = 'completed', updated_at = NOW() WHERE school_id = ? AND class_id = ? AND status = 'enrolled'" . $excludeClause;
        $stmtPromote = $db->prepare($sqlPromote);
        $stmtPromote->execute($params);
        $promotedCount = $stmtPromote->rowCount();
        $msg = "Graduated/completed {$promotedCount} students from {$currentClass['name']} (Terminal grade).";
    } else {
        // Corresponding class promotion (e.g. Grade 2 Yellow -> Grade 3 Yellow)
        $sqlPromote = "UPDATE students SET class_id = ?, updated_at = NOW() WHERE school_id = ? AND class_id = ? AND status = 'enrolled'" . $excludeClause;
        $stmtPromote = $db->prepare($sqlPromote);
        $stmtPromote->execute(array_merge([$destClassId], $params));
        $promotedCount = $stmtPromote->rowCount();
        $msg = "Promoted {$promotedCount} students from {$currentClass['name']} to {$destClassName}.";
    }

    if ($repeatCount > 0) {
        $msg .= " {$repeatCount} student(s) retained in {$currentClass['name']} as repeating.";
    }

    Auth::logAction($schoolId, $user['id'], 'CLASS_PROMOTION', 'classes', $classId, $msg);
    Auth::sendResponse([
        "promoted_count"   => $promotedCount,
        "repeating_count"  => $repeatCount,
        "is_terminal"      => $isTerminal,
        "target_class"     => $destClassName,
        "message"          => $msg
    ]);
});
