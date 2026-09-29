-- ============================================================
-- SchoolBase — Complete Database Schema (Zimbabwe SMS)
-- Rebuilt to match prompt.txt specification v2
-- Encoding: utf8mb4 | Engine: InnoDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS `schoolbase` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `schoolbase`;

SET FOREIGN_KEY_CHECKS = 0;

-- Drop all tables (reverse FK order)
DROP TABLE IF EXISTS `statutory_returns`;
DROP TABLE IF EXISTS `counselling_sessions`;
DROP TABLE IF EXISTS `health_visits`;
DROP TABLE IF EXISTS `health_profiles`;
DROP TABLE IF EXISTS `student_leadership`;
DROP TABLE IF EXISTS `house_points`;
DROP TABLE IF EXISTS `exeats`;
DROP TABLE IF EXISTS `hostel_allocations`;
DROP TABLE IF EXISTS `hostel_rooms`;
DROP TABLE IF EXISTS `hostels`;
DROP TABLE IF EXISTS `houses`;
DROP TABLE IF EXISTS `book_reservations`;
DROP TABLE IF EXISTS `book_loans`;
DROP TABLE IF EXISTS `book_copies`;
DROP TABLE IF EXISTS `books`;
DROP TABLE IF EXISTS `book_categories`;
DROP TABLE IF EXISTS `student_transport`;
DROP TABLE IF EXISTS `route_stops`;
DROP TABLE IF EXISTS `transport_routes`;
DROP TABLE IF EXISTS `vehicles`;
DROP TABLE IF EXISTS `bank_statement_lines`;
DROP TABLE IF EXISTS `bank_statements`;
DROP TABLE IF EXISTS `expenses`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `invoice_items`;
DROP TABLE IF EXISTS `invoices`;
DROP TABLE IF EXISTS `student_discounts`;
DROP TABLE IF EXISTS `fee_items`;
DROP TABLE IF EXISTS `fee_structures`;
DROP TABLE IF EXISTS `exchange_rates`;
DROP TABLE IF EXISTS `currencies`;
DROP TABLE IF EXISTS `approvals`;
DROP TABLE IF EXISTS `entry_results`;
DROP TABLE IF EXISTS `exam_entry_subjects`;
DROP TABLE IF EXISTS `exam_entry_candidates`;
DROP TABLE IF EXISTS `exam_entries`;
DROP TABLE IF EXISTS `assignment_submissions`;
DROP TABLE IF EXISTS `assignments`;
DROP TABLE IF EXISTS `report_cards`;
DROP TABLE IF EXISTS `component_marks`;
DROP TABLE IF EXISTS `exam_components`;
DROP TABLE IF EXISTS `exam_schedules`;
DROP TABLE IF EXISTS `results`;
DROP TABLE IF EXISTS `grades`;
DROP TABLE IF EXISTS `lesson_plans`;
DROP TABLE IF EXISTS `schemes_of_work`;
DROP TABLE IF EXISTS `staff_attendance`;
DROP TABLE IF EXISTS `student_attendance`;
DROP TABLE IF EXISTS `timetable_slots`;
DROP TABLE IF EXISTS `timetable`;
DROP TABLE IF EXISTS `periods`;
DROP TABLE IF EXISTS `rooms`;
DROP TABLE IF EXISTS `student_subjects`;
DROP TABLE IF EXISTS `class_subjects`;
DROP TABLE IF EXISTS `subject_phases`;
DROP TABLE IF EXISTS `exam_boards`;
DROP TABLE IF EXISTS `subjects`;
DROP TABLE IF EXISTS `grade_ranges`;
DROP TABLE IF EXISTS `grading_scales`;
DROP TABLE IF EXISTS `promotion_rules`;
DROP TABLE IF EXISTS `student_guardians`;
DROP TABLE IF EXISTS `guardians`;
DROP TABLE IF EXISTS `enrollments`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `sections`;
DROP TABLE IF EXISTS `classes`;
DROP TABLE IF EXISTS `employee_subjects`;
DROP TABLE IF EXISTS `employees`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `documents`;
DROP TABLE IF EXISTS `applications`;
DROP TABLE IF EXISTS `admission_cycles`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `conversation_participants`;
DROP TABLE IF EXISTS `conversations`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `events`;
DROP TABLE IF EXISTS `announcements`;
DROP TABLE IF EXISTS `disciplinary_records`;
DROP TABLE IF EXISTS `terms`;
DROP TABLE IF EXISTS `academic_sessions`;
DROP TABLE IF EXISTS `settings`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `leave_requests`;
DROP TABLE IF EXISTS `refresh_tokens`;
DROP TABLE IF EXISTS `password_reset_tokens`;
DROP TABLE IF EXISTS `login_attempts`;
DROP TABLE IF EXISTS `idempotency_keys`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `licenses`;
DROP TABLE IF EXISTS `schools`;

-- Legacy drops (old schema compatibility)
DROP TABLE IF EXISTS `fee_payments`;
DROP TABLE IF EXISTS `fees`;
DROP TABLE IF EXISTS `attendance`;
DROP TABLE IF EXISTS `exams`;
DROP TABLE IF EXISTS `tasks`;
DROP TABLE IF EXISTS `teaching_assignments`;
DROP TABLE IF EXISTS `term_config`;
DROP TABLE IF EXISTS `report_comments`;
DROP TABLE IF EXISTS `grade_thresholds`;
DROP TABLE IF EXISTS `leave_requests`;
DROP TABLE IF EXISTS `teacher_messages`;
DROP TABLE IF EXISTS `notification_settings`;
DROP TABLE IF EXISTS `system_events`;
DROP TABLE IF EXISTS `student_health`;
DROP TABLE IF EXISTS `enquiries`;
DROP TABLE IF EXISTS `assets`;
DROP TABLE IF EXISTS `asset_categories`;
DROP TABLE IF EXISTS `discipline_incidents`;
DROP TABLE IF EXISTS `staff`;
DROP TABLE IF EXISTS `staff_subjects`;
DROP TABLE IF EXISTS `timetable`;
DROP TABLE IF EXISTS `hostel_allocations`;
DROP TABLE IF EXISTS `system_config`;
DROP TABLE IF EXISTS `user_notifications`;
DROP TABLE IF EXISTS `remote_payments`;
DROP TABLE IF EXISTS `login_rate_limit`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SECTION 1: Core Identity & Access
-- ============================================================

