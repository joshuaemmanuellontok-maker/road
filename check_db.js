import pg from 'pg';
const { Client } = pg;

async function checkDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'roadresq',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check agents
    const agents = await client.query(`
      SELECT u.id, u.full_name, ap.service_category, ap.is_available,
             ap.current_latitude, ap.current_longitude
      FROM users u
      JOIN agent_profiles ap ON u.id = ap.user_id
      WHERE u.role = 'agent'
    `);
    console.log('Available agents:', agents.rows.length);
    agents.rows.forEach(agent => {
      console.log(`- ${agent.full_name}: available=${agent.is_available}, location=(${agent.current_latitude}, ${agent.current_longitude})`);
    });

    // Check dispatches
    const dispatches = await client.query(`
      SELECT id, dispatch_status, agent_user_id, assigned_at
      FROM dispatches
      ORDER BY assigned_at DESC
      LIMIT 5
    `);
    console.log('Recent dispatches:', dispatches.rows.length);
    dispatches.rows.forEach(d => {
      console.log(`- ID: ${d.id}, Status: ${d.dispatch_status}, Agent: ${d.agent_user_id}, Time: ${d.assigned_at}`);
    });

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await client.end();
  }
}

checkDatabase();