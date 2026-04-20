import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase
const serviceAccount = JSON.parse(
  fs.readFileSync('./firebase-service-account.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function initializeFirestore() {
  try {
    console.log('🔧 Initializing Firestore database...\n');
    
    // Create a test document to initialize the database
    console.log('✍️  Creating initialization document...');
    await db.collection('_initialization').doc('setup').set({
      initialized_at: new Date(),
      project_id: serviceAccount.project_id,
      status: 'ready'
    });
    
    console.log('✅ Firestore database initialized successfully!\n');
    
    // Verify by reading it back
    const doc = await db.collection('_initialization').doc('setup').get();
    if (doc.exists) {
      console.log('✅ Verification successful - database is operational');
      console.log('📊 Database info:', doc.data());
    }
    
    console.log('\n✅ You can now run the migration:');
    console.log('   node migrate_postgres_to_firebase.js\n');
    
  } catch (error) {
    console.error('❌ Failed to initialize Firestore:', error.message);
    process.exit(1);
  }
}

initializeFirestore().then(() => process.exit(0));
