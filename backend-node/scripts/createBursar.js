const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'schoolbase'
  });

  const hash = '$2a$10$YRkD2ojTioE33g6D6pkCCOMR5RnWekAEe6AoZ4Zc4dG3uWKoJHhu2'; // password for admin/schooladmin
  await conn.query(
    `INSERT INTO users (id, username, password_hash, role, school_id, status)
     VALUES ('USRbursar01', 'bursar', ?, 'bursar', 'HARAREPR', 'active')
     ON DUPLICATE KEY UPDATE role='bursar', status='active', password_hash = ?`,
    [hash, hash]
  );
  console.log('Bursar user successfully created/updated in MySQL.');
  await conn.end();
}

main().catch(console.error);
