// Firebase-based server - replaces PostgreSQL version
export { default } from './server_firebase.js';
  const entries = Object.entries(row).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    throw new Error(`No values supplied for ${tableName} insert.`);
  }

  const columns = entries.map(([column]) => quoteIdentifier(column)).join(", ");
  const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
  const values = entries.map(([, value]) => value);
  const returningClause = returning.length
    ? ` returning ${returning.map(quoteIdentifier).join(", ")}`
    : "";

  const result = await client.query(
    `insert into ${quoteIdentifier(tableName)} (${columns}) values (${placeholders})${returningClause}`,
    values,
  );

  return result.rows[0] ?? null;
}

async function updateRow(client, tableName, keyColumn, keyValue, row, returning = ["id"]) {
  const entries = Object.entries(row).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return null;
  }

  const setClause = entries
    .map(([column], index) => `${quoteIdentifier(column)} = $${index + 1}`)
    .join(", ");
  const values = entries.map(([, value]) => value);
  const returningClause = returning.length
    ? ` returning ${returning.map(quoteIdentifier).join(", ")}`
    : "";

  const result = await client.query(
    `update ${quoteIdentifier(tableName)}
     set ${setClause}
     where ${quoteIdentifier(keyColumn)} = $${entries.length + 1}${returningClause}`,
    [...values, keyValue],
  );

  return result.rows[0] ?? null;
}

function normalizeRepairShop(row) {
  return {
    id: String(row.id),
    name: row.name,
    category: row.category ?? row.service_type ?? "mechanical",
    rating: Number(row.rating ?? 0),
    distance_km: Number(row.distance_km ?? row.distanceKm ?? 0),
    address: row.address ?? "",
    response_time: row.response_time ?? row.responseTime ?? "~15 min",
    open_now: Boolean(row.open_now ?? row.openNow ?? row.status === "active"),
    phone: row.phone ?? row.contact_number ?? null,
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    services: Array.isArray(row.services) ? row.services : ["Roadside assistance"],
  };
}

async function resolveMotoristReference(client, username) {
  if (!(await tableExists(client, "users"))) {
    return { userId: null, userProfileId: null };
  }

  const userColumns = await getTableColumns(client, "users");
  const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
  const conditions = [];
  const values = [];

  if (usernameColumn) {
    values.push(username);
    conditions.push(`${quoteIdentifier(usernameColumn)} = $${values.length}`);
  }

  values.push(username);
  conditions.push(`split_part("email", '@', 1) = $${values.length}`);

  values.push(username);
  conditions.push(`"email" = $${values.length}`);

  values.push(username);
  conditions.push(`"phone" = $${values.length}`);

  const result = await client.query(
    `select id
     from "users"
     where ${conditions.join(" or ")}
     limit 1`,
    values,
  );

  return { userId: result.rows[0]?.id ?? null, userProfileId: null };
}

async function createMotorist(client, payload) {
  if (!(await tableExists(client, "users"))) {
    throw new Error("No supported user table was found in PostgreSQL.");
  }

  const userColumns = await getTableColumns(client, "users");
  const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);

  const createdUser = await insertRow(
    client,
    "users",
    {
      full_name: payload.fullName,
      [usernameColumn]: usernameColumn ? payload.username : undefined,
      email: payload.email ?? `${payload.username}@roadresq.local`,
      password_hash: await bcrypt.hash(payload.password, 10),
      phone: payload.mobileNumber,
      role: "motorist",
      status: "active",
    },
    ["id", "email"],
  );

  if (await tableExists(client, "motorist_profiles")) {
    await insertRow(
      client,
      "motorist_profiles",
      {
        user_id: createdUser?.id,
      },
      [],
    );
  }

  return { id: createdUser?.id, email: createdUser?.email };
}

