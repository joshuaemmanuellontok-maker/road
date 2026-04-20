import { pool } from './src/db.js';

async function testSupabaseConnection() {
  try {
    console.log('🔄 Testing Supabase connection...');

    // Test basic connection
    await pool.query('SELECT 1');
    console.log('✅ Database connected successfully');

    // Check if tables exist
    const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const tables = result.rows.map(r => r.table_name);

    console.log('📋 Tables found:', tables);

    const requiredTables = ['users', 'agent_profiles', 'emergency_reports', 'dispatches'];
    const missingTables = requiredTables.filter(table => !tables.includes(table));

    if (missingTables.length > 0) {
      console.log('❌ Missing tables:', missingTables);
      console.log('Please run the schema SQL in Supabase SQL Editor first');
    } else {
      console.log('✅ All required tables exist');
    }

    // Test a simple agent query
    const agentResult = await pool.query('SELECT COUNT(*) as agent_count FROM agent_profiles');
    console.log(`👥 Agents in database: ${agentResult.rows[0].agent_count}`);

  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('💡 Make sure your DATABASE_URL in .env is correct');
  } finally {
    pool.end();
  }
}

testSupabaseConnection();