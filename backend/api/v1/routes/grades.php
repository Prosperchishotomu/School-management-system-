<?php

$router->get('/schools/{schoolId}/classes/{classId}/grades', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['teacher', 'school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db          = Database::getConnection();
    $currentTerm = Database::getCurrentTerm($schoolId);
    $term        = trim($_GET['term'] ?? $currentTerm);

    // 1. Fetch all active/enrolled students in this class
    $stmtStudents = $db->prepare("SELECT id as student_id, first_name, last_name, admission_number 
                                  FROM students 
                                  WHERE school_id=? AND class_id=? AND status='enrolled' 
                                  ORDER BY last_name ASC, first_name ASC");
    $stmtStudents->execute([$schoolId, $classId]);
    $studentsList = $stmtStudents->fetchAll();

    // 2. Fetch all registered grades for this class/term
    $stmtGrades = $db->prepare("SELECT id, student_id, subject, grade_value, assessment_type, assessment_name, weight 
                                FROM grades 
                                WHERE school_id=? AND class_id=? AND term=?");
    $stmtGrades->execute([$schoolId, $classId, $term]);
    $gradesList = $stmtGrades->fetchAll();

    $gradesByStudent = [];
    foreach ($gradesList as $g) {
        $gradesByStudent[$g['student_id']][] = $g;
    }

    $data = [];
    foreach ($studentsList as $s) {
        $s['grades'] = $gradesByStudent[$s['student_id']] ?? [];
        $data[] = $s;
    }

    Auth::sendResponse($data);
});

// POST /schools/{schoolId}/classes/{classId}/grades
$router->post('/schools/{schoolId}/classes/{classId}/grades', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['teacher', 'school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['student_id']) || empty($input['subject']) || !isset($input['grade_value']) || empty($input['assessment_type'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "student_id, subject, grade_value, assessment_type are required."], 400);
    }
    if ((float)$input['grade_value'] < 0 || (float)$input['grade_value'] > 100) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "grade_value must be between 0 and 100."], 400);
    }
    $db          = Database::getConnection();
    $currentTerm = Database::getCurrentTerm($schoolId);
    $term        = trim($input['term'] ?? $currentTerm);
    $assName     = trim($input['assessment_name'] ?? 'Test 1');
    if (empty($assName)) $assName = 'Test 1';
    
    $gradeId     = Database::generateUniqueId('grades');
    $stmt        = $db->prepare("INSERT INTO grades (id, school_id, student_id, class_id, subject, term, grade_value, assessment_type, assessment_name, weight) VALUES (?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([$gradeId, $schoolId, $input['student_id'], $classId, $input['subject'], $term, (float)$input['grade_value'], $input['assessment_type'], $assName, (float)($input['weight'] ?? 1.00)]);
    Auth::logAction($schoolId, $user['id'], 'GRADE_ENTERED', 'grades', $gradeId, "Grade {$input['grade_value']} for {$input['subject']} ($assName) in class #{$classId}");
    Auth::sendResponse(["id" => $gradeId], null, 201);
});

// PUT /schools/{schoolId}/classes/{classId}/grades
$router->put('/schools/{schoolId}/classes/{classId}/grades', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['teacher', 'school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $records = $input['records'] ?? [];
    if (!is_array($records)) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "records array is required."], 400);
    }

    $db          = Database::getConnection();
    $currentTerm = Database::getCurrentTerm($schoolId);
    $term        = trim($_GET['term'] ?? $currentTerm);
    
    $saved = 0;
    $db->beginTransaction();
    try {
        $stmtFind = $db->prepare("SELECT id FROM grades WHERE student_id=? AND term=? AND subject=? AND assessment_type=? AND assessment_name=? AND school_id=?");
        $stmtInsert = $db->prepare("INSERT INTO grades (id, school_id, student_id, class_id, subject, term, grade_value, assessment_type, assessment_name, weight) VALUES (?,?,?,?,?,?,?,?,?,?)");
        $stmtUpdate = $db->prepare("UPDATE grades SET grade_value=?, weight=? WHERE id=?");

        foreach ($records as $r) {
            $studentId = $r['student_id'] ?? '';
            $sub = $r['subject'] ?? '';
            $assType = $r['assessment_type'] ?? 'test';
            $assName = trim($r['assessment_name'] ?? 'Test 1');
            if (empty($assName)) $assName = 'Test 1';
            $val = (float)($r['grade_value'] ?? 0);
            $w = (float)($r['weight'] ?? 1.00);

            if (empty($studentId) || empty($sub)) continue;

            $stmtFind->execute([$studentId, $term, $sub, $assType, $assName, $schoolId]);
            $existing = $stmtFind->fetch();

            if ($existing) {
                $stmtUpdate->execute([$val, $w, $existing['id']]);
            } else {
                $gradeId = Database::generateUniqueId('grades');
                $stmtInsert->execute([$gradeId, $schoolId, $studentId, $classId, $sub, $term, $val, $assType, $assName, $w]);
            }
            $saved++;
        }

        Auth::logAction($schoolId, $user['id'], 'GRADES_BULK_UPDATED', 'grades', $classId, "Bulk updated $saved grades in class #{$classId} for term {$term}");
        $db->commit();
        Auth::sendResponse(["success" => true, "saved" => $saved]);
    } catch (Exception $e) {
        $db->rollBack();
        error_log("PUT grades failed: " . $e->getMessage());
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Failed to update grades: " . $e->getMessage()], 500);
    }
});

