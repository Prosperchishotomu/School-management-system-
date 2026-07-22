<?php
// Route handlers for Hostels, Boarding Facilities & Staff Accommodation

// ── GET /hostels (List all hostels & housing blocks) ──────────────────────────
$router->get('/hostels', function() {
    $user = Auth::requireAuth();
    $db = Database::getConnection();
    $schoolId = $user['school_id'] ?: 'HARAREPR';

    $stmt = $db->prepare("
        SELECT h.*, 
               (SELECT COUNT(*) FROM hostel_allocations ha WHERE ha.hostel_id = h.id) as current_occupants
        FROM hostels h
        WHERE h.school_id = ?
        ORDER BY h.name ASC
    ");
    $stmt->execute([$schoolId]);
    $hostels = $stmt->fetchAll();

    Auth::sendResponse($hostels);
});

// ── POST /hostels (Create new hostel / staff quarters block) ──────────────────
$router->post('/hostels', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    $data = getJsonInput();

    $name       = trim($data['name'] ?? '');
    $type       = trim($data['type'] ?? 'student_male');
    $capacity   = (int)($data['capacity'] ?? 50);
    $wardenName = trim($data['warden_name'] ?? '');

    if (empty($name)) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Hostel name is required."], 400);
    }

    $db = Database::getConnection();
    $id = Database::generateId('HST');

    $stmt = $db->prepare("INSERT INTO hostels (id, school_id, name, type, capacity, warden_name) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $user['school_id'], $name, $type, $capacity, $wardenName ?: null]);

    Auth::sendResponse(["id" => $id, "message" => "Hostel / Staff Quarter created successfully."], null, 201);
});

// ── GET /hostels/allocations (List room & bed allocations) ───────────────────
$router->get('/hostels/allocations', function() {
    $user = Auth::requireAuth();
    $db = Database::getConnection();
    $schoolId = $user['school_id'] ?: 'HARAREPR';

    $stmt = $db->prepare("
        SELECT ha.*, h.name as hostel_name, h.type as hostel_type,
               CASE 
                 WHEN ha.occupant_type = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
                 ELSE st.name
               END as occupant_name,
               CASE 
                 WHEN ha.occupant_type = 'student' THEN s.admission_number
                 ELSE st.employee_code
               END as occupant_code
        FROM hostel_allocations ha
        JOIN hostels h ON ha.hostel_id = h.id
        LEFT JOIN students s ON ha.occupant_id = s.id AND ha.occupant_type = 'student'
        LEFT JOIN staff st ON ha.occupant_id = st.id AND ha.occupant_type = 'staff'
        WHERE ha.school_id = ?
        ORDER BY h.name ASC, ha.room_number ASC
    ");
    $stmt->execute([$schoolId]);
    $allocations = $stmt->fetchAll();

    Auth::sendResponse($allocations);
});

// ── POST /hostels/allocate (Allocate room/bed to student or teacher) ─────────
$router->post('/hostels/allocate', function() {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin', 'school_admin']);
    $data = getJsonInput();

    $hostelId    = trim($data['hostel_id'] ?? '');
    $occupantId  = trim($data['occupant_id'] ?? '');
    $occupantType= trim($data['occupant_type'] ?? 'student'); // 'student' | 'staff'
    $roomNumber  = trim($data['room_number'] ?? '');
    $bedNumber   = trim($data['bed_number'] ?? '');
    $term        = trim($data['term'] ?? Database::getCurrentTerm($user['school_id']));

    if (empty($hostelId) || empty($occupantId) || empty($roomNumber)) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Hostel ID, occupant ID, and room number required."], 400);
    }

    $db = Database::getConnection();
    $id = Database::generateId('HAL');

    $stmt = $db->prepare("INSERT INTO hostel_allocations (id, school_id, hostel_id, occupant_id, occupant_type, room_number, bed_number, allocated_date, term)
                          VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)");
    $stmt->execute([$id, $user['school_id'], $hostelId, $occupantId, $occupantType, $roomNumber, $bedNumber ?: null, $term]);

    Auth::sendResponse(["id" => $id, "message" => "Accommodation allocated successfully."], null, 201);
});
