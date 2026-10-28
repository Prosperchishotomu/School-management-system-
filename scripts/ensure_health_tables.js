const pool = require('../backend-node/src/config/db');

async function main() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_profiles (
        id VARCHAR(50) PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        allergies TEXT,
        chronic_conditions TEXT,
        medications TEXT,
        emergency_contact_name VARCHAR(100),
        emergency_contact_phone VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_health_profiles_student (student_id),
        INDEX idx_health_profiles_school (school_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_visits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        visit_date DATE NOT NULL,
        symptoms TEXT NOT NULL,
        diagnosis TEXT,
        treatment TEXT,
        medication_given TEXT,
        referred_to_hospital TINYINT(1) DEFAULT 0,
        notes TEXT,
        recorded_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_health_visits_student (student_id),
        INDEX idx_health_visits_school (school_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS counselling_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        counsellor_user_id VARCHAR(50) NOT NULL,
        session_date DATE NOT NULL,
        issue_category VARCHAR(100),
        notes TEXT,
        follow_up_needed TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_counselling_student (student_id),
        INDEX idx_counselling_school (school_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('Health and counselling tables created/ensured successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create health tables:', err);
    process.exit(1);
  }
}

main();