CREATE TABLE `schools` (
  `id`                     VARCHAR(8)   PRIMARY KEY,
  `name`                   VARCHAR(150) NOT NULL,
  `code`                   VARCHAR(20)  NOT NULL UNIQUE,
  `status`                 ENUM('active','suspended','expired') DEFAULT 'active',
  `school_type`            ENUM('primary','secondary','combined') DEFAULT 'combined',
  `head_title`             VARCHAR(50)  DEFAULT 'Headmaster',
  `mopse_reg_no`           VARCHAR(50)  DEFAULT NULL,
  `emis_centre_code`       VARCHAR(50)  DEFAULT NULL,
  `zimsec_centre_no`       VARCHAR(50)  DEFAULT NULL,
  `address`                TEXT         DEFAULT NULL,
  `phone`                  VARCHAR(30)  DEFAULT NULL,
  `email`                  VARCHAR(100) DEFAULT NULL,
  `logo_path`              VARCHAR(255) DEFAULT NULL,
  `offered_phases`         JSON         DEFAULT NULL,  -- ["infant","junior","ordinary","advanced"]
  `base_currency`          VARCHAR(10)  DEFAULT 'USD',
  `created_at`             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `licenses` (
  `id`         VARCHAR(8)   PRIMARY KEY,
  `school_id`  VARCHAR(8)   NOT NULL,
  `license_key` TEXT        NOT NULL,
  `plan`       ENUM('basic','full') DEFAULT 'basic',
  `status`     ENUM('active','suspended','expired') DEFAULT 'active',
  `issued_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP    NOT NULL,
  `max_users`  INT          DEFAULT 100,
  `issued_by`  VARCHAR(8)   NOT NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(50)  NOT NULL UNIQUE,   -- super_admin, head, deputy_head, hod, admin, bursar, teacher, librarian, nurse, counsellor, boarding_master, student, parent
  `display_name` VARCHAR(100) NOT NULL,
  `is_system`   TINYINT(1)   DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `permissions` (
  `id`    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`  VARCHAR(100) NOT NULL UNIQUE,
  `group` VARCHAR(50)  DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `role_permissions` (
  `role_id`       INT UNSIGNED NOT NULL,
  `permission_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`)       REFERENCES `roles` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id`                   VARCHAR(8)   PRIMARY KEY,
  `uuid`                 CHAR(36)     NOT NULL UNIQUE,
  `school_id`            VARCHAR(8)   DEFAULT NULL,
  `username`             VARCHAR(80)  NOT NULL UNIQUE,
  `email`                VARCHAR(100) DEFAULT NULL UNIQUE,
  `phone`                VARCHAR(30)  DEFAULT NULL,
  `password_hash`        VARCHAR(255) NOT NULL,
  `role`                 VARCHAR(50)  DEFAULT NULL,
  `status`               ENUM('pending','active','suspended') DEFAULT 'active',
  `email_verified_at`    TIMESTAMP    NULL DEFAULT NULL,
  `mfa_enabled`          TINYINT(1)   DEFAULT 0,
  `mfa_secret_enc`       TEXT         DEFAULT NULL,
  `mfa_backup_codes_enc` TEXT         DEFAULT NULL,
  `last_login_at`        TIMESTAMP    NULL DEFAULT NULL,
  `failed_logins`        INT          DEFAULT 0,
  `locked_until`         TIMESTAMP    NULL DEFAULT NULL,
  `locale`               ENUM('en','sn','nd') DEFAULT 'en',
  `avatar_path`          VARCHAR(255) DEFAULT NULL,
  `created_at`           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_roles` (
  `user_id` VARCHAR(8)   NOT NULL,
  `role_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `refresh_tokens` (
  `id`              VARCHAR(8)   PRIMARY KEY,
  `user_id`         VARCHAR(8)   NOT NULL,
  `token_hash`      VARCHAR(64)  NOT NULL UNIQUE,
  `family_id`       CHAR(36)     NOT NULL,
  `expires_at`      TIMESTAMP    NOT NULL,
  `revoked_at`      TIMESTAMP    NULL DEFAULT NULL,
  `replaced_by_id`  VARCHAR(8)   DEFAULT NULL,
  `ip`              VARCHAR(45)  DEFAULT NULL,
  `user_agent`      VARCHAR(500) DEFAULT NULL,
  `created_at`      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
  `id`         VARCHAR(8)  PRIMARY KEY,
  `user_id`    VARCHAR(8)  NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL UNIQUE,
  `expires_at` TIMESTAMP   NOT NULL,
  `used`       TINYINT(1)  DEFAULT 0,
  `created_at` TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `login_attempts` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`    VARCHAR(8)  DEFAULT NULL,
  `ip`         VARCHAR(45) NOT NULL,
  `attempted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `success`    TINYINT(1)  DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `idempotency_keys` (
  `id`              CHAR(36) PRIMARY KEY,
  `scope`           VARCHAR(160) NOT NULL,
  `idempotency_key` VARCHAR(200) NOT NULL,
  `status_code`     SMALLINT UNSIGNED NOT NULL,
  `response_body`   JSON NOT NULL,
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_idempotency_scope_key` (`scope`, `idempotency_key`),
  KEY `idx_idempotency_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   DEFAULT NULL,
  `user_id`     VARCHAR(8)   NOT NULL,
  `action`      VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50)  DEFAULT NULL,
  `entity_id`   VARCHAR(36)  DEFAULT NULL,
  `ip`          VARCHAR(45)  DEFAULT NULL,
  `user_agent`  VARCHAR(500) DEFAULT NULL,
  `old_values`  JSON         DEFAULT NULL,
  `new_values`  JSON         DEFAULT NULL,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 2: Settings & Configuration
-- ============================================================

CREATE TABLE `settings` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  VARCHAR(8)   DEFAULT NULL,
  `key`        VARCHAR(100) NOT NULL,
  `value`      TEXT         DEFAULT NULL,
  `group`      VARCHAR(50)  DEFAULT NULL,
  UNIQUE KEY `school_setting` (`school_id`, `key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 3: Academic Structure
-- ============================================================

CREATE TABLE `academic_sessions` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  VARCHAR(8)   NOT NULL,
  `name`       VARCHAR(20)  NOT NULL,   -- e.g. '2025'
  `start_date` DATE         NOT NULL,
  `end_date`   DATE         NOT NULL,
  `is_current` TINYINT(1)   DEFAULT 0,
  UNIQUE KEY `school_session_name` (`school_id`, `name`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `terms` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  VARCHAR(8)   NOT NULL,
  `session_id` INT UNSIGNED NOT NULL,
  `name`       ENUM('term_1','term_2','term_3') NOT NULL,
  `start_date` DATE         NOT NULL,
  `end_date`   DATE         NOT NULL,
  `is_current` TINYINT(1)   DEFAULT 0,
  UNIQUE KEY `session_term_name` (`session_id`, `name`),
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`) REFERENCES `academic_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `departments` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`        VARCHAR(8)   NOT NULL,
  `name`             VARCHAR(100) NOT NULL,   -- Sciences, Humanities, etc.
  `head_employee_id` INT UNSIGNED DEFAULT NULL,
  UNIQUE KEY `school_dept_name` (`school_id`, `name`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `employees` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`            CHAR(36)     NOT NULL UNIQUE,
  `school_id`       VARCHAR(8)   NOT NULL,
  `user_id`         VARCHAR(8)   NOT NULL UNIQUE,
  `department_id`   INT UNSIGNED DEFAULT NULL,
  `staff_no`        VARCHAR(30)  NOT NULL,
  `first_name`      VARCHAR(80)  NOT NULL,
  `last_name`       VARCHAR(80)  NOT NULL,
  `designation`     ENUM('teacher','hod','deputy_head','head','bursar','librarian','nurse','counsellor','boarding_master','grounds','clerk') NOT NULL,
  `qualification`   VARCHAR(255) DEFAULT NULL,
  `joining_date`    DATE         DEFAULT NULL,
  `employment_type` ENUM('permanent','contract','part_time') DEFAULT 'permanent',
  `status`          ENUM('active','resigned','dismissed') DEFAULT 'active',
  `is_teaching`     TINYINT(1)   DEFAULT 1,
  `phone`           VARCHAR(30)  DEFAULT NULL,
  `email`           VARCHAR(100) DEFAULT NULL,
  `created_at`      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `school_staff_no` (`school_id`, `staff_no`),
  FOREIGN KEY (`school_id`)     REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)       REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `departments` ADD FOREIGN KEY (`head_employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL;

CREATE TABLE `employee_subjects` (
  `employee_id` INT UNSIGNED NOT NULL,
  `subject_id`  INT UNSIGNED NOT NULL,
  PRIMARY KEY (`employee_id`, `subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `classes` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`        CHAR(36)     NOT NULL UNIQUE,
  `school_id`   VARCHAR(8)   NOT NULL,
  `name`        VARCHAR(60)  NOT NULL,   -- e.g. 'Form 2A', 'Lower 6 Sciences'
  `phase`       ENUM('infant','junior','ordinary','advanced') NOT NULL,
  `level`       TINYINT UNSIGNED NOT NULL,  -- 1-15 per §2.2
  `combination` VARCHAR(60)  DEFAULT NULL,
  `capacity`    TINYINT UNSIGNED DEFAULT 40,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `school_class_name` (`school_id`, `name`),
  CHECK (`level` BETWEEN 1 AND 15),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sections` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `class_id`        INT UNSIGNED NOT NULL,
  `name`            VARCHAR(10)  NOT NULL,  -- e.g. 'A', 'B'
  `capacity`        TINYINT UNSIGNED DEFAULT 40,
  `form_teacher_id` INT UNSIGNED DEFAULT NULL,
  UNIQUE KEY `class_section` (`class_id`, `name`),
  FOREIGN KEY (`class_id`)        REFERENCES `classes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`form_teacher_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exam_boards` (
  `id`        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`      VARCHAR(50)  NOT NULL UNIQUE,  -- ZIMSEC, Cambridge, Other
  `code`      VARCHAR(20)  NOT NULL,
  `is_active` TINYINT(1)   DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grading_scales` (
  `id`     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`   VARCHAR(50)  NOT NULL UNIQUE,
  `type`   ENUM('letter_points','percentage','descriptive','checklist') NOT NULL,
  `phases` JSON         DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grade_ranges` (
  `id`       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `scale_id` INT UNSIGNED NOT NULL,
  `grade`    VARCHAR(5)   NOT NULL,  -- A, B, C, D, E, U, or 1-5
  `min_pct`  DECIMAL(5,2) NOT NULL,
  `max_pct`  DECIMAL(5,2) NOT NULL,
  `points`   TINYINT      DEFAULT NULL,
  `remark`   VARCHAR(100) DEFAULT NULL,
  `is_pass`  TINYINT(1)   DEFAULT 1,
  CHECK (`min_pct` < `max_pct`),
  FOREIGN KEY (`scale_id`) REFERENCES `grading_scales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `subjects` (
  `id`        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`      CHAR(36)     NOT NULL UNIQUE,
  `code`      VARCHAR(20)  NOT NULL UNIQUE,  -- MATH, ENG, etc.
  `name`      VARCHAR(100) NOT NULL,
  `category`  ENUM('languages','mathematics','sciences','humanities','commercials','agriculture','technical_vocational','arts','physical_education','general_studies','ict','guidance') NOT NULL DEFAULT 'general_studies',
  `is_active` TINYINT(1)   DEFAULT 1,
  `board_code` VARCHAR(50) DEFAULT NULL,
  `board_id`  INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`board_id`) REFERENCES `exam_boards` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `employee_subjects` ADD FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE;

CREATE TABLE `subject_phases` (
  `subject_id`       INT UNSIGNED NOT NULL,
  `phase`            ENUM('infant','junior','ordinary','advanced') NOT NULL,
  `is_core`          TINYINT(1)   DEFAULT 1,
  `grading_scale_id` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`subject_id`, `phase`),
  FOREIGN KEY (`subject_id`)       REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`grading_scale_id`) REFERENCES `grading_scales` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `class_subjects` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `class_id`   INT UNSIGNED NOT NULL,
  `subject_id` INT UNSIGNED NOT NULL,
  `teacher_id` INT UNSIGNED DEFAULT NULL,
  `is_active`  TINYINT(1)   DEFAULT 1,
  UNIQUE KEY `class_subject_unique` (`class_id`, `subject_id`),
  FOREIGN KEY (`class_id`)   REFERENCES `classes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 4: People (Students, Guardians)
-- ============================================================

CREATE TABLE `guardians` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`            CHAR(36)     NOT NULL UNIQUE,
  `school_id`       VARCHAR(8)   NOT NULL,
  `user_id`         VARCHAR(8)   DEFAULT NULL UNIQUE,
  `first_name`      VARCHAR(80)  NOT NULL,
  `last_name`       VARCHAR(80)  NOT NULL,
  `phone`           VARCHAR(30)  NOT NULL,
  `email`           VARCHAR(100) DEFAULT NULL,
  `national_id`     VARCHAR(50)  DEFAULT NULL,
  `occupation`      VARCHAR(100) DEFAULT NULL,
  `address`         TEXT         DEFAULT NULL,
  `receives_sms`    TINYINT(1)   DEFAULT 1,
  `created_at`      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)   REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `students` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`           CHAR(36)     NOT NULL UNIQUE,
  `school_id`      VARCHAR(8)   NOT NULL,
  `user_id`        VARCHAR(8)   DEFAULT NULL UNIQUE,
  `admission_no`   VARCHAR(50)  NOT NULL,
  `first_name`     VARCHAR(80)  NOT NULL,
  `last_name`      VARCHAR(80)  NOT NULL,
  `other_name`     VARCHAR(80)  DEFAULT NULL,
  `gender`         ENUM('male','female','other') NOT NULL,
  `date_of_birth`  DATE         DEFAULT NULL,
  `birth_cert_no`  VARCHAR(50)  DEFAULT NULL,
  `national_id`    VARCHAR(50)  DEFAULT NULL,
  `blood_group`    VARCHAR(5)   DEFAULT NULL,
  `nationality`    VARCHAR(80)  DEFAULT 'Zimbabwean',
  `religion`       VARCHAR(60)  DEFAULT NULL,
  `address`        TEXT         DEFAULT NULL,
  `photo_path`     VARCHAR(255) DEFAULT NULL,
  `admission_date` DATE         DEFAULT NULL,
  `status`         ENUM('active','graduated','transferred','withdrawn','suspended','deceased') DEFAULT 'active',
  `previous_school` VARCHAR(150) DEFAULT NULL,
  `medical_notes`  TEXT         DEFAULT NULL,
  `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `school_admission_no` (`school_id`, `admission_no`),
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)   REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_guardian` (
  `student_id`         INT UNSIGNED NOT NULL,
  `guardian_id`        INT UNSIGNED NOT NULL,
  `relationship`       ENUM('father','mother','legal_guardian','other') DEFAULT 'legal_guardian',
  `is_primary`         TINYINT(1)   DEFAULT 0,
  `is_emergency_contact` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`student_id`, `guardian_id`),
  FOREIGN KEY (`student_id`)  REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`guardian_id`) REFERENCES `guardians` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `enrollments` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT UNSIGNED NOT NULL,
  `class_id`   INT UNSIGNED NOT NULL,
  `section_id` INT UNSIGNED DEFAULT NULL,
  `session_id` INT UNSIGNED NOT NULL,
  `roll_no`    VARCHAR(20)  DEFAULT NULL,
  `house_id`   INT UNSIGNED DEFAULT NULL,
  `status`     ENUM('active','promoted','repeating','transferred','withdrawn') DEFAULT 'active',
  UNIQUE KEY `student_session_enrollment` (`student_id`, `session_id`),
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`)   REFERENCES `classes` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`session_id`) REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_subjects` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`       INT UNSIGNED NOT NULL,
  `session_id`       INT UNSIGNED NOT NULL,
  `class_subject_id` INT UNSIGNED NOT NULL,
  `type`             ENUM('core','elective','subsidiary') DEFAULT 'core',
  `status`           ENUM('active','dropped') DEFAULT 'active',
  UNIQUE KEY `student_class_subject_session` (`student_id`, `class_subject_id`, `session_id`),
  FOREIGN KEY (`student_id`)       REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`)       REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `promotion_rules` (
  `id`                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`            VARCHAR(8)   NOT NULL,
  `from_class_id`        INT UNSIGNED NOT NULL,
  `to_class_id`          INT UNSIGNED DEFAULT NULL,
  `required_passes`      INT          DEFAULT 5,
  `mandatory_subject_ids` JSON        DEFAULT NULL,
  `min_average_pct`      DECIMAL(5,2) DEFAULT NULL,
  `is_active`            TINYINT(1)   DEFAULT 1,
  FOREIGN KEY (`school_id`)    REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`to_class_id`)   REFERENCES `classes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 5: Scheduling
-- ============================================================

CREATE TABLE `periods` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  VARCHAR(8)   NOT NULL,
  `name`       VARCHAR(30)  NOT NULL,  -- e.g. '07:30-08:10'
  `start_time` TIME         NOT NULL,
  `end_time`   TIME         NOT NULL,
  `day`        ENUM('Monday','Tuesday','Wednesday','Thursday','Friday') DEFAULT NULL,
  `sort_order` TINYINT UNSIGNED DEFAULT 0,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `rooms` (
  `id`        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id` VARCHAR(8)   NOT NULL,
  `name`      VARCHAR(60)  NOT NULL,
  `capacity`  TINYINT UNSIGNED DEFAULT 40,
  `type`      VARCHAR(30)  DEFAULT 'classroom',
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `timetable_slots` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`        VARCHAR(8)   NOT NULL,
  `section_id`       INT UNSIGNED NOT NULL,
  `session_id`       INT UNSIGNED NOT NULL,
  `period_id`        INT UNSIGNED NOT NULL,
  `day`              ENUM('Monday','Tuesday','Wednesday','Thursday','Friday') NOT NULL,
  `class_subject_id` INT UNSIGNED DEFAULT NULL,
  `room_id`          INT UNSIGNED DEFAULT NULL,
  `status`           ENUM('draft','published') DEFAULT 'draft',
  UNIQUE KEY `section_day_period` (`section_id`, `day`, `period_id`, `session_id`),
  FOREIGN KEY (`school_id`)        REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`section_id`)       REFERENCES `sections` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`)       REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`period_id`)        REFERENCES `periods` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`room_id`)          REFERENCES `rooms` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 6: Attendance
-- ============================================================

CREATE TABLE `student_attendance` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   NOT NULL,
  `student_id`  INT UNSIGNED NOT NULL,
  `date`        DATE         NOT NULL,
  `session`     ENUM('full_day','morning','afternoon') DEFAULT 'full_day',
  `status`      ENUM('present','absent','late','excused','half_day') NOT NULL,
  `marked_by`   VARCHAR(8)   NOT NULL,
  `remarks`     VARCHAR(255) DEFAULT NULL,
  `synced_at`   TIMESTAMP    NULL DEFAULT NULL,
  `client_uuid` CHAR(36)     DEFAULT NULL,
  UNIQUE KEY `student_date_session` (`student_id`, `date`, `session`),
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`marked_by`)  REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `staff_attendance` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   NOT NULL,
  `employee_id` INT UNSIGNED NOT NULL,
  `date`        DATE         NOT NULL,
  `check_in`    TIME         DEFAULT NULL,
  `check_out`   TIME         DEFAULT NULL,
  `status`      ENUM('present','absent','leave','late') NOT NULL,
  UNIQUE KEY `employee_date_att` (`employee_id`, `date`),
  FOREIGN KEY (`school_id`)   REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `leave_requests` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`        VARCHAR(8)   NOT NULL,
  `requester_id`     VARCHAR(8)   NOT NULL,
  `type`             VARCHAR(50)  NOT NULL,  -- annual, sick, maternity, study, exeat
  `start_date`       DATE         NOT NULL,
  `end_date`         DATE         NOT NULL,
  `reason`           TEXT         NOT NULL,
  `status`           ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
  `reviewed_by`      VARCHAR(8)   DEFAULT NULL,
  `reviewed_at`      TIMESTAMP    NULL DEFAULT NULL,
  `created_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)   REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 7: Assessment
-- ============================================================

CREATE TABLE `exams` (
  `id`                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`                 CHAR(36)     NOT NULL UNIQUE,
  `school_id`            VARCHAR(8)   NOT NULL,
  `name`                 VARCHAR(150) NOT NULL,
  `session_id`           INT UNSIGNED NOT NULL,
  `term_id`              INT UNSIGNED NOT NULL,
  `type`                 ENUM('mid_term','end_of_term','mock','continuous','board_sitting') NOT NULL,
  `start_date`           DATE         DEFAULT NULL,
  `end_date`             DATE         DEFAULT NULL,
  `status`               ENUM('draft','active','marks_entry','published','archived') DEFAULT 'draft',
  `marks_entry_deadline` DATETIME     DEFAULT NULL,
  `created_at`           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`) REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`term_id`)    REFERENCES `terms` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exam_schedules` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `exam_id`          INT UNSIGNED NOT NULL,
  `class_subject_id` INT UNSIGNED NOT NULL,
  `exam_date`        DATE         NOT NULL,
  `start_time`       TIME         DEFAULT NULL,
  `end_time`         TIME         DEFAULT NULL,
  `max_marks`        DECIMAL(6,2) DEFAULT 100.00,
  `pass_marks`       DECIMAL(6,2) DEFAULT 50.00,
  `room_id`          INT UNSIGNED DEFAULT NULL,
  UNIQUE KEY `exam_class_subject` (`exam_id`, `class_subject_id`),
  FOREIGN KEY (`exam_id`)          REFERENCES `exams` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`room_id`)          REFERENCES `rooms` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exam_components` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `exam_id`          INT UNSIGNED NOT NULL,
  `class_subject_id` INT UNSIGNED NOT NULL,
  `name`             VARCHAR(100) NOT NULL,  -- Paper 1, Test 1, SBA/CA, Practical
  `weight_pct`       DECIMAL(5,2) NOT NULL,  -- weights must sum to 100 per (exam, class_subject)
  `max_marks`        DECIMAL(6,2) NOT NULL,
  `is_sba`           TINYINT(1)   DEFAULT 0,
  UNIQUE KEY `exam_class_subject_component` (`exam_id`, `class_subject_id`, `name`),
  FOREIGN KEY (`exam_id`)          REFERENCES `exams` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `component_marks` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `component_id` INT UNSIGNED NOT NULL,
  `student_id`   INT UNSIGNED NOT NULL,
  `mark`         DECIMAL(6,2) DEFAULT NULL,
  `is_absent`    TINYINT(1)   DEFAULT 0,
  `entered_by`   VARCHAR(8)   NOT NULL,
  `entered_at`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `client_uuid`  CHAR(36)     DEFAULT NULL,
  UNIQUE KEY `component_student` (`component_id`, `student_id`),
  FOREIGN KEY (`component_id`) REFERENCES `exam_components` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`)   REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`entered_by`)   REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `results` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `exam_id`          INT UNSIGNED NOT NULL,
  `class_subject_id` INT UNSIGNED NOT NULL,
  `student_id`       INT UNSIGNED NOT NULL,
  `marks_obtained`   DECIMAL(6,2) DEFAULT NULL,
  `grade_code`       VARCHAR(5)   DEFAULT NULL,
  `points`           TINYINT      DEFAULT NULL,
  `remark`           VARCHAR(100) DEFAULT NULL,
  `entered_by`       VARCHAR(8)   DEFAULT NULL,
  `entered_at`       TIMESTAMP    NULL DEFAULT NULL,
  UNIQUE KEY `exam_class_subject_student` (`exam_id`, `class_subject_id`, `student_id`),
  FOREIGN KEY (`exam_id`)          REFERENCES `exams` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`student_id`)       REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `report_cards` (
  `id`                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`           INT UNSIGNED NOT NULL,
  `exam_id`              INT UNSIGNED NOT NULL,
  `total_marks`          DECIMAL(8,2) DEFAULT NULL,
  `average_pct`          DECIMAL(5,2) DEFAULT NULL,
  `gpa`                  DECIMAL(4,2) DEFAULT NULL,
  `points_total`         TINYINT      DEFAULT NULL,
  `class_rank`           SMALLINT     DEFAULT NULL,
  `form_rank`            SMALLINT     DEFAULT NULL,
  `conduct`              VARCHAR(50)  DEFAULT NULL,
  `class_teacher_remark` TEXT         DEFAULT NULL,
  `head_remark`          TEXT         DEFAULT NULL,
  `status`               ENUM('draft','teacher_signed','head_approved','published') DEFAULT 'draft',
  `published_at`         TIMESTAMP    NULL DEFAULT NULL,
  UNIQUE KEY `student_exam_card` (`student_id`, `exam_id`),
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`exam_id`)    REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assignments` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`             CHAR(36)     NOT NULL UNIQUE,
  `school_id`        VARCHAR(8)   NOT NULL,
  `class_subject_id` INT UNSIGNED NOT NULL,
  `session_id`       INT UNSIGNED NOT NULL,
  `title`            VARCHAR(200) NOT NULL,
  `description`      TEXT         DEFAULT NULL,
  `due_date`         DATE         NOT NULL,
  `max_marks`        DECIMAL(6,2) DEFAULT 100.00,
  `created_by`       VARCHAR(8)   NOT NULL,
  `created_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)        REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`)       REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`created_by`)       REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assignment_submissions` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `assignment_id` INT UNSIGNED NOT NULL,
  `student_id`    INT UNSIGNED NOT NULL,
  `submitted_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `file_path`     VARCHAR(255) DEFAULT NULL,
  `marks`         DECIMAL(6,2) DEFAULT NULL,
  `graded_by`     VARCHAR(8)   DEFAULT NULL,
  `graded_at`     TIMESTAMP    NULL DEFAULT NULL,
  `feedback`      TEXT         DEFAULT NULL,
  UNIQUE KEY `assignment_student` (`assignment_id`, `student_id`),
  FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`)    REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 8: ZIMSEC / Exam Board Entry