async function createAgentApplication(client, payload) {
  const userColumns = await getTableColumns(client, "users");
  const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);

  const createdUser = await insertRow(
    client,
    "users",
    {
      full_name: payload.ownerName,
      [usernameColumn]: usernameColumn ? payload.username : undefined,
      email: `${payload.username}@roadresq.local`,
      password_hash: await bcrypt.hash(payload.password, 10),
      phone: payload.mobileNumber,
      role: "agent",
      status: "pending",
    },
    ["id", "email"],
  );

  if (await tableExists(client, "agent_profiles")) {
    const profileColumns = await getTableColumns(client, "agent_profiles");
    await insertRow(
      client,
      "agent_profiles",
      {
        user_id: createdUser?.id,
        business_name: payload.ownerName,
        service_type: payload.serviceCategory,
        service_area: profileColumns.has("service_area") ? payload.serviceArea : undefined,
        verification_status: "pending",
        is_available: false,
      },
      [],
    );
  }

  const created = await insertRow(
    client,
    "agent_applications",
    {
      user_id: createdUser?.id,
      status: "pending",
      remarks: JSON.stringify({
        serviceArea: payload.serviceArea,
        credentials: payload.credentialManifest ?? {},
      }),
    },
    ["id"],
  );

  return { id: created?.id, userId: createdUser?.id };
}

// Find nearby available agents within 20km, matching service type
async function findNearbyAgent(client, motoristLat, motoristLng, serviceType) {
  if (!(await tableExists(client, "agent_profiles")) || !(await tableExists(client, "users"))) {
    return null;
  }

  const query = `
    SELECT 
      u.id,
      ap.business_name,
      ap.current_latitude,
      ap.current_longitude,
      ap.service_type,
      (6371 * acos(cos(radians($1)) * cos(radians(ap.current_latitude)) 
        * cos(radians(ap.current_longitude) - radians($2)) 
        + sin(radians($1)) * sin(radians(ap.current_latitude)))) AS distance_km
    FROM agent_profiles ap
    JOIN users u ON ap.user_id = u.id
    WHERE 
      ap.is_available = true 
      AND u.status = 'active'
      AND ap.current_latitude IS NOT NULL 
      AND ap.current_longitude IS NOT NULL
      -- AND (6371 * acos(cos(radians($1)) * cos(radians(ap.current_latitude)) 
      --   * cos(radians(ap.current_longitude) - radians($2)) 
      -- --   + sin(radians($1)) * sin(radians(ap.current_latitude)))) <= 1000
    ORDER BY distance_km ASC
    LIMIT 1
  `;

  const result = await client.query(query, [
    motoristLat,
    motoristLng,
  ]);

  return result.rows[0] ?? null;
}

async function createEmergencyDispatchRecord(client, payload) {
  const reference = await resolveMotoristReference(client, payload.username);
  if (!reference.userId) {
    throw new Error("No matching motorist account was found for this emergency request.");
  }

  const triageLevel =
    payload.symptoms?.length >= 3 ? "high" : payload.symptoms?.length >= 2 ? "medium" : "low";

  const report = await insertRow(
    client,
    "emergency_reports",
    {
      motorist_user_id: reference.userId,
      vehicle_type: payload.serviceType === "transport" ? "Transport Rescue" : "Roadside Repair",
      issue_summary: payload.issueSummary,
      triage_level: triageLevel,
      report_status: "matched",
      latitude: payload.latitude,
      longitude: payload.longitude,
    },
    ["id"],
  );

  if ((await tableExists(client, "emergency_report_symptoms")) && payload.symptoms?.length > 0) {
    for (const symptom of payload.symptoms) {
      await insertRow(
        client,
        "emergency_report_symptoms",
        {
          emergency_report_id: report?.id,
          symptom_text: symptom,
        },
        [],
      );
    }
  }

  // Assign the specific matched agent if provided, otherwise attempt to find a nearby available agent.
  let assignedAgentId = null;
  if (payload.matchedAgentId) {
    assignedAgentId = payload.matchedAgentId;
    console.log(`[DISPATCH] Using matched agent ${assignedAgentId} for dispatch`);
  } else {
    try {
      const nearbyAgent = await findNearbyAgent(
        client,
        payload.latitude,
        payload.longitude,
        payload.serviceType,
      );
      if (nearbyAgent) {
        assignedAgentId = nearbyAgent.id;
        console.log(`[DISPATCH] Auto-assigned agent ${nearbyAgent.business_name} (${assignedAgentId}) to dispatch`);
      } else {
        console.log(`[DISPATCH] No nearby agents found for dispatch at (${payload.latitude}, ${payload.longitude})`);
      }
    } catch (error) {
      console.error("[DISPATCH] Agent matching failed:", error);
    }
  }

  const dispatch = await insertRow(
    client,
    "dispatches",
    {
      emergency_report_id: report?.id,
      repair_shop_id: payload.matchedShopId ? Number(payload.matchedShopId) : null,
      agent_user_id: assignedAgentId,
      dispatch_status: "pending",
    },
    ["id"],
  );

  console.log(`[DISPATCH] Created dispatch ${dispatch?.id} - Agent ID: ${assignedAgentId}, Status: pending`);

  return {
    reportId: report?.id,
    dispatchId: dispatch?.id,
  };
}

