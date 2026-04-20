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
const userIdMap = new Map();
const repairShopIdMap = new Map();
const emergencyReportIdMap = new Map();

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

function toDate(value) {
  return value ? new Date(value) : null;
}

async function verifyFirestore() {
  try {
    const collections = await db.listCollections();
    console.log('📦 Firestore verification passed. Collections:', collections.map(c => c.id).join(', ') || '(none yet)');
  } catch (error) {
    throw new Error(`Firestore verification failed: ${error.message}`);
  }
}

async function migrateUsers() {
  console.log('\n📋 Fetching users from PostgreSQL...');
  const result = await client.query(
    'SELECT id, username, full_name, email, password_hash, phone, role, status, created_at, updated_at FROM users'
  );

  console.log(`✅ Found ${result.rows.length} users`);

  for (const user of result.rows) {
    const docId = `user-${user.id}`;
    userIdMap.set(user.id, docId);

    await db.collection('users').doc(docId).set({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      password_hash: user.password_hash,
      phone: user.phone,
      role: user.role,
      status: user.status,
      created_at: toDate(user.created_at),
      updated_at: toDate(user.updated_at),
      migrated_from: 'PostgreSQL',
      migrated_at: new Date(),
    });
    console.log(`  ✅ Migrated user: ${user.username}`);
  }
}

async function migrateMotoristProfiles() {
  console.log('\n🚘 Fetching motorist_profiles from PostgreSQL...');
  const result = await client.query(
    'SELECT id, user_id, address, vehicle_type, vehicle_model, plate_number, created_at FROM motorist_profiles'
  );

  console.log(`✅ Found ${result.rows.length} motorist profiles`);

  for (const profile of result.rows) {
    await db.collection('motorist_profiles').doc(`motorist-${profile.id}`).set({
      id: profile.id,
      user_id: userIdMap.get(profile.user_id) ?? null,
      address: profile.address,
      vehicle_type: profile.vehicle_type,
      vehicle_model: profile.vehicle_model,
      plate_number: profile.plate_number,
      created_at: toDate(profile.created_at),
      migrated_from: 'PostgreSQL',
      migrated_at: new Date(),
    });
    console.log(`  ✅ Migrated motorist profile id ${profile.id}`);
  }
}

async function migrateAdminProfiles() {
  console.log('\n👤 Fetching admin_profiles from PostgreSQL...');
  const result = await client.query(
    'SELECT id, user_id, position, created_at FROM admin_profiles'
  );

  console.log(`✅ Found ${result.rows.length} admin profiles`);

  for (const profile of result.rows) {
    await db.collection('admin_profiles').doc(`admin-${profile.id}`).set({
      id: profile.id,
      user_id: userIdMap.get(profile.user_id) ?? null,
      position: profile.position,
      created_at: toDate(profile.created_at),
      migrated_from: 'PostgreSQL',
      migrated_at: new Date(),
    });
    console.log(`  ✅ Migrated admin profile id ${profile.id}`);
  }
}

async function migrateAgentProfiles() {
  console.log('\n🚗 Fetching agent_profiles from PostgreSQL...');
  const result = await client.query(
    `SELECT id, user_id, business_name, service_type, service_area, license_number, or_cr_number,
            insurance_details, nbi_clearance_ref, verification_status, current_latitude, current_longitude,
            is_available, created_at FROM agent_profiles`
  );

  console.log(`✅ Found ${result.rows.length} agent profiles`);

  for (const profile of result.rows) {
    await db.collection('agent_profiles').doc(`agent-${profile.id}`).set({
      id: profile.id,
      user_id: userIdMap.get(profile.user_id) ?? null,
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
      created_at: toDate(profile.created_at),
      migrated_from: 'PostgreSQL',
      migrated_at: new Date(),
    });
    console.log(`  ✅ Migrated agent profile id ${profile.id}`);
  }
}

async function migrateRepairShops() {
  console.log('\n🏪 Fetching repair_shops from PostgreSQL...');
  const result = await client.query(
    'SELECT id, name, owner_name, contact_number, email, address, latitude, longitude, status, created_at FROM repair_shops'
  );

  console.log(`✅ Found ${result.rows.length} repair shops`);

  for (const shop of result.rows) {
    const docId = `shop-${shop.id}`;
    repairShopIdMap.set(shop.id, docId);

    await db.collection('repair_shops').doc(docId).set({
      id: shop.id,
      name: shop.name,
      owner_name: shop.owner_name,
      contact_number: shop.contact_number,
      email: shop.email,
      address: shop.address,
      latitude: shop.latitude,
      longitude: shop.longitude,
      status: shop.status,
      created_at: toDate(shop.created_at),
      migrated_from: 'PostgreSQL',
      migrated_at: new Date(),
    });
    console.log(`  ✅ Migrated repair shop id ${shop.id}`);
  }
}

