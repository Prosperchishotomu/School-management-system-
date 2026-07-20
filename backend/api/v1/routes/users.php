<?php

$router->get('/schools/{schoolId}/users', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db   = Database::getConnection();
    $role = trim($_GET['role'] ?? '');
    $sql  = "SELECT u.id, u.username, u.email, u.role, u.status as is_active, u.created_at,
                    COALESCE(st.name, gd.name, 'Administrator') as name,
                    COALESCE(st.phone, gd.phone) as phone
             FROM users u
             LEFT JOIN staff st ON st.user_id=u.id
             LEFT JOIN guardians gd ON gd.user_id=u.id
             WHERE u.school_id=?";
    $params = [$schoolId];
    if ($role) { $sql .= " AND u.role=?"; $params[] = $role; }
    $sql .= " ORDER BY u.role ASC, u.username ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) { $r['is_active'] = ($r['is_active'] === 'active'); }
    Auth::sendResponse($rows);
});

// POST /schools/{schoolId}/users
$router->post('/schools/{schoolId}/users', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['username']) || empty($input['password']) || empty($input['role']) || empty($input['name']) || empty($input['email']) || empty($input['phone'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Name, username, password, role, email, and phone (cell) are required."], 400);
    }
    if (strlen($input['password']) < 8) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Password must be at least 8 characters."], 400);
    }
    $allowedRoles = ['teacher', 'parent', 'school_admin'];
    if (!in_array($input['role'], $allowedRoles)) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Invalid role."], 400);
    }
    $db = Database::getConnection();
    $dup = $db->prepare("SELECT id FROM users WHERE username=?");
    $dup->execute([$input['username']]);
    if ($dup->fetch()) {
        Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "Username already exists."], 409);
    }
    if ($input['role'] === 'teacher' && empty($input['class_id'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Class assignment is mandatory for teachers."], 400);
    }
    if ($input['role'] === 'parent' && empty($input['student_id'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "You must link the guardian account to a student."], 400);
    }
    $db->beginTransaction();
    try {
        $hash  = password_hash($input['password'], PASSWORD_DEFAULT);
        $newId = Database::generateUniqueId('users');
        $db->prepare("INSERT INTO users (id, school_id, username, email, password_hash, role, status) VALUES (?,?,?,?,?,?,?)")
           ->execute([$newId, $schoolId, $input['username'], $input['email'] ?? null, $hash, $input['role'], 'active']);

        if ($input['role'] === 'teacher' || $input['role'] === 'school_admin') {
            $staffId   = Database::generateUniqueId('staff');
            $roleTitle = ($input['role'] === 'teacher') ? 'Teacher' : 'School Admin';
            $db->prepare("INSERT INTO staff (id, school_id, user_id, class_id, name, email, phone, role_title) VALUES (?,?,?,?,?,?,?,?)")
               ->execute([$staffId, $schoolId, $newId, $input['class_id'] ?? null, trim($input['name']), $input['email'] ?? null, $input['phone'] ?? null, $roleTitle]);
        } elseif ($input['role'] === 'parent') {
            $guardianId = Database::generateUniqueId('guardians');
            $db->prepare("INSERT INTO guardians (id, school_id, user_id, name, phone, email, relation) VALUES (?,?,?,?,?,?,?)")
               ->execute([$guardianId, $schoolId, $newId, trim($input['name']), $input['phone'] ?? null, $input['email'] ?? null, $input['relation'] ?? 'Guardian']);
            $db->prepare("INSERT INTO student_guardians (student_id, guardian_id) VALUES (?,?)")
               ->execute([$input['student_id'], $guardianId]);
        }

        $db->commit();
        Auth::logAction($schoolId, $user['id'], 'USER_CREATED', 'users', $newId, "Created user {$input['username']} with role {$input['role']}");
        Auth::sendResponse(["id" => $newId], null, 201);
    } catch (Exception $ex) {
        $db->rollBack();
        error_log("Failed creating user: " . $ex->getMessage());
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Database write failed during user creation."], 500);
    }
});

// DELETE /schools/{schoolId}/users/{userId}
$router->delete('/schools/{schoolId}/users/{userId}', function($schoolId, $userId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db = Database::getConnection();
    $db->prepare("UPDATE users SET status='inactive' WHERE id=? AND school_id=?")->execute([$userId, $schoolId]);
    // Revoke all active tokens for the deactivated user
    Auth::revokeUserTokens($userId);
    Auth::logAction($schoolId, $user['id'], 'USER_DEACTIVATED', 'users', $userId, "Deactivated user #{$userId}");
    Auth::sendResponse(null, null, 204);
});

// POST /schools/{schoolId}/users/{userId}/reset-password (admin reset)
$router->post('/schools/{schoolId}/users/{userId}/reset-password', function($schoolId, $userId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['password']) || strlen($input['password']) < 8) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Password must be at least 8 characters."], 400);
    }
    $db = Database::getConnection();
    $hash = password_hash($input['password'], PASSWORD_DEFAULT);
    $db->prepare("UPDATE users SET password_hash=?, login_attempts=0, lockout_until=NULL WHERE id=?")->execute([$hash, $userId]);
    // Revoke all existing sessions
    Auth::revokeUserTokens($userId);
    Auth::logAction($schoolId, $user['id'], 'PASSWORD_RESET_BY_ADMIN', 'users', $userId, "Admin reset password for user #{$userId}");
    Auth::sendResponse(["success" => true]);
});

// GET /schools/{schoolId}/audit-log
$router->get('/schools/{schoolId}/audit-log', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db = Database::getConnection();
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, (int)($_GET['per_page'] ?? 10)); // Default to 10 rows
    $offset  = ($page - 1) * $perPage;
    
    $entityType = trim($_GET['entity_type'] ?? '');
    $search     = trim($_GET['search'] ?? '');

    $conditions = ["al.school_id=?"];
    $params     = [$schoolId];

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
    
    $where = implode(" AND ", $conditions);

    $stmtCount = $db->prepare("SELECT COUNT(*) FROM audit_logs al JOIN users u ON al.user_id=u.id WHERE {$where}");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmtData = $db->prepare("SELECT al.id, al.action, al.entity_type, al.entity_id, al.description, al.ip_address, al.created_at,
                                     u.username, u.role
                              FROM audit_logs al 
                              JOIN users u ON al.user_id=u.id 
                              WHERE {$where} 
                              ORDER BY al.created_at DESC 
                              LIMIT ? OFFSET ?");
    $i = 1;
    foreach ($params as $p) { $stmtData->bindValue($i++, $p); }
    $stmtData->bindValue($i++, $perPage, PDO::PARAM_INT);
    $stmtData->bindValue($i++, $offset,  PDO::PARAM_INT);
    $stmtData->execute();
    Auth::sendResponse($stmtData->fetchAll(), null, 200, ["page" => $page, "per_page" => $perPage, "total" => $total]);
});
