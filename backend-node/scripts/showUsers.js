const { query } = require('../src/config/db');

async function main() {
  const users = await query("SELECT id, username, email, role, school_id FROM users WHERE role IN ('super_admin', 'school_admin') OR username IN ('superadmin', 'professor', 'schooladmin')");
  console.log("Admin / Super users:", JSON.stringify(users, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