// POST /schools/{schoolId}/classes/{classId}/grades/batch
$router->post('/schools/{schoolId}/classes/{classId}/grades/batch', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['teacher', 'school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['grades']) || !is_array($input['grades'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "grades[] array is required."], 400);
    }
    $db          = Database::getConnection();
    $currentTerm = Database::getCurrentTerm($schoolId);
    $term        = trim($input['term'] ?? $currentTerm);
    $saved       = 0;
    $db->beginTransaction();
    try {
        $stmt = $db->prepare("INSERT INTO grades (id, school_id, student_id, class_id, subject, term, grade_value, assessment_type, assessment_name, weight) VALUES (?,?,?,?,?,?,?,?,?,?)");
        $stmtFind = $db->prepare("SELECT id FROM grades WHERE student_id=? AND term=? AND subject=? AND assessment_type=? AND assessment_name=? AND school_id=?");
        $stmtUpdate = $db->prepare("UPDATE grades SET grade_value=?, weight=? WHERE id=?");

        foreach ($input['grades'] as $g) {
            if (empty($g['student_id']) || empty($g['subject']) || !isset($g['grade_value'])) continue;
            
            $assType = $g['assessment_type'] ?? 'exam';
            $assName = trim($g['assessment_name'] ?? 'Test 1');
            if (empty($assName)) $assName = 'Test 1';
            
            $stmtFind->execute([$g['student_id'], $term, $g['subject'], $assType, $assName, $schoolId]);
            $existing = $stmtFind->fetch();
            
            if ($existing) {
                $stmtUpdate->execute([(float)$g['grade_value'], (float)($g['weight'] ?? 1.00), $existing['id']]);
            } else {
                $gradeId = Database::generateUniqueId('grades');
                $stmt->execute([$gradeId, $schoolId, $g['student_id'], $classId, $g['subject'], $term, (float)$g['grade_value'], $assType, $assName, (float)($g['weight'] ?? 1.00)]);
            }
            $saved++;
        }
        Auth::logAction($schoolId, $user['id'], 'GRADES_BATCH_ENTERED', 'grades', $classId, "Batch entered $saved grade records for class #{$classId} term {$term}");
        $db->commit();
        Auth::sendResponse(["saved" => $saved]);
    } catch (Exception $e) {
        $db->rollBack();
        error_log("Batch grade save failed: " . $e->getMessage());
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Failed to save grade batch: " . $e->getMessage()], 500);
    }
});