-- ============================================================

CREATE TABLE `exam_entries` (
  `id`                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`               CHAR(36)     NOT NULL UNIQUE,
  `school_id`          VARCHAR(8)   NOT NULL,
  `session_id`         INT UNSIGNED NOT NULL,
  `board_id`           INT UNSIGNED NOT NULL,
  `level`              ENUM('grade_7','o_level','a_level') NOT NULL,
  `sitting`            ENUM('june','november') NOT NULL,
  `centre_no`          VARCHAR(20)  DEFAULT NULL,
  `opens_at`           DATETIME     DEFAULT NULL,
  `closes_at`          DATETIME     DEFAULT NULL,
  `results_release_at` DATETIME     DEFAULT NULL,
  `status`             ENUM('open','collecting','submitted','results_received') DEFAULT 'open',
  `submitted_at`       TIMESTAMP    NULL DEFAULT NULL,
  `submitted_by`       VARCHAR(8)   DEFAULT NULL,
  `import_file_hash`   CHAR(64)     DEFAULT NULL,
  `created_at`         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`) REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`board_id`)   REFERENCES `exam_boards` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exam_entry_candidates` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `entry_id`     INT UNSIGNED NOT NULL,
  `student_id`   INT UNSIGNED NOT NULL,
  `candidate_no` VARCHAR(30)  DEFAULT NULL,
  `status`       ENUM('draft','confirmed','submitted','results_received') DEFAULT 'draft',
  `invoice_id`   INT UNSIGNED DEFAULT NULL,
  UNIQUE KEY `entry_student` (`entry_id`, `student_id`),
  UNIQUE KEY `entry_candidate_no` (`entry_id`, `candidate_no`),
  FOREIGN KEY (`entry_id`)   REFERENCES `exam_entries` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exam_entry_subjects` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `candidate_id`    INT UNSIGNED NOT NULL,
  `subject_id`      INT UNSIGNED NOT NULL,
  `option_code`     VARCHAR(20)  DEFAULT NULL,
  `sba_mark`        DECIMAL(5,2) DEFAULT NULL,
  `sba_submitted_at` TIMESTAMP   NULL DEFAULT NULL,
  UNIQUE KEY `candidate_subject` (`candidate_id`, `subject_id`),
  FOREIGN KEY (`candidate_id`) REFERENCES `exam_entry_candidates` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`)   REFERENCES `subjects` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `entry_results` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `candidate_id` INT UNSIGNED NOT NULL,
  `subject_id`   INT UNSIGNED NOT NULL,
  `grade`        VARCHAR(5)   NOT NULL,
  `points`       TINYINT      DEFAULT NULL,
  `marks`        DECIMAL(5,2) DEFAULT NULL,
  `source`       ENUM('import','manual') DEFAULT 'import',
  `imported_by`  VARCHAR(8)   DEFAULT NULL,
  `imported_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `candidate_subject_result` (`candidate_id`, `subject_id`),
  FOREIGN KEY (`candidate_id`) REFERENCES `exam_entry_candidates` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subject_id`)   REFERENCES `subjects` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `approvals` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`     VARCHAR(8)   NOT NULL,
  `entity_type`   VARCHAR(50)  NOT NULL,  -- exam, payment, entry, fee_structure, results_import
  `entity_id`     VARCHAR(36)  NOT NULL,
  `action`        VARCHAR(50)  NOT NULL,  -- publish, submit, reverse, activate, import
  `payload`       JSON         DEFAULT NULL,
  `requested_by`  VARCHAR(8)   NOT NULL,
  `approved_by`   VARCHAR(8)   DEFAULT NULL,
  `status`        ENUM('pending','approved','rejected') DEFAULT 'pending',
  `requested_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `decided_at`    TIMESTAMP    NULL DEFAULT NULL,
  FOREIGN KEY (`school_id`)    REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`),
  FOREIGN KEY (`approved_by`)  REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 9: Finance
