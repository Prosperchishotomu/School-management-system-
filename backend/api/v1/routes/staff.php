<?php

$router->get('/schools/{schoolId}/staff', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT s.id, s.name, s.email, s.phone, s.role_title, s.class_id, c.name as class_name
                          FROM staff s LEFT JOIN classes c ON s.class_id=c.id
                          WHERE s.school_id=? ORDER BY s.name ASC");
    $stmt->execute([$schoolId]);
    Auth::sendResponse($stmt->fetchAll());
});

// POST /schools/{schoolId}/staff
$router->post('/schools/{schoolId}/staff', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['name'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Staff name is required."], 400);
    }

    $db = Database::getConnection();

    // Check duplicate email
    if (!empty($input['email'])) {
        $dupEmail = $db->prepare("SELECT id FROM staff WHERE school_id = ? AND email = ?");
        $dupEmail->execute([$schoolId, trim($input['email'])]);
        if ($dupEmail->fetch()) {
            Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "A staff profile with this email already exists."], 409);
        }
    }

    // Check duplicate phone
    if (!empty($input['phone'])) {
        $dupPhone = $db->prepare("SELECT id FROM staff WHERE school_id = ? AND phone = ?");
        $dupPhone->execute([$schoolId, trim($input['phone'])]);
        if ($dupPhone->fetch()) {
            Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "A staff profile with this phone number already exists."], 409);
        }
    }

    $userId = null;
    $db->beginTransaction();
    try {
        if (!empty($input['username']) && !empty($input['password'])) {
            // Check duplicate username
            $dupUser = $db->prepare("SELECT id FROM users WHERE username = ?");
            $dupUser->execute([trim($input['username'])]);
            if ($dupUser->fetch()) {
                $db->rollBack();
                Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "Username already exists."], 409);
            }
            if (strlen($input['password']) < 8) {
                $db->rollBack();
                Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Password must be at least 8 characters."], 400);
            }

            // Create user login
            $userId = Database::generateUniqueId('users');
            $hash = password_hash($input['password'], PASSWORD_DEFAULT);
            $role = (strpos(strtolower($input['role_title'] ?? ''), 'admin') !== false) ? 'school_admin' : 'teacher';
            $db->prepare("INSERT INTO users (id, school_id, username, email, password_hash, role, status) VALUES (?,?,?,?,?,?,?)")
               ->execute([$userId, $schoolId, trim($input['username']), !empty($input['email']) ? trim($input['email']) : null, $hash, $role, 'active']);
        }

        $staffId = Database::generateUniqueId('staff');
        $stmt    = $db->prepare("INSERT INTO staff (id, school_id, user_id, class_id, name, email, phone, role_title) VALUES (?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $staffId, $schoolId, $userId,
            !empty($input['class_id']) ? $input['class_id'] : null,
            trim($input['name']),
            !empty($input['email'])      ? trim($input['email'])      : null,
            !empty($input['phone'])      ? trim($input['phone'])      : null,
            !empty($input['role_title']) ? trim($input['role_title']) : null,
        ]);

        $db->commit();
        Auth::logAction($schoolId, $user['id'], 'STAFF_ADDED', 'staff', $staffId, "Added staff member: {$input['name']}");
        Auth::sendResponse(["id" => $staffId, "message" => "Staff record added successfully."], null, 201);
    } catch (Exception $ex) {
        $db->rollBack();
        error_log("Failed registering staff: " . $ex->getMessage());
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Database write failed during staff creation."], 500);
    }
});

// POST /schools/{schoolId}/staff/remind
$router->post('/schools/{schoolId}/staff/remind', function($schoolId) {
    $user  = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    $input = json_decode(file_get_contents('php://input'), true);
    $name  = $input['name'] ?? 'Staff';
    Auth::logAction($schoolId, $user['id'], 'STAFF_REMINDER_SENT', 'staff', null, "Principal sent attendance reminder to {$name}.");
    Auth::sendResponse(["reminded" => true, "name" => $name]);
});

// GET /schools/{schoolId}/teacher-messages
$router->get('/schools/{schoolId}/teacher-messages', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin', 'teacher']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db = Database::getConnection();
    $conditions = ["tm.school_id=?"];
    $params     = [$schoolId];
    if ($user['role'] === 'teacher') {
        $conditions[] = "(tm.recipient_id=? OR tm.recipient_id IS NULL)";
        $params[] = $user['id'];
    }
    $where = implode(" AND ", $conditions);
    $stmt = $db->prepare("SELECT tm.*, u.username as sender_name FROM teacher_messages tm
                          JOIN users u ON tm.sender_id=u.id WHERE {$where} ORDER BY tm.sent_at DESC LIMIT 50");
    $stmt->execute($params);
    Auth::sendResponse($stmt->fetchAll());
});

