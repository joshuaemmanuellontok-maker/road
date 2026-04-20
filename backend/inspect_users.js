import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = JSON.parse(
  fs.readFileSync('./firebase-service-account.json', 'utf8')
);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function inspectUsers() {
  const username = 'testmotorist';
  console.log('Inspecting users with username', username);
  const q = db.collection('users').where('username', '==', username);
  const snapshot = await q.get();
  console.log('Found', snapshot.size, 'docs');
  for (const doc of snapshot.docs) {
    console.log('DOC ID:', doc.id);
    console.log('DATA ID:', doc.data().id);
    console.log('ROLE:', doc.data().role);
    console.log('PK PASSWORD HASH START:', doc.data().password_hash?.slice(0, 20));
    console.log('EMAIL:', doc.data().email);
    console.log('PHONE:', doc.data().phone);
    console.log('-----');
  }
  console.log('Check direct doc by id 15');
  const d15 = await db.collection('users').doc('15').get();
  console.log('doc 15 exists?', d15.exists);
  if (d15.exists) console.log('doc15 data', d15.data());
  console.log('Check direct doc by id user-15');
  const du15 = await db.collection('users').doc('user-15').get();
  console.log('doc user-15 exists?', du15.exists);
  if (du15.exists) console.log('doc user-15 data', du15.data());
}

inspectUsers();
