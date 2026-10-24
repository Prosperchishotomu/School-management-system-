const { query } = require('../src/config/db');

async function checkFKs() {
  const fks = await query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'schoolbase' AND REFERENCED_TABLE_NAME IS NOT NULL
  `);
  console.log('=== FOREIGN KEYS ===');
  fks.forEach(fk => {
    console.log(`${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
  });
  process.exit(0);
}

checkFKs();