// GET /schools/{schoolId}/classes/{classId}/results
$router->get('/schools/{schoolId}/classes/{classId}/results', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db          = Database::getConnection();
    $currentTerm = Database::getCurrentTerm($schoolId);
    $term        = trim($_GET['term'] ?? $currentTerm);

    // 1. If results are published, return them directly
    $stmtPub = $db->prepare("SELECT r.*, CONCAT(s.first_name,' ',s.last_name) as student_name, s.admission_number, c.name as class_name
                             FROM results r 
                             JOIN students s ON r.student_id=s.id
                             JOIN classes c ON r.class_id=c.id
                             WHERE r.school_id=? AND r.class_id=? AND r.term=? ORDER BY r.rank ASC");
    $stmtPub->execute([$schoolId, $classId, $term]);
    $published = $stmtPub->fetchAll();
    if (!empty($published)) {
        Auth::sendResponse($published);
    }

    // 2. Otherwise compute from gradesheet averages
    $stmtClass = $db->prepare("SELECT name, grade_level FROM classes WHERE id=? AND school_id=?");
    $stmtClass->execute([$classId, $schoolId]);
    $classDetails = $stmtClass->fetch();
    if (!$classDetails) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Class not found."], 404);
    }
    $gradeLevel = $classDetails['grade_level'];

    // Fetch all enrolled students in the Form/Grade Level and compute their averages
    $stmtFormResults = $db->prepare("
        SELECT s.id as student_id, s.class_id, c.name as class_name,
               CONCAT(s.first_name,' ',s.last_name) as student_name, s.admission_number,
               COALESCE(ROUND(SUM(g.grade_value * g.weight) / NULLIF(SUM(g.weight), 0), 2), 0.00) as overall_percentage
        FROM students s
        JOIN classes c ON s.class_id = c.id
        LEFT JOIN grades g ON s.id = g.student_id AND g.term = ? AND g.school_id = ?
        WHERE s.school_id = ? AND c.grade_level = ? AND s.status = 'enrolled'
        GROUP BY s.id, s.class_id, c.name
        ORDER BY overall_percentage DESC
    ");
    $stmtFormResults->execute([$term, $schoolId, $schoolId, $gradeLevel]);
    $formList = $stmtFormResults->fetchAll();

    $formTotal = count($formList);
    $formRank = 1;
    $prevPct = null;
    $actualRank = 1;
    
    foreach ($formList as $idx => &$student) {
        $pct = (float)$student['overall_percentage'];
        if ($prevPct !== null && $pct < $prevPct) {
            $actualRank = $idx + 1;
        }
        $student['form_rank'] = $actualRank;
        $student['form_total'] = $formTotal;
        $prevPct = $pct;
    }
    unset($student);

    // Filter to target class specifically
    $classList = [];
    foreach ($formList as $student) {
        if ($student['class_id'] === $classId) {
            $classList[] = $student;
        }
    }

    $classTotal = count($classList);
    $classRank = 1;
    $prevClassPct = null;
    $actualClassRank = 1;
    
    foreach ($classList as $idx => &$student) {
        $pct = (float)$student['overall_percentage'];
        if ($prevClassPct !== null && $pct < $prevClassPct) {
            $actualClassRank = $idx + 1;
        }
        
        $avg = (float)$student['overall_percentage'];
        $gradeInfo = Database::getGradeForMark($schoolId, $avg);
        $student['grade']       = $gradeInfo['grade'];
        $student['pass_status'] = $gradeInfo['pass_status'];
        $student['rank']        = $actualClassRank; // class rank
        $student['class_total'] = $classTotal;
        $student['status']      = 'draft';
        $student['term']        = $term;
        $student['grade_level'] = $gradeLevel;
        
        $prevClassPct = $pct;
    }
    unset($student);

    usort($classList, function($a, $b) {
        return $a['rank'] <=> $b['rank'];
    });

    Auth::sendResponse($classList);
});

// GET /schools/{schoolId}/classes/{classId}/results/export — CSV
$router->get('/schools/{schoolId}/classes/{classId}/results/export', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $db          = Database::getConnection();
    $currentTerm = Database::getCurrentTerm($schoolId);
    $term        = trim($_GET['term'] ?? $currentTerm);

    $stmtClass = $db->prepare("SELECT name FROM classes WHERE id=? AND school_id=?");
    $stmtClass->execute([$classId, $schoolId]);
    $className = $stmtClass->fetchColumn() ?: 'Class';

    $stmt = $db->prepare("SELECT r.rank, r.class_total, r.form_rank, r.form_total,
                                 CONCAT(s.first_name,' ',s.last_name) as student_name, s.admission_number,
                                 r.overall_percentage, r.grade, r.pass_status, r.status as result_status
                          FROM results r JOIN students s ON r.student_id=s.id
                          WHERE r.school_id=? AND r.class_id=? AND r.term=? ORDER BY r.rank ASC");
    $stmt->execute([$schoolId, $classId, $term]);
    $rows = $stmt->fetchAll();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="results_' . preg_replace('/[^a-z0-9]/i', '_', $className) . '_' . $term . '.csv"');
    header('X-API-Version: v1');

    $output = fopen('php://output', 'w');
    fputcsv($output, ['Class Position', 'Form Position', 'Student Name', 'Admission No', 'Average %', 'Grade', 'Pass/Fail', 'Status']);
    foreach ($rows as $row) {
        $classPos = $row['rank'] . ' of ' . ($row['class_total'] ?: count($rows));
        $formPos = ($row['form_rank'] ?: '—') . ' of ' . ($row['form_total'] ?: '—');
        fputcsv($output, [
            $classPos,
            $formPos,
            $row['student_name'],
            $row['admission_number'],
            $row['overall_percentage'] . '%',
            $row['grade'],
            strtoupper($row['pass_status']),
            strtoupper($row['result_status'])
        ]);
    }
    fclose($output);
    Auth::logAction($schoolId, $user['id'], 'RESULTS_EXPORTED', 'results', $classId, "Exported results CSV with dual positions for class {$className} term {$term}");
    exit;
});

