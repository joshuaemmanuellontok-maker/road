import { db, collections } from "./src/firebase.js";

const RECENT_LIMIT = Number(process.env.RECENT_LIMIT ?? 20);

function formatValue(value) {
  if (!value) {
    return value;
  }
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return value;
}

function compactData(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, formatValue(value)]),
  );
}

async function getCount(collectionName) {
  const snapshot = await db.collection(collectionName).count().get();
  return snapshot.data().count;
}

async function recentDocs(collectionName, orderFields) {
  for (const field of orderFields) {
    try {
      const snapshot = await db.collection(collectionName)
        .orderBy(field, "desc")
        .limit(RECENT_LIMIT)
        .get();
      return {
        orderedBy: field,
        docs: snapshot.docs.map((doc) => ({ id: doc.id, ...compactData(doc.data()) })),
      };
    } catch {
      // Try the next likely timestamp field.
    }
  }

  const snapshot = await db.collection(collectionName).limit(RECENT_LIMIT).get();
  return {
    orderedBy: null,
    docs: snapshot.docs.map((doc) => ({ id: doc.id, ...compactData(doc.data()) })),
  };
}

async function main() {
  const collectionNames = [
    collections.dispatches,
    "requests",
    "service_payments",
    "responder_payouts",
    collections.dispatchFeedback,
    collections.emergencyReports,
  ];

  console.log("Collection counts:");
  for (const collectionName of collectionNames) {
    console.log(`${collectionName}: ${await getCount(collectionName)}`);
  }

  for (const collectionName of collectionNames) {
    const recent = await recentDocs(collectionName, [
      "updated_at",
      "created_at",
      "requested_at",
      "paid_at",
      "completed_at",
      "timestamp",
    ]);
    console.log(`\nRecent ${collectionName} docs ordered by ${recent.orderedBy ?? "natural order"}:`);
    console.log(JSON.stringify(recent.docs, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
