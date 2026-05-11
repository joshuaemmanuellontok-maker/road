import bcrypt from "bcryptjs";
import cors from "cors";
import { createHmac, timingSafeEqual } from "crypto";
import dotenv from "dotenv";
import express from "express";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { db, collections, legacyCollections, serverTimestamp, auth } from "./firebase.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? "*";
const uploadsRoot = join(__dirname, "..", "uploads");
const responderProfileCollections = [collections.agentProfiles, legacyCollections.agentProfiles];
const responderApplicationCollections = [collections.agentApplications, legacyCollections.agentApplications];

app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin.split(",") }));
app.use("/api/payments/webhooks/paymongo", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "25mb" }));
app.use("/uploads", express.static(uploadsRoot));

let firestoreQuotaBackoffUntil = 0;
const FIRESTORE_QUOTA_BACKOFF_MS = 10 * 60 * 1000;

function isQuotaExceededError(error) {
  return error?.code === 8 || String(error?.details ?? "").toLowerCase().includes("quota exceeded");
}

function markFirestoreQuotaExceeded(error) {
  if (isQuotaExceededError(error)) {
    firestoreQuotaBackoffUntil = Date.now() + FIRESTORE_QUOTA_BACKOFF_MS;
  }
}

function isFirestoreBackoffActive() {
  return Date.now() < firestoreQuotaBackoffUntil;
}

function getFirestoreBackoffMessage() {
  return "Firestore quota exceeded. Please wait a moment and try again.";
}

function sanitizeFileName(value) {
  return String(value ?? "document")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "document";
}

