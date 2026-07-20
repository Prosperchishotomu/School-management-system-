<?php

$router->get('/schools/{schoolId}/classes/{classId}/attendance', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $dateParam = Auth::validateDate($_GET['date'] ?? '', 'date');
    $date = $dateParam ?: date('Y-m-d');

    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT a.student_id, a.status, a.remarks,
                                 CONCAT(s.first_name, ' ', s.last_name) as student_name,
                                 s.admission_number
                          FROM attendance a
                          JOIN students s ON a.student_id = s.id
                          WHERE a.school_id=? AND a.class_id=? AND a.date=?
                          ORDER BY s.last_name ASC");
    $stmt->execute([$schoolId, $classId, $date]);
    $records = $stmt->fetchAll();

    // Also return all enrolled students in this class
    $stmtAll = $db->prepare("SELECT id as student_id, CONCAT(first_name,' ',last_name) as student_name, admission_number
                              FROM students WHERE school_id=? AND class_id=? AND status='enrolled' ORDER BY last_name ASC");
    $stmtAll->execute([$schoolId, $classId]);
    $allStudents = $stmtAll->fetchAll();

    Auth::sendResponse(["date" => $date, "records" => $records, "students" => $allStudents]);
});

// POST /schools/{schoolId}/classes/{classId}/attendance
$router->post('/schools/{schoolId}/classes/{classId}/attendance', function($schoolId, $classId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['teacher', 'school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (empty($input['date']) || empty($input['records'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "date and records[] are required."], 400);
    }
    Auth::validateDate($input['date'], 'date');

    $db = Database::getConnection();
    
    // Check if attendance notifications are enabled
    $stmtSettings = $db->prepare("SELECT notify_attendance_absent FROM notification_settings WHERE school_id=?");
    $stmtSettings->execute([$schoolId]);
    $settings = $stmtSettings->fetch();
    $notifyAbsent = $settings ? (int)$settings['notify_attendance_absent'] : 1;

    $db->beginTransaction();
    try {
        $stmtUpsert = $db->prepare("INSERT INTO attendance (id, school_id, class_id, student_id, date, status, remarks, taken_by)
                                    VALUES (?,?,?,?,?,?,?,?)
                                    ON DUPLICATE KEY UPDATE status=VALUES(status), remarks=VALUES(remarks), taken_by=VALUES(taken_by)");
        
        foreach ($input['records'] as $record) {
            if (empty($record['student_id']) || empty($record['status'])) continue;
            $validStatuses = ['present', 'absent', 'late', 'excused'];
            $recordStatus  = in_array($record['status'], $validStatuses) ? $record['status'] : 'absent';
            $attId         = Database::generateUniqueId('attendance');
            
            $stmtUpsert->execute([
                $attId, $schoolId, $classId,
                $record['student_id'],
                $input['date'],
                $recordStatus,
                $record['remarks'] ?? null,
                $user['id']
            ]);

            // If student is marked absent and alerts are enabled, notify guardians
            if ($recordStatus === 'absent' && $notifyAbsent === 1) {
                // Fetch student name
                $stmtStudent = $db->prepare("SELECT first_name, last_name FROM students WHERE id=?");
                $stmtStudent->execute([$record['student_id']]);
                $student = $stmtStudent->fetch();
                if ($student) {
                    $studentName = $student['first_name'] . ' ' . $student['last_name'];
                    
                    // Fetch linked guardians
                    $stmtGuardians = $db->prepare("SELECT g.user_id, g.name, g.phone, g.email 
                                                   FROM guardians g 
                                                   JOIN student_guardians sg ON g.id = sg.guardian_id 
                                                   WHERE sg.student_id=?");
                    $stmtGuardians->execute([$record['student_id']]);
                    $guardians = $stmtGuardians->fetchAll();
                    
                    foreach ($guardians as $g) {
                        if ($g['user_id']) {
                            Auth::sendNotification($schoolId, $g['user_id'], "Student Absence Alert", "Please be advised that {$studentName} has been marked ABSENT from class today ({$input['date']}).");
                        }
                        if ($g['phone']) {
                            Auth::logAction($schoolId, $user['id'], 'SMS_SIMULATED', 'guardians', $g['user_id'], "SMS simulated to guardian {$g['name']} ({$g['phone']}): Child {$studentName} marked absent on {$input['date']}.");
                        }
                        if ($g['email']) {
                            Auth::logAction($schoolId, $user['id'], 'EMAIL_SIMULATED', 'guardians', $g['user_id'], "Email simulated to guardian {$g['name']} ({$g['email']}): Child {$studentName} marked absent on {$input['date']}.");
                        }
                    }
                }
            }
        }
        
        Auth::logAction($schoolId, $user['id'], 'ATTENDANCE_SUBMITTED', 'attendance', $classId, "Submitted attendance for class #{$classId} on {$input['date']}");
        $db->commit();
        Auth::sendResponse(["success" => true, "message" => "Attendance saved successfully."]);
    } catch (Exception $e) {
        $db->rollBack();
        error_log("Attendance save failed: " . $e->getMessage());
        Auth::sendResponse(null, ["code" => "TRANSACTION_FAILED", "message" => "Failed to save attendance."], 500);
    }
});

// GET /schools/{schoolId}/attendance/summary — for dashboard/reporting
$router->get('/schools/{schoolId}/attendance/summary', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    $startDate = Auth::validateDate($_GET['start_date'] ?? '', 'start_date') ?: date('Y-m-01');
    $endDate   = Auth::validateDate($_GET['end_date']   ?? '', 'end_date')   ?: date('Y-m-d');
    $classId   = $_GET['class_id'] ?? null;

    $db = Database::getConnection();
    $conditions = ["a.school_id = ?", "a.date BETWEEN ? AND ?"];
    $params     = [$schoolId, $startDate, $endDate];
    if ($classId) { $conditions[] = "a.class_id = ?"; $params[] = $classId; }
    $where = implode(" AND ", $conditions);

    $stmt = $db->prepare("SELECT a.date,
                                 COUNT(*) as total,
                                 SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present,
                                 SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) as absent,
                                 SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) as late,
                                 SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) as excused
                          FROM attendance a WHERE {$where} GROUP BY a.date ORDER BY a.date ASC");
    $stmt->execute($params);
    Auth::sendResponse($stmt->fetchAll());
});

