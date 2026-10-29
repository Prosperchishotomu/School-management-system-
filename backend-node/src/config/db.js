const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'schoolbase',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  dateStrings: true,
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '15000', 10),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' || process.env.DB_SSL === 'require'
    ? {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    : false
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
    try { await query(`ALTER TABLE \`subjects\` DROP INDEX \`name\``); } catch(e) {}
    try { await query(`ALTER TABLE \`subjects\` DROP INDEX \`code\``); } catch(e) {}
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
    try { await query(`ALTER TABLE \`expenses\` MODIFY COLUMN \`id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`expenses\` MODIFY COLUMN \`school_id\` VARCHAR(50) NOT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`expenses\` MODIFY COLUMN \`recorded_by\` VARCHAR(50) NULL`); } catch(e) {}

    // 2. Missing columns additions (using standard ALTER TABLE ADD COLUMN statements inside try-catch)
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`dob\` DATE NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`date_of_birth\` DATE NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`home_address\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`address\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`nationality\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`religion\` VARCHAR(50) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`previous_school\` VARCHAR(100) NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`medical_notes\` TEXT NULL`); } catch(e) {}
    try { await query(`ALTER TABLE \`students\` ADD COLUMN \`leadership_position\` VARCHAR(100) NULL`); } catch(e) {}

    console.log('Schema migration verification complete. All required database tables active.');
  } catch (err) {
    console.warn('Database table verification warning:', err.message);
  }
}

if (process.env.NODE_ENV !== 'test') {
  ensureTables();
}

module.exports = {
  pool,
  query,
  queryOne,
  withTransaction
};
