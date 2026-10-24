const { query } = require('../src/config/db');

async function inspectColumns() {
  const tables = ['classes', 'students', 'staff', 'subjects', 'assets', 'guardians', 'fees', 'grades', 'attendance', 'tasks'];
  for (const t of tables) {
    try {
      const cols = await query(`DESCRIBE \`${t}\``);
      console.log(`\n=== TABLE: ${t} ===`);
      console.log(cols.map(c => `${c.Field} (${c.Type}, Null: ${c.Null}, Key: ${c.Key}, Default: ${c.Default})`).join('\n'));
    } catch (e) {
      console.log(`Table ${t} error:`, e.message);
    }
  }
  process.exit(0);
}

inspectColumns();
