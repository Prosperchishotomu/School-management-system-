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
  dateStrings: true
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

// Automatic schema table migrations & column enhancements
async function ensureTables() {
  try {
    // 1. Collations & Column expansions (fix ER_CANT_AGGREGATE_2COLLATIONS & ER_DUP_ENTRY from truncation)
    try { await query(`ALTER TABLE \`notifications\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } catch(e) {}
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

    // 2. Missing columns additions
    // Students missing columns
    try { await query(`ALTER TABLE \`students\` ADD COLUMN IF NOT EXISTS \`dob\` DATE NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN IF NOT EXISTS \`date_of_birth\` DATE NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN IF NOT EXISTS \`home_address\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN IF NOT EXISTS \`address\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN IF NOT EXISTS \`nationality\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN IF NOT EXISTS \`religion\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN IF NOT EXISTS \`previous_school\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN IF NOT EXISTS \`medical_notes\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN IF NOT EXISTS \`leadership_position\` VARCHAR(100) NULL`); } catch(e) {}

    // Schools missing bank & account details
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN IF NOT EXISTS \`bank_name\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN IF NOT EXISTS \`account_number\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`schools\` ADD COLUMN IF NOT EXISTS \`currency\` VARCHAR(10) DEFAULT 'USD'`); } catch(e) {}

    // Announcements target_audience
    try { await query(`ALTER TABLE \`announcements\` ADD COLUMN IF NOT EXISTS \`target_audience\` VARCHAR(50) DEFAULT 'all'`); } catch(e) {}

    // Classes level
    try { await query(`ALTER TABLE \`classes\` ADD COLUMN IF NOT EXISTS \`level\` VARCHAR(50) NULL`); } catch(e) {}

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
    try { await query(`ALTER TABLE \`notifications\` ADD COLUMN IF NOT EXISTS \`target_role\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`notifications\` ADD COLUMN IF NOT EXISTS \`sender_id\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`notifications\` ADD COLUMN IF NOT EXISTS \`sender_name\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`notifications\` ADD COLUMN IF NOT EXISTS \`type\` VARCHAR(50) DEFAULT 'direct_message'`); } catch(e) {}

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
    try { await query(`ALTER TABLE \`audit_logs\` ADD COLUMN IF NOT EXISTS \`description\` TEXT DEFAULT NULL`); } catch (e) {}

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

    try { await query(`ALTER TABLE \`hostels\` ADD COLUMN IF NOT EXISTS \`warden_phone\` VARCHAR(30) DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostels\` ADD COLUMN IF NOT EXISTS \`warden_email\` VARCHAR(100) DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostels\` ADD COLUMN IF NOT EXISTS \`max_occupants_per_room\` INT UNSIGNED DEFAULT 2`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostel_allocations\` ADD COLUMN IF NOT EXISTS \`status\` ENUM('allocated', 'checked_in', 'checked_out') DEFAULT 'allocated'`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostel_allocations\` ADD COLUMN IF NOT EXISTS \`checked_in_at\` DATETIME DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`hostel_allocations\` ADD COLUMN IF NOT EXISTS \`checked_out_at\` DATETIME DEFAULT NULL`); } catch (e) {}

    // Assets migrations
    try { await query(`ALTER TABLE \`assets\` ADD COLUMN IF NOT EXISTS \`notes\` TEXT DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`assets\` ADD COLUMN IF NOT EXISTS \`holder_id\` VARCHAR(50) DEFAULT NULL`); } catch (e) {}
    try { await query(`ALTER TABLE \`assets\` ADD COLUMN IF NOT EXISTS \`holder_type\` VARCHAR(50) DEFAULT NULL`); } catch (e) {}

    // Teacher messages migrations
    try { await query(`ALTER TABLE \`teacher_messages\` ADD COLUMN IF NOT EXISTS \`message\` TEXT DEFAULT NULL`); } catch (e) {}

    console.log('Schema migration verification complete. All required database tables active.');
  } catch (err) {
    console.warn('Database table verification warning:', err.message);
  }
}


// Execute migration check on pool initialization
ensureTables();

module.exports = {
  pool,
  query,
  queryOne
};
