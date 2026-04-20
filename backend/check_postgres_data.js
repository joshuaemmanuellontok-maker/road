import pkg from 'pg';
const { Client } = pkg;

async function run() {
  const client = new Client({
    user: 'postgres',
    password: 'joshua123',
    host: 'localhost',
    port: 5432,
    database: 'roadresq'
  });

  await client.connect();
  const tables = ['users','motorist_profiles','admin_profiles','agent_profiles','repair_shops','agent_applications','emergency_reports','emergency_report_symptoms','dispatches'];
  for (const t of tables) {
    const res = await client.query(`SELECT count(*) as c FROM ${t}`);
    console.log(`${t}: ${res.rows[0].c}`);
  }

  const adminUsers = await client.query("SELECT id, username, role, email FROM users WHERE role='admin' OR username='admin' LIMIT 10");
  console.log('admin users rows:', adminUsers.rows);

  const adminProfiles = await client.query('SELECT id, user_id, position, created_at FROM admin_profiles');
  console.log('admin_profiles rows:', adminProfiles.rows);

  await client.end();
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
