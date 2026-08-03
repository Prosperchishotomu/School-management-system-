CREATE DATABASE IF NOT EXISTS `schoolbase` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `schoolbase`;

-- Drop all tables in reverse FK dependency order (safe rebuild)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `user_notifications`;
DROP TABLE IF EXISTS `system_config`;
DROP TABLE IF EXISTS `remote_payments`;
DROP TABLE IF EXISTS `password_reset_tokens`;
DROP TABLE IF EXISTS `login_rate_limit`;
DROP TABLE IF EXISTS `grade_thresholds`;
DROP TABLE IF EXISTS `leave_requests`;
DROP TABLE IF EXISTS `tasks`;
DROP TABLE IF EXISTS `teaching_assignments`;
DROP TABLE IF EXISTS `teacher_messages`;
DROP TABLE IF EXISTS `notification_settings`;
DROP TABLE IF EXISTS `term_config`;
DROP TABLE IF EXISTS `report_comments`;
DROP TABLE IF EXISTS `subjects`;
DROP TABLE IF EXISTS `exams`;
DROP TABLE IF EXISTS `student_health`;
DROP TABLE IF EXISTS `timetable`;
DROP TABLE IF EXISTS `announcements`;
DROP TABLE IF EXISTS `asset_categories`;
DROP TABLE IF EXISTS `assets`;
DROP TABLE IF EXISTS `discipline_incidents`;
DROP TABLE IF EXISTS `enquiries`;
DROP TABLE IF EXISTS `system_events`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `fee_payments`;
DROP TABLE IF EXISTS `fees`;
DROP TABLE IF EXISTS `results`;
DROP TABLE IF EXISTS `grades`;
DROP TABLE IF EXISTS `attendance`;
DROP TABLE IF EXISTS `student_guardians`;
DROP TABLE IF EXISTS `guardians`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `staff`;
DROP TABLE IF EXISTS `classes`;
DROP TABLE IF EXISTS `licenses`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `schools`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Schools Table
CREATE TABLE IF NOT EXISTS `schools` (
  `id` VARCHAR(8) PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `code` VARCHAR(20) NOT NULL UNIQUE, -- e.g., HARARE-PREP-01
  `status` ENUM('active', 'suspended', 'expired') DEFAULT 'active',
  `school_type` ENUM('primary', 'secondary') DEFAULT 'primary',
  `tuition_fee_benchmark` DECIMAL(10,2) DEFAULT 500.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) DEFAULT NULL, -- NULL indicates global/super_admin
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'school_admin', 'teacher', 'parent') NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('active', 'deactivated') DEFAULT 'active',
  `login_attempts` INT DEFAULT 0,
  `lockout_until` TIMESTAMP NULL DEFAULT NULL,
  `token_version` INT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Licenses Table
