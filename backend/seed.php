<?php
// schoolbase database seeding script
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils/db.php';

try {
    // Run auto-migration first
    Database::getConnection();
    // Connect directly to schoolbase
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => true,
    ];
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    
    echo "Connected to MySQL database 'schoolbase'.\n";

    // Clear existing data (be careful, this is a dev/seed script)
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $tables = [
        'hostels', 'hostel_allocations', 'expenses', 'leave_requests', 'notification_settings', 'exams', 'student_health', 'timetable', 
        'announcements', 'assets', 'discipline_incidents', 'enquiries', 
        'system_events', 'audit_logs', 'fee_payments', 'fees', 
        'results', 'grades', 'attendance', 'student_guardians', 
        'guardians', 'students', 'staff', 'classes', 'licenses', 
        'users', 'schools', 'subjects', 'report_comments', 'term_config',
        'tasks', 'teaching_assignments'
    ];
    foreach ($tables as $table) {
        try {
            $pdo->exec("DELETE FROM `$table`");
        } catch (Exception $e) {
            // Table doesn't exist yet
        }
    }
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    echo "Cleared old seed records (including new modules).\n";

    // 1. Insert Harare Primary School
    $stmtSchool = $pdo->prepare("INSERT INTO schools (id, name, code, status) VALUES ('HARAREPR', 'Harare Primary School', 'HARARE-PREP-01', 'active')");
    $stmtSchool->execute();
    echo "School 'Harare Primary School' created (HARAREPR).\n";

    // 2. Insert Users
    $users = [
        [
            'id' => 'USR00001',
            'school_id' => null, // Super admin is global
            'username' => 'superadmin',
            'password_hash' => password_hash('SuperSecurePass123', PASSWORD_DEFAULT),
            'role' => 'super_admin',
            'email' => 'super@schoolbase.co.zw'
        ],
        [
            'id' => 'USR00002',
            'school_id' => 'HARAREPR',
            'username' => 'schooladmin',
            'password_hash' => password_hash('SchoolAdmin123', PASSWORD_DEFAULT),
            'role' => 'school_admin',
            'email' => 'admin@harareprep.co.zw'
        ],
        [
            'id' => 'USR00003',
            'school_id' => 'HARAREPR',
            'username' => 'teacher',
            'password_hash' => password_hash('Teacher123', PASSWORD_DEFAULT),
            'role' => 'teacher',
            'email' => 'teacher@harareprep.co.zw'
        ],
        [
            'id' => 'USR00004',
            'school_id' => 'HARAREPR',
            'username' => 'parent',
            'password_hash' => password_hash('Parent123', PASSWORD_DEFAULT),
            'role' => 'parent',
            'email' => 'guardian@harareprep.co.zw'
        ]
    ];

    $stmtUser = $pdo->prepare("INSERT INTO users (id, school_id, username, password_hash, role, email, status) VALUES (?, ?, ?, ?, ?, ?, 'active')");
    foreach ($users as $u) {
        $stmtUser->execute([$u['id'], $u['school_id'], $u['username'], $u['password_hash'], $u['role'], $u['email']]);
    }
    echo "Seed users created:\n";
    echo "  - USR00001: superadmin / SuperSecurePass123\n";
    echo "  - USR00002: schooladmin / SchoolAdmin123\n";
    echo "  - USR00003: teacher / Teacher123\n";
    echo "  - USR00004: parent / Parent123\n";

    $schoolAdminUserId = 'USR00002';
    $superAdminId = 'USR00001';
    $teacherUserId = 'USR00003';
    $parentUserId = 'USR00004';

    // 3. Create License for Harare Primary School
    $licensePayload = json_encode(['school_id' => 'HARAREPR', 'plan' => 'full', 'expires_at' => '2026-07-31']);
    $licenseKey = base64_encode($licensePayload);
    
    $stmtLicense = $pdo->prepare("INSERT INTO licenses (id, school_id, license_key, plan, status, expires_at, max_users, issued_by) 
                                  VALUES ('LIC00001', 'HARAREPR', ?, 'full', 'active', '2028-01-01 00:00:00', 00.00, ?)");
    $stmtLicense->execute([$licenseKey, $superAdminId]);
    echo "License for school 'Harare Primary School' issued (LIC00001).\n";

    // 4. Create Classes
    $classes = [
        ['id' => 'CLS00001', 'name' => 'Grade 1 Red', 'grade_level' => 'Grade 1', 'stream' => 'Red'],
        ['id' => 'CLS00002', 'name' => 'Grade 2 Blue', 'grade_level' => 'Grade 2', 'stream' => 'Blue'],
        ['id' => 'CLS00003', 'name' => 'Grade 3 Green', 'grade_level' => 'Grade 3', 'stream' => 'Green']
    ];
    $stmtClass = $pdo->prepare("INSERT INTO classes (id, school_id, name, grade_level, stream) VALUES (?, 'HARAREPR', ?, ?, ?)");
    foreach ($classes as $c) {
        $stmtClass->execute([$c['id'], $c['name'], $c['grade_level'], $c['stream']]);
    }
    echo "Seed classes created (CLS00001, CLS00002, CLS00003).\n";

    // 3b. Create System Subjects
    $stmtSubject = $pdo->prepare("INSERT INTO subjects (id, name, code, level, category, is_active, created_by) VALUES (?, ?, ?, ?, ?, 1, ?)");
    $stmtSubject->execute(['SUB00001', 'Mathematics', 'MTH', 'all', 'general', $superAdminId]);
    $stmtSubject->execute(['SUB00002', 'English', 'ENG', 'all', 'general', $superAdminId]);
    $stmtSubject->execute(['SUB00003', 'Shona', 'SHN', 'all', 'general', $superAdminId]);
    $stmtSubject->execute(['SUB00004', 'Ndebele', 'NDB', 'all', 'general', $superAdminId]);
    $stmtSubject->execute(['SUB00005', 'Combined Science', 'SCI', 'secondary', 'general', $superAdminId]);
    $stmtSubject->execute(['SUB00006', 'History', 'HST', 'secondary', 'general', $superAdminId]);
    $stmtSubject->execute(['SUB00007', 'Literature in English', 'LIT', 'secondary', 'arts', $superAdminId]);
    $stmtSubject->execute(['SUB00008', 'Divinity', 'DIV', 'secondary', 'arts', $superAdminId]);
    $stmtSubject->execute(['SUB00009', 'Accounts', 'ACC', 'secondary', 'commercials', $superAdminId]);
    $stmtSubject->execute(['SUB00010', 'Economics', 'ECO', 'secondary', 'commercials', $superAdminId]);
    $stmtSubject->execute(['SUB00011', 'Physics', 'PHY', 'secondary', 'sciences', $superAdminId]);
    $stmtSubject->execute(['SUB00012', 'Chemistry', 'CHM', 'secondary', 'sciences', $superAdminId]);
    $stmtSubject->execute(['SUB00013', 'Biology', 'BIO', 'secondary', 'sciences', $superAdminId]);
    echo "Seed subjects with categories and levels created successfully.\n";

    // 5. Create Staff (class_id links teacher to their primary class)
    $stmtStaff = $pdo->prepare("INSERT INTO staff (id, school_id, user_id, class_id, name, email, phone, role_title) VALUES ('STF00001', 'HARAREPR', ?, 'CLS00001', 'Tinashe Moyo', 'teacher@harareprep.co.zw', '+26377111222', 'Grade 1 Teacher')");
    $stmtStaff->execute([$teacherUserId]);
    echo "Staff member 'Tinashe Moyo' created (STF00001) → assigned to CLS00001.\n";

    // 5b. Create Teaching Assignments
    $stmtTeachAssign = $pdo->prepare("INSERT INTO teaching_assignments (id, school_id, teacher_id, class_id, subject_id) VALUES (?, 'HARAREPR', ?, ?, ?)");
    $stmtTeachAssign->execute(['TCH00001', $teacherUserId, 'CLS00001', 'SUB00001']);
    $stmtTeachAssign->execute(['TCH00002', $teacherUserId, 'CLS00002', 'SUB00002']);
    echo "Teaching assignments created (TCH00001, TCH00002).\n";

    // 5c. Create Teacher Tasks / Lesson Plans
    $stmtTask = $pdo->prepare("INSERT INTO tasks (id, school_id, teacher_id, class_id, subject_id, title, description, due_date, status) VALUES (?, 'HARAREPR', ?, ?, ?, ?, ?, ?, ?)");
    $stmtTask->execute(['TSK00001', $teacherUserId, 'CLS00001', 'SUB00001', 'Algebra Quiz Prep', 'Prepare sample equations for math quiz next week', date('Y-m-d', strtotime('+3 days')), 'planned']);
    $stmtTask->execute(['TSK00002', $teacherUserId, 'CLS00002', 'SUB00002', 'Grammar Check', 'Review reading progress of class B', date('Y-m-d', strtotime('-1 days')), 'planned']); // Overdue!
    $stmtTask->execute(['TSK00003', $teacherUserId, 'CLS00001', 'SUB00001', 'Lesson Outline', 'Outline basic fraction operations', date('Y-m-d', strtotime('-5 days')), 'done']);
    echo "Teacher tasks created (TSK00001, TSK00002, TSK00003).\n";

    // 6. Create Students
    $students = [
        ['id' => 'STD00001', 'first_name' => 'Rufaro', 'last_name' => 'Chigumba', 'admission' => '2026-0001', 'class_id' => 'CLS00001', 'dob' => '2019-05-12', 'gender' => 'female', 'status' => 'enrolled'],
        ['id' => 'STD00002', 'first_name' => 'Kundai', 'last_name' => 'Mashiri', 'admission' => '2026-0002', 'class_id' => 'CLS00001', 'dob' => '2019-08-22', 'gender' => 'male', 'status' => 'enrolled'],
        ['id' => 'STD00003', 'first_name' => 'Tendai', 'last_name' => 'Nyoni', 'admission' => '2026-0003', 'class_id' => 'CLS00002', 'dob' => '2018-02-14', 'gender' => 'male', 'status' => 'enrolled'],
        ['id' => 'STD00004', 'first_name' => 'Chipo', 'last_name' => 'Sibanda', 'admission' => '2026-0004', 'class_id' => 'CLS00003', 'dob' => '2017-11-30', 'gender' => 'female', 'status' => 'enrolled'],
        ['id' => 'STD00005', 'first_name' => 'Tinashe', 'last_name' => 'Mutasa', 'admission' => '2026-0005', 'class_id' => 'CLS00001', 'dob' => '2019-03-10', 'gender' => 'male', 'status' => 'transferred'],
        ['id' => 'STD00006', 'first_name' => 'Tariro', 'last_name' => 'Ndlovu', 'admission' => '2026-0006', 'class_id' => 'CLS00001', 'dob' => '2019-04-18', 'gender' => 'female', 'status' => 'dropped_out']
    ];

    $stmtStudent = $pdo->prepare("INSERT INTO students (id, school_id, class_id, admission_number, first_name, last_name, date_of_birth, gender, status) 
                                  VALUES (?, 'HARAREPR', ?, ?, ?, ?, ?, ?, ?)");
    foreach ($students as $s) {
        $stmtStudent->execute([$s['id'], $s['class_id'], $s['admission'], $s['first_name'], $s['last_name'], $s['dob'], $s['gender'], $s['status']]);
    }
    echo "Seed students created.\n";

    // 7. Create Guardians
    $stmtGuardian = $pdo->prepare("INSERT INTO guardians (id, school_id, user_id, name, phone, email, relation) VALUES ('GDN00001', 'HARAREPR', ?, 'Farai Chigumba', '+26377333444', 'guardian@harareprep.co.zw', 'Father')");
    $stmtGuardian->execute([$parentUserId]);
    echo "Guardian 'Farai Chigumba' created (GDN00001).\n";

    // Link Guardian to Student (Farai to Rufaro)
    $stmtLink = $pdo->prepare("INSERT INTO student_guardians (student_id, guardian_id) VALUES ('STD00001', 'GDN00001')");
    $stmtLink->execute();
    echo "Linked Farai Chigumba as guardian of Rufaro Chigumba.\n";

    // 8. Create some initial Attendance records for Grade 1 Red (students 1 & 2) for today
    $today = date('Y-m-d');
    $stmtAttendance = $pdo->prepare("INSERT INTO attendance (id, school_id, student_id, class_id, date, status, taken_by) VALUES (?, 'HARAREPR', ?, 'CLS00001', ?, 'present', ?)");
    $stmtAttendance->execute(['ATT00001', 'STD00001', $today, $teacherUserId]);
    $stmtAttendance->execute(['ATT00002', 'STD00002', $today, $teacherUserId]);
    echo "Today's attendance marked as 'present' for Grade 1 Red students (ATT00001, ATT00002).\n";

    // 9. Add initial Fees balance for Term 1
    $stmtFee = $pdo->prepare("INSERT INTO fees (id, school_id, student_id, term, amount_due, amount_paid, status) VALUES ('FEE00001', 'HARAREPR', 'STD00001', '2026-T1', 500.00, 150.00, 'partial'), ('FEE00002', 'HARAREPR', 'STD00002', '2026-T1', 500.00, 150.00, 'partial')");
    $stmtFee->execute();
    echo "Initial Term 1 fee balances of $500 set (FEE00001, FEE00002) with partial payments of $150.\n";

    // Add corresponding payment ledger entry
    $stmtFeePayment = $pdo->prepare("INSERT INTO fee_payments (id, school_id, student_id, fee_id, amount_paid, payment_date, reference, payment_method, payment_currency, exchange_rate, amount_in_payment_currency, idempotency_key, created_by) 
                                     VALUES (?, 'HARAREPR', ?, ?, ?, NOW(), ?, 'bank_transfer', ?, ?, ?, ?, ?)");
    $stmtFeePayment->execute(['PAY00001', 'STD00001', 'FEE00001', 150.00, 'BANK-PAY-REF-001', 'USD', 1.0000, 150.00, 'IDEM-KEY-001', $teacherUserId]);
    $stmtFeePayment->execute(['PAY00002', 'STD00002', 'FEE00002', 150.00, 'BANK-PAY-REF-002', 'ZiG', 25.0000, 3750.00, 'IDEM-KEY-002', $teacherUserId]);
    echo "Fee payment ledger populated (PAY00001, PAY00002).\n";

    // 9b. Seed mock Grades (including multiple tests for averages/analytics)
    $gradesData = [
        // student 1 (Rufaro) Class 1
        ['id' => 'GRD00001', 'student_id' => 'STD00001', 'class_id' => 'CLS00001', 'subject' => 'Mathematics', 'val' => 85.0, 'type' => 'test', 'name' => 'Test 1'],
        ['id' => 'GRD00002', 'student_id' => 'STD00001', 'class_id' => 'CLS00001', 'subject' => 'Mathematics', 'val' => 91.0, 'type' => 'test', 'name' => 'Test 2'],
        ['id' => 'GRD00003', 'student_id' => 'STD00001', 'class_id' => 'CLS00001', 'subject' => 'Mathematics', 'val' => 88.0, 'type' => 'exam', 'name' => 'Final Exam'],
        ['id' => 'GRD00004', 'student_id' => 'STD00001', 'class_id' => 'CLS00001', 'subject' => 'English', 'val' => 92.5, 'type' => 'exam', 'name' => 'Final Exam'],
        ['id' => 'GRD00005', 'student_id' => 'STD00001', 'class_id' => 'CLS00001', 'subject' => 'Shona', 'val' => 74.0, 'type' => 'exam', 'name' => 'Final Exam'],

        // student 2 (Kundai) Class 1
        ['id' => 'GRD00006', 'student_id' => 'STD00002', 'class_id' => 'CLS00001', 'subject' => 'Mathematics', 'val' => 60.0, 'type' => 'test', 'name' => 'Test 1'],
        ['id' => 'GRD00007', 'student_id' => 'STD00002', 'class_id' => 'CLS00001', 'subject' => 'Mathematics', 'val' => 64.0, 'type' => 'test', 'name' => 'Test 2'],
        ['id' => 'GRD00008', 'student_id' => 'STD00002', 'class_id' => 'CLS00001', 'subject' => 'Mathematics', 'val' => 62.0, 'type' => 'exam', 'name' => 'Final Exam'],
        ['id' => 'GRD00009', 'student_id' => 'STD00002', 'class_id' => 'CLS00001', 'subject' => 'English', 'val' => 78.0, 'type' => 'exam', 'name' => 'Final Exam'],
        ['id' => 'GRD00010', 'student_id' => 'STD00002', 'class_id' => 'CLS00001', 'subject' => 'Shona', 'val' => 85.0, 'type' => 'exam', 'name' => 'Final Exam'],

        // student 3 (Tendai) Class 2
        ['id' => 'GRD00011', 'student_id' => 'STD00003', 'class_id' => 'CLS00002', 'subject' => 'Mathematics', 'val' => 45.0, 'type' => 'exam', 'name' => 'Final Exam'],
        ['id' => 'GRD00012', 'student_id' => 'STD00003', 'class_id' => 'CLS00002', 'subject' => 'English', 'val' => 52.0, 'type' => 'exam', 'name' => 'Final Exam'],
        ['id' => 'GRD00013', 'student_id' => 'STD00003', 'class_id' => 'CLS00002', 'subject' => 'Shona', 'val' => 61.0, 'type' => 'exam', 'name' => 'Final Exam'],

        // student 4 (Chipo) Class 3
        ['id' => 'GRD00014', 'student_id' => 'STD00004', 'class_id' => 'CLS00003', 'subject' => 'Mathematics', 'val' => 95.0, 'type' => 'exam', 'name' => 'Final Exam'],
        ['id' => 'GRD00015', 'student_id' => 'STD00004', 'class_id' => 'CLS00003', 'subject' => 'English', 'val' => 89.0, 'type' => 'exam', 'name' => 'Final Exam'],
        ['id' => 'GRD00016', 'student_id' => 'STD00004', 'class_id' => 'CLS00003', 'subject' => 'Shona', 'val' => 90.0, 'type' => 'exam', 'name' => 'Final Exam'],
    ];
    $stmtGradeInsert = $pdo->prepare("INSERT INTO grades (id, school_id, student_id, class_id, subject, term, grade_value, assessment_type, assessment_name, weight) VALUES (?, 'HARAREPR', ?, ?, ?, '2026-T1', ?, ?, ?, 1.0)");
    foreach ($gradesData as $g) {
        $stmtGradeInsert->execute([$g['id'], $g['student_id'], $g['class_id'], $g['subject'], $g['val'], $g['type'], $g['name']]);
    }
    echo "Mock grades seeded successfully.\n";

    // 10. Seed Enquiries
    $stmtEnquiry = $pdo->prepare("INSERT INTO enquiries (id, school_id, applicant_name, grade_applying_for, guardian_name, guardian_phone, guardian_email, notes, status) VALUES 
        ('ENQ00001', 'HARAREPR', 'Simba Mutasa', 'Grade 1', 'Oliver Mutasa', '+26377222333', 'oliver@mutasa.co.zw', 'Looking for early enrollment discount options.', 'new'),
        ('ENQ00002', 'HARAREPR', 'Chiedza Ndlovu', 'Grade 2', 'Nomsa Ndlovu', '+26377444555', 'nomsa@ndlovu.co.zw', 'Transferred from Bulawayo Prep.', 'contacted')");
    $stmtEnquiry->execute();
    echo "Admissions enquiries seeded.\n";

    // 11. Seed Discipline Incidents
    $stmtDiscipline = $pdo->prepare("INSERT INTO discipline_incidents (id, school_id, student_id, incident_type, severity, description, action_taken, incident_date, status) VALUES 
        ('DIS00001', 'HARAREPR', 'STD00003', 'Vandalism', 'moderate', 'Scratched the wooden desks in Class 2B.', 'Parent called for meeting; agreed to replace/repair.', DATE_SUB(NOW(), INTERVAL 2 DAY), 'resolved')");
    $stmtDiscipline->execute();
    echo "Discipline incidents seeded.\n";

    // 12. Seed Library/Assets
    $stmtAssets = $pdo->prepare("INSERT INTO assets (id, school_id, name, category, code, description, status, holder_id, holder_type) VALUES 
        ('AST00001', 'HARAREPR', 'Primary English Coursebook 1A', 'book', 'LIB-ENG-1A-001', 'Standard curriculum book.', 'available', NULL, NULL),
        ('AST00002', 'HARAREPR', 'Grade 1 Maths Kit', 'equipment', 'EQP-MTH-G1-02', 'Fraction blocks and abacus.', 'issued', 'STD00001', 'student')");
    $stmtAssets->execute();
    echo "Library assets seeded.\n";

    // 13. Seed Announcements
    $stmtAnnounce = $pdo->prepare("INSERT INTO announcements (id, school_id, class_id, title, body, expires_at, created_by) VALUES 
        ('ANN00001', 'HARAREPR', NULL, 'Winter Term Sports Schedule', 'All students must participate in athletics sessions on Wednesdays.', DATE_ADD(NOW(), INTERVAL 14 DAY), ?)");
    $stmtAnnounce->execute([$schoolAdminUserId]);
    echo "School announcements seeded.\n";

    // 14. Seed Timetable Slots
    $stmtTimetable = $pdo->prepare("INSERT INTO timetable (id, school_id, class_id, day, period, subject, teacher) VALUES 
        ('TTB00001', 'HARAREPR', 'CLS00001', 'Monday', '08:00-09:00', 'Mathematics', 'Tinashe Moyo'),
        ('TTB00002', 'HARAREPR', 'CLS00001', 'Monday', '09:00-10:00', 'English Reading', 'Tinashe Moyo'),
        ('TTB00003', 'HARAREPR', 'CLS00001', 'Tuesday', '08:00-09:00', 'Shona Culture', 'Mrs. Gumbo')");
    $stmtTimetable->execute();
    echo "Class timetable slots seeded.\n";

    // 15. Seed Health Records
    $stmtHealth = $pdo->prepare("INSERT INTO student_health (id, school_id, student_id, blood_group, allergies, medical_conditions, emergency_contact_name, emergency_contact_phone, confidential_notes) VALUES 
        ('HLT00001', 'HARAREPR', 'STD00001', 'O+', 'Peanut allergy', 'Mild seasonal asthma.', 'Farai Chigumba', '+26377333444', 'Requires inhaler during heavy sports sessions.')");
    $stmtHealth->execute();
    echo "Student health records seeded.\n";

    // 16. Seed Exams Schedule
    $stmtExam = $pdo->prepare("INSERT INTO exams (id, school_id, class_id, term, subject, exam_date, start_time, duration_minutes, room, invigilator) VALUES 
        ('EXM00001', 'HARAREPR', 'CLS00001', '2026-T1', 'English Reading Comprehension', DATE_ADD(NOW(), INTERVAL 10 DAY), '08:30:00', 90, 'Hall A', 'Tinashe Moyo'),
        ('EXM00002', 'HARAREPR', 'CLS00001', '2026-T1', 'Mathematics Assessment', DATE_ADD(NOW(), INTERVAL 3 DAY), '09:00:00', 60, 'Room 5', 'Mrs. Gumbo')");
    $stmtExam->execute();
    echo "Exams schedule seeded.\n";

    // 17. Seed Notification/SMS Settings
    $stmtNotifSettings = $pdo->prepare("INSERT INTO notification_settings (id, school_id, sms_gateway_url, sms_api_key, sms_sender_id, notify_attendance_absent, notify_results_published, notify_fees_overdue, notify_discipline_incident) VALUES 
        ('NTS00001', 'HARAREPR', 'http://localhost/mock-sms-gateway', 'mock-api-key-12345', 'HararePrep', 1, 1, 1, 1)");
    $stmtNotifSettings->execute();
    echo "Notification and SMS settings seeded.\n";

    // 18. Seed Leave/Absence Requests
    $stmtLeave = $pdo->prepare("INSERT INTO leave_requests (id, school_id, request_type, student_id, staff_id, hostel_name, user_id, start_date, end_date, reason, status, reviewed_by, reviewer_comment) VALUES 
        ('LVR00001', 'HARAREPR', 'student_absence', 'STD00001', NULL, NULL, ?, '2026-07-20', '2026-07-22', 'Family bereavement and funeral service attendance in Mutare.', 'pending', NULL, NULL),
        ('LVR00002', 'HARAREPR', 'staff_leave', NULL, 'STF00001', NULL, ?, '2026-08-01', '2026-08-05', 'Scheduled dental surgery procedure and recovery leave.', 'approved', ?, 'Approved with medical cert provision.'),
        ('LVR00003', 'HARAREPR', 'exeat_pass', 'STD00001', NULL, 'Falcon House', ?, '2026-07-25', '2026-07-27', 'Weekend visit home to Harare for family reunion exeat.', 'approved', ?, 'Approved by hostel master.')");
    $stmtLeave->execute([$parentUserId, $teacherUserId, $schoolAdminUserId, $parentUserId, $schoolAdminUserId]);
    echo "Leave and absence requests seeded.\n";

    // 19. Seed Hostels & Staff Housing
    $stmtHostel = $pdo->prepare("INSERT INTO hostels (id, school_id, name, type, capacity, warden_name) VALUES 
        ('HST00001', 'HARAREPR', 'Falcon House (Boys Dorm)', 'student_male', 60, 'Mr. C. Mutasa'),
        ('HST00002', 'HARAREPR', 'Protea House (Girls Dorm)', 'student_female', 60, 'Mrs. S. Ndlovu'),
        ('HST00003', 'HARAREPR', 'Staff Quarters Block A', 'staff_housing', 12, 'Tinashe Moyo')");
    $stmtHostel->execute();

    $stmtHostelAlloc = $pdo->prepare("INSERT INTO hostel_allocations (id, school_id, hostel_id, occupant_id, occupant_type, room_number, bed_number, allocated_date, term) VALUES 
        ('HAL00001', 'HARAREPR', 'HST00001', 'STD00001', 'student', 'Room 12B', 'Bed 1', '2026-01-10', '2026-T1'),
        ('HAL00002', 'HARAREPR', 'HST00003', 'STF00001', 'staff', 'Flat A4', NULL, '2026-01-05', '2026-T1')");
    $stmtHostelAlloc->execute();
    echo "Hostels and staff housing allocations seeded.\n";

    // 20. Seed Operational Expenses (Starlink, ZESA Electricity, Generator Diesel, ICT)
    $stmtExp = $pdo->prepare("INSERT INTO expenses (id, school_id, title, category, amount, expense_date, vendor_name, receipt_ref, recorded_by) VALUES 
        ('EXP00001', 'HARAREPR', 'Starlink High-Speed Satellite Internet Monthly Subscription', 'internet_ict', 120.00, '2026-07-01', 'Starlink / SpaceX', 'INV-STL-90812', ?),
        ('EXP00002', 'HARAREPR', 'ZESA Prepaid Electricity Tokens (Main Campus & Hostels)', 'utilities_electricity', 450.00, '2026-07-05', 'ZETDC', 'TK-ZESA-44120', ?),
        ('EXP00003', 'HARAREPR', 'Backup Generator Diesel Fuel (200 Litres)', 'fuel_maintenance', 310.00, '2026-07-10', 'TotalEnergies', 'RCP-TOT-88123', ?),
        ('EXP00004', 'HARAREPR', 'Boarding Dining Hall Weekly Grocery Supplies', 'food_catering', 850.00, '2026-07-12', 'OK Zimbabwe Supermarket', 'RCP-OKZ-10921', ?)");
    $stmtExp->execute([$schoolAdminUserId, $schoolAdminUserId, $schoolAdminUserId, $schoolAdminUserId]);
    echo "Operational expenses (Starlink, ZESA, Diesel, Catering) seeded.\n";

    echo "Database seeding finished successfully!\n";

} catch (PDOException $e) {
    echo "Database Seeding Error: " . $e->getMessage() . "\n";
    exit(1);
}
