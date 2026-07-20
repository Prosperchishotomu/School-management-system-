<?php

// PUT /admin/override/{entityType}/{id}
$router->put('/admin/override/{entityType}/{id}', function($entityType, $id) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['action']) || empty($input['reason'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "action (update/delete) and reason are required."], 400);
    }
    
    $action = $input['action'];
    $reason = $input['reason'];
    $schoolId = $input['school_id'] ?? null; // Optionally scope the override
    
    // Map entityType to table name
    $allowedTypes = [
        'users' => 'users',
        'classes' => 'classes',
        'timetable' => 'timetable',
        'students' => 'students',
        'staff' => 'staff',
        'fees' => 'fees',
        'results' => 'results',
        'grades' => 'grades',
        'subjects' => 'subjects'
    ];
    
    if (!array_key_exists($entityType, $allowedTypes)) {
        Auth::sendResponse(null, ["code" => "BAD_REQUEST", "message" => "Invalid entity type for override."], 400);
    }
    
    $table = $allowedTypes[$entityType];
    $db = Database::getConnection();
    
    // Check if record exists
    $stmtCheck = $db->prepare("SELECT * FROM `{$table}` WHERE id = ?");
    $stmtCheck->execute([$id]);
    $record = $stmtCheck->fetch();
    
    if (!$record) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Record not found in {$entityType}."], 404);
    }
    
    $targetSchoolId = $record['school_id'] ?? $schoolId;
    
    if ($action === 'delete') {
        $stmtDel = $db->prepare("DELETE FROM `{$table}` WHERE id = ?");
        $stmtDel->execute([$id]);
        
        Auth::logAction($targetSchoolId, $user['id'], 'admin.override.' . $entityType, $table, $id, "Super Admin override delete. Reason: " . $reason);
        Auth::sendResponse(null, null, 204);
        
    } elseif ($action === 'update') {
        if (empty($input['fields']) || !is_array($input['fields'])) {
            Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "fields dictionary is required for update."], 400);
        }
        
        $fieldsInput = $input['fields'];
        
        // Exclude key identity fields from being updated via override
        unset($fieldsInput['id']);
        unset($fieldsInput['school_id']);
        
        // Query database table schema columns to prevent Column Not Found errors
        $qCols = $db->query("SHOW COLUMNS FROM `{$table}`");
        $validColumns = [];
        while ($col = $qCols->fetch()) {
            $validColumns[] = $col['Field'];
        }
        
        // Filter input by matching database columns
        $filteredFieldsInput = [];
        foreach ($fieldsInput as $k => $v) {
            if (in_array($k, $validColumns)) {
                $filteredFieldsInput[$k] = $v;
            }
        }
        
        if (empty($filteredFieldsInput)) {
            Auth::sendResponse(null, ["code" => "BAD_REQUEST", "message" => "No valid database columns provided for update."], 400);
        }
        
        $fields = [];
        $params = [];
        foreach ($filteredFieldsInput as $k => $v) {
            $fields[] = "`{$k}` = ?";
            $params[] = $v;
        }
        
        $params[] = $id;
        
        $sql = "UPDATE `{$table}` SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmtUpdate = $db->prepare($sql);
        $stmtUpdate->execute($params);
        
        Auth::logAction($targetSchoolId, $user['id'], 'admin.override.' . $entityType, $table, $id, "Super Admin override update. Reason: " . $reason);
        Auth::sendResponse(["updated" => true]);
        
    } else {
        Auth::sendResponse(null, ["code" => "BAD_REQUEST", "message" => "Invalid override action."], 400);
    }
});

// GET /admin/system-settings/{schoolId}
$router->get('/admin/system-settings/{schoolId}', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    
    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM notification_settings WHERE school_id = ?");
    $stmt->execute([$schoolId]);
    $settings = $stmt->fetch();
    
    if (!$settings) {
        // Return blank/default layout so frontend has fields
        $settings = [
            "school_id" => $schoolId,
            "sms_gateway_url" => "",
            "sms_api_key" => "",
            "sms_sender_id" => "",
            "email_smtp_host" => "",
            "email_smtp_port" => 587,
            "email_smtp_user" => "",
            "email_smtp_pass" => "",
            "email_from_address" => "",
            "email_from_name" => "",
            "payment_gateway_type" => "mock",
            "payment_merchant_id" => "",
            "payment_merchant_key" => "",
            "payment_api_url" => "",
            "notify_attendance_absent" => 1,
            "notify_results_published" => 1,
            "notify_fees_overdue" => 1,
            "notify_discipline_incident" => 1
        ];
    }
    
    Auth::sendResponse($settings);
});

// PUT /admin/system-settings/{schoolId}
$router->put('/admin/system-settings/{schoolId}', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $db = Database::getConnection();
    
    // Check if school exists
    $stmtS = $db->prepare("SELECT id FROM schools WHERE id = ?");
    $stmtS->execute([$schoolId]);
    if (!$stmtS->fetch()) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    // Check if settings already exist
    $check = $db->prepare("SELECT id FROM notification_settings WHERE school_id = ?");
    $check->execute([$schoolId]);
    
    $vals = [
        $input['sms_gateway_url'] ?? null,
        $input['sms_api_key'] ?? null,
        $input['sms_sender_id'] ?? null,
        $input['email_smtp_host'] ?? null,
        (int)($input['email_smtp_port'] ?? 587),
        $input['email_smtp_user'] ?? null,
        $input['email_smtp_pass'] ?? null,
        $input['email_from_address'] ?? null,
        $input['email_from_name'] ?? null,
        $input['payment_gateway_type'] ?? 'mock',
        $input['payment_merchant_id'] ?? null,
        $input['payment_merchant_key'] ?? null,
        $input['payment_api_url'] ?? null,
        (int)($input['notify_attendance_absent'] ?? 1),
        (int)($input['notify_results_published'] ?? 1),
        (int)($input['notify_fees_overdue'] ?? 1),
        (int)($input['notify_discipline_incident'] ?? 1)
    ];
    
    if ($check->fetch()) {
        $stmt = $db->prepare("UPDATE notification_settings SET 
            sms_gateway_url=?, sms_api_key=?, sms_sender_id=?, 
            email_smtp_host=?, email_smtp_port=?, email_smtp_user=?, email_smtp_pass=?, email_from_address=?, email_from_name=?, 
            payment_gateway_type=?, payment_merchant_id=?, payment_merchant_key=?, payment_api_url=?, 
            notify_attendance_absent=?, notify_results_published=?, notify_fees_overdue=?, notify_discipline_incident=?, 
            updated_at=NOW() WHERE school_id=?");
        $stmt->execute(array_merge($vals, [$schoolId]));
    } else {
        $settingsId = Database::generateUniqueId('notification_settings');
        $stmt = $db->prepare("INSERT INTO notification_settings (
            id, school_id, sms_gateway_url, sms_api_key, sms_sender_id, 
            email_smtp_host, email_smtp_port, email_smtp_user, email_smtp_pass, email_from_address, email_from_name, 
            payment_gateway_type, payment_merchant_id, payment_merchant_key, payment_api_url, 
            notify_attendance_absent, notify_results_published, notify_fees_overdue, notify_discipline_incident
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute(array_merge([$settingsId, $schoolId], $vals));
    }
    
    Auth::logAction($schoolId, $user['id'], 'admin.system-settings.updated', 'notification_settings', null, "Super Admin updated settings for school #{$schoolId}");
    Auth::sendResponse(["updated" => true]);
});
