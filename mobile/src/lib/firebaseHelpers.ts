import { apiBaseUrl } from "./roadresqApi";

type Coordinates = { latitude: number; longitude: number };

export type RescueRequest = {
  id: string;
  agentId: string;
  responderId?: string;
  agentName?: string | null;
  motoristId: string;
  motoristName: string;
  motoristLocation: Coordinates;
  serviceType: string;
  issue: string;
  status: "pending" | "accepted" | "declined" | "completed";
  createdAt?: unknown;
  acceptedAt?: unknown;
  completedAt?: unknown;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const listenToAgentRequests = (
  agentId: string,
  onUpdate: (requests: RescueRequest[]) => void,
  onError: (error: Error) => void,
) => {
  let cancelled = false;

  const poll = async () => {
    try {
      const requests = await request<RescueRequest[]>(`/agents/${agentId}/requests`);
      if (!cancelled) {
        onUpdate(requests);
      }
    } catch (error) {
      if (!cancelled) {
        onError(error as Error);
      }
    }
  };

  void poll();
  const interval = setInterval(() => {
    void poll();
  }, 5000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
};

export const listenToRequest = (
  requestId: string,
  onUpdate: (requestData: RescueRequest) => void,
  onError: (error: Error) => void,
) => {
  let cancelled = false;

  const poll = async () => {
    try {
      const requestData = await request<RescueRequest>(`/requests/${requestId}`);
      if (!cancelled) {
        onUpdate(requestData);
      }
    } catch (error) {
      if (!cancelled) {
        onError(error as Error);
      }
    }
  };

  void poll();
  const interval = setInterval(() => {
    void poll();
  }, 5000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
};

export const listenToAgentLocation = (
  agentId: string,
  onUpdate: (location: { latitude: number; longitude: number; lastUpdated: number | null }) => void,
  onError: (error: Error) => void,
) => {
  let cancelled = false;

  const poll = async () => {
    try {
      const location = await request<{ latitude: number | null; longitude: number | null; lastUpdated: number | null }>(
        `/agents/${agentId}/location`,
      );

      if (!cancelled && location.latitude != null && location.longitude != null) {
        onUpdate({
          latitude: location.latitude,
          longitude: location.longitude,
          lastUpdated: location.lastUpdated ?? null,
        });
      }
    } catch (error) {
      if (!cancelled) {
        onError(error as Error);
      }
    }
  };

  void poll();
  const interval = setInterval(() => {
    void poll();
  }, 5000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
};

export const listenToAssignedAgentLocation = listenToAgentLocation;

export const createRescueRequest = async (
  motoristId: string,
  agentId: string,
  motoristLocation: Coordinates,
  motoristName: string,
  serviceType: string,
  issue: string,
) => {
  const result = await request<{ id: string }>("/requests", {
    method: "POST",
    body: JSON.stringify({
      motoristId,
      responderId: agentId,
      agentId,
      motoristLocation,
      motoristName,
      serviceType,
      issue,
    }),
  });

  return result.id;
};

export const acceptRequest = async (requestId: string, _agentId: string) => {
  await request(`/requests/${requestId}/accept`, {
    method: "PATCH",
  });
};

export const declineRequest = async (requestId: string) => {
  await request(`/requests/${requestId}/decline`, {
    method: "PATCH",
  });
};

export const completeRequest = async (requestId: string) => {
  await request(`/requests/${requestId}/complete`, {
    method: "PATCH",
  });
};

export const updateAgentLocation = async (agentId: string, location: Coordinates) => {
  await request(`/agents/${agentId}/location`, {
    method: "PUT",
    body: JSON.stringify(location),
  });
};

export const setAgentStatus = async (agentId: string, status: "online" | "offline") => {
  await request(`/agents/${agentId}/availability`, {
    method: "PUT",
    body: JSON.stringify({ isAvailable: status === "online" }),
  });
};

export const getNearbyAgents = async (latitude: number, longitude: number, radiusKm = 5) => {
  return request<Array<Record<string, unknown>>>(`/agents/nearby?lat=${latitude}&lng=${longitude}&radius=${radiusKm}`);
};

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
