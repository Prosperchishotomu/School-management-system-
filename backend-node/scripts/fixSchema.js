const { query } = require('../src/config/db');

async function runSchemaFixes() {
  console.log('Starting Database Schema Normalization & Constraint Widening...');

  const statements = [
    // 1. Classes
    "ALTER TABLE `classes` MODIFY `grade_level` VARCHAR(50) NULL DEFAULT 'Primary'",
    "ALTER TABLE `classes` MODIFY `level` VARCHAR(50) NULL DEFAULT 'Primary'",
    "ALTER TABLE `classes` ADD COLUMN `status` ENUM('active','inactive') DEFAULT 'active'",

    // 2. Guardians
    "ALTER TABLE `guardians` MODIFY `id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `guardians` MODIFY `user_id` VARCHAR(50) NULL",
    "ALTER TABLE `guardians` ADD COLUMN `relationship` VARCHAR(50) NULL",
    "UPDATE `guardians` SET `relationship` = `relation` WHERE `relationship` IS NULL AND `relation` IS NOT NULL",

    // 3. Attendance
    "ALTER TABLE `attendance` MODIFY `id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `attendance` MODIFY `student_id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `attendance` MODIFY `class_id` VARCHAR(50) NULL",
    "ALTER TABLE `attendance` MODIFY `taken_by` VARCHAR(50) NULL",
    "ALTER TABLE `attendance` ADD COLUMN `recorded_by` VARCHAR(50) NULL",

    // 4. Fees
    "ALTER TABLE `fees` MODIFY `student_id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `fees` MODIFY `status` ENUM('unpaid','partial','partially_paid','cleared','paid') DEFAULT 'unpaid'",
    "ALTER TABLE `fees` ADD COLUMN `due_date` DATE NULL",

    // 5. Tasks
    "ALTER TABLE `tasks` MODIFY `id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `tasks` MODIFY `teacher_id` VARCHAR(50) NULL",
    "ALTER TABLE `tasks` MODIFY `class_id` VARCHAR(50) NULL",
    "ALTER TABLE `tasks` MODIFY `subject_id` VARCHAR(50) NULL",
    "ALTER TABLE `tasks` MODIFY `due_date` DATE NULL",
    "ALTER TABLE `tasks` MODIFY `status` ENUM('planned','done','overdue','pending','in_progress','completed') DEFAULT 'planned'",

    // 6. Discipline Incidents
    "ALTER TABLE `discipline_incidents` MODIFY `id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `discipline_incidents` MODIFY `student_id` VARCHAR(50) NOT NULL",

    // 7. Leave Requests
    "ALTER TABLE `leave_requests` MODIFY `id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `leave_requests` MODIFY `student_id` VARCHAR(50) NULL",

    // 8. Remote Payments
    "ALTER TABLE `remote_payments` MODIFY `id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `remote_payments` MODIFY `student_id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `remote_payments` MODIFY `guardian_id` VARCHAR(50) NULL",

    // 9. Assets
    "ALTER TABLE `assets` MODIFY `id` VARCHAR(50) NOT NULL",
    "ALTER TABLE `assets` MODIFY `holder_id` VARCHAR(50) NULL",
    "ALTER TABLE `assets` ADD COLUMN `holder_name` VARCHAR(200) NULL",
    "ALTER TABLE `assets` ADD COLUMN `expected_return_date` DATE NULL",
    "ALTER TABLE `assets` ADD COLUMN `issued_at` DATETIME NULL",
    "ALTER TABLE `assets` ADD COLUMN `condition_status` VARCHAR(50) DEFAULT 'good'",
    "ALTER TABLE `assets` ADD COLUMN `purchase_cost` DECIMAL(10,2) DEFAULT 0.00",
    "ALTER TABLE `assets` ADD COLUMN `location` VARCHAR(150) NULL",
    "ALTER TABLE `assets` ADD COLUMN `custodian` VARCHAR(150) NULL",

    // 10. Subjects
    "ALTER TABLE `subjects` ADD COLUMN `school_id` VARCHAR(50) NULL"
  ];

  for (const sql of statements) {
    try {
      await query(sql);
      console.log('✓ Success:', sql.substring(0, 60));
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('- Skipped (column already exists):', sql.substring(0, 60));
      } else {
        console.warn('! Warning executing:', sql.substring(0, 60), '->', err.message);
      }
    }
  }

  console.log('Schema normalization finished.');
  process.exit(0);
}

runSchemaFixes();
