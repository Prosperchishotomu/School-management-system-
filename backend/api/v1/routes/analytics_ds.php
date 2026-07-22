<?php
// Data Science & Predictive Intelligence Analytics Route

// GET /analytics/predictive — Statistical At-Risk Prediction, Trend Linear Forecasting, Correlation Matrix
$router->get('/analytics/predictive', function() {
    $user = Auth::requireAuth();
    $schoolId = $user['school_id'] ?: 'HARAREPR';
    $db = Database::getConnection();

    // 1. Fetch Students with Academic, Attendance, Discipline & Fee metrics
    $stmt = $db->prepare("
        SELECT s.id as student_id, s.admission_number, CONCAT(s.first_name, ' ', s.last_name) as student_name,
               c.name as class_name, c.grade_level,
               COALESCE(r.overall_percentage, 0) as last_overall_pct,
               COALESCE(f.balance, 0) as fee_balance,
               (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'absent') as total_absences,
               (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id) as total_attendance_records,
               (SELECT COUNT(*) FROM discipline_incidents d WHERE d.student_id = s.id AND d.status = 'open') as open_incidents
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN results r ON r.student_id = s.id AND r.school_id = s.school_id
        LEFT JOIN fees f ON f.student_id = s.id AND f.school_id = s.school_id
        WHERE s.school_id = ? AND s.status = 'enrolled'
    ");
    $stmt->execute([$schoolId]);
    $students = $stmt->fetchAll();

    $atRiskList = [];
    $totalScored = 0;
    $highRiskCount = 0;
    $medRiskCount = 0;

    foreach ($students as $st) {
        $academicPct = (float)$st['last_overall_pct'];
        $feeBal = (float)$st['fee_balance'];
        $absences = (int)$st['total_absences'];
        $attRecords = (int)$st['total_attendance_records'];
        $incidents = (int)$st['open_incidents'];

        $attPct = ($attRecords > 0) ? round((($attRecords - $absences) / $attRecords) * 100, 1) : 100.0;

        // Predictive Risk Score Formula (0 to 100)
        $academicRisk  = max(0, min(40, (50 - $academicPct) * 0.8));
        $attendanceRisk= ($attPct < 85) ? min(30, (85 - $attPct) * 2) : 0;
        $disciplineRisk= min(20, $incidents * 10);
        $financialRisk = ($feeBal > 200) ? 10 : ($feeBal > 0 ? 5 : 0);

        $riskScore = round($academicRisk + $attendanceRisk + $disciplineRisk + $financialRisk, 1);
        $riskLevel = ($riskScore >= 45) ? 'high' : (($riskScore >= 20) ? 'moderate' : 'low');

        if ($riskLevel === 'high') $highRiskCount++;
        if ($riskLevel === 'moderate') $medRiskCount++;
        $totalScored++;

        // Projected performance based on attendance & behavioral factors
        $projectedPct = max(0, min(100, round($academicPct + ($attPct >= 90 ? 3.5 : -4.0) - ($incidents * 2.0), 1)));

        $atRiskList[] = [
            "student_id"       => $st['student_id'],
            "admission_number" => $st['admission_number'],
            "student_name"     => $st['student_name'],
            "class_name"       => $st['class_name'],
            "academic_pct"     => $academicPct,
            "attendance_pct"   => $attPct,
            "incidents"        => $incidents,
            "fee_balance"      => $feeBal,
            "risk_score"       => $riskScore,
            "risk_level"       => $riskLevel,
            "projected_pct"    => $projectedPct,
            "primary_units_est"=> Database::calculatePrimaryUnits($schoolId, $st['student_id'], Database::getCurrentTerm($schoolId))
        ];
    }

    // Sort by highest risk score first
    usort($atRiskList, function($a, $b) {
        return $b['risk_score'] <=> $a['risk_score'];
    });

    // 2. Compute Subject Pair Correlation Matrix
    $stmtGrades = $db->prepare("
        SELECT student_id, subject, grade_value
        FROM grades
        WHERE school_id = ?
    ");
    $stmtGrades->execute([$schoolId]);
    $allGrades = $stmtGrades->fetchAll();

    $studentSubjectMap = [];
    foreach ($allGrades as $g) {
        $studentSubjectMap[$g['student_id']][$g['subject']] = (float)$g['grade_value'];
    }

    $subjectsList = ['Mathematics', 'English', 'Shona', 'Science'];
    $correlationMatrix = [];
    foreach ($subjectsList as $s1) {
        foreach ($subjectsList as $s2) {
            if ($s1 === $s2) {
                $correlationMatrix[$s1][$s2] = 1.0;
                continue;
            }
            $v1 = []; $v2 = [];
            foreach ($studentSubjectMap as $sMap) {
                if (isset($sMap[$s1]) && isset($sMap[$s2])) {
                    $v1[] = $sMap[$s1];
                    $v2[] = $sMap[$s2];
                }
            }
            $corr = computePearsonCorrelation($v1, $v2);
            $correlationMatrix[$s1][$s2] = round($corr, 2);
        }
    }

    Auth::sendResponse([
        "summary" => [
            "total_students_assessed" => $totalScored,
            "high_risk_count"        => $highRiskCount,
            "moderate_risk_count"    => $medRiskCount,
            "low_risk_count"         => $totalScored - ($highRiskCount + $medRiskCount)
        ],
        "at_risk_students"    => array_slice($atRiskList, 0, 20),
        "correlation_matrix"  => $correlationMatrix
    ]);
});

/**
 * Helper to compute Pearson Correlation Coefficient (r)
 */
function computePearsonCorrelation($x, $y) {
    $n = count($x);
    if ($n < 2) return 0.0;
    
    $meanX = array_sum($x) / $n;
    $meanY = array_sum($y) / $n;
    
    $num = 0; $denX = 0; $denY = 0;
    for ($i = 0; $i < $n; $i++) {
        $dx = $x[$i] - $meanX;
        $dy = $y[$i] - $meanY;
        $num += $dx * $dy;
        $denX += $dx * $dx;
        $denY += $dy * $dy;
    }
    $den = sqrt($denX * $denY);
    return ($den == 0) ? 0.0 : ($num / $den);
}
