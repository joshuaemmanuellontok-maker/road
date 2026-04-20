import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import { db, collections, serverTimestamp, auth } from "./firebase.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? "*";

app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin.split(",") }));
app.use(express.json());

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
  const doc = await db.collection(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getDocuments(collection, conditions = {}) {
  let query = db.collection(collection);

  // Apply conditions
  Object.entries(conditions).forEach(([field, value]) => {
    if (value !== undefined && value !== null) {
      query = query.where(field, '==', value);
    }
  });

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function deleteDocument(collection, id) {
  await db.collection(collection).doc(id).delete();
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
    category: data.category ?? data.service_type ?? "mechanical",
    rating: Number(data.rating ?? 0),
    distance_km: Number(data.distance_km ?? data.distanceKm ?? 0),
    address: data.address ?? "",
    response_time: data.response_time ?? data.responseTime ?? "~15 min",
    open_now: Boolean(data.open_now ?? data.openNow ?? data.status === "active"),
    phone: data.phone ?? data.contact_number ?? null,
    latitude: Number(data.latitude ?? 0),
    longitude: Number(data.longitude ?? 0),
    services: Array.isArray(data.services) ? data.services : ["Roadside assistance"],
  };
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
  });

  await createDocument(collections.motoristProfiles, {
    user_id: userId,
  });

  return { id: userId, email: payload.email ?? `${payload.username}@roadresq.local` };
}

async function createAgentApplication(payload) {
  const userId = await createDocument(collections.users, {
    full_name: payload.ownerName,
    username: payload.username,
    email: `${payload.username}@roadresq.local`,
    password_hash: await hashPassword(payload.password),
    phone: payload.mobileNumber,
    role: "agent",
    status: "pending",
  });

  await createDocument(collections.agentProfiles, {
    user_id: userId,
    business_name: payload.ownerName,
    service_type: payload.serviceCategory,
    service_area: payload.serviceArea,
    verification_status: "pending",
    is_available: false,
  });

  const applicationId = await createDocument(collections.agentApplications, {
    user_id: userId,
    status: "pending",
    remarks: JSON.stringify({
      serviceArea: payload.serviceArea,
      credentials: payload.credentialManifest ?? {},
    }),
  });

  return { id: applicationId, userId };
}

