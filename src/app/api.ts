const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:4000/api";

export type AgentApplicationStatus = "pending" | "approved" | "rejected";
export type UserRole = "motorist" | "agent" | "admin";

// Session management
export interface AdminSession {
  id: string;
  username: string;
  role: string;
}

const ADMIN_SESSION_KEY = "roadresq_admin_session";

export function saveAdminSession(session: AdminSession): void {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function getAdminSession(): AdminSession | null {
  const stored = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AdminSession;
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export interface AgentApplicationRemarks {
  serviceArea?: string;
  credentials?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AgentApplication {
  id: string;
  userId: string;
  ownerName: string;
  mobileNumber: string;
  serviceCategory: string;
  serviceArea: string;
  status: AgentApplicationStatus;
  remarks: AgentApplicationRemarks | null;
  submittedDate: string | null;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: string;
  createdAt: string | null;
}

export interface AuthPayload {
  username: string;
  password: string;
}

export interface UserRegistrationPayload extends AuthPayload {
  fullName: string;
  mobileNumber: string;
}

export interface AgentRegistrationPayload extends AuthPayload {
  ownerName: string;
  mobileNumber: string;
  serviceCategory: string;
  serviceArea: string;
  credentialManifest?: Record<string, string>;
}

export interface EmergencyDispatchPayload {
  username: string;
  mobileNumber: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  serviceType: "repair" | "transport";
  issueSummary: string;
  symptoms: string[];
  matchedShopId?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function readNullableString(value: unknown): string | null {
  const normalized = readString(value).trim();
  return normalized ? normalized : null;
}

function readRole(value: unknown): UserRole {
  return value === "agent" || value === "admin" ? value : "motorist";
}

function readApplicationStatus(value: unknown): AgentApplicationStatus {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function readRemarks(value: unknown): AgentApplicationRemarks {
  if (isRecord(value)) {
    return value as AgentApplicationRemarks;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isRecord(parsed) ? (parsed as AgentApplicationRemarks) : {};
    } catch {
      return {};
    }
  }

  return {};
}

function mapAgentApplication(payload: unknown): AgentApplication {
  const row = isRecord(payload) ? payload : {};
  const remarks = readRemarks(row.remarks);
  const serviceArea = readString(
    row.serviceArea ?? remarks?.serviceArea,
  );

  return {
    id: readString(row.id),
    userId: readString(row.userId ?? row.user_id),
    ownerName: readString(row.ownerName ?? row.full_name),
    mobileNumber: readString(row.mobileNumber ?? row.phone),
    serviceCategory: readString(row.serviceCategory ?? row.service_type),
    serviceArea,
    status: readApplicationStatus(row.status),
    remarks: Object.keys(remarks).length > 0 ? remarks : null,
    submittedDate: readNullableString(
      row.submittedDate ?? row.submitted_at,
    ),
  };
}

function mapUserSummary(payload: unknown): UserSummary {
  const row = isRecord(payload) ? payload : {};

  return {
    id: readString(row.id),
    fullName: readString(row.fullName ?? row.full_name),
    email: readString(row.email),
    phone: readString(row.phone),
    role: readRole(row.role),
    status: readString(row.status),
    createdAt: readNullableString(row.createdAt ?? row.created_at),
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Unable to reach the backend API.",
    );
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    const responseText = await response.text();

    if (responseText) {
      try {
        const payload = JSON.parse(responseText) as { error?: string; message?: string };
        if (typeof payload.error === "string" && payload.error.trim()) {
          message = payload.error;
        } else if (typeof payload.message === "string" && payload.message.trim()) {
          message = payload.message;
        } else {
          message = responseText;
        }
      } catch {
        message = responseText;
      }
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchAgentApplications(): Promise<AgentApplication[]> {
  const payload = await apiRequest<unknown>("/agent-applications");
  return Array.isArray(payload) ? payload.map(mapAgentApplication) : [];
}

export function registerUser(payload: UserRegistrationPayload) {
  return apiRequest<{ id: string; email: string }>("/users/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: AuthPayload) {
  return apiRequest<{ id: string; fullName: string; email: string; role: string }>(
    "/users/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function registerAgentApplication(payload: AgentRegistrationPayload) {
  return apiRequest<{ id: string; userId: string }>("/agent-applications/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginAgent(payload: AuthPayload) {
  return apiRequest<{ id: string; fullName: string; email: string; role: string }>(
    "/agents/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function loginAdmin(payload: AuthPayload) {
  return apiRequest<{ id: string; username: string; email: string; role: string }>(
    "/admin/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function createEmergencyDispatch(payload: EmergencyDispatchPayload) {
  return apiRequest<{ reportId: string; dispatchId: string }>("/emergency-dispatches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAgentApplicationStatus(
  applicationId: string,
  status: "approved" | "rejected",
) {
  return apiRequest<unknown>(
    `/agent-applications/${applicationId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  ).then((payload) => {
    const row = isRecord(payload) ? payload : {};

    return {
      id: readString(row.id, applicationId),
      status: readApplicationStatus(row.status ?? status),
    };
  });
}

export async function fetchUsers(role?: string): Promise<UserSummary[]> {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  const payload = await apiRequest<unknown>(`/users${query}`);
  return Array.isArray(payload) ? payload.map(mapUserSummary) : [];
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
}

export interface DispatchDetails {
  id: string;
  emergencyReportId: string;
  agentUserId: string | null;
  repairShopId: string | null;
  dispatchStatus: string;
  assignedAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  motorist: {
    id: string;
    fullName: string;
    phone: string;
    latitude: number;
    longitude: number;
    locationLabel: string;
  };
  agent: {
    id: string;
    fullName: string;
    phone: string;
    businessName: string;
    currentLatitude: number | null;
    currentLongitude: number | null;
  } | null;
}

export async function updateAgentLocation(agentId: string, location: LocationUpdate): Promise<void> {
  await apiRequest<void>(`/agents/${agentId}/location`, {
    method: "PUT",
    body: JSON.stringify(location),
  });
}

export async function fetchDispatchDetails(dispatchId: string): Promise<DispatchDetails> {
  const payload = await apiRequest<unknown>(`/dispatches/${dispatchId}`);
  const row = isRecord(payload) ? payload : {};

  return {
    id: readString(row.id),
    emergencyReportId: readString(row.emergency_report_id ?? row.emergencyReportId),
    agentUserId: readNullableString(row.agent_user_id ?? row.agentUserId),
    repairShopId: readNullableString(row.repair_shop_id ?? row.repairShopId),
    dispatchStatus: readString(row.dispatch_status ?? row.dispatchStatus),
    assignedAt: readString(row.assigned_at ?? row.assignedAt),
    acceptedAt: readNullableString(row.accepted_at ?? row.acceptedAt),
    arrivedAt: readNullableString(row.arrived_at ?? row.arrivedAt),
    completedAt: readNullableString(row.completed_at ?? row.completedAt),
    motorist: {
      id: readString(row.motorist_id ?? row.motorist?.id),
      fullName: readString(row.motorist_name ?? row.motorist?.fullName),
      phone: readString(row.motorist_phone ?? row.motorist?.phone),
      latitude: parseFloat(readString(row.motorist_latitude ?? row.motorist?.latitude, "0")),
      longitude: parseFloat(readString(row.motorist_longitude ?? row.motorist?.longitude, "0")),
      locationLabel: readString(row.location_label ?? row.motorist?.locationLabel),
    },
    agent: row.agent ? {
      id: readString(row.agent.id),
      fullName: readString(row.agent.fullName),
      phone: readString(row.agent.phone),
      businessName: readString(row.agent.businessName),
      currentLatitude: row.agent.currentLatitude ? parseFloat(readString(row.agent.currentLatitude)) : null,
      currentLongitude: row.agent.currentLongitude ? parseFloat(readString(row.agent.currentLongitude)) : null,
    } : null,
  };
}

export async function updateDispatchStatus(dispatchId: string, status: string): Promise<void> {
  await apiRequest<void>(`/dispatches/${dispatchId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export interface RouteData {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: [number, number][]; // array of [lat, lng] coordinates
}

export async function getRoute(origin: [number, number], destination: [number, number]): Promise<RouteData | null> {
  try {
    // Using OSRM (Open Source Routing Machine) API for routing
    const [originLat, originLng] = origin;
    const [destLat, destLng] = destination;
    
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`
    );
    
    if (!response.ok) {
      throw new Error('Routing API request failed');
    }
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]), // Convert from [lng, lat] to [lat, lng]
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get route:', error);
    return null;
  }
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

export function calculateETA(distanceKm: number, averageSpeedKmh: number = 30): number {
  // Assume average speed of 30 km/h in city traffic
  return Math.ceil((distanceKm / averageSpeedKmh) * 60); // ETA in minutes
}
