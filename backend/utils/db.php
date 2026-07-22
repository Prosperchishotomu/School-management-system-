<?php
require_once __DIR__ . '/../config.php';

// Current schema version — increment this whenever new migrations are added.
define('SCHEMA_VERSION', 10);

class Database {
    private static $instance = null;
    public static function getConnection() {
        if (self::$instance === null) {
            try {
                $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";port=" . DB_PORT . ";charset=utf8mb4";
                $options = [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ];
                self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
                self::runAutoMigration(self::$instance);
            } catch (PDOException $e) {
                error_log("Database connection error: " . $e->getMessage());
                self::sendErrorResponse("DATABASE_ERROR", "Unable to connect to the database server.", 500);
            }
        }
        return self::$instance;
    }
    
    private static function runAutoMigration($pdo) {
        try {
            // Ensure system_config table exists first (bootstraps version tracking)
            $pdo->exec("CREATE TABLE IF NOT EXISTS `system_config` (
                `key`   VARCHAR(100) PRIMARY KEY,
                `value` TEXT NOT NULL,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;");

            // Read current schema version from DB
            $stmt = $pdo->query("SELECT `value` FROM `system_config` WHERE `key` = 'schema_version'");
            $row = $stmt->fetch();
            $currentVersion = $row ? (int)$row['value'] : 0;

            if ($currentVersion >= SCHEMA_VERSION) {
                return; // Already up to date — skip all migrations
            }

            // ── Migration v1: email/payment gateway columns ──────────────────
            if ($currentVersion < 1) {
                $q = $pdo->query("SHOW COLUMNS FROM `notification_settings` LIKE 'email_smtp_host'");
                if (!$q->fetch()) {
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `email_smtp_host` VARCHAR(255) DEFAULT NULL AFTER `sms_sender_id`");
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `email_smtp_port` INT DEFAULT 587 AFTER `email_smtp_host`");
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `email_smtp_user` VARCHAR(255) DEFAULT NULL AFTER `email_smtp_port`");
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `email_smtp_pass` VARCHAR(255) DEFAULT NULL AFTER `email_smtp_user`");
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `email_from_address` VARCHAR(255) DEFAULT NULL AFTER `email_smtp_pass`");
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `email_from_name` VARCHAR(255) DEFAULT NULL AFTER `email_from_address`");
                }
                $qPay = $pdo->query("SHOW COLUMNS FROM `notification_settings` LIKE 'payment_gateway_type'");
                if (!$qPay->fetch()) {
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `payment_gateway_type` ENUM('ecocash', 'paynow', 'mock') DEFAULT 'mock' AFTER `email_from_name`");
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `payment_merchant_id` VARCHAR(255) DEFAULT NULL AFTER `payment_gateway_type`");
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `payment_merchant_key` VARCHAR(255) DEFAULT NULL AFTER `payment_merchant_id`");
                    $pdo->exec("ALTER TABLE `notification_settings` ADD COLUMN `payment_api_url` VARCHAR(500) DEFAULT NULL AFTER `payment_merchant_key`");
                }

                // teacher_messages table
                $pdo->exec("CREATE TABLE IF NOT EXISTS `teacher_messages` (
                    `id` VARCHAR(8) PRIMARY KEY,
                    `school_id` VARCHAR(8) NOT NULL,
                    `sender_id` VARCHAR(8) NOT NULL,
                    `recipient_id` VARCHAR(8) DEFAULT NULL,
                    `subject` VARCHAR(255) NOT NULL,
                    `body` TEXT NOT NULL,
                    `sent_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
                    FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB;");

                $q2 = $pdo->query("SHOW COLUMNS FROM `student_guardians` LIKE 'relation'");
                if (!$q2->fetch()) {
                    $pdo->exec("ALTER TABLE `student_guardians` ADD COLUMN `relation` VARCHAR(50) DEFAULT NULL");
                }
                $q3 = $pdo->query("SHOW COLUMNS FROM `exams` LIKE 'end_time'");
                if (!$q3->fetch()) {
                    $pdo->exec("ALTER TABLE `exams` ADD COLUMN `end_time` TIME DEFAULT NULL AFTER `start_time`");
                    $pdo->exec("ALTER TABLE `exams` ADD COLUMN `exam_type` ENUM('test','exam','coursework','mock') DEFAULT 'exam' AFTER `duration_minutes`");
                    $pdo->exec("ALTER TABLE `exams` ADD COLUMN `venue` VARCHAR(150) DEFAULT NULL AFTER `exam_type`");
                }
                $q4 = $pdo->query("SHOW COLUMNS FROM `assets` LIKE 'serial_number'");
                if (!$q4->fetch()) {
                    $pdo->exec("ALTER TABLE `assets` ADD COLUMN `serial_number` VARCHAR(100) DEFAULT NULL AFTER `code`");
                    $pdo->exec("ALTER TABLE `assets` ADD COLUMN `value` DECIMAL(10,2) DEFAULT 0.00 AFTER `serial_number`");
                }
                $pdo->exec("ALTER TABLE `assets` MODIFY COLUMN `category` VARCHAR(50) DEFAULT 'book'");
                $qMeta = $pdo->query("SHOW COLUMNS FROM `assets` LIKE 'metadata'");
                if (!$qMeta->fetch()) {
                    $pdo->exec("ALTER TABLE `assets` ADD COLUMN `metadata` TEXT DEFAULT NULL AFTER `description`");
                }
                $q5 = $pdo->query("SHOW COLUMNS FROM `discipline_incidents` LIKE 'action_taken'");
                if (!$q5->fetch()) {
                    $pdo->exec("ALTER TABLE `discipline_incidents` ADD COLUMN `action_taken` TEXT DEFAULT NULL AFTER `description`");
                }
                $pdo->exec("CREATE TABLE IF NOT EXISTS `asset_categories` (
                    `id` VARCHAR(8) PRIMARY KEY,
                    `school_id` VARCHAR(8) DEFAULT NULL,
                    `name` VARCHAR(100) NOT NULL,
                    `code` VARCHAR(50) NOT NULL UNIQUE,
                    `color_class` VARCHAR(100) DEFAULT 'text-blue-500 bg-blue-50',
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;");
                $checkCat = $pdo->query("SELECT COUNT(*) FROM `asset_categories`");
                if ((int)$checkCat->fetchColumn() === 0) {
                    $pdo->exec("INSERT INTO `asset_categories` (id, school_id, name, code, color_class) VALUES
                        ('CAT00001', NULL, 'Tech & Infrastructure', 'equipment', 'text-purple-500 bg-purple-50'),
                        ('CAT00002', NULL, 'Sports & Recreation', 'sport', 'text-amber-500 bg-amber-50'),
                        ('CAT00003', NULL, 'Library & Texts', 'book', 'text-teal-500 bg-teal-50'),
                        ('CAT00004', NULL, 'General Inventory', 'other', 'text-blue-500 bg-blue-50')
                    ");
                }
                $qG = $pdo->query("SHOW COLUMNS FROM `guardians` LIKE 'national_id'");
                if (!$qG->fetch()) {
                    $pdo->exec("ALTER TABLE `guardians` ADD COLUMN `national_id` VARCHAR(50) DEFAULT NULL AFTER `user_id`");
                }
            }

            // ── Migration v2: JWT token versioning ──────────────────────────
            if ($currentVersion < 2) {
                $qTv = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'token_version'");
                if (!$qTv->fetch()) {
                    $pdo->exec("ALTER TABLE `users` ADD COLUMN `token_version` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `lockout_until`");
                }
            }

            // ── Migration v3: Password reset tokens + IP rate limit ──────────
            if ($currentVersion < 3) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
                    `id` VARCHAR(8) PRIMARY KEY,
                    `user_id` VARCHAR(8) NOT NULL,
                    `token_hash` VARCHAR(64) NOT NULL UNIQUE,
                    `expires_at` TIMESTAMP NOT NULL,
                    `used` TINYINT(1) DEFAULT 0,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB;");

                $pdo->exec("CREATE TABLE IF NOT EXISTS `login_rate_limit` (
                    `ip` VARCHAR(45) NOT NULL,
                    `attempts` INT UNSIGNED NOT NULL DEFAULT 1,
                    `window_start` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`ip`)
                ) ENGINE=InnoDB;");
            }

            // ── Migration v4: fee payments payment_method ────────────────────
            if ($currentVersion < 4) {
                $q = $pdo->query("SHOW COLUMNS FROM `fee_payments` LIKE 'payment_method'");
                if (!$q->fetch()) {
                    $pdo->exec("ALTER TABLE `fee_payments` ADD COLUMN `payment_method` ENUM('cash', 'bank_transfer', 'mobile_money') NOT NULL DEFAULT 'cash' AFTER `reference`");
                }
            }
            // ── Migration v5: grading thresholds & school type ──────────────────
            if ($currentVersion < 5) {
                // Add school_type column
                $qSchool = $pdo->query("SHOW COLUMNS FROM `schools` LIKE 'school_type'");
                if (!$qSchool->fetch()) {
                    $pdo->exec("ALTER TABLE `schools` ADD COLUMN `school_type` ENUM('primary', 'secondary') NOT NULL DEFAULT 'secondary' AFTER `status`");
                }

                // Create grade_thresholds table
                $pdo->exec("CREATE TABLE IF NOT EXISTS `grade_thresholds` (
                    `id` VARCHAR(8) PRIMARY KEY,
                    `school_id` VARCHAR(8) NOT NULL,
                    `grade_symbol` VARCHAR(5) NOT NULL,
                    `min_mark` DECIMAL(5,2) NOT NULL,
                    `max_mark` DECIMAL(5,2) NOT NULL,
                    `is_pass` TINYINT(1) DEFAULT 1,
                    FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB;");

                // Seed default thresholds for existing schools
                $stmtSchools = $pdo->query("SELECT id, name FROM schools");
                $schoolsList = $stmtSchools->fetchAll();
                
                $stmtInsert = $pdo->prepare("INSERT INTO grade_thresholds (id, school_id, grade_symbol, min_mark, max_mark, is_pass) VALUES (?,?,?,?,?,?)");
                $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM grade_thresholds WHERE school_id=?");

                $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                $charsLen = strlen($chars);

                foreach ($schoolsList as $s) {
                    $schId = $s['id'];
                    $schName = strtolower($s['name']);
                    
                    // Determine if school is primary
                    $isPrimary = (strpos($schName, 'primary') !== false || strpos($schName, 'prep') !== false || strpos($schName, 'junior') !== false);
                    $schType = $isPrimary ? 'primary' : 'secondary';

                    // Update school type
                    $pdo->prepare("UPDATE schools SET school_type=? WHERE id=?")->execute([$schType, $schId]);

                    $stmtCheck->execute([$schId]);
                    $exists = (int)$stmtCheck->fetchColumn();
                    if ($exists === 0) {
                        if ($isPrimary) {
                            // Primary defaults (1 to 9)
                            $defaults = [
                                ['1', 80.00, 100.00, 1],
                                ['2', 70.00, 79.99, 1],
                                ['3', 60.00, 69.99, 1],
                                ['4', 50.00, 59.99, 1],
                                ['5', 45.00, 49.99, 1],
                                ['6', 40.00, 44.99, 1],
                                ['7', 35.00, 39.99, 0],
                                ['8', 30.00, 34.99, 0],
                                ['9', 0.00, 29.99, 0],
                            ];
                        } else {
                            // Secondary defaults (A to U)
                            $defaults = [
                                ['A', 75.00, 100.00, 1],
                                ['B', 65.00, 74.99, 1],
                                ['C', 50.00, 64.99, 1],
                                ['D', 40.00, 49.99, 0],
                                ['E', 30.00, 39.99, 0],
                                ['U', 0.00, 29.99, 0],
                            ];
                        }

                        foreach ($defaults as $d) {
                            $tid = '';
                            for ($i = 0; $i < 8; $i++) { $tid .= $chars[random_int(0, $charsLen - 1)]; }
                            $stmtInsert->execute([$tid, $schId, $d[0], $d[1], $d[2], $d[3]]);
                        }
                    }
                }
            }

            // ── Migration v6: Student statuses & grades assessment_name ──────────────────
            if ($currentVersion < 6) {
                // Add transferred, dropped_out to students table status
                $pdo->exec("ALTER TABLE `students` MODIFY COLUMN `status` ENUM('enrolled', 'suspended', 'withdrawn', 'graduated', 'transferred', 'dropped_out') DEFAULT 'enrolled'");
                
                // Add assessment_name to grades table
                $qGradeCol = $pdo->query("SHOW COLUMNS FROM `grades` LIKE 'assessment_name'");
                if (!$qGradeCol->fetch()) {
                    $pdo->exec("ALTER TABLE `grades` ADD COLUMN `assessment_name` VARCHAR(100) NOT NULL DEFAULT 'Test 1' AFTER `assessment_type`");
                }
            }

            // ── Migration v7: Leave & Absence Requests Table ────────────────────────────────
            if ($currentVersion < 7) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `leave_requests` (
                    `id` VARCHAR(8) PRIMARY KEY,
                    `school_id` VARCHAR(8) NOT NULL,
                    `request_type` ENUM('student_absence', 'staff_leave') NOT NULL,
                    `student_id` VARCHAR(8) DEFAULT NULL,
                    `staff_id` VARCHAR(8) DEFAULT NULL,
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
                ) ENGINE=InnoDB");
            }

            // ── Migration v8: Boarding Exeat & Multi-Currency Payments ────────────────────────
            if ($currentVersion < 8) {
                // Alter leave_requests: add exeat_pass ENUM type and hostel_name column
                $pdo->exec("ALTER TABLE `leave_requests` MODIFY COLUMN `request_type` ENUM('student_absence', 'staff_leave', 'exeat_pass') NOT NULL");
                
                $qHostel = $pdo->query("SHOW COLUMNS FROM `leave_requests` LIKE 'hostel_name'");
                if (!$qHostel->fetch()) {
                    $pdo->exec("ALTER TABLE `leave_requests` ADD COLUMN `hostel_name` VARCHAR(100) DEFAULT NULL AFTER `staff_id`");
                }
                
                // Alter fee_payments: add payment_currency, exchange_rate, amount_in_payment_currency
                $qCurr = $pdo->query("SHOW COLUMNS FROM `fee_payments` LIKE 'payment_currency'");
                if (!$qCurr->fetch()) {
                    $pdo->exec("ALTER TABLE `fee_payments` ADD COLUMN `payment_currency` VARCHAR(10) DEFAULT 'USD' AFTER `payment_method`");
                    $pdo->exec("ALTER TABLE `fee_payments` ADD COLUMN `exchange_rate` DECIMAL(12,4) DEFAULT 1.0000 AFTER `payment_currency`");
                    $pdo->exec("ALTER TABLE `fee_payments` ADD COLUMN `amount_in_payment_currency` DECIMAL(12,2) DEFAULT NULL AFTER `exchange_rate`");
                }
            }

            // ── Migration v9: School Level Classification & Curriculum Categories ────────────────────────
            if ($currentVersion < 9) {
                // Alter schools: add school_type
                $qType = $pdo->query("SHOW COLUMNS FROM `schools` LIKE 'school_type'");
                if (!$qType->fetch()) {
                    $pdo->exec("ALTER TABLE `schools` ADD COLUMN `school_type` ENUM('primary', 'secondary') DEFAULT 'primary' AFTER `status`");
                }
                
                // Alter subjects: add category
                $qCat = $pdo->query("SHOW COLUMNS FROM `subjects` LIKE 'category'");
                if (!$qCat->fetch()) {
                    $pdo->exec("ALTER TABLE `subjects` ADD COLUMN `category` ENUM('general', 'arts', 'commercials', 'sciences') DEFAULT 'general' AFTER `level`");
                }
            }

            // ── Migration v10: Hostels & Operational Expenses ────────────────────────
            if ($currentVersion < 10) {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `hostels` (
                    `id` VARCHAR(8) PRIMARY KEY,
                    `school_id` VARCHAR(8) NOT NULL,
                    `name` VARCHAR(100) NOT NULL,
                    `type` ENUM('student_male', 'student_female', 'staff_housing') NOT NULL,
                    `capacity` INT UNSIGNED NOT NULL DEFAULT 50,
                    `warden_name` VARCHAR(100) DEFAULT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

                $pdo->exec("CREATE TABLE IF NOT EXISTS `hostel_allocations` (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

                $pdo->exec("CREATE TABLE IF NOT EXISTS `expenses` (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            // ── Record new schema version ────────────────────────────────────
            $upsert = $pdo->prepare("INSERT INTO `system_config` (`key`, `value`) VALUES ('schema_version', ?)
                                     ON DUPLICATE KEY UPDATE `value` = ?, `updated_at` = NOW()");
            $upsert->execute([SCHEMA_VERSION, SCHEMA_VERSION]);

        } catch (Exception $e) {
            error_log("Auto migration failed: " . $e->getMessage());
        }
    }

    /**
     * Generate a cryptographically secure unique alphanumeric ID.
     * Throws RuntimeException if a unique ID cannot be found within $maxAttempts.
     */
    public static function generateUniqueId($table, $column = 'id', $length = 8) {
        $db = self::getConnection();
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $charsLen = strlen($chars);
        $maxAttempts = 10;

        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $id = '';
            for ($i = 0; $i < $length; $i++) {
                $id .= $chars[random_int(0, $charsLen - 1)];
            }
            $stmt = $db->prepare("SELECT 1 FROM `$table` WHERE `$column` = ? LIMIT 1");
            $stmt->execute([$id]);
            if (!$stmt->fetch()) {
                return $id;
            }
        }
        throw new RuntimeException("Could not generate unique ID for table '$table' after $maxAttempts attempts.");
    }

    /**
     * Generate an alphanumeric ID based on a name that is unique in the target table.
     */
    public static function generateIdFromName($name, $table, $column = 'id', $length = 8) {
        $db = self::getConnection();
        $clean = preg_replace('/[^A-Z0-9]/', '', strtoupper($name));
        if (strlen($clean) < 6) {
            $clean .= 'SCHOOL';
        }
        $base = substr($clean, 0, $length);
        $id = $base;
        $i = 1;
        while (true) {
            $stmt = $db->prepare("SELECT 1 FROM `$table` WHERE `$column` = ? LIMIT 1");
            $stmt->execute([$id]);
            if (!$stmt->fetch()) {
                return $id;
            }
            $suffix = (string)$i;
            $maxBaseLen = $length - strlen($suffix);
            $id = substr($base, 0, $maxBaseLen) . $suffix;
            $i++;
            if ($i > 9999) {
                throw new RuntimeException("Cannot generate unique name-based ID for '$name' in table '$table'.");
            }
        }
    }

    /**
     * Get the current active term code for a school.
     * Falls back to the most recent term if no current term is flagged.
     */
    public static function getCurrentTerm($schoolId) {
        $db = self::getConnection();
        $stmt = $db->prepare("SELECT term_code FROM term_config WHERE school_id = ? AND is_current = 1 ORDER BY start_date DESC LIMIT 1");
        $stmt->execute([$schoolId]);
        $row = $stmt->fetch();
        if ($row) return $row['term_code'];

        // Fallback: most recent term by end date
        $stmt2 = $db->prepare("SELECT term_code FROM term_config WHERE school_id = ? ORDER BY end_date DESC LIMIT 1");
        $stmt2->execute([$schoolId]);
        $row2 = $stmt2->fetch();
        return $row2 ? $row2['term_code'] : '2026-T1';
    }

    /**
     * Compute grade symbol and pass status dynamically using configured thresholds
     */
    public static function getGradeForMark($schoolId, $mark) {
        $db = self::getConnection();
        
        // Query configured thresholds
        $stmt = $db->prepare("SELECT grade_symbol, is_pass FROM grade_thresholds WHERE school_id = ? AND ? >= min_mark AND ? <= max_mark LIMIT 1");
        $stmt->execute([$schoolId, $mark, $mark]);
        $row = $stmt->fetch();
        if ($row) {
            return [
                'grade' => $row['grade_symbol'],
                'pass_status' => ((int)$row['is_pass'] === 1) ? 'pass' : 'fail'
            ];
        }

        // Hardcoded backup defaults if something goes wrong
        $stmtSchType = $db->prepare("SELECT school_type FROM schools WHERE id = ? LIMIT 1");
        $stmtSchType->execute([$schoolId]);
        $type = $stmtSchType->fetchColumn() ?: 'secondary';

        if ($type === 'primary') {
            if ($mark >= 80) return ['grade' => '1', 'pass_status' => 'pass'];
            if ($mark >= 70) return ['grade' => '2', 'pass_status' => 'pass'];
            if ($mark >= 60) return ['grade' => '3', 'pass_status' => 'pass'];
            if ($mark >= 50) return ['grade' => '4', 'pass_status' => 'pass'];
            if ($mark >= 45) return ['grade' => '5', 'pass_status' => 'pass'];
            if ($mark >= 40) return ['grade' => '6', 'pass_status' => 'pass'];
            if ($mark >= 35) return ['grade' => '7', 'pass_status' => 'fail'];
            if ($mark >= 30) return ['grade' => '8', 'pass_status' => 'fail'];
            return ['grade' => '9', 'pass_status' => 'fail'];
        } else {
            if ($mark >= 75) return ['grade' => 'A', 'pass_status' => 'pass'];
            if ($mark >= 65) return ['grade' => 'B', 'pass_status' => 'pass'];
            if ($mark >= 50) return ['grade' => 'C', 'pass_status' => 'pass'];
            if ($mark >= 40) return ['grade' => 'D', 'pass_status' => 'fail'];
            if ($mark >= 30) return ['grade' => 'E', 'pass_status' => 'fail'];
            return ['grade' => 'U', 'pass_status' => 'fail'];
        }
    }

    /**
     * Compute total primary units (sum of 1-9 grades across up to 6 subjects, range 6 to 54)
     */
    public static function calculatePrimaryUnits($schoolId, $studentId, $term) {
        $db = self::getConnection();
        $stmt = $db->prepare("
            SELECT subject, 
                   COALESCE(ROUND(SUM(grade_value * weight) / NULLIF(SUM(weight), 0), 2), 0.00) as subject_mark
            FROM grades
            WHERE school_id = ? AND student_id = ? AND term = ?
            GROUP BY subject
        ");
        $stmt->execute([$schoolId, $studentId, $term]);
        $subjectRows = $stmt->fetchAll();

        if (empty($subjectRows)) {
            return 54;
        }

        $units = [];
        foreach ($subjectRows as $row) {
            $g = self::getGradeForMark($schoolId, (float)$row['subject_mark']);
            $unitVal = (int)preg_replace('/[^0-9]/', '', $g['grade']);
            if ($unitVal < 1 || $unitVal > 9) {
                $unitVal = 9;
            }
            $units[] = $unitVal;
        }

        sort($units, SORT_NUMERIC);
        $top6 = array_slice($units, 0, 6);
        while (count($top6) < 6) {
            $top6[] = 9;
        }

        $totalUnits = array_sum($top6);
        return max(6, min(54, $totalUnits));
    }

    /**
     * Compute ZIMSEC Advanced Level (A-Level Form 5 & 6) points score (top 3 principal subjects: A=5, B=4, C=3, D=2, E=1, max 15 points)
     */
    public static function calculateALevelPoints($schoolId, $studentId, $term) {
        $db = self::getConnection();
        $stmt = $db->prepare("
            SELECT subject, 
                   COALESCE(ROUND(SUM(grade_value * weight) / NULLIF(SUM(weight), 0), 2), 0.00) as subject_mark
            FROM grades
            WHERE school_id = ? AND student_id = ? AND term = ?
            GROUP BY subject
        ");
        $stmt->execute([$schoolId, $studentId, $term]);
        $subjectRows = $stmt->fetchAll();

        if (empty($subjectRows)) {
            return 0;
        }

        $points = [];
        foreach ($subjectRows as $row) {
            $m = (float)$row['subject_mark'];
            if ($m >= 75) $pts = 5;      // Grade A
            else if ($m >= 65) $pts = 4; // Grade B
            else if ($m >= 55) $pts = 3; // Grade C
            else if ($m >= 45) $pts = 2; // Grade D
            else if ($m >= 40) $pts = 1; // Grade E
            else $pts = 0;              // Grade O/F (Fail)

            $points[] = $pts;
        }

        rsort($points, SORT_NUMERIC);
        $top3 = array_slice($points, 0, 3);
        return array_sum($top3);
    }

    /**
     * Send a standardized error response and terminate.
     */
    private static function sendErrorResponse($code, $message, $httpStatus = 500) {
        header('Content-Type: application/json');
        http_response_code($httpStatus);
        echo json_encode([
            "data"  => null,
            "meta"  => new stdClass(),
            "error" => [
                "code"    => $code,
                "message" => $message,
                "fields"  => null
            ]
        ]);
        exit;
    }
}
