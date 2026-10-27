const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'schoolbase',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  dateStrings: true,
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '15000', 10)
});

// Helper for executing queries with parameters
async function query(sql, params = []) {
  const [results] = await pool.execute(sql, params);
  return results;
}

// Helper for running single item queries
async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}

async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tx = {
      query: async (sql, params = []) => {
        const [rows] = await connection.execute(sql, params);
        return rows;
      },
      queryOne: async (sql, params = []) => {
        const [rows] = await connection.execute(sql, params);
        return rows.length ? rows[0] : null;
      }
    };
    const result = await work(tx);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

// Automatic schema table migrations & column enhancements
async function ensureTables() {
  try {
    // 1. Collations & Column expansions (fix ER_CANT_AGGREGATE_2COLLATIONS & ER_DUP_ENTRY from truncation)
    try { await query(`ALTER TABLE \`notifications\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } catch(e) {}
    try { await query(`ALTER TABLE \`subjects\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`classes\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`timetable\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`timetable\` MODIFY COLUMN \`school_id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`timetable\` MODIFY COLUMN \`class_id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grades\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grades\` MODIFY COLUMN \`school_id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grades\` MODIFY COLUMN \`student_id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grades\` MODIFY COLUMN \`class_id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`announcements\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`announcements\` MODIFY COLUMN \`created_by\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` MODIFY COLUMN \`class_id\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`audit_logs\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`audit_logs\` DROP FOREIGN KEY \`audit_logs_ibfk_2\``); } catch(e) {}
    try { await query(`ALTER TABLE \`users\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`users\` MODIFY COLUMN \`school_id\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`users\` ADD COLUMN \`student_id\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`users\` ADD COLUMN \`name\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`staff\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`staff\` MODIFY COLUMN \`school_id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`staff\` MODIFY COLUMN \`user_id\` VARCHAR(50) NULL`); } catch(e) {}

    // 2. Missing columns additions (using standard ALTER TABLE ADD COLUMN statements inside try-catch)
    // Students missing columns
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`dob\` DATE NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`date_of_birth\` DATE NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`home_address\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`address\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`nationality\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`religion\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`previous_school\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`medical_notes\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`leadership_position\` VARCHAR(100) NULL`); } catch(e) {}

    // Staff table creation & missing qualification/experience columns
    await query(`
      CREATE TABLE IF NOT EXISTS \`staff\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`user_id\` VARCHAR(50) DEFAULT NULL,
        \`class_id\` VARCHAR(50) DEFAULT NULL,
        \`name\` VARCHAR(100) NOT NULL,
        \`email\` VARCHAR(100) DEFAULT NULL,
        \`phone\` VARCHAR(50) DEFAULT NULL,
        \`role_title\` VARCHAR(100) DEFAULT 'Teacher',
        \`qualification\` VARCHAR(255) NULL,
        \`experience_years\` INT NULL,
        \`ec_number\` VARCHAR(50) NULL,
        \`employment_type\` VARCHAR(50) DEFAULT 'permanent',
        \`status\` VARCHAR(20) DEFAULT 'active',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_staff_school\` (\`school_id\`),
        INDEX \`idx_staff_user\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try { await query(`ALTER TABLE \`staff\` ADD COLUMN \`qualification\` VARCHAR(255) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`staff\` ADD COLUMN \`experience_years\` INT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`staff\` ADD COLUMN \`ec_number\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`staff\` ADD COLUMN \`employment_type\` VARCHAR(50) DEFAULT 'permanent'`); } catch(e) {}

    // Schools missing bank & account details
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN \`bank_name\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN \`account_number\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN \`currency\` VARCHAR(10) DEFAULT 'USD'`); } catch(e) {}
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN \`code\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN \`enabled_modules\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`timetable\` ADD COLUMN \`teacher_id\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`classes\` MODIFY \`capacity\` INT UNSIGNED NULL DEFAULT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`subjects\` MODIFY \`code\` VARCHAR(50) NULL DEFAULT NULL`); } catch(e) {}

    // Enquiries pipeline table
    await query(`
      CREATE TABLE IF NOT EXISTS \`enquiries\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`parent_name\` VARCHAR(100) NOT NULL,
        \`student_name\` VARCHAR(100) DEFAULT NULL,
        \`contact_phone\` VARCHAR(50) NOT NULL,
        \`contact_email\` VARCHAR(100) DEFAULT NULL,
        \`grade_applying\` VARCHAR(50) DEFAULT NULL,
        \`message\` TEXT DEFAULT NULL,
        \`status\` VARCHAR(50) DEFAULT 'pending',
        \`admin_notes\` TEXT DEFAULT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_enquiries_school\` (\`school_id\`),
        INDEX \`idx_enquiries_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Remote Payments & Offline Declarations
    await query(`
      CREATE TABLE IF NOT EXISTS \`remote_payments\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`fee_id\` VARCHAR(50) DEFAULT NULL,
        \`student_id\` VARCHAR(50) DEFAULT NULL,
        \`amount\` DECIMAL(12,2) NOT NULL,
        \`amount_paid\` DECIMAL(12,2) DEFAULT NULL,
        \`currency\` VARCHAR(10) DEFAULT 'USD',
        \`payment_method\` VARCHAR(50) DEFAULT 'cash',
        \`reference\` VARCHAR(100) DEFAULT NULL,
        \`phone_number\` VARCHAR(50) DEFAULT NULL,
        \`cashier_name\` VARCHAR(100) DEFAULT NULL,
        \`notes\` TEXT DEFAULT NULL,
        \`status\` VARCHAR(20) DEFAULT 'pending',
        \`verified_at\` DATETIME DEFAULT NULL,
        \`verified_by\` VARCHAR(50) DEFAULT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_rp_school\` (\`school_id\`),
        INDEX \`idx_rp_student\` (\`student_id\`),
        INDEX \`idx_rp_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try { await query(`ALTER TABLE \`remote_payments\` ADD COLUMN \`cashier_name\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`remote_payments\` ADD COLUMN \`notes\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`remote_payments\` ADD COLUMN \`amount_paid\` DECIMAL(12,2) NULL`); } catch(e) {}

    // Simplified Fees table for fast billing & declaration matching
    await query(`
      CREATE TABLE IF NOT EXISTS \`fees\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`student_id\` VARCHAR(50) NOT NULL,
        \`term\` VARCHAR(50) DEFAULT 'Term 1',
        \`amount_due\` DECIMAL(12,2) DEFAULT 0.00,
        \`amount_paid\` DECIMAL(12,2) DEFAULT 0.00,
        \`status\` VARCHAR(20) DEFAULT 'unpaid',
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_fees_school\` (\`school_id\`),
        INDEX \`idx_fees_student\` (\`student_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try { await query(`ALTER TABLE \`fees\` ADD COLUMN \`amount_due\` DECIMAL(12,2) DEFAULT 0.00`); } catch(e) {}
    try { await query(`ALTER TABLE \`fees\` ADD COLUMN \`amount_paid\` DECIMAL(12,2) DEFAULT 0.00`); } catch(e) {}

    // Announcements target_audience
    try { await query(`ALTER TABLE \`announcements\` ADD COLUMN \`target_audience\` VARCHAR(50) DEFAULT 'all'`); } catch(e) {}

    // Classes level & capacity
    try { await query(`ALTER TABLE \`classes\` ADD COLUMN \`level\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`classes\` ADD COLUMN \`capacity\` INT UNSIGNED DEFAULT 40`); } catch(e) {}

    // Users phone column
    try { await query(`ALTER TABLE \`users\` ADD COLUMN \`phone\` VARCHAR(30) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`users\` ADD COLUMN \`role\` VARCHAR(50) NULL`); } catch(e) {}
    try {
      await query(`UPDATE users u INNER JOIN user_roles ur ON ur.user_id = u.id INNER JOIN roles r ON r.id = ur.role_id SET u.role = r.name WHERE u.role IS NULL`);
    } catch(e) {}

    // Schools boarding capability
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN \`is_boarding\` TINYINT(1) DEFAULT 1`); } catch(e) {}
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN \`boarding_type\` VARCHAR(50) DEFAULT 'boarding'`); } catch(e) {}

    // Leave requests student and chat/attachment additions
    try { await query(`ALTER TABLE \`leave_requests\` ADD COLUMN \`student_id\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`leave_requests\` ADD COLUMN \`attachment_url\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`leave_requests\` ADD COLUMN \`audio_url\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`leave_requests\` ADD COLUMN \`chat_thread\` JSON NULL`); } catch(e) {}

    // Messages attachments & voice notes
    try { await query(`ALTER TABLE \`messages\` ADD COLUMN \`attachment_url\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`messages\` ADD COLUMN \`attachment_type\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`messages\` ADD COLUMN \`audio_url\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`messages\` ADD COLUMN \`audio_duration\` INT NULL`); } catch(e) {}

    // Grade thresholds schema & multi-version column compatibility
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS \`grade_thresholds\` (
          \`id\` VARCHAR(50) PRIMARY KEY,
          \`school_id\` VARCHAR(50) NOT NULL,
          \`grade\` VARCHAR(10) NULL,
          \`grade_symbol\` VARCHAR(10) NULL,
          \`label\` VARCHAR(50) NULL,
          \`min_score\` DECIMAL(5,2) NULL,
          \`max_score\` DECIMAL(5,2) NULL,
          \`min_mark\` DECIMAL(5,2) NULL,
          \`max_mark\` DECIMAL(5,2) NULL,
          \`points\` INT NULL,
          \`color\` VARCHAR(20) NULL,
          \`is_pass\` TINYINT(1) DEFAULT 1,
          INDEX \`idx_gt_school\` (\`school_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` MODIFY COLUMN \`school_id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`grade\` VARCHAR(10) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`grade_symbol\` VARCHAR(10) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`label\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`min_score\` DECIMAL(5,2) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`max_score\` DECIMAL(5,2) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`min_mark\` DECIMAL(5,2) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`max_mark\` DECIMAL(5,2) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`points\` INT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`color\` VARCHAR(20) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`grade_thresholds\` ADD COLUMN \`is_pass\` TINYINT(1) DEFAULT 1`); } catch(e) {}
    try {
      await query(`UPDATE \`grade_thresholds\` SET \`grade\` = \`grade_symbol\` WHERE \`grade\` IS NULL AND \`grade_symbol\` IS NOT NULL`);
      await query(`UPDATE \`grade_thresholds\` SET \`grade_symbol\` = \`grade\` WHERE \`grade_symbol\` IS NULL AND \`grade\` IS NOT NULL`);
      await query(`UPDATE \`grade_thresholds\` SET \`min_score\` = \`min_mark\` WHERE \`min_score\` IS NULL AND \`min_mark\` IS NOT NULL`);
      await query(`UPDATE \`grade_thresholds\` SET \`min_mark\` = \`min_score\` WHERE \`min_mark\` IS NULL AND \`min_score\` IS NOT NULL`);
      await query(`UPDATE \`grade_thresholds\` SET \`max_score\` = \`max_mark\` WHERE \`max_score\` IS NULL AND \`max_mark\` IS NOT NULL`);
      await query(`UPDATE \`grade_thresholds\` SET \`max_mark\` = \`max_score\` WHERE \`max_mark\` IS NULL AND \`max_score\` IS NOT NULL`);
    } catch(e) {}
    await query(`
      CREATE TABLE IF NOT EXISTS \`idempotency_keys\` (
        \`id\` CHAR(36) PRIMARY KEY,
        \`scope\` VARCHAR(160) NOT NULL,
        \`idempotency_key\` VARCHAR(200) NOT NULL,
        \`status_code\` SMALLINT UNSIGNED NOT NULL,
        \`response_body\` JSON NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_idempotency_scope_key\` (\`scope\`, \`idempotency_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS \`attendance_submissions\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`class_id\` VARCHAR(50) NOT NULL,
        \`date\` DATE NOT NULL,
        \`session\` VARCHAR(20) DEFAULT 'full_day',
        \`submitted_by\` VARCHAR(50) NOT NULL,
        \`teacher_name\` VARCHAR(100) DEFAULT NULL,
        \`submitted_to\` VARCHAR(50) DEFAULT 'admin',
        \`status\` VARCHAR(30) DEFAULT 'submitted',
        \`verified_by\` VARCHAR(50) DEFAULT NULL,
        \`verified_at\` DATETIME DEFAULT NULL,
        \`notes\` TEXT DEFAULT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_att_sub_class_date_sess\` (\`school_id\`, \`class_id\`, \`date\`, \`session\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Authentication persistence. These tables are required by login, rotation,
    // logout-all, and password reset; keeping them in the runtime migration path
    // prevents a fresh installation from silently losing session security.
    await query(`
      CREATE TABLE IF NOT EXISTS \`refresh_tokens\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`user_id\` VARCHAR(50) NOT NULL,
        \`token_hash\` CHAR(64) NOT NULL UNIQUE,
        \`family_id\` VARCHAR(64) NOT NULL,
        \`expires_at\` DATETIME NOT NULL,
        \`revoked_at\` DATETIME NULL,
        \`replaced_by_id\` VARCHAR(50) NULL,
        \`ip\` VARCHAR(64) NULL,
        \`user_agent\` VARCHAR(255) NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_refresh_user\` (\`user_id\`),
        INDEX \`idx_refresh_family\` (\`family_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`user_id\` VARCHAR(50) NOT NULL,
        \`token_hash\` CHAR(64) NOT NULL UNIQUE,
        \`expires_at\` DATETIME NOT NULL,
        \`used\` TINYINT(1) DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_reset_user\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // First-class communication model. Notifications remain useful for alerts,
    // while conversations/messages provide an auditable threaded workflow.
    await query(`
      CREATE TABLE IF NOT EXISTS \`conversations\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`subject\` VARCHAR(200) NOT NULL,
        \`created_by\` VARCHAR(50) NOT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_conversations_school\` (\`school_id\`, \`updated_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS \`conversation_participants\` (
        \`conversation_id\` VARCHAR(50) NOT NULL,
        \`user_id\` VARCHAR(50) NOT NULL,
        \`last_read_at\` DATETIME NULL,
        \`joined_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`conversation_id\`, \`user_id\`),
        INDEX \`idx_conversation_participant_user\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS \`messages\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`conversation_id\` VARCHAR(50) NOT NULL,
        \`sender_id\` VARCHAR(50) NOT NULL,
        \`body\` TEXT NOT NULL,
        \`sent_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`edited_at\` DATETIME NULL,
        \`deleted_at\` DATETIME NULL,
        INDEX \`idx_messages_conversation\` (\`conversation_id\`, \`sent_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS \`delivery_outbox\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`recipient_id\` VARCHAR(50) NOT NULL,
        \`channel\` VARCHAR(20) NOT NULL,
        \`event_type\` VARCHAR(50) NOT NULL,
        \`reference_id\` VARCHAR(50) NOT NULL,
        \`payload\` JSON NOT NULL,
        \`status\` VARCHAR(20) DEFAULT 'queued',
        \`attempts\` INT UNSIGNED DEFAULT 0,
        \`last_error\` VARCHAR(500) NULL,
        \`available_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`sent_at\` DATETIME NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_delivery_status\` (\`status\`, \`available_at\`),
        UNIQUE KEY \`uq_delivery_reference_channel\` (\`reference_id\`, \`channel\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Approval compatibility for the canonical schema and the existing route
    // contract. Both names are retained during migration so old records remain
    // readable while all new writes can be audited consistently.
    await query(`
      CREATE TABLE IF NOT EXISTS \`approvals\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`uuid\` VARCHAR(50) NOT NULL UNIQUE,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`entity_type\` VARCHAR(50) NOT NULL,
        \`entity_id\` VARCHAR(50) NOT NULL,
        \`action\` VARCHAR(50) NOT NULL,
        \`action_type\` VARCHAR(50) NOT NULL,
        \`payload\` JSON NULL,
        \`requested_by\` VARCHAR(50) NOT NULL,
        \`approved_by\` VARCHAR(50) NULL,
        \`status\` VARCHAR(20) DEFAULT 'pending',
        \`rejection_reason\` VARCHAR(500) NULL,
        \`requested_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`decided_at\` DATETIME NULL,
        \`processed_at\` DATETIME NULL,
        INDEX \`idx_approvals_school_status\` (\`school_id\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try { await query(`ALTER TABLE \`approvals\` ADD COLUMN \`uuid\` VARCHAR(50) NULL`); } catch (_) {}
    try { await query(`ALTER TABLE \`approvals\` ADD COLUMN \`action_type\` VARCHAR(50) NULL`); } catch (_) {}
    try { await query(`ALTER TABLE \`approvals\` ADD COLUMN \`rejection_reason\` VARCHAR(500) NULL`); } catch (_) {}
    try { await query(`ALTER TABLE \`approvals\` ADD COLUMN \`requested_at\` DATETIME NULL`); } catch (_) {}
    try { await query(`ALTER TABLE \`approvals\` ADD COLUMN \`created_at\` DATETIME NULL`); } catch (_) {}
    try { await query(`ALTER TABLE \`approvals\` ADD COLUMN \`decided_at\` DATETIME NULL`); } catch (_) {}
    try { await query(`ALTER TABLE \`approvals\` ADD COLUMN \`processed_at\` DATETIME NULL`); } catch (_) {}
    try { await query(`ALTER TABLE \`approvals\` MODIFY COLUMN \`action\` VARCHAR(50) NULL`); } catch (_) {}
    try { await query(`ALTER TABLE \`approvals\` MODIFY COLUMN \`uuid\` VARCHAR(50) NULL`); } catch (_) {}
    try { await query(`UPDATE approvals SET action_type = action WHERE action_type IS NULL`); } catch (_) {}
    try { await query(`UPDATE approvals SET action = action_type WHERE action IS NULL`); } catch (_) {}

    await query(`
      CREATE TABLE IF NOT EXISTS \`result_publications\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`class_id\` VARCHAR(50) NOT NULL,
        \`term\` VARCHAR(50) NOT NULL,
        \`status\` VARCHAR(20) DEFAULT 'draft',
        \`published_by\` VARCHAR(50) NULL,
        \`published_at\` DATETIME NULL,
        \`release_at\` DATETIME NULL,
        \`released_by\` VARCHAR(50) NULL,
        UNIQUE KEY \`uq_result_publication\` (\`school_id\`, \`class_id\`, \`term\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Discipline incidents — widen status to include 'resolved'
    try { await query(`ALTER TABLE \`discipline_incidents\` MODIFY COLUMN \`status\` ENUM('open','investigating','resolved','closed','dismissed') DEFAULT 'open'`); } catch(e) {}

    // Notifications fields
    await query(`
      CREATE TABLE IF NOT EXISTS \`notifications\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) DEFAULT NULL,
        \`user_id\` VARCHAR(50) DEFAULT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`is_read\` TINYINT(1) DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try { await query(`ALTER TABLE \`notifications\` ADD COLUMN \`target_role\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`notifications\` ADD COLUMN \`sender_id\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`notifications\` ADD COLUMN \`sender_name\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`notifications\` ADD COLUMN \`type\` VARCHAR(50) DEFAULT 'direct_message'`); } catch(e) {}

    // Licenses table
    await query(`
      CREATE TABLE IF NOT EXISTS \`licenses\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`plan\` VARCHAR(50) DEFAULT 'standard',
        \`status\` VARCHAR(20) DEFAULT 'active',
        \`issued_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`expires_at\` DATETIME NOT NULL,
        \`max_students\` INT UNSIGNED DEFAULT 500,
        \`notes\` TEXT DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Audit logs
    await query(`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) DEFAULT NULL,
        \`user_id\` VARCHAR(50) DEFAULT NULL,
        \`action\` VARCHAR(100) NOT NULL,
        \`entity_type\` VARCHAR(100) DEFAULT NULL,
        \`entity_id\` VARCHAR(100) DEFAULT NULL,
        \`description\` TEXT DEFAULT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try { await query(`ALTER TABLE \`audit_logs\` ADD COLUMN \`description\` TEXT DEFAULT NULL`); } catch (e) {}

    // Hostel migrations & tables
    await query(`
      CREATE TABLE IF NOT EXISTS \`hostel_applications\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) NOT NULL,
        \`student_id\` VARCHAR(50) NOT NULL,
        \`guardian_id\` VARCHAR(50) DEFAULT NULL,
        \`hostel_id\` VARCHAR(50) DEFAULT NULL,
        \`status\` ENUM('pending', 'approved', 'rejected', 'allocated') DEFAULT 'pending',
        \`notes\` TEXT DEFAULT NULL,
        \`applied_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    try { await query(`ALTER TABLE \`hostels\` ADD COLUMN \`warden_phone\` VARCHAR(30) DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostels\` ADD COLUMN \`warden_email\` VARCHAR(100) DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostels\` ADD COLUMN \`max_occupants_per_room\` INT UNSIGNED DEFAULT 2`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostel_allocations\` ADD COLUMN \`status\` ENUM('allocated', 'checked_in', 'checked_out') DEFAULT 'allocated'`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostel_allocations\` ADD COLUMN \`checked_in_at\` DATETIME DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostel_allocations\` ADD COLUMN \`checked_out_at\` DATETIME DEFAULT NULL`); } catch (e) {}

    // Assets migrations
    try { await query(`ALTER TABLE \`assets\` ADD COLUMN \`notes\` TEXT DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`assets\` ADD COLUMN \`holder_id\` VARCHAR(50) DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`assets\` ADD COLUMN \`holder_type\` VARCHAR(50) DEFAULT NULL`); } catch (e) {}

    // Teacher messages migrations
    try { await query(`ALTER TABLE \`teacher_messages\` ADD COLUMN \`message\` TEXT DEFAULT NULL`); } catch (e) {}

    // Offline-safe attendance/marks synchronization metadata.
    try { await query(`ALTER TABLE \`attendance\` ADD COLUMN \`client_uuid\` CHAR(36) NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`attendance\` ADD COLUMN \`session\` VARCHAR(20) NOT NULL DEFAULT 'full_day'`); } catch (e) {}
    try { await query(`ALTER TABLE \`attendance\` ADD COLUMN \`version\` INT UNSIGNED NOT NULL DEFAULT 1`); } catch (e) {}
    try { await query(`ALTER TABLE \`attendance\` ADD COLUMN \`synced_at\` DATETIME NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`grades\` ADD COLUMN \`client_uuid\` CHAR(36) NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`grades\` ADD COLUMN \`version\` INT UNSIGNED NOT NULL DEFAULT 1`); } catch (e) {}
    try { await query(`ALTER TABLE \`grades\` ADD COLUMN \`synced_at\` DATETIME NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`fee_payments\` ADD COLUMN \`requested_amount\` DECIMAL(12,2) NULL`); } catch (e) {}

    // Zimbabwe Pathway Modules (ZIMSEC, Academic sessions, Schemes, Multi-Currency, Boarding, EMIS)
    await query(`CREATE TABLE IF NOT EXISTS \`academic_sessions\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`terms\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`departments\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`head_employee_id\` INT UNSIGNED DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_dept_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`employees\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`exam_boards\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(50) NOT NULL UNIQUE,
      \`code\` VARCHAR(20) NOT NULL UNIQUE,
      \`is_active\` TINYINT(1) DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`grading_scales\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(50) NOT NULL UNIQUE,
      \`type\` VARCHAR(30) NOT NULL,
      \`phases\` JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`grade_ranges\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`scale_id\` INT UNSIGNED NOT NULL,
      \`grade\` VARCHAR(10) NOT NULL,
      \`min_pct\` DECIMAL(5,2) NOT NULL,
      \`max_pct\` DECIMAL(5,2) NOT NULL,
      \`points\` TINYINT DEFAULT NULL,
      \`remark\` VARCHAR(100) DEFAULT NULL,
      \`is_pass\` TINYINT(1) DEFAULT 1,
      INDEX \`idx_grade_scale\` (\`scale_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`class_subjects\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`class_id\` VARCHAR(50) NOT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`teacher_id\` VARCHAR(50) DEFAULT NULL,
      \`is_active\` TINYINT(1) DEFAULT 1,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_cs_class\` (\`class_id\`),
      INDEX \`idx_cs_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`teaching_assignments\` (
      \`id\` VARCHAR(50) PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`teacher_id\` VARCHAR(50) NOT NULL,
      \`class_id\` VARCHAR(50) NOT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`uq_ta_school_tch_cls_sbj\` (\`school_id\`, \`teacher_id\`, \`class_id\`, \`subject_id\`),
      INDEX \`idx_ta_teacher\` (\`teacher_id\`),
      INDEX \`idx_ta_class\` (\`class_id\`),
      INDEX \`idx_ta_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`student_subjects\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`class_id\` VARCHAR(50) DEFAULT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`status\` VARCHAR(20) DEFAULT 'active',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`uq_st_sub_school\` (\`school_id\`, \`student_id\`, \`subject_id\`),
      INDEX \`idx_ss_student\` (\`student_id\`),
      INDEX \`idx_ss_class\` (\`class_id\`),
      INDEX \`idx_ss_subject\` (\`subject_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`enrollments\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`promotion_rules\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`from_class_id\` VARCHAR(50) NOT NULL,
      \`to_class_id\` VARCHAR(50) DEFAULT NULL,
      \`required_passes\` INT DEFAULT 5,
      \`mandatory_subject_ids\` JSON DEFAULT NULL,
      \`min_average_pct\` DECIMAL(5,2) DEFAULT 50.00,
      \`is_active\` TINYINT(1) DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`exam_entries\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`exam_entry_candidates\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`entry_id\` INT UNSIGNED NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`candidate_no\` VARCHAR(20) DEFAULT NULL,
      \`center_no\` VARCHAR(30) DEFAULT NULL,
      \`status\` VARCHAR(30) DEFAULT 'draft',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_eec_entry\` (\`entry_id\`),
      INDEX \`idx_eec_student\` (\`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`exam_entry_subjects\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`candidate_id\` INT UNSIGNED NOT NULL,
      \`subject_id\` VARCHAR(50) NOT NULL,
      \`option_code\` VARCHAR(20) DEFAULT NULL,
      \`paper_codes\` VARCHAR(100) DEFAULT NULL,
      \`sba_mark\` DECIMAL(5,2) DEFAULT NULL,
      \`sba_submitted_at\` DATETIME DEFAULT NULL,
      INDEX \`idx_ees_cand\` (\`candidate_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`entry_results\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`schemes_of_work\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`lesson_plans\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`currencies\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`code\` VARCHAR(10) NOT NULL UNIQUE,
      \`name\` VARCHAR(60) NOT NULL,
      \`symbol\` VARCHAR(10) NOT NULL,
      \`is_base\` TINYINT(1) DEFAULT 0,
      \`decimal_places\` TINYINT DEFAULT 2
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`exchange_rates\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`from_currency\` VARCHAR(10) NOT NULL,
      \`to_currency\` VARCHAR(10) NOT NULL,
      \`rate\` DECIMAL(16,6) NOT NULL,
      \`effective_from\` DATETIME NOT NULL,
      \`created_by\` VARCHAR(50) NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_fx_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`fee_structures\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`session_id\` INT UNSIGNED DEFAULT NULL,
      \`class_id\` VARCHAR(50) DEFAULT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`currency_code\` VARCHAR(10) DEFAULT 'USD',
      \`status\` VARCHAR(30) DEFAULT 'draft',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_fs_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`fee_items\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`fee_structure_id\` INT UNSIGNED NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`amount\` DECIMAL(12,2) NOT NULL,
      \`frequency\` VARCHAR(30) DEFAULT 'per_term',
      INDEX \`idx_fi_struct\` (\`fee_structure_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`invoices\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`invoice_items\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`invoice_id\` INT UNSIGNED NOT NULL,
      \`description\` VARCHAR(200) NOT NULL,
      \`amount\` DECIMAL(12,2) NOT NULL,
      INDEX \`idx_ii_inv\` (\`invoice_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`payments\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`bank_statements\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`bank_statement_lines\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`statement_id\` INT UNSIGNED NOT NULL,
      \`value_date\` DATE NOT NULL,
      \`narrative\` TEXT NOT NULL,
      \`amount\` DECIMAL(12,2) NOT NULL,
      \`matched_payment_id\` INT UNSIGNED DEFAULT NULL,
      INDEX \`idx_bsl_stmt\` (\`statement_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`houses\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`name\` VARCHAR(50) NOT NULL,
      \`motto\` VARCHAR(200) DEFAULT NULL,
      \`color\` VARCHAR(30) DEFAULT '#0d9488',
      INDEX \`idx_house_school\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`house_points\` (
      \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      \`house_id\` INT UNSIGNED NOT NULL,
      \`event\` VARCHAR(100) NOT NULL,
      \`points\` INT NOT NULL,
      \`recorded_by\` VARCHAR(50) NULL,
      \`recorded_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_hp_house\` (\`house_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`exeats\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`statutory_returns\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Legacy and route compatibility for fees & fee_payments tables
    await query(`CREATE TABLE IF NOT EXISTS \`fees\` (
      \`id\` VARCHAR(50) PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`title\` VARCHAR(150) NOT NULL DEFAULT 'Term Fees',
      \`amount_due\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`amount_paid\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`term\` VARCHAR(20) DEFAULT 'Term 1',
      \`due_date\` DATE NULL,
      \`status\` VARCHAR(30) DEFAULT 'unpaid',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_fees_school\` (\`school_id\`),
      INDEX \`idx_fees_student\` (\`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await query(`CREATE TABLE IF NOT EXISTS \`fee_payments\` (
      \`id\` VARCHAR(50) PRIMARY KEY,
      \`school_id\` VARCHAR(50) NOT NULL,
      \`fee_id\` VARCHAR(50) NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`amount_paid\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`amount\` DECIMAL(12,2) DEFAULT NULL,
      \`payment_method\` VARCHAR(50) DEFAULT 'cash',
      \`reference\` VARCHAR(100) NULL,
      \`idempotency_key\` VARCHAR(100) NULL,
      \`payment_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`created_by\` VARCHAR(50) NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_fp_school\` (\`school_id\`),
      INDEX \`idx_fp_student\` (\`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    try { await query(`ALTER TABLE \`fee_payments\` ADD COLUMN \`amount\` DECIMAL(12,2) NULL`); } catch(e) {}
    try { await query(`UPDATE fee_payments SET amount = amount_paid WHERE amount IS NULL`); } catch(e) {}

    console.log('Schema migration verification complete. All required database tables active.');
  } catch (err) {
    console.warn('Database table verification warning:', err.message);
  }
}


// Execute migration check on pool initialization
if (process.env.NODE_ENV !== 'test') {
  ensureTables();
}

module.exports = {
  pool,
  query,
  queryOne,
  withTransaction
};
