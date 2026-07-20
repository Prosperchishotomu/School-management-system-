<?php

// GET /schools/{schoolId}/tasks
$router->get('/schools/{schoolId}/tasks', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $db = Database::getConnection();
    
    // Auto-update overdue tasks
    $db->prepare("UPDATE tasks SET status = 'overdue' WHERE school_id = ? AND status = 'planned' AND due_date < CURDATE()")->execute([$schoolId]);
    
    $teacherId = $_GET['teacher_id'] ?? null;
    $classId   = $_GET['class_id'] ?? null;
    $status    = $_GET['status'] ?? null;
    
    // If the caller is a teacher, force-scope to their tasks
    if ($user['role'] === 'teacher') {
        $teacherId = $user['id'];
    }
    
    $sql = "SELECT t.*, c.name as class_name, sub.name as subject_name, sub.code as subject_code, s.name as teacher_name
            FROM tasks t
            JOIN classes c ON t.class_id = c.id
            JOIN subjects sub ON t.subject_id = sub.id
            JOIN users u ON t.teacher_id = u.id
            LEFT JOIN staff s ON u.id = s.user_id
            WHERE t.school_id = ?";
            
    $params = [$schoolId];
    
    if ($teacherId) {
        $sql .= " AND t.teacher_id = ?";
        $params[] = $teacherId;
    }
    if ($classId) {
        $sql .= " AND t.class_id = ?";
        $params[] = $classId;
    }
    if ($status) {
        $sql .= " AND t.status = ?";
        $params[] = $status;
    }
    
    $sql .= " ORDER BY t.due_date ASC, t.created_at DESC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    Auth::sendResponse($stmt->fetchAll());
});

// GET /schools/{schoolId}/tasks/overdue
$router->get('/schools/{schoolId}/tasks/overdue', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $db = Database::getConnection();
    
    // Auto-update overdue tasks
    $db->prepare("UPDATE tasks SET status = 'overdue' WHERE school_id = ? AND status = 'planned' AND due_date < CURDATE()")->execute([$schoolId]);
    
    $teacherId = null;
    if ($user['role'] === 'teacher') {
        $teacherId = $user['id'];
    }
    
    $sql = "SELECT t.*, c.name as class_name, sub.name as subject_name, s.name as teacher_name
            FROM tasks t
            JOIN classes c ON t.class_id = c.id
            JOIN subjects sub ON t.subject_id = sub.id
            JOIN users u ON t.teacher_id = u.id
            LEFT JOIN staff s ON u.id = s.user_id
            WHERE t.school_id = ? AND t.status = 'overdue'";
            
    $params = [$schoolId];
    if ($teacherId) {
        $sql .= " AND t.teacher_id = ?";
        $params[] = $teacherId;
    }
    
    $sql .= " ORDER BY t.due_date ASC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    Auth::sendResponse($stmt->fetchAll());
});

// POST /schools/{schoolId}/tasks
$router->post('/schools/{schoolId}/tasks', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'teacher']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['class_id']) || empty($input['subject_id']) || empty($input['title']) || empty($input['due_date'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "class_id, subject_id, title, and due_date are required."], 400);
    }
    
    $db = Database::getConnection();
    
    // Verify class exists in same school
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
    
    $id = Database::generateUniqueId('tasks');
    $teacherId = $user['role'] === 'teacher' ? $user['id'] : ($input['teacher_id'] ?? $user['id']);
    
    $status = (strtotime($input['due_date']) < strtotime(date('Y-m-d'))) ? 'overdue' : 'planned';
    
    $stmt = $db->prepare("INSERT INTO tasks (id, school_id, teacher_id, class_id, subject_id, title, description, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $id,
        $schoolId,
        $teacherId,
        $input['class_id'],
        $input['subject_id'],
        $input['title'],
        $input['description'] ?? null,
        $input['due_date'],
        $status
    ]);
    
    Auth::logAction($schoolId, $user['id'], 'TASK_CREATED', 'tasks', $id, "Created lesson plan/task: {$input['title']}");
    
    Auth::sendResponse(["id" => $id], null, 201);
});

// PATCH /schools/{schoolId}/tasks/{id}
$router->patch('/schools/{schoolId}/tasks/{id}', function($schoolId, $id) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $db = Database::getConnection();
    
    // Check if task exists
    $stmtCheck = $db->prepare("SELECT * FROM tasks WHERE id = ? AND school_id = ?");
    $stmtCheck->execute([$id, $schoolId]);
    $task = $stmtCheck->fetch();
    if (!$task) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Task not found."], 404);
    }
    
    // If teacher, must own the task
    if ($user['role'] === 'teacher' && $task['teacher_id'] !== $user['id']) {
        Auth::sendResponse(null, ["code" => "FORBIDDEN", "message" => "You are not authorized to update this task."], 403);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Prepare updates dynamically
    $fields = [];
    $params = [];
    
    if (isset($input['title'])) {
        $fields[] = "title = ?";
        $params[] = $input['title'];
    }
    if (isset($input['description'])) {
        $fields[] = "description = ?";
        $params[] = $input['description'];
    }
    if (isset($input['due_date'])) {
        $fields[] = "due_date = ?";
        $params[] = $input['due_date'];
        
        // Recalculate status if updating due_date and it was not set to done
        if (!isset($input['status']) && $task['status'] !== 'done') {
            $newStatus = (strtotime($input['due_date']) < strtotime(date('Y-m-d'))) ? 'overdue' : 'planned';
            $fields[] = "status = ?";
            $params[] = $newStatus;
        }
    }
    if (isset($input['status'])) {
        $fields[] = "status = ?";
        $params[] = $input['status'];
    }
    
    if (empty($fields)) {
        Auth::sendResponse(null, ["code" => "BAD_REQUEST", "message" => "No fields to update."], 400);
    }
    
    $sql = "UPDATE tasks SET " . implode(", ", $fields) . " WHERE id = ? AND school_id = ?";
    $params[] = $id;
    $params[] = $schoolId;
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    Auth::logAction($schoolId, $user['id'], 'TASK_UPDATED', 'tasks', $id, "Updated task #{$id}");
    
    Auth::sendResponse(["updated" => true]);
});

// DELETE /schools/{schoolId}/tasks/{id}
$router->delete('/schools/{schoolId}/tasks/{id}', function($schoolId, $id) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $db = Database::getConnection();
    $stmtCheck = $db->prepare("SELECT * FROM tasks WHERE id = ? AND school_id = ?");
    $stmtCheck->execute([$id, $schoolId]);
    $task = $stmtCheck->fetch();
    if (!$task) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Task not found."], 404);
    }
    
    if ($user['role'] === 'teacher' && $task['teacher_id'] !== $user['id']) {
        Auth::sendResponse(null, ["code" => "FORBIDDEN", "message" => "You are not authorized to delete this task."], 403);
    }
    
    $db->prepare("DELETE FROM tasks WHERE id = ?")->execute([$id]);
    
    Auth::logAction($schoolId, $user['id'], 'TASK_DELETED', 'tasks', $id, "Deleted task: {$task['title']}");
    
    Auth::sendResponse(null, null, 204);
});