-- ============================================================

CREATE TABLE `currencies` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code`           VARCHAR(10)  NOT NULL UNIQUE,
  `name`           VARCHAR(60)  NOT NULL,
  `symbol`         VARCHAR(5)   DEFAULT NULL,
  `is_base`        TINYINT(1)   DEFAULT 0,
  `decimal_places` TINYINT      DEFAULT 2
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exchange_rates` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `from_currency`   INT UNSIGNED NOT NULL,
  `to_currency`     INT UNSIGNED NOT NULL,
  `rate`            DECIMAL(16,6) NOT NULL,
  `effective_from`  DATETIME     NOT NULL,
  `created_by`      VARCHAR(8)   NOT NULL,
  UNIQUE KEY `rate_pair_time` (`from_currency`, `to_currency`, `effective_from`),
  FOREIGN KEY (`from_currency`) REFERENCES `currencies` (`id`),
  FOREIGN KEY (`to_currency`)   REFERENCES `currencies` (`id`),
  FOREIGN KEY (`created_by`)    REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fee_structures` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`       CHAR(36)     NOT NULL UNIQUE,
  `school_id`  VARCHAR(8)   NOT NULL,
  `session_id` INT UNSIGNED NOT NULL,
  `class_id`   INT UNSIGNED NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `currency_id` INT UNSIGNED NOT NULL,
  `status`     ENUM('draft','pending_approval','active','retired') DEFAULT 'draft',
  UNIQUE KEY `session_class_name` (`session_id`, `class_id`, `name`),
  FOREIGN KEY (`school_id`)   REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`)  REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`class_id`)    REFERENCES `classes` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fee_items` (
  `id`                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `fee_structure_id`  INT UNSIGNED NOT NULL,
  `name`              VARCHAR(100) NOT NULL,
  `amount`            DECIMAL(12,2) NOT NULL,
  `frequency`         ENUM('per_term','annual','one_time','per_subject_entry') DEFAULT 'per_term',
  CHECK (`amount` > 0),
  FOREIGN KEY (`fee_structure_id`) REFERENCES `fee_structures` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_discounts` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`  INT UNSIGNED NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `type`        ENUM('percentage','fixed') NOT NULL,
  `value`       DECIMAL(10,2) NOT NULL,
  `session_id`  INT UNSIGNED NOT NULL,
  `approved_by` VARCHAR(8)   DEFAULT NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`) REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `invoices` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`             CHAR(36)     NOT NULL UNIQUE,
  `invoice_no`       VARCHAR(30)  NOT NULL UNIQUE,
  `school_id`        VARCHAR(8)   NOT NULL,
  `student_id`       INT UNSIGNED NOT NULL,
  `session_id`       INT UNSIGNED NOT NULL,
  `term_id`          INT UNSIGNED DEFAULT NULL,
  `currency_id`      INT UNSIGNED NOT NULL,
  `generation_batch` CHAR(36)     DEFAULT NULL,
  `total_amount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `fine_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `amount_paid`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `balance`          DECIMAL(12,2) GENERATED ALWAYS AS (`total_amount` + `fine_amount` - `discount_amount` - `amount_paid`) STORED,
  `due_date`         DATE         DEFAULT NULL,
  `status`           ENUM('unpaid','part_paid','paid','overdue','voided') DEFAULT 'unpaid',
  `issued_at`        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)   REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`)  REFERENCES `students` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`session_id`)  REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`term_id`)     REFERENCES `terms` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `exam_entry_candidates` ADD FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL;

CREATE TABLE `invoice_items` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `invoice_id`      INT UNSIGNED NOT NULL,
  `fee_item_id`     INT UNSIGNED DEFAULT NULL,
  `description`     VARCHAR(200) NOT NULL,
  `amount`          DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (`invoice_id`)  REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`fee_item_id`) REFERENCES `fee_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payments` (
  `id`              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`            CHAR(36)     NOT NULL UNIQUE,
  `school_id`       VARCHAR(8)   NOT NULL,
  `invoice_id`      INT UNSIGNED NOT NULL,
  `currency_id`     INT UNSIGNED NOT NULL,
  `amount`          DECIMAL(12,2) NOT NULL,
  `fx_rate`         DECIMAL(16,6) DEFAULT NULL,
  `amount_base`     DECIMAL(16,2) DEFAULT NULL,
  `method`          ENUM('cash','bank_transfer','ecocash','onemoney','innbucks','card','online_gateway') NOT NULL,
  `reference`       VARCHAR(100) NOT NULL UNIQUE,
  `gateway_txn_id`  VARCHAR(100) DEFAULT NULL UNIQUE,
  `idempotency_key` VARCHAR(100) NOT NULL UNIQUE,
  `status`          ENUM('pending','success','failed','reversed') DEFAULT 'pending',
  `paid_at`         TIMESTAMP    NULL DEFAULT NULL,
  `received_by`     VARCHAR(8)   NOT NULL,
  `reversal_of_id`  BIGINT UNSIGNED DEFAULT NULL,
  `created_at`      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CHECK (`amount` > 0),
  FOREIGN KEY (`school_id`)     REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`invoice_id`)    REFERENCES `invoices` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`currency_id`)   REFERENCES `currencies` (`id`),
  FOREIGN KEY (`received_by`)   REFERENCES `users` (`id`),
  FOREIGN KEY (`reversal_of_id`) REFERENCES `payments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bank_statements` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`         CHAR(36)     NOT NULL UNIQUE,
  `school_id`    VARCHAR(8)   NOT NULL,
  `bank_account` VARCHAR(60)  NOT NULL,
  `period_start` DATE         NOT NULL,
  `period_end`   DATE         NOT NULL,
  `file_path`    VARCHAR(255) DEFAULT NULL,
  `file_hash`    CHAR(64)     DEFAULT NULL,
  `imported_by`  VARCHAR(8)   NOT NULL,
  `status`       ENUM('imported','reconciled') DEFAULT 'imported',
  `imported_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`imported_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bank_statement_lines` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `statement_id`     INT UNSIGNED NOT NULL,
  `value_date`       DATE         NOT NULL,
  `narrative`        VARCHAR(255) DEFAULT NULL,
  `amount`           DECIMAL(12,2) NOT NULL,
  `matched_payment_id` BIGINT UNSIGNED DEFAULT NULL,
  FOREIGN KEY (`statement_id`)      REFERENCES `bank_statements` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`matched_payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `expenses` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   NOT NULL,
  `category`    VARCHAR(60)  NOT NULL,
  `currency_id` INT UNSIGNED NOT NULL,
  `amount`      DECIMAL(12,2) NOT NULL,
  `expense_date` DATE        NOT NULL,
  `description` TEXT         DEFAULT NULL,
  `receipt_path` VARCHAR(255) DEFAULT NULL,
  `recorded_by` VARCHAR(8)   NOT NULL,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CHECK (`amount` > 0),
  FOREIGN KEY (`school_id`)   REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`),
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 10: Library
-- ============================================================

