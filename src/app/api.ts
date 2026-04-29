const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:4000/api";

export type AgentApplicationStatus = "pending" | "approved" | "rejected";
export type UserRole = "motorist" | "agent" | "admin" | "community";

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
    const session = JSON.parse(stored) as Partial<AdminSession>;
    if (
      typeof session?.id === "string" &&
      typeof session?.username === "string" &&
      session?.role === "admin"
    ) {
      return session as AdminSession;
    }

    clearAdminSession();
    return null;
  } catch {
    clearAdminSession();
    return null;
  }
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export interface AgentApplicationRemarks {
  serviceArea?: string;
  serviceCategories?: string[];
  organizationName?: string;
  liabilityAcknowledged?: boolean;
  credentials?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CredentialFilePayload {
  name: string;
  type: string;
  dataUrl: string;
}

export interface CredentialAsset {
  name: string;
  url?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface AgentApplication {
  id: string;
  userId: string;
  ownerName: string;
  mobileNumber: string;
  serviceCategory: string;
  serviceArea: string;
  organizationName: string;
  status: AgentApplicationStatus;
  remarks: AgentApplicationRemarks | null;
  submittedDate: string | null;
}

export interface AgentBalanceProofReview {
  userId: string;
  agentName: string;
  businessName: string;
  organizationName: string;
  phone: string;
  gcashName: string;
  gcashNumber: string;
  payoutNotes: string;
  proofUrl: string;
  status: "missing" | "pending" | "approved" | "rejected";
  readinessTier: "tier_1" | "tier_2" | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  approvedBy: string;
  rejectionReason: string;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: string;
  createdAt: string | null;
  subscriptionStatus?: "active" | "inactive";
  subscriptionPlan?: "monthly" | "six_months" | "annual" | null;
  subscriptionActivatedAt?: string | null;
  subscriptionExpiresAt?: string | null;
  communityCoins?: number;
  communityLifetimeCoins?: number;
  lastCommunityRewardAt?: string | null;
}

export interface AuthPayload {
  username: string;
  password: string;
}

export interface UserLoginResponse {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  subscriptionStatus?: "active" | "inactive";
  subscriptionPlan?: "monthly" | "six_months" | "annual" | null;
  subscriptionActivatedAt?: string | null;
  subscriptionExpiresAt?: string | null;
  communityCoins?: number;
  communityLifetimeCoins?: number;
  lastCommunityRewardAt?: string | null;
}

export interface UserRegistrationPayload extends AuthPayload {
  fullName: string;
  mobileNumber: string;
}

export interface AgentRegistrationPayload extends AuthPayload {
  ownerName: string;
  mobileNumber: string;
  organizationName: string;
  serviceCategory: string;
  serviceCategories?: string[];
  serviceArea: string;
  liabilityAcknowledged: boolean;
  credentialManifest?: Record<string, string>;
  credentialFiles?: Record<string, CredentialFilePayload>;
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

export interface SubscriptionPayment {
  id: string;
  userId: string;
  payerName: string;
  payerPhone: string;
  subscriptionPlan: "monthly" | "six_months" | "annual" | null;
  amount: number;
  referenceNote: string;
  status: "pending" | "confirmed" | "rejected";
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface AdminEarningsSummary {
  totalRevenue: number;
  subscriptionRevenue: number;
  serviceCommissionRevenue: number;
  freeMotoristCommissionRevenue: number;
  paidMotoristCommissionRevenue: number;
  confirmedSubscriptionCount: number;
  confirmedSubscriptionPayments: Array<{
    id: string;
    userId: string;
    subscriptionPlan: "monthly" | "six_months" | "annual" | null;
    amount: number;
    reviewedAt: string | null;
  }>;
  activeSubscriptions: Array<{
    userId: string;
    payerName: string;
    payerPhone: string;
    subscriptionPlan: "monthly" | "six_months" | "annual" | null;
    planLabel: string;
    amount: number;
    activatedAt: string | null;
    expiresAt: string | null;
    month: string | null;
  }>;
  monthlySubscriptionStats: Array<{
    month: string;
    active: number;
    inactive: number;
    monthly: number;
    sixMonths: number;
    annual: number;
    revenue: number;
  }>;
  unsubscribedMotorists: Array<{
    id: string;
    fullName: string;
    phone: string;
    email: string;
    registeredAt: string | null;
    accountStatus: string;
  }>;
  completedCommissionDispatchCount: number;
  commissionPolicy: {
    freeMotoristRate: number;
    paidMotoristRate: number;
  };
  recentCommissions: Array<{
    id: string;
    totalAmount: number;
    serviceAmount: number;
    commissionAmount: number;
    commissionRate: number;
    subscriptionStatus: "active" | "inactive";
    completedAt: string | null;
  }>;
}

export interface CommunityProfile {
  id: string;
  fullName: string;
  role: "community";
  communityCoins: number;
  communityLifetimeCoins: number;
  lastCommunityRewardAt: string | null;
  lastCommunityVisitRewardAt?: string | null;
  communityCoinLockUntil?: string | null;
}

export interface CommunityRewardOption {
  id: string;
  title: string;
  coinsRequired: number;
  cashValue: number;
}

export interface CommunityRedemption {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  rewardId: string;
  rewardTitle: string;
  cashValue: number;
  coinsRequired: number;
  coinsSpent: number;
  gcashName: string;
  gcashNumber: string;
  status: "pending" | "paid" | "rejected";
  submittedAt: string | null;
  reviewedAt: string | null;
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
  if (value === "agent" || value === "admin" || value === "community") {
    return value;
  }

  return "motorist";
}

function readApplicationStatus(value: unknown): AgentApplicationStatus {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function readDispatchFeedbackRole(value: unknown): DispatchFeedbackRole {
  return value === "agent" ? "agent" : "motorist";
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
    organizationName: readString(row.organizationName ?? remarks?.organizationName),
    status: readApplicationStatus(row.status),
    remarks: Object.keys(remarks).length > 0 ? remarks : null,
    submittedDate: readNullableString(
      row.submittedDate ?? row.submitted_at,
    ),
  };
}

function mapAgentBalanceProofReview(payload: unknown): AgentBalanceProofReview {
  const row = isRecord(payload) ? payload : {};

  return {
    userId: readString(row.userId ?? row.user_id),
    agentName: readString(row.agentName ?? row.agent_name),
    businessName: readString(row.businessName ?? row.business_name),
    organizationName: readString(row.organizationName ?? row.organization_name),
    phone: readString(row.phone),
    gcashName: readString(row.gcashName ?? row.gcash_name),
    gcashNumber: readString(row.gcashNumber ?? row.gcash_number),
    payoutNotes: readString(row.payoutNotes ?? row.payout_notes),
    proofUrl: readString(row.proofUrl ?? row.proof_url),
    status:
      row.status === "pending" || row.status === "approved" || row.status === "rejected"
        ? row.status
        : "missing",
    readinessTier:
      row.readinessTier === "tier_1" || row.readinessTier === "tier_2"
        ? row.readinessTier
        : null,
    submittedAt: readNullableString(row.submittedAt ?? row.submitted_at),
    reviewedAt: readNullableString(row.reviewedAt ?? row.reviewed_at),
    expiresAt: readNullableString(row.expiresAt ?? row.expires_at),
    approvedBy: readString(row.approvedBy ?? row.approved_by),
    rejectionReason: readString(row.rejectionReason ?? row.rejection_reason),
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
    subscriptionStatus: row.subscriptionStatus === "active" ? "active" : "inactive",
    subscriptionPlan:
      row.subscriptionPlan === "monthly" ||
      row.subscriptionPlan === "six_months" ||
      row.subscriptionPlan === "annual"
        ? row.subscriptionPlan
        : null,
    subscriptionActivatedAt: readNullableString(
      row.subscriptionActivatedAt ?? row.subscription_activated_at,
    ),
    subscriptionExpiresAt: readNullableString(
      row.subscriptionExpiresAt ?? row.subscription_expires_at,
    ),
    communityCoins: Number(row.communityCoins ?? row.community_coin_balance ?? 0),
    communityLifetimeCoins: Number(row.communityLifetimeCoins ?? row.community_lifetime_coins ?? 0),
    lastCommunityRewardAt: readNullableString(
      row.lastCommunityRewardAt ?? row.community_last_coin_activity_at,
    ),
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

export function resolveAssetUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${apiOrigin}${value.startsWith("/") ? value : `/${value}`}`;
}

export function registerUser(payload: UserRegistrationPayload) {
  return apiRequest<{ id: string; email: string }>("/users/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: AuthPayload) {
  return apiRequest<UserLoginResponse>(
    "/users/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function registerCommunity(payload: UserRegistrationPayload) {
  return apiRequest<{ id: string; email: string }>("/community/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginCommunity(payload: AuthPayload) {
  return apiRequest<UserLoginResponse>("/community/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function registerAgentApplication(payload: AgentRegistrationPayload) {
  return apiRequest<{ id: string; userId: string }>("/agent-applications/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginAgent(payload: AuthPayload) {
  return apiRequest<{ id: string; fullName: string; email: string; phone: string; role: string }>(
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

export async function fetchAgentBalanceProofs(): Promise<AgentBalanceProofReview[]> {
  const payload = await apiRequest<unknown>("/admin/agent-balance-proofs");
  return Array.isArray(payload) ? payload.map(mapAgentBalanceProofReview) : [];
}

export async function updateAgentBalanceProofStatus(
  agentId: string,
  status: "approved" | "rejected",
  approvedBy: string,
  readinessTier?: "tier_1" | "tier_2" | null,
  rejectionReason = "",
): Promise<AgentBalanceProofReview> {
  const payload = await apiRequest<unknown>(`/admin/agent-balance-proofs/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, approvedBy, readinessTier, rejectionReason }),
  });

  return mapAgentBalanceProofReview(payload);
}

export async function fetchUsers(role?: string): Promise<UserSummary[]> {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  const payload = await apiRequest<unknown>(`/users${query}`);
  return Array.isArray(payload) ? payload.map(mapUserSummary) : [];
}

export function updateUserSubscriptionStatus(
  userId: string,
  subscriptionStatus: "active" | "inactive",
  subscriptionPlan?: "monthly" | "six_months" | "annual",
) {
  return apiRequest<{
    id: string;
    subscriptionStatus: "active" | "inactive";
    subscriptionPlan: "monthly" | "six_months" | "annual" | null;
    subscriptionActivatedAt: string | null;
    subscriptionExpiresAt: string | null;
  }>(`/users/${userId}/subscription`, {
    method: "PATCH",
    body: JSON.stringify({ subscriptionStatus, subscriptionPlan }),
  });
}

export function deleteManagedUser(userId: string) {
  return apiRequest<{ id: string; deleted: boolean; role: UserRole }>(`/users/${userId}`, {
    method: "DELETE",
  });
}

export async function fetchSubscriptionPayments(): Promise<SubscriptionPayment[]> {
  const payload = await apiRequest<unknown>("/subscription-payments");
  return Array.isArray(payload) ? payload.map(mapSubscriptionPayment) : [];
}

export async function fetchAdminEarnings(): Promise<AdminEarningsSummary> {
  const payload = await apiRequest<unknown>("/admin/earnings");
  const row = isRecord(payload) ? payload : {};
  const policy = isRecord(row.commissionPolicy) ? row.commissionPolicy : {};
  const recentCommissions = Array.isArray(row.recentCommissions) ? row.recentCommissions : [];
  const confirmedSubscriptionPayments = Array.isArray(row.confirmedSubscriptionPayments)
    ? row.confirmedSubscriptionPayments
    : [];
  const activeSubscriptions = Array.isArray(row.activeSubscriptions) ? row.activeSubscriptions : [];
  const monthlySubscriptionStats = Array.isArray(row.monthlySubscriptionStats)
    ? row.monthlySubscriptionStats
    : [];
  const unsubscribedMotorists = Array.isArray(row.unsubscribedMotorists)
    ? row.unsubscribedMotorists
    : [];

  return {
    totalRevenue: Number(row.totalRevenue ?? 0),
    subscriptionRevenue: Number(row.subscriptionRevenue ?? 0),
    serviceCommissionRevenue: Number(row.serviceCommissionRevenue ?? 0),
    freeMotoristCommissionRevenue: Number(row.freeMotoristCommissionRevenue ?? 0),
    paidMotoristCommissionRevenue: Number(row.paidMotoristCommissionRevenue ?? 0),
    confirmedSubscriptionCount: Number(row.confirmedSubscriptionCount ?? 0),
    confirmedSubscriptionPayments: confirmedSubscriptionPayments.map((item) => {
      const payment = isRecord(item) ? item : {};
      const plan = payment.subscriptionPlan;
      return {
        id: readString(payment.id),
        userId: readString(payment.userId),
        subscriptionPlan:
          plan === "monthly" || plan === "six_months" || plan === "annual" ? plan : null,
        amount: Number(payment.amount ?? 0),
        reviewedAt: readNullableString(payment.reviewedAt),
      };
    }),
    activeSubscriptions: activeSubscriptions.map((item) => {
      const subscription = isRecord(item) ? item : {};
      const plan = subscription.subscriptionPlan;
      return {
        userId: readString(subscription.userId),
        payerName: readString(subscription.payerName),
        payerPhone: readString(subscription.payerPhone),
        subscriptionPlan:
          plan === "monthly" || plan === "six_months" || plan === "annual" ? plan : null,
        planLabel: readString(subscription.planLabel),
        amount: Number(subscription.amount ?? 0),
        activatedAt: readNullableString(subscription.activatedAt),
        expiresAt: readNullableString(subscription.expiresAt),
        month: readNullableString(subscription.month),
      };
    }),
    monthlySubscriptionStats: monthlySubscriptionStats.map((item) => {
      const stat = isRecord(item) ? item : {};
      return {
        month: readString(stat.month),
        active: Number(stat.active ?? 0),
        inactive: Number(stat.inactive ?? 0),
        monthly: Number(stat.monthly ?? 0),
        sixMonths: Number(stat.sixMonths ?? 0),
        annual: Number(stat.annual ?? 0),
        revenue: Number(stat.revenue ?? 0),
      };
    }),
    unsubscribedMotorists: unsubscribedMotorists.map((item) => {
      const motorist = isRecord(item) ? item : {};
      return {
        id: readString(motorist.id),
        fullName: readString(motorist.fullName),
        phone: readString(motorist.phone),
        email: readString(motorist.email),
        registeredAt: readNullableString(motorist.registeredAt),
        accountStatus: readString(motorist.accountStatus),
      };
    }),
    completedCommissionDispatchCount: Number(row.completedCommissionDispatchCount ?? 0),
    commissionPolicy: {
      freeMotoristRate: Number(policy.freeMotoristRate ?? 0),
      paidMotoristRate: Number(policy.paidMotoristRate ?? 0),
    },
    recentCommissions: recentCommissions.map((item) => {
      const commission = isRecord(item) ? item : {};
      return {
        id: readString(commission.id),
        totalAmount: Number(commission.totalAmount ?? 0),
        serviceAmount: Number(commission.serviceAmount ?? 0),
        commissionAmount: Number(commission.commissionAmount ?? 0),
        commissionRate: Number(commission.commissionRate ?? 0),
        subscriptionStatus: commission.subscriptionStatus === "active" ? "active" : "inactive",
        completedAt: readNullableString(commission.completedAt),
      };
    }),
  };
}

export async function updateSubscriptionPaymentStatus(
  paymentId: string,
  status: "confirmed" | "rejected",
): Promise<SubscriptionPayment> {
  const payload = await apiRequest<unknown>(`/subscription-payments/${paymentId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  return mapSubscriptionPayment(payload);
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

export type DispatchFeedbackRole = "motorist" | "agent";

export interface DispatchFeedback {
  id: string;
  dispatchId: string;
  emergencyReportId: string | null;
  reviewerUserId: string;
  reviewerName: string;
  reviewerRole: DispatchFeedbackRole;
  revieweeUserId: string;
  revieweeName: string;
  revieweeRole: DispatchFeedbackRole;
  overallRating: number;
  categoryRatings: Record<string, number>;
  paidCorrectAmount: boolean | null;
  comment: string;
  submittedAt: string | null;
}

export interface DispatchFeedbackPayload {
  reviewerUserId: string;
  reviewerRole: DispatchFeedbackRole;
  overallRating: number;
  categoryRatings: Record<string, number>;
  paidCorrectAmount?: boolean | null;
  comment?: string;
}

export interface DispatchFeedbackThread {
  dispatchId: string;
  dispatchStatus: string;
  feedback: DispatchFeedback[];
}

export interface DispatchHistoryEntry {
  id: string;
  dispatchId: string;
  emergencyReportId: string | null;
  dispatchStatus: string;
  completedAt: string | null;
  counterpartName: string;
  counterpartRole: DispatchFeedbackRole;
  locationLabel: string;
  issueSummary: string;
  serviceLabel: string;
  dispatch: DispatchDetails | null;
  viewerFeedback: DispatchFeedback | null;
  counterpartFeedback: DispatchFeedback | null;
}

export type ForumRole = "motorist" | "agent" | "community";
export type ForumTopic = "general" | "agent" | "motorist" | "payment" | "road" | "safety";

export interface ForumReply {
  id: string;
  threadId: string;
  authorUserId: string;
  authorName: string;
  authorRole: ForumRole;
  body: string;
  createdAt: string | null;
}

export interface ForumThread {
  id: string;
  title: string;
  body: string;
  topic: ForumTopic;
  authorUserId: string;
  authorName: string;
  authorRole: ForumRole;
  createdAt: string | null;
  lastActivityAt: string | null;
  replyCount: number;
  replies: ForumReply[];
}

export interface CreateForumThreadPayload {
  authorUserId: string;
  authorRole: ForumRole;
  title: string;
  body: string;
  topic: ForumTopic;
}

export interface CreateForumReplyPayload {
  authorUserId: string;
  authorRole: ForumRole;
  body: string;
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

function mapDispatchFeedback(payload: unknown): DispatchFeedback {
  const row = isRecord(payload) ? payload : {};

  return {
    id: readString(row.id),
    dispatchId: readString(row.dispatch_id ?? row.dispatchId),
    emergencyReportId: readNullableString(row.emergency_report_id ?? row.emergencyReportId),
    reviewerUserId: readString(row.reviewer_user_id ?? row.reviewerUserId),
    reviewerName: readString(row.reviewer_name ?? row.reviewerName),
    reviewerRole: readDispatchFeedbackRole(row.reviewer_role ?? row.reviewerRole),
    revieweeUserId: readString(row.reviewee_user_id ?? row.revieweeUserId),
    revieweeName: readString(row.reviewee_name ?? row.revieweeName),
    revieweeRole: readDispatchFeedbackRole(row.reviewee_role ?? row.revieweeRole),
    overallRating: Number(row.overall_rating ?? row.overallRating ?? 0),
    categoryRatings: isRecord(row.category_ratings ?? row.categoryRatings)
      ? ((row.category_ratings ?? row.categoryRatings) as Record<string, number>)
      : {},
    paidCorrectAmount:
      typeof (row.paid_correct_amount ?? row.paidCorrectAmount) === "boolean"
        ? Boolean(row.paid_correct_amount ?? row.paidCorrectAmount)
        : null,
    comment: readString(row.comment),
    submittedAt: readNullableString(row.submitted_at ?? row.submittedAt),
  };
}

function mapDispatchHistoryEntry(payload: unknown): DispatchHistoryEntry {
  const row = isRecord(payload) ? payload : {};

  return {
    id: readString(row.id),
    dispatchId: readString(row.dispatchId ?? row.dispatch_id),
    emergencyReportId: readNullableString(row.emergencyReportId ?? row.emergency_report_id),
    dispatchStatus: readString(row.dispatchStatus ?? row.dispatch_status),
    completedAt: readNullableString(row.completedAt ?? row.completed_at),
    counterpartName: readString(row.counterpartName ?? row.counterpart_name),
    counterpartRole: readDispatchFeedbackRole(row.counterpartRole ?? row.counterpart_role),
    locationLabel: readString(row.locationLabel ?? row.location_label),
    issueSummary: readString(row.issueSummary ?? row.issue_summary),
    serviceLabel: readString(row.serviceLabel ?? row.service_label),
    dispatch: isRecord(row.dispatch) ? {
      id: readString(row.dispatch.id),
      emergencyReportId: readString(row.dispatch.emergencyReportId ?? row.dispatch.emergency_report_id),
      agentUserId: readNullableString(row.dispatch.agentUserId ?? row.dispatch.agent_user_id),
      repairShopId: readNullableString(row.dispatch.repairShopId ?? row.dispatch.repair_shop_id),
      dispatchStatus: readString(row.dispatch.dispatchStatus ?? row.dispatch.dispatch_status),
      assignedAt: readString(row.dispatch.assignedAt ?? row.dispatch.assigned_at),
      acceptedAt: readNullableString(row.dispatch.acceptedAt ?? row.dispatch.accepted_at),
      arrivedAt: readNullableString(row.dispatch.arrivedAt ?? row.dispatch.arrived_at),
      completedAt: readNullableString(row.dispatch.completedAt ?? row.dispatch.completed_at),
      motorist: {
        id: readString(row.dispatch.motorist?.id),
        fullName: readString(row.dispatch.motorist?.fullName ?? row.dispatch.motorist?.full_name),
        phone: readString(row.dispatch.motorist?.phone),
        latitude: parseFloat(readString(row.dispatch.motorist?.latitude, "0")),
        longitude: parseFloat(readString(row.dispatch.motorist?.longitude, "0")),
        locationLabel: readString(row.dispatch.motorist?.locationLabel ?? row.dispatch.motorist?.location_label),
      },
      agent: isRecord(row.dispatch.agent) ? {
        id: readString(row.dispatch.agent.id),
        fullName: readString(row.dispatch.agent.fullName ?? row.dispatch.agent.full_name),
        phone: readString(row.dispatch.agent.phone),
        businessName: readString(row.dispatch.agent.businessName ?? row.dispatch.agent.business_name),
        currentLatitude:
          row.dispatch.agent.currentLatitude != null
            ? parseFloat(readString(row.dispatch.agent.currentLatitude))
            : null,
        currentLongitude:
          row.dispatch.agent.currentLongitude != null
            ? parseFloat(readString(row.dispatch.agent.currentLongitude))
            : null,
      } : null,
    } : null,
    viewerFeedback: row.viewerFeedback ? mapDispatchFeedback(row.viewerFeedback) : null,
    counterpartFeedback: row.counterpartFeedback ? mapDispatchFeedback(row.counterpartFeedback) : null,
  };
}

function readForumRole(value: unknown): ForumRole {
  if (value === "agent" || value === "community") {
    return value;
  }

  return "motorist";
}

function readForumTopic(value: unknown): ForumTopic {
  if (
    value === "agent" ||
    value === "motorist" ||
    value === "payment" ||
    value === "road" ||
    value === "safety"
  ) {
    return value;
  }

  return "general";
}

function mapForumReply(payload: unknown): ForumReply {
  const row = isRecord(payload) ? payload : {};

  return {
    id: readString(row.id),
    threadId: readString(row.threadId ?? row.thread_id),
    authorUserId: readString(row.authorUserId ?? row.author_user_id),
    authorName: readString(row.authorName ?? row.author_name),
    authorRole: readForumRole(row.authorRole ?? row.author_role),
    body: readString(row.body),
    createdAt: readNullableString(row.createdAt ?? row.created_at),
  };
}

function mapForumThread(payload: unknown): ForumThread {
  const row = isRecord(payload) ? payload : {};
  const repliesPayload = Array.isArray(row.replies) ? row.replies : [];

  return {
    id: readString(row.id),
    title: readString(row.title),
    body: readString(row.body),
    topic: readForumTopic(row.topic),
    authorUserId: readString(row.authorUserId ?? row.author_user_id),
    authorName: readString(row.authorName ?? row.author_name),
    authorRole: readForumRole(row.authorRole ?? row.author_role),
    createdAt: readNullableString(row.createdAt ?? row.created_at),
    lastActivityAt: readNullableString(row.lastActivityAt ?? row.last_activity_at),
    replyCount: Number(row.replyCount ?? row.reply_count ?? repliesPayload.length ?? 0),
    replies: repliesPayload.map(mapForumReply),
  };
}

function mapSubscriptionPayment(payload: unknown): SubscriptionPayment {
  const row = isRecord(payload) ? payload : {};

  return {
    id: readString(row.id),
    userId: readString(row.userId ?? row.user_id),
    payerName: readString(row.payerName ?? row.payer_name),
    payerPhone: readString(row.payerPhone ?? row.payer_phone),
    subscriptionPlan:
      row.subscriptionPlan === "monthly" ||
      row.subscriptionPlan === "six_months" ||
      row.subscriptionPlan === "annual"
        ? row.subscriptionPlan
        : null,
    amount: Number(row.amount ?? 0),
    referenceNote: readString(row.referenceNote ?? row.reference_note),
    status:
      row.status === "confirmed" || row.status === "rejected"
        ? row.status
        : "pending",
    submittedAt: readNullableString(row.submittedAt ?? row.submitted_at),
    reviewedAt: readNullableString(row.reviewedAt ?? row.reviewed_at),
  };
}

function mapCommunityProfile(payload: unknown): CommunityProfile {
  const row = isRecord(payload) ? payload : {};

  return {
    id: readString(row.id),
    fullName: readString(row.fullName ?? row.full_name),
    role: "community",
    communityCoins: Number(row.communityCoins ?? row.community_coin_balance ?? 0),
    communityLifetimeCoins: Number(row.communityLifetimeCoins ?? row.community_lifetime_coins ?? 0),
    lastCommunityRewardAt: readNullableString(
      row.lastCommunityRewardAt ?? row.community_last_coin_activity_at,
    ),
    lastCommunityVisitRewardAt: readNullableString(
      row.lastCommunityVisitRewardAt ?? row.community_last_visit_reward_at,
    ),
    communityCoinLockUntil: readNullableString(
      row.communityCoinLockUntil ?? row.community_coin_lock_until,
    ),
  };
}

function mapCommunityRedemption(payload: unknown): CommunityRedemption {
  const row = isRecord(payload) ? payload : {};

  return {
    id: readString(row.id),
    userId: readString(row.userId ?? row.user_id),
    userName: readString(row.userName ?? row.user_name),
    userPhone: readString(row.userPhone ?? row.user_phone),
    rewardId: readString(row.rewardId ?? row.reward_id),
    rewardTitle: readString(row.rewardTitle ?? row.reward_title),
    cashValue: Number(row.cashValue ?? row.cash_value ?? 0),
    coinsRequired: Number(row.coinsRequired ?? row.coins_required ?? 0),
    coinsSpent: Number(row.coinsSpent ?? row.coins_spent ?? 0),
    gcashName: readString(row.gcashName ?? row.gcash_name),
    gcashNumber: readString(row.gcashNumber ?? row.gcash_number),
    status:
      row.status === "paid" || row.status === "rejected"
        ? row.status
        : "pending",
    submittedAt: readNullableString(row.submittedAt ?? row.submitted_at),
    reviewedAt: readNullableString(row.reviewedAt ?? row.reviewed_at),
  };
}

export async function fetchDispatchFeedback(
  dispatchId: string,
  reviewerUserId: string,
  reviewerRole: DispatchFeedbackRole,
): Promise<DispatchFeedback | null> {
  const query = new URLSearchParams({
    reviewerUserId,
    reviewerRole,
  });

  const payload = await apiRequest<unknown>(
    `/dispatches/${dispatchId}/feedback?${query.toString()}`,
  );

  if (!payload) {
    return null;
  }

  return mapDispatchFeedback(payload);
}

export async function submitDispatchFeedback(
  dispatchId: string,
  payload: DispatchFeedbackPayload,
): Promise<DispatchFeedback> {
  const response = await apiRequest<unknown>(`/dispatches/${dispatchId}/feedback`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return mapDispatchFeedback(response);
}

export async function fetchDispatchFeedbackThread(
  dispatchId: string,
  viewerUserId: string,
  viewerRole: DispatchFeedbackRole,
): Promise<DispatchFeedbackThread> {
  const query = new URLSearchParams({
    viewerUserId,
    viewerRole,
  });

  const payload = await apiRequest<unknown>(
    `/dispatches/${dispatchId}/feedback/all?${query.toString()}`,
  );
  const row = isRecord(payload) ? payload : {};
  const feedbackPayload = Array.isArray(row.feedback) ? row.feedback : [];

  return {
    dispatchId: readString(row.dispatchId, dispatchId),
    dispatchStatus: readString(row.dispatchStatus),
    feedback: feedbackPayload.map(mapDispatchFeedback),
  };
}

export async function fetchFeedbackHistory(
  userId: string,
  role: DispatchFeedbackRole,
): Promise<DispatchFeedback[]> {
  const query = new URLSearchParams({
    userId,
    role,
  });

  const payload = await apiRequest<unknown>(`/feedback/history?${query.toString()}`);
  return Array.isArray(payload) ? payload.map(mapDispatchFeedback) : [];
}

export async function fetchDispatchHistory(
  userId: string,
  role: DispatchFeedbackRole,
): Promise<DispatchHistoryEntry[]> {
  const query = new URLSearchParams({
    userId,
    role,
  });

  const payload = await apiRequest<unknown>(`/dispatches/history?${query.toString()}`);
  return Array.isArray(payload) ? payload.map(mapDispatchHistoryEntry) : [];
}

export async function fetchForumThreads(): Promise<ForumThread[]> {
  const payload = await apiRequest<unknown>("/forum/threads");
  return Array.isArray(payload) ? payload.map(mapForumThread) : [];
}

export async function createForumThread(payload: CreateForumThreadPayload): Promise<ForumThread> {
  const response = await apiRequest<unknown>("/forum/threads", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return mapForumThread(response);
}

export async function createForumReply(
  threadId: string,
  payload: CreateForumReplyPayload,
): Promise<ForumReply> {
  const response = await apiRequest<unknown>(`/forum/threads/${threadId}/replies`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return mapForumReply(response);
}

export async function fetchCommunityProfile(userId: string): Promise<CommunityProfile> {
  const payload = await apiRequest<unknown>(`/community/profile/${userId}`);
  return mapCommunityProfile(payload);
}

export async function awardCommunityForumVisit(userId: string): Promise<{
  awarded: boolean;
  amount: number;
  profile: CommunityProfile;
}> {
  const payload = await apiRequest<unknown>("/community/rewards/forum-visit", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  const row = isRecord(payload) ? payload : {};

  return {
    awarded: Boolean(row.awarded),
    amount: Number(row.amount ?? 0),
    profile: mapCommunityProfile(row.profile),
  };
}

export async function fetchCommunityRewardOptions(): Promise<CommunityRewardOption[]> {
  const payload = await apiRequest<unknown>("/community/rewards/options");
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((item) => {
    const row = isRecord(item) ? item : {};
    return {
      id: readString(row.id),
      title: readString(row.title),
      coinsRequired: Number(row.coinsRequired ?? row.coins_required ?? 0),
      cashValue: Number(row.cashValue ?? row.cash_value ?? 0),
    };
  });
}

export async function fetchCommunityRedemptions(): Promise<CommunityRedemption[]> {
  const payload = await apiRequest<unknown>("/community/redemptions");
  return Array.isArray(payload) ? payload.map(mapCommunityRedemption) : [];
}

export async function createCommunityRedemption(payload: {
  userId: string;
  rewardId: string;
  gcashName: string;
  gcashNumber: string;
}): Promise<{ redemption: CommunityRedemption; profile: CommunityProfile | null }> {
  const response = await apiRequest<unknown>("/community/redemptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const row = isRecord(response) ? response : {};

  return {
    redemption: mapCommunityRedemption(row),
    profile: row.profile ? mapCommunityProfile(row.profile) : null,
  };
}

export async function updateCommunityRedemptionStatus(
  redemptionId: string,
  status: "paid" | "rejected",
): Promise<CommunityRedemption> {
  const payload = await apiRequest<unknown>(`/community/redemptions/${redemptionId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  return mapCommunityRedemption(payload);
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

export interface AvailableAgent {
  id: string;
  businessName: string;
  phone: string;
  currentLatitude: number;
  currentLongitude: number;
  isAvailable: boolean;
  verificationStatus: string;
}

export async function fetchAvailableAgents(): Promise<AvailableAgent[]> {
  const payload = await apiRequest<unknown>("/agents/available");
  return Array.isArray(payload) ? payload.map(agent => {
    const row = isRecord(agent) ? agent : {};
    return {
      id: readString(row.id),
      businessName: readString(row.businessName ?? row.business_name),
      phone: readString(row.phone),
      currentLatitude: parseFloat(readString(row.currentLatitude ?? row.current_latitude, "0")),
      currentLongitude: parseFloat(readString(row.currentLongitude ?? row.current_longitude, "0")),
      isAvailable: Boolean(row.isAvailable ?? row.is_available),
      verificationStatus: readString(row.verificationStatus ?? row.verification_status),
    };
  }) : [];
}