async function findNearbyAgent(motoristLat, motoristLng, serviceType) {
  // Get all available agents
  const agents = await getDocuments(collections.agentProfiles, {
    is_available: true,
    verification_status: "approved"
  });

  // Filter agents with valid location and calculate distance
  const agentsWithDistance = agents
    .filter(agent => agent.current_latitude && agent.current_longitude)
    .map(agent => {
      const distance = calculateDistance(
        motoristLat, motoristLng,
        agent.current_latitude, agent.current_longitude
      );
      return { ...agent, distance_km: distance };
    })
    .filter(agent => agent.distance_km <= 20) // Within 20km
    .sort((a, b) => a.distance_km - b.distance_km);

  return agentsWithDistance[0] || null;
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

async function createEmergencyDispatchRecord(payload) {
  const reference = await resolveUserReference(payload.username);
  if (!reference.userId) {
    throw new Error("No matching motorist account was found for this emergency request.");
  }

  const triageLevel =
    payload.symptoms?.length >= 3 ? "high" : payload.symptoms?.length >= 2 ? "medium" : "low";

  const reportId = await createDocument(collections.emergencyReports, {
    motorist_user_id: reference.userId,
    vehicle_type: payload.serviceType === "transport" ? "Transport Rescue" : "Roadside Repair",
    issue_summary: payload.issueSummary,
    triage_level: triageLevel,
    report_status: "matched",
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
    console.log(`[DISPATCH] Using matched agent ${assignedAgentId} for dispatch`);
  } else {
    try {
      const nearbyAgent = await findNearbyAgent(
        payload.latitude,
        payload.longitude,
        payload.serviceType,
      );
      if (nearbyAgent) {
        assignedAgentId = nearbyAgent.user_id;
        console.log(`[DISPATCH] Auto-assigned agent ${nearbyAgent.business_name} (${assignedAgentId}) to dispatch`);
      } else {
        console.log(`[DISPATCH] No nearby agents found for dispatch at (${payload.latitude}, ${payload.longitude})`);
      }
    } catch (error) {
      console.error("[DISPATCH] Agent matching failed:", error);
    }
  }

  const dispatchId = await createDocument(collections.dispatches, {
    emergency_report_id: reportId,
    repair_shop_id: payload.matchedShopId || null,
    agent_user_id: assignedAgentId,
    dispatch_status: "pending",
  });

  console.log(`[DISPATCH] Created dispatch ${dispatchId} - Agent ID: ${assignedAgentId}, Status: pending`);

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

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    // Set agent as available when they log in
    await updateDocument(collections.agentProfiles, user.id, { is_available: true });

    response.json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
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

    if (!payload.ownerName || !payload.mobileNumber || !payload.serviceCategory || !payload.username || !payload.password) {
      response.status(400).json({
        error: "ownerName, mobileNumber, serviceCategory, username, and password are required.",
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
    const { status } = request.body ?? {};

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
    if (status === "completed") updateData.completed_at = serverTimestamp();

    await updateDocument(collections.dispatches, dispatchId, updateData);

    // Update emergency report status
    if (dispatch.emergency_report_id) {
      const reportStatus =
        status === "completed" ? "completed" :
        status === "cancelled" ? "cancelled" :
        (status === "accepted" || status === "arrived") ? "in_progress" : "matched";

      await updateDocument(collections.emergencyReports, dispatch.emergency_report_id, {
        report_status: reportStatus
      });
    }

    response.json({ id: dispatchId, dispatch_status: status });
  } catch (error) {
    next(error);
  }
});

app.get("/api/agent-applications", async (_request, response, next) => {
  try {
    const applications = await getDocuments(collections.agentApplications);

    const results = await Promise.all(applications.map(async (app) => {
      const user = await getDocument(collections.users, app.user_id);
      const profile = await getDocument(collections.agentProfiles, app.user_id);

      let remarks = {};
      try {
        remarks = app.remarks ? JSON.parse(app.remarks) : {};
      } catch {
        remarks = {};
      }

      return {
        id: app.id,
        userId: app.user_id,
        ownerName: profile?.business_name || user?.full_name,
        mobileNumber: user?.phone,
        serviceCategory: profile?.service_type ?? "",
        serviceArea: profile?.service_area ?? "",
        status: app.status,
        remarks,
        submittedDate: app.created_at ? new Date(app.created_at.toDate()).toISOString().split("T")[0] : null,
      };
    }));

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

    const application = await getDocument(collections.agentApplications, applicationId);
    if (!application) {
      response.status(404).json({ error: "Agent application not found." });
      return;
    }

    await updateDocument(collections.agentApplications, applicationId, { status });

    // Update user status
    await updateDocument(collections.users, application.user_id, {
      status: status === "approved" ? "active" : "rejected"
    });

    // Update agent profile
    await updateDocument(collections.agentProfiles, application.user_id, {
      verification_status: status === "approved" ? "approved" : "rejected",
      is_available: status === "approved"
    });

    response.json({ id: applicationId, status });
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
    }));

    response.json(results);
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

    await updateDocument(collections.agentProfiles, agentId, {
      current_latitude: latitude,
      current_longitude: longitude,
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

    if (typeof isAvailable !== "boolean") {
      response.status(400).json({ error: "isAvailable must be a boolean" });
      return;
    }

    await updateDocument(collections.agentProfiles, agentId, {
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

app.get("/api/agents/available", async (_request, response, next) => {
  try {
    // Get all available, approved agents
    const agents = await getDocuments(collections.agentProfiles, {
      is_available: true,
      verification_status: "approved"
    });

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
        };
      } catch (error) {
        console.error(`Error fetching user for agent ${agent.user_id}:`, error);
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
    const { dispatchId } = request.params;
    const dispatch = await getDocument(collections.dispatches, dispatchId);

    if (!dispatch) {
      response.status(404).json({ error: "Dispatch not found." });
      return;
    }

    // Fetch related documents
    const emergencyReport = dispatch.emergency_report_id 
      ? await getDocument(collections.emergencyReports, dispatch.emergency_report_id)
      : null;
    
    const motoristUser = emergencyReport?.motorist_user_id
      ? await getDocument(collections.users, emergencyReport.motorist_user_id)
      : null;

    const agentUser = dispatch.agent_user_id
      ? await getDocument(collections.users, dispatch.agent_user_id)
      : null;

    const agentProfile = dispatch.agent_user_id
      ? await getDocument(collections.agentProfiles, dispatch.agent_user_id)
      : null;

    response.json({
      id: dispatch.id,
      dispatchStatus: dispatch.dispatch_status,
      assignedAt: dispatch.assigned_at,
      acceptedAt: dispatch.accepted_at,
      arrivedAt: dispatch.arrived_at,
      completedAt: dispatch.completed_at,
      motorist: motoristUser ? {
        id: motoristUser.id,
        fullName: motoristUser.full_name,
        phone: motoristUser.phone,
      } : null,
      motoristLocation: emergencyReport ? {
        latitude: emergencyReport.latitude,
        longitude: emergencyReport.longitude,
        label: emergencyReport.vehicle_type,
      } : null,
      agent: agentUser && agentProfile ? {
        id: agentUser.id,
        fullName: agentUser.full_name,
        phone: agentUser.phone,
        businessName: agentProfile.business_name,
        currentLatitude: agentProfile.current_latitude,
        currentLongitude: agentProfile.current_longitude,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((error, _request, response, _next) => {
  console.error("API Error:", error);
  response.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Firebase RoadResQ API server running on port ${port}`);
});

export default app;