// Helper to compute and publish results
function publishClassResults($schoolId, $classId, $term, $userId) {
    $db = Database::getConnection();

    // 1. Get class details & grade level
    $stmtClass = $db->prepare("SELECT name, grade_level FROM classes WHERE id=? AND school_id=?");
    $stmtClass->execute([$classId, $schoolId]);
    $classDetails = $stmtClass->fetch();
    if (!$classDetails) {
        throw new Exception("Class not found.");
    }
    $gradeLevel = $classDetails['grade_level'];

    // 2. Fetch all enrolled students across the entire Form/Grade Level, compute averages
    $stmtFormResults = $db->prepare("
        SELECT s.id as student_id, s.class_id, c.name as class_name,
               CONCAT(s.first_name,' ',s.last_name) as student_name, s.admission_number,
               COALESCE(ROUND(SUM(g.grade_value * g.weight) / NULLIF(SUM(g.weight), 0), 2), 0.00) as overall_percentage
        FROM students s
        JOIN classes c ON s.class_id = c.id
        LEFT JOIN grades g ON s.id = g.student_id AND g.term = ? AND g.school_id = ?
        WHERE s.school_id = ? AND c.grade_level = ? AND s.status = 'enrolled'
        GROUP BY s.id, s.class_id, c.name
        ORDER BY overall_percentage DESC
    ");
    $stmtFormResults->execute([$term, $schoolId, $schoolId, $gradeLevel]);
    $formList = $stmtFormResults->fetchAll();

    if (empty($formList)) {
        throw new Exception("No active student records or grades found at this grade level.");
    }

    $formTotal = count($formList);
    $prevPct = null;
    $actualRank = 1;
    
    foreach ($formList as $idx => &$student) {
        $pct = (float)$student['overall_percentage'];
        if ($prevPct !== null && $pct < $prevPct) {
            $actualRank = $idx + 1;
        }
        $student['form_rank'] = $actualRank;
        $student['form_total'] = $formTotal;
        $prevPct = $pct;
    }
    unset($student);

    // Filter to target class specifically
    $classList = [];
    foreach ($formList as $student) {
        if ($student['class_id'] === $classId) {
            $classList[] = $student;
        }
    }

    if (empty($classList)) {
        throw new Exception("No grades recorded for this class and term.");
    }

    $classTotal = count($classList);
    $prevClassPct = null;
    $actualClassRank = 1;
    
    foreach ($classList as $idx => &$student) {
        $pct = (float)$student['overall_percentage'];
        if ($prevClassPct !== null && $pct < $prevClassPct) {
            $actualClassRank = $idx + 1;
        }
        
        $avg = (float)$student['overall_percentage'];
        $gradeInfo = Database::getGradeForMark($schoolId, $avg);
        $student['grade']       = $gradeInfo['grade'];
        $student['pass_status'] = $gradeInfo['pass_status'];
        $student['rank']        = $actualClassRank;
        $student['class_total'] = $classTotal;
        
        $prevClassPct = $pct;
    }
    unset($student);

    // Lock and Save to results table
    $db->beginTransaction();
    try {
        $db->prepare("DELETE FROM results WHERE school_id=? AND class_id=? AND term=?")->execute([$schoolId, $classId, $term]);

        $stmtInsert = $db->prepare("
            INSERT INTO results (id, school_id, student_id, class_id, term, overall_percentage, grade, rank, form_rank, form_total, class_total, pass_status, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
        ");

        foreach ($classList as $c) {
            $resultId = Database::generateUniqueId('results');
            $stmtInsert->execute([
                $resultId,
                $schoolId,
                $c['student_id'],
                $classId,
                $term,
                $c['overall_percentage'],
                $c['grade'],
                $c['rank'],
                $c['form_rank'],
                $c['form_total'],
                $c['class_total'],
                $c['pass_status']
            ]);
        }

        Auth::logAction($schoolId, $userId, 'RESULTS_PUBLISHED', 'classes', $classId, "Published Term results for class #{$classId} (Grade Level: {$gradeLevel}) term: {$term}");
        $db->commit();
        return true;
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

// POST /schools/{schoolId}/classes/{classId}/results/publish
$router->post('/schools/{schoolId}/classes/{classId}/results/publish', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input       = json_decode(file_get_contents('php://input'), true);
    $currentTerm = Database::getCurrentTerm($schoolId);
    $term        = trim($input['term'] ?? $currentTerm);

    try {
        publishClassResults($schoolId, $classId, $term, $user['id']);
        Auth::sendResponse(["success" => true, "message" => "Term results locked and published successfully."]);
    } catch (Exception $e) {
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => $e->getMessage()], 500);
    }
});

// POST /schools/{schoolId}/results/publish
$router->post('/schools/{schoolId}/results/publish', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $classId = $input['class_id'] ?? '';
    $currentTerm = Database::getCurrentTerm($schoolId);
    $term = trim($input['term'] ?? $currentTerm);

    if (empty($classId)) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "class_id is required in request body."], 400);
    }

    try {
        publishClassResults($schoolId, $classId, $term, $user['id']);
        Auth::sendResponse(["success" => true, "message" => "Term results locked and published successfully."]);
    } catch (Exception $e) {
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => $e->getMessage()], 500);
    }
});

