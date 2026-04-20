import { pool } from './src/db.js';

async function checkTables() {
  try {
    const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', result.rows.map(r => r.table_name));
  } catch (error) {
    console.log('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkTables();