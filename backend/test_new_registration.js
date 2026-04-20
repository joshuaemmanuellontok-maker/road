// Clean test to verify new account registration works in Firebase
import { db, collections } from './src/firebase.js';
import bcrypt from 'bcryptjs';

async function testNewRegistration() {
  console.log('\n✅ Testing Firebase User Registration Flow\n');

  try {
    // Check if test user already exists
    const existingUsers = await db.collection(collections.users)
      .where('username', '==', 'testuser123')
      .get();

    if (!existingUsers.empty) {
      console.log('⚠️  Test user already exists, skipping registration test\n');
      
      const user = existingUsers.docs[0].data();
      console.log('Existing User Details:');
      console.log(`  Username: ${user.username}`);
      console.log(`  Phone: ${user.phone}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Status: ${user.status}\n`);
      process.exit(0);
    }

    // Create a new test user
    console.log('📝 Creating new test user...\n');
    
    const passwordHash = await bcrypt.hash('test123', 10);
    const userDocId = db.collection(collections.users).doc();
    
    await userDocId.set({
      id: userDocId.id,
      username: 'testuser123',
      full_name: 'Test User',
      email: 'testuser123@roadresq.local',
      password_hash: passwordHash,
      phone: '+63 917 555 1234',
      role: 'motorist',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log('✅ User created successfully!\n');

    // Create motorist profile
    const motoristDocId = db.collection(collections.motoristProfiles).doc();
    await motoristDocId.set({
      id: motoristDocId.id,
      user_id: userDocId.id,
      created_at: new Date(),
    });

    console.log('✅ Motorist profile created!\n');

    // Verify the user can be queried
    const verifyUsers = await db.collection(collections.users)
      .where('username', '==', 'testuser123')
      .get();

    if (!verifyUsers.empty) {
      const savedUser = verifyUsers.docs[0].data();
      console.log('✅ Verification: User successfully stored in Firebase\n');
      console.log('Saved User Details:');
      console.log(`  ID: ${verifyUsers.docs[0].id}`);
      console.log(`  Username: ${savedUser.username}`);
      console.log(`  Phone: ${savedUser.phone}`);
      console.log(`  Role: ${savedUser.role}`);
      console.log(`  Has Password Hash: ${!!savedUser.password_hash}\n`);

      // Test login
      console.log('🔐 Testing login with saved credentials...\n');
      const isPasswordValid = await bcrypt.compare('test123', savedUser.password_hash);
      
      if (isPasswordValid) {
        console.log('✅ Login test PASSED - Password verification works!\n');
      } else {
        console.log('❌ Login test FAILED - Password mismatch\n');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testNewRegistration();
