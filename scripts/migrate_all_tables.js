const path = require('path');
const mysql = require(path.join(__dirname, '../backend-node/node_modules/mysql2/promise'));
require(path.join(__dirname, '../backend-node/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend-node/.env') });

async function migrate() {
  console.log('Connecting to MySQL database...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'schoolbase'
  });

  console.log('Connected! Ensuring column upgrades...');

  // Ensure users.role is VARCHAR(50)
  try {
    await conn.query('ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(50) NOT NULL DEFAULT "teacher"');
    console.log('✅ users.role expanded to VARCHAR(50)');
  } catch (e) {
    console.warn('users.role update note:', e.message);
  }

  // Ensure schools has offered_phases and school_type includes 'combined'
  try {
    await conn.query('ALTER TABLE `schools` ADD COLUMN `offered_phases` JSON NULL');
  } catch (_) {}
  try {
    await conn.query("ALTER TABLE `schools` MODIFY COLUMN `school_type` VARCHAR(50) DEFAULT 'combined'");
  } catch (_) {}

  const tables = [
    // Academic Sessions & Terms
    `CREATE TABLE IF NOT EXISTS \`academic_sessions\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`year\` INT UNSIGNED DEFAULT 2026,
      \`name\` VARCHAR(50) NOT NULL,
      \`start_date\` DATE NOT NULL,
      \`end_date\` DATE NOT NULL,
      \`is_current\` TINYINT(1) DEFAULT 0,
      \`status\` VARCHAR(20) DEFAULT 'active',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_sess_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`terms\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`session_id\` INT UNSIGNED NOT NULL,
      \`name\` VARCHAR(50) NOT NULL,
      \`start_date\` DATE NOT NULL,
      \`end_date\` DATE NOT NULL,
      \`is_current\` TINYINT(1) DEFAULT 0,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_term_sess\` (\`session_id\`),
      INDEX \`idx_term_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Departments & Employees
    `CREATE TABLE IF NOT EXISTS \`departments\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`head_employee_id\` INT UNSIGNED DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_dept_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`employees\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` CHAR(36) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`user_id\` VARCHAR(50) NOT NULL,
      \`department_id\` INT UNSIGNED DEFAULT NULL,
      \`staff_no\` VARCHAR(50) NOT NULL,
      \`first_name\` VARCHAR(80) NOT NULL,
      \`last_name\` VARCHAR(80) NOT NULL,
      \`designation\` VARCHAR(50) NOT NULL DEFAULT 'teacher',
      \`qualification\` VARCHAR(255) DEFAULT NULL,
      \`joining_date\` DATE DEFAULT NULL,
      \`employment_type\` VARCHAR(30) DEFAULT 'permanent',
      \`status\` VARCHAR(30) DEFAULT 'active',
      \`is_teaching\` TINYINT(1) DEFAULT 1,
      \`phone\` VARCHAR(30) DEFAULT NULL,
      \`email\` VARCHAR(100) DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_emp_school\` (\`school_id\`),
      INDEX \`idx_emp_user\` (\`user_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`employee_subjects\` (
      \`employee_id\` INT UNSIGNED NOT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      PRIMARY KEY (\`employee_id\`, \`subject_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Exam Boards & Grading Scales
    `CREATE TABLE IF NOT EXISTS \`exam_boards\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(50) NOT NULL UNIQUE,
      \`code\` VARCHAR(20) NOT NULL UNIQUE,
      \`is_active\` TINYINT(1) DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`grading_scales\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(50) NOT NULL UNIQUE,
      \`type\` VARCHAR(30) NOT NULL,
      \`phases\` JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`grade_ranges\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`scale_id\` INT UNSIGNED NOT NULL,
      \`grade\` VARCHAR(10) NOT NULL,
      \`min_pct\` DECIMAL(5,2) NOT NULL,
      \`max_pct\` DECIMAL(5,2) NOT NULL,
      \`points\` TINYINT DEFAULT NULL,
      \`remark\` VARCHAR(100) DEFAULT NULL,
      \`is_pass\` TINYINT(1) DEFAULT 1,
      INDEX \`idx_grade_scale\` (\`scale_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Class Subjects, Enrollments & Promotion
    `CREATE TABLE IF NOT EXISTS \`subject_phases\` (
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`phase\` VARCHAR(30) NOT NULL,
      \`is_core\` TINYINT(1) DEFAULT 1,
      \`grading_scale_id\` INT UNSIGNED DEFAULT NULL,
      PRIMARY KEY (\`subject_id\`, \`phase\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`class_subjects\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`class_id\` VARCHAR(50) NOT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`teacher_id\` VARCHAR(50) DEFAULT NULL,
      \`is_active\` TINYINT(1) DEFAULT 1,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_cs_class\` (\`class_id\`),
      INDEX \`idx_cs_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`enrollments\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`class_id\` VARCHAR(50) NOT NULL,
      \`session_id\` INT UNSIGNED DEFAULT NULL,
      \`roll_no\` VARCHAR(20) DEFAULT NULL,
      \`house_id\` INT UNSIGNED DEFAULT NULL,
      \`status\` VARCHAR(30) DEFAULT 'active',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_enr_student\` (\`student_id\`),
      INDEX \`idx_enr_class\` (\`class_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`student_subjects\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`session_id\` INT UNSIGNED DEFAULT NULL,
      \`class_subject_id\` INT UNSIGNED DEFAULT NULL,
      \`subject_id\` VARCHAR(50) DEFAULT NULL,
      \`type\` VARCHAR(20) DEFAULT 'core',
      \`status\` VARCHAR(20) DEFAULT 'active',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_ss_student\` (\`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`promotion_rules\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`from_class_id\` VARCHAR(50) NOT NULL,
      \`to_class_id\` VARCHAR(50) DEFAULT NULL,
      \`required_passes\` INT DEFAULT 5,
      \`mandatory_subject_ids\` JSON DEFAULT NULL,
      \`min_average_pct\` DECIMAL(5,2) DEFAULT 50.00,
      \`is_active\` TINYINT(1) DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Exam Components, Component Marks, Report Cards
    `CREATE TABLE IF NOT EXISTS \`exam_components\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`exam_id\` VARCHAR(50) NOT NULL,
      \`class_subject_id\` INT UNSIGNED NOT NULL,
      \`name\` VARCHAR(80) NOT NULL,
      \`weight_pct\` DECIMAL(5,2) NOT NULL,
      \`max_marks\` DECIMAL(6,2) NOT NULL DEFAULT 100.00,
      \`is_sba\` TINYINT(1) DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`component_marks\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`component_id\` INT UNSIGNED NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`mark\` DECIMAL(6,2) DEFAULT NULL,
      \`is_absent\` TINYINT(1) DEFAULT 0,
      UNIQUE KEY \`uq_comp_student\` (\`component_id\`, \`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`report_cards\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`exam_id\` VARCHAR(50) NOT NULL,
      \`term\` VARCHAR(20) DEFAULT NULL,
      \`total_marks\` DECIMAL(8,2) DEFAULT NULL,
      \`average_pct\` DECIMAL(5,2) DEFAULT NULL,
      \`points_total\` INT DEFAULT NULL,
      \`class_rank\` INT DEFAULT NULL,
      \`form_rank\` INT DEFAULT NULL,
      \`conduct\` VARCHAR(100) DEFAULT 'Good',
      \`class_teacher_remark\` TEXT DEFAULT NULL,
      \`head_remark\` TEXT DEFAULT NULL,
      \`status\` VARCHAR(30) DEFAULT 'draft',
      \`published_at\` DATETIME DEFAULT NULL,
      INDEX \`idx_rc_student\` (\`student_id\`),
      INDEX \`idx_rc_exam\` (\`exam_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ZIMSEC Exam Entries & Results
    `CREATE TABLE IF NOT EXISTS \`exam_entries\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`board_id\` INT UNSIGNED DEFAULT 1,
      \`session_year\` INT UNSIGNED NOT NULL,
      \`exam_series\` VARCHAR(30) NOT NULL DEFAULT 'november',
      \`level\` VARCHAR(30) DEFAULT 'o_level',
      \`center_no\` VARCHAR(30) NOT NULL,
      \`opens_at\` DATETIME NULL,
      \`closes_at\` DATETIME NULL,
      \`results_release_at\` DATETIME NULL,
      \`status\` VARCHAR(30) DEFAULT 'draft',
      \`submitted_at\` DATETIME NULL,
      \`submitted_by\` VARCHAR(50) NULL,
      \`import_file_hash\` VARCHAR(64) NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_ee_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`exam_entry_candidates\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`entry_id\` INT UNSIGNED NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`candidate_no\` VARCHAR(20) DEFAULT NULL,
      \`center_no\` VARCHAR(30) DEFAULT NULL,
      \`status\` VARCHAR(30) DEFAULT 'draft',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_eec_entry\` (\`entry_id\`),
      INDEX \`idx_eec_student\` (\`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`exam_entry_subjects\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`candidate_id\` INT UNSIGNED NOT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`option_code\` VARCHAR(20) DEFAULT NULL,
      \`paper_codes\` VARCHAR(100) DEFAULT NULL,
      \`sba_mark\` DECIMAL(5,2) DEFAULT NULL,
      \`sba_submitted_at\` DATETIME DEFAULT NULL,
      INDEX \`idx_ees_cand\` (\`candidate_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`entry_results\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`candidate_id\` INT UNSIGNED NOT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`grade\` VARCHAR(10) NOT NULL,
      \`points\` TINYINT DEFAULT 0,
      \`marks\` DECIMAL(5,2) DEFAULT NULL,
      \`source\` VARCHAR(20) DEFAULT 'import',
      \`imported_by\` VARCHAR(50) NULL,
      \`imported_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`uq_cand_subj\` (\`candidate_id\`, \`subject_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Schemes of Work & Lesson Plans
    `CREATE TABLE IF NOT EXISTS \`schemes_of_work\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`class_id\` VARCHAR(50) NOT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`term_id\` INT UNSIGNED DEFAULT 1,
      \`teacher_employee_id\` VARCHAR(50) NOT NULL,
      \`week_number\` TINYINT UNSIGNED NOT NULL DEFAULT 1,
      \`topic\` VARCHAR(200) NOT NULL,
      \`sub_topic\` VARCHAR(200) DEFAULT NULL,
      \`objectives\` TEXT DEFAULT NULL,
      \`competencies\` TEXT DEFAULT NULL,
      \`SOM\` TEXT DEFAULT NULL,
      \`evaluation\` TEXT DEFAULT NULL,
      \`status\` VARCHAR(30) DEFAULT 'draft',
      \`approved_by\` VARCHAR(50) DEFAULT NULL,
      \`approval_comments\` TEXT DEFAULT NULL,
      \`approved_at\` DATETIME DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_sow_school\` (\`school_id\`),
      INDEX \`idx_sow_class\` (\`class_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`lesson_plans\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`scheme_id\` INT UNSIGNED DEFAULT NULL,
      \`class_id\` VARCHAR(50) NOT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`teacher_employee_id\` VARCHAR(50) NOT NULL,
      \`lesson_date\` DATE NOT NULL,
      \`duration_minutes\` INT UNSIGNED DEFAULT 40,
      \`topic\` VARCHAR(200) NOT NULL,
      \`sub_topic\` VARCHAR(200) DEFAULT NULL,
      \`lesson_objectives\` TEXT DEFAULT NULL,
      \`introduction\` TEXT DEFAULT NULL,
      \`main_activities\` TEXT DEFAULT NULL,
      \`conclusion\` TEXT DEFAULT NULL,
      \`assessment_task\` TEXT DEFAULT NULL,
      \`media_aids\` TEXT DEFAULT NULL,
      \`evaluation\` TEXT DEFAULT NULL,
      \`status\` VARCHAR(30) DEFAULT 'draft',
      \`approved_by\` VARCHAR(50) DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_lp_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Multi-Currency Finance & Reconciliation
    `CREATE TABLE IF NOT EXISTS \`currencies\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`code\` VARCHAR(10) NOT NULL UNIQUE,
      \`name\` VARCHAR(60) NOT NULL,
      \`symbol\` VARCHAR(10) NOT NULL,
      \`is_base\` TINYINT(1) DEFAULT 0,
      \`decimal_places\` TINYINT DEFAULT 2
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`exchange_rates\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`from_currency\` VARCHAR(10) NOT NULL,
      \`to_currency\` VARCHAR(10) NOT NULL,
      \`rate\` DECIMAL(16,6) NOT NULL,
      \`effective_from\` DATETIME NOT NULL,
      \`created_by\` VARCHAR(50) NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_fx_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`fee_structures\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`session_id\` INT UNSIGNED DEFAULT NULL,
      \`class_id\` VARCHAR(50) DEFAULT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`currency_code\` VARCHAR(10) DEFAULT 'USD',
      \`status\` VARCHAR(30) DEFAULT 'draft',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_fs_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`fee_items\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`fee_structure_id\` INT UNSIGNED NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`amount\` DECIMAL(12,2) NOT NULL,
      \`frequency\` VARCHAR(30) DEFAULT 'per_term',
      INDEX \`idx_fi_struct\` (\`fee_structure_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`student_discounts\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`type\` VARCHAR(20) DEFAULT 'percentage',
      \`value\` DECIMAL(10,2) NOT NULL,
      \`approved_by\` VARCHAR(50) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`invoices\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`invoice_no\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`session_id\` INT UNSIGNED DEFAULT NULL,
      \`term\` VARCHAR(20) DEFAULT 'Term 1',
      \`currency_code\` VARCHAR(10) DEFAULT 'USD',
      \`total_amount\` DECIMAL(12,2) NOT NULL,
      \`discount_amount\` DECIMAL(12,2) DEFAULT 0.00,
      \`amount_paid\` DECIMAL(12,2) DEFAULT 0.00,
      \`balance\` DECIMAL(12,2) NOT NULL,
      \`due_date\` DATE NULL,
      \`status\` VARCHAR(30) DEFAULT 'unpaid',
      \`issued_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_inv_student\` (\`student_id\`),
      INDEX \`idx_inv_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`invoice_items\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`invoice_id\` INT UNSIGNED NOT NULL,
      \`description\` VARCHAR(200) NOT NULL,
      \`amount\` DECIMAL(12,2) NOT NULL,
      INDEX \`idx_ii_inv\` (\`invoice_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`payments\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`invoice_id\` INT UNSIGNED DEFAULT NULL,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`currency_code\` VARCHAR(10) DEFAULT 'USD',
      \`amount\` DECIMAL(12,2) NOT NULL,
      \`fx_rate\` DECIMAL(16,6) DEFAULT 1.000000,
      \`amount_base\` DECIMAL(12,2) DEFAULT NULL,
      \`method\` VARCHAR(50) DEFAULT 'cash',
      \`reference\` VARCHAR(100) NOT NULL UNIQUE,
      \`status\` VARCHAR(30) DEFAULT 'success',
      \`paid_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`received_by\` VARCHAR(50) NULL,
      \`reversal_of_id\` INT UNSIGNED DEFAULT NULL,
      INDEX \`idx_pay_inv\` (\`invoice_id\`),
      INDEX \`idx_pay_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`bank_statements\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`bank_account\` VARCHAR(100) NOT NULL,
      \`period_start\` DATE NULL,
      \`period_end\` DATE NULL,
      \`file_path\` VARCHAR(255) NULL,
      \`file_hash\` VARCHAR(64) NULL,
      \`imported_by\` VARCHAR(50) NULL,
      \`status\` VARCHAR(30) DEFAULT 'imported',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_bs_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`bank_statement_lines\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`statement_id\` INT UNSIGNED NOT NULL,
      \`value_date\` DATE NOT NULL,
      \`narrative\` TEXT NOT NULL,
      \`amount\` DECIMAL(12,2) NOT NULL,
      \`matched_payment_id\` INT UNSIGNED DEFAULT NULL,
      INDEX \`idx_bsl_stmt\` (\`statement_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Houses, Exeats & Boarding
    `CREATE TABLE IF NOT EXISTS \`houses\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`name\` VARCHAR(50) NOT NULL,
      \`motto\` VARCHAR(200) DEFAULT NULL,
      \`color\` VARCHAR(30) DEFAULT '#0d9488',
      INDEX \`idx_house_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`house_points\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`house_id\` INT UNSIGNED NOT NULL,
      \`event\` VARCHAR(100) NOT NULL,
      \`points\` INT NOT NULL,
      \`recorded_by\` VARCHAR(50) NULL,
      \`recorded_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_hp_house\` (\`house_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`exeats\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`requested_by\` VARCHAR(50) NOT NULL,
      \`reason\` TEXT NOT NULL,
      \`destination\` VARCHAR(200) NOT NULL,
      \`leave_from\` DATETIME NOT NULL,
      \`return_by\` DATETIME NOT NULL,
      \`status\` VARCHAR(30) DEFAULT 'pending',
      \`approved_by\` VARCHAR(50) DEFAULT NULL,
      \`guardian_notified\` TINYINT(1) DEFAULT 0,
      \`checked_out_at\` DATETIME DEFAULT NULL,
      \`checked_in_at\` DATETIME DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_exeat_school\` (\`school_id\`),
      INDEX \`idx_exeat_student\` (\`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`student_leadership\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`position\` VARCHAR(50) NOT NULL,
      \`scope\` VARCHAR(30) DEFAULT 'school',
      \`session_year\` INT DEFAULT 2026,
      \`appointed_by\` VARCHAR(50) NULL,
      INDEX \`idx_lead_student\` (\`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Counselling, Health & Discipline
    `CREATE TABLE IF NOT EXISTS \`counselling_sessions\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`counsellor_id\` VARCHAR(50) NOT NULL,
      \`session_date\` DATE NOT NULL,
      \`type\` VARCHAR(50) DEFAULT 'academic',
      \`outcome\` VARCHAR(50) DEFAULT 'ongoing',
      \`notes\` TEXT DEFAULT NULL,
      \`follow_up_date\` DATE DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_coun_student\` (\`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`documents\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`owner_type\` VARCHAR(50) NOT NULL,
      \`owner_id\` VARCHAR(50) NOT NULL,
      \`doc_type\` VARCHAR(50) NOT NULL,
      \`file_path\` VARCHAR(255) NOT NULL,
      \`title\` VARCHAR(200) NOT NULL,
      \`uploaded_by\` VARCHAR(50) NOT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`statutory_returns\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`return_type\` VARCHAR(50) NOT NULL,
      \`year\` INT UNSIGNED NOT NULL,
      \`term\` VARCHAR(20) DEFAULT NULL,
      \`payload\` JSON NULL,
      \`file_hash\` VARCHAR(64) NULL,
      \`status\` VARCHAR(30) DEFAULT 'submitted',
      \`submitted_by\` VARCHAR(50) NULL,
      \`submitted_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_sr_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  for (const sql of tables) {
    try {
      await conn.query(sql);
    } catch (e) {
      console.error('Error creating table:', e.message);
    }
  }

  console.log('✅ All tables successfully verified and created!');

  // Seed default Exam Boards
  await conn.query(`
    INSERT IGNORE INTO \`exam_boards\` (\`id\`, \`name\`, \`code\`, \`is_active\`) VALUES
    (1, 'ZIMSEC', 'ZIMSEC', 1),
    (2, 'Cambridge International', 'CAMBRIDGE', 1),
    (3, 'Other', 'OTHER', 1)
  `);

  // Seed default Currencies (USD & ZWG)
  await conn.query(`
    INSERT IGNORE INTO \`currencies\` (\`id\`, \`code\`, \`name\`, \`symbol\`, \`is_base\`, \`decimal_places\`) VALUES
    (1, 'USD', 'United States Dollar', '$', 1, 2),
    (2, 'ZWG', 'Zimbabwe Gold (ZiG)', 'ZiG', 0, 2)
  `);

  // Seed default Grading Scales
  await conn.query(`
    INSERT IGNORE INTO \`grading_scales\` (\`id\`, \`name\`, \`type\`, \`phases\`) VALUES
    (1, 'ZIMSEC_O', 'letter_points', '["ordinary"]'),
    (2, 'ZIMSEC_A', 'letter_points', '["advanced"]'),
    (3, 'PRIMARY_PCT', 'percentage', '["junior","infant"]'),
    (4, 'ECD_CHECKLIST', 'checklist', '["infant"]')
  `);

  // Seed default Houses for existing schools
  const [schools] = await conn.query('SELECT id FROM schools');
  for (const s of schools) {
    const defaultHouses = [
      { name: 'Kudu', motto: 'Strength in Unity', color: '#0d9488' },
      { name: 'Sable', motto: 'Excellence Always', color: '#3b82f6' },
      { name: 'Impala', motto: 'Swift and True', color: '#f59e0b' },
      { name: 'Buffalo', motto: 'Bold and Brave', color: '#ef4444' }
    ];
    for (const h of defaultHouses) {
      await conn.query(
        'INSERT IGNORE INTO houses (school_id, name, motto, color) SELECT ?, ?, ?, ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM houses WHERE school_id = ? AND name = ?)',
        [s.id, h.name, h.motto, h.color, s.id, h.name]
      );
    }

    // Default Academic Session
    await conn.query(
      'INSERT IGNORE INTO academic_sessions (school_id, year, name, start_date, end_date, is_current) SELECT ?, 2026, "Academic Year 2026", "2026-01-12", "2026-12-04", 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM academic_sessions WHERE school_id = ?)',
      [s.id, s.id]
    );

    // Default Terms
    const [sess] = await conn.query('SELECT id FROM academic_sessions WHERE school_id = ? AND is_current = 1 LIMIT 1', [s.id]);
    if (sess.length > 0) {
      const sessId = sess[0].id;
      const defaultTerms = [
        { name: 'term_1', start_date: '2026-01-12', end_date: '2026-04-03', is_current: 0 },
        { name: 'term_2', start_date: '2026-05-05', end_date: '2026-08-07', is_current: 0 },
        { name: 'term_3', start_date: '2026-09-08', end_date: '2026-12-04', is_current: 1 }
      ];
      for (const t of defaultTerms) {
        await conn.query(
          'INSERT IGNORE INTO terms (school_id, session_id, name, start_date, end_date, is_current) SELECT ?, ?, ?, ?, ?, ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM terms WHERE school_id = ? AND session_id = ? AND name = ?)',
          [s.id, sessId, t.name, t.start_date, t.end_date, t.is_current, s.id, sessId, t.name]
        );
      }
    }
  }

  console.log('✅ Baseline seed data successfully populated!');
  await conn.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