CREATE TABLE IF NOT EXISTS `licenses` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `license_key` TEXT NOT NULL, -- JWT token signed server-side
  `plan` ENUM('basic', 'full') DEFAULT 'basic',
  `status` ENUM('active', 'suspended', 'expired') DEFAULT 'active',
  `issued_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NOT NULL,
  `max_users` INT DEFAULT 100,
  `issued_by` VARCHAR(8) NOT NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Classes Table
CREATE TABLE IF NOT EXISTS `classes` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `name` VARCHAR(50) NOT NULL, -- e.g. Form 1A, Grade 3 Red
  `grade_level` VARCHAR(20) NOT NULL, -- e.g. Form 1, Grade 3
  `stream` VARCHAR(20) DEFAULT NULL, -- e.g. Science, Arts
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Staff Table
CREATE TABLE IF NOT EXISTS `staff` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `user_id` VARCHAR(8) DEFAULT NULL,
  `class_id` VARCHAR(8) DEFAULT NULL, -- Primary class this teacher is assigned to
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `role_title` VARCHAR(50) DEFAULT NULL, -- e.g. Headmaster, Class Teacher
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Students Table
CREATE TABLE IF NOT EXISTS `students` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `class_id` VARCHAR(8) DEFAULT NULL,
  `admission_number` VARCHAR(50) NOT NULL,
  `first_name` VARCHAR(50) NOT NULL,
  `last_name` VARCHAR(50) NOT NULL,
  `middle_name` VARCHAR(50) DEFAULT NULL,
  `date_of_birth` DATE NOT NULL,
  `gender` ENUM('male', 'female', 'other') NOT NULL,
  `status` ENUM('enrolled', 'suspended', 'withdrawn', 'graduated', 'transferred', 'dropped_out') DEFAULT 'enrolled',
  `nationality` VARCHAR(80) DEFAULT NULL,
  `home_address` VARCHAR(255) DEFAULT NULL,
  `religion` VARCHAR(60) DEFAULT NULL,
  `previous_school` VARCHAR(150) DEFAULT NULL,
  `medical_notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `school_student_admission` (`school_id`, `admission_number`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Guardians/Parents Table
CREATE TABLE IF NOT EXISTS `guardians` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `user_id` VARCHAR(8) DEFAULT NULL,
  `national_id` VARCHAR(50) DEFAULT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `relation` VARCHAR(50) DEFAULT NULL, -- e.g. Mother, Father, Uncle
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Many-to-Many relationship between Students and Guardians
CREATE TABLE IF NOT EXISTS `student_guardians` (
  `student_id` VARCHAR(8) NOT NULL,
  `guardian_id` VARCHAR(8) NOT NULL,
  `relation` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`student_id`, `guardian_id`),
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`guardian_id`) REFERENCES `guardians` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Attendance Table
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `student_id` VARCHAR(8) NOT NULL,
  `class_id` VARCHAR(8) NOT NULL,
  `date` DATE NOT NULL,
  `status` ENUM('present', 'absent', 'late', 'excused') NOT NULL,
  `remarks` VARCHAR(255) DEFAULT NULL,
  `taken_by` VARCHAR(8) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `student_attendance_date` (`student_id`, `date`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`taken_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Grades Table (Raw Assessment Marks)
CREATE TABLE IF NOT EXISTS `grades` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `student_id` VARCHAR(8) NOT NULL,
  `class_id` VARCHAR(8) NOT NULL,
  `subject` VARCHAR(100) NOT NULL, -- e.g. Mathematics, Shona, Ndebele, English
  `term` VARCHAR(20) NOT NULL, -- e.g., 2026-T1, 2026-T2
  `grade_value` DECIMAL(5,2) NOT NULL, -- percentage or raw score (out of 100)
  `assessment_type` ENUM('test', 'exam', 'coursework') NOT NULL,
  `assessment_name` VARCHAR(100) NOT NULL DEFAULT 'Test 1',
  `weight` DECIMAL(3,2) DEFAULT 1.00, -- multiplier for grade calculations
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Results Table (Published, aggregated results)
CREATE TABLE IF NOT EXISTS `results` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `student_id` VARCHAR(8) NOT NULL,
  `class_id` VARCHAR(8) NOT NULL,
  `term` VARCHAR(20) NOT NULL,
  `overall_percentage` DECIMAL(5,2) NOT NULL,
  `grade` VARCHAR(5) DEFAULT NULL, -- e.g. A, B, C, D, E, U
  `rank` INT DEFAULT NULL, -- rank in class
  `pass_status` ENUM('pass', 'fail') NOT NULL,
  `status` ENUM('locked', 'published') DEFAULT 'locked',
  `computed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `student_term_result` (`student_id`, `term`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Fees Table
CREATE TABLE IF NOT EXISTS `fees` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `student_id` VARCHAR(8) NOT NULL,
  `term` VARCHAR(20) NOT NULL,
  `amount_due` DECIMAL(10,2) NOT NULL,
  `amount_paid` DECIMAL(10,2) DEFAULT 0.00,
  `status` ENUM('unpaid', 'partial', 'cleared') DEFAULT 'unpaid',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `student_term_fee` (`student_id`, `term`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Fee Payments Table (Append-only Ledger)
CREATE TABLE IF NOT EXISTS `fee_payments` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `student_id` VARCHAR(8) NOT NULL,
  `fee_id` VARCHAR(8) NOT NULL,
  `amount_paid` DECIMAL(10,2) NOT NULL,
  `payment_date` DATETIME NOT NULL,
  `reference` VARCHAR(100) DEFAULT NULL, -- e.g. Bank Ref, EcoCash Txn ID
  `payment_method` ENUM('cash', 'bank_transfer', 'mobile_money') NOT NULL DEFAULT 'cash',
  `payment_currency` VARCHAR(10) DEFAULT 'USD',
  `exchange_rate` DECIMAL(12,4) DEFAULT 1.0000,
  `amount_in_payment_currency` DECIMAL(12,2) DEFAULT NULL,
  `idempotency_key` VARCHAR(100) NOT NULL UNIQUE,
  `created_by` VARCHAR(8) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`fee_id`) REFERENCES `fees` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Audit Log (Append-only)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) DEFAULT NULL,
  `user_id` VARCHAR(8) NOT NULL,
  `action` VARCHAR(100) NOT NULL, -- e.g., LOGIN_FAILED, STUDENT_CREATED, PAYMENT_ADDED
  `entity_type` VARCHAR(50) DEFAULT NULL,
  `entity_id` VARCHAR(8) DEFAULT NULL,
  `description` TEXT NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. System Events (Uptime and errors)
CREATE TABLE IF NOT EXISTS `system_events` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) DEFAULT NULL,
  `severity` ENUM('info', 'warning', 'critical') DEFAULT 'info',
  `event_type` VARCHAR(100) NOT NULL, -- e.g. SYNC_FAILURE, DATABASE_TIMEOUT
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Enquiries / Admissions Pipeline
CREATE TABLE IF NOT EXISTS `enquiries` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `applicant_name` VARCHAR(100) NOT NULL,
  `grade_applying_for` VARCHAR(50) NOT NULL,
  `guardian_name` VARCHAR(100) NOT NULL,
  `guardian_phone` VARCHAR(30) DEFAULT NULL,
  `guardian_email` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `status` ENUM('new', 'contacted', 'tour', 'offered', 'enrolled', 'declined') DEFAULT 'new',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Discipline Incidents (Confidential, admin-only)
