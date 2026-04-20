import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';
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

// Map of username to password for test accounts
const testPasswords = {
  'testmotorist': 'testmotorist123',
  'testagent': 'testagent123',
  'admin': 'admin123',
  'Agent1': 'Agent1123',
  'AgentPedro': 'AgentPedro123',
  'jedl21': 'jedl21123',
  'AgentJ': 'AgentJ123',
  'user2': 'user2123',
  'user3': 'user3123',
};

async function resetPasswords() {
  console.log('🔄 Resetting user passwords to known test passwords...\n');

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`📋 Found ${usersSnapshot.size} users\n`);

    let updated = 0;

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      const username = user.username;
      
      // Determine password: use mapped test password or default
      const password = testPasswords[username] || `${username}123`;
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update in Firestore
      await userDoc.ref.update({
        password_hash: hashedPassword,
        password_reset_at: new Date(),
      });

      console.log(`✅ ${username}`);
      console.log(`   Password: ${password}`);
      console.log(`   Role: ${user.role}`);
      updated++;
    }

    console.log(`\n🎉 Successfully reset ${updated} user passwords!\n`);
    console.log('📝 Test Accounts:');
    console.log('━'.repeat(50));
    
    for (const [username, password] of Object.entries(testPasswords)) {
      console.log(`  Username: ${username}`);
      console.log(`  Password: ${password}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetPasswords();
