#!/usr/bin/env node

/**
 * CREATE FIRESTORE COLLECTIONS FOR Soteria REAL-TIME RESCUE
 *
 * Run this script to create agents and requests collections:
 * node scripts/create-collections.js
 *
 * This will:
 * 1. Create 'responders' collection with sample data
 * 2. Create 'requests' collection with sample data
 * 3. Set up proper field types for real-time queries
 */

import admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
try {
  const serviceAccountPath = path.join(
    __dirname,
    "../firebase-service-account.json"
  );

  if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ Error: firebase-service-account.json not found");
    console.error(`   Expected at: ${serviceAccountPath}`);
    console.error(
      "   Download it from Firebase Console > Project Settings > Service Accounts"
    );
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error("❌ Error initializing Firebase:", error.message);
  process.exit(1);
}

const db = admin.firestore();

async function createCollections() {
  console.log("\n🔥 Creating Firestore Collections for Soteria\n");
  console.log("=".repeat(60));

  try {
    // =====================================================================
    // CREATE RESPONDERS COLLECTION
    // =====================================================================
    console.log("\n1️⃣  Creating 'responders' collection...");

    const responderSampleData = {
      id: "responder_001",
      userId: "user_5432",
      businessName: "John's Auto Assist",
      serviceType: "mechanical",
      status: "offline",
      location: {
        latitude: 14.5528,
        longitude: 121.0115,
      },
      lastUpdated: Date.now(),
      rating: 4.8,
      phone: "+63912345678",
      verificationStatus: "approved",
    };

    const responderRef = db.collection("responders").doc("responder_001");
    await responderRef.set(responderSampleData);
    console.log("   ✅ Sample responder created: responder_001");
    console.log("      - businessName: John's Auto Assist");
    console.log("      - status: offline (change to 'online' when active)");
    console.log("      - location: 14.5528, 121.0115");

    // =====================================================================
    // CREATE REQUESTS COLLECTION
    // =====================================================================
    console.log("\n2️⃣  Creating 'requests' collection...");

    const requestSampleData = {
      id: "req_001",
      motoristId: "user_1234",
      responderId: "responder_001",
      status: "pending",
      motoristLocation: {
        latitude: 14.5548,
        longitude: 121.0105,
      },
      motoristName: "Maria Santos",
      serviceType: "tire_replacement",
      issue: "Flat tire on Makati Avenue",
      createdAt: Date.now(),
      acceptedAt: null,
      completedAt: null,
    };

    const requestRef = db.collection("requests").doc("req_001");
    await requestRef.set(requestSampleData);
    console.log("   ✅ Sample request created: req_001");
    console.log("      - motoristName: Maria Santos");
    console.log("      - status: pending");
    console.log("      - serviceType: tire_replacement");

    // =====================================================================
    // VERIFY COLLECTIONS
    // =====================================================================
    console.log("\n3️⃣  Verifying collections...");

    const agentsCount = (await db.collection("responders").count().get()).data()
      .count;
    const requestsCount = (await db.collection("requests").count().get()).data()
      .count;

    console.log(`   ✅ responders collection: ${agentsCount} document(s)`);
    console.log(`   ✅ requests collection: ${requestsCount} document(s)`);

    // =====================================================================
    // SUCCESS
    // =====================================================================
    console.log("\n" + "=".repeat(60));
    console.log("\n✅ SUCCESS! Collections created in Firestore\n");

    console.log("📋 What was created:");
    console.log(
      "   • responders/{responder_001} - Real-time responder location & status"
    );
    console.log("   • requests/{req_001} - Sample rescue request\n");

    console.log("🔗 Next steps:");
    console.log("   1. Go to Firebase Console");
    console.log("   2. Click Firestore Database");
    console.log("   3. You should see 'responders' and 'requests' collections");
    console.log("   4. Click on them to view the sample data\n");

    console.log("⚙️  To add more responders/requests:");
    console.log("   • Edit this file or create similar documents");
    console.log("   • Use your mobile app to create requests in real-time");
    console.log("   • Responders will appear when they go online\n");

    console.log("🚀 Ready to deploy!");
    console.log("   Next: Deploy security rules and backend endpoints\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating collections:", error.message);
    console.error("\nTroubleshooting:");
    console.error(
      "   • Check firebase-service-account.json exists and is valid"
    );
    console.error("   • Verify Firebase project is initialized");
    console.error("   • Check internet connection");
    process.exit(1);
  }
}

// Run the function
createCollections();