CREATE TABLE IF NOT EXISTS `discipline_incidents` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `student_id` VARCHAR(8) NOT NULL,
  `incident_type` VARCHAR(100) NOT NULL,
  `severity` ENUM('minor', 'moderate', 'serious') DEFAULT 'minor',
  `description` TEXT NOT NULL,
  `action_taken` TEXT DEFAULT NULL,
  `incident_date` DATE NOT NULL,
  `status` ENUM('open', 'resolved', 'escalated') DEFAULT 'open',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Library / Assets
CREATE TABLE IF NOT EXISTS `assets` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(50) DEFAULT 'book',
  `code` VARCHAR(50) DEFAULT NULL,
  `serial_number` VARCHAR(100) DEFAULT NULL,
  `value` DECIMAL(10,2) DEFAULT 0.00,
  `description` TEXT DEFAULT NULL,
  `metadata` TEXT DEFAULT NULL,                 -- JSON parameters (e.g. plate number, mileage for vehicles)
  `status` ENUM('available', 'issued', 'damaged', 'lost') DEFAULT 'available',
  `holder_id` VARCHAR(8) DEFAULT NULL,          -- FK to student/staff depending on holder_type
  `holder_type` ENUM('student', 'staff') DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asset Categories (System-wide + School-specific custom categories)
CREATE TABLE IF NOT EXISTS `asset_categories` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) DEFAULT NULL,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `color_class` VARCHAR(100) DEFAULT 'text-blue-500 bg-blue-50',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Announcements
CREATE TABLE IF NOT EXISTS `announcements` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `class_id` VARCHAR(8) DEFAULT NULL,           -- NULL = school-wide
  `title` VARCHAR(200) NOT NULL,
  `body` TEXT NOT NULL,
  `expires_at` DATE DEFAULT NULL,
  `created_by` VARCHAR(8) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Timetable Slots