function readDataUrlPayload(dataUrl) {
  const match = String(dataUrl ?? "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid credential file payload.");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function saveCredentialFiles(userId, credentialFiles = {}) {
  const entries = Object.entries(credentialFiles).filter(([, value]) => value && typeof value === "object");
  if (entries.length === 0) {
    return {};
  }

  const targetDir = join(uploadsRoot, "agent-credentials", userId);
  await mkdir(targetDir, { recursive: true });

  const savedEntries = await Promise.all(entries.map(async ([key, value]) => {
    const file = value ?? {};
    const { mimeType, buffer } = readDataUrlPayload(file.dataUrl);
    const safeName = sanitizeFileName(file.name || `${key}.bin`);
    const savedName = `${Date.now()}_${safeName}`;
    const absolutePath = join(targetDir, savedName);

    await writeFile(absolutePath, buffer);

    return [
      key,
      {
        name: safeName,
        contentType: file.type || mimeType || "application/octet-stream",
        sizeBytes: buffer.length,
        url: `/uploads/agent-credentials/${userId}/${savedName}`,
      },
    ];
  }));

  return Object.fromEntries(savedEntries);
}

async function saveBalanceProofFile(userId, file) {
  if (!file || typeof file !== "object") {
    return null;
  }

  const { mimeType, buffer } = readDataUrlPayload(file.dataUrl);
  const safeName = sanitizeFileName(file.name || "gcash-balance-proof.jpg");
  const targetDir = join(uploadsRoot, "agent-balance-proofs", userId);
  await mkdir(targetDir, { recursive: true });

  const savedName = `${Date.now()}_${safeName}`;
  const absolutePath = join(targetDir, savedName);

  await writeFile(absolutePath, buffer);

  return {
    name: safeName,
    contentType: file.type || mimeType || "application/octet-stream",
    sizeBytes: buffer.length,
    url: `/uploads/agent-balance-proofs/${userId}/${savedName}`,
  };
}

// Firebase helper functions
async function createDocument(collection, data) {
  const docRef = db.collection(collection).doc();
  await docRef.set({
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    id: docRef.id
  });
  return docRef.id;
}

async function updateDocument(collection, id, data) {
  const docRef = db.collection(collection).doc(id);
  await docRef.update({
    ...data,
    updated_at: serverTimestamp()
  });
  return id;
}

async function getDocument(collection, id) {
  if (isFirestoreBackoffActive()) {
    const error = new Error(getFirestoreBackoffMessage());
    error.code = 8;
    throw error;
  }

  const doc = await db.collection(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getDocuments(collection, conditions = {}) {
  if (isFirestoreBackoffActive()) {
    const error = new Error(getFirestoreBackoffMessage());
    error.code = 8;
    throw error;
  }

  let query = db.collection(collection);

  // Apply conditions
  Object.entries(conditions).forEach(([field, value]) => {
    if (value !== undefined && value !== null) {
      query = query.where(field, '==', value);
    }
  });

  try {
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    markFirestoreQuotaExceeded(error);
    throw error;
  }
}

function mergeById(documents) {
  const seen = new Set();
  return documents.filter((document) => {
    const key = document.user_id ? `user:${document.user_id}` : document.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function getDocumentsFromCollections(collectionNames, conditions = {}) {
  const groups = await Promise.all(
    collectionNames.map(async (collection) =>
      (await getDocuments(collection, conditions)).map((document) => ({
        ...document,
        __collection: collection,
      })),
    ),
  );

  return mergeById(groups.flat());
}

async function getDocumentFromCollections(collectionNames, id) {
  for (const collection of collectionNames) {
    const document = await getDocument(collection, id);
    if (document) {
      return { ...document, __collection: collection };
    }
  }

  return null;
}

async function deleteDocumentsByConditionsFromCollections(collectionNames, conditions = {}) {
  const groups = await Promise.all(
    collectionNames.map(async (collection) => {
      const documents = await getDocuments(collection, conditions);
      await Promise.all(documents.map((document) => deleteDocument(collection, document.id)));
      return documents;
    }),
  );

  return groups.flat();
}

async function getAgentProfileByUserId(userId) {
  if (isFirestoreBackoffActive()) {
    const error = new Error(getFirestoreBackoffMessage());
    error.code = 8;
    throw error;
  }

  for (const collection of responderProfileCollections) {
    const snapshot = await db
      .collection(collection)
      .where("user_id", "==", userId)
      .limit(1)
      .get()
      .catch((error) => {
        markFirestoreQuotaExceeded(error);
        throw error;
      });

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, __collection: collection, ...doc.data() };
    }
  }

  return null;
}

async function getAgentProfileDocumentsByUserId(userId) {
  if (isFirestoreBackoffActive()) {
    const error = new Error(getFirestoreBackoffMessage());
    error.code = 8;
    throw error;
  }

  const profiles = [];
  const seen = new Set();

  for (const collection of responderProfileCollections) {
    const snapshots = await Promise.all([
      db.collection(collection).where("user_id", "==", userId).get(),
      db.collection(collection).doc(userId).get(),
    ]).catch((error) => {
      markFirestoreQuotaExceeded(error);
      throw error;
    });

    for (const snapshot of snapshots) {
      const docs = "docs" in snapshot ? snapshot.docs : snapshot.exists ? [snapshot] : [];
      for (const doc of docs) {
        const key = `${collection}/${doc.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          profiles.push({ id: doc.id, __collection: collection, ...doc.data() });
        }
      }
    }
  }

  return profiles;
}

async function updateAgentProfileByUserId(userId, data) {
  const profiles = await getAgentProfileDocumentsByUserId(userId);

  if (profiles.length === 0) {
    throw new Error(`Responder profile not found for user ${userId}.`);
  }

  await Promise.all(
    profiles.map((profile) => updateDocument(profile.__collection ?? collections.agentProfiles, profile.id, data)),
  );
  return profiles[0].id;
}

async function deleteDocument(collection, id) {
  await db.collection(collection).doc(id).delete();
}

async function deleteDocumentsByConditions(collection, conditions = {}) {
  const documents = await getDocuments(collection, conditions);
  await Promise.all(documents.map((document) => deleteDocument(collection, document.id)));
  return documents;
}

async function deleteDispatchArtifacts(dispatchId) {
  await deleteDocumentsByConditions(collections.dispatchFeedback, {
    dispatch_id: dispatchId,
  });

  await deleteDocument(collections.dispatches, dispatchId);
}

async function deleteEmergencyReportArtifacts(reportId) {
  const dispatches = await getDocuments(collections.dispatches, {
    emergency_report_id: reportId,
  });

  await Promise.all(dispatches.map((dispatch) => deleteDispatchArtifacts(dispatch.id)));

  await deleteDocumentsByConditions(collections.emergencyReportSymptoms, {
    emergency_report_id: reportId,
  });

  await deleteDocument(collections.emergencyReports, reportId);
}

async function deleteForumContentByUser(userId) {
  const threads = await getDocuments(collections.forumThreads, {
    author_user_id: userId,
  });

  await Promise.all(
    threads.map(async (thread) => {
      await deleteDocumentsByConditions(collections.forumReplies, {
        thread_id: thread.id,
      });
      await deleteDocument(collections.forumThreads, thread.id);
    }),
  );

  await deleteDocumentsByConditions(collections.forumReplies, {
    author_user_id: userId,
  });
}

async function deleteUserArtifacts(user) {
  if (!user) {
    return;
  }

  if (user.role === "motorist") {
    const reports = await getDocuments(collections.emergencyReports, {
      motorist_user_id: user.id,
    });
    await Promise.all(reports.map((report) => deleteEmergencyReportArtifacts(report.id)));
    await deleteDocumentsByConditions(collections.motoristProfiles, { user_id: user.id });
    await deleteDocumentsByConditions(collections.subscriptionPayments, { user_id: user.id });
  }

  if (user.role === "agent") {
    const legacyDispatches = await getDocuments(collections.dispatches, {
      agent_user_id: user.id,
    });
    const responderDispatches = await getDocuments(collections.dispatches, {
      responder_user_id: user.id,
    });
    const dispatches = mergeById([...legacyDispatches, ...responderDispatches]);
    await Promise.all(dispatches.map((dispatch) => deleteDispatchArtifacts(dispatch.id)));
    await deleteDocumentsByConditionsFromCollections(responderProfileCollections, { user_id: user.id });
    await deleteDocumentsByConditionsFromCollections(responderApplicationCollections, { user_id: user.id });
  }

  if (user.role === "community") {
    await deleteDocumentsByConditions(collections.communityRedemptions, { user_id: user.id });
  }

  await deleteForumContentByUser(user.id);
  await deleteDocument(collections.users, user.id);

  try {
    await auth.deleteUser(user.id);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      console.warn(`[ADMIN DELETE] Failed to delete auth user ${user.id}:`, error);
    }
  }
}

// User authentication helpers
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

function normalizeRepairShop(data) {
  return {
    id: data.id,
    name: data.name,
    owner_name: data.owner_name ?? "",
    category: data.category ?? data.service_type ?? "mechanical",
    rating: Number(data.rating ?? 0),
    distance_km: Number(data.distance_km ?? data.distanceKm ?? 0),
    address: data.address ?? "",
    response_time: data.response_time ?? data.responseTime ?? "~15 min",
    open_now: Boolean(data.open_now ?? data.openNow ?? data.status === "active"),
    phone: data.phone ?? data.contact_number ?? null,
    email: data.email ?? "",
    status: data.status ?? (data.open_now === false ? "inactive" : "active"),
    latitude: Number(data.latitude ?? 0),
    longitude: Number(data.longitude ?? 0),
    services: Array.isArray(data.services) ? data.services : ["Roadside assistance"],
  };
}

function normalizeRepairShopCategory(value) {
  const category = String(value ?? "").trim().toLowerCase();
  const allowed = new Set(["mechanical", "vulcanizing", "towing", "electrical"]);
  return allowed.has(category) ? category : "mechanical";
}

function normalizeRepairShopPayload(payload = {}) {
  const name = String(payload.name ?? "").trim();
  const address = String(payload.address ?? "").trim();
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);

  if (!name || !address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error("name, address, latitude, and longitude are required.");
    error.statusCode = 400;
    throw error;
  }

  const services = Array.isArray(payload.services)
    ? payload.services.map((item) => String(item ?? "").trim()).filter(Boolean)
    : String(payload.services ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  return {
    name,
    owner_name: String(payload.ownerName ?? payload.owner_name ?? "").trim(),
    contact_number: String(payload.phone ?? payload.contact_number ?? "").trim(),
    email: String(payload.email ?? "").trim(),
    address,
    latitude,
    longitude,
    category: normalizeRepairShopCategory(payload.category),
    rating: Number.isFinite(Number(payload.rating)) ? Number(payload.rating) : 4.5,
    distance_km: Number.isFinite(Number(payload.distanceKm ?? payload.distance_km))
      ? Number(payload.distanceKm ?? payload.distance_km)
      : 0,
    response_time: String(payload.responseTime ?? payload.response_time ?? "~15 min").trim() || "~15 min",
    status: payload.status === "inactive" ? "inactive" : "active",
    open_now: payload.openNow === false || payload.open_now === false || payload.status === "inactive"
      ? false
      : true,
    services: services.length ? services : ["Roadside assistance"],
  };
}

function getDispatchResponderUserId(dispatch) {
  return dispatch?.responder_user_id ?? dispatch?.agent_user_id ?? null;
}

function getRequestResponderId(requestData) {
  return requestData?.responderId ?? requestData?.agentId ?? null;
}

async function resolveUserReference(identifier) {
  // Try to find user by username, email, or phone
  const conditions = [
    { username: identifier },
    { email: identifier },
    { phone: identifier }
  ];

  for (const condition of conditions) {
    const [field, value] = Object.entries(condition)[0];
    let query = db.collection(collections.users);
    if (value !== undefined && value !== null) {
      query = query.where(field, '==', value);
    }

    const snapshot = await query.get();
    if (!snapshot.empty) {
      return { userId: snapshot.docs[0].id, userProfileId: null };
    }
  }

  return { userId: null, userProfileId: null };
}

async function createMotorist(payload) {
  const userId = await createDocument(collections.users, {
    full_name: payload.fullName,
    username: payload.username,
    email: payload.email ?? `${payload.username}@roadresq.local`,
    password_hash: await hashPassword(payload.password),
    phone: payload.mobileNumber,
    role: "motorist",
    status: "active",
    subscription_status: "inactive",
    subscription_plan: null,
    subscription_activated_at: null,
    subscription_expires_at: null,
    soteria_credit_balance: 0,
    soteria_credit_updated_at: null,
  });

  await createDocument(collections.motoristProfiles, {
    user_id: userId,
  });

  return { id: userId, email: payload.email ?? `${payload.username}@roadresq.local` };
}

async function createCommunityUser(payload) {
  const userId = await createDocument(collections.users, {
    full_name: payload.fullName,
    username: payload.username,
    email: payload.email ?? `${payload.username}@roadresq.local`,
    password_hash: await hashPassword(payload.password),
    phone: payload.mobileNumber,
    role: "community",
    status: "active",
    community_coin_balance: 0,
    community_lifetime_coins: 0,
    community_last_visit_reward_at: null,
    community_last_coin_activity_at: null,
    community_coin_lock_until: null,
    community_daily_coin_date: null,
    community_daily_earned_coins: 0,
    community_daily_thread_count: 0,
    community_daily_reply_count: 0,
  });

  return { id: userId, email: payload.email ?? `${payload.username}@roadresq.local` };
}

async function createAgentApplication(payload) {
  const requestedServiceCategories = Array.isArray(payload.serviceCategories)
    ? payload.serviceCategories
    : payload.serviceCategory
      ? [payload.serviceCategory]
      : [];

  const normalizedServiceCategories = Array.from(
    new Set(
      requestedServiceCategories
        .map((value) => normalizeServiceType(value))
        .filter(Boolean),
    ),
  );

  if (normalizedServiceCategories.length === 0) {
    throw new Error("At least one service category is required.");
  }

  const userId = await createDocument(collections.users, {
    full_name: payload.ownerName,
    username: payload.username,
    email: `${payload.username}@roadresq.local`,
    password_hash: await hashPassword(payload.password),
    phone: payload.mobileNumber,
    role: "agent",
    status: "pending",
  });

  const savedCredentials = await saveCredentialFiles(userId, payload.credentialFiles);

  await createDocument(collections.agentProfiles, {
    user_id: userId,
    business_name: payload.ownerName,
    organization_name: payload.organizationName ?? "",
    service_type: normalizedServiceCategories[0],
    service_types: normalizedServiceCategories,
    service_area: payload.serviceArea,
    verification_status: "pending",
    is_available: false,
    payout_gcash_name: "",
    payout_gcash_number: "",
    payout_notes: "",
    liability_acknowledged: Boolean(payload.liabilityAcknowledged),
    wallet_readiness_tier: null,
    cash_assist_enabled: false,
    balance_proof_status: "missing",
    balance_proof_asset: null,
    balance_proof_submitted_at: null,
    balance_proof_reviewed_at: null,
    balance_proof_expires_at: null,
    balance_proof_approved_by: null,
    balance_proof_rejection_reason: "",
  });

  const applicationId = await createDocument(collections.agentApplications, {
    user_id: userId,
    status: "pending",
    remarks: JSON.stringify({
      serviceArea: payload.serviceArea,
      serviceCategories: normalizedServiceCategories,
      organizationName: String(payload.organizationName ?? "").trim(),
      liabilityAcknowledged: Boolean(payload.liabilityAcknowledged),
      credentials: Object.keys(savedCredentials).length > 0
        ? savedCredentials
        : (payload.credentialManifest ?? {}),
    }),
  });

  return { id: applicationId, userId };
}

async function findNearbyAgent(motoristLat, motoristLng, serviceType) {
  // Get all available agents
  const agents = await getDocumentsFromCollections(responderProfileCollections, {
    is_available: true,
    verification_status: "approved"
  });
  const now = Date.now();
  const freshnessWindowMs = 15 * 60 * 1000;

  // Filter agents with valid location and calculate distance
  const agentsWithDistance = agents
    .filter(agent => agent.current_latitude != null && agent.current_longitude != null)
    .filter(agent => {
      const updatedAtMs = getAgentLocationTimestampMs(agent);
      return updatedAtMs ? now - updatedAtMs <= freshnessWindowMs : false;
    })
    .map(agent => {
      const distance = calculateDistance(
        motoristLat, motoristLng,
        agent.current_latitude, agent.current_longitude
      );
      return {
        ...agent,
        distance_km: distance,
        ...rankNearbyAgent(serviceType, agent),
      };
    })
    .filter(agent => agent.distance_km <= 50)
    .filter(agent => agent.compatibleServiceMatch)
    .sort((a, b) => {
      if (a.exactServiceMatch !== b.exactServiceMatch) {
        return a.exactServiceMatch ? -1 : 1;
      }

      if (a.distance_km !== b.distance_km) {
        return a.distance_km - b.distance_km;
      }

      return b.lastLocationUpdateMs - a.lastLocationUpdateMs;
    });

  return agentsWithDistance[0] || null;
}

async function buildDispatchDetails(dispatch) {
  const emergencyReport = dispatch.emergency_report_id
    ? await getDocument(collections.emergencyReports, dispatch.emergency_report_id)
    : null;

  const motoristUser = emergencyReport?.motorist_user_id
    ? await getDocument(collections.users, emergencyReport.motorist_user_id)
    : null;

  const symptomSnapshot = emergencyReport
    ? await db
        .collection(collections.emergencyReportSymptoms)
        .where("emergency_report_id", "==", emergencyReport.id)
        .get()
    : null;

  const symptoms = symptomSnapshot
    ? symptomSnapshot.docs.map((doc) => doc.data().symptom_text).filter(Boolean)
    : [];

  const responderUserId = getDispatchResponderUserId(dispatch);
  const agentUser = responderUserId
    ? await getDocument(collections.users, responderUserId)
    : null;

  const agentProfile = responderUserId
    ? await getAgentProfileByUserId(responderUserId)
    : null;

  return {
    id: dispatch.id,
    emergencyReportId: dispatch.emergency_report_id ?? null,
    agentUserId: responderUserId,
    responderUserId,
    repairShopId: dispatch.repair_shop_id ?? null,
    dispatchStatus: dispatch.dispatch_status,
    assignedAt: dispatch.created_at ?? null,
    acceptedAt: dispatch.accepted_at ?? null,
    arrivedAt: dispatch.arrived_at ?? null,
    completedAt: dispatch.completed_at ?? null,
    payment:
      dispatch.total_amount != null ||
      dispatch.service_amount != null ||
      dispatch.commission_amount != null ||
      dispatch.commission_rate != null
        ? {
            totalAmount: Number(dispatch.total_amount ?? 0),
            baseServiceAmount: Number(dispatch.base_service_amount ?? dispatch.total_amount ?? 0),
            payoutTransferFee: Number(dispatch.payout_transfer_fee ?? 0),
            serviceAmount: Number(dispatch.service_amount ?? 0),
            commissionAmount: Number(dispatch.commission_amount ?? 0),
            commissionRate: Number(dispatch.commission_rate ?? 0),
            subscriptionStatus: dispatch.motorist_subscription_status === "active" ? "active" : "inactive",
            subscriptionPlan: normalizeSubscriptionPlan(dispatch.motorist_subscription_plan),
            paymentStatus: dispatch.payment_status ?? "system_received",
            paymentMethod: dispatch.payment_method ?? "soteria_credits",
            payoutStatus: dispatch.payout_status ?? "auto_transferred",
            payoutTransferredAt: formatFirestoreDateTime(dispatch.payout_transferred_at),
            transferReference: dispatch.transfer_reference ?? null,
            creditBalanceAfter:
              dispatch.credit_balance_after != null ? Number(dispatch.credit_balance_after) : null,
          }
        : null,
    motorist: emergencyReport && motoristUser
      ? {
          id: motoristUser.id,
          fullName: motoristUser.full_name,
          phone: motoristUser.phone,
          latitude: emergencyReport.latitude,
          longitude: emergencyReport.longitude,
          locationLabel: emergencyReport.location_label ?? emergencyReport.vehicle_type ?? "",
          issueSummary: emergencyReport.issue_summary ?? "",
          symptoms,
        }
      : null,
    agent: agentUser && agentProfile
      ? {
          id: agentUser.id,
          fullName: agentUser.full_name,
          phone: agentUser.phone,
          businessName: agentProfile.business_name,
          currentLatitude: agentProfile.current_latitude ?? null,
          currentLongitude: agentProfile.current_longitude ?? null,
        }
      : null,
  };
}

function buildDispatchFeedbackId(dispatchId, reviewerRole, reviewerUserId) {
  return `${dispatchId}_${reviewerRole}_${reviewerUserId}`;
}

function isValidRating(value) {
  return Number.isFinite(value) && value >= 1 && value <= 5;
}

function normalizeCategoryRatings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const normalized = {};

  for (const [key, rating] of Object.entries(value)) {
    const numericRating = Number(rating);
    if (!isValidRating(numericRating)) {
      return null;
    }
    normalized[key] = numericRating;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

async function getDispatchFeedback(dispatchId, reviewerRole, reviewerUserId) {
  const feedbackId = buildDispatchFeedbackId(dispatchId, reviewerRole, reviewerUserId);
  return getDocument(collections.dispatchFeedback, feedbackId);
}

async function listDispatchFeedback(dispatchId) {
  return getDocuments(collections.dispatchFeedback, {
    dispatch_id: dispatchId,
  });
}

function serializeDispatchDetails(details) {
  if (!details) {
    return null;
  }

  return {
    id: details.id,
    emergencyReportId: details.emergencyReportId ?? null,
    agentUserId: details.agentUserId ?? null,
    repairShopId: details.repairShopId ?? null,
    dispatchStatus: details.dispatchStatus ?? "",
    assignedAt: formatFirestoreDateTime(details.assignedAt),
    acceptedAt: formatFirestoreDateTime(details.acceptedAt),
    arrivedAt: formatFirestoreDateTime(details.arrivedAt),
    completedAt: formatFirestoreDateTime(details.completedAt),
    payment: details.payment
      ? {
          serviceAmount: Number(details.payment.serviceAmount ?? 0),
          totalAmount: Number(details.payment.totalAmount ?? 0),
          baseServiceAmount: Number(details.payment.baseServiceAmount ?? details.payment.totalAmount ?? 0),
          payoutTransferFee: Number(details.payment.payoutTransferFee ?? 0),
          commissionAmount: Number(details.payment.commissionAmount ?? 0),
          commissionRate: Number(details.payment.commissionRate ?? 0),
          subscriptionStatus: details.payment.subscriptionStatus ?? "inactive",
          subscriptionPlan: details.payment.subscriptionPlan ?? null,
          paymentStatus: details.payment.paymentStatus ?? "system_received",
          paymentMethod: details.payment.paymentMethod ?? "soteria_credits",
          payoutStatus: details.payment.payoutStatus ?? "auto_transferred",
          payoutTransferredAt: details.payment.payoutTransferredAt ?? null,
          transferReference: details.payment.transferReference ?? null,
          creditBalanceAfter:
            details.payment.creditBalanceAfter != null ? Number(details.payment.creditBalanceAfter) : null,
        }
      : null,
    motorist: details.motorist
      ? {
          id: details.motorist.id,
          fullName: details.motorist.fullName ?? "",
          phone: details.motorist.phone ?? "",
          latitude: Number(details.motorist.latitude ?? 0),
          longitude: Number(details.motorist.longitude ?? 0),
          locationLabel: details.motorist.locationLabel ?? "",
          issueSummary: details.motorist.issueSummary ?? "",
          symptoms: Array.isArray(details.motorist.symptoms) ? details.motorist.symptoms : [],
        }
      : null,
    agent: details.agent
      ? {
          id: details.agent.id,
          fullName: details.agent.fullName ?? "",
          phone: details.agent.phone ?? "",
          businessName: details.agent.businessName ?? "",
          currentLatitude: details.agent.currentLatitude ?? null,
          currentLongitude: details.agent.currentLongitude ?? null,
        }
      : null,
  };
}

function serializeDispatchFeedback(feedback) {
  if (!feedback) {
    return null;
  }

  return {
    id: feedback.id,
    dispatchId: feedback.dispatch_id ?? feedback.dispatchId ?? "",
    emergencyReportId: feedback.emergency_report_id ?? feedback.emergencyReportId ?? null,
    reviewerUserId: feedback.reviewer_user_id ?? feedback.reviewerUserId ?? "",
    reviewerName: feedback.reviewer_name ?? feedback.reviewerName ?? "",
    reviewerRole: feedback.reviewer_role ?? feedback.reviewerRole ?? "motorist",
    revieweeUserId: feedback.reviewee_user_id ?? feedback.revieweeUserId ?? "",
    revieweeName: feedback.reviewee_name ?? feedback.revieweeName ?? "",
    revieweeRole: feedback.reviewee_role ?? feedback.revieweeRole ?? "agent",
    overallRating: Number(feedback.overall_rating ?? feedback.overallRating ?? 0),
    categoryRatings: feedback.category_ratings ?? feedback.categoryRatings ?? {},
    paidCorrectAmount:
      typeof (feedback.paid_correct_amount ?? feedback.paidCorrectAmount) === "boolean"
        ? Boolean(feedback.paid_correct_amount ?? feedback.paidCorrectAmount)
        : null,
    comment: feedback.comment ?? "",
    submittedAt: formatFirestoreDateTime(feedback.submitted_at ?? feedback.submittedAt),
  };
}

async function listFeedbackHistoryForUser(userId, role) {
  const [submitted, received] = await Promise.all([
    getDocuments(collections.dispatchFeedback, {
      reviewer_user_id: userId,
      reviewer_role: role,
    }),
    getDocuments(collections.dispatchFeedback, {
      reviewee_user_id: userId,
      reviewee_role: role,
    }),
  ]);

  const deduped = new Map();

  for (const item of [...submitted, ...received]) {
    deduped.set(item.id, item);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const aMs = a.submitted_at?.toDate?.()?.getTime?.() ?? 0;
    const bMs = b.submitted_at?.toDate?.()?.getTime?.() ?? 0;
    return bMs - aMs;
  });
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function readSoteriaCreditBalance(user) {
  return roundCurrency(Number(user?.soteria_credit_balance ?? 0));
}

function formatSoteriaCredits(user) {
  return {
    userId: user?.id ?? "",
    balance: readSoteriaCreditBalance(user),
  };
}

function getPayMongoConfig() {
  return {
    secretKey: process.env.PAYMONGO_SECRET_KEY ?? "",
    webhookSecret: process.env.PAYMONGO_WEBHOOK_SECRET ?? "",
    signatureMode: (process.env.PAYMONGO_SIGNATURE_MODE ?? "test").toLowerCase() === "live" ? "li" : "te",
  };
}

function encodePayMongoAuth(secretKey) {
  return Buffer.from(`${secretKey}:`).toString("base64");
}

async function createPayMongoLink({ amount, description, reference }) {
  const { secretKey } = getPayMongoConfig();
  if (!secretKey) {
    const error = new Error("PayMongo is not configured. Add PAYMONGO_SECRET_KEY to backend/.env.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch("https://api.paymongo.com/v1/links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodePayMongoAuth(secretKey)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: Math.round(amount * 100),
          description,
          remarks: reference,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.errors?.[0]?.detail ?? payload?.errors?.[0]?.code ?? "PayMongo link creation failed.";
    const error = new Error(detail);
    error.statusCode = response.status;
    throw error;
  }

  const data = payload?.data ?? {};
  const attributes = data.attributes ?? {};

  return {
    provider: "paymongo",
    providerLinkId: data.id ?? "",
    providerReferenceNumber: attributes.reference_number ?? "",
    paymentUrl: attributes.checkout_url ?? "",
    status: attributes.status ?? "active",
  };
}

async function fetchPayMongoLink(providerLinkId) {
  const { secretKey } = getPayMongoConfig();
  if (!secretKey || !providerLinkId) {
    return null;
  }

  const response = await fetch(`https://api.paymongo.com/v1/links/${providerLinkId}`, {
    headers: {
      Authorization: `Basic ${encodePayMongoAuth(secretKey)}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  return payload?.data ?? null;
}

async function syncPaidServicePaymentFromPayMongo(servicePayment) {
  if (!servicePayment || servicePayment.status === "completed") {
    return { synced: false, reason: "already_completed_or_missing" };
  }

  if (servicePayment.provider !== "paymongo" || !servicePayment.provider_link_id) {
    return { synced: false, reason: "not_paymongo_link_payment" };
  }

  const link = await fetchPayMongoLink(servicePayment.provider_link_id);
  if (!link) {
    return { synced: false, reason: "provider_link_not_found" };
  }

  if (link?.attributes?.status !== "paid") {
    await updateDocument("service_payments", servicePayment.id, {
      provider_status: link?.attributes?.status ?? servicePayment.provider_status ?? "unpaid",
    });
    return { synced: false, reason: "provider_not_paid", providerStatus: link?.attributes?.status ?? null };
  }

  const result = await completePaidServiceFromPayMongo(link);
  return { synced: Boolean(result.fulfilled), result };
}

async function syncPaidServicePaymentForDispatch(dispatch) {
  if (!dispatch || dispatch.dispatch_status !== "payment_pending") {
    return { synced: false, reason: "dispatch_not_payment_pending" };
  }

  const servicePaymentId = dispatch.service_payment_id ?? null;
  const candidates = servicePaymentId
    ? [await getDocument("service_payments", servicePaymentId)]
    : await getDocuments("service_payments", { dispatch_id: dispatch.id });

  const pendingPayment = candidates
    .filter(Boolean)
    .find((payment) => payment.status !== "completed" && payment.provider === "paymongo");

  if (!pendingPayment) {
    return { synced: false, reason: "service_payment_not_found" };
  }

  return syncPaidServicePaymentFromPayMongo(pendingPayment);
}

async function createPayMongoTopUpLink({ amount, reference }) {
  return createPayMongoLink({
    amount,
    reference,
    description: `Soteria Credits Top-up - PHP ${amount}`,
  });
}

async function createPayMongoSubscriptionLink({ amount, plan, reference }) {
  return createPayMongoLink({
    amount,
    reference,
    description: `Soteria Subscription - ${formatSubscriptionPlanLabel(plan)} - PHP ${amount}`,
  });
}

async function createPayMongoServiceLink({ amount, dispatchId, reference }) {
  return createPayMongoLink({
    amount,
    reference,
    description: `Soteria Roadside Service - ${dispatchId} - PHP ${amount}`,
  });
}

function parsePayMongoSignature(header) {
  return String(header ?? "")
    .split(",")
    .map((part) => part.trim().split("="))
    .reduce((acc, [key, value]) => {
      if (key) acc[key] = value ?? "";
      return acc;
    }, {});
}

function verifyPayMongoWebhookSignature(rawBody, signatureHeader) {
  const { webhookSecret, signatureMode } = getPayMongoConfig();
  if (!webhookSecret) {
    return process.env.PAYMONGO_REQUIRE_WEBHOOK_SIGNATURE === "false";
  }

  const parts = parsePayMongoSignature(signatureHeader);
  const timestamp = parts.t;
  const expectedSignature = parts[signatureMode];
  if (!timestamp || !expectedSignature) {
    return false;
  }

  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody ?? "");
  const computed = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const computedBuffer = Buffer.from(computed, "hex");

  return expectedBuffer.length === computedBuffer.length && timingSafeEqual(expectedBuffer, computedBuffer);
}

async function findPendingTopUpFromPayMongoLink(link) {
  const attributes = link?.attributes ?? {};
  const providerLinkId = link?.id ?? "";
  const referenceNumber = attributes.reference_number ?? "";
  const remarks = attributes.remarks ?? "";

  const lookups = [
    providerLinkId ? { provider_link_id: providerLinkId } : null,
    referenceNumber ? { provider_reference_number: referenceNumber } : null,
    remarks ? { reference: remarks } : null,
  ].filter(Boolean);

  for (const condition of lookups) {
    const matches = await getDocuments("soteria_credit_topups", condition);
    const pending = matches.find((item) => item.status !== "credited");
    if (pending) {
      return pending;
    }
  }

  return null;
}

async function findPendingPaymentFromPayMongoLink(collectionName, link) {
  const attributes = link?.attributes ?? {};
  const providerLinkId = link?.id ?? "";
  const referenceNumber = attributes.reference_number ?? "";
  const remarks = attributes.remarks ?? "";

  const lookups = [
    providerLinkId ? { provider_link_id: providerLinkId } : null,
    referenceNumber ? { provider_reference_number: referenceNumber } : null,
    remarks ? { reference: remarks } : null,
  ].filter(Boolean);

  for (const condition of lookups) {
    const matches = await getDocuments(collectionName, condition);
    const pending = matches.find((item) => !["confirmed", "credited", "completed"].includes(String(item.status ?? "")));
    if (pending) {
      return pending;
    }
  }

  return null;
}

async function creditPaidTopUpFromPayMongo(link) {
  const topUp = await findPendingTopUpFromPayMongoLink(link);
  if (!topUp) {
    return { credited: false, reason: "topup_not_found" };
  }

  if (topUp.status === "credited") {
    return { credited: false, reason: "already_credited" };
  }

  const user = await getDocument(collections.users, topUp.user_id);
  if (!user || user.role !== "motorist") {
    return { credited: false, reason: "motorist_not_found" };
  }

  const result = await addSoteriaCredits(user, Number(topUp.amount ?? 0), "online_topup", {
    topUpId: topUp.id,
    provider: "paymongo",
    providerLinkId: link?.id ?? topUp.provider_link_id ?? "",
    providerReferenceNumber: link?.attributes?.reference_number ?? topUp.provider_reference_number ?? "",
  });

  await updateDocument("soteria_credit_topups", topUp.id, {
    status: "credited",
    credited_at: serverTimestamp(),
    credit_balance_after: result.balance,
    provider_status: link?.attributes?.status ?? "paid",
    webhook_payload_id: link?.id ?? "",
  });

  return { credited: true, topUpId: topUp.id, balance: result.balance };
}

async function activatePaidSubscriptionFromPayMongo(link) {
  const payment = await findPendingPaymentFromPayMongoLink(collections.subscriptionPayments, link);
  if (!payment) {
    return { fulfilled: false, reason: "subscription_payment_not_found" };
  }

  if (normalizePaymentStatus(payment.status) === "confirmed") {
    return { fulfilled: false, reason: "already_confirmed" };
  }

  const user = await getDocument(collections.users, payment.user_id);
  const normalizedPlan = normalizeSubscriptionPlan(payment.subscription_plan);
  if (!user || user.role !== "motorist" || !normalizedPlan) {
    return { fulfilled: false, reason: "invalid_subscription_payment" };
  }

  const expiryDate = calculateSubscriptionExpiry(normalizedPlan);
  await updateDocument(collections.subscriptionPayments, payment.id, {
    status: "confirmed",
    reviewed_at: serverTimestamp(),
    provider_status: link?.attributes?.status ?? "paid",
    payment_status: "paid",
  });

  await updateDocument(collections.users, user.id, {
    subscription_status: "active",
    subscription_plan: normalizedPlan,
    subscription_activated_at: serverTimestamp(),
    subscription_expires_at: expiryDate,
  });

  return { fulfilled: true, paymentId: payment.id, userId: user.id, subscriptionPlan: normalizedPlan };
}

async function completePaidServiceFromPayMongo(link) {
  const servicePayment = await findPendingPaymentFromPayMongoLink("service_payments", link);
  if (!servicePayment) {
    return { fulfilled: false, reason: "service_payment_not_found" };
  }

  if (servicePayment.status === "completed") {
    return { fulfilled: false, reason: "already_completed" };
  }

  const dispatch = await getDocument(collections.dispatches, servicePayment.dispatch_id);
  if (!dispatch) {
    return { fulfilled: false, reason: "dispatch_not_found" };
  }

  const dispatchDetails = await buildDispatchDetails(dispatch);
  const payment = await buildDispatchPaymentSummary(
    {
      ...dispatch,
      base_service_amount: servicePayment.base_service_amount,
      payout_transfer_fee: servicePayment.payout_transfer_fee,
      total_amount: servicePayment.amount,
    },
    dispatchDetails,
  );

  await updateDocument(collections.dispatches, dispatch.id, {
    dispatch_status: "completed",
    completed_at: serverTimestamp(),
    total_amount: payment.totalAmount,
    base_service_amount: payment.baseServiceAmount,
    payout_transfer_fee: payment.payoutTransferFee,
    service_amount: payment.serviceAmount,
    commission_amount: payment.commissionAmount,
    commission_rate: payment.commissionRate,
    motorist_subscription_status: payment.subscriptionStatus,
    motorist_subscription_plan: payment.subscriptionPlan,
    payment_status: "provider_paid",
    payment_method: "online_payment",
    payout_status: "processing",
    payout_transferred_at: null,
    transfer_reference: payment.transferReference,
    service_payment_id: servicePayment.id,
  });

  if (dispatch.emergency_report_id) {
    await updateDocument(collections.emergencyReports, dispatch.emergency_report_id, {
      report_status: "completed",
    });
  }

  await updateDocument("service_payments", servicePayment.id, {
    status: "completed",
    provider_status: link?.attributes?.status ?? "paid",
    paid_at: serverTimestamp(),
    base_service_amount: payment.baseServiceAmount,
    payout_transfer_fee: payment.payoutTransferFee,
    service_amount: payment.serviceAmount,
    commission_amount: payment.commissionAmount,
    commission_rate: payment.commissionRate,
  });

  await queueAndProcessResponderPayout(
    { ...dispatch, service_payment_id: servicePayment.id },
    dispatchDetails,
    payment,
  );

  return { fulfilled: true, servicePaymentId: servicePayment.id, dispatchId: dispatch.id };
}

async function addSoteriaCredits(user, amount, source = "online_topup", metadata = {}) {
  const creditAmount = roundCurrency(amount);
  if (!user?.id || creditAmount <= 0) {
    throw new Error("A valid top-up amount is required.");
  }

  const currentBalance = readSoteriaCreditBalance(user);
  const nextBalance = roundCurrency(currentBalance + creditAmount);

  await updateDocument(collections.users, user.id, {
    soteria_credit_balance: nextBalance,
    soteria_credit_updated_at: serverTimestamp(),
  });

  await createDocument("soteria_credit_transactions", {
    user_id: user.id,
    type: "credit",
    source,
    amount: creditAmount,
    balance_before: currentBalance,
    balance_after: nextBalance,
    metadata,
    created_at: serverTimestamp(),
  });

  return { balance: nextBalance, amount: creditAmount };
}

async function deductSoteriaCredits(user, amount, source, metadata = {}) {
  const debitAmount = roundCurrency(amount);
  if (!user?.id || debitAmount <= 0) {
    throw new Error("A valid debit amount is required.");
  }

  const currentBalance = readSoteriaCreditBalance(user);
  if (currentBalance < debitAmount) {
    const error = new Error(
      `Insufficient Soteria Credits. Balance PHP ${currentBalance}; required PHP ${debitAmount}.`,
    );
    error.statusCode = 402;
    throw error;
  }

  const nextBalance = roundCurrency(currentBalance - debitAmount);

  await updateDocument(collections.users, user.id, {
    soteria_credit_balance: nextBalance,
    soteria_credit_updated_at: serverTimestamp(),
  });

  await createDocument("soteria_credit_transactions", {
    user_id: user.id,
    type: "debit",
    source,
    amount: debitAmount,
    balance_before: currentBalance,
    balance_after: nextBalance,
    metadata,
    created_at: serverTimestamp(),
  });

  return { balance: nextBalance, amount: debitAmount };
}

function normalizeCurrencyInput(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return roundCurrency(value);
  }

  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(numeric) ? roundCurrency(numeric) : 0;
  }

  return 0;
}

function getPayoutProviderMode() {
  const defaultProvider = process.env.NODE_ENV === "production" ? "manual" : "simulated";
  const provider = String(process.env.PAYOUT_PROVIDER ?? defaultProvider).trim().toLowerCase();
  return provider || "simulated";
}

function getResponderPayoutTransferFee() {
  return Math.max(0, normalizeCurrencyInput(process.env.RESPONDER_PAYOUT_TRANSFER_FEE ?? 0));
}

function getCommunityPayoutTransferFee() {
  return Math.max(0, normalizeCurrencyInput(process.env.COMMUNITY_PAYOUT_TRANSFER_FEE ?? 10));
}

function getResponderMinimumPayoutAmount() {
  return Math.max(0, normalizeCurrencyInput(process.env.RESPONDER_MIN_PAYOUT_AMOUNT ?? 10));
}

function getPayMongoWalletTransferConfig() {
  return {
    walletId: process.env.PAYMONGO_WALLET_ID ?? "",
    transferProvider: (process.env.PAYMONGO_WALLET_TRANSFER_PROVIDER ?? "instapay").toLowerCase(),
    destinationBic: process.env.PAYMONGO_GCASH_BIC ?? "GXCHPHM2XXX",
    callbackUrl: process.env.PAYMONGO_WALLET_TRANSFER_CALLBACK_URL ?? "",
    maxAttempts: Math.max(1, Number(process.env.RESPONDER_PAYOUT_MAX_ATTEMPTS ?? 3)),
    retryDelayMs: Math.max(60_000, Number(process.env.RESPONDER_PAYOUT_RETRY_DELAY_MS ?? 10 * 60_000)),
  };
}

function normalizePayoutAccountNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function isValidGcashAccountNumber(value) {
  return /^09\d{9}$/.test(normalizePayoutAccountNumber(value));
}

function getPayoutDestinationKey(name, account) {
  const normalizedName = String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const normalizedAccount = normalizePayoutAccountNumber(account);
  return `${normalizedName}|${normalizedAccount}`;
}

function normalizePersonName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function getNameParts(value) {
  return normalizePersonName(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
}

function resolvePayoutAccountName(savedPayoutName, userFullName = "") {
  const savedName = normalizePersonName(savedPayoutName);
  const fullName = normalizePersonName(userFullName);
  if (!savedName || !fullName) {
    return savedName || fullName;
  }

  const savedParts = getNameParts(savedName);
  const fullParts = getNameParts(fullName);
  const hasMatchingOuterName =
    savedParts.length >= 2 &&
    fullParts.length > savedParts.length &&
    savedParts[0] === fullParts[0] &&
    savedParts[savedParts.length - 1] === fullParts[fullParts.length - 1];

  return hasMatchingOuterName ? fullName : savedName;
}

function getPayMongoTransferData(transfer) {
  const data = transfer?.data ?? transfer ?? {};
  const attributes = data.attributes ?? transfer?.attributes ?? {};
  return {
    id: data.id ?? transfer?.id ?? attributes.id ?? "",
    attributes,
  };
}

function isPayMongoPayoutPaidStatus(status) {
  return ["succeeded", "success", "completed", "paid"].includes(String(status ?? "").toLowerCase());
}

function isPayMongoPayoutFailedStatus(status) {
  return ["failed", "failure", "cancelled", "canceled"].includes(String(status ?? "").toLowerCase());
}

const payMongoDestinationAccountFailures = new Map([
  ["AC01", "The responder GCash account number is invalid or does not exist. Please enter an active GCash number before retrying the payout."],
  ["AC03", "The responder GCash account number is invalid. Please verify the GCash details before retrying the payout."],
  ["AC04", "The responder GCash account is closed. Please enter an active GCash account before retrying the payout."],
  ["AC06", "PayMongo or GCash rejected this recipient as BlockedAccount. Verify the exact registered GCash account name and number before retrying the payout."],
  ["AC07", "The responder GCash account is closed. Please enter an active GCash account before retrying the payout."],
]);

function getPayMongoDestinationAccountFailureReason(source) {
  const text = JSON.stringify(source ?? {}).toLowerCase();

  for (const [code, reason] of payMongoDestinationAccountFailures.entries()) {
    if (text.includes(code.toLowerCase())) {
      return reason;
    }
  }

  if (text.includes("blockedaccount") || text.includes("blocked account")) {
    return payMongoDestinationAccountFailures.get("AC06");
  }

  if (text.includes("closedaccount") || text.includes("closed account")) {
    return payMongoDestinationAccountFailures.get("AC04");
  }

  if (text.includes("incorrectaccountnumber") || text.includes("invalidcreditoraccountnumber")) {
    return payMongoDestinationAccountFailures.get("AC03");
  }

  return "";
}

function getPayMongoProviderFailureReason(attributes) {
  return (
    attributes?.provider_error ??
    attributes?.provider_error_code ??
    attributes?.failure_reason ??
    "PayMongo wallet transfer failed."
  );
}

function getPayMongoErrorDetail(payload) {
  const error = payload?.errors?.[0] ?? null;
  return (
    error?.detail ??
    error?.code ??
    payload?.message ??
    payload?.data?.attributes?.provider_error ??
    payload?.data?.attributes?.provider_error_code ??
    "PayMongo wallet transfer failed."
  );
}

function isPayMongoInsufficientWalletBalanceError(error) {
  const text = [
    error?.message,
    error?.providerPayload?.errors?.[0]?.detail,
    error?.providerPayload?.errors?.[0]?.code,
    error?.providerPayload?.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes("source_account_balance") && text.includes("insufficient");
}

function getDateFromFirestoreValue(value) {
  return value?.toDate?.() ?? (value ? new Date(value) : null);
}

function isResponderPayoutRetryDue(payout) {
  const retryAt = getDateFromFirestoreValue(payout?.next_retry_at);
  return !retryAt || Number.isNaN(retryAt.getTime()) || retryAt.getTime() <= Date.now();
}

async function createPayMongoWalletTransfer(payout) {
  const { walletId, transferProvider, destinationBic, callbackUrl } = getPayMongoWalletTransferConfig();
  const { secretKey } = getPayMongoConfig();

  if (!secretKey || !walletId) {
    throw new Error("PayMongo wallet payout is not configured. Set PAYMONGO_WALLET_ID and PAYMONGO_SECRET_KEY.");
  }

  const amountInCentavos = Math.round(Number(payout.net_amount ?? 0) * 100);
  if (!Number.isFinite(amountInCentavos) || amountInCentavos <= 0) {
    throw new Error("A valid payout amount is required.");
  }

  const destinationAccountNumber = normalizePayoutAccountNumber(payout.destination_account);
  const destinationAccountName = String(payout.destination_name ?? "").trim();
  if (!destinationAccountName || !destinationAccountNumber) {
    throw new Error("Responder GCash payout name and number are required before transfer.");
  }
  if (!isValidGcashAccountNumber(destinationAccountNumber)) {
    throw new Error("Responder GCash number must be an active 11-digit Philippine mobile number starting with 09.");
  }

  const transfer = {
    amount: amountInCentavos,
    currency: "PHP",
    provider: transferProvider,
    receiver: {
      bank_account_number: destinationAccountNumber,
      bank_account_name: destinationAccountName,
      bank_code: destinationBic,
    },
    callback_url: callbackUrl || undefined,
    type: "send_money",
    purpose: payout.purpose ?? "Soteria payout",
    description: payout.description ?? `Soteria payout ${payout.id ?? ""}`,
    metadata: {
      payout_id: payout.id ?? "",
      dispatch_id: payout.dispatch_id ?? "",
      service_payment_id: payout.service_payment_id ?? "",
      redemption_id: payout.redemption_id ?? "",
      payout_type: payout.payout_type ?? "responder",
    },
  };

  const response = await fetch(`https://api.paymongo.com/v1/wallets/${walletId}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodePayMongoAuth(secretKey)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: transfer,
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = getPayMongoErrorDetail(payload);
    const error = new Error(detail);
    error.statusCode = response.status;
    error.providerPayload = payload;
    throw error;
  }

  return payload?.data ?? payload;
}

async function fetchPayMongoWalletTransfer(providerPayoutId) {
  const { secretKey } = getPayMongoConfig();
  const { walletId } = getPayMongoWalletTransferConfig();
  if (!secretKey || !walletId || !providerPayoutId) {
    return null;
  }

  const response = await fetch(`https://api.paymongo.com/v1/wallets/${walletId}/transactions/${providerPayoutId}`, {
    headers: {
      Authorization: `Basic ${encodePayMongoAuth(secretKey)}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  return payload?.data ?? payload;
}

async function createResponderPayoutForDispatch(dispatch, dispatchDetails, payment) {
  if (!dispatch?.id) {
    throw new Error("Dispatch id is required before creating a responder payout.");
  }

  const existingPayouts = await getDocuments("responder_payouts", { dispatch_id: dispatch.id });
  const existing = existingPayouts[0] ?? null;
  if (existing) {
    return existing;
  }

  const responderUserId = dispatchDetails.agent?.id ?? getDispatchResponderUserId(dispatch);
  const responderProfile = responderUserId ? await getAgentProfileByUserId(responderUserId) : null;
  const responderUser = responderUserId ? await getDocument(collections.users, responderUserId) : null;
  const gcashName = resolvePayoutAccountName(
    responderProfile?.payout_gcash_name,
    responderUser?.full_name,
  );
  const gcashNumber = normalizePayoutAccountNumber(responderProfile?.payout_gcash_number);
  const hasDestination = Boolean(gcashName && isValidGcashAccountNumber(gcashNumber));
  const transferReference = payment.transferReference || `SOT-${dispatch.id}-${Date.now()}`;

  const payoutId = `dispatch_${dispatch.id}`;
  const payoutRef = db.collection("responder_payouts").doc(payoutId);
  await db.runTransaction(async (transaction) => {
    const existingPayout = await transaction.get(payoutRef);
    if (existingPayout.exists) {
      return;
    }

    transaction.set(payoutRef, {
      id: payoutId,
      dispatch_id: dispatch.id,
      service_payment_id: dispatch.service_payment_id ?? null,
      responder_user_id: responderUserId ?? "",
      motorist_user_id: dispatchDetails.motorist?.id ?? "",
      gross_amount: payment.baseServiceAmount,
      payout_transfer_fee: payment.payoutTransferFee,
      commission_amount: payment.commissionAmount,
      net_amount: payment.serviceAmount,
      charged_total_amount: payment.totalAmount,
      currency: "PHP",
      destination_type: "gcash",
      destination_name: gcashName,
      destination_account: gcashNumber,
      destination_notes: responderProfile?.payout_notes ?? "",
      provider: getPayoutProviderMode(),
      provider_payout_id: null,
      transfer_reference: transferReference,
      status: hasDestination ? "queued" : "details_required",
      failure_reason: hasDestination
        ? ""
        : "Responder GCash payout details are missing or invalid. Use an active 11-digit GCash number starting with 09.",
      requested_at: serverTimestamp(),
      processed_at: null,
      paid_at: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  });

  return getDocument("responder_payouts", payoutId);
}

async function refreshResponderPayoutDestination(payout) {
  if (!payout?.id || !payout.responder_user_id) {
    return payout;
  }

  const responderProfile = await getAgentProfileByUserId(payout.responder_user_id);
  const responderUser = await getDocument(collections.users, payout.responder_user_id);
  const gcashName = resolvePayoutAccountName(
    responderProfile?.payout_gcash_name,
    responderUser?.full_name,
  );
  const gcashNumber = normalizePayoutAccountNumber(responderProfile?.payout_gcash_number);
  if (!gcashName || !isValidGcashAccountNumber(gcashNumber)) {
    await updateDocument("responder_payouts", payout.id, {
      status: "details_required",
      destination_name: gcashName,
      destination_account: gcashNumber,
      destination_notes: responderProfile?.payout_notes ?? "",
      failure_reason:
        "Responder GCash payout details are missing or invalid. Use an active 11-digit GCash number starting with 09.",
    });
    return getDocument("responder_payouts", payout.id);
  }

  const shouldRequeue = ["failed", "details_required"].includes(String(payout.status ?? ""));
  const currentDestinationKey = getPayoutDestinationKey(payout.destination_name, payout.destination_account);
  const nextDestinationKey = getPayoutDestinationKey(gcashName, gcashNumber);
  const lastRejectedDestinationKey = String(payout.rejected_destination_key ?? "");
  const hasDestinationFailure =
    Boolean(getPayMongoDestinationAccountFailureReason(payout.provider_payload)) ||
    Array.from(payMongoDestinationAccountFailures.values()).some((reason) => reason === payout.failure_reason);
  const isSameRejectedDestination =
    shouldRequeue &&
    nextDestinationKey &&
    nextDestinationKey === currentDestinationKey &&
    (nextDestinationKey === lastRejectedDestinationKey || hasDestinationFailure);

  if (isSameRejectedDestination) {
    await updateDocument("responder_payouts", payout.id, {
      destination_name: gcashName,
      destination_account: gcashNumber,
      destination_notes: responderProfile?.payout_notes ?? "",
      status: "details_required",
      failure_reason:
        payout.failure_reason ||
        "The responder GCash account was rejected by PayMongo. Please use a different active GCash account before retrying the payout.",
      rejected_destination_key: nextDestinationKey,
    });
    return getDocument("responder_payouts", payout.id);
  }

  await updateDocument("responder_payouts", payout.id, {
    destination_name: gcashName,
    destination_account: gcashNumber,
    destination_notes: responderProfile?.payout_notes ?? "",
    status: shouldRequeue ? "queued" : payout.status,
    failure_reason: shouldRequeue ? "" : payout.failure_reason ?? "",
    rejected_destination_key: shouldRequeue ? null : payout.rejected_destination_key ?? null,
  });

  return getDocument("responder_payouts", payout.id);
}

async function syncPayMongoResponderPayoutStatus(payout) {
  if (!payout?.id || payout.provider !== "paymongo" || !payout.provider_payout_id) {
    return payout;
  }

  const transfer = await fetchPayMongoWalletTransfer(payout.provider_payout_id);
  if (!transfer) {
    return payout;
  }

  const { attributes } = getPayMongoTransferData(transfer);
  const providerStatus = attributes.status ?? payout.provider_status ?? "processing";
  const paid = isPayMongoPayoutPaidStatus(providerStatus);
  const failed = isPayMongoPayoutFailedStatus(providerStatus);
  const destinationFailureReason = failed ? getPayMongoDestinationAccountFailureReason(attributes) : "";

  await updateDocument("responder_payouts", payout.id, {
    status: paid ? "paid" : failed && destinationFailureReason ? "details_required" : failed ? "failed" : "processing",
    provider_status: providerStatus,
    provider_payload: transfer,
    paid_at: paid ? serverTimestamp() : null,
    failure_reason: failed ? destinationFailureReason || getPayMongoProviderFailureReason(attributes) : "",
    rejected_destination_key: failed && destinationFailureReason
      ? getPayoutDestinationKey(payout.destination_name, payout.destination_account)
      : null,
  });

  return getDocument("responder_payouts", payout.id);
}

async function updateDispatchPayoutFromResponderPayout(dispatchId, processedPayout, transferReference = null) {
  if (!dispatchId) {
    return;
  }

  const dispatch = await getDocument(collections.dispatches, dispatchId);
  if (!dispatch) {
    console.warn(
      `[PAYOUT] Dispatch ${dispatchId} is missing; skipped payout status sync for responder payout ${processedPayout?.id ?? "unknown"}.`,
    );
    return;
  }

  const status = processedPayout?.status ?? "queued";
  const payoutStatus =
    status === "paid"
      ? "auto_transferred"
      : status === "awaiting_wallet_funding"
        ? "awaiting_wallet_funding"
      : status === "details_required"
        ? "payout_details_required"
        : status;

  await updateDocument(collections.dispatches, dispatchId, {
    payout_status: payoutStatus,
    payout_transferred_at: status === "paid" ? serverTimestamp() : null,
    transfer_reference: processedPayout?.transfer_reference ?? transferReference,
    responder_payout_id: processedPayout?.id ?? null,
  });
}

async function processResponderPayout(payout, options = {}) {
  if (!payout) {
    return null;
  }

  if (payout.status === "paid") {
    return payout;
  }

  if (payout.status === "processing") {
    return syncPayMongoResponderPayoutStatus(payout);
  }

  if (payout.status === "details_required") {
    payout = await refreshResponderPayoutDestination(payout);
    if (payout.status === "details_required") {
      return payout;
    }
  }

  const provider = getPayoutProviderMode();
  const payoutId = payout.id;
  const { maxAttempts } = getPayMongoWalletTransferConfig();
  const attemptCount = Number(payout.payout_attempt_count ?? 0);

  if (payout.status === "awaiting_wallet_funding" && !isResponderPayoutRetryDue(payout)) {
    return payout;
  }

  if (payout.status === "failed") {
    if (!options.force && attemptCount >= maxAttempts) {
      return payout;
    }
    payout = await refreshResponderPayoutDestination(payout);
    if (payout.status === "details_required") {
      return payout;
    }
  }

  if (provider === "manual") {
    await updateDocument("responder_payouts", payoutId, {
      status: "queued",
      provider,
      processed_at: serverTimestamp(),
      failure_reason: "",
    });
    return getDocument("responder_payouts", payoutId);
  }

  if (provider === "simulated" || (process.env.NODE_ENV !== "production" && provider !== "paymongo")) {
    const providerPayoutId = `SIM-GCASH-${payoutId}`;
    await updateDocument("responder_payouts", payoutId, {
      status: "paid",
      provider,
      provider_payout_id: providerPayoutId,
      processed_at: serverTimestamp(),
      paid_at: serverTimestamp(),
      failure_reason: "",
    });
    return getDocument("responder_payouts", payoutId);
  }

  if (provider === "paymongo") {
    try {
      await updateDocument("responder_payouts", payoutId, {
        status: "processing",
        provider,
        processed_at: serverTimestamp(),
        payout_attempt_count: attemptCount + 1,
        last_attempted_at: serverTimestamp(),
        failure_reason: "",
        rejected_destination_key: null,
      });

      const transfer = await createPayMongoWalletTransfer(payout);
      const { id: providerPayoutId, attributes } = getPayMongoTransferData(transfer);
      const providerStatus = attributes.status ?? "processing";
      const paid = isPayMongoPayoutPaidStatus(providerStatus);

      await updateDocument("responder_payouts", payoutId, {
        status: paid ? "paid" : "processing",
        provider,
        provider_payout_id: providerPayoutId,
        provider_status: providerStatus,
        provider_payload: transfer,
        processed_at: serverTimestamp(),
        paid_at: paid ? serverTimestamp() : null,
        next_retry_at: null,
        failure_reason: "",
      });
    } catch (error) {
      if (isPayMongoInsufficientWalletBalanceError(error)) {
        const { retryDelayMs } = getPayMongoWalletTransferConfig();
        await updateDocument("responder_payouts", payoutId, {
          status: "awaiting_wallet_funding",
          provider,
          provider_status: "insufficient_wallet_balance",
          processed_at: serverTimestamp(),
          next_retry_at: new Date(Date.now() + retryDelayMs),
          failure_reason:
            "PayMongo Wallet has insufficient available balance for this responder GCash transfer. It will retry automatically after the wallet is funded.",
          provider_payload: error?.providerPayload ?? null,
        });
        return getDocument("responder_payouts", payoutId);
      }

      const destinationFailureReason = getPayMongoDestinationAccountFailureReason(error?.providerPayload ?? error);
      if (destinationFailureReason) {
        await updateDocument("responder_payouts", payoutId, {
          status: "details_required",
          provider,
          provider_status: "destination_account_rejected",
          processed_at: serverTimestamp(),
          failure_reason: destinationFailureReason,
          provider_payload: error?.providerPayload ?? null,
          rejected_destination_key: getPayoutDestinationKey(payout.destination_name, payout.destination_account),
        });
        return getDocument("responder_payouts", payoutId);
      }

      await updateDocument("responder_payouts", payoutId, {
        status: "failed",
        provider,
        processed_at: serverTimestamp(),
        failure_reason: error instanceof Error ? error.message : "PayMongo wallet transfer failed.",
        provider_payload: error?.providerPayload ?? null,
      });
    }

    return getDocument("responder_payouts", payoutId);
  }

  await updateDocument("responder_payouts", payoutId, {
    status: "queued",
    provider,
    processed_at: serverTimestamp(),
    failure_reason:
      "Live payout provider is not configured yet. Enable PayMongo Money Movement/Disbursements or another payout API.",
  });
  return getDocument("responder_payouts", payoutId);
}

async function queueAndProcessResponderPayout(dispatch, dispatchDetails, payment) {
  const payout = await createResponderPayoutForDispatch(dispatch, dispatchDetails, payment);
  const processedPayout = await processResponderPayout(payout);
  await updateDispatchPayoutFromResponderPayout(dispatch.id, processedPayout ?? payout, payment.transferReference);

  return processedPayout;
}

async function processCommunityRedemptionPayout(redemption) {
  if (!redemption?.id) {
    return null;
  }

  if (["paid", "rejected"].includes(normalizeCommunityRedemptionStatus(redemption.status))) {
    return redemption;
  }

  if (redemption.status === "processing" && redemption.provider === "paymongo" && redemption.provider_payout_id) {
    const transfer = await fetchPayMongoWalletTransfer(redemption.provider_payout_id);
    if (transfer) {
      const { attributes } = getPayMongoTransferData(transfer);
      const providerStatus = attributes.status ?? redemption.provider_status ?? "processing";
      const paid = isPayMongoPayoutPaidStatus(providerStatus);
      const failed = isPayMongoPayoutFailedStatus(providerStatus);
      const destinationFailureReason = failed ? getPayMongoDestinationAccountFailureReason(attributes) : "";

      await updateDocument(collections.communityRedemptions, redemption.id, {
        status: paid ? "paid" : failed && destinationFailureReason ? "details_required" : failed ? "failed" : "processing",
        provider_status: providerStatus,
        provider_payload: transfer,
        paid_at: paid ? serverTimestamp() : null,
        reviewed_at: paid ? serverTimestamp() : null,
        failure_reason: failed ? destinationFailureReason || getPayMongoProviderFailureReason(attributes) : "",
      });
      return getDocument(collections.communityRedemptions, redemption.id);
    }

    return redemption;
  }

  const provider = getPayoutProviderMode();
  const payoutTransferFee = Number(redemption.payout_transfer_fee ?? getCommunityPayoutTransferFee());
  const cashValue = Number(redemption.cash_value ?? 0);
  const netPayoutAmount = Number(redemption.net_payout_amount ?? Math.max(0, cashValue - payoutTransferFee));
  const destinationName = normalizePersonName(redemption.gcash_name);
  const destinationAccount = normalizePayoutAccountNumber(redemption.gcash_number);

  if (!destinationName || !isValidGcashAccountNumber(destinationAccount)) {
    await updateDocument(collections.communityRedemptions, redemption.id, {
      status: "details_required",
      payout_transfer_fee: payoutTransferFee,
      net_payout_amount: netPayoutAmount,
      destination_account: destinationAccount,
      failure_reason: "Community payout GCash details are missing or invalid. Use an active 11-digit GCash number starting with 09.",
      processed_at: serverTimestamp(),
    });
    return getDocument(collections.communityRedemptions, redemption.id);
  }

  if (!Number.isFinite(netPayoutAmount) || netPayoutAmount <= 0) {
    await updateDocument(collections.communityRedemptions, redemption.id, {
      status: "failed",
      payout_transfer_fee: payoutTransferFee,
      net_payout_amount: netPayoutAmount,
      failure_reason: "Reward cash value must be greater than the PHP 10 payout transaction fee.",
      processed_at: serverTimestamp(),
    });
    return getDocument(collections.communityRedemptions, redemption.id);
  }

  if (provider === "manual") {
    await updateDocument(collections.communityRedemptions, redemption.id, {
      status: "pending",
      provider,
      payout_transfer_fee: payoutTransferFee,
      net_payout_amount: netPayoutAmount,
      failure_reason: "",
      processed_at: serverTimestamp(),
    });
    return getDocument(collections.communityRedemptions, redemption.id);
  }

  if (provider === "simulated" || (process.env.NODE_ENV !== "production" && provider !== "paymongo")) {
    await updateDocument(collections.communityRedemptions, redemption.id, {
      status: "paid",
      provider,
      provider_payout_id: `SIM-GCASH-COMMUNITY-${redemption.id}`,
      provider_status: "paid",
      payout_transfer_fee: payoutTransferFee,
      net_payout_amount: netPayoutAmount,
      processed_at: serverTimestamp(),
      paid_at: serverTimestamp(),
      reviewed_at: serverTimestamp(),
      failure_reason: "",
    });
    return getDocument(collections.communityRedemptions, redemption.id);
  }

  if (provider === "paymongo") {
    try {
      await updateDocument(collections.communityRedemptions, redemption.id, {
        status: "processing",
        provider,
        payout_transfer_fee: payoutTransferFee,
        net_payout_amount: netPayoutAmount,
        processed_at: serverTimestamp(),
        failure_reason: "",
      });

      const transfer = await createPayMongoWalletTransfer({
        id: `community_${redemption.id}`,
        redemption_id: redemption.id,
        payout_type: "community",
        net_amount: netPayoutAmount,
        destination_name: destinationName,
        destination_account: destinationAccount,
        purpose: "Community reward redemption payout",
        description: `Soteria community reward payout ${redemption.id}`,
      });
      const { id: providerPayoutId, attributes } = getPayMongoTransferData(transfer);
      const providerStatus = attributes.status ?? "processing";
      const paid = isPayMongoPayoutPaidStatus(providerStatus);

      await updateDocument(collections.communityRedemptions, redemption.id, {
        status: paid ? "paid" : "processing",
        provider,
        provider_payout_id: providerPayoutId,
        provider_status: providerStatus,
        provider_payload: transfer,
        processed_at: serverTimestamp(),
        paid_at: paid ? serverTimestamp() : null,
        reviewed_at: paid ? serverTimestamp() : null,
        failure_reason: "",
      });
    } catch (error) {
      if (isPayMongoInsufficientWalletBalanceError(error)) {
        await updateDocument(collections.communityRedemptions, redemption.id, {
          status: "awaiting_wallet_funding",
          provider,
          provider_status: "insufficient_wallet_balance",
          provider_payload: error?.providerPayload ?? null,
          processed_at: serverTimestamp(),
          failure_reason:
            "PayMongo Wallet has insufficient available balance for this community payout. It will retry when payout processing runs again.",
        });
        return getDocument(collections.communityRedemptions, redemption.id);
      }

      const destinationFailureReason = getPayMongoDestinationAccountFailureReason(error?.providerPayload ?? error);
      await updateDocument(collections.communityRedemptions, redemption.id, {
        status: destinationFailureReason ? "details_required" : "failed",
        provider,
        provider_status: destinationFailureReason ? "destination_account_rejected" : "failed",
        provider_payload: error?.providerPayload ?? null,
        processed_at: serverTimestamp(),
        failure_reason: destinationFailureReason || (error instanceof Error ? error.message : "PayMongo wallet transfer failed."),
      });
    }

    return getDocument(collections.communityRedemptions, redemption.id);
  }

  await updateDocument(collections.communityRedemptions, redemption.id, {
    status: "pending",
    provider,
    payout_transfer_fee: payoutTransferFee,
    net_payout_amount: netPayoutAmount,
    processed_at: serverTimestamp(),
    failure_reason:
      "Live payout provider is not configured yet. Enable PayMongo Money Movement/Disbursements or another payout API.",
  });
  return getDocument(collections.communityRedemptions, redemption.id);
}

async function retryResponderPayout(payoutId, options = {}) {
  const payout = await getDocument("responder_payouts", payoutId);
  if (!payout) {
    return null;
  }

  const refreshedPayout = await refreshResponderPayoutDestination(payout);
  const processedPayout = await processResponderPayout(refreshedPayout, { force: true, ...options });
  await updateDispatchPayoutFromResponderPayout(payout.dispatch_id, processedPayout ?? refreshedPayout);
  return processedPayout ?? refreshedPayout;
}

async function retryResponderPayoutsForResponder(responderUserId) {
  if (!responderUserId) {
    return [];
  }

  const payouts = await getDocuments("responder_payouts", { responder_user_id: responderUserId });
  const retryablePayouts = payouts.filter((payout) =>
    ["failed", "details_required", "awaiting_wallet_funding"].includes(String(payout.status ?? "")),
  );

  const results = [];
  for (const payout of retryablePayouts) {
    results.push(await retryResponderPayout(payout.id));
  }

  return results;
}

async function processDueResponderPayouts() {
  if (getPayoutProviderMode() !== "paymongo") {
    return [];
  }

  const payouts = await getDocuments("responder_payouts");
  const duePayouts = payouts.filter((payout) =>
    ["queued", "awaiting_wallet_funding", "processing", "details_required"].includes(String(payout.status ?? "")) &&
    isResponderPayoutRetryDue(payout),
  );
  const results = [];

  for (const payout of duePayouts) {
    const processedPayout = await processResponderPayout(payout, { force: true });
    await updateDispatchPayoutFromResponderPayout(payout.dispatch_id, processedPayout ?? payout);
    results.push(processedPayout ?? payout);
  }

  return results;
}

async function processDueCommunityRedemptionPayouts() {
  if (getPayoutProviderMode() !== "paymongo") {
    return [];
  }

  const redemptions = await getDocuments(collections.communityRedemptions);
  const dueRedemptions = redemptions.filter((redemption) =>
    ["pending", "processing", "awaiting_wallet_funding"].includes(String(redemption.status ?? "pending")),
  );
  const results = [];

  for (const redemption of dueRedemptions) {
    results.push(await processCommunityRedemptionPayout(redemption));
  }

  return results;
}

async function listResponderPayouts() {
  const payouts = await getDocuments("responder_payouts");
  return payouts
    .map((payout) => ({
      id: payout.id,
      dispatchId: payout.dispatch_id ?? "",
      servicePaymentId: payout.service_payment_id ?? null,
      responderUserId: payout.responder_user_id ?? "",
      motoristUserId: payout.motorist_user_id ?? "",
      grossAmount: Number(payout.gross_amount ?? 0),
      commissionAmount: Number(payout.commission_amount ?? 0),
      netAmount: Number(payout.net_amount ?? 0),
      currency: payout.currency ?? "PHP",
      destinationType: payout.destination_type ?? "gcash",
      destinationName: payout.destination_name ?? "",
      destinationAccount: payout.destination_account ?? "",
      provider: payout.provider ?? getPayoutProviderMode(),
      providerPayoutId: payout.provider_payout_id ?? null,
      transferReference: payout.transfer_reference ?? null,
      status: payout.status ?? "queued",
      failureReason: payout.failure_reason ?? "",
      requestedAt: formatFirestoreDateTime(payout.requested_at ?? payout.created_at),
      processedAt: formatFirestoreDateTime(payout.processed_at),
      paidAt: formatFirestoreDateTime(payout.paid_at),
    }))
    .sort((a, b) => String(b.requestedAt ?? "").localeCompare(String(a.requestedAt ?? "")));
}

async function buildDispatchPaymentSummary(dispatch, dispatchDetails = null) {
  const details = dispatchDetails ?? await buildDispatchDetails(dispatch);
  const motoristUser = details.motorist?.id
    ? await getDocument(collections.users, details.motorist.id)
    : null;
  const subscriptionStatus = hasActiveSubscription(motoristUser) ? "active" : "inactive";
  const subscriptionPlan =
    subscriptionStatus === "active" ? normalizeSubscriptionPlan(motoristUser?.subscription_plan) : null;
  const commissionRate = subscriptionStatus === "active" ? 0.05 : 0.2;
  const hasExplicitServiceQuote =
    dispatch.base_service_amount != null ||
    dispatch.payment_base_service_amount != null ||
    dispatch.quoted_service_amount != null ||
    dispatch.quoted_total_amount != null;
  const payoutTransferFee = normalizeCurrencyInput(
    dispatch.payout_transfer_fee ?? (hasExplicitServiceQuote && subscriptionPlan !== "annual"
      ? getResponderPayoutTransferFee()
      : 0),
  );
  const baseServiceAmount = normalizeCurrencyInput(
    dispatch.base_service_amount ??
    dispatch.payment_base_service_amount ??
    dispatch.quoted_service_amount ??
    dispatch.payment_total_amount ??
    dispatch.quoted_total_amount ??
    dispatch.total_amount,
  );
  const commissionAmount = roundCurrency(baseServiceAmount * commissionRate);
  const serviceAmount = baseServiceAmount;
  const totalAmount = roundCurrency(baseServiceAmount + commissionAmount + payoutTransferFee);

  return {
    totalAmount,
    baseServiceAmount,
    payoutTransferFee,
    serviceAmount,
    commissionAmount,
    commissionRate,
    subscriptionStatus,
    subscriptionPlan,
    paymentStatus: "system_received",
    payoutStatus: "auto_transferred",
    payoutTransferredAt: null,
    transferReference: `SOT-${dispatch.id ?? Date.now()}`,
    creditBalanceAfter: null,
    paymentMethod: dispatch.payment_method ?? "soteria_credits",
  };
}

function getAgentBalanceProofStatus(agentProfile) {
  if (!agentProfile) {
    return {
      hasProof: false,
      isApproved: false,
      isExpired: true,
      canGoOnline: false,
      status: "missing",
      tier: null,
      tierLabel: "Not verified",
      submittedAt: null,
      reviewedAt: null,
      expiresAt: null,
      approvedBy: null,
      proofUrl: null,
    };
  }

  const submittedAt = formatFirestoreDateTime(agentProfile.balance_proof_submitted_at ?? null);
  const reviewedAt = formatFirestoreDateTime(agentProfile.balance_proof_reviewed_at ?? null);
  const expiresAt = formatFirestoreDateTime(agentProfile.balance_proof_expires_at ?? null);
  const expiresDate = agentProfile.balance_proof_expires_at?.toDate?.()
    ?? (agentProfile.balance_proof_expires_at ? new Date(agentProfile.balance_proof_expires_at) : null);
  const nowMs = Date.now();
  const isExpired = !expiresDate || Number.isNaN(expiresDate.getTime()) || expiresDate.getTime() <= nowMs;
  const status = agentProfile.balance_proof_status ?? "missing";
  const isApproved = status === "approved" && !isExpired;
  const tier = agentProfile.wallet_readiness_tier ?? null;
  const cashAssistEnabled = Boolean(agentProfile.cash_assist_enabled);
  const cashAssistReady = isApproved && cashAssistEnabled;

  return {
    hasProof: Boolean(agentProfile.balance_proof_asset?.url),
    isApproved,
    isExpired,
    canGoOnline: true,
    cashAssistEligible: isApproved,
    cashAssistEnabled,
    cashAssistReady,
    status,
    tier,
    tierLabel:
      tier === "tier_2"
        ? "Tier 2 - PHP 1,000+ verified"
        : tier === "tier_1"
          ? "Tier 1 - PHP 500+ verified"
          : "Not verified",
    submittedAt,
    reviewedAt,
    expiresAt,
    approvedBy: agentProfile.balance_proof_approved_by ?? null,
    proofUrl: agentProfile.balance_proof_asset?.url ?? null,
    rejectionReason: agentProfile.balance_proof_rejection_reason ?? "",
  };
}

async function listCompletedDispatchHistoryForUser(userId, role) {
  const dispatches = await getDocuments(collections.dispatches);
  const completedDispatches = dispatches.filter((dispatch) => dispatch.dispatch_status === "completed");
  const history = [];

  for (const dispatch of completedDispatches) {
    const dispatchDetails = await buildDispatchDetails(dispatch);
    const isParticipant =
      role === "motorist"
        ? dispatchDetails.motorist?.id === userId
        : dispatchDetails.agent?.id === userId;

    if (!isParticipant) {
      continue;
    }

    const feedback = await listDispatchFeedback(dispatch.id);
    const viewerFeedback =
      feedback.find((item) => item.reviewer_user_id === userId && item.reviewer_role === role) ?? null;

    const counterpartFeedback =
      feedback.find((item) => item.reviewee_user_id === userId && item.reviewee_role === role) ?? null;
    const counterpart =
      role === "motorist"
        ? dispatchDetails.agent
        : dispatchDetails.motorist;
    const completedAtMs = dispatch.completed_at?.toDate?.()?.getTime?.() ?? 0;
    const submittedAtMs = viewerFeedback?.submitted_at?.toDate?.()?.getTime?.() ?? 0;
    const payment = dispatchDetails.payment ?? await buildDispatchPaymentSummary(dispatch, dispatchDetails);

    history.push({
      id: dispatch.id,
      dispatchId: dispatch.id,
      emergencyReportId: dispatchDetails.emergencyReportId ?? null,
      dispatchStatus: dispatchDetails.dispatchStatus,
      completedAt: formatFirestoreDateTime(dispatchDetails.completedAt),
      counterpartName:
        role === "motorist"
          ? counterpart?.businessName || counterpart?.fullName || "Responder"
          : counterpart?.fullName || "Motorist",
      counterpartRole: role === "motorist" ? "agent" : "motorist",
      locationLabel: dispatchDetails.motorist?.locationLabel ?? "",
      issueSummary: dispatchDetails.motorist?.issueSummary ?? "",
      serviceLabel:
        dispatchDetails.motorist?.symptoms?.[0] ||
        dispatchDetails.motorist?.issueSummary ||
        dispatchDetails.motorist?.locationLabel ||
        "Roadside assistance",
      payment,
      dispatch: serializeDispatchDetails(dispatchDetails),
      viewerFeedback: serializeDispatchFeedback(viewerFeedback),
      counterpartFeedback: serializeDispatchFeedback(counterpartFeedback),
      _completedAtMs: completedAtMs,
      _submittedAtMs: submittedAtMs,
    });
  }

  return history
    .sort((a, b) => (b._submittedAtMs || b._completedAtMs) - (a._submittedAtMs || a._completedAtMs))
    .map(({ _completedAtMs, _submittedAtMs, ...item }) => item);
}

async function resolveDispatchFeedbackContext(dispatchId, reviewerRole, reviewerUserId) {
  const dispatch = await getDocument(collections.dispatches, dispatchId);
  if (!dispatch) {
    const error = new Error("Dispatch not found.");
    error.statusCode = 404;
    throw error;
  }

  if (dispatch.dispatch_status !== "completed") {
    const error = new Error("Feedback can only be submitted after the job is completed.");
    error.statusCode = 400;
    throw error;
  }

  const dispatchDetails = await buildDispatchDetails(dispatch);

  if (reviewerRole === "motorist") {
    if (!dispatchDetails.motorist || dispatchDetails.motorist.id !== reviewerUserId) {
      const error = new Error("This motorist is not allowed to review the selected dispatch.");
      error.statusCode = 403;
      throw error;
    }

    if (!dispatchDetails.agent) {
      const error = new Error("No responder is attached to this dispatch.");
      error.statusCode = 400;
      throw error;
    }

    return {
      dispatch,
      dispatchDetails,
      reviewer: {
        id: dispatchDetails.motorist.id,
        name: dispatchDetails.motorist.fullName,
        role: "motorist",
      },
      reviewee: {
        id: dispatchDetails.agent.id,
        name: dispatchDetails.agent.businessName || dispatchDetails.agent.fullName,
        role: "agent",
      },
    };
  }

  if (!dispatchDetails.agent || dispatchDetails.agent.id !== reviewerUserId) {
    const error = new Error("This responder is not allowed to review the selected dispatch.");
    error.statusCode = 403;
    throw error;
  }

  if (!dispatchDetails.motorist) {
    const error = new Error("No motorist is attached to this dispatch.");
    error.statusCode = 400;
    throw error;
  }

  return {
    dispatch,
    dispatchDetails,
    reviewer: {
      id: dispatchDetails.agent.id,
      name: dispatchDetails.agent.businessName || dispatchDetails.agent.fullName,
      role: "agent",
    },
    reviewee: {
      id: dispatchDetails.motorist.id,
      name: dispatchDetails.motorist.fullName,
      role: "motorist",
    },
  };
}

async function resolveDispatchParticipantContext(dispatchId, viewerRole, viewerUserId) {
  const dispatch = await getDocument(collections.dispatches, dispatchId);
  if (!dispatch) {
    const error = new Error("Dispatch not found.");
    error.statusCode = 404;
    throw error;
  }

  const dispatchDetails = await buildDispatchDetails(dispatch);

  if (viewerRole === "motorist") {
    if (!dispatchDetails.motorist || dispatchDetails.motorist.id !== viewerUserId) {
      const error = new Error("This motorist is not allowed to view feedback for the selected dispatch.");
      error.statusCode = 403;
      throw error;
    }
  } else if (viewerRole === "agent") {
    if (!dispatchDetails.agent || dispatchDetails.agent.id !== viewerUserId) {
      const error = new Error("This responder is not allowed to view feedback for the selected dispatch.");
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error = new Error("viewerRole must be 'motorist' or 'agent'.");
    error.statusCode = 400;
    throw error;
  }

  return {
    dispatch,
    dispatchDetails,
  };
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function normalizeServiceType(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

function canonicalizeServiceType(value) {
  const normalized = normalizeServiceType(value);

  if (!normalized) {
    return "";
  }

  if (["repair", "mechanical repair", "roadside repair", "roadside assistance", "general"].includes(normalized)) {
    return "repair";
  }

  if (["mechanical", "mechanic"].includes(normalized)) {
    return "repair";
  }

  if (["transport", "transport rescue", "towing", "tow", "tow truck"].includes(normalized)) {
    return "transport";
  }

  if (
    normalized.includes("towing") ||
    normalized.includes("tow truck") ||
    normalized.includes("transport rescue") ||
    normalized.includes("transport")
  ) {
    return "transport";
  }

  return normalized;
}

function canonicalizeResponderServiceType(value) {
  const normalized = normalizeServiceType(value);

  if (!normalized) {
    return "";
  }

  const canonical = canonicalizeServiceType(normalized);

  if (
    canonical === "transport" ||
    normalized.includes("towing") ||
    normalized.includes("tow truck") ||
    normalized.includes("transport rescue") ||
    normalized.includes("transport")
  ) {
    return "transport";
  }

  if (
    canonical === "repair" ||
    normalized.includes("mechanic") ||
    normalized.includes("vulcaniz") ||
    normalized.includes("electrical") ||
    normalized.includes("electric") ||
    normalized.includes("battery") ||
    normalized.includes("roadside")
  ) {
    return "repair";
  }

  return "";
}

function getAgentServiceTypes(agent) {
  const rawValues = [
    ...(Array.isArray(agent?.service_types) ? agent.service_types : []),
    ...(Array.isArray(agent?.serviceTypes) ? agent.serviceTypes : []),
    ...(Array.isArray(agent?.service_categories) ? agent.service_categories : []),
    ...(Array.isArray(agent?.serviceCategories) ? agent.serviceCategories : []),
    agent?.service_type,
    agent?.serviceType,
    agent?.serviceCategory,
    agent?.service_category,
    agent?.category,
    ...(Array.isArray(agent?.services) ? agent.services : []),
    ...(Array.isArray(agent?.capabilities) ? agent.capabilities : []),
    agent?.business_name,
    agent?.businessName,
    agent?.organization_name,
    agent?.organizationName,
  ];

  return Array.from(
    new Set(
      rawValues
        .map((value) => canonicalizeResponderServiceType(value))
        .filter(Boolean),
    ),
  );
}

function getPrimaryServiceType(agent) {
  return getAgentServiceTypes(agent)[0] ?? canonicalizeServiceType(agent?.service_type) ?? "repair";
}

function getAgentLocationTimestampMs(agent) {
  const lastLocationUpdateMs = agent.last_location_update?.toDate?.()?.getTime?.();
  if (lastLocationUpdateMs) {
    return lastLocationUpdateMs;
  }

  const updatedAtMs = agent.updated_at?.toDate?.()?.getTime?.();
  return updatedAtMs ?? null;
}

function formatFirestoreDate(value) {
  if (!value) {
    return null;
  }

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString().split("T")[0];
}

function formatFirestoreDateTime(value) {
  if (!value) {
    return null;
  }

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getDateValue(value) {
  if (!value) {
    return null;
  }

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getManilaDateKey(value = new Date()) {
  const date = getDateValue(value);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getManilaMonthKey(value = new Date()) {
  const dateKey = getManilaDateKey(value);
  return dateKey ? dateKey.slice(0, 7) : null;
}

function normalizeSubscriptionPlan(value) {
  if (value === "monthly" || value === "six_months" || value === "annual") {
    return value;
  }

  return null;
}

function calculateSubscriptionExpiry(plan) {
  const now = new Date();
  const expiry = new Date(now);

  if (plan === "monthly") {
    expiry.setMonth(expiry.getMonth() + 1);
    return expiry;
  }

  if (plan === "six_months") {
    expiry.setMonth(expiry.getMonth() + 6);
    return expiry;
  }

  if (plan === "annual") {
    expiry.setFullYear(expiry.getFullYear() + 1);
    return expiry;
  }

  return null;
}

function hasActiveSubscription(user) {
  if (!user || user.subscription_status !== "active") {
    return false;
  }

  if (!user.subscription_expires_at) {
    return false;
  }

  const expiry =
    typeof user.subscription_expires_at?.toDate === "function"
      ? user.subscription_expires_at.toDate()
      : new Date(user.subscription_expires_at);

  return !Number.isNaN(expiry.getTime()) && expiry.getTime() >= Date.now();
}

function getMotoristSearchRadiusKm(user) {
  return 50;
}

function normalizePaymentStatus(value) {
  if (value === "confirmed" || value === "rejected") {
    return value;
  }

  return "pending";
}

function getSubscriptionOfferAmount(plan) {
  if (plan === "monthly") return 149;
  if (plan === "six_months") return 699;
  if (plan === "annual") return 1299;
  return 0;
}

function formatSubscriptionPlanLabel(plan) {
  if (plan === "monthly") return "Monthly";
  if (plan === "six_months") return "6 Months";
  if (plan === "annual") return "Annual";
  return "No plan";
}

const communityRewardCatalog = [
  { id: "supporter", title: "Supporter Cash Ticket", coinsRequired: 250, cashValue: 25 },
  { id: "agent", title: "Responder Cash Ticket", coinsRequired: 500, cashValue: 50 },
];

const COMMUNITY_DAILY_COIN_LIMIT = 4;

function normalizeCommunityRedemptionStatus(value) {
  if (
    value === "paid" ||
    value === "rejected" ||
    value === "processing" ||
    value === "failed" ||
    value === "details_required" ||
    value === "awaiting_wallet_funding"
  ) {
    return value;
  }

  return "pending";
}

function getCommunityRewardOption(rewardId) {
  return communityRewardCatalog.find((item) => item.id === rewardId) ?? null;
}

function getCommunityCoinBalance(user) {
  return Number(user?.community_coin_balance ?? 0);
}

function getCommunityLifetimeCoins(user) {
  return Number(user?.community_lifetime_coins ?? 0);
}

function formatCommunityRedemption(redemption) {
  const cashValue = Number(redemption.cash_value ?? 0);
  const payoutTransferFee = Number(redemption.payout_transfer_fee ?? getCommunityPayoutTransferFee());

  return {
    id: redemption.id,
    userId: redemption.user_id,
    userName: redemption.user_name ?? "Community Member",
    userPhone: redemption.user_phone ?? "",
    rewardId: redemption.reward_id ?? "",
    rewardTitle: redemption.reward_title ?? "Reward Ticket",
    cashValue,
    coinsRequired: Number(redemption.coins_required ?? 0),
    coinsSpent: Number(redemption.coins_spent ?? 0),
    gcashName: redemption.gcash_name ?? "",
    gcashNumber: redemption.gcash_number ?? "",
    status: normalizeCommunityRedemptionStatus(redemption.status),
    submittedAt: formatFirestoreDateTime(redemption.created_at),
    reviewedAt: formatFirestoreDateTime(redemption.reviewed_at),
    payoutTransferFee,
    netPayoutAmount: Number(redemption.net_payout_amount ?? Math.max(0, cashValue - payoutTransferFee)),
    provider: redemption.provider ?? getPayoutProviderMode(),
    providerPayoutId: redemption.provider_payout_id ?? null,
    providerStatus: redemption.provider_status ?? null,
    failureReason: redemption.failure_reason ?? "",
    processedAt: formatFirestoreDateTime(redemption.processed_at),
    paidAt: formatFirestoreDateTime(redemption.paid_at),
  };
}

function formatCommunityProfile(user) {
  return {
    id: user.id,
    fullName: user.full_name ?? user.username ?? "Community Member",
    role: user.role,
    communityCoins: getCommunityCoinBalance(user),
    communityLifetimeCoins: getCommunityLifetimeCoins(user),
    lastCommunityRewardAt: formatFirestoreDateTime(user.community_last_coin_activity_at),
    lastCommunityVisitRewardAt: formatFirestoreDateTime(user.community_last_visit_reward_at),
    communityCoinLockUntil: formatFirestoreDateTime(user.community_coin_lock_until),
  };
}

function getCommunityCoinLockState(user) {
  const nowMs = Date.now();
  const explicitLockUntil = getDateValue(user?.community_coin_lock_until);
  if (explicitLockUntil && explicitLockUntil.getTime() > nowMs) {
    return {
      active: true,
      lockUntil: explicitLockUntil,
    };
  }

  const today = getManilaDateKey();
  const storedDate = String(user?.community_daily_coin_date ?? "").trim() || null;
  const isToday = storedDate === today;
  const currentDailyEarned = isToday ? Number(user?.community_daily_earned_coins ?? 0) : 0;
  if (currentDailyEarned < COMMUNITY_DAILY_COIN_LIMIT) {
    return {
      active: false,
      lockUntil: explicitLockUntil,
    };
  }

  const lastActivity = getDateValue(user?.community_last_coin_activity_at);
  if (!lastActivity) {
    return {
      active: false,
      lockUntil: explicitLockUntil,
    };
  }

  const inferredLockUntil = new Date(lastActivity.getTime() + (24 * 60 * 60 * 1000));
  return {
    active: inferredLockUntil.getTime() > nowMs,
    lockUntil: inferredLockUntil,
  };
}

async function awardCommunityCoins(userId, amount, source) {
  if (!amount || amount <= 0) {
    return { awarded: false, amount: 0, profile: null, reason: "invalid_amount" };
  }

  const user = await getDocument(collections.users, userId);
  if (!user || user.role !== "community") {
    return { awarded: false, amount: 0, profile: null, reason: "missing_user" };
  }

  const today = getManilaDateKey();
  const storedDate = String(user.community_daily_coin_date ?? "").trim() || null;
  const isToday = storedDate === today;
  const currentDailyEarned = isToday ? Number(user.community_daily_earned_coins ?? 0) : 0;
  const currentThreadCount = isToday ? Number(user.community_daily_thread_count ?? 0) : 0;
  const currentReplyCount = isToday ? Number(user.community_daily_reply_count ?? 0) : 0;
  const lockState = getCommunityCoinLockState(user);

  if (lockState.active) {
    return {
      awarded: false,
      amount: 0,
      profile: formatCommunityProfile(user),
      reason: "daily_coin_lock",
    };
  }

  const remainingCoins = Math.max(COMMUNITY_DAILY_COIN_LIMIT - currentDailyEarned, 0);

  if (remainingCoins <= 0) {
    return {
      awarded: false,
      amount: 0,
      profile: formatCommunityProfile(user),
      reason: "daily_coin_limit",
    };
  }

  if (amount > remainingCoins) {
    return {
      awarded: false,
      amount: 0,
      profile: formatCommunityProfile(user),
      reason: "daily_coin_limit",
    };
  }

  const awardAmount = amount;

  const nextBalance = getCommunityCoinBalance(user) + awardAmount;
  const nextLifetime = getCommunityLifetimeCoins(user) + awardAmount;
  const nextThreadCount = source === "forum_thread" ? currentThreadCount + 1 : currentThreadCount;
  const nextReplyCount = source === "forum_reply" ? currentReplyCount + 1 : currentReplyCount;
  const nextDailyEarned = currentDailyEarned + awardAmount;
  const nextLockUntil = nextDailyEarned >= COMMUNITY_DAILY_COIN_LIMIT
    ? new Date(Date.now() + (24 * 60 * 60 * 1000))
    : null;

  await updateDocument(collections.users, userId, {
    community_coin_balance: nextBalance,
    community_lifetime_coins: nextLifetime,
    community_last_coin_activity_at: serverTimestamp(),
    community_last_coin_source: source,
    community_coin_lock_until: nextLockUntil,
    community_daily_coin_date: today,
    community_daily_earned_coins: nextDailyEarned,
    community_daily_thread_count: nextThreadCount,
    community_daily_reply_count: nextReplyCount,
  });

  const updatedUser = await getDocument(collections.users, userId);
  return {
    awarded: true,
    amount: awardAmount,
    profile: formatCommunityProfile(updatedUser),
    reason: null,
  };
}

async function awardCommunityVisitCoin(userId) {
  const user = await getDocument(collections.users, userId);
  if (!user || user.role !== "community") {
    const error = new Error("Community user not found.");
    error.statusCode = 404;
    throw error;
  }

  const lastRewardDate = getManilaDateKey(user.community_last_visit_reward_at);
  const today = getManilaDateKey();
  const storedDate = String(user.community_daily_coin_date ?? "").trim() || null;
  const isToday = storedDate === today;
  const currentDailyEarned = isToday ? Number(user.community_daily_earned_coins ?? 0) : 0;
  const lockState = getCommunityCoinLockState(user);
  if (lastRewardDate === today) {
    return {
      awarded: false,
      amount: 0,
      profile: formatCommunityProfile(user),
    };
  }

  if (lockState.active) {
    return {
      awarded: false,
      amount: 0,
      profile: formatCommunityProfile(user),
    };
  }

  if (currentDailyEarned >= COMMUNITY_DAILY_COIN_LIMIT) {
    return {
      awarded: false,
      amount: 0,
      profile: formatCommunityProfile(user),
    };
  }

  const nextBalance = getCommunityCoinBalance(user) + 1;
  const nextLifetime = getCommunityLifetimeCoins(user) + 1;
  const nextDailyEarned = currentDailyEarned + 1;
  const nextLockUntil = nextDailyEarned >= COMMUNITY_DAILY_COIN_LIMIT
    ? new Date(Date.now() + (24 * 60 * 60 * 1000))
    : null;

  await updateDocument(collections.users, userId, {
    community_coin_balance: nextBalance,
    community_lifetime_coins: nextLifetime,
    community_last_visit_reward_at: serverTimestamp(),
    community_last_coin_activity_at: serverTimestamp(),
    community_last_coin_source: "daily_forum_visit",
    community_coin_lock_until: nextLockUntil,
    community_daily_coin_date: today,
    community_daily_earned_coins: nextDailyEarned,
  });

  const updatedUser = await getDocument(collections.users, userId);
  return {
    awarded: true,
    amount: 1,
    profile: formatCommunityProfile(updatedUser),
  };
}

async function listCommunityRedemptions() {
  const redemptions = await getDocuments(collections.communityRedemptions);

  return redemptions
    .map(formatCommunityRedemption)
    .sort((a, b) => {
      const aTime = a.submittedAt ? Date.parse(a.submittedAt) : 0;
      const bTime = b.submittedAt ? Date.parse(b.submittedAt) : 0;
      return bTime - aTime;
    });
}

async function listSubscriptionPayments() {
  const payments = await getDocuments(collections.subscriptionPayments);

  return payments
    .map((payment) => ({
      id: payment.id,
      userId: payment.user_id,
      payerName: payment.payer_name ?? "Motorist",
      payerPhone: payment.payer_phone ?? "",
      subscriptionPlan: normalizeSubscriptionPlan(payment.subscription_plan),
      amount: Number(payment.amount ?? 0),
      referenceNote: payment.reference_note ?? "",
      status: normalizePaymentStatus(payment.status),
      submittedAt: formatFirestoreDateTime(payment.created_at),
      reviewedAt: formatFirestoreDateTime(payment.reviewed_at),
    }))
    .sort((a, b) => {
      const aTime = a.submittedAt ? Date.parse(a.submittedAt) : 0;
      const bTime = b.submittedAt ? Date.parse(b.submittedAt) : 0;
      return bTime - aTime;
    });
}

async function syncConfirmedSubscriptionPaymentForUser(user, plan, source = "admin_activation") {
  const normalizedPlan = normalizeSubscriptionPlan(plan);
  if (!user?.id || !normalizedPlan) {
    return null;
  }

  const amount = getSubscriptionOfferAmount(normalizedPlan);
  const existingConfirmedPayments = (await getDocuments(collections.subscriptionPayments, {
    user_id: user.id,
  }))
    .filter((payment) => normalizePaymentStatus(payment.status) === "confirmed")
    .sort((a, b) => {
      const aTime = getDateValue(a.reviewed_at ?? a.created_at)?.getTime() ?? 0;
      const bTime = getDateValue(b.reviewed_at ?? b.created_at)?.getTime() ?? 0;
      return bTime - aTime;
    });

  const currentPayment = existingConfirmedPayments[0] ?? null;
  const paymentData = {
    user_id: user.id,
    payer_name: user.full_name ?? user.username ?? "Motorist",
    payer_phone: user.phone ?? "",
    subscription_plan: normalizedPlan,
    amount,
    reference_note: source === "admin_activation"
      ? "Confirmed by admin from Motorist Management."
      : "Confirmed subscription payment.",
    status: "confirmed",
    reviewed_at: serverTimestamp(),
    source,
  };

  if (currentPayment) {
    await updateDocument(collections.subscriptionPayments, currentPayment.id, paymentData);
    return currentPayment.id;
  }

  return createDocument(collections.subscriptionPayments, paymentData);
}

async function buildAdminEarningsSummary() {
  const [users, subscriptionPayments, dispatches, responderPayouts] = await Promise.all([
    getDocuments(collections.users),
    getDocuments(collections.subscriptionPayments),
    getDocuments(collections.dispatches),
    getDocuments("responder_payouts"),
  ]);

  const activeMotorists = users.filter(
    (user) => user.role === "motorist" && hasActiveSubscription(user),
  );
  const unsubscribedMotorists = users
    .filter((user) => user.role === "motorist" && !hasActiveSubscription(user))
    .map((user) => ({
      id: user.id,
      fullName: user.full_name ?? user.username ?? "Motorist",
      phone: user.phone ?? "",
      email: user.email ?? "",
      registeredAt: formatFirestoreDate(user.created_at),
      accountStatus: user.status ?? "active",
    }))
    .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));

  const activeSubscriptionRows = activeMotorists.map((user) => {
    const plan = normalizeSubscriptionPlan(user.subscription_plan);
    return {
      userId: user.id,
      payerName: user.full_name ?? user.username ?? "Motorist",
      payerPhone: user.phone ?? "",
      subscriptionPlan: plan,
      planLabel: formatSubscriptionPlanLabel(plan),
      amount: getSubscriptionOfferAmount(plan),
      activatedAt: formatFirestoreDateTime(user.subscription_activated_at),
      expiresAt: formatFirestoreDateTime(user.subscription_expires_at),
      month: getManilaMonthKey(user.subscription_activated_at ?? user.updated_at ?? user.created_at),
    };
  });

  const confirmedSubscriptionPayments = subscriptionPayments
    .filter((payment) => normalizePaymentStatus(payment.status) === "confirmed")
    .map((payment) => ({
      id: payment.id,
      userId: payment.user_id,
      subscriptionPlan: normalizeSubscriptionPlan(payment.subscription_plan),
      amount: Number(payment.amount ?? 0),
      reviewedAt: formatFirestoreDateTime(payment.reviewed_at),
    }));

  const subscriptionRevenue = roundCurrency(
    activeSubscriptionRows.reduce((sum, payment) => sum + payment.amount, 0),
  );

  const monthKeys = Array.from(new Set([
    ...activeSubscriptionRows.map((row) => row.month).filter(Boolean),
    getManilaMonthKey(new Date()),
  ])).sort().slice(-6);

  const monthlySubscriptionStats = monthKeys.map((month) => {
    const rows = activeSubscriptionRows.filter((row) => row.month === month);
    return {
      month,
      active: rows.length,
      inactive: unsubscribedMotorists.length,
      monthly: rows.filter((row) => row.subscriptionPlan === "monthly").length,
      sixMonths: rows.filter((row) => row.subscriptionPlan === "six_months").length,
      annual: rows.filter((row) => row.subscriptionPlan === "annual").length,
      revenue: roundCurrency(rows.reduce((sum, row) => sum + row.amount, 0)),
    };
  });

  const completedDispatches = dispatches.filter(
    (dispatch) => dispatch.dispatch_status === "completed",
  );

  const commissionRows = completedDispatches
    .filter((dispatch) => dispatch.commission_amount != null)
    .map((dispatch) => ({
      id: dispatch.id,
      baseServiceAmount: Number(dispatch.base_service_amount ?? dispatch.total_amount ?? 0),
      payoutTransferFee: Number(dispatch.payout_transfer_fee ?? 0),
      totalAmount: Number(dispatch.total_amount ?? 0),
      serviceAmount: Number(dispatch.service_amount ?? 0),
      commissionAmount: Number(dispatch.commission_amount ?? 0),
      commissionRate: Number(dispatch.commission_rate ?? 0),
      subscriptionStatus:
        dispatch.motorist_subscription_status === "active" ? "active" : "inactive",
      completedAt: formatFirestoreDateTime(dispatch.completed_at ?? dispatch.updated_at),
    }));

  const serviceCommissionRevenue = roundCurrency(
    commissionRows.reduce((sum, dispatch) => sum + dispatch.commissionAmount, 0),
  );

  const freeMotoristCommissionRevenue = roundCurrency(
    commissionRows
      .filter((dispatch) => dispatch.subscriptionStatus !== "active")
      .reduce((sum, dispatch) => sum + dispatch.commissionAmount, 0),
  );

  const paidMotoristCommissionRevenue = roundCurrency(
    commissionRows
      .filter((dispatch) => dispatch.subscriptionStatus === "active")
      .reduce((sum, dispatch) => sum + dispatch.commissionAmount, 0),
  );

  const responderPayoutTotal = roundCurrency(
    responderPayouts.reduce((sum, payout) => sum + Number(payout.net_amount ?? 0), 0),
  );
  const paidResponderPayoutTotal = roundCurrency(
    responderPayouts
      .filter((payout) => payout.status === "paid")
      .reduce((sum, payout) => sum + Number(payout.net_amount ?? 0), 0),
  );
  const pendingResponderPayoutTotal = roundCurrency(
    responderPayouts
      .filter((payout) => payout.status !== "paid")
      .reduce((sum, payout) => sum + Number(payout.net_amount ?? 0), 0),
  );

  return {
    totalRevenue: roundCurrency(subscriptionRevenue + serviceCommissionRevenue),
    subscriptionRevenue,
    serviceCommissionRevenue,
    freeMotoristCommissionRevenue,
    paidMotoristCommissionRevenue,
    confirmedSubscriptionCount: activeSubscriptionRows.length,
    confirmedSubscriptionPayments,
    activeSubscriptions: activeSubscriptionRows
      .sort((a, b) => String(b.activatedAt ?? "").localeCompare(String(a.activatedAt ?? ""))),
    monthlySubscriptionStats,
    unsubscribedMotorists,
    completedCommissionDispatchCount: commissionRows.length,
    responderPayoutTotal,
    paidResponderPayoutTotal,
    pendingResponderPayoutTotal,
    responderPayoutCount: responderPayouts.length,
    paidResponderPayoutCount: responderPayouts.filter((payout) => payout.status === "paid").length,
    commissionPolicy: {
      freeMotoristRate: 0.2,
      paidMotoristRate: 0.05,
    },
    recentCommissions: commissionRows
      .sort((a, b) => String(b.completedAt ?? "").localeCompare(String(a.completedAt ?? "")))
      .slice(0, 8),
  };
}

function normalizeForumTopic(value) {
  const topic = String(value ?? "").trim().toLowerCase();
  const allowedTopics = new Set(["general", "agent", "motorist", "payment", "road", "safety"]);
  return allowedTopics.has(topic) ? topic : "general";
}

function normalizeForumRole(value) {
  if (value === "agent" || value === "community") {
    return value;
  }

  return "motorist";
}

async function resolveForumAuthor(userId, role) {
  const normalizedRole = normalizeForumRole(role);
  const user = await getDocument(collections.users, userId);

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  if (user.role !== normalizedRole) {
    const error = new Error("User role does not match the current session.");
    error.statusCode = 403;
    throw error;
  }

  return {
    id: user.id,
    role: normalizedRole,
    name: user.full_name || user.username || "Soteria User",
  };
}

async function requireForumAdmin(adminUserId) {
  const normalizedAdminUserId = String(adminUserId ?? "").trim();

  if (!normalizedAdminUserId) {
    const error = new Error("adminUserId is required.");
    error.statusCode = 400;
    throw error;
  }

  const adminUser = await getDocument(collections.users, normalizedAdminUserId);
  if (!adminUser || adminUser.role !== "admin") {
    const error = new Error("Admin permission is required to manage forum content.");
    error.statusCode = 403;
    throw error;
  }

  return adminUser;
}

async function listForumReplies(threadId) {
  const replies = await getDocuments(collections.forumReplies, { thread_id: threadId });

  return replies
    .sort((a, b) => {
      const aTime = a.created_at?.toDate?.()?.getTime?.() ?? 0;
      const bTime = b.created_at?.toDate?.()?.getTime?.() ?? 0;
      return aTime - bTime;
    })
    .map((reply) => ({
      id: reply.id,
      threadId: reply.thread_id,
      authorUserId: reply.author_user_id,
      authorName: reply.author_name,
      authorRole: reply.author_role,
      body: reply.body,
      createdAt: formatFirestoreDateTime(reply.created_at),
    }));
}

async function listForumThreads() {
  const threads = await getDocuments(collections.forumThreads);

  const hydratedThreads = await Promise.all(
    threads.map(async (thread) => {
      const replies = await listForumReplies(thread.id);

      return {
        id: thread.id,
        title: thread.title ?? "",
        body: thread.body ?? "",
        topic: normalizeForumTopic(thread.topic),
        authorUserId: thread.author_user_id ?? "",
        authorName: thread.author_name ?? "Soteria User",
        authorRole: normalizeForumRole(thread.author_role),
        createdAt: formatFirestoreDateTime(thread.created_at),
        lastActivityAt: formatFirestoreDateTime(thread.last_activity_at ?? thread.updated_at ?? thread.created_at),
        replyCount: replies.length,
        replies,
      };
    }),
  );

  return hydratedThreads.sort((a, b) => {
    const aTime = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const bTime = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    return bTime - aTime;
  });
}

function isServiceTypeCompatible(requestedServiceType, agentServiceType) {
  const requested = canonicalizeServiceType(requestedServiceType);
  const agentTypes = Array.isArray(agentServiceType)
    ? agentServiceType.map((value) => canonicalizeServiceType(value)).filter(Boolean)
    : [canonicalizeServiceType(agentServiceType)].filter(Boolean);

  if (!requested || requested === "repair") {
    return true;
  }

  if (agentTypes.length === 0) {
    return false;
  }

  if (requested === "transport") {
    return agentTypes.includes("transport");
  }

  return agentTypes.some((agentType) => agentType.includes(requested));
}

function rankNearbyAgent(requestedServiceType, agent) {
  const requested = canonicalizeServiceType(requestedServiceType);
  const agentTypes = getAgentServiceTypes(agent);

  return {
    exactServiceMatch: Boolean(requested) && agentTypes.includes(requested),
    compatibleServiceMatch: isServiceTypeCompatible(requestedServiceType, agentTypes),
    lastLocationUpdateMs: getAgentLocationTimestampMs(agent) ?? 0,
  };
}

function mapRequestedCategoryForDisplay(requestedServiceType, agent) {
  const requested = canonicalizeServiceType(requestedServiceType);

  if (requested === "transport" && getAgentServiceTypes(agent).includes("transport")) {
    return "towing";
  }

  const primary = getPrimaryServiceType(agent);
  if (primary === "repair") {
    return "mechanical";
  }

  if (primary === "transport") {
    return "towing";
  }

  return primary;
}

async function createEmergencyDispatchRecord(payload) {
  let motoristUserId = null;

  if (payload.userId) {
    const user = await getDocument(collections.users, payload.userId);
    if (user?.role === "motorist") {
      motoristUserId = user.id;
    }
  }

  if (!motoristUserId) {
    const reference = await resolveUserReference(payload.username);
    motoristUserId = reference.userId;
  }

  if (!motoristUserId) {
    throw new Error("No matching motorist account was found for this emergency request.");
  }

  const motoristUser = await getDocument(collections.users, motoristUserId);
  const activeSubscription = hasActiveSubscription(motoristUser);

  const triageLevel =
    payload.symptoms?.length >= 3 ? "high" : payload.symptoms?.length >= 2 ? "medium" : "low";

  const reportId = await createDocument(collections.emergencyReports, {
    motorist_user_id: motoristUserId,
    vehicle_type: payload.serviceType === "transport" ? "Transport Rescue" : "Roadside Repair",
    issue_summary: payload.issueSummary,
    triage_level: triageLevel,
    subscriber_priority: activeSubscription,
    report_status: "matched",
    location_label: payload.locationLabel,
    latitude: payload.latitude,
    longitude: payload.longitude,
  });

  if (payload.symptoms?.length > 0) {
    for (const symptom of payload.symptoms) {
      await createDocument(collections.emergencyReportSymptoms, {
        emergency_report_id: reportId,
        symptom_text: symptom,
      });
    }
  }

  // Assign agent
  let assignedAgentId = null;
  if (payload.matchedAgentId) {
    assignedAgentId = payload.matchedAgentId;
    console.log(`[DISPATCH] Using matched responder ${assignedAgentId} for dispatch`);
  } else {
    try {
      const nearbyAgent = await findNearbyAgent(
        payload.latitude,
        payload.longitude,
        payload.serviceType,
      );
      if (nearbyAgent) {
        assignedAgentId = nearbyAgent.user_id;
        console.log(`[DISPATCH] Auto-assigned responder ${nearbyAgent.business_name} (${assignedAgentId}) to dispatch`);
      } else {
        console.log(`[DISPATCH] No nearby responders found for dispatch at (${payload.latitude}, ${payload.longitude})`);
      }
    } catch (error) {
      console.error("[DISPATCH] Responder matching failed:", error);
    }
  }

  const dispatchId = await createDocument(collections.dispatches, {
    emergency_report_id: reportId,
    repair_shop_id: payload.matchedShopId || null,
    responder_user_id: assignedAgentId,
    agent_user_id: assignedAgentId,
    dispatch_status: "pending",
    total_amount: null,
    service_amount: null,
    commission_amount: null,
    commission_rate: null,
    payment_status: null,
    payout_status: null,
    payout_transferred_at: null,
    transfer_reference: null,
    motorist_subscription_status: activeSubscription ? "active" : "inactive",
  });

  console.log(`[DISPATCH] Created dispatch ${dispatchId} - Responder ID: ${assignedAgentId}, Status: pending`);

  return {
    reportId,
    dispatchId,
  };
}

// API Endpoints

app.get("/api/repair-shops", async (_request, response, next) => {
  try {
    const repairShops = await getDocuments(collections.repairShops);
    response.json(repairShops.map(normalizeRepairShop));
  } catch (error) {
    next(error);
  }
});

app.post("/api/repair-shops", async (request, response, next) => {
  try {
    const payload = normalizeRepairShopPayload(request.body ?? {});
    const id = await createDocument(collections.repairShops, payload);
    const shop = await getDocument(collections.repairShops, id);
    response.status(201).json(normalizeRepairShop(shop));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/repair-shops/:shopId", async (request, response, next) => {
  try {
    const { shopId } = request.params;
    const existing = await getDocument(collections.repairShops, shopId);
    if (!existing) {
      response.status(404).json({ error: "Repair shop not found." });
      return;
    }

    const payload = normalizeRepairShopPayload({
      ...normalizeRepairShop(existing),
      ...request.body,
    });
    await updateDocument(collections.repairShops, shopId, payload);
    const shop = await getDocument(collections.repairShops, shopId);
    response.json(normalizeRepairShop(shop));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/repair-shops/:shopId", async (request, response, next) => {
  try {
    const { shopId } = request.params;
    const existing = await getDocument(collections.repairShops, shopId);
    if (!existing) {
      response.status(404).json({ error: "Repair shop not found." });
      return;
    }

    await deleteDocument(collections.repairShops, shopId);
    response.json({ id: shopId, deleted: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/login", async (request, response, next) => {
  try {
    const { username, password } = request.body ?? {};
    console.log(`[USER LOGIN] Username: ${username}`);

    if (!username || !password) {
      response.status(400).json({ error: "Username and password are required." });
      return;
    }

    // Find user by username, email, or phone
    const reference = await resolveUserReference(username);
    console.log(`[USER LOGIN] Reference found: ${reference.userId}`);
    if (!reference.userId) {
      console.log(`[USER LOGIN] User not found`);
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const user = await getDocument(collections.users, reference.userId);
    console.log(`[USER LOGIN] User document: ${user?.username}, role: ${user?.role}`);
    if (!user || user.role !== 'motorist') {
      console.log(`[USER LOGIN] User not found or not motorist`);
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    console.log(`[USER LOGIN] Password valid: ${isValidPassword}`);
    if (!isValidPassword) {
      console.log(`[USER LOGIN] Invalid password`);
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    console.log(`[USER LOGIN] Login successful for: ${username}`);
    response.json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      subscriptionStatus: hasActiveSubscription(user) ? "active" : "inactive",
      subscriptionPlan: normalizeSubscriptionPlan(user.subscription_plan),
      subscriptionActivatedAt: user.subscription_activated_at
        ? formatFirestoreDate(user.subscription_activated_at)
        : null,
      subscriptionExpiresAt: user.subscription_expires_at
        ? formatFirestoreDate(user.subscription_expires_at)
        : null,
      soteriaCreditBalance: readSoteriaCreditBalance(user),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/community/login", async (request, response, next) => {
  try {
    const { username, password } = request.body ?? {};

    if (!username || !password) {
      response.status(400).json({ error: "Username and password are required." });
      return;
    }

    const reference = await resolveUserReference(username);
    if (!reference.userId) {
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const user = await getDocument(collections.users, reference.userId);
    if (!user || user.role !== "community") {
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    response.json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      communityCoins: getCommunityCoinBalance(user),
      communityLifetimeCoins: getCommunityLifetimeCoins(user),
      lastCommunityRewardAt: formatFirestoreDateTime(user.community_last_coin_activity_at),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/agents/login", async (request, response, next) => {
  try {
    const { username, password } = request.body ?? {};

    if (!username || !password) {
      response.status(400).json({ error: "Username and password are required." });
      return;
    }

    const reference = await resolveUserReference(username);
    if (!reference.userId) {
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const user = await getDocument(collections.users, reference.userId);
    if (!user || user.role !== 'agent') {
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    if (user.status !== "active") {
      response.status(403).json({
        error: "Your responder account is still pending admin approval.",
      });
      return;
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const agentProfile = await getAgentProfileByUserId(user.id);
    if (!agentProfile || agentProfile.verification_status !== "approved") {
      response.status(403).json({
        error: "Your responder account is still pending admin approval.",
      });
      return;
    }
    const balanceProof = getAgentBalanceProofStatus(agentProfile);

    response.json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      balanceProofStatus: balanceProof.status,
      balanceProofExpiresAt: balanceProof.expiresAt,
      walletReadinessTier: balanceProof.tier,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/login", async (request, response, next) => {
  try {
    const { username, password } = request.body ?? {};
    console.log(`[ADMIN LOGIN] Attempting login for: ${username}`);

    if (!username || !password) {
      console.log(`[ADMIN LOGIN] Missing username or password`);
      response.status(400).json({ error: "Username and password are required." });
      return;
    }

    const reference = await resolveUserReference(username);
    if (!reference.userId) {
      console.log(`[ADMIN LOGIN] User not found`);
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const user = await getDocument(collections.users, reference.userId);
    if (!user || user.role !== 'admin') {
      console.log(`[ADMIN LOGIN] User not admin or not found`);
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      console.log(`[ADMIN LOGIN] Invalid password`);
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    console.log(`[ADMIN LOGIN] Login successful for: ${username}`);
    response.json({
      id: user.id,
      username: user.username || username,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/register", async (request, response, next) => {
  try {
    const payload = request.body ?? {};

    if (!payload.fullName || !payload.mobileNumber || !payload.username || !payload.password) {
      response.status(400).json({ error: "fullName, mobileNumber, username, and password are required." });
      return;
    }

    const result = await createMotorist(payload);
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/agent-applications/register", async (request, response, next) => {
  try {
    const payload = request.body ?? {};

    const hasServiceCategories =
      (Array.isArray(payload.serviceCategories) && payload.serviceCategories.length > 0) ||
      Boolean(payload.serviceCategory);

    if (!payload.ownerName || !payload.mobileNumber || !hasServiceCategories || !payload.username || !payload.password) {
      response.status(400).json({
        error: "ownerName, mobileNumber, at least one service category, username, and password are required.",
      });
      return;
    }

    const result = await createAgentApplication(payload);
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/emergency-dispatches", async (request, response, next) => {
  try {
    const payload = request.body ?? {};

    if (!payload.username || !payload.mobileNumber || !payload.locationLabel || !payload.serviceType) {
      response.status(400).json({
        error: "username, mobileNumber, locationLabel, and serviceType are required.",
      });
      return;
    }

    const result = await createEmergencyDispatchRecord(payload);
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/dispatches/:dispatchId/status", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const { status, totalAmount } = request.body ?? {};

    if (!status) {
      response.status(400).json({ error: "status is required." });
      return;
    }

    const dispatch = await getDocument(collections.dispatches, dispatchId);
    if (!dispatch) {
      response.status(404).json({ error: "Dispatch not found." });
      return;
    }

    const updateData = {
      dispatch_status: status,
    };

    if (status === "accepted") updateData.accepted_at = serverTimestamp();
    if (status === "arrived") updateData.arrived_at = serverTimestamp();
    if (status === "completed") {
      const quotedServiceAmount = normalizeCurrencyInput(totalAmount);
      const minimumPayoutAmount = getResponderMinimumPayoutAmount();
      if (minimumPayoutAmount > 0 && quotedServiceAmount < minimumPayoutAmount) {
        response.status(400).json({
          error: `Responder service payout must be at least PHP ${minimumPayoutAmount.toLocaleString("en-PH")}.`,
        });
        return;
      }

      const dispatchDetails = await buildDispatchDetails(dispatch);
      const payment = await buildDispatchPaymentSummary(
        {
          ...dispatch,
          quoted_service_amount: quotedServiceAmount,
        },
        dispatchDetails,
      );

      updateData.dispatch_status = "payment_pending";
      updateData.total_amount = payment.totalAmount;
      updateData.base_service_amount = payment.baseServiceAmount;
      updateData.payout_transfer_fee = payment.payoutTransferFee;
      updateData.service_amount = payment.serviceAmount;
      updateData.commission_amount = payment.commissionAmount;
      updateData.commission_rate = payment.commissionRate;
      updateData.motorist_subscription_status = payment.subscriptionStatus;
      updateData.motorist_subscription_plan = payment.subscriptionPlan;
      updateData.payment_status = "awaiting_motorist_payment";
      updateData.payment_method = null;
      updateData.payout_status = "pending";
      updateData.payout_transferred_at = null;
      updateData.transfer_reference = payment.transferReference;
      updateData.credit_balance_after = null;
      updateData.service_completed_at = serverTimestamp();
    }

    await updateDocument(collections.dispatches, dispatchId, updateData);

    // Update emergency report status
    if (dispatch.emergency_report_id) {
      const reportStatus =
        status === "completed" ? "awaiting_payment" :
        status === "cancelled" ? "cancelled" :
        (status === "accepted" || status === "arrived") ? "in_progress" : "matched";

      await updateDocument(collections.emergencyReports, dispatch.emergency_report_id, {
        report_status: reportStatus
      });
    }

    response.json({ id: dispatchId, dispatch_status: updateData.dispatch_status });
  } catch (error) {
    next(error);
  }
});

app.post("/api/dispatches/:dispatchId/payment", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const { paymentMethod = "soteria_credits" } = request.body ?? {};
    const normalizedPaymentMethod = paymentMethod === "online_payment" ? "online_payment" : "soteria_credits";

    const dispatch = await getDocument(collections.dispatches, dispatchId);
    if (!dispatch) {
      response.status(404).json({ error: "Dispatch not found." });
      return;
    }

    if (dispatch.dispatch_status === "completed") {
      response.status(409).json({ error: "This service has already been paid and completed." });
      return;
    }

    if (dispatch.dispatch_status !== "payment_pending") {
      response.status(400).json({ error: "This dispatch is not waiting for motorist payment." });
      return;
    }

    const dispatchDetails = await buildDispatchDetails(dispatch);
    const payment = await buildDispatchPaymentSummary(dispatch, dispatchDetails);

    if (normalizedPaymentMethod === "online_payment") {
      const existingPendingPayments = (await getDocuments("service_payments", { dispatch_id: dispatchId }))
        .filter((item) => item.provider === "paymongo" && item.status === "pending_payment");
      const existingPayment = existingPendingPayments[0] ?? null;

      if (existingPayment?.payment_url) {
        response.status(202).json({
          id: dispatchId,
          dispatch_status: dispatch.dispatch_status,
          paymentRequired: true,
          paymentMethod: normalizedPaymentMethod,
          paymentUrl: existingPayment.payment_url,
          servicePaymentId: existingPayment.id,
          amount: Number(existingPayment.amount ?? payment.totalAmount),
          baseServiceAmount: Number(existingPayment.base_service_amount ?? payment.baseServiceAmount),
          payoutTransferFee: Number(existingPayment.payout_transfer_fee ?? payment.payoutTransferFee),
        });
        return;
      }

      const reference = `SOT-SVC-${dispatchId}-${Date.now()}`;
      const link = await createPayMongoServiceLink({
        amount: payment.totalAmount,
        dispatchId,
        reference,
      });
      const servicePaymentId = await createDocument("service_payments", {
        dispatch_id: dispatchId,
        motorist_user_id: dispatchDetails.motorist?.id ?? "",
        responder_user_id: dispatchDetails.agent?.id ?? "",
        amount: payment.totalAmount,
        base_service_amount: payment.baseServiceAmount,
        payout_transfer_fee: payment.payoutTransferFee,
        service_amount: payment.serviceAmount,
        commission_amount: payment.commissionAmount,
        commission_rate: payment.commissionRate,
        currency: "PHP",
        status: "pending_payment",
        provider: "paymongo",
        provider_link_id: link.providerLinkId,
        provider_reference_number: link.providerReferenceNumber,
        provider_status: link.status,
        payment_url: link.paymentUrl,
        reference,
        created_at: serverTimestamp(),
        paid_at: null,
      });

      await updateDocument(collections.dispatches, dispatchId, {
        payment_status: "provider_pending",
        payment_method: "online_payment",
        service_payment_id: servicePaymentId,
      });

      response.status(202).json({
        id: dispatchId,
        dispatch_status: dispatch.dispatch_status,
        paymentRequired: true,
        paymentMethod: normalizedPaymentMethod,
        paymentUrl: link.paymentUrl,
        servicePaymentId,
        amount: payment.totalAmount,
        baseServiceAmount: payment.baseServiceAmount,
        payoutTransferFee: payment.payoutTransferFee,
      });
      return;
    }

    if (!dispatchDetails.motorist?.id) {
      response.status(400).json({ error: "Motorist account is required before paying with Soteria Credits." });
      return;
    }

    const motorist = await getDocument(collections.users, dispatchDetails.motorist.id);
    const debit = await deductSoteriaCredits(motorist, payment.totalAmount, "service_payment", {
      dispatchId,
      commissionAmount: payment.commissionAmount,
      baseServiceAmount: payment.baseServiceAmount,
      payoutTransferFee: payment.payoutTransferFee,
      responderPayout: payment.serviceAmount,
    });

    await updateDocument(collections.dispatches, dispatchId, {
      dispatch_status: "completed",
      completed_at: serverTimestamp(),
      total_amount: payment.totalAmount,
      base_service_amount: payment.baseServiceAmount,
      payout_transfer_fee: payment.payoutTransferFee,
      service_amount: payment.serviceAmount,
      commission_amount: payment.commissionAmount,
      commission_rate: payment.commissionRate,
      motorist_subscription_status: payment.subscriptionStatus,
      motorist_subscription_plan: payment.subscriptionPlan,
      payment_status: "system_received",
      payment_method: "soteria_credits",
      payout_status: "processing",
      payout_transferred_at: null,
      transfer_reference: payment.transferReference,
      credit_balance_after: debit.balance,
    });

    if (dispatch.emergency_report_id) {
      await updateDocument(collections.emergencyReports, dispatch.emergency_report_id, {
        report_status: "completed",
      });
    }

    await queueAndProcessResponderPayout(dispatch, dispatchDetails, payment);

    const updatedDispatch = await getDocument(collections.dispatches, dispatchId);
    response.json({
      id: dispatchId,
      dispatch_status: "completed",
      creditBalance: debit.balance,
      dispatch: serializeDispatchDetails(await buildDispatchDetails(updatedDispatch)),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/community/register", async (request, response, next) => {
  try {
    const payload = request.body ?? {};

    if (!payload.fullName || !payload.mobileNumber || !payload.username || !payload.password) {
      response.status(400).json({ error: "fullName, mobileNumber, username, and password are required." });
      return;
    }

    const result = await createCommunityUser(payload);
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/dispatches/:dispatchId/payment/sync", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const dispatch = await getDocument(collections.dispatches, dispatchId);
    if (!dispatch) {
      response.status(404).json({ error: "Dispatch not found." });
      return;
    }

    const syncResult = await syncPaidServicePaymentForDispatch(dispatch);
    const updatedDispatch = await getDocument(collections.dispatches, dispatchId);
    response.json({
      syncResult,
      dispatch: updatedDispatch ? serializeDispatchDetails(await buildDispatchDetails(updatedDispatch)) : null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dispatches/:dispatchId/feedback", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const reviewerUserId = String(request.query.reviewerUserId ?? "").trim();
    const reviewerRole = String(request.query.reviewerRole ?? "").trim();

    if (!reviewerUserId || !["motorist", "agent"].includes(reviewerRole)) {
      response.status(400).json({ error: "reviewerUserId and reviewerRole are required." });
      return;
    }

    await resolveDispatchFeedbackContext(dispatchId, reviewerRole, reviewerUserId);

    const feedback = await getDispatchFeedback(dispatchId, reviewerRole, reviewerUserId);
    response.json(feedback);
  } catch (error) {
    next(error);
  }
});

app.get("/api/dispatches/:dispatchId/feedback/all", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const viewerUserId = String(request.query.viewerUserId ?? "").trim();
    const viewerRole = String(request.query.viewerRole ?? "").trim();

    if (!viewerUserId || !["motorist", "agent"].includes(viewerRole)) {
      response.status(400).json({ error: "viewerUserId and viewerRole are required." });
      return;
    }

    const context = await resolveDispatchParticipantContext(dispatchId, viewerRole, viewerUserId);
    const feedback = await listDispatchFeedback(dispatchId);

    response.json({
      dispatchId,
      dispatchStatus: context.dispatch.dispatch_status,
      feedback,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/feedback/history", async (request, response, next) => {
  try {
    const userId = String(request.query.userId ?? "").trim();
    const role = String(request.query.role ?? "").trim();

    if (!userId || !["motorist", "agent"].includes(role)) {
      response.status(400).json({ error: "userId and role are required." });
      return;
    }

    const history = await listFeedbackHistoryForUser(userId, role);
    response.json(history);
  } catch (error) {
    next(error);
  }
});

app.get("/api/dispatches/history", async (request, response, next) => {
  try {
    const userId = String(request.query.userId ?? "").trim();
    const role = String(request.query.role ?? "").trim();

    if (!userId || !["motorist", "agent"].includes(role)) {
      response.status(400).json({ error: "userId and role are required." });
      return;
    }

    const history = await listCompletedDispatchHistoryForUser(userId, role);
    response.json(history);
  } catch (error) {
    next(error);
  }
});

app.get("/api/forum/threads", async (_request, response, next) => {
  try {
    const threads = await listForumThreads();
    response.json(threads);
  } catch (error) {
    next(error);
  }
});

app.get("/api/community/profile/:userId", async (request, response, next) => {
  try {
    const { userId } = request.params;
    const user = await getDocument(collections.users, userId);

    if (!user || user.role !== "community") {
      response.status(404).json({ error: "Community user not found." });
      return;
    }

    response.json(formatCommunityProfile(user));
  } catch (error) {
    next(error);
  }
});

app.get("/api/community/rewards/options", async (_request, response, next) => {
  try {
    response.json(communityRewardCatalog);
  } catch (error) {
    next(error);
  }
});

app.post("/api/community/rewards/forum-visit", async (request, response, next) => {
  try {
    const { userId } = request.body ?? {};

    if (!userId) {
      response.status(400).json({ error: "userId is required." });
      return;
    }

    const result = await awardCommunityVisitCoin(userId);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/community/redemptions", async (_request, response, next) => {
  try {
    const redemptions = await listCommunityRedemptions();
    response.json(redemptions);
  } catch (error) {
    next(error);
  }
});

app.post("/api/community/redemptions", async (request, response, next) => {
  try {
    const { userId, rewardId, gcashName, gcashNumber } = request.body ?? {};

    if (!userId || !rewardId || !gcashName || !gcashNumber) {
      response.status(400).json({ error: "userId, rewardId, gcashName, and gcashNumber are required." });
      return;
    }

    const user = await getDocument(collections.users, userId);
    if (!user || user.role !== "community") {
      response.status(404).json({ error: "Community user not found." });
      return;
    }

    const reward = getCommunityRewardOption(rewardId);
    if (!reward) {
      response.status(400).json({ error: "Invalid reward option selected." });
      return;
    }

    const currentBalance = getCommunityCoinBalance(user);
    if (currentBalance < reward.coinsRequired) {
      response.status(400).json({ error: "Not enough community coins for this reward ticket." });
      return;
    }

    const payoutTransferFee = getCommunityPayoutTransferFee();
    const netPayoutAmount = Number(reward.cashValue) - payoutTransferFee;
    if (!Number.isFinite(netPayoutAmount) || netPayoutAmount <= 0) {
      response.status(400).json({
        error: "This reward ticket is not available for automated payout because its cash value does not exceed the PHP 10 transaction fee.",
      });
      return;
    }

    const normalizedGcashName = normalizePersonName(gcashName);
    const normalizedGcashNumber = normalizePayoutAccountNumber(gcashNumber);
    if (!normalizedGcashName || !isValidGcashAccountNumber(normalizedGcashNumber)) {
      response.status(400).json({ error: "GCash name and an active 11-digit GCash number starting with 09 are required." });
      return;
    }

    const redemptionId = await createDocument(collections.communityRedemptions, {
      user_id: user.id,
      user_name: user.full_name ?? user.username ?? "Community Member",
      user_phone: user.phone ?? "",
      reward_id: reward.id,
      reward_title: reward.title,
      coins_required: reward.coinsRequired,
      coins_spent: currentBalance,
      cash_value: reward.cashValue,
      payout_transfer_fee: payoutTransferFee,
      net_payout_amount: netPayoutAmount,
      gcash_name: normalizedGcashName,
      gcash_number: normalizedGcashNumber,
      provider: getPayoutProviderMode(),
      provider_payout_id: null,
      provider_status: null,
      failure_reason: "",
      status: "pending",
      processed_at: null,
      paid_at: null,
      reviewed_at: null,
    });

    await updateDocument(collections.users, user.id, {
      community_coin_balance: 0,
      community_last_coin_activity_at: serverTimestamp(),
      community_last_coin_source: "reward_redemption",
    });

    const redemption = await processCommunityRedemptionPayout(
      await getDocument(collections.communityRedemptions, redemptionId),
    );
    response.status(201).json({
      ...formatCommunityRedemption(redemption),
      profile: formatCommunityProfile(await getDocument(collections.users, user.id)),
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/community/redemptions/:redemptionId", async (request, response, next) => {
  try {
    const { redemptionId } = request.params;
    const { status } = request.body ?? {};

    if (!["paid", "rejected"].includes(status)) {
      response.status(400).json({ error: "status must be 'paid' or 'rejected'." });
      return;
    }

    const redemption = await getDocument(collections.communityRedemptions, redemptionId);
    if (!redemption) {
      response.status(404).json({ error: "Community redemption not found." });
      return;
    }

    const currentStatus = normalizeCommunityRedemptionStatus(redemption.status);
    if (currentStatus !== "pending") {
      response.status(400).json({ error: "Only pending redemptions can be updated." });
      return;
    }

    await updateDocument(collections.communityRedemptions, redemptionId, {
      status,
      reviewed_at: serverTimestamp(),
    });

    if (status === "rejected") {
      const user = await getDocument(collections.users, redemption.user_id);
      if (user?.role === "community") {
        await updateDocument(collections.users, redemption.user_id, {
          community_coin_balance: getCommunityCoinBalance(user) + Number(redemption.coins_spent ?? 0),
          community_last_coin_activity_at: serverTimestamp(),
          community_last_coin_source: "reward_reversal",
        });
      }
    }

    const updatedRedemption = await getDocument(collections.communityRedemptions, redemptionId);
    response.json(formatCommunityRedemption(updatedRedemption));
  } catch (error) {
    next(error);
  }
});

app.get("/api/subscription-payments", async (_request, response, next) => {
  try {
    const payments = await listSubscriptionPayments();
    response.json(payments);
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/earnings", async (_request, response, next) => {
  try {
    response.json(await buildAdminEarningsSummary());
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/responder-payouts", async (_request, response, next) => {
  try {
    response.json(await listResponderPayouts());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/responder-payouts/:payoutId/retry", async (request, response, next) => {
  try {
    const { payoutId } = request.params;
    const payout = await retryResponderPayout(payoutId);
    if (!payout) {
      response.status(404).json({ error: "Responder payout not found." });
      return;
    }

    response.json({
      payout: (await listResponderPayouts()).find((item) => item.id === payout.id) ?? payout,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/responder-payouts/:payoutId/sync", async (request, response, next) => {
  try {
    const { payoutId } = request.params;
    const payout = await getDocument("responder_payouts", payoutId);
    if (!payout) {
      response.status(404).json({ error: "Responder payout not found." });
      return;
    }

    const syncedPayout = await syncPayMongoResponderPayoutStatus(payout);
    await updateDispatchPayoutFromResponderPayout(payout.dispatch_id, syncedPayout);
    response.json({
      payout: (await listResponderPayouts()).find((item) => item.id === payout.id) ?? syncedPayout,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/responder-payouts/retry-failed", async (_request, response, next) => {
  try {
    const payouts = await getDocuments("responder_payouts");
    const retryablePayouts = payouts.filter((payout) =>
      ["failed", "details_required", "awaiting_wallet_funding"].includes(String(payout.status ?? "")),
    );
    const results = [];

    for (const payout of retryablePayouts) {
      results.push(await retryResponderPayout(payout.id));
    }

    response.json({
      retried: results.length,
      payouts: await listResponderPayouts(),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/responder-payouts/process-due", async (_request, response, next) => {
  try {
    const results = await processDueResponderPayouts();
    response.json({
      processed: results.length,
      payouts: await listResponderPayouts(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId/credits", async (request, response, next) => {
  try {
    const { userId } = request.params;
    const user = await getDocument(collections.users, userId);

    if (!user || user.role !== "motorist") {
      response.status(404).json({ error: "Motorist user not found." });
      return;
    }

    response.json(formatSoteriaCredits(user));
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/:userId/credits/topups", async (request, response, next) => {
  try {
    const { userId } = request.params;
    const amount = normalizeCurrencyInput(request.body?.amount);
    const user = await getDocument(collections.users, userId);

    if (!user || user.role !== "motorist") {
      response.status(404).json({ error: "Motorist user not found." });
      return;
    }

    if (amount <= 0) {
      response.status(400).json({ error: "A valid top-up amount is required." });
      return;
    }

    const reference = `SOT-TOP-${userId}-${Date.now()}`;
    const link = await createPayMongoTopUpLink({ user, amount, reference });
    const topUpId = await createDocument("soteria_credit_topups", {
      user_id: user.id,
      payer_name: user.full_name ?? user.username ?? "Motorist",
      payer_phone: user.phone ?? "",
      amount,
      credits_amount: amount,
      currency: "PHP",
      status: "pending_payment",
      provider: "paymongo",
      provider_link_id: link.providerLinkId,
      provider_reference_number: link.providerReferenceNumber,
      provider_status: link.status,
      payment_url: link.paymentUrl,
      reference,
      created_at: serverTimestamp(),
      credited_at: null,
    });

    response.status(201).json({
      id: topUpId,
      userId,
      amount,
      balance: readSoteriaCreditBalance(user),
      status: "pending_payment",
      source: "paymongo",
      provider: "paymongo",
      paymentUrl: link.paymentUrl,
      reference,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/webhooks/paymongo", async (request, response, next) => {
  try {
    const rawBody = request.body;
    const signature = request.get("Paymongo-Signature");

    if (!verifyPayMongoWebhookSignature(rawBody, signature)) {
      response.status(401).json({ error: "Invalid PayMongo webhook signature." });
      return;
    }

    const payloadText = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody ?? "{}");
    const event = JSON.parse(payloadText);
    const eventId = event?.data?.id ?? "";
    const eventType = event?.data?.attributes?.type ?? "";
    const eventData = event?.data?.attributes?.data ?? null;

    if (eventId) {
      const existingEvents = await getDocuments("payment_webhook_events", { provider_event_id: eventId });
      if (existingEvents.length > 0) {
        response.status(200).json({ received: true, duplicate: true });
        return;
      }
    }

    let result = { fulfilled: false, reason: "ignored_event" };
    if (eventType === "link.payment.paid" && eventData?.type === "link") {
      const results = [
        await creditPaidTopUpFromPayMongo(eventData),
        await activatePaidSubscriptionFromPayMongo(eventData),
        await completePaidServiceFromPayMongo(eventData),
      ];
      result = {
        fulfilled: results.some((item) => item.credited || item.fulfilled),
        results,
      };
    }

    await createDocument("payment_webhook_events", {
      provider: "paymongo",
      provider_event_id: eventId,
      event_type: eventType,
      result,
      created_at: serverTimestamp(),
    });

    response.status(200).json({ received: true, result });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/webhooks/paymongo-wallet", async (request, response, next) => {
  try {
    const payload = request.body ?? {};
    const transfer = payload?.data ?? payload;
    const { id: providerPayoutId, attributes } = getPayMongoTransferData(transfer);

    if (!providerPayoutId) {
      response.status(400).json({ error: "Wallet transaction id is required." });
      return;
    }

    const payouts = await getDocuments("responder_payouts", { provider_payout_id: providerPayoutId });
    const payout = payouts[0] ?? null;
    if (!payout) {
      const redemptions = await getDocuments(collections.communityRedemptions, { provider_payout_id: providerPayoutId });
      const redemption = redemptions[0] ?? null;
      if (!redemption) {
        response.status(200).json({ received: true, matched: false });
        return;
      }

      const providerStatus = attributes.status ?? redemption.provider_status ?? "processing";
      const paid = isPayMongoPayoutPaidStatus(providerStatus);
      const failed = isPayMongoPayoutFailedStatus(providerStatus);
      const destinationFailureReason = failed ? getPayMongoDestinationAccountFailureReason(attributes) : "";
      await updateDocument(collections.communityRedemptions, redemption.id, {
        status: paid ? "paid" : failed && destinationFailureReason ? "details_required" : failed ? "failed" : "processing",
        provider_status: providerStatus,
        provider_payload: transfer,
        paid_at: paid ? serverTimestamp() : null,
        reviewed_at: paid ? serverTimestamp() : null,
        failure_reason: failed ? destinationFailureReason || getPayMongoProviderFailureReason(attributes) : "",
      });

      response.status(200).json({ received: true, matched: true, payoutType: "community" });
      return;
    }

    const providerStatus = attributes.status ?? payout.provider_status ?? "processing";
    const paid = isPayMongoPayoutPaidStatus(providerStatus);
    const failed = isPayMongoPayoutFailedStatus(providerStatus);
    const destinationFailureReason = failed ? getPayMongoDestinationAccountFailureReason(attributes) : "";
    await updateDocument("responder_payouts", payout.id, {
      status: paid ? "paid" : failed && destinationFailureReason ? "details_required" : failed ? "failed" : "processing",
      provider_status: providerStatus,
      provider_payload: transfer,
      paid_at: paid ? serverTimestamp() : null,
      failure_reason: failed ? destinationFailureReason || getPayMongoProviderFailureReason(attributes) : "",
      rejected_destination_key: failed && destinationFailureReason
        ? getPayoutDestinationKey(payout.destination_name, payout.destination_account)
        : null,
    });

    const updatedPayout = await getDocument("responder_payouts", payout.id);
    await updateDispatchPayoutFromResponderPayout(payout.dispatch_id, updatedPayout);
    response.status(200).json({ received: true, matched: true, payoutType: "responder" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/subscription-payments", async (request, response, next) => {
  try {
    const { userId, subscriptionPlan, paymentMethod = "soteria_credits" } = request.body ?? {};
    const normalizedPlan = normalizeSubscriptionPlan(subscriptionPlan);

    if (!userId || !normalizedPlan) {
      response.status(400).json({
        error: "userId and a valid subscriptionPlan are required.",
      });
      return;
    }

    const user = await getDocument(collections.users, userId);
    if (!user || user.role !== "motorist") {
      response.status(404).json({ error: "Motorist user not found." });
      return;
    }

    const expiryDate = calculateSubscriptionExpiry(normalizedPlan);
    const amount = getSubscriptionOfferAmount(normalizedPlan);

    if (paymentMethod === "online_payment") {
      const reference = `SOT-SUB-${user.id}-${Date.now()}`;
      const link = await createPayMongoSubscriptionLink({
        amount,
        plan: normalizedPlan,
        reference,
      });
      const paymentId = await createDocument(collections.subscriptionPayments, {
        user_id: user.id,
        payer_name: user.full_name,
        payer_phone: user.phone ?? "",
        subscription_plan: normalizedPlan,
        amount,
        reference_note: "Awaiting PayMongo online payment.",
        status: "pending",
        reviewed_at: null,
        source: "online_payment",
        provider: "paymongo",
        provider_link_id: link.providerLinkId,
        provider_reference_number: link.providerReferenceNumber,
        provider_status: link.status,
        payment_url: link.paymentUrl,
        reference,
      });

      const payment = (await listSubscriptionPayments()).find((item) => item.id === paymentId) ?? null;
      response.status(202).json({
        ...payment,
        paymentMethod: "online_payment",
        paymentUrl: link.paymentUrl,
        reference,
      });
      return;
    }

    const debit = await deductSoteriaCredits(user, amount, "subscription_payment", {
      subscriptionPlan: normalizedPlan,
    });

    const paymentId = await createDocument(collections.subscriptionPayments, {
      user_id: user.id,
      payer_name: user.full_name,
      payer_phone: user.phone ?? "",
      subscription_plan: normalizedPlan,
      amount,
      reference_note: "Paid with Soteria Credits.",
      status: "confirmed",
      reviewed_at: serverTimestamp(),
      source: "soteria_credits",
      credit_balance_after: debit.balance,
    });

    await updateDocument(collections.users, user.id, {
      subscription_status: "active",
      subscription_plan: normalizedPlan,
      subscription_activated_at: serverTimestamp(),
      subscription_expires_at: expiryDate,
    });

    const payment = (await listSubscriptionPayments()).find((item) => item.id === paymentId) ?? null;
    response.status(201).json({
      ...payment,
      creditBalance: debit.balance,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/dev/paymongo/subscription-payments/:paymentId/mark-paid", async (request, response, next) => {
  try {
    if (process.env.NODE_ENV === "production" || getPayMongoConfig().signatureMode !== "te") {
      response.status(404).json({ error: "Development payment simulation is not available." });
      return;
    }

    const { paymentId } = request.params;
    const payment = await getDocument(collections.subscriptionPayments, paymentId);
    if (!payment) {
      response.status(404).json({ error: "Subscription payment not found." });
      return;
    }

    if (payment.provider !== "paymongo" || payment.source !== "online_payment") {
      response.status(400).json({ error: "Only pending PayMongo online subscription payments can be simulated." });
      return;
    }

    const result = await activatePaidSubscriptionFromPayMongo({
      id: payment.provider_link_id ?? "",
      attributes: {
        reference_number: payment.provider_reference_number ?? "",
        remarks: payment.reference ?? "",
        status: "paid",
      },
    });

    const updatedPayment = (await listSubscriptionPayments()).find((item) => item.id === paymentId) ?? null;
    const updatedUser = await getDocument(collections.users, payment.user_id);
    response.json({
      simulated: true,
      result,
      payment: updatedPayment,
      subscriptionStatus: hasActiveSubscription(updatedUser) ? "active" : "inactive",
      subscriptionPlan: normalizeSubscriptionPlan(updatedUser?.subscription_plan),
      subscriptionExpiresAt: updatedUser?.subscription_expires_at
        ? formatFirestoreDate(updatedUser.subscription_expires_at)
        : null,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/dev/paymongo/service-payments/:paymentId/mark-paid", async (request, response, next) => {
  try {
    if (process.env.NODE_ENV === "production" || getPayMongoConfig().signatureMode !== "te") {
      response.status(404).json({ error: "Development payment simulation is not available." });
      return;
    }

    const { paymentId } = request.params;
    const payment = await getDocument("service_payments", paymentId);
    if (!payment) {
      response.status(404).json({ error: "Service payment not found." });
      return;
    }

    if (payment.provider !== "paymongo") {
      response.status(400).json({ error: "Only pending PayMongo service payments can be simulated." });
      return;
    }

    const result = await completePaidServiceFromPayMongo({
      id: payment.provider_link_id ?? "",
      attributes: {
        reference_number: payment.provider_reference_number ?? "",
        remarks: payment.reference ?? "",
        status: "paid",
      },
    });

    const updatedPayment = await getDocument("service_payments", paymentId);
    const updatedDispatch = payment.dispatch_id
      ? await getDocument(collections.dispatches, payment.dispatch_id)
      : null;

    response.json({
      simulated: true,
      result,
      payment: updatedPayment,
      dispatch: updatedDispatch ? serializeDispatchDetails(await buildDispatchDetails(updatedDispatch)) : null,
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/subscription-payments/:paymentId", async (request, response, next) => {
  try {
    const { paymentId } = request.params;
    const { status } = request.body ?? {};
    const normalizedStatus = normalizePaymentStatus(status);

    if (!["confirmed", "rejected"].includes(normalizedStatus)) {
      response.status(400).json({ error: "status must be 'confirmed' or 'rejected'." });
      return;
    }

    const payment = await getDocument(collections.subscriptionPayments, paymentId);
    if (!payment) {
      response.status(404).json({ error: "Subscription payment not found." });
      return;
    }

    const normalizedPlan = normalizeSubscriptionPlan(payment.subscription_plan);
    if (!normalizedPlan) {
      response.status(400).json({ error: "Subscription payment has an invalid plan." });
      return;
    }

    await updateDocument(collections.subscriptionPayments, paymentId, {
      status: normalizedStatus,
      amount: getSubscriptionOfferAmount(normalizedPlan),
      reviewed_at: serverTimestamp(),
    });

    if (normalizedStatus === "confirmed") {
      const expiryDate = calculateSubscriptionExpiry(normalizedPlan);
      await updateDocument(collections.users, payment.user_id, {
        subscription_status: "active",
        subscription_plan: normalizedPlan,
        subscription_activated_at: serverTimestamp(),
        subscription_expires_at: expiryDate,
      });
    }

    const updatedPayment = (await listSubscriptionPayments()).find((item) => item.id === paymentId) ?? null;
    response.json(updatedPayment);
  } catch (error) {
    next(error);
  }
});

app.post("/api/forum/threads", async (request, response, next) => {
  try {
    const {
      authorUserId,
      authorRole,
      title,
      body,
      topic = "general",
    } = request.body ?? {};

    const normalizedTitle = String(title ?? "").trim();
    const normalizedBody = String(body ?? "").trim();

    if (!authorUserId || !["motorist", "agent", "community"].includes(authorRole)) {
      response.status(400).json({ error: "authorUserId and authorRole are required." });
      return;
    }

    if (!normalizedTitle || !normalizedBody) {
      response.status(400).json({ error: "title and body are required." });
      return;
    }

    const author = await resolveForumAuthor(String(authorUserId), String(authorRole));
    const threadId = await createDocument(collections.forumThreads, {
      title: normalizedTitle,
      body: normalizedBody,
      topic: normalizeForumTopic(topic),
      author_user_id: author.id,
      author_name: author.name,
      author_role: author.role,
      last_activity_at: serverTimestamp(),
    });

    if (author.role === "community") {
      await awardCommunityCoins(author.id, 2, "forum_thread");
    }

    const savedThread = (await listForumThreads()).find((thread) => thread.id === threadId);
    response.status(201).json(savedThread ?? null);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/forum/threads/:threadId", async (request, response, next) => {
  try {
    const { threadId } = request.params;
    const { adminUserId } = request.body ?? {};

    await requireForumAdmin(adminUserId);

    const thread = await getDocument(collections.forumThreads, threadId);
    if (!thread) {
      response.status(404).json({ error: "Forum thread not found." });
      return;
    }

    await deleteDocumentsByConditions(collections.forumReplies, {
      thread_id: threadId,
    });
    await deleteDocument(collections.forumThreads, threadId);

    response.json({ id: threadId, deleted: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/forum/threads/:threadId/replies", async (request, response, next) => {
  try {
    const { threadId } = request.params;
    const {
      authorUserId,
      authorRole,
      body,
    } = request.body ?? {};

    const normalizedBody = String(body ?? "").trim();

    if (!authorUserId || !["motorist", "agent", "community"].includes(authorRole)) {
      response.status(400).json({ error: "authorUserId and authorRole are required." });
      return;
    }

    if (!normalizedBody) {
      response.status(400).json({ error: "body is required." });
      return;
    }

    const thread = await getDocument(collections.forumThreads, threadId);
    if (!thread) {
      response.status(404).json({ error: "Forum thread not found." });
      return;
    }

    const author = await resolveForumAuthor(String(authorUserId), String(authorRole));
    const replyId = await createDocument(collections.forumReplies, {
      thread_id: threadId,
      author_user_id: author.id,
      author_name: author.name,
      author_role: author.role,
      body: normalizedBody,
    });

    await updateDocument(collections.forumThreads, threadId, {
      last_activity_at: serverTimestamp(),
    });

    if (author.role === "community") {
      await awardCommunityCoins(author.id, 1, "forum_reply");
    }

    const replies = await listForumReplies(threadId);
    const savedReply = replies.find((reply) => reply.id === replyId) ?? null;
    response.status(201).json(savedReply);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/forum/threads/:threadId/replies/:replyId", async (request, response, next) => {
  try {
    const { threadId, replyId } = request.params;
    const { adminUserId } = request.body ?? {};

    await requireForumAdmin(adminUserId);

    const thread = await getDocument(collections.forumThreads, threadId);
    if (!thread) {
      response.status(404).json({ error: "Forum thread not found." });
      return;
    }

    const reply = await getDocument(collections.forumReplies, replyId);
    if (!reply || reply.thread_id !== threadId) {
      response.status(404).json({ error: "Forum comment not found." });
      return;
    }

    await deleteDocument(collections.forumReplies, replyId);

    const remainingReplies = await listForumReplies(threadId);
    await updateDocument(collections.forumThreads, threadId, {
      last_activity_at: serverTimestamp(),
    });

    response.json({
      id: replyId,
      threadId,
      deleted: true,
      replyCount: remainingReplies.length,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/dispatches/:dispatchId/feedback", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const {
      reviewerUserId,
      reviewerRole,
      overallRating,
      categoryRatings,
      paidCorrectAmount = null,
      comment = "",
    } = request.body ?? {};

    if (!reviewerUserId || !["motorist", "agent"].includes(reviewerRole)) {
      response.status(400).json({ error: "reviewerUserId and reviewerRole are required." });
      return;
    }

    const numericOverallRating = Number(overallRating);
    const normalizedCategoryRatings = normalizeCategoryRatings(categoryRatings);

    if (!isValidRating(numericOverallRating)) {
      response.status(400).json({ error: "overallRating must be a number from 1 to 5." });
      return;
    }

    if (!normalizedCategoryRatings) {
      response.status(400).json({ error: "categoryRatings must contain 1 to 5 ratings." });
      return;
    }

    if (reviewerRole === "agent" && typeof paidCorrectAmount !== "boolean") {
      response.status(400).json({ error: "paidCorrectAmount is required for responder reviews." });
      return;
    }

    const context = await resolveDispatchFeedbackContext(dispatchId, reviewerRole, reviewerUserId);
    const feedbackId = buildDispatchFeedbackId(dispatchId, reviewerRole, reviewerUserId);
    const feedbackRef = db.collection(collections.dispatchFeedback).doc(feedbackId);
    const existingFeedback = await feedbackRef.get();

    if (existingFeedback.exists) {
      response.status(409).json({ error: "Feedback has already been submitted for this dispatch." });
      return;
    }

    await feedbackRef.set({
      id: feedbackId,
      dispatch_id: dispatchId,
      emergency_report_id: context.dispatch.emergency_report_id ?? null,
      reviewer_user_id: context.reviewer.id,
      reviewer_name: context.reviewer.name,
      reviewer_role: context.reviewer.role,
      reviewee_user_id: context.reviewee.id,
      reviewee_name: context.reviewee.name,
      reviewee_role: context.reviewee.role,
      overall_rating: numericOverallRating,
      category_ratings: normalizedCategoryRatings,
      paid_correct_amount: reviewerRole === "agent" ? paidCorrectAmount : null,
      comment: String(comment ?? "").trim(),
      submitted_at: serverTimestamp(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    const savedFeedback = await feedbackRef.get();
    response.status(201).json({ id: savedFeedback.id, ...savedFeedback.data() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/agents/:agentId/dispatches", async (request, response, next) => {
  try {
    if (isFirestoreBackoffActive()) {
      response.json([]);
      return;
    }

    const { agentId } = request.params;
    const loadDispatchesByField = async (field) => {
      const snapshot = await db
        .collection(collections.dispatches)
        .where(field, "==", agentId)
        .get()
        .catch((error) => {
          markFirestoreQuotaExceeded(error);
          throw error;
        });

      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    };

    const dispatchRows = mergeById([
      ...(await loadDispatchesByField("responder_user_id")),
      ...(await loadDispatchesByField("agent_user_id")),
    ]);

    const dispatches = (
      await Promise.all(
        dispatchRows.map(async (dispatchRow) => {
          try {
            return await buildDispatchDetails(dispatchRow);
          } catch (error) {
            console.error(`[AGENT DISPATCHES] Failed to build dispatch details for ${dispatchRow.id}:`, error);
            return null;
          }
        }),
      )
    ).filter(Boolean);

    const activeDispatches = dispatches.filter((dispatch) =>
      dispatch && ["pending", "accepted", "arrived", "in_progress"].includes(dispatch.dispatchStatus),
    );

    activeDispatches.sort((a, b) => {
      const aTime = a.assignedAt?.toDate?.()?.getTime?.() ?? 0;
      const bTime = b.assignedAt?.toDate?.()?.getTime?.() ?? 0;
      return bTime - aTime;
    });

    response.json(activeDispatches);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/dispatches/:dispatchId/accept", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const { agentId } = request.body ?? {};
    const dispatch = await getDocument(collections.dispatches, dispatchId);

    if (!dispatch) {
      response.status(404).json({ error: "Dispatch not found." });
      return;
    }

    const assignedResponderId = getDispatchResponderUserId(dispatch);
    if (agentId && assignedResponderId && assignedResponderId !== agentId) {
      response.status(409).json({ error: "Dispatch is assigned to a different responder." });
      return;
    }

    await updateDocument(collections.dispatches, dispatchId, {
      dispatch_status: "accepted",
      accepted_at: serverTimestamp(),
    });

    if (dispatch.emergency_report_id) {
      await updateDocument(collections.emergencyReports, dispatch.emergency_report_id, {
        report_status: "in_progress",
      });
    }

    const updatedDispatch = await getDocument(collections.dispatches, dispatchId);
    response.json({ success: true, dispatch: await buildDispatchDetails(updatedDispatch) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/dispatches/:dispatchId/decline", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const dispatch = await getDocument(collections.dispatches, dispatchId);

    if (!dispatch) {
      response.status(404).json({ error: "Dispatch not found." });
      return;
    }

    await updateDocument(collections.dispatches, dispatchId, {
      dispatch_status: "declined",
    });

    if (dispatch.emergency_report_id) {
      await updateDocument(collections.emergencyReports, dispatch.emergency_report_id, {
        report_status: "matched",
      });
    }

    const updatedDispatch = await getDocument(collections.dispatches, dispatchId);
    response.json({ success: true, dispatch: await buildDispatchDetails(updatedDispatch) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/agent-applications", async (_request, response, next) => {
  try {
    const applications = await getDocumentsFromCollections(responderApplicationCollections);

    const results = (
      await Promise.all(applications.map(async (app) => {
        if (!app?.user_id) {
          console.warn(`[ADMIN] Skipping malformed responder application ${app?.id ?? "unknown"}: missing user_id`);
          return null;
        }

        const user = await getDocument(collections.users, app.user_id);
        const profile = await getAgentProfileByUserId(app.user_id);

        let remarks = {};
        try {
          remarks =
            typeof app.remarks === "string"
              ? JSON.parse(app.remarks)
              : app.remarks && typeof app.remarks === "object"
                ? app.remarks
                : {};
        } catch {
          remarks = {};
        }

        return {
          id: app.id,
          userId: app.user_id,
          ownerName: profile?.business_name || user?.full_name || "Unnamed applicant",
          mobileNumber: user?.phone ?? "",
          serviceCategory: Array.isArray(profile?.service_types) && profile.service_types.length > 0
            ? profile.service_types.join(", ")
            : profile?.service_type ?? "",
          serviceArea: profile?.service_area ?? remarks.serviceArea ?? "",
          organizationName: profile?.organization_name ?? remarks.organizationName ?? "",
          status: app.status ?? "pending",
          remarks,
          submittedDate: formatFirestoreDate(app.created_at),
        };
      }))
    ).filter(Boolean);

    response.json(results);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/agent-applications/:applicationId/status", async (request, response, next) => {
  try {
    const { applicationId } = request.params;
    const { status } = request.body ?? {};

    if (!status || !["approved", "rejected"].includes(status)) {
      response.status(400).json({ error: "status must be 'approved' or 'rejected'." });
      return;
    }

    const application = await getDocumentFromCollections(responderApplicationCollections, applicationId);
    if (!application) {
      response.status(404).json({ error: "Responder application not found." });
      return;
    }

    await updateDocument(application.__collection ?? collections.agentApplications, applicationId, { status });

    // Update user status
    await updateDocument(collections.users, application.user_id, {
      status: status === "approved" ? "active" : "rejected"
    });

    // Update agent profile
    await updateAgentProfileByUserId(application.user_id, {
      verification_status: status === "approved" ? "approved" : "rejected",
      is_available: status === "approved"
    });

    response.json({ id: applicationId, status });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/agent-balance-proofs", async (_request, response, next) => {
  try {
    const profiles = await getDocumentsFromCollections(responderProfileCollections);
    const results = (
      await Promise.all(
        profiles
          .filter((profile) =>
            profile.balance_proof_asset?.url ||
            profile.payout_gcash_name ||
            profile.payout_gcash_number ||
            profile.payout_notes
          )
          .map(async (profile) => {
            const user = profile.user_id ? await getDocument(collections.users, profile.user_id) : null;
            return {
              userId: profile.user_id ?? profile.id,
              agentName: user?.full_name ?? profile.business_name ?? "Responder",
              businessName: profile.business_name ?? "",
              organizationName: profile.organization_name ?? "",
              phone: user?.phone ?? "",
              gcashName: resolvePayoutAccountName(profile.payout_gcash_name, user?.full_name),
              gcashNumber: profile.payout_gcash_number ?? "",
              payoutNotes: profile.payout_notes ?? "",
              proofUrl: profile.balance_proof_asset?.url ?? "",
              status: profile.balance_proof_status ?? "missing",
              readinessTier: profile.wallet_readiness_tier ?? null,
              submittedAt: formatFirestoreDateTime(profile.balance_proof_submitted_at ?? null),
              reviewedAt: formatFirestoreDateTime(profile.balance_proof_reviewed_at ?? null),
              expiresAt: formatFirestoreDateTime(profile.balance_proof_expires_at ?? null),
              approvedBy: profile.balance_proof_approved_by ?? "",
              rejectionReason: profile.balance_proof_rejection_reason ?? "",
            };
          }),
      )
    ).sort((a, b) => String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")));

    response.json(results);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/agent-balance-proofs/:agentId", async (request, response, next) => {
  try {
    const { agentId } = request.params;
    const { status, approvedBy = "Admin", rejectionReason = "", readinessTier = null } = request.body ?? {};
    const profile = await getAgentProfileByUserId(agentId);
    const user = await getDocument(collections.users, agentId);

    if (!profile || !user || user.role !== "agent") {
      response.status(404).json({ error: "Responder profile not found." });
      return;
    }

    if (!["approved", "rejected"].includes(status)) {
      response.status(400).json({ error: "status must be 'approved' or 'rejected'." });
      return;
    }

    if (status === "approved" && !["tier_1", "tier_2"].includes(readinessTier)) {
      response.status(400).json({ error: "readinessTier must be 'tier_1' or 'tier_2' when approving." });
      return;
    }

    const expiryDate = status === "approved"
      ? new Date(Date.now() + (readinessTier === "tier_2" ? 30 : 7) * 24 * 60 * 60 * 1000)
      : null;

    await updateAgentProfileByUserId(agentId, {
      balance_proof_status: status,
      wallet_readiness_tier: status === "approved" ? readinessTier : null,
      balance_proof_reviewed_at: serverTimestamp(),
      balance_proof_expires_at: expiryDate,
      balance_proof_approved_by: String(approvedBy).trim(),
      balance_proof_rejection_reason: status === "rejected" ? String(rejectionReason).trim() : "",
      cash_assist_enabled: status === "approved" ? Boolean(profile.cash_assist_enabled) : false,
      updated_at: serverTimestamp(),
    });

    const updatedProfile = await getAgentProfileByUserId(agentId);
    response.json({
      userId: agentId,
      agentName: user.full_name ?? updatedProfile?.business_name ?? "Responder",
      businessName: updatedProfile?.business_name ?? "",
      organizationName: updatedProfile?.organization_name ?? "",
      phone: user.phone ?? "",
      gcashName: resolvePayoutAccountName(updatedProfile?.payout_gcash_name, user.full_name),
      gcashNumber: updatedProfile?.payout_gcash_number ?? "",
      payoutNotes: updatedProfile?.payout_notes ?? "",
      proofUrl: updatedProfile?.balance_proof_asset?.url ?? "",
      status: updatedProfile?.balance_proof_status ?? "missing",
      readinessTier: updatedProfile?.wallet_readiness_tier ?? null,
      submittedAt: formatFirestoreDateTime(updatedProfile?.balance_proof_submitted_at ?? null),
      reviewedAt: formatFirestoreDateTime(updatedProfile?.balance_proof_reviewed_at ?? null),
      expiresAt: formatFirestoreDateTime(updatedProfile?.balance_proof_expires_at ?? null),
      approvedBy: updatedProfile?.balance_proof_approved_by ?? "",
      rejectionReason: updatedProfile?.balance_proof_rejection_reason ?? "",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users", async (request, response, next) => {
  try {
    const { role } = request.query;

    const conditions = role ? { role } : {};
    const users = await getDocuments(collections.users, conditions);

    const results = users.map(user => ({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.created_at ? new Date(user.created_at.toDate()).toISOString().split("T")[0] : null,
      subscriptionStatus: hasActiveSubscription(user) ? "active" : "inactive",
      subscriptionPlan: normalizeSubscriptionPlan(user.subscription_plan),
      subscriptionActivatedAt: user.subscription_activated_at
        ? formatFirestoreDate(user.subscription_activated_at)
        : null,
      subscriptionExpiresAt: user.subscription_expires_at
        ? formatFirestoreDate(user.subscription_expires_at)
        : null,
      communityCoins: getCommunityCoinBalance(user),
      communityLifetimeCoins: getCommunityLifetimeCoins(user),
      lastCommunityRewardAt: formatFirestoreDateTime(user.community_last_coin_activity_at),
    }));

    response.json(results);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/users/:userId/subscription", async (request, response, next) => {
  try {
    const { userId } = request.params;
    const { subscriptionStatus, subscriptionPlan } = request.body ?? {};

    if (!["active", "inactive"].includes(subscriptionStatus)) {
      response.status(400).json({ error: "subscriptionStatus must be 'active' or 'inactive'." });
      return;
    }

    const normalizedPlan = normalizeSubscriptionPlan(subscriptionPlan);
    if (subscriptionStatus === "active" && !normalizedPlan) {
      response.status(400).json({
        error: "subscriptionPlan must be 'monthly', 'six_months', or 'annual' when activating.",
      });
      return;
    }

    const user = await getDocument(collections.users, userId);
    if (!user || user.role !== "motorist") {
      response.status(404).json({ error: "Motorist user not found." });
      return;
    }

    const expiryDate = subscriptionStatus === "active" ? calculateSubscriptionExpiry(normalizedPlan) : null;

    await updateDocument(collections.users, userId, {
      subscription_status: subscriptionStatus,
      subscription_plan: subscriptionStatus === "active" ? normalizedPlan : null,
      subscription_activated_at: subscriptionStatus === "active" ? serverTimestamp() : null,
      subscription_expires_at: expiryDate,
    });

    if (subscriptionStatus === "active") {
      await syncConfirmedSubscriptionPaymentForUser(user, normalizedPlan, "admin_activation");
    }

    const updatedUser = await getDocument(collections.users, userId);
    response.json({
      id: updatedUser.id,
      subscriptionStatus: hasActiveSubscription(updatedUser) ? "active" : "inactive",
      subscriptionPlan: normalizeSubscriptionPlan(updatedUser.subscription_plan),
      subscriptionActivatedAt: updatedUser.subscription_activated_at
        ? formatFirestoreDate(updatedUser.subscription_activated_at)
        : null,
      subscriptionExpiresAt: updatedUser.subscription_expires_at
        ? formatFirestoreDate(updatedUser.subscription_expires_at)
        : null,
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/users/:userId", async (request, response, next) => {
  try {
    const { userId } = request.params;
    const user = await getDocument(collections.users, userId);

    if (!user) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    if (!["motorist", "agent", "community"].includes(user.role)) {
      response.status(403).json({ error: "Admin can only remove motorist, responder, or community users." });
      return;
    }

    await deleteUserArtifacts(user);
    response.json({
      id: userId,
      deleted: true,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/agents/:agentId/location", async (request, response, next) => {
  try {
    const { agentId } = request.params;
    const { latitude, longitude } = request.body ?? {};

    if (latitude === undefined || longitude === undefined) {
      response.status(400).json({ error: "latitude and longitude are required." });
      return;
    }

    await updateAgentProfileByUserId(agentId, {
      current_latitude: latitude,
      current_longitude: longitude,
      last_location_update: serverTimestamp(),
    });

    response.json({
      user_id: agentId,
      current_latitude: latitude,
      current_longitude: longitude
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/agents/:agentId/availability", async (request, response, next) => {
  try {
    const { agentId } = request.params;
    const { isAvailable } = request.body ?? {};
    const profile = await getAgentProfileByUserId(agentId);

    if (typeof isAvailable !== "boolean") {
      response.status(400).json({ error: "isAvailable must be a boolean" });
      return;
    }

    if (!profile) {
      response.status(404).json({ error: "Responder profile not found." });
      return;
    }

    await updateAgentProfileByUserId(agentId, {
      is_available: isAvailable,
    });

    response.json({
      user_id: agentId,
      is_available: isAvailable
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/agents/:agentId/profile", async (request, response, next) => {
  try {
    const { agentId } = request.params;
    const user = await getDocument(collections.users, agentId);
    const profile = await getAgentProfileByUserId(agentId);

    if (!user || user.role !== "agent" || !profile) {
      response.status(404).json({ error: "Responder profile not found." });
      return;
    }

    response.json({
      userId: agentId,
      fullName: user.full_name ?? "",
      phone: user.phone ?? "",
      businessName: profile.business_name ?? "",
      organizationName: profile.organization_name ?? "",
      serviceArea: profile.service_area ?? "",
      gcashName: resolvePayoutAccountName(profile.payout_gcash_name, user.full_name),
      gcashNumber: profile.payout_gcash_number ?? "",
      payoutNotes: profile.payout_notes ?? "",
      liabilityAcknowledged: Boolean(profile.liability_acknowledged),
      balanceProof: getAgentBalanceProofStatus(profile),
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/agents/:agentId/profile/payment", async (request, response, next) => {
  try {
    const { agentId } = request.params;
    const { gcashName, gcashNumber, payoutNotes = "" } = request.body ?? {};
    const user = await getDocument(collections.users, agentId);
    const profile = await getAgentProfileByUserId(agentId);

    if (!user || user.role !== "agent" || !profile) {
      response.status(404).json({ error: "Responder profile not found." });
      return;
    }

    if (!String(gcashName ?? "").trim() || !String(gcashNumber ?? "").trim()) {
      response.status(400).json({ error: "gcashName and gcashNumber are required." });
      return;
    }

    const normalizedGcashNumber = normalizePayoutAccountNumber(gcashNumber);
    if (!isValidGcashAccountNumber(normalizedGcashNumber)) {
      response.status(400).json({ error: "GCash number must be an active 11-digit Philippine mobile number starting with 09." });
      return;
    }
    const normalizedGcashName = resolvePayoutAccountName(gcashName, user.full_name);

    await updateAgentProfileByUserId(agentId, {
      payout_gcash_name: normalizedGcashName,
      payout_gcash_number: normalizedGcashNumber,
      payout_notes: String(payoutNotes ?? "").trim(),
      updated_at: serverTimestamp(),
    });

    const updatedProfile = await getAgentProfileByUserId(agentId);
    const retriedPayouts = await retryResponderPayoutsForResponder(agentId);
    response.json({
      userId: agentId,
      fullName: user.full_name ?? "",
      phone: user.phone ?? "",
      businessName: updatedProfile?.business_name ?? "",
      organizationName: updatedProfile?.organization_name ?? "",
      serviceArea: updatedProfile?.service_area ?? "",
      gcashName: normalizedGcashName,
      gcashNumber: updatedProfile?.payout_gcash_number ?? "",
      payoutNotes: updatedProfile?.payout_notes ?? "",
      liabilityAcknowledged: Boolean(updatedProfile?.liability_acknowledged),
      balanceProof: getAgentBalanceProofStatus(updatedProfile),
      retriedResponderPayouts: retriedPayouts.length,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/agents/:agentId/cash-assist", async (request, response, next) => {
  try {
    const { agentId } = request.params;
    const { enabled } = request.body ?? {};
    const user = await getDocument(collections.users, agentId);
    const profile = await getAgentProfileByUserId(agentId);

    if (typeof enabled !== "boolean") {
      response.status(400).json({ error: "enabled must be a boolean." });
      return;
    }

    if (!user || user.role !== "agent" || !profile) {
      response.status(404).json({ error: "Responder profile not found." });
      return;
    }

    const balanceProof = getAgentBalanceProofStatus(profile);
    if (enabled && !balanceProof.cashAssistEligible) {
      response.status(403).json({
        error: "This wallet-readiness badge has been retired because payments are now processed through Soteria.",
      });
      return;
    }

    await updateAgentProfileByUserId(agentId, {
      cash_assist_enabled: enabled,
      updated_at: serverTimestamp(),
    });

    const updatedProfile = await getAgentProfileByUserId(agentId);
    response.json({
      userId: agentId,
      fullName: user.full_name ?? "",
      phone: user.phone ?? "",
      businessName: updatedProfile?.business_name ?? "",
      organizationName: updatedProfile?.organization_name ?? "",
      serviceArea: updatedProfile?.service_area ?? "",
      gcashName: resolvePayoutAccountName(updatedProfile?.payout_gcash_name, user.full_name),
      gcashNumber: updatedProfile?.payout_gcash_number ?? "",
      payoutNotes: updatedProfile?.payout_notes ?? "",
      liabilityAcknowledged: Boolean(updatedProfile?.liability_acknowledged),
      balanceProof: getAgentBalanceProofStatus(updatedProfile),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/agents/:agentId/balance-proof", async (request, response, next) => {
  try {
    const { agentId } = request.params;
    const { proofFile } = request.body ?? {};
    const user = await getDocument(collections.users, agentId);
    const profile = await getAgentProfileByUserId(agentId);

    if (!user || user.role !== "agent" || !profile) {
      response.status(404).json({ error: "Responder profile not found." });
      return;
    }

    if (!proofFile || typeof proofFile !== "object") {
      response.status(400).json({ error: "proofFile is required." });
      return;
    }

    const asset = await saveBalanceProofFile(agentId, proofFile);
    await updateAgentProfileByUserId(agentId, {
      balance_proof_status: "pending",
      balance_proof_asset: asset,
      balance_proof_submitted_at: serverTimestamp(),
      balance_proof_reviewed_at: null,
      balance_proof_expires_at: null,
      balance_proof_approved_by: null,
      balance_proof_rejection_reason: "",
      cash_assist_enabled: false,
      updated_at: serverTimestamp(),
    });

    const updatedProfile = await getAgentProfileByUserId(agentId);
    response.status(201).json({
      userId: agentId,
      fullName: user.full_name ?? "",
      phone: user.phone ?? "",
      businessName: updatedProfile?.business_name ?? "",
      organizationName: updatedProfile?.organization_name ?? "",
      serviceArea: updatedProfile?.service_area ?? "",
      gcashName: resolvePayoutAccountName(updatedProfile?.payout_gcash_name, user.full_name),
      gcashNumber: updatedProfile?.payout_gcash_number ?? "",
      payoutNotes: updatedProfile?.payout_notes ?? "",
      liabilityAcknowledged: Boolean(updatedProfile?.liability_acknowledged),
      balanceProof: getAgentBalanceProofStatus(updatedProfile),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/agents/available", async (_request, response, next) => {
  try {
    // Get all available, approved agents
    const agents = (await getDocumentsFromCollections(responderProfileCollections, {
      is_available: true,
      verification_status: "approved"
    }));

    // Fetch user data for each agent
    const results = await Promise.all(agents.map(async (agent) => {
      try {
        const user = await getDocument(collections.users, agent.user_id);
        return {
          id: agent.user_id,
          businessName: agent.business_name,
          phone: user?.phone,
          currentLatitude: agent.current_latitude,
          currentLongitude: agent.current_longitude,
          isAvailable: agent.is_available,
          verificationStatus: agent.verification_status,
          cashAssistReady: getAgentBalanceProofStatus(agent).cashAssistReady,
        };
      } catch (error) {
        console.error(`Error fetching user for responder ${agent.user_id}:`, error);
        return null;
      }
    }));

    // Filter out nulls and return only agents with valid location
    const validAgents = results.filter(agent => 
      agent && agent.currentLatitude && agent.currentLongitude
    );

    response.json(validAgents);
  } catch (error) {
    next(error);
  }
});

app.get("/api/dispatches/:dispatchId", async (request, response, next) => {
  try {
    if (isFirestoreBackoffActive()) {
      response.status(503).json({ error: getFirestoreBackoffMessage() });
      return;
    }

    const { dispatchId } = request.params;
    let dispatch = await getDocument(collections.dispatches, dispatchId);

    if (!dispatch) {
      response.status(404).json({ error: "Dispatch not found." });
      return;
    }

    if (dispatch.dispatch_status === "payment_pending" && dispatch.payment_method === "online_payment") {
      const syncResult = await syncPaidServicePaymentForDispatch(dispatch);
      if (syncResult.synced) {
        dispatch = await getDocument(collections.dispatches, dispatchId);
      }
    }

    response.json(await buildDispatchDetails(dispatch));
  } catch (error) {
    next(error);
  }
});

/**
 * REAL-TIME RESCUE REQUEST ENDPOINTS
 */

/**
 * POST /api/requests
 * Create a new rescue request (motorist → agent)
 * Instantly triggers agent's real-time listener
 */
app.post("/api/requests", async (request, response, next) => {
  try {
    const {
      motoristId,
      agentId,
      responderId,
      motoristLocation,
      motoristName,
      serviceType,
      issue
    } = request.body ?? {};
    const assignedResponderId = responderId ?? agentId;

    if (!motoristId || !assignedResponderId || !motoristLocation) {
      response.status(400).json({ error: "motoristId, responderId, and motoristLocation are required." });
      return;
    }

    // Create request document
    const requestRef = db.collection("requests").doc();
    await requestRef.set({
      id: requestRef.id,
      motoristId,
      responderId: assignedResponderId,
      agentId: assignedResponderId,
      status: "pending", // Responder listener watches for this
      motoristLocation: {
        latitude: motoristLocation.latitude,
        longitude: motoristLocation.longitude,
      },
      motoristName: motoristName || "Unknown",
      serviceType: serviceType || "general",
      issue: issue || "",
      createdAt: serverTimestamp(),
      acceptedAt: null,
      completedAt: null,
    });

    response.status(201).json({ id: requestRef.id, status: "pending" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agents/:agentId/requests
 * Get all pending requests for an agent
 * NOTE: Prefer real-time listener (onSnapshot) on client
 */
app.get("/api/agents/:agentId/requests", async (request, response, next) => {
  try {
    const { agentId } = request.params;

    const loadRequestsByField = async (field) => {
      const snapshot = await db.collection("requests")
        .where(field, "==", agentId)
        .where("status", "==", "pending")
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    };

    const requests = mergeById([
      ...(await loadRequestsByField("responderId")),
      ...(await loadRequestsByField("agentId")),
    ]);

    response.json(requests);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/requests/:requestId/accept
 * Agent accepts the request
 */
app.patch("/api/requests/:requestId/accept", async (request, response, next) => {
  try {
    const { requestId } = request.params;

    const requestRef = db.collection("requests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      response.status(404).json({ error: "Request not found." });
      return;
    }

    await requestRef.update({
      status: "accepted",
      acceptedAt: serverTimestamp(),
    });

    response.json({ id: requestId, status: "accepted" });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/requests/:requestId/decline
 * Agent declines the request
 */
app.patch("/api/requests/:requestId/decline", async (request, response, next) => {
  try {
    const { requestId } = request.params;

    const requestRef = db.collection("requests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      response.status(404).json({ error: "Request not found." });
      return;
    }

    await requestRef.update({
      status: "declined",
    });

    response.json({ id: requestId, status: "declined" });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/requests/:requestId/complete
 * Agent completes the request
 */
app.patch("/api/requests/:requestId/complete", async (request, response, next) => {
  try {
    const { requestId } = request.params;

    const requestRef = db.collection("requests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      response.status(404).json({ error: "Request not found." });
      return;
    }

    await requestRef.update({
      status: "completed",
      completedAt: serverTimestamp(),
    });

    response.json({ id: requestId, status: "completed" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/requests/:requestId", async (request, response, next) => {
  try {
    const { requestId } = request.params;
    const requestDoc = await db.collection("requests").doc(requestId).get();

    if (!requestDoc.exists) {
      response.status(404).json({ error: "Request not found." });
      return;
    }

    const requestData = requestDoc.data();
    const responderId = getRequestResponderId(requestData);
    const agentUser = responderId
      ? await getDocument(collections.users, responderId)
      : null;

    response.json({
      id: requestDoc.id,
      ...requestData,
      responderId,
      agentId: responderId,
      agentName: agentUser?.full_name ?? null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agents/nearby?lat=X&lng=Y&radius=50
 * Get nearby online agents for motorist to find rescue
 * Radius in kilometers (default 50). Subscriptions do not restrict access range.
 */
app.get("/api/agents/nearby", async (request, response, next) => {
  try {
    if (isFirestoreBackoffActive()) {
      response.json([]);
      return;
    }

    const { lat, lng, radius = 50, serviceType = null, userId = null } = request.query;

    if (!lat || !lng) {
      response.status(400).json({ error: "lat and lng query parameters are required." });
      return;
    }

    const motoristLat = parseFloat(lat);
    const motoristLng = parseFloat(lng);
    const requestedRadiusKm = parseFloat(radius);
    const motoristUser = userId ? await getDocument(collections.users, String(userId)) : null;
    const allowedRadiusKm = getMotoristSearchRadiusKm(motoristUser);
    const radiusKm = Number.isFinite(requestedRadiusKm)
      ? Math.min(requestedRadiusKm, allowedRadiusKm)
      : allowedRadiusKm;
    const now = Date.now();
    const freshnessWindowMs = 15 * 60 * 1000;

    const agents = (await getDocumentsFromCollections(responderProfileCollections, {
      is_available: true,
      verification_status: "approved",
    }));

    const nearbyAgents = await Promise.all(
      agents
        .filter((agent) => agent.current_latitude != null && agent.current_longitude != null)
        .filter((agent) => {
          const updatedAtMs = getAgentLocationTimestampMs(agent);
          return updatedAtMs ? now - updatedAtMs <= freshnessWindowMs : false;
        })
        .map(async (agent) => {
          const distanceKm = calculateDistance(
            motoristLat,
            motoristLng,
            Number(agent.current_latitude),
            Number(agent.current_longitude),
          );
          const user = agent.user_id ? await getDocument(collections.users, agent.user_id) : null;
          const ranking = rankNearbyAgent(serviceType, agent);
          const balanceProof = getAgentBalanceProofStatus(agent);

          return {
            id: agent.user_id ?? agent.id,
            fullName: user?.full_name ?? agent.business_name ?? "Responder",
            serviceCategory: mapRequestedCategoryForDisplay(serviceType, agent),
            distanceKm,
            services: Array.isArray(agent.services) ? agent.services : ["Roadside assistance"],
            latitude: Number(agent.current_latitude),
            longitude: Number(agent.current_longitude),
            exactServiceMatch: ranking.exactServiceMatch,
            compatibleServiceMatch: ranking.compatibleServiceMatch,
            lastLocationUpdateMs: ranking.lastLocationUpdateMs,
            cashAssistReady: balanceProof.cashAssistReady,
            cashAssistTier: balanceProof.tier,
            cashAssistTierLabel: balanceProof.tierLabel,
          };
        }),
    );

    response.json(
      nearbyAgents
        .filter((agent) => agent.compatibleServiceMatch)
        .filter((agent) => agent.distanceKm <= radiusKm)
        .sort((a, b) => {
          if (a.exactServiceMatch !== b.exactServiceMatch) {
            return a.exactServiceMatch ? -1 : 1;
          }

          if (a.distanceKm !== b.distanceKm) {
            return a.distanceKm - b.distanceKm;
          }

          return b.lastLocationUpdateMs - a.lastLocationUpdateMs;
        })
        .map(({ exactServiceMatch, compatibleServiceMatch, lastLocationUpdateMs, ...agent }) => agent),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/agents/:agentId/location", async (request, response, next) => {
  try {
    const { agentId } = request.params;
    const profile = await getAgentProfileByUserId(agentId);

    if (!profile) {
      response.status(404).json({ error: "Responder location not found." });
      return;
    }

    response.json({
      latitude: profile.current_latitude ?? null,
      longitude: profile.current_longitude ?? null,
      lastUpdated: profile.updated_at ?? null,
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((error, _request, response, _next) => {
  markFirestoreQuotaExceeded(error);
  console.error("API Error:", error);

  if (isQuotaExceededError(error)) {
    response.status(503).json({ error: getFirestoreBackoffMessage() });
    return;
  }

  if (typeof error?.statusCode === "number") {
    response.status(error.statusCode).json({ error: error.message || "Request failed." });
    return;
  }

  response.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Firebase Soteria API server running on port ${port}`);
});

if (getPayoutProviderMode() === "paymongo") {
  const retryIntervalMs = Math.max(
    60_000,
    Number(process.env.RESPONDER_PAYOUT_WORKER_INTERVAL_MS ?? 5 * 60_000),
  );

  setInterval(() => {
    Promise.all([
      processDueResponderPayouts(),
      processDueCommunityRedemptionPayouts(),
    ])
      .then(([responderResults, communityResults]) => {
        if (responderResults.length > 0) {
          console.log(`Processed ${responderResults.length} due responder payout(s).`);
        }
        if (communityResults.length > 0) {
          console.log(`Processed ${communityResults.length} due community payout(s).`);
        }
      })
      .catch((error) => {
        console.error("Payout worker failed:", error);
      });
  }, retryIntervalMs);
}

export default app;