app.get("/api/repair-shops", async (_request, response, next) => {
  try {
    const result = await pool.query(`select * from "repair_shops" order by "created_at" desc, "id" desc`);

    response.json(result.rows.map(normalizeRepairShop));
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/login", async (request, response, next) => {
  try {
    const { username, password } = request.body ?? {};

    if (!username || !password) {
      response.status(400).json({ error: "Username and password are required." });
      return;
    }

    const result = await withTransaction(async (client) => {
      if (!(await tableExists(client, "users"))) {
        throw new Error("User table not found in database.");
      }

      const userColumns = await getTableColumns(client, "users");
      const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
      
      const conditions = [];
      const values = [username];
      
      if (usernameColumn) {
        conditions.push(`${quoteIdentifier(usernameColumn)} = $1`);
      }
      
      if (userColumns.has("email")) {
        conditions.push(`"email" = $1`);
      }
      
      if (userColumns.has("phone")) {
        conditions.push(`"phone" = $1`);
      }

      if (conditions.length === 0) {
        throw new Error("No valid user lookup columns found.");
      }

      const userResult = await client.query(
        `select id, full_name, email, role from "users" where (${conditions.join(" or ")}) and role = 'motorist' limit 1`,
        values
      );

      if (userResult.rows.length === 0) {
        throw new Error("Invalid credentials.");
      }

      const user = userResult.rows[0];
      const passwordResult = await client.query(
        `select password_hash from "users" where id = $1`,
        [user.id]
      );

      if (passwordResult.rows.length === 0) {
        throw new Error("Invalid credentials.");
      }

      const passwordHash = passwordResult.rows[0].password_hash;
      const isValidPassword = await bcrypt.compare(password, passwordHash);

      if (!isValidPassword) {
        throw new Error("Invalid credentials.");
      }

      return {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      };
    });

    response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid credentials.") {
      response.status(401).json({ error: "Invalid username or password." });
    } else {
      next(error);
    }
  }
});

app.post("/api/agents/login", async (request, response, next) => {
  try {
    const { username, password } = request.body ?? {};

    if (!username || !password) {
      response.status(400).json({ error: "Username and password are required." });
      return;
    }

    const result = await withTransaction(async (client) => {
      if (!(await tableExists(client, "users"))) {
        throw new Error("User table not found in database.");
      }

      const userColumns = await getTableColumns(client, "users");
      const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
      
      const conditions = [];
      const values = [username];
      
      if (usernameColumn) {
        conditions.push(`${quoteIdentifier(usernameColumn)} = $1`);
      }
      
      if (userColumns.has("email")) {
        conditions.push(`"email" = $1`);
      }
      
      if (userColumns.has("phone")) {
        conditions.push(`"phone" = $1`);
      }

      if (conditions.length === 0) {
        throw new Error("No valid user lookup columns found.");
      }

      const userResult = await client.query(
        `select id, full_name, email, role from "users" where (${conditions.join(" or ")}) and role = 'agent' limit 1`,
        values
      );

      if (userResult.rows.length === 0) {
        throw new Error("Invalid credentials.");
      }

      const user = userResult.rows[0];
      const passwordResult = await client.query(
        `select password_hash from "users" where id = $1`,
        [user.id]
      );

      if (passwordResult.rows.length === 0) {
        throw new Error("Invalid credentials.");
      }

      const passwordHash = passwordResult.rows[0].password_hash;
      const isValidPassword = await bcrypt.compare(password, passwordHash);

      if (!isValidPassword) {
        throw new Error("Invalid credentials.");
      }

      // Set agent as available when they log in
      if (await tableExists(client, "agent_profiles")) {
        await client.query(
          `update "agent_profiles" set is_available = true where user_id = $1`,
          [user.id]
        );
      }

      return {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      };
    });

    response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid credentials.") {
      response.status(401).json({ error: "Invalid username or password." });
    } else {
      next(error);
    }
  }
});