CREATE TABLE IF NOT EXISTS `timetable` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `class_id` VARCHAR(8) NOT NULL,
  `day` ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday') NOT NULL,
  `period` VARCHAR(20) NOT NULL,          -- e.g. "07:30–08:10"
  `subject` VARCHAR(100) DEFAULT NULL,
  `teacher` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `class_day_period` (`class_id`, `day`, `period`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. Student Health Records (Restricted — school_admin only)
CREATE TABLE IF NOT EXISTS `student_health` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `student_id` VARCHAR(8) NOT NULL UNIQUE,
  `blood_group` VARCHAR(5) DEFAULT NULL,
  `allergies` TEXT DEFAULT NULL,
  `medical_conditions` TEXT DEFAULT NULL,
  `emergency_contact_name` VARCHAR(100) DEFAULT NULL,
  `emergency_contact_phone` VARCHAR(30) DEFAULT NULL,
  `confidential_notes` TEXT DEFAULT NULL,  -- extra restricted field
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Exams Schedule
CREATE TABLE IF NOT EXISTS `exams` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `class_id` VARCHAR(8) NOT NULL,
  `term` VARCHAR(20) NOT NULL,
  `subject` VARCHAR(100) NOT NULL,
  `exam_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME DEFAULT NULL,
  `duration_minutes` INT NOT NULL DEFAULT 120,
  `exam_type` ENUM('test','exam','coursework','mock') DEFAULT 'exam',
  `venue` VARCHAR(150) DEFAULT NULL,
  `room` VARCHAR(100) DEFAULT NULL,
  `invigilator` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. Notification Settings (per school)
CREATE TABLE IF NOT EXISTS `notification_settings` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL UNIQUE,
  `sms_gateway_url` VARCHAR(500) DEFAULT NULL,
  `sms_api_key` VARCHAR(500) DEFAULT NULL,  -- stored encrypted at rest
  `sms_sender_id` VARCHAR(50) DEFAULT NULL,
  `email_smtp_host` VARCHAR(255) DEFAULT NULL,
  `email_smtp_port` INT DEFAULT 587,
  `email_smtp_user` VARCHAR(255) DEFAULT NULL,
  `email_smtp_pass` VARCHAR(255) DEFAULT NULL,
  `email_from_address` VARCHAR(255) DEFAULT NULL,
  `email_from_name` VARCHAR(255) DEFAULT NULL,
  `payment_gateway_type` ENUM('ecocash', 'paynow', 'innbucks', 'mukuru', 'bank_transfer','mock') DEFAULT 'mock',
  `payment_merchant_id` VARCHAR(255) DEFAULT NULL,
  `payment_merchant_key` VARCHAR(255) DEFAULT NULL,
  `payment_api_url` VARCHAR(500) DEFAULT NULL,
  `notify_attendance_absent` TINYINT(1) DEFAULT 1,
  `notify_results_published` TINYINT(1) DEFAULT 1,
  `notify_fees_overdue` TINYINT(1) DEFAULT 1,
  `notify_discipline_incident` TINYINT(1) DEFAULT 1,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. National Curriculum Subjects (Managed by Super Admin)
CREATE TABLE IF NOT EXISTS `subjects` (
  `id` VARCHAR(8) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `code` VARCHAR(20) NOT NULL UNIQUE,  -- e.g. ENG, MTH, SCI
  `level` ENUM('primary', 'secondary', 'all') DEFAULT 'all',
  `category` ENUM('general', 'arts', 'commercials', 'sciences') DEFAULT 'general',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_by` VARCHAR(8) DEFAULT NULL,       -- FK to super_admin user
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. Report Comments (Principal annotations on teacher reports)
CREATE TABLE IF NOT EXISTS `report_comments` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `report_type` ENUM('attendance', 'grades', 'exam', 'discipline', 'fee', 'general') NOT NULL,
  `ref_id` VARCHAR(8) DEFAULT NULL,           -- ID of the linked record (class_id, exam_id, etc.)
  `ref_date` DATE DEFAULT NULL,        -- Specific date (e.g. attendance date)
  `comment` TEXT NOT NULL,
  `created_by` VARCHAR(8) NOT NULL,           -- FK to school_admin user
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. Term Configuration (per school — managed by super admin or school admin)
CREATE TABLE IF NOT EXISTS `term_config` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `term_name` VARCHAR(50) NOT NULL,    -- e.g. "Term 1 2026"
  `term_code` VARCHAR(20) NOT NULL,    -- e.g. "2026-T1"
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `is_current` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `school_term` (`school_id`, `term_code`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. Teacher Messages (Principal communication system)
CREATE TABLE IF NOT EXISTS `teacher_messages` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `sender_id` VARCHAR(8) NOT NULL,
  `recipient_id` VARCHAR(8) DEFAULT NULL, -- NULL indicates broadcast to all teachers
  `subject` VARCHAR(255) NOT NULL,
  `body` TEXT NOT NULL,
  `sent_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. Teaching Assignments
CREATE TABLE IF NOT EXISTS `teaching_assignments` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `teacher_id` VARCHAR(8) NOT NULL,
  `class_id` VARCHAR(8) NOT NULL,
  `subject_id` VARCHAR(8) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `teacher_class_subject` (`teacher_id`, `class_id`, `subject_id`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. Teacher Tasks / Lesson Plans
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `teacher_id` VARCHAR(8) NOT NULL,
  `class_id` VARCHAR(8) NOT NULL,
  `subject_id` VARCHAR(8) NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `due_date` DATE NOT NULL,
  `status` ENUM('planned', 'done', 'overdue') DEFAULT 'planned',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 29. Leave & Absence Requests (Zimbabwean school context)
CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `request_type` ENUM('student_absence', 'staff_leave', 'exeat_pass') NOT NULL,
  `student_id` VARCHAR(8) DEFAULT NULL,
  `staff_id` VARCHAR(8) DEFAULT NULL,
  `hostel_name` VARCHAR(100) DEFAULT NULL,
  `user_id` VARCHAR(8) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `reviewed_by` VARCHAR(8) DEFAULT NULL,
  `reviewer_comment` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 30. Grade Thresholds
CREATE TABLE IF NOT EXISTS `grade_thresholds` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `grade_symbol` VARCHAR(5) NOT NULL,
  `min_mark` DECIMAL(5,2) NOT NULL,
  `max_mark` DECIMAL(5,2) NOT NULL,
  `is_pass` TINYINT(1) DEFAULT 1,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 31. Login Rate Limit
CREATE TABLE IF NOT EXISTS `login_rate_limit` (
  `ip` VARCHAR(45) PRIMARY KEY,
  `attempts` INT UNSIGNED NOT NULL DEFAULT 1,
  `window_start` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 32. Password Reset Tokens
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` VARCHAR(8) PRIMARY KEY,
  `user_id` VARCHAR(8) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL UNIQUE,
  `expires_at` TIMESTAMP NOT NULL,
  `used` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 33. Remote Payments
CREATE TABLE IF NOT EXISTS `remote_payments` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `student_id` VARCHAR(8) NOT NULL,
  `guardian_id` VARCHAR(8) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` ENUM('bank_transfer', 'mobile_money') NOT NULL,
  `reference` VARCHAR(100) NOT NULL UNIQUE,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `rejection_reason` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_remote_payments_ref` (`school_id`, `reference`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`guardian_id`) REFERENCES `guardians` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 34. System Config
CREATE TABLE IF NOT EXISTS `system_config` (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 35. User Notifications
CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `user_id` VARCHAR(8) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_user_notifications_read` (`user_id`, `is_read`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 36. Hostels & Staff Accommodation
CREATE TABLE IF NOT EXISTS `hostels` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `type` ENUM('student_male', 'student_female', 'staff_housing') NOT NULL,
  `capacity` INT UNSIGNED NOT NULL DEFAULT 50,
  `warden_name` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 37. Hostel & Housing Room Allocations
CREATE TABLE IF NOT EXISTS `hostel_allocations` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `hostel_id` VARCHAR(8) NOT NULL,
  `occupant_id` VARCHAR(8) NOT NULL,
  `occupant_type` ENUM('student', 'staff') DEFAULT 'student',
  `room_number` VARCHAR(20) NOT NULL,
  `bed_number` VARCHAR(20) DEFAULT NULL,
  `allocated_date` DATE NOT NULL,
  `term` VARCHAR(20) NOT NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`hostel_id`) REFERENCES `hostels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 38. Operational Expenses (Starlink, ZESA Electricity, Solar, Diesel, Internet, Utilities)
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` VARCHAR(8) PRIMARY KEY,
  `school_id` VARCHAR(8) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` ENUM('internet_ict', 'utilities_electricity', 'fuel_maintenance', 'food_catering', 'rent_accommodation', 'supplies', 'other') NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `vendor_name` VARCHAR(100) DEFAULT NULL,
  `receipt_ref` VARCHAR(100) DEFAULT NULL,
  `recorded_by` VARCHAR(8) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
