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
  const projectId = serviceAccount.project_id;

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${projectId}.firebaseio.com`
  });
} catch (error) {
  // Fallback to environment variables (less secure, for development)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL: `https://${projectId}.firebaseio.com`
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
  agentProfiles: 'responder_profiles',
  repairShops: 'repair_shops',
  agentApplications: 'responder_applications',
  emergencyReports: 'emergency_reports',
  emergencyReportSymptoms: 'emergency_report_symptoms',
  dispatches: 'dispatches',
  dispatchFeedback: 'dispatch_feedback',
  forumThreads: 'forum_threads',
  forumReplies: 'forum_replies',
  subscriptionPayments: 'subscription_payments',
  communityRedemptions: 'community_redemptions',
};

export const legacyCollections = {
  agentProfiles: 'agent_profiles',
  agentApplications: 'agent_applications',
  agents: 'agents',
};

// Helper to get server timestamp
export const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

// Helper to get document reference
export const docRef = (collection, id) => db.collection(collection).doc(id);

// Helper to get collection reference
export const collectionRef = (collection) => db.collection(collection);