CREATE TABLE `book_categories` (
  `id`        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id` VARCHAR(8)   NOT NULL,
  `name`      VARCHAR(100) NOT NULL,
  `code`      VARCHAR(20)  DEFAULT NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `books` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`        CHAR(36)     NOT NULL UNIQUE,
  `school_id`   VARCHAR(8)   NOT NULL,
  `category_id` INT UNSIGNED DEFAULT NULL,
  `title`       VARCHAR(255) NOT NULL,
  `author`      VARCHAR(255) DEFAULT NULL,
  `isbn`        VARCHAR(20)  DEFAULT NULL,
  `publisher`   VARCHAR(100) DEFAULT NULL,
  `year`        YEAR         DEFAULT NULL,
  `total_copies` SMALLINT UNSIGNED DEFAULT 1,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)   REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `book_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `book_copies` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `book_id`     INT UNSIGNED NOT NULL,
  `copy_no`     VARCHAR(20)  NOT NULL,
  `condition`   ENUM('good','fair','damaged','lost') DEFAULT 'good',
  `status`      ENUM('available','on_loan','reserved','lost') DEFAULT 'available',
  UNIQUE KEY `book_copy_no` (`book_id`, `copy_no`),
  FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `book_loans` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `copy_id`     INT UNSIGNED NOT NULL,
  `borrower_id` INT UNSIGNED NOT NULL,
  `issued_by`   VARCHAR(8)   NOT NULL,
  `issued_at`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `due_date`    DATE         NOT NULL,
  `returned_at` TIMESTAMP    NULL DEFAULT NULL,
  `fine_amount` DECIMAL(8,2) DEFAULT NULL,
  FOREIGN KEY (`copy_id`)     REFERENCES `book_copies` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`borrower_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`issued_by`)   REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `book_reservations` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `book_id`      INT UNSIGNED NOT NULL,
  `student_id`   INT UNSIGNED NOT NULL,
  `reserved_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `status`       ENUM('pending','fulfilled','cancelled') DEFAULT 'pending',
  FOREIGN KEY (`book_id`)    REFERENCES `books` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 11: Transport
-- ============================================================

CREATE TABLE `vehicles` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   NOT NULL,
  `plate_no`    VARCHAR(20)  NOT NULL,
  `make_model`  VARCHAR(100) DEFAULT NULL,
  `capacity`    TINYINT UNSIGNED DEFAULT 40,
  `status`      ENUM('active','maintenance','decommissioned') DEFAULT 'active',
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `transport_routes` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  VARCHAR(8)   NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `vehicle_id` INT UNSIGNED DEFAULT NULL,
  `driver_name` VARCHAR(100) DEFAULT NULL,
  `driver_phone` VARCHAR(30) DEFAULT NULL,
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `route_stops` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `route_id`   INT UNSIGNED NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `stop_order` TINYINT UNSIGNED NOT NULL,
  `pickup_time` TIME        DEFAULT NULL,
  FOREIGN KEY (`route_id`) REFERENCES `transport_routes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_transport` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`  INT UNSIGNED NOT NULL,
  `route_id`    INT UNSIGNED NOT NULL,
  `stop_id`     INT UNSIGNED DEFAULT NULL,
  `session_id`  INT UNSIGNED NOT NULL,
  `direction`   ENUM('both','pickup_only','dropoff_only') DEFAULT 'both',
  UNIQUE KEY `student_route_session` (`student_id`, `session_id`),
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`route_id`)   REFERENCES `transport_routes` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`stop_id`)    REFERENCES `route_stops` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`session_id`) REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 12: Boarding
-- ============================================================