app.post("/api/users/register", async (request, response, next) => {
  try {
    const payload = request.body ?? {};

    if (!payload.fullName || !payload.mobileNumber || !payload.username || !payload.password) {
      response.status(400).json({ error: "fullName, mobileNumber, username, and password are required." });
      return;
    }

    const result = await withTransaction((client) => createMotorist(client, payload));
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

    const result = await withTransaction((client) => createAgentApplication(client, payload));
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

    const result = await withTransaction((client) => createEmergencyDispatchRecord(client, payload));
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

    const result = await withTransaction(async (client) => {
      const dispatch = await updateRow(
        client,
        "dispatches",
        "id",
        dispatchId,
        {
          dispatch_status: status,
          accepted_at: status === "accepted" ? new Date() : undefined,
          arrived_at: status === "arrived" ? new Date() : undefined,
          completed_at: status === "completed" ? new Date() : undefined,
        },
        ["id", "dispatch_status"],
      );

      const dispatchColumns = await getTableColumns(client, "dispatches");
      const reportIdColumn = pickColumn(dispatchColumns, ["emergency_report_id", "emergencyReportId"]);

      if (dispatch && reportIdColumn && (await tableExists(client, "emergency_reports"))) {
        const dispatchLookup = await client.query(
          `select ${quoteIdentifier(reportIdColumn)} as report_id from "dispatches" where "id" = $1 limit 1`,
          [dispatchId],
        );

        const reportId = dispatchLookup.rows[0]?.report_id;

        if (reportId) {
          const reportColumns = await getTableColumns(client, "emergency_reports");
          const reportStatusColumn = pickColumn(reportColumns, ["report_status", "status"]);
          const reportUpdatedAtColumn = pickColumn(reportColumns, ["updated_at", "updatedAt"]);

          if (reportStatusColumn) {
            const mappedReportStatus =
              status === "completed"
                ? "completed"
                : status === "cancelled"
                  ? "cancelled"
                  : status === "accepted" || status === "arrived"
                    ? "in_progress"
                    : "matched";

            await updateRow(
              client,
              "emergency_reports",
              "id",
              reportId,
              {
                [reportStatusColumn]: mappedReportStatus,
                [reportUpdatedAtColumn]: reportUpdatedAtColumn ? new Date() : undefined,
              },
              [],
            );
          }
        }
      }

      return dispatch;
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/agent-applications", async (_request, response, next) => {
  try {
    const result = await withTransaction(async (client) => {
      if (!(await tableExists(client, "agent_applications"))) {
        return [];
      }

      const applicationsResult = await client.query(
        `select aa.id,
                aa.user_id,
                u.full_name,
                u.phone,
                ap.business_name,
                ap.service_type,
                ap.service_area,
                aa.status,
                aa.remarks,
                aa.submitted_at
         from "agent_applications" aa
         join "users" u on aa.user_id = u.id
         left join "agent_profiles" ap on aa.user_id = ap.user_id
         order by aa.submitted_at desc, aa.id desc`,
      );

      return applicationsResult.rows.map((row) => {
        let remarks = {};

        try {
          remarks = row.remarks ? JSON.parse(row.remarks) : {};
        } catch {
          remarks = {};
        }

        return {
          id: String(row.id),
          userId: String(row.user_id),
          ownerName: row.business_name || row.full_name,
          mobileNumber: row.phone,
          serviceCategory: row.service_type ?? "",
          serviceArea: row.service_area ?? "",
          status: row.status,
          remarks,
          submittedDate: row.submitted_at
            ? new Date(row.submitted_at).toISOString().split("T")[0]
            : null,
        };
      });
    });

    response.json(result);
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

    const result = await withTransaction(async (client) => {
      const applicationResult = await client.query(
        `select user_id
         from "agent_applications"
         where id = $1
         limit 1`,
        [applicationId],
      );

      if (applicationResult.rows.length === 0) {
        throw new Error("Agent application not found.");
      }

      const application = applicationResult.rows[0];

      const updatedApplication = await updateRow(
        client,
        "agent_applications",
        "id",
        applicationId,
        { status },
        ["id", "status"],
      );

      await updateRow(
        client,
        "users",
        "id",
        application.user_id,
        { status: status === "approved" ? "active" : "rejected" },
        ["id", "status"],
      );

      if (await tableExists(client, "agent_profiles")) {
        await client.query(
          `update "agent_profiles"
           set verification_status = $1,
               is_available = $2
           where user_id = $3`,
          [status === "approved" ? "approved" : "rejected", status === "approved", application.user_id],
        );
      }

      return updatedApplication;
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/users", async (request, response, next) => {
  try {
    const { role } = request.query;

    const result = await withTransaction(async (client) => {
      if (!(await tableExists(client, "users"))) {
        return [];
      }

      let query = `select id, full_name, email, phone, role, status, created_at
                   from "users"
                   order by created_at desc, id desc`;
      const values = [];

      if (typeof role === "string" && role.trim()) {
        query = `select id, full_name, email, phone, role, status, created_at
                 from "users"
                 where role = $1
                 order by created_at desc, id desc`;
        values.push(role);
      }

      const usersResult = await client.query(query, values);

      return usersResult.rows.map((row) => ({
        id: String(row.id),
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        status: row.status,
        createdAt: row.created_at
          ? new Date(row.created_at).toISOString().split("T")[0]
          : null,
      }));
    });

    response.json(result);
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

    const result = await withTransaction(async (client) => {
      if (!(await tableExists(client, "users"))) {
        console.log(`[ADMIN LOGIN] Users table not found`);
        throw new Error("User table not found in database.");
      }

      const userColumns = await getTableColumns(client, "users");
      console.log(`[ADMIN LOGIN] User columns: ${Array.from(userColumns)}`);
      
      const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
      console.log(`[ADMIN LOGIN] Username column: ${usernameColumn}`);
      
      const conditions = [];
      const values = [username];
      
      if (usernameColumn) {
        conditions.push(`${quoteIdentifier(usernameColumn)} = $1`);
      }
      
      if (userColumns.has("email")) {
        conditions.push(`"email" = $1`);
      }
      
      if (userColumns.has("phone")) {
        conditions.push(`"phone" = $1`);
      }

      if (conditions.length === 0) {
        console.log(`[ADMIN LOGIN] No valid user lookup columns`);
        throw new Error("No valid user lookup columns found.");
      }

      const selectColumns = ["id", "email", "role"];
      if (usernameColumn) {
        selectColumns.push(quoteIdentifier(usernameColumn));
      }

      const queryStr = `select ${selectColumns.join(", ")} from "users" where (${conditions.join(" or ")}) and role = 'admin' limit 1`;
      console.log(`[ADMIN LOGIN] Query: ${queryStr}`);
      console.log(`[ADMIN LOGIN] Query values: ${values}`);

      const userResult = await client.query(queryStr, values);
      console.log(`[ADMIN LOGIN] Found ${userResult.rows.length} user(s)`);
      
      if (userResult.rows.length > 0) {
        console.log(`[ADMIN LOGIN] User data:`, userResult.rows[0]);
      }

      if (userResult.rows.length === 0) {
        console.log(`[ADMIN LOGIN] No admin user found`);
        throw new Error("Invalid credentials.");
      }

      const user = userResult.rows[0];
      const passwordResult = await client.query(
        `select password_hash from "users" where id = $1`,
        [user.id]
      );

      if (passwordResult.rows.length === 0) {
        console.log(`[ADMIN LOGIN] No password hash found`);
        throw new Error("Invalid credentials.");
      }

      const passwordHash = passwordResult.rows[0].password_hash;
      console.log(`[ADMIN LOGIN] Password hash from DB:`, passwordHash.substring(0, 20) + "...");
      
      const isValidPassword = await bcrypt.compare(password, passwordHash);
      console.log(`[ADMIN LOGIN] Password valid: ${isValidPassword}`);

      if (!isValidPassword) {
        console.log(`[ADMIN LOGIN] Password mismatch`);
        throw new Error("Invalid credentials.");
      }

      // Get username from the result - PostgreSQL returns column names as lowercase
      const resultUsername = usernameColumn ? user[usernameColumn] : username;

      console.log(`[ADMIN LOGIN] Login successful for: ${resultUsername}`);
      return {
        id: user.id,
        username: resultUsername || username,
        email: user.email,
        role: user.role,
      };
    });

    response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid credentials.") {
      response.status(401).json({ error: "Invalid username or password." });
    } else {
      next(error);
    }
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

    const result = await withTransaction(async (client) => {
      const agentProfile = await updateRow(
        client,
        "agent_profiles",
        "user_id",
        agentId,
        {
          current_latitude: latitude,
          current_longitude: longitude,
        },
        ["user_id", "current_latitude", "current_longitude"],
      );

      if (!agentProfile) {
        throw new Error("Agent profile not found.");
      }

      return agentProfile;
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

// Update agent availability
app.put("/api/agents/:agentId/availability", async (request, response, next) => {
  try {
    const { agentId } = request.params;
    const { isAvailable } = request.body ?? {};

    if (typeof isAvailable !== "boolean") {
      response.status(400).json({ error: "isAvailable must be a boolean" });
      return;
    }

    const result = await withTransaction(async (client) => {
      const agentProfile = await updateRow(
        client,
        "agent_profiles",
        "user_id",
        agentId,
        {
          is_available: isAvailable,
        },
        ["user_id", "is_available"],
      );

      if (!agentProfile) {
        throw new Error("Agent profile not found.");
      }

      return agentProfile;
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

// Get agent's pending/active dispatches
app.get("/api/agents/:agentId/dispatches", async (request, response, next) => {
  try {
    const { agentId } = request.params;

    const result = await withTransaction(async (client) => {
      // Get pending and active dispatches for this agent
      const dispatchQuery = `
        select
          d.id,
          d.emergency_report_id,
          d.agent_user_id,
          d.dispatch_status,
          d.assigned_at,
          d.accepted_at,
          d.arrived_at,
          d.completed_at,
          er.latitude as motorist_latitude,
          er.longitude as motorist_longitude,
          er.issue_summary,
          u.full_name as motorist_name,
          u.phone as motorist_phone,
          u.id as motorist_id,
          coalesce(array_remove(array_agg(ers.symptom_text), null), array[]::text[]) as motorist_symptoms
        from dispatches d
        join emergency_reports er on d.emergency_report_id = er.id
        join users u on er.motorist_user_id = u.id
        left join emergency_report_symptoms ers on ers.emergency_report_id = er.id
        where d.agent_user_id = $1
        and d.dispatch_status NOT IN ('declined', 'completed')
        group by
          d.id,
          d.emergency_report_id,
          d.agent_user_id,
          d.dispatch_status,
          d.assigned_at,
          d.accepted_at,
          d.arrived_at,
          d.completed_at,
          er.latitude,
          er.longitude,
          er.issue_summary,
          u.full_name,
          u.phone,
          u.id
        order by d.assigned_at desc
      `;

      const result = await client.query(dispatchQuery, [agentId]);
      
      return result.rows.map(row => ({
        id: row.id,
        emergencyReportId: row.emergency_report_id,
        agentUserId: row.agent_user_id,
        dispatchStatus: row.dispatch_status,
        assignedAt: row.assigned_at,
        acceptedAt: row.accepted_at,
        arrivedAt: row.arrived_at,
        completedAt: row.completed_at,
        motorist: {
          id: row.motorist_id,
          fullName: row.motorist_name,
          phone: row.motorist_phone,
          latitude: parseFloat(row.motorist_latitude),
          longitude: parseFloat(row.motorist_longitude),
          locationLabel: row.motorist_name ? `${row.motorist_name} - ${row.motorist_symptoms.join(', ')}` : 'Emergency Location',
          issueSummary: row.issue_summary,
          symptoms: row.motorist_symptoms || [],
        },
      }));
    });

    console.log(`[AGENT DISPATCHES] Agent ${agentId} - Found ${result.length} pending/active dispatches`);
    if (result.length > 0) {
      result.forEach(d => console.log(`  - Dispatch ${d.id}: ${d.dispatchStatus} - Motorist: ${d.motorist.fullName}`));
    }
    response.json(result);
  } catch (error) {
    next(error);
  }
});

// Agent accept dispatch
app.patch("/api/dispatches/:dispatchId/accept", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const { agentId } = request.body ?? {};

    if (!agentId) {
      response.status(400).json({ error: "agentId is required in request body" });
      return;
    }

    const result = await withTransaction(async (client) => {
      // Verify dispatch exists and is pending
      const dispatchQuery = `
        select id, agent_user_id, dispatch_status
        from dispatches
        where id = $1
        limit 1
      `;
      const dispatchResult = await client.query(dispatchQuery, [dispatchId]);
      
      if (dispatchResult.rows.length === 0) {
        throw new Error("Dispatch not found.");
      }

      const dispatch = dispatchResult.rows[0];
      
      if (dispatch.dispatch_status !== "pending") {
        throw new Error(`Dispatch is already ${dispatch.dispatch_status}. Cannot accept.`);
      }

      if (dispatch.agent_user_id !== agentId) {
        throw new Error("This dispatch is not assigned to you.");
      }

      // Update dispatch status to "assigned" and set accepted_at
      const updated = await updateRow(
        client,
        "dispatches",
        "id",
        dispatchId,
        {
          dispatch_status: "assigned",
          accepted_at: new Date().toISOString(),
        },
        ["id", "dispatch_status", "accepted_at"],
      );

      return updated;
    });

    response.json({ success: true, dispatch: result });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not assigned to you")) {
      response.status(403).json({ error: error.message });
    } else if (error instanceof Error && error.message.includes("already")) {
      response.status(409).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

// Agent decline dispatch
app.patch("/api/dispatches/:dispatchId/decline", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;
    const { agentId } = request.body ?? {};

    if (!agentId) {
      response.status(400).json({ error: "agentId is required in request body" });
      return;
    }

    const result = await withTransaction(async (client) => {
      // Verify dispatch exists and is pending
      const dispatchQuery = `
        select id, agent_user_id, dispatch_status
        from dispatches
        where id = $1
        limit 1
      `;
      const dispatchResult = await client.query(dispatchQuery, [dispatchId]);
      
      if (dispatchResult.rows.length === 0) {
        throw new Error("Dispatch not found.");
      }

      const dispatch = dispatchResult.rows[0];
      
      if (dispatch.dispatch_status !== "pending") {
        throw new Error(`Dispatch is already ${dispatch.dispatch_status}. Cannot decline.`);
      }

      if (dispatch.agent_user_id !== agentId) {
        throw new Error("This dispatch is not assigned to you.");
      }

      // Update dispatch status to "declined"
      const updated = await updateRow(
        client,
        "dispatches",
        "id",
        dispatchId,
        {
          dispatch_status: "declined",
        },
        ["id", "dispatch_status"],
      );

      return updated;
    });

    response.json({ success: true, dispatch: result });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not assigned to you")) {
      response.status(403).json({ error: error.message });
    } else if (error instanceof Error && error.message.includes("already")) {
      response.status(409).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

// Find nearby agents
app.get("/api/agents/nearby", async (request, response, next) => {
  try {
    const { lat, lng } = request.query;

    if (!lat || !lng) {
      response.status(400).json({ error: "lat and lng query parameters are required" });
      return;
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    if (isNaN(userLat) || isNaN(userLng)) {
      response.status(400).json({ error: "lat and lng must be valid numbers" });
      return;
    }

    const result = await withTransaction(async (client) => {
      // Find agents within 20km who are available
      const agentQuery = `
        select
          u.id,
          u.full_name,
          ap.service_type as service_category,
          ap.current_latitude,
          ap.current_longitude,
          ap.is_available,
          (6371 * acos(cos(radians($1)) * cos(radians(ap.current_latitude)) * cos(radians(ap.current_longitude) - radians($2)) + sin(radians($1)) * sin(radians(ap.current_latitude)))) as distance_km
        from users u
        join agent_profiles ap on u.id = ap.user_id
        where ap.is_available = true
        and ap.current_latitude is not null
        and ap.current_longitude is not null
        and (6371 * acos(cos(radians($1)) * cos(radians(ap.current_latitude)) * cos(radians(ap.current_longitude) - radians($2)) + sin(radians($1)) * sin(radians(ap.current_latitude)))) <= 20
        order by distance_km asc
        limit 10
      `;

      const result = await client.query(agentQuery, [userLat, userLng]);
      console.log(`[NEARBY AGENTS] Motorist at (${userLat}, ${userLng}) - Found ${result.rows.length} available agents within 20km`);
      
      return result.rows.map(row => ({
        id: String(row.id),
        fullName: row.full_name,
        serviceCategory: row.service_category,
        services: row.services || [],
        latitude: parseFloat(row.current_latitude),
        longitude: parseFloat(row.current_longitude),
        distanceKm: parseFloat(row.distance_km),
      }));
    });

    response.json(result);
  } catch (error) {
    console.error("[NEARBY AGENTS ERROR]", error);
    next(error);
  }
});

app.get("/api/dispatches/:dispatchId", async (request, response, next) => {
  try {
    const { dispatchId } = request.params;

    const result = await withTransaction(async (client) => {
      // Get dispatch details with related data
      const dispatchQuery = `
        select
          d.id,
          d.emergency_report_id,
          d.agent_user_id,
          d.repair_shop_id,
          d.dispatch_status,
          d.assigned_at,
          d.accepted_at,
          d.arrived_at,
          d.completed_at,
          er.latitude as motorist_latitude,
          er.longitude as motorist_longitude,
          u.full_name as motorist_name,
          u.phone as motorist_phone,
          u.id as motorist_id,
          ap.business_name as agent_business_name,
          au.full_name as agent_name,
          au.phone as agent_phone,
          au.id as agent_id,
          ap.current_latitude as agent_current_latitude,
          ap.current_longitude as agent_current_longitude
        from dispatches d
        join emergency_reports er on d.emergency_report_id = er.id
        join users u on er.motorist_user_id = u.id
        left join users au on d.agent_user_id = au.id
        left join agent_profiles ap on au.id = ap.user_id
        where d.id = $1
        limit 1
      `;

      const dispatchResult = await client.query(dispatchQuery, [dispatchId]);

      if (dispatchResult.rows.length === 0) {
        throw new Error("Dispatch not found.");
      }

      const row = dispatchResult.rows[0];

      // Get location label from emergency report symptoms or issue summary
      const symptomsQuery = `
        select symptom_text
        from emergency_report_symptoms
        where emergency_report_id = $1
      `;
      const symptomsResult = await client.query(symptomsQuery, [row.emergency_report_id]);
      const symptoms = symptomsResult.rows.map(r => r.symptom_text);

      return {
        id: row.id,
        emergency_report_id: row.emergency_report_id,
        agent_user_id: row.agent_user_id,
        repair_shop_id: row.repair_shop_id,
        dispatch_status: row.dispatch_status,
        assigned_at: row.assigned_at,
        accepted_at: row.accepted_at,
        arrived_at: row.arrived_at,
        completed_at: row.completed_at,
        motorist: {
          id: row.motorist_id,
          fullName: row.motorist_name,
          phone: row.motorist_phone,
          latitude: parseFloat(row.motorist_latitude),
          longitude: parseFloat(row.motorist_longitude),
          locationLabel: row.motorist_name ? `${row.motorist_name} - ${symptoms.join(', ')}` : 'Emergency Location',
        },
        agent: row.agent_id ? {
          id: row.agent_id,
          fullName: row.agent_name,
          phone: row.agent_phone,
          businessName: row.agent_business_name,
          currentLatitude: row.agent_current_latitude ? parseFloat(row.agent_current_latitude) : null,
          currentLongitude: row.agent_current_longitude ? parseFloat(row.agent_current_longitude) : null,
        } : null,
      };
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);

  if (error?.code === "23505") {
    response.status(409).json({ error: "A record with the same unique value already exists." });
    return;
  }

  response.status(500).json({
    error: error instanceof Error ? error.message : "Unexpected server error.",
  });
});

app.listen(port, () => {
  console.log(`RoadResQ backend listening on http://localhost:${port}`);
});
