import admin from 'firebase-admin';
import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const { Client } = pkg;

const serviceAccount = JSON.parse(
  fs.readFileSync('./firebase-service-account.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

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
const userIdMap = new Map();
const repairShopIdMap = new Map();
const emergencyReportIdMap = new Map();

async function connectPostgres() {
  for (const config of pgConnections) {
    try {
      console.log(`🔌 Connecting to PostgreSQL as ${config.user}...`);
      client = new Client(config);
      await client.connect();
      console.log(`✅ Connected as ${config.user}`);
      return;
    } catch (error) {
      console.log(`❌ Failed with ${config.user}: ${error.message}`);
    }
  }
  throw new Error('Could not connect to PostgreSQL with any credentials');
}

function toDate(value) {
  return value ? new Date(value) : null;
}

async function migrateUsers() {
  console.log('\n📋 Migrating users...');
  const result = await client.query(
    `SELECT id, username, full_name, email, password_hash, phone, role, status, created_at, updated_at FROM users`
  );
  console.log(`✅ Found ${result.rows.length} users`);

  for (const row of result.rows) {
    const docId = `user-${row.id}`;
    userIdMap.set(row.id, docId);

    await db.collection('users').doc(docId).set({
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      email: row.email,
      password_hash: row.password_hash,
      phone: row.phone,
      role: row.role,
      status: row.status,
      created_at: toDate(row.created_at),
      updated_at: toDate(row.updated_at),
      migrated_from: 'postgres',
      migrated_at: new Date(),
    });

    console.log(`  ✅ users/${docId}`);
  }
}

async function migrateMotoristProfiles() {
  console.log('\n🚘 Migrating motorist_profiles...');
  const result = await client.query(
    `SELECT id, user_id, address, vehicle_type, vehicle_model, plate_number, created_at FROM motorist_profiles`
  );
  console.log(`✅ Found ${result.rows.length} motorist profiles`);

  for (const row of result.rows) {
    await db.collection('motorist_profiles').doc(`motorist-${row.id}`).set({
      id: row.id,
      user_id: userIdMap.get(row.user_id) ?? null,
      address: row.address,
      vehicle_type: row.vehicle_type,
      vehicle_model: row.vehicle_model,
      plate_number: row.plate_number,
      created_at: toDate(row.created_at),
      migrated_from: 'postgres',
      migrated_at: new Date(),
    });
    console.log(`  ✅ motorist_profiles/motorist-${row.id}`);
  }
}

async function migrateAdminProfiles() {
  console.log('\n👤 Migrating admin_profiles...');
  const result = await client.query(
    `SELECT id, user_id, position, created_at FROM admin_profiles`
  );
  console.log(`✅ Found ${result.rows.length} admin profiles`);

  for (const row of result.rows) {
    await db.collection('admin_profiles').doc(`admin-${row.id}`).set({
      id: row.id,
      user_id: userIdMap.get(row.user_id) ?? null,
      position: row.position,
      created_at: toDate(row.created_at),
      migrated_from: 'postgres',
      migrated_at: new Date(),
    });
    console.log(`  ✅ admin_profiles/admin-${row.id}`);
  }
}

async function ensureAdminUserProfile() {
  console.log('\n🔍 Ensuring admin user has an admin_profiles entry...');

  const admins = await client.query(
    `SELECT id, username, full_name, email, phone FROM users WHERE role = 'admin' OR username = 'admin'`
  );

  for (const adminUser of admins.rows) {
    const existing = await client.query(
      'SELECT id FROM admin_profiles WHERE user_id = $1',
      [adminUser.id]
    );

    if (existing.rows.length === 0) {
      const docId = `admin-user-${adminUser.id}`;
      await db.collection('admin_profiles').doc(docId).set({
        id: adminUser.id,
        user_id: userIdMap.get(adminUser.id) ?? null,
        position: 'System Administrator',
        created_at: new Date(),
        migrated_from: 'postgres-admin-user',
        migrated_at: new Date(),
      });
      console.log(`  ✅ Created missing admin_profiles entry for admin user ${adminUser.username}`);
    } else {
      console.log(`  ✅ Admin profile already exists for user_id ${adminUser.id}`);
    }
  }
}

async function migrateAgentProfiles() {
  console.log('\n🚗 Migrating agent_profiles...');
  const result = await client.query(
    `SELECT id, user_id, business_name, service_type, service_area, license_number, or_cr_number,
            insurance_details, nbi_clearance_ref, verification_status, current_latitude, current_longitude,
            is_available, created_at FROM agent_profiles`
  );
  console.log(`✅ Found ${result.rows.length} agent profiles`);

  for (const row of result.rows) {
    await db.collection('agent_profiles').doc(`agent-${row.id}`).set({
      id: row.id,
      user_id: userIdMap.get(row.user_id) ?? null,
      business_name: row.business_name,
      service_type: row.service_type,
      service_area: row.service_area,
      license_number: row.license_number,
      or_cr_number: row.or_cr_number,
      insurance_details: row.insurance_details,
      nbi_clearance_ref: row.nbi_clearance_ref,
      verification_status: row.verification_status,
      current_latitude: row.current_latitude,
      current_longitude: row.current_longitude,
      is_available: row.is_available,
      created_at: toDate(row.created_at),
      migrated_from: 'postgres',
      migrated_at: new Date(),
    });
    console.log(`  ✅ agent_profiles/agent-${row.id}`);
  }
}

async function migrateRepairShops() {
  console.log('\n🏪 Migrating repair_shops...');
  const result = await client.query(
    `SELECT id, name, owner_name, contact_number, email, address, latitude, longitude, status, created_at FROM repair_shops`
  );
  console.log(`✅ Found ${result.rows.length} repair shops`);

  for (const row of result.rows) {
    const docId = `repair-${row.id}`;
    repairShopIdMap.set(row.id, docId);

    await db.collection('repair_shops').doc(docId).set({
      id: row.id,
      name: row.name,
      owner_name: row.owner_name,
      contact_number: row.contact_number,
      email: row.email,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      status: row.status,
      created_at: toDate(row.created_at),
      migrated_from: 'postgres',
      migrated_at: new Date(),
    });
    console.log(`  ✅ repair_shops/repair-${row.id}`);
  }
}

async function migrateAgentApplications() {
  console.log('\n📝 Migrating agent_applications...');
  const result = await client.query(
    `SELECT id, user_id, submitted_at, status, remarks FROM agent_applications`
  );
  console.log(`✅ Found ${result.rows.length} agent applications`);

  for (const row of result.rows) {
    await db.collection('agent_applications').doc(`application-${row.id}`).set({
      id: row.id,
      user_id: userIdMap.get(row.user_id) ?? null,
      submitted_at: toDate(row.submitted_at),
      status: row.status,
      remarks: row.remarks,
      migrated_from: 'postgres',
      migrated_at: new Date(),
    });
    console.log(`  ✅ agent_applications/application-${row.id}`);
  }
}

async function migrateEmergencyReports() {
  console.log('\n🚨 Migrating emergency_reports...');
  const result = await client.query(
    `SELECT id, motorist_user_id, vehicle_type, issue_summary, triage_level, report_status,
            latitude, longitude, photo_url, video_url, created_at, updated_at FROM emergency_reports`
  );
  console.log(`✅ Found ${result.rows.length} emergency reports`);

  for (const row of result.rows) {
    const docId = `report-${row.id}`;
    emergencyReportIdMap.set(row.id, docId);

    await db.collection('emergency_reports').doc(docId).set({
      id: row.id,
      motorist_user_id: userIdMap.get(row.motorist_user_id) ?? null,
      vehicle_type: row.vehicle_type,
      issue_summary: row.issue_summary,
      triage_level: row.triage_level,
      report_status: row.report_status,
      latitude: row.latitude,
      longitude: row.longitude,
      photo_url: row.photo_url,
      video_url: row.video_url,
      created_at: toDate(row.created_at),
      updated_at: toDate(row.updated_at),
      migrated_from: 'postgres',
      migrated_at: new Date(),
    });
    console.log(`  ✅ emergency_reports/report-${row.id}`);
  }
}

async function migrateEmergencyReportSymptoms() {
  console.log('\n🩺 Migrating emergency_report_symptoms...');
  const result = await client.query(
    `SELECT id, emergency_report_id, symptom_text FROM emergency_report_symptoms`
  );
  console.log(`✅ Found ${result.rows.length} emergency report symptoms`);

  for (const row of result.rows) {
    await db.collection('emergency_report_symptoms').doc(`symptom-${row.id}`).set({
      id: row.id,
      emergency_report_id: emergencyReportIdMap.get(row.emergency_report_id) ?? null,
      symptom_text: row.symptom_text,
      migrated_from: 'postgres',
      migrated_at: new Date(),
    });
    console.log(`  ✅ emergency_report_symptoms/symptom-${row.id}`);
  }
}

async function migrateDispatches() {
  console.log('\n🚚 Migrating dispatches...');
  const result = await client.query(
    `SELECT id, emergency_report_id, agent_user_id, repair_shop_id,
            assigned_at, accepted_at, arrived_at, completed_at, dispatch_status FROM dispatches`
  );
  console.log(`✅ Found ${result.rows.length} dispatch records`);

  for (const row of result.rows) {
    await db.collection('dispatches').doc(`dispatch-${row.id}`).set({
      id: row.id,
      emergency_report_id: emergencyReportIdMap.get(row.emergency_report_id) ?? null,
      agent_user_id: userIdMap.get(row.agent_user_id) ?? null,
      repair_shop_id: repairShopIdMap.get(row.repair_shop_id) ?? null,
      assigned_at: toDate(row.assigned_at),
      accepted_at: toDate(row.accepted_at),
      arrived_at: toDate(row.arrived_at),
      completed_at: toDate(row.completed_at),
      dispatch_status: row.dispatch_status,
      migrated_from: 'postgres',
      migrated_at: new Date(),
    });
    console.log(`  ✅ dispatches/dispatch-${row.id}`);
  }
}

async function main() {
  try {
    console.log('🚀 Starting exact Postgres-to-Firestore migration...');
    await connectPostgres();

    await migrateUsers();
    await migrateMotoristProfiles();
    await migrateAdminProfiles();
    await ensureAdminUserProfile();
    await migrateAgentProfiles();
    await migrateRepairShops();
    await migrateAgentApplications();
    await migrateEmergencyReports();
    await migrateEmergencyReportSymptoms();
    await migrateDispatches();

    console.log('\n✅ Exact migration finished.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (client) await client.end();
    process.exit(0);
  }
}

main();
