import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = JSON.parse(
  fs.readFileSync('./firebase-service-account.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// These are the old seed-created documents that should be deleted
const docsToDel = ['testmotorist', 'testagent', 'admin'];

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate user documents...\n');

  for (const docId of docsToDel) {
    try {
      const doc = await db.collection('users').doc(docId).get();
      if (doc.exists) {
        console.log(`❌ Deleting old seed document: ${docId}`);
        await db.collection('users').doc(docId).delete();
      } else {
        console.log(`⏭️  Document ${docId} not found`);
      }
    } catch (error) {
      console.error(`Error deleting ${docId}:`, error.message);
    }
  }

  console.log('\n✅ Cleanup complete!');
  
  // Verify remaining users
  console.log('\n📋 Remaining test users:');
  const snapshot = await db.collection('users').where('username', '==', 'testmotorist').get();
  console.log(`Found ${snapshot.size} "testmotorist" user(s)`);
  snapshot.forEach(doc => {
    console.log(`   ✅ ${doc.id} - ${doc.data().username} (${doc.data().role})`);
  });
}

cleanupDuplicates();
