const { query } = require('../src/config/db');

async function cleanDatabase() {
  console.log("=== Starting Database Cleanup (Preserving Super User & Admin Accounts) ===");

  await query('SET FOREIGN_KEY_CHECKS = 0;');

  const tablesToClear = [
    'attendance',
    'fee_payments',
    'fees',
    'remote_payments',
    'results',
    'grades',
    'student_guardians',
    'guardians',
    'student_subjects',
    'teaching_assignments',
    'staff_subjects',
    'timetable',
    'tasks',
    'leave_requests',
    'discipline_incidents',
    'exeats',
    'medical_records',
    'inventory_logs',
    'book_loans',
    'library_books',
    'assets',
    'announcements',
    'messages',
    'conversation_participants',
    'conversations',
    'students',
    'staff',
    'classes',
    'subjects'
  ];

  for (const table of tablesToClear) {
    try {
      await query(`TRUNCATE TABLE \`${table}\``);
      console.log(`✓ Truncated table: ${table}`);
    } catch (err) {
      // If table doesn't exist or truncate fails, fallback to DELETE
      try {
        await query(`DELETE FROM \`${table}\``);
        console.log(`✓ Deleted from table: ${table}`);
      } catch (e) {
        console.warn(`! Table ${table} not cleared: ${e.message}`);
      }
    }
  }

  // Clear non-superuser users
  try {
    const deleteUsersRes = await query(`
      DELETE FROM users 
      WHERE username NOT IN ('superadmin', 'professor', 'schooladmin')
    `);
    console.log(`✓ Deleted non-admin users. Rows affected: ${deleteUsersRes.affectedRows}`);
  } catch (err) {
    console.error("Failed to delete users:", err.message);
  }

  await query('SET FOREIGN_KEY_CHECKS = 1;');

  // Inspect preserved users
  const preservedUsers = await query("SELECT id, username, email, role, school_id FROM users");
  console.log("\nPreserved User Accounts:");
  console.table(preservedUsers);

  console.log("=== Database Cleanup Finished Successfully ===");
  process.exit(0);
}

cleanDatabase().catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
