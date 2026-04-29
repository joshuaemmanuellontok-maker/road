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

const operationalCollections = [
  "dispatches",
  "emergency_reports",
  "emergency_report_symptoms",
  "requests",
  "responder_applications",
  "agent_applications",
];

const allAppCollections = [
  "users",
  "motorist_profiles",
  "admin_profiles",
  "responder_profiles",
  "agent_profiles",
  "repair_shops",
  ...operationalCollections,
  "_initialization",
];

async function deleteCollection(collectionName, batchSize = 50) {
  let totalDeleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionName).limit(batchSize).get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snapshot.size;
    console.log(`Deleted ${snapshot.size} document(s) from ${collectionName}...`);
  }

  return totalDeleted;
}

async function main() {
  const wipeAll = process.argv.includes("--all");
  const collections = wipeAll ? allAppCollections : operationalCollections;

  console.log(
    wipeAll
      ? "Cleaning all KalsadaKonek Firestore collections..."
      : "Cleaning operational Firestore collections...",
  );

  for (const collectionName of collections) {
    const deleted = await deleteCollection(collectionName);
    console.log(`Finished ${collectionName}: ${deleted} document(s) deleted.`);
  }

  console.log("Firestore cleanup complete.");
}

main()
  .catch((error) => {
    console.error("Firestore cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await admin.app().delete();
  });