CREATE TABLE `houses` (
  `id`    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id` VARCHAR(8)  NOT NULL,
  `name`  VARCHAR(60)  NOT NULL UNIQUE,   -- Kudu, Sable, Impala, Buffalo
  `motto` VARCHAR(200) DEFAULT NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `enrollments` ADD FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE SET NULL;

CREATE TABLE `house_points` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `house_id`    INT UNSIGNED NOT NULL,
  `event`       VARCHAR(200) NOT NULL,
  `points`      INT          NOT NULL DEFAULT 0,
  `recorded_by` VARCHAR(8)   NOT NULL,
  `recorded_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`house_id`)    REFERENCES `houses` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hostels` (
  `id`                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`         VARCHAR(8)   NOT NULL,
  `name`              VARCHAR(100) NOT NULL UNIQUE,
  `type`              ENUM('boys','girls') NOT NULL,
  `warden_employee_id` INT UNSIGNED DEFAULT NULL,
  FOREIGN KEY (`school_id`)          REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`warden_employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hostel_rooms` (
  `id`        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `hostel_id` INT UNSIGNED NOT NULL,
  `room_no`   VARCHAR(20)  NOT NULL,
  `capacity`  TINYINT UNSIGNED DEFAULT 4,
  UNIQUE KEY `hostel_room_no` (`hostel_id`, `room_no`),
  FOREIGN KEY (`hostel_id`) REFERENCES `hostels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hostel_allocations` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`   INT UNSIGNED NOT NULL,
  `room_id`      INT UNSIGNED NOT NULL,
  `allocated_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `vacated_at`   TIMESTAMP    NULL DEFAULT NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`room_id`)    REFERENCES `hostel_rooms` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exeats` (
  `id`                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`         VARCHAR(8)   NOT NULL,
  `student_id`        INT UNSIGNED NOT NULL,
  `requested_by`      VARCHAR(8)   NOT NULL,
  `reason`            TEXT         NOT NULL,
  `destination`       VARCHAR(255) DEFAULT NULL,
  `leave_from`        DATETIME     NOT NULL,
  `return_by`         DATETIME     NOT NULL,
  `status`            ENUM('pending','approved','rejected','checked_out','returned','expired') DEFAULT 'pending',
  `approved_by`       VARCHAR(8)   DEFAULT NULL,
  `guardian_notified` TINYINT(1)   DEFAULT 0,
  `checked_out_at`    TIMESTAMP    NULL DEFAULT NULL,
  `checked_in_at`     TIMESTAMP    NULL DEFAULT NULL,
  `created_at`        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)    REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`)   REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`),
  FOREIGN KEY (`approved_by`)  REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_leadership` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`   INT UNSIGNED NOT NULL,
  `position`     ENUM('head_boy','head_girl','deputy_head_boy','deputy_head_girl','prefect','src','house_captain','other') NOT NULL,
  `scope`        ENUM('school','house','class') DEFAULT 'school',
  `session_id`   INT UNSIGNED NOT NULL,
  `appointed_by` VARCHAR(8)   NOT NULL,
  UNIQUE KEY `student_position_session` (`student_id`, `position`, `session_id`),
  FOREIGN KEY (`student_id`)   REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`)   REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`appointed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 13: Student Services
-- ============================================================

CREATE TABLE `health_profiles` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`      INT UNSIGNED NOT NULL UNIQUE,
  `blood_group`     VARCHAR(5)   DEFAULT NULL,
  `allergies`       TEXT         DEFAULT NULL,
  `conditions`      TEXT         DEFAULT NULL,
  `emergency_name`  VARCHAR(100) DEFAULT NULL,
  `emergency_phone` VARCHAR(30)  DEFAULT NULL,
  `updated_at`      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `health_visits` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   NOT NULL,
  `student_id`  INT UNSIGNED NOT NULL,
  `nurse_id`    VARCHAR(8)   NOT NULL,
  `visit_date`  DATE         NOT NULL,
  `complaint`   TEXT         DEFAULT NULL,
  `diagnosis`   TEXT         DEFAULT NULL,
  `treatment`   TEXT         DEFAULT NULL,
  `referred_to` VARCHAR(100) DEFAULT NULL,
  `notes`       TEXT         DEFAULT NULL,  -- encrypted at rest in production
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`nurse_id`)   REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `counselling_sessions` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`      VARCHAR(8)   NOT NULL,
  `student_id`     INT UNSIGNED NOT NULL,
  `counsellor_id`  VARCHAR(8)   NOT NULL,
  `date`           DATE         NOT NULL,
  `type`           ENUM('academic','psychosocial','career','substance','other') NOT NULL,
  `outcome`        ENUM('resolved','ongoing','referred') DEFAULT 'ongoing',
  `referred_to`    VARCHAR(100) DEFAULT NULL,
  `notes`          TEXT         DEFAULT NULL,  -- encrypted at rest
  `follow_up_date` DATE         DEFAULT NULL,
  `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)     REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`)    REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`counsellor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `disciplinary_records` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`    VARCHAR(8)   NOT NULL,
  `student_id`   INT UNSIGNED NOT NULL,
  `incident_date` DATE        NOT NULL,
  `category`     ENUM('minor','major') NOT NULL,
  `description`  TEXT         NOT NULL,
  `action`       ENUM('counselling_referral','detention','written_warning','suspension','expulsion_process','other') NOT NULL,
  `action_notes` TEXT         DEFAULT NULL,
  `recorded_by`  VARCHAR(8)   NOT NULL,
  `resolved_at`  TIMESTAMP    NULL DEFAULT NULL,
  `created_at`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)   REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`)  REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `documents` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`         CHAR(36)     NOT NULL UNIQUE,
  `school_id`    VARCHAR(8)   NOT NULL,
  `owner_type`   VARCHAR(30)  NOT NULL,  -- student, employee, school
  `owner_id`     VARCHAR(36)  NOT NULL,
  `doc_type`     VARCHAR(60)  NOT NULL,
  `file_path`    VARCHAR(255) NOT NULL,
  `mime`         VARCHAR(60)  DEFAULT NULL,
  `size_bytes`   INT UNSIGNED DEFAULT NULL,
  `uploaded_by`  VARCHAR(8)   NOT NULL,
  `visibility`   ENUM('private','staff_only','owner') DEFAULT 'private',
  `created_at`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)   REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 14: Schemes of Work & Lesson Plans
