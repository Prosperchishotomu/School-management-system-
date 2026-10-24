const { query } = require('../src/config/db');

async function showCreate() {
  const tables = ['classes', 'students', 'guardians', 'staff', 'subjects', 'assets', 'fees', 'attendance', 'users'];
  for (const t of tables) {
    try {
      const res = await query(`SHOW CREATE TABLE \`${t}\``);
      console.log(`\n=================== ${t} ===================`);
      console.log(res[0]['Create Table']);
    } catch (e) {
      console.log(t, e.message);
    }
  }
  process.exit(0);
}

showCreate();
