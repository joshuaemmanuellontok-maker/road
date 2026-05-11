import admin from "firebase-admin";
import { db, collections, legacyCollections, serverTimestamp } from "./src/firebase.js";

const GCASH_NAME = String(process.env.GCASH_NAME ?? "").trim();
const GCASH_NUMBER = String(process.env.GCASH_NUMBER ?? "").trim();
const TARGET_USERNAME = process.env.RESPONDER_USERNAME ?? "agent";
const TARGET_USER_ID = process.env.RESPONDER_USER_ID ?? "";
const PROFILE_COLLECTIONS = [collections.agentProfiles, legacyCollections.agentProfiles];
const RETRYABLE_PAYOUT_STATUSES = new Set(["failed", "details_required", "awaiting_wallet_funding", "queued"]);

function normalizePayoutAccountNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

async function findResponderUserId() {
  if (TARGET_USER_ID) {
    return TARGET_USER_ID;
  }

  const users = await db.collection(collections.users)
    .where("username", "==", TARGET_USERNAME)
    .limit(1)
    .get();

  return users.docs[0]?.id ?? "";
}

async function updateResponderProfiles(userId) {
  let updated = 0;

  for (const collectionName of PROFILE_COLLECTIONS) {
    const snapshot = await db.collection(collectionName).where("user_id", "==", userId).get();
    for (const doc of snapshot.docs) {
      await doc.ref.update({
        payout_gcash_name: GCASH_NAME,
        payout_gcash_number: normalizePayoutAccountNumber(GCASH_NUMBER),
        payout_notes: "",
        updated_at: serverTimestamp(),
      });
      updated += 1;
      console.log(`Updated ${collectionName}/${doc.id}`);
    }
  }

  return updated;
}

async function updateRetryablePayouts(userId) {
  const snapshot = await db.collection("responder_payouts")
    .where("responder_user_id", "==", userId)
    .get();

  let updated = 0;
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const payout = doc.data();
    const status = String(payout.status ?? "");
    if (!RETRYABLE_PAYOUT_STATUSES.has(status)) {
      continue;
    }

    batch.update(doc.ref, {
      destination_name: GCASH_NAME,
      destination_account: normalizePayoutAccountNumber(GCASH_NUMBER),
      destination_notes: "",
      status: "queued",
      failure_reason: "",
      provider_status: status === "details_required" ? null : payout.provider_status ?? null,
      next_retry_at: admin.firestore.FieldValue.delete(),
      updated_at: serverTimestamp(),
    });
    updated += 1;
  }

  if (updated > 0) {
    await batch.commit();
  }

  return updated;
}

async function main() {
  if (!GCASH_NAME || !GCASH_NUMBER) {
    throw new Error("Set GCASH_NAME and GCASH_NUMBER to an active recipient before running this script.");
  }

  const userId = await findResponderUserId();
  if (!userId) {
    throw new Error(`Responder user not found. Set RESPONDER_USER_ID or RESPONDER_USERNAME. Current username: ${TARGET_USERNAME}`);
  }

  const profileCount = await updateResponderProfiles(userId);
  const payoutCount = await updateRetryablePayouts(userId);

  console.log(`Done. Responder ${userId} now uses ${GCASH_NAME} / ${normalizePayoutAccountNumber(GCASH_NUMBER)}.`);
  console.log(`Profiles updated: ${profileCount}`);
  console.log(`Retryable payout records requeued: ${payoutCount}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
