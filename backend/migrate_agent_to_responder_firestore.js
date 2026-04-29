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
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

async function copyCollection(sourceName, targetName) {
  const snapshot = await db.collection(sourceName).get();

  if (snapshot.empty) {
    console.log(`No documents found in ${sourceName}.`);
    return 0;
  }

  let copied = 0;
  for (const doc of snapshot.docs) {
    const targetRef = db.collection(targetName).doc(doc.id);
    const targetDoc = await targetRef.get();

    if (targetDoc.exists) {
      continue;
    }

    await targetRef.set({
      ...doc.data(),
      migrated_from: sourceName,
      migrated_at: serverTimestamp(),
    });
    copied += 1;
  }

  console.log(`Copied ${copied} document(s) from ${sourceName} to ${targetName}.`);
  return copied;
}

async function backfillRequestResponderId() {
  const snapshot = await db.collection("requests").get();
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const responderId = data.responderId ?? data.agentId ?? null;

    if (!responderId || data.responderId === responderId) {
      continue;
    }

    await doc.ref.update({
      responderId,
      updatedAt: serverTimestamp(),
    });
    updated += 1;
  }

  console.log(`Backfilled responderId on ${updated} request document(s).`);
  return updated;
}

async function backfillDispatchResponderUserId() {
  const snapshot = await db.collection("dispatches").get();
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const responderUserId = data.responder_user_id ?? data.agent_user_id ?? null;

    if (!responderUserId || data.responder_user_id === responderUserId) {
      continue;
    }

    await doc.ref.update({
      responder_user_id: responderUserId,
      updated_at: serverTimestamp(),
    });
    updated += 1;
  }

  console.log(`Backfilled responder_user_id on ${updated} dispatch document(s).`);
  return updated;
}

async function migrate() {
  console.log("Starting non-destructive Firestore agent-to-responder migration...");

  await copyCollection("agent_profiles", "responder_profiles");
  await copyCollection("agent_applications", "responder_applications");
  await copyCollection("agents", "responders");
  await backfillRequestResponderId();
  await backfillDispatchResponderUserId();

  console.log("Migration complete. Legacy agent collections and fields were left in place for compatibility.");
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
