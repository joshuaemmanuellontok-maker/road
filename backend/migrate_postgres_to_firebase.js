import admin from 'firebase-admin';
import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const { Client } = pkg;

// Initialize Firebase
const serviceAccount = JSON.parse(
  fs.readFileSync('./firebase-service-account.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// PostgreSQL connection - try both password combinations
const pgConnections = [
  {
    user: 'postgres',
    password: 'joshua123',
    host: 'localhost',
    port: 5432,
    database: 'roadresq',
  },
  {
    user: 'roadresq',
    password: 'road123',
    host: 'localhost',
    port: 5432,
    database: 'roadresq',
  },
];

let client;

async function connectPostgres() {
  for (const config of pgConnections) {
    try {
      console.log(`🔌 Trying to connect as ${config.user}...`);
      client = new Client(config);
      await client.connect();
      console.log(`✅ Connected to PostgreSQL as ${config.user}`);
      return;
    } catch (error) {
      console.log(`❌ Failed with ${config.user}: ${error.message}`);
    }
  }
  throw new Error('Could not connect to PostgreSQL with any credentials');
}

async function migrateUsers() {
  console.log('\n📋 Fetching users from PostgreSQL...');
  
  try {
    const result = await client.query(
      'SELECT id, username, full_name, email, password_hash, phone, role, status, created_at FROM users'
    );
    
    console.log(`✅ Found ${result.rows.length} users`);

    for (const user of result.rows) {
      try {
        await db.collection('users').doc(user.username).set({
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          password_hash: user.password_hash, // Keep existing hash
          phone: user.phone,
          role: user.role,
          status: user.status,
          created_at: new Date(user.created_at),
          migrated_from: 'PostgreSQL',
          migrated_at: new Date(),
        });
        console.log(`  ✅ Migrated user: ${user.username}`);
      } catch (error) {
        console.log(`  ❌ Failed to migrate user ${user.username}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    throw error;
  }
}

async function migrateAdminProfiles() {
  console.log('\n👤 Fetching admin profiles from PostgreSQL...');
  
  try {
    const result = await client.query(
      'SELECT ap.id, ap.user_id, ap.position, ap.created_at, u.username FROM admin_profiles ap JOIN users u ON ap.user_id = u.id'
    );
    
    console.log(`✅ Found ${result.rows.length} admin profiles`);

    for (const profile of result.rows) {
      try {
        await db.collection('admin_profiles').doc(profile.username).set({
          id: profile.id,
          user_id: profile.user_id,
          username: profile.username,
          position: profile.position,
          created_at: new Date(profile.created_at),
          migrated_from: 'PostgreSQL',
          migrated_at: new Date(),
        });
        console.log(`  ✅ Migrated admin profile: ${profile.username}`);
      } catch (error) {
        console.log(`  ❌ Failed to migrate admin profile ${profile.username}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching admin profiles:', error.message);
    throw error;
  }
}

async function migrateAgentProfiles() {
  console.log('\n🚗 Fetching agent profiles from PostgreSQL...');
  
  try {
    const result = await client.query(
      `SELECT ap.id, ap.user_id, ap.business_name, ap.service_type, ap.service_area, 
              ap.license_number, ap.or_cr_number, ap.insurance_details, ap.nbi_clearance_ref,
              ap.verification_status, ap.current_latitude, ap.current_longitude, ap.is_available,
              ap.created_at, u.username FROM agent_profiles ap 
       JOIN users u ON ap.user_id = u.id`
    );
    
    console.log(`✅ Found ${result.rows.length} agent profiles`);

    for (const profile of result.rows) {
      try {
        await db.collection('agent_profiles').doc(profile.username).set({
          id: profile.id,
          user_id: profile.user_id,
          username: profile.username,
          business_name: profile.business_name,
          service_type: profile.service_type,
          service_area: profile.service_area,
          license_number: profile.license_number,
          or_cr_number: profile.or_cr_number,
          insurance_details: profile.insurance_details,
          nbi_clearance_ref: profile.nbi_clearance_ref,
          verification_status: profile.verification_status,
          current_latitude: profile.current_latitude,
          current_longitude: profile.current_longitude,
          is_available: profile.is_available,
          created_at: new Date(profile.created_at),
          migrated_from: 'PostgreSQL',
          migrated_at: new Date(),
        });
        console.log(`  ✅ Migrated agent profile: ${profile.username}`);
      } catch (error) {
        console.log(`  ❌ Failed to migrate agent profile ${profile.username}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching agent profiles:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting PostgreSQL to Firebase migration...\n');
    
    await connectPostgres();
    
    await migrateUsers();
    await migrateAdminProfiles();
    await migrateAgentProfiles();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📊 All users and profiles have been migrated to Firebase.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
    process.exit(0);
  }
}

main();
