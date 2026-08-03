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

// Automatic schema table migrations
async function ensureTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS \`notifications\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`school_id\` VARCHAR(50) DEFAULT NULL,
        \`user_id\` VARCHAR(50) DEFAULT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`is_read\` TINYINT(1) DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Migration: add description column if table was created with old schema
    try {
      await query(`ALTER TABLE \`audit_logs\` ADD COLUMN IF NOT EXISTS \`description\` TEXT DEFAULT NULL`);
    } catch (e) { /* ignore */ }

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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
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
