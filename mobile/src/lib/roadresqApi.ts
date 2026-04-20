import { NativeModules, Platform } from "react-native";

export type DbRepairShop = {
  id: string;
  name: string;
  category: string;
  rating: number;
  distance_km: number;
  address: string;
  response_time: string;
  open_now: boolean;
  phone: string | null;
  latitude: number;
  longitude: number;
  services: string[];
};

export type UserRegistrationInput = {
  fullName: string;
  mobileNumber: string;
  username: string;
  password: string;
};

export type UserLoginInput = {
  username: string;
  password: string;
};

export type AgentApplicationInput = {
  ownerName: string;
  mobileNumber: string;
  serviceCategory: string;
  serviceArea: string;
  username: string;
  password: string;
  credentialManifest: Record<string, string | null>;
};

export type EmergencyDispatchInput = {
  username: string;
  mobileNumber: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  serviceType: string;
  issueSummary: string;
  symptoms: string[];
  matchedShopId: string | null;
  matchedAgentId?: string | null;
};

export type LocationUpdate = {
  latitude: number;
  longitude: number;
};

export type DispatchDetails = {
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
    issueSummary: string;
    symptoms: string[];
  };
  agent: {
    id: string;
    fullName: string;
    phone: string;
    businessName: string;
    currentLatitude: number | null;
    currentLongitude: number | null;
  } | null;
};

export async function updateAgentLocation(agentId: string, location: LocationUpdate): Promise<void> {
  await apiRequest<void>(`/agents/${agentId}/location`, {
    method: "PUT",
    body: JSON.stringify(location),
  });
}
export function updateAgentAvailability(agentId: string, isAvailable: boolean): Promise<void> {
  return apiRequest<void>(`/agents/${agentId}/availability`, {
    method: "PUT",
    body: JSON.stringify({ isAvailable }),
  });
}
export async function fetchDispatchDetails(dispatchId: string): Promise<DispatchDetails> {
  return apiRequest<DispatchDetails>(`/dispatches/${dispatchId}`);
}

export interface RouteData {
  distance: number;
  duration: number;
  geometry: [number, number][];
}

export async function getRoute(origin: [number, number], destination: [number, number]): Promise<RouteData | null> {
  const [originLat, originLng] = origin;
  const [destLat, destLng] = destination;

  try {
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
        geometry: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]),
      };
    }

    return null;
  } catch (error) {
    console.warn('Routing API unavailable, using direct-line fallback:', error);
    const distanceKm = calculateDistance(originLat, originLng, destLat, destLng);
    return {
      distance: distanceKm * 1000,
      duration: Math.ceil((distanceKm / 30) * 3600),
      geometry: [
        [originLat, originLng],
        [destLat, destLng],
      ],
    };
  }
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function calculateETA(distanceKm: number, averageSpeedKmh: number = 30): number {
  return Math.ceil((distanceKm / averageSpeedKmh) * 60);
}

export type UserLoginResponse = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export type AgentLoginResponse = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

function detectDevHost() {
  const scriptURL = NativeModules.SourceCode?.scriptURL;

  if (!scriptURL) {
    return null;
  }

  try {
    const url = new URL(scriptURL);
    return url.hostname || null;
  } catch {
    return null;
  }
}

const detectedHost = detectDevHost();
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  (detectedHost
    ? `http://${detectedHost}:4000/api`
    : `http://${Platform.OS === "android" ? "10.0.2.2" : "localhost"}:4000/api`
  );

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchRepairShops() {
  return apiRequest<DbRepairShop[]>("/repair-shops");
}

export function registerUserProfile(input: UserRegistrationInput) {
  return apiRequest<{ id: string }>("/users/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function submitAgentApplication(input: AgentApplicationInput) {
  return apiRequest<{ id: string }>("/agent-applications/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createEmergencyDispatch(input: EmergencyDispatchInput) {
  return apiRequest<{ reportId: string; dispatchId: string }>("/emergency-dispatches", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginUser(input: UserLoginInput) {
  return apiRequest<UserLoginResponse>("/users/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginAgent(input: UserLoginInput) {
  return apiRequest<AgentLoginResponse>("/agents/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type NearbyAgent = {
  id: string;
  fullName: string;
  serviceCategory: string;
  distanceKm: number;
  services: string[];
  latitude: number;
  longitude: number;
};

export function fetchAgentDispatches(agentId: string) {
  return apiRequest<DispatchDetails[]>(`/agents/${agentId}/dispatches`);
}

export function acceptDispatch(dispatchId: string, agentId: string) {
  return apiRequest<{ success: boolean; dispatch: any }>(`/dispatches/${dispatchId}/accept`, {
    method: "PATCH",
    body: JSON.stringify({ agentId }),
  });
}

export function declineDispatch(dispatchId: string, agentId: string) {
  return apiRequest<{ success: boolean; dispatch: any }>(`/dispatches/${dispatchId}/decline`, {
    method: "PATCH",
    body: JSON.stringify({ agentId }),
  });
}

export function updateDispatchStatus(dispatchId: string, status: string) {
  return apiRequest<{ success: boolean; dispatch: any }>(`/dispatches/${dispatchId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function findNearbyAgents(latitude: number, longitude: number) {
  return apiRequest<NearbyAgent[]>(`/agents/nearby?lat=${latitude}&lng=${longitude}`);
}