-- ============================================================

CREATE TABLE `schemes_of_work` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`        VARCHAR(8)   NOT NULL,
  `class_subject_id` INT UNSIGNED NOT NULL,
  `term_id`          INT UNSIGNED NOT NULL,
  `teacher_id`       INT UNSIGNED NOT NULL,
  `title`            VARCHAR(200) NOT NULL,
  `content`          TEXT         DEFAULT NULL,
  `file_path`        VARCHAR(255) DEFAULT NULL,
  `weeks`            JSON         DEFAULT NULL,
  `status`           ENUM('draft','submitted','approved','returned') DEFAULT 'draft',
  `reviewed_by`      INT UNSIGNED DEFAULT NULL,
  `review_notes`     TEXT         DEFAULT NULL,
  `reviewed_at`      TIMESTAMP    NULL DEFAULT NULL,
  UNIQUE KEY `class_subject_term_scheme` (`class_subject_id`, `term_id`),
  FOREIGN KEY (`school_id`)        REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`term_id`)          REFERENCES `terms` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`teacher_id`)       REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`reviewed_by`)      REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lesson_plans` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`        VARCHAR(8)   NOT NULL,
  `teacher_id`       INT UNSIGNED NOT NULL,
  `class_subject_id` INT UNSIGNED NOT NULL,
  `term_id`          INT UNSIGNED NOT NULL,
  `week`             TINYINT UNSIGNED NOT NULL,
  `date`             DATE         DEFAULT NULL,
  `topic`            VARCHAR(255) NOT NULL,
  `objectives`       TEXT         DEFAULT NULL,
  `resources`        TEXT         DEFAULT NULL,
  `taught_on`        DATE         DEFAULT NULL,
  `remarks`          TEXT         DEFAULT NULL,
  `status`           ENUM('draft','submitted','approved','returned') DEFAULT 'draft',
  `reviewed_by`      INT UNSIGNED DEFAULT NULL,
  `reviewed_at`      TIMESTAMP    NULL DEFAULT NULL,
  `created_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)        REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`teacher_id`)       REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`term_id`)          REFERENCES `terms` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`reviewed_by`)      REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 15: Admissions
-- ============================================================

CREATE TABLE `admission_cycles` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   NOT NULL,
  `session_id`  INT UNSIGNED NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `opens_at`    DATE         NOT NULL,
  `closes_at`   DATE         NOT NULL,
  `is_active`   TINYINT(1)   DEFAULT 1,
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`session_id`) REFERENCES `academic_sessions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `applications` (
  `id`                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid`               CHAR(36)     NOT NULL UNIQUE,
  `school_id`          VARCHAR(8)   NOT NULL,
  `cycle_id`           INT UNSIGNED DEFAULT NULL,
  `reference`          VARCHAR(20)  NOT NULL UNIQUE,
  `applicant_name`     VARCHAR(150) NOT NULL,
  `date_of_birth`      DATE         DEFAULT NULL,
  `gender`             ENUM('male','female','other') DEFAULT NULL,
  `applying_for_class` VARCHAR(60)  DEFAULT NULL,
  `guardian_name`      VARCHAR(150) NOT NULL,
  `guardian_phone`     VARCHAR(30)  NOT NULL,
  `guardian_email`     VARCHAR(100) DEFAULT NULL,
  `previous_school`    VARCHAR(150) DEFAULT NULL,
  `notes`              TEXT         DEFAULT NULL,  -- encrypted in prod
  `status`             ENUM('new','contacted','tour','offered','enrolled','rejected','withdrawn') DEFAULT 'new',
  `review_notes`       TEXT         DEFAULT NULL,
  `reviewed_by`        VARCHAR(8)   DEFAULT NULL,
  `created_at`         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)   REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`cycle_id`)    REFERENCES `admission_cycles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 16: Communication
-- ============================================================

CREATE TABLE `announcements` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   NOT NULL,
  `class_id`    INT UNSIGNED DEFAULT NULL,
  `title`       VARCHAR(200) NOT NULL,
  `body`        TEXT         NOT NULL,
  `expires_at`  DATE         DEFAULT NULL,
  `created_by`  VARCHAR(8)   NOT NULL,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`)   REFERENCES `classes` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `events` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   NOT NULL,
  `title`       VARCHAR(200) NOT NULL,
  `description` TEXT         DEFAULT NULL,
  `start_date`  DATE         NOT NULL,
  `end_date`    DATE         DEFAULT NULL,
  `created_by`  VARCHAR(8)   NOT NULL,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)  REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   VARCHAR(8)   NOT NULL,
  `user_id`     VARCHAR(8)   NOT NULL,
  `channel`     ENUM('in_app','email','sms','whatsapp') NOT NULL,
  `type`        VARCHAR(60)  NOT NULL,
  `title`       VARCHAR(200) NOT NULL,
  `body`        TEXT         NOT NULL,
  `entity_type` VARCHAR(50)  DEFAULT NULL,
  `entity_id`   VARCHAR(36)  DEFAULT NULL,
  `read_at`     TIMESTAMP    NULL DEFAULT NULL,
  `sent_at`     TIMESTAMP    NULL DEFAULT NULL,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)   REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `conversations` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  VARCHAR(8)   NOT NULL,
  `subject`    VARCHAR(200) DEFAULT NULL,
  `created_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `conversation_participants` (
  `conversation_id` INT UNSIGNED NOT NULL,
  `user_id`         VARCHAR(8)   NOT NULL,
  `joined_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`, `user_id`),
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)         REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id`              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` INT UNSIGNED NOT NULL,
  `sender_id`       VARCHAR(8)   NOT NULL,
  `body`            TEXT         NOT NULL,
  `sent_at`         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`)       REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 17: Statutory Returns
-- ============================================================