// GET /schools/{schoolId}/grade-thresholds
$router->get('/schools/{schoolId}/grade-thresholds', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    
    $db = Database::getConnection();
    
    $stmtSch = $db->prepare("SELECT name, school_type FROM schools WHERE id = ? LIMIT 1");
    $stmtSch->execute([$schoolId]);
    $school = $stmtSch->fetch();
    if (!$school) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $stmtThresholds = $db->prepare("SELECT id, grade_symbol, min_mark, max_mark, is_pass FROM grade_thresholds WHERE school_id = ? ORDER BY min_mark DESC");
    $stmtThresholds->execute([$schoolId]);
    $thresholds = $stmtThresholds->fetchAll();
    
    Auth::sendResponse([
        'school_name' => $school['name'],
        'school_type' => $school['school_type'],
        'thresholds' => $thresholds
    ]);
});

// POST /schools/{schoolId}/grade-thresholds
$router->post('/schools/{schoolId}/grade-thresholds', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['super_admin']);
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['school_type']) || !isset($input['thresholds']) || !is_array($input['thresholds'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "school_type and thresholds array are required."], 400);
    }
    
    $db = Database::getConnection();
    
    $stmtSch = $db->prepare("SELECT id FROM schools WHERE id = ? LIMIT 1");
    $stmtSch->execute([$schoolId]);
    if (!$stmtSch->fetch()) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $db->beginTransaction();
    try {
        $stmtUpdateSch = $db->prepare("UPDATE schools SET school_type = ? WHERE id = ?");
        $stmtUpdateSch->execute([$input['school_type'], $schoolId]);
        
        $db->prepare("DELETE FROM grade_thresholds WHERE school_id = ?")->execute([$schoolId]);
        
        $stmtInsert = $db->prepare("INSERT INTO grade_thresholds (id, school_id, grade_symbol, min_mark, max_mark, is_pass) VALUES (?, ?, ?, ?, ?, ?)");
        
        foreach ($input['thresholds'] as $t) {
            if (!isset($t['grade_symbol']) || !isset($t['min_mark']) || !isset($t['max_mark'])) continue;
            $tid = Database::generateUniqueId('grade_thresholds');
            $stmtInsert->execute([
                $tid,
                $schoolId,
                trim($t['grade_symbol']),
                (float)$t['min_mark'],
                (float)$t['max_mark'],
                (int)($t['is_pass'] ?? 1)
            ]);
        }
        
        Auth::logAction($schoolId, $user['id'], 'GRADING_THRESHOLDS_UPDATED', 'grade_thresholds', $schoolId, "Updated grading thresholds and set type to '{$input['school_type']}'");
        $db->commit();
        Auth::sendResponse(["success" => true, "message" => "Grading system thresholds updated successfully."]);
    } catch (Exception $e) {
        $db->rollBack();
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Failed to save thresholds: " . $e->getMessage()], 500);
    }
});
