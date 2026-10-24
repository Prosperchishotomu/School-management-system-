const { query } = require('../src/config/db');

async function check() {
  try {
    const tables = await query('SHOW TABLES');
    console.log('Tables count:', tables.length);
    for (const t of tables) {
      const tableName = Object.values(t)[0];
      const countRes = await query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      console.log(`- ${tableName}: ${countRes[0].count} rows`);
    }
    process.exit(0);
  } catch (err) {
    console.error('DB Error:', err);
    process.exit(1);
  }
}

check();
