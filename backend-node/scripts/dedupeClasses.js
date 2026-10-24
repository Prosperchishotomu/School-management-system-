const { query } = require('../src/config/db');

async function dedupeClasses() {
  try {
    const cols = await query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'schoolbase' AND COLUMN_NAME = 'class_id'
    `);
    const tables = cols.map(c => c.TABLE_NAME);
    console.log('Tables with class_id:', tables);

    // Get all classes
    const classes = await query('SELECT id, school_id, name, level, capacity FROM classes ORDER BY created_at ASC, id ASC');
    console.log(`Found ${classes.length} total class records.`);

    const map = new Map();
    const toDelete = [];

    for (const c of classes) {
      if (!c.name || c.name.trim().toLowerCase() === 'none') {
        toDelete.push(c.id);
        continue;
      }
      const key = `${c.school_id}_${c.name.trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, c.id);
      } else {
        const canonicalId = map.get(key);
        console.log(`Duplicate found: ${c.name} (id: ${c.id}) -> migrating to canonical ${canonicalId}`);
        for (const table of tables) {
          if (table === 'classes') continue;
          try {
            await query(`UPDATE ${table} SET class_id = ? WHERE class_id = ?`, [canonicalId, c.id]);
          } catch (updateErr) {
            console.error(`Failed to update ${table}:`, updateErr.message);
          }
        }
        toDelete.push(c.id);
      }
    }

    if (toDelete.length > 0) {
      console.log(`Deleting ${toDelete.length} duplicate/invalid classes:`, toDelete);
      for (const delId of toDelete) {
        for (const table of tables) {
          if (table === 'classes') continue;
          try {
            await query(`UPDATE ${table} SET class_id = NULL WHERE class_id = ?`, [delId]);
          } catch (_) {}
        }
        try {
          await query('DELETE FROM classes WHERE id = ?', [delId]);
        } catch (delErr) {
          console.error(`Failed to delete class ${delId}:`, delErr.message);
        }
      }
    }

    // Ensure UNIQUE KEY exists on classes (school_id, name)
    try {
      await query('ALTER TABLE classes ADD UNIQUE KEY uq_school_class_name (school_id, name)');
      console.log('Successfully added UNIQUE KEY uq_school_class_name on classes(school_id, name)!');
    } catch (e) {
      console.log('Unique key already exists or error:', e.message);
    }

    const remaining = await query('SELECT id, school_id, name FROM classes ORDER BY name');
    console.log(`Done! Remaining classes count: ${remaining.length}`);
    console.log(remaining);
    process.exit(0);
  } catch (err) {
    console.error('Error in dedupeClasses:', err);
    process.exit(1);
  }
}

dedupeClasses();