// POST /schools/{schoolId}/teacher-messages
$router->post('/schools/{schoolId}/teacher-messages', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['subject']) || empty($input['body'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "subject and body are required."], 400);
    }
    $msgId = Database::generateUniqueId('teacher_messages');
    $db    = Database::getConnection();
    $stmt  = $db->prepare("INSERT INTO teacher_messages (id, school_id, sender_id, recipient_id, subject, body) VALUES (?,?,?,?,?,?)");
    $stmt->execute([$msgId, $schoolId, $user['id'], $input['recipient_id'] ?? null, $input['subject'], $input['body']]);
    Auth::logAction($schoolId, $user['id'], 'MESSAGE_SENT', 'teacher_messages', $msgId, "Message sent: {$input['subject']}");
    Auth::sendResponse(["id" => $msgId], null, 201);
});

// PATCH /schools/{schoolId}/staff/{staffId}
$router->patch('/schools/{schoolId}/staff/{staffId}', function($schoolId, $staffId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['name'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Staff name is required."], 400);
    }

    $db = Database::getConnection();
    
    // Check if staff profile exists
    $stmtCheck = $db->prepare("SELECT id, user_id FROM staff WHERE id = ? AND school_id = ?");
    $stmtCheck->execute([$staffId, $schoolId]);
    $existingStaff = $stmtCheck->fetch();
    if (!$existingStaff) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Staff member not found."], 404);
    }

    // Check duplicate email
    if (!empty($input['email'])) {
        $dupEmail = $db->prepare("SELECT id FROM staff WHERE school_id = ? AND email = ? AND id != ?");
        $dupEmail->execute([$schoolId, trim($input['email']), $staffId]);
        if ($dupEmail->fetch()) {
            Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "A staff profile with this email already exists."], 409);
        }
    }

    // Check duplicate phone
    if (!empty($input['phone'])) {
        $dupPhone = $db->prepare("SELECT id FROM staff WHERE school_id = ? AND phone = ? AND id != ?");
        $dupPhone->execute([$schoolId, trim($input['phone']), $staffId]);
        if ($dupPhone->fetch()) {
            Auth::sendResponse(null, ["code" => "CONFLICT", "message" => "A staff profile with this phone number already exists."], 409);
        }
    }

    $db->beginTransaction();
    try {
        // Update user record email if user login exists
        if ($existingStaff['user_id'] && !empty($input['email'])) {
            $db->prepare("UPDATE users SET email = ? WHERE id = ?")
               ->execute([trim($input['email']), $existingStaff['user_id']]);
        }

        $stmt = $db->prepare("UPDATE staff SET name = ?, email = ?, phone = ?, role_title = ?, class_id = ? WHERE id = ? AND school_id = ?");
        $stmt->execute([
            trim($input['name']),
            !empty($input['email'])      ? trim($input['email'])      : null,
            !empty($input['phone'])      ? trim($input['phone'])      : null,
            !empty($input['role_title']) ? trim($input['role_title']) : null,
            !empty($input['class_id'])   ? $input['class_id']         : null,
            $staffId, $schoolId
        ]);

        $db->commit();
        Auth::logAction($schoolId, $user['id'], 'STAFF_UPDATED', 'staff', $staffId, "Updated staff member: {$input['name']}");
        Auth::sendResponse(["message" => "Staff record updated successfully."]);
    } catch (Exception $ex) {
        $db->rollBack();
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Database write failed during staff update."], 500);
    }
});

// DELETE /schools/{schoolId}/staff/{staffId}
$router->delete('/schools/{schoolId}/staff/{staffId}', function($schoolId, $staffId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }

    $db = Database::getConnection();
    
    // Check if staff profile exists
    $stmtCheck = $db->prepare("SELECT id, name, user_id FROM staff WHERE id = ? AND school_id = ?");
    $stmtCheck->execute([$staffId, $schoolId]);
    $existingStaff = $stmtCheck->fetch();
    if (!$existingStaff) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Staff member not found."], 404);
    }

    $db->beginTransaction();
    try {
        // Delete staff profile
        $db->prepare("DELETE FROM staff WHERE id = ? AND school_id = ?")->execute([$staffId, $schoolId]);

        // Delete associated login user account if exists
        if ($existingStaff['user_id']) {
            $db->prepare("DELETE FROM users WHERE id = ?")->execute([$existingStaff['user_id']]);
        }

        $db->commit();
        Auth::logAction($schoolId, $user['id'], 'STAFF_DELETED', 'staff', $staffId, "Deleted staff member: {$existingStaff['name']}");
        Auth::sendResponse(["message" => "Staff record deleted successfully."]);
    } catch (Exception $ex) {
        $db->rollBack();
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Database operation failed during staff deletion."], 500);
    }
});
