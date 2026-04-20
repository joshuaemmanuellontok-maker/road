import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
let firebaseApp;

try {
  // Try to use service account key file if it exists
  const serviceAccountPath = join(__dirname, '..', 'firebase-service-account.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
  });
} catch (error) {
  // Fallback to environment variables (less secure, for development)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });
  } else {
    console.error('❌ Firebase configuration missing. Please set up firebase-service-account.json or environment variables.');
    process.exit(1);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();

// Helper functions for Firestore operations
export const collections = {
  users: 'users',
  motoristProfiles: 'motorist_profiles',
  adminProfiles: 'admin_profiles',
  agentProfiles: 'agent_profiles',
  repairShops: 'repair_shops',
  agentApplications: 'agent_applications',
  emergencyReports: 'emergency_reports',
  emergencyReportSymptoms: 'emergency_report_symptoms',
  dispatches: 'dispatches'
};

// Helper to get server timestamp
export const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

// Helper to get document reference
export const docRef = (collection, id) => db.collection(collection).doc(id);

// Helper to get collection reference
export const collectionRef = (collection) => db.collection(collection);