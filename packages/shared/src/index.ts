export type AppRole = "user" | "agent" | "admin";

export type ServiceCategory =
  | "mechanical"
  | "vulcanizing"
  | "electrical"
  | "towing";

export type DispatchStatus =
  | "searching"
  | "matched"
  | "accepted"
  | "en-route"
  | "arrived"
  | "in-service"
  | "completed"
  | "cancelled";

export interface EmergencyReportDraft {
  vehicleType: string;
  plateNumber: string;
  serviceCategory: ServiceCategory;
  issueSummary: string;
  latitude: number;
  longitude: number;
}

export interface DispatchSummary {
  id: string;
  motoristName: string;
  agentName: string | null;
  locationLabel: string;
  status: DispatchStatus;
  etaMinutes: number | null;
}

export interface AgentProfile {
  id: string;
  displayName: string;
  category: ServiceCategory;
  rating: number;
  isOnline: boolean;
  baseCity: string;
}

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  mechanical: "Mechanical",
  vulcanizing: "Vulcanizing",
  electrical: "Electrical",
  towing: "Towing",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  user: "Motorist",
  agent: "Responder",
  admin: "Administrator",
};

export const starterDispatches: DispatchSummary[] = [
  {
    id: "DISP-1001",
    motoristName: "Maria Santos",
    agentName: "Mang Pedring",
    locationLabel: "San Pablo City",
    status: "en-route",
    etaMinutes: 8,
  },
  {
    id: "DISP-1002",
    motoristName: "Jose Garcia",
    agentName: null,
    locationLabel: "Calauan, Laguna",
    status: "searching",
    etaMinutes: null,
  },
];

export const starterAgents: AgentProfile[] = [
  {
    id: "AGENT-001",
    displayName: "Mang Pedring",
    category: "mechanical",
    rating: 4.9,
    isOnline: true,
    baseCity: "San Pablo City",
  },
  {
    id: "AGENT-002",
    displayName: "Juan Dela Cruz",
    category: "towing",
    rating: 4.8,
    isOnline: true,
    baseCity: "Bay, Laguna",
  },
];
