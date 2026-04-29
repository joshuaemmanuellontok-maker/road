import admin from "firebase-admin";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "firebase-service-account.json"), "utf8"),
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const collections = [
  "users",
  "motorist_profiles",
  "admin_profiles",
  "responder_profiles",
  "agent_profiles",
  "repair_shops",
  "responder_applications",
  "agent_applications",
  "emergency_reports",
  "emergency_report_symptoms",
  "dispatches",
  "dispatch_feedback",
  "forum_threads",
  "forum_replies",
  "subscription_payments",
  "community_redemptions",
  "requests",
  "responders",
  "agents",
  "_initialization",
];

function toMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function scoreDocument(doc) {
  const data = doc.data() ?? {};
  return Math.max(
    toMillis(data.updated_at),
    toMillis(data.updatedAt),
    toMillis(data.created_at),
    toMillis(data.createdAt),
    toMillis(data.completed_at),
    toMillis(data.completedAt),
    toMillis(data.submitted_at),
    toMillis(data.submittedAt),
  );
}

function pickDocumentToKeep(docs) {
  return [...docs].sort((a, b) => {
    const scoreDelta = scoreDocument(b) - scoreDocument(a);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return String(a.id).localeCompare(String(b.id));
  })[0];
}

async function trimCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) {
    console.log(`${collectionName}: empty`);
    return;
  }

  if (snapshot.size === 1) {
    console.log(`${collectionName}: already has 1 document (${snapshot.docs[0].id})`);
    return;
  }

  const docToKeep = pickDocumentToKeep(snapshot.docs);
  const docsToDelete = snapshot.docs.filter((doc) => doc.id !== docToKeep.id);

  console.log(
    `${collectionName}: keeping ${docToKeep.id}, deleting ${docsToDelete.length} document(s)`,
  );

  while (docsToDelete.length > 0) {
    const batch = db.batch();
    docsToDelete.splice(0, 100).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function main() {
  console.log("Trimming Firestore collections to keep only 1 document each...");

  for (const collectionName of collections) {
    await trimCollection(collectionName);
  }

  console.log("Firestore trim complete.");
}

main()
  .catch((error) => {
    console.error("Firestore trim failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await admin.app().delete();
  });
