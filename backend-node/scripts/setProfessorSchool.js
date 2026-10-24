const bcrypt = require('bcryptjs');
const { query } = require('../src/config/db');

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await query(`
    INSERT INTO users (id, school_id, username, email, password_hash, role, status)
    VALUES ('AlnzOXEg', 'HARAREPR', 'professor', 'chishotomup@gmail.com', ?, 'school_admin', 'active')
    ON DUPLICATE KEY UPDATE school_id = 'HARAREPR', email = 'chishotomup@gmail.com', role = 'school_admin'
  `, [hash]);

  const user = await query("SELECT id, username, email, role, school_id FROM users WHERE username = 'professor'");
  console.log('Professor user account ensured:', JSON.stringify(user, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
