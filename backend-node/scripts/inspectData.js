const { query } = require('../src/config/db');

async function inspectKeyData() {
  try {
    const schools = await query('SELECT * FROM schools LIMIT 5');
    console.log('=== SCHOOLS ===\n', JSON.stringify(schools, null, 2));

    const users = await query('SELECT id, school_id, username, email, role, status FROM users LIMIT 10');
    console.log('=== USERS ===\n', JSON.stringify(users, null, 2));

    const classes = await query('SELECT id, school_id, name, level, capacity, status FROM classes');
    console.log('=== CLASSES ===\n', JSON.stringify(classes, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Inspection Error:', err);
    process.exit(1);
  }
}

inspectKeyData();
