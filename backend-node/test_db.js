const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConn() {
  console.log('Testing MySQL Connection with config:', {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    pass: process.env.DB_PASS || '',
    db: process.env.DB_NAME || 'schoolbase'
  });

  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'schoolbase'
    });
    console.log('✅ Successfully connected to MySQL database!');
    const [rows] = await conn.execute('SHOW TABLES');
    console.log('Tables found in database:', rows.map(r => Object.values(r)[0]));
    await conn.end();
  } catch (err) {
    console.error('❌ MySQL Connection Failed:', err);
  }
}

testConn();
