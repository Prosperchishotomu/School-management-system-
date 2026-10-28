require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../src/config/db');

const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
const password = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@schoolbase.local';
const name = process.env.SUPER_ADMIN_NAME || 'System Administrator';

async function ensureSuperAdmin() {
  const passwordHash = bcrypt.hashSync(password, 10);

  const existing = await queryOne(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email]
  );

  if (existing) {
    await query(
      `UPDATE users
       SET username = ?,
           email = ?,
           password_hash = ?,
           role = 'super_admin',
           school_id = NULL,
           status = 'active',
           name = ?
       WHERE id = ?`,
      [username, email, passwordHash, name, existing.id]
    );

    console.log(`Updated existing admin account: ${username} (${email})`);
    console.log(`Password: ${password}`);
    return;
  }

  const userId = 'USR' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  await query(
    `INSERT INTO users (id, username, email, password_hash, role, school_id, status, name)
     VALUES (?, ?, ?, ?, 'super_admin', NULL, 'active', ?)`,
    [userId, username, email, passwordHash, name]
  );

  console.log(`Created super admin account: ${username} (${email})`);
  console.log(`Password: ${password}`);
}

ensureSuperAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to create super admin:', err);
    process.exit(1);
  });
