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

async function resolveUserReference(identifier) {
  console.log(`\n🔍 Resolving user identifier: "${identifier}"`);
  
  // Try to find user by username, email, or phone
  const conditions = [
    { username: identifier },
    { email: identifier },
    { phone: identifier }
  ];

  for (const condition of conditions) {
    console.log(`   Searching by:`, condition);
    const users = await db.collection('users').where(Object.keys(condition)[0], '==', Object.values(condition)[0]).get();
    console.log(`   Found: ${users.size} users`);
    if (users.size > 0) {
      const user = users.docs[0];
      console.log(`   ✅ Found user: ${user.data().username} (id: ${user.id})`);
      return { userId: user.id, userProfileId: null };
    }
  }

  console.log(`   ❌ User not found`);
  return { userId: null, userProfileId: null };
}

async function testLoginFlow() {
  console.log('🔐 Testing complete login flow...\n');

  const username = 'testmotorist';
  const password = 'testmotorist123';

  try {
    // Step 1: Resolve user
    const reference = await resolveUserReference(username);
    
    if (!reference.userId) {
      console.log('\n❌ Step 1 FAILED: User not found');
      return;
    }
    
    console.log('\n✅ Step 1 PASSED: User found');

    // Step 2: Get user document
    console.log(`\n📄 Step 2: Getting user document (${reference.userId})...`);
    const userDoc = await db.collection('users').doc(reference.userId).get();
    if (!userDoc.exists) {
      console.log('❌ Step 2 FAILED: Document does not exist');
      return;
    }
    
    const user = userDoc.data();
    console.log('✅ Step 2 PASSED: User document found');
    console.log('   Username:', user.username);
    console.log('   Role:', user.role);
    console.log('   Email:', user.email);
    console.log('   Phone:', user.phone);

    // Step 3: Check role
    console.log(`\n🔍 Step 3: Checking role...`);
    if (user.role !== 'motorist') {
      console.log(`❌ Step 3 FAILED: User role is "${user.role}", not "motorist"`);
      return;
    }
    console.log('✅ Step 3 PASSED: User is motorist');

    // Step 4: Verify password
    console.log(`\n🔐 Step 4: Verifying password...`);
    console.log(`   Stored hash: ${user.password_hash.substring(0, 20)}...`);
    console.log(`   Testing password: "${password}"`);
    
    try {
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log(`   bcrypt.compare result: ${isValidPassword}`);
      
      if (!isValidPassword) {
        console.log('❌ Step 4 FAILED: Password does not match');
        
        // Try to see if it's a plain password
        console.log('\n   🧪 Testing if hash is plain password...');
        if (user.password_hash === password) {
          console.log('   Found: Hash IS the plain password!');
          console.log('   Need to hash the password_hash field itself with bcrypt.');
        }
        return;
      }
      
      console.log('✅ Step 4 PASSED: Password verified');
    } catch (bcryptError) {
      console.log(`❌ Step 4 FAILED: bcrypt error: ${bcryptError.message}`);
      return;
    }

    console.log('\n✅✅✅ LOGIN SUCCESSFUL ✅✅✅');
    console.log('\nResponse would be:');
    console.log(JSON.stringify({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    }, null, 2));

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error(error);
  }
}

testLoginFlow();