CREATE TABLE `statutory_returns` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`    VARCHAR(8)   NOT NULL,
  `type`         ENUM('emis_enrolment','emis_staffing','attendance_register','admission_register','fee_return','other') NOT NULL,
  `period`       VARCHAR(30)  NOT NULL,
  `generated_by` VARCHAR(8)   NOT NULL,
  `file_path`    VARCHAR(255) DEFAULT NULL,
  `file_hash`    CHAR(64)     DEFAULT NULL,
  `generated_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` TIMESTAMP    NULL DEFAULT NULL,
  FOREIGN KEY (`school_id`)    REFERENCES `schools` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Roles
INSERT INTO `roles` (`name`, `display_name`, `is_system`) VALUES
  ('super_admin',     'Super Administrator', 1),
  ('head',            'Headmaster/Headmistress', 1),
  ('deputy_head',     'Deputy Head', 1),
  ('hod',             'Head of Department', 1),
  ('admin',           'School Admin/Registry', 1),
  ('bursar',          'Bursar/Accounts', 1),
  ('teacher',         'Teacher', 1),
  ('librarian',       'Librarian', 1),
  ('nurse',           'Nurse', 1),
  ('counsellor',      'Guidance & Counsellor', 1),
  ('boarding_master', 'Boarding Master/Mistress', 1),
  ('student',         'Student', 1),
  ('parent',          'Parent/Guardian', 1);

-- Exam Boards
INSERT INTO `exam_boards` (`name`, `code`, `is_active`) VALUES
  ('ZIMSEC', 'ZIMSEC', 1),
  ('Cambridge', 'CAM', 1),
  ('Other', 'OTHER', 1);

-- Grading Scales
INSERT INTO `grading_scales` (`name`, `type`, `phases`) VALUES
  ('ZIMSEC_O',        'letter_points', '["ordinary"]'),
  ('ZIMSEC_A',        'letter_points', '["advanced"]'),
  ('PRIMARY_PCT',     'percentage',    '["infant","junior"]'),
  ('ECD_CHECKLIST',   'checklist',     '["infant"]'),
  ('CAMBRIDGE_IGCSE', 'letter_points', '["ordinary"]'),
  ('CAMBRIDGE_A',     'letter_points', '["advanced"]');

-- ZIMSEC O-Level grade ranges (A=1pt best, U=6pt worst)
INSERT INTO `grade_ranges` (`scale_id`, `grade`, `min_pct`, `max_pct`, `points`, `remark`, `is_pass`) VALUES
  (1, 'A', 75, 100, 1, 'Distinction', 1),
  (1, 'B', 65, 74.99, 2, 'Merit', 1),
  (1, 'C', 55, 64.99, 3, 'Credit', 1),
  (1, 'D', 45, 54.99, 4, 'Pass', 1),
  (1, 'E', 35, 44.99, 5, 'Pass', 1),
  (1, 'U', 0,  34.99, 6, 'Ungraded', 0);

-- ZIMSEC A-Level grade ranges (10-pt scale: A=10, B=8, C=6, D=4, E=2, U=0)
INSERT INTO `grade_ranges` (`scale_id`, `grade`, `min_pct`, `max_pct`, `points`, `remark`, `is_pass`) VALUES
  (2, 'A', 80, 100, 10, 'Distinction', 1),
  (2, 'B', 70, 79.99, 8, 'Merit', 1),
  (2, 'C', 60, 69.99, 6, 'Credit', 1),
  (2, 'D', 50, 59.99, 4, 'Pass', 1),
  (2, 'E', 40, 49.99, 2, 'Pass', 1),
  (2, 'U', 0,  39.99, 0, 'Ungraded', 0);

-- Primary grade bands (percentage)
INSERT INTO `grade_ranges` (`scale_id`, `grade`, `min_pct`, `max_pct`, `points`, `remark`, `is_pass`) VALUES
  (3, 'A', 80, 100, NULL, 'Excellent', 1),
  (3, 'B', 65, 79.99, NULL, 'Very Good', 1),
  (3, 'C', 50, 64.99, NULL, 'Good', 1),
  (3, 'D', 40, 49.99, NULL, 'Satisfactory', 1),
  (3, 'E', 0,  39.99, NULL, 'Needs Improvement', 0);

-- Currencies
INSERT INTO `currencies` (`code`, `name`, `symbol`, `is_base`, `decimal_places`) VALUES
  ('USD', 'US Dollar', '$', 1, 2),
  ('ZWG', 'Zimbabwe Gold (ZiG)', 'ZiG', 0, 2);

-- Subjects — ZIMSEC curriculum seeding
INSERT INTO `subjects` (`uuid`, `code`, `name`, `category`) VALUES
  -- Primary
  (UUID(), 'ENG',  'English Language',                  'languages'),
  (UUID(), 'SHO',  'Shona',                             'languages'),
  (UUID(), 'NDE',  'Ndebele',                           'languages'),
  (UUID(), 'MATH', 'Mathematics',                       'mathematics'),
  (UUID(), 'SCI',  'Science and Technology',            'sciences'),
  (UUID(), 'HSS',  'Heritage-Social Studies',           'humanities'),
  (UUID(), 'FARE', 'FAREME',                            'humanities'),
  (UUID(), 'AGR',  'Agriculture',                       'agriculture'),
  (UUID(), 'VPA',  'Visual and Performing Arts',        'arts'),
  (UUID(), 'PE',   'Physical Education, Sport & Mass Displays', 'physical_education'),
  (UUID(), 'ICT',  'ICT',                               'ict'),
  (UUID(), 'GC',   'Guidance and Counselling',          'guidance'),
  -- O-Level additional
  (UUID(), 'CSCI', 'Combined Science',                  'sciences'),
  (UUID(), 'BIO',  'Biology',                           'sciences'),
  (UUID(), 'CHEM', 'Chemistry',                         'sciences'),
  (UUID(), 'PHY',  'Physics',                           'sciences'),
  (UUID(), 'HSB',  'Human and Social Biology',          'sciences'),
  (UUID(), 'GEO',  'Geography',                         'humanities'),
  (UUID(), 'HIST', 'History',                           'humanities'),
  (UUID(), 'COM',  'Commerce',                          'commercials'),
  (UUID(), 'POA',  'Principles of Accounts',            'commercials'),
  (UUID(), 'BUS',  'Business Studies',                  'commercials'),
  (UUID(), 'CSCIO','Computer Science',                  'ict'),
  (UUID(), 'FOOD', 'Food and Nutrition / Food Technology', 'technical_vocational'),
  (UUID(), 'WOOD', 'Wood Technology and Design',        'technical_vocational'),
  (UUID(), 'METL', 'Metal Technology and Design',       'technical_vocational'),
  (UUID(), 'TGRD', 'Technical Graphics and Design',     'technical_vocational'),
  (UUID(), 'ART',  'Art and Design',                    'arts'),
  (UUID(), 'MUS',  'Music',                             'arts'),
  (UUID(), 'LITR', 'Literature in English',             'languages'),
  (UUID(), 'FRN',  'French',                            'languages'),
  (UUID(), 'PORT', 'Portuguese',                        'languages'),
  -- A-Level additional
  (UUID(), 'ECON', 'Economics',                         'commercials'),
  (UUID(), 'ACCT', 'Accounting',                        'commercials'),
  (UUID(), 'DIV',  'Divinity',                          'humanities'),
  (UUID(), 'GP',   'General Paper',                     'general_studies'),
  (UUID(), 'HSTS', 'Heritage Studies',                  'humanities');

-- Demo School
INSERT INTO `schools` (`id`, `name`, `code`, `school_type`, `offered_phases`) VALUES
  ('SCH00001', 'Sekai Academy (Harare)', 'SEKAI-HRE-01', 'combined', '["infant","junior","ordinary","advanced"]');

-- Super Admin User
INSERT INTO `users` (`id`, `uuid`, `username`, `email`, `password_hash`, `status`) VALUES
  ('USR00001', UUID(), 'superadmin', 'admin@sekaiah.ac.zw',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uYIVEIDQ.', -- password: password
   'active');

INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES
  ('USR00001', (SELECT id FROM roles WHERE name = 'super_admin'));

UPDATE `users` u
INNER JOIN `user_roles` ur ON ur.user_id = u.id
INNER JOIN `roles` r ON r.id = ur.role_id
SET u.role = r.name;

INSERT INTO `licenses` (`id`, `school_id`, `license_key`, `plan`, `status`, `expires_at`, `max_users`, `issued_by`) VALUES
  ('LIC00001', 'SCH00001', 'DEMO-LICENSE-KEY', 'full', 'active', DATE_ADD(NOW(), INTERVAL 1 YEAR), 500, 'USR00001');

-- Demo academic session
INSERT INTO `academic_sessions` (`school_id`, `name`, `start_date`, `end_date`, `is_current`) VALUES
  ('SCH00001', '2026', '2026-01-12', '2026-12-04', 1);

INSERT INTO `terms` (`school_id`, `session_id`, `name`, `start_date`, `end_date`, `is_current`) VALUES
  ('SCH00001', 1, 'term_1', '2026-01-12', '2026-04-03', 0),
  ('SCH00001', 1, 'term_2', '2026-05-05', '2026-08-07', 0),
  ('SCH00001', 1, 'term_3', '2026-09-08', '2026-12-04', 1);

-- Houses
INSERT INTO `houses` (`school_id`, `name`, `motto`) VALUES
  ('SCH00001', 'Kudu',    'Strength in Unity'),
  ('SCH00001', 'Sable',   'Excellence Always'),
  ('SCH00001', 'Impala',  'Swift and True'),
  ('SCH00001', 'Buffalo', 'Bold and Brave');

-- Departments
INSERT INTO `departments` (`school_id`, `name`) VALUES
  ('SCH00001', 'Sciences'),
  ('SCH00001', 'Mathematics'),
  ('SCH00001', 'Languages'),
  ('SCH00001', 'Humanities'),
  ('SCH00001', 'Commercials'),
  ('SCH00001', 'Technical/Vocational'),
  ('SCH00001', 'Primary'),
  ('SCH00001', 'Guidance & Counselling');

-- Settings
INSERT INTO `settings` (`school_id`, `key`, `value`, `group`) VALUES
  ('SCH00001', 'school_name',           'Sekai Academy (Harare)',   'school'),
  ('SCH00001', 'base_currency',         'USD',                       'finance'),
  ('SCH00001', 'o_level_points_best',   '6',                         'grading'),
  ('SCH00001', 'a_level_points_best',   '3',                         'grading'),
  ('SCH00001', 'o_level_mandatory_include', 'ENG',                   'grading'),
  ('SCH00001', 'a_level_include_general_paper', 'true',              'grading'),
  ('SCH00001', 'attendance_sessions',   'full_day',                  'attendance'),
  ('SCH00001', 'sms_gateway',           'mock',                      'communication'),
  ('SCH00001', 'notification_channel_matrix', '{"attendance":"sms","results":"in_app,sms","fees":"sms,email","discipline":"sms"}', 'communication');