async function migrateAgentApplications() {
  console.log('\n📝 Fetching agent_applications from PostgreSQL...');
  const result = await client.query(
    'SELECT id, user_id, submitted_at, status, remarks FROM agent_applications'
  );

  console.log(`✅ Found ${result.rows.length} agent applications`);

  for (const app of result.rows) {
    await db.collection('agent_applications').doc(`application-${app.id}`).set({
      id: app.id,
      user_id: userIdMap.get(app.user_id) ?? null,
      submitted_at: toDate(app.submitted_at),
      status: app.status,
      remarks: app.remarks,
      migrated_from: 'PostgreSQL',
      migrated_at: new Date(),
    });
    console.log(`  ✅ Migrated agent application id ${app.id}`);
  }
}

async function migrateEmergencyReports() {
  console.log('\n🚨 Fetching emergency_reports from PostgreSQL...');
  const result = await client.query(
    `SELECT id, motorist_user_id, vehicle_type, issue_summary, triage_level, report_status,
            latitude, longitude, photo_url, video_url, created_at, updated_at
     FROM emergency_reports`
  );

  console.log(`✅ Found ${result.rows.length} emergency reports`);

  for (const report of result.rows) {
    const docId = `report-${report.id}`;
    emergencyReportIdMap.set(report.id, docId);

    await db.collection('emergency_reports').doc(docId).set({
      id: report.id,
      motorist_user_id: userIdMap.get(report.motorist_user_id) ?? null,
      vehicle_type: report.vehicle_type,
      issue_summary: report.issue_summary,
      triage_level: report.triage_level,
      report_status: report.report_status,
      latitude: report.latitude,
      longitude: report.longitude,
      photo_url: report.photo_url,
      video_url: report.video_url,
      created_at: toDate(report.created_at),
      updated_at: toDate(report.updated_at),
      migrated_from: 'PostgreSQL',
      migrated_at: new Date(),
    });
    console.log(`  ✅ Migrated emergency report id ${report.id}`);
  }
}

async function migrateEmergencyReportSymptoms() {
  console.log('\n🩺 Fetching emergency_report_symptoms from PostgreSQL...');
  const result = await client.query(
    'SELECT id, emergency_report_id, symptom_text FROM emergency_report_symptoms'
  );

  console.log(`✅ Found ${result.rows.length} emergency report symptoms`);

  for (const symptom of result.rows) {
    await db.collection('emergency_report_symptoms').doc(`symptom-${symptom.id}`).set({
      id: symptom.id,
      emergency_report_id: emergencyReportIdMap.get(symptom.emergency_report_id) ?? null,
      symptom_text: symptom.symptom_text,
      migrated_from: 'PostgreSQL',
      migrated_at: new Date(),
    });
    console.log(`  ✅ Migrated symptom id ${symptom.id}`);
  }
}

async function migrateDispatches() {
  console.log('\n🚚 Fetching dispatches from PostgreSQL...');
  const result = await client.query(
    `SELECT id, emergency_report_id, agent_user_id, repair_shop_id,
            assigned_at, accepted_at, arrived_at, completed_at, dispatch_status
     FROM dispatches`
  );

  console.log(`✅ Found ${result.rows.length} dispatch records`);

  for (const dispatch of result.rows) {
    await db.collection('dispatches').doc(`dispatch-${dispatch.id}`).set({
      id: dispatch.id,
      emergency_report_id: emergencyReportIdMap.get(dispatch.emergency_report_id) ?? null,
      agent_user_id: userIdMap.get(dispatch.agent_user_id) ?? null,
      repair_shop_id: repairShopIdMap.get(dispatch.repair_shop_id) ?? null,
      assigned_at: toDate(dispatch.assigned_at),
      accepted_at: toDate(dispatch.accepted_at),
      arrived_at: toDate(dispatch.arrived_at),
      completed_at: toDate(dispatch.completed_at),
      dispatch_status: dispatch.dispatch_status,
      migrated_from: 'PostgreSQL',
      migrated_at: new Date(),
    });
    console.log(`  ✅ Migrated dispatch id ${dispatch.id}`);
  }
}

async function main() {
  try {
    console.log('🚀 Starting PostgreSQL to Firebase full migration...\n');

    await connectPostgres();
    await verifyFirestore();

    await migrateUsers();
    await migrateMotoristProfiles();
    await migrateAdminProfiles();
    await migrateAgentProfiles();
    await migrateRepairShops();
    await migrateAgentApplications();
    await migrateEmergencyReports();
    await migrateEmergencyReportSymptoms();
    await migrateDispatches();

    console.log('\n✅ Full migration completed successfully!');
    console.log('📊 All PostgreSQL tables have been migrated to Firebase.');
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