// GET /schools/{schoolId}/attendance/weekly-reports — compiles weekly data science reports
$router->get('/schools/{schoolId}/attendance/weekly-reports', function($schoolId) {
    $user = Auth::requireAuth();
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }
    
    $weekStart = Auth::validateDate($_GET['week_start'] ?? '', 'week_start');
    if (!$weekStart) {
        $weekStart = date('Y-m-d', strtotime('monday this week'));
    }
    $weekEnd = date('Y-m-d', strtotime($weekStart . ' +4 days'));
    $prevWeekStart = date('Y-m-d', strtotime($weekStart . ' -7 days'));
    $prevWeekEnd = date('Y-m-d', strtotime($prevWeekStart . ' +4 days'));

    $db = Database::getConnection();

    // Class-by-class expected vs actual
    $stmtClasses = $db->prepare("
        SELECT c.id as class_id, c.name as class_name,
               (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'enrolled') as student_count,
               COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0) as present_count,
               COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0) as absent_count,
               COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0) as late_count,
               COALESCE(SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END), 0) as excused_count
        FROM classes c
        LEFT JOIN attendance a ON a.class_id = c.id AND a.date BETWEEN ? AND ?
        WHERE c.school_id = ?
        GROUP BY c.id, c.name
    ");
    $stmtClasses->execute([$weekStart, $weekEnd, $schoolId]);
    $classData = $stmtClasses->fetchAll();

    // Daily trends
    $stmtDaily = $db->prepare("
        SELECT a.date, DAYNAME(a.date) as day_name,
               SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) as present,
               COUNT(*) as total
        FROM attendance a
        WHERE a.school_id = ? AND a.date BETWEEN ? AND ?
        GROUP BY a.date
        ORDER BY a.date ASC
    ");
    $stmtDaily->execute([$schoolId, $weekStart, $weekEnd]);
    $dailyData = $stmtDaily->fetchAll();

    // Previous week baseline
    $stmtPrev = $db->prepare("
        SELECT SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) as present,
               COUNT(*) as total
        FROM attendance a
        WHERE a.school_id = ? AND a.date BETWEEN ? AND ?
    ");
    $stmtPrev->execute([$schoolId, $prevWeekStart, $prevWeekEnd]);
    $prevData = $stmtPrev->fetch();
    $prevRate = $prevData && $prevData['total'] > 0 ? ROUND(($prevData['present'] / $prevData['total']) * 100, 1) : null;

    // Chronically absent pupils (>2 days absent or >30% absence rate in the week)
    $stmtChronic = $db->prepare("
        SELECT s.id as student_id, CONCAT(s.first_name, ' ', s.last_name) as student_name, c.name as class_name,
               SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
               COUNT(a.id) as total_days
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        JOIN classes c ON s.class_id = c.id
        WHERE a.school_id = ? AND a.date BETWEEN ? AND ?
        GROUP BY s.id, s.first_name, s.last_name, c.name
        HAVING absent_days >= 2 OR (absent_days / total_days) > 0.3
        ORDER BY absent_days DESC LIMIT 10
    ");
    $stmtChronic->execute([$schoolId, $weekStart, $weekEnd]);
    $chronicStudents = $stmtChronic->fetchAll();

    // Text classification on teacher comments/remarks to extract absence categories
    $stmtRemarks = $db->prepare("
        SELECT remarks FROM attendance 
        WHERE school_id = ? AND date BETWEEN ? AND ? AND status IN ('absent', 'late', 'excused') AND remarks IS NOT NULL AND remarks != ''
    ");
    $stmtRemarks->execute([$schoolId, $weekStart, $weekEnd]);
    $remarksList = $stmtRemarks->fetchAll(PDO::FETCH_COLUMN);

    $reasonCategories = [
        "sick" => 0,
        "family" => 0,
        "transport" => 0,
        "truant" => 0,
        "other" => 0
    ];
    foreach ($remarksList as $rem) {
        $lower = strtolower($rem);
        if (strpos($lower, 'sick') !== false || strpos($lower, 'ill') !== false || strpos($lower, 'fever') !== false || strpos($lower, 'doctor') !== false || strpos($lower, 'hospital') !== false || strpos($lower, 'malaria') !== false || strpos($lower, 'clinic') !== false) {
            $reasonCategories["sick"]++;
        } elseif (strpos($lower, 'family') !== false || strpos($lower, 'funeral') !== false || strpos($lower, 'travel') !== false || strpos($lower, 'parent') !== false || strpos($lower, 'wedding') !== false) {
            $reasonCategories["family"]++;
        } elseif (strpos($lower, 'transport') !== false || strpos($lower, 'bus') !== false || strpos($lower, 'rain') !== false || strpos($lower, 'commute') !== false || strpos($lower, 'distance') !== false) {
            $reasonCategories["transport"]++;
        } elseif (strpos($lower, 'truant') !== false || strpos($lower, 'refused') !== false || strpos($lower, 'skip') !== false || strpos($lower, 'no show') !== false) {
            $reasonCategories["truant"]++;
        } else {
            $reasonCategories["other"]++;
        }
    }

    // Volatility (standard deviation of daily attendance) per class
    $stmtClassDaily = $db->prepare("
        SELECT class_id, date,
               SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as present,
               COUNT(*) as total
        FROM attendance
        WHERE school_id = ? AND date BETWEEN ? AND ?
        GROUP BY class_id, date
    ");
    $stmtClassDaily->execute([$schoolId, $weekStart, $weekEnd]);
    $classDailyData = $stmtClassDaily->fetchAll();

    $classDailyRates = [];
    foreach ($classDailyData as $cd) {
        if ($cd['total'] > 0) {
            $rate = ($cd['present'] / $cd['total']) * 100;
            $classDailyRates[$cd['class_id']][] = $rate;
        }
    }

    $classVolatility = [];
    foreach ($classDailyRates as $cid => $rates) {
        $count = count($rates);
        if ($count > 1) {
            $mean = array_sum($rates) / $count;
            $variance = 0;
            foreach ($rates as $r) {
                $variance += pow($r - $mean, 2);
            }
            $stdDev = sqrt($variance / ($count - 1));
            $classVolatility[$cid] = ROUND($stdDev, 1);
        } else {
            $classVolatility[$cid] = 0.0;
        }
    }

    Auth::sendResponse([
        "week_start" => $weekStart,
        "week_end" => $weekEnd,
        "prev_week_rate" => $prevRate,
        "classes" => array_map(function($c) use ($classVolatility) {
            $present = (int)$c['present_count'];
            $absent  = (int)$c['absent_count'];
            $late    = (int)$c['late_count'];
            $excused = (int)$c['excused_count'];
            $total   = $present + $absent + $late + $excused;
            $rate    = $total > 0 ? ROUND((($present + $late) / $total) * 100, 1) : 100.0;
            return [
                "class_id" => $c['class_id'],
                "class_name" => $c['class_name'],
                "student_count" => (int)$c['student_count'],
                "present" => $present,
                "absent" => $absent,
                "late" => $late,
                "excused" => $excused,
                "total_marked" => $total,
                "rate" => $rate,
                "volatility" => $classVolatility[$c['class_id']] ?? 0.0
            ];
        }, $classData),
        "daily_trends" => array_map(function($d) {
            return [
                "date" => $d['date'],
                "day" => $d['day_name'],
                "rate" => $d['total'] > 0 ? ROUND(($d['present'] / $d['total']) * 100, 1) : 100.0
            ];
        }, $dailyData),
        "absence_reasons" => $reasonCategories,
        "chronic_absentees" => array_map(function($s) {
            $rate = (int)$s['total_days'] > 0 ? ROUND((((int)$s['total_days'] - (int)$s['absent_days']) / (int)$s['total_days']) * 100, 1) : 100.0;
            return [
                "student_id" => $s['student_id'],
                "student_name" => $s['student_name'],
                "class_name" => $s['class_name'],
                "absent_days" => (int)$s['absent_days'],
                "attendance_rate" => $rate
            ];
        }, $chronicStudents)
    ]);
});
