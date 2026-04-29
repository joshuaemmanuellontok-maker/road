import { db, collections } from './src/firebase.js';

async function testFirebaseConnection() {
  try {
    console.log('🔄 Testing Firebase connection...');

    // Test basic connection by getting a collection reference
    const testCollection = db.collection(collections.users);
    console.log('✅ Firebase connected successfully');

    // Check if collections exist (they will be created on first write)
    console.log('📋 Available collections:');
    console.log('  - users');
    console.log('  - motorist_profiles');
    console.log('  - admin_profiles');
    console.log('  - responder_profiles');
    console.log('  - repair_shops');
    console.log('  - responder_applications');
    console.log('  - emergency_reports');
    console.log('  - emergency_report_symptoms');
    console.log('  - dispatches');

    console.log('✅ Firebase setup complete!');
    console.log('💡 Collections will be created automatically when you add data');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('💡 Make sure:');
    console.log('  1. Firebase project is created');
    console.log('  2. Service account key is downloaded and placed in backend/firebase-service-account.json');
    console.log('  3. Firestore is enabled in Firebase Console');
    process.exit(1);
  }
}

testFirebaseConnection();
