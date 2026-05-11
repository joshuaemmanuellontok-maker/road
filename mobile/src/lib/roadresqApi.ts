import { NativeModules, Platform } from "react-native";
import Constants from "expo-constants";

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

export type SubscriptionStatus = "active" | "inactive";
export type SubscriptionPlan = "monthly" | "six_months" | "annual";

export type UserLoginInput = {
  username: string;
  password: string;
};

export type AgentApplicationInput = {
  ownerName: string;
  mobileNumber: string;
  organizationName: string;
  serviceCategory: string;
  serviceCategories?: string[];
  serviceArea: string;
  username: string;
  password: string;
  liabilityAcknowledged: boolean;
  credentialManifest: Record<string, string | null>;
  credentialFiles?: Record<string, CredentialFilePayload>;
};

export type CredentialFilePayload = {
  name: string;
  type: string;
  dataUrl: string;
};

export type EmergencyDispatchInput = {
  userId?: string;
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
  payment: {
    baseServiceAmount?: number;
    payoutTransferFee?: number;
    serviceAmount: number;
    totalAmount: number;
    commissionAmount: number;
    commissionRate: number;
    subscriptionStatus: SubscriptionStatus;
    subscriptionPlan?: SubscriptionPlan | null;
    paymentStatus?: string;
    payoutStatus?: string;
    payoutTransferredAt?: string | null;
    transferReference?: string | null;
    creditBalanceAfter?: number | null;
    paymentMethod?: string;
  } | null;
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

export type DispatchFeedbackRole = "motorist" | "agent";

export type DispatchFeedback = {
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
};

export type DispatchFeedbackPayload = {
  reviewerUserId: string;
  reviewerRole: DispatchFeedbackRole;
  overallRating: number;
  categoryRatings: Record<string, number>;
  paidCorrectAmount?: boolean | null;
  comment?: string;
};

export type DispatchFeedbackThread = {
  dispatchId: string;
  dispatchStatus: string;
  feedback: DispatchFeedback[];
};

export type DispatchHistoryEntry = {
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
  payment: {
    baseServiceAmount?: number;
    payoutTransferFee?: number;
    serviceAmount: number;
    totalAmount: number;
    commissionAmount: number;
    commissionRate: number;
    subscriptionStatus: SubscriptionStatus;
    subscriptionPlan?: SubscriptionPlan | null;
    paymentStatus?: string;
    payoutStatus?: string;
    payoutTransferredAt?: string | null;
    transferReference?: string | null;
    creditBalanceAfter?: number | null;
    paymentMethod?: string;
  } | null;
  dispatch: DispatchDetails | null;
  viewerFeedback: DispatchFeedback | null;
  counterpartFeedback: DispatchFeedback | null;
};

export type ForumRole = "motorist" | "agent" | "community";
export type ForumTopic = "general" | "agent" | "motorist" | "payment" | "road" | "safety";

export type ForumReply = {
  id: string;
  threadId: string;
  authorUserId: string;
  authorName: string;
  authorRole: ForumRole;
  body: string;
  createdAt: string | null;
};

export type ForumThread = {
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
};

export type CreateForumThreadInput = {
  authorUserId: string;
  authorRole: ForumRole;
  title: string;
  body: string;
  topic: ForumTopic;
};

export type CreateForumReplyInput = {
  authorUserId: string;
  authorRole: ForumRole;
  body: string;
};

export type SubscriptionPayment = {
  id: string;
  userId: string;
  payerName: string;
  payerPhone: string;
  subscriptionPlan: SubscriptionPlan | null;
  amount: number;
  referenceNote: string;
  status: "pending" | "confirmed" | "rejected";
  submittedAt: string | null;
  reviewedAt: string | null;
  creditBalance?: number;
  paymentMethod?: "soteria_credits" | "online_payment";
  paymentUrl?: string;
  reference?: string;
};

export type SoteriaCreditTopUp = {
  userId: string;
  amount: number;
  balance: number;
  status: string;
  provider?: string;
  paymentUrl?: string;
  reference?: string;
};

export type CommunityProfile = {
  id: string;
  fullName: string;
  role: "community";
  communityCoins: number;
  communityLifetimeCoins: number;
  lastCommunityRewardAt: string | null;
  lastCommunityVisitRewardAt?: string | null;
  communityCoinLockUntil?: string | null;
};

export type CommunityRewardOption = {
  id: string;
  title: string;
  coinsRequired: number;
  cashValue: number;
};

export type CommunityRedemption = {
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
};

export async function updateAgentLocation(agentId: string, location: LocationUpdate): Promise<void> {
  await apiRequest<void>(`/agents/${agentId}/location`, {
    method: "PUT",
    body: JSON.stringify(location),
  });
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

function mapForumReply(payload: any): ForumReply {
  return {
    id: String(payload?.id ?? ""),
    threadId: String(payload?.threadId ?? payload?.thread_id ?? ""),
    authorUserId: String(payload?.authorUserId ?? payload?.author_user_id ?? ""),
    authorName: String(payload?.authorName ?? payload?.author_name ?? ""),
    authorRole: readForumRole(payload?.authorRole ?? payload?.author_role),
    body: String(payload?.body ?? ""),
    createdAt:
      payload?.createdAt != null || payload?.created_at != null
        ? String(payload?.createdAt ?? payload?.created_at)
        : null,
  };
}

function mapForumThread(payload: any): ForumThread {
  const replies = Array.isArray(payload?.replies) ? payload.replies.map(mapForumReply) : [];

  return {
    id: String(payload?.id ?? ""),
    title: String(payload?.title ?? ""),
    body: String(payload?.body ?? ""),
    topic: readForumTopic(payload?.topic),
    authorUserId: String(payload?.authorUserId ?? payload?.author_user_id ?? ""),
    authorName: String(payload?.authorName ?? payload?.author_name ?? ""),
    authorRole: readForumRole(payload?.authorRole ?? payload?.author_role),
    createdAt:
      payload?.createdAt != null || payload?.created_at != null
        ? String(payload?.createdAt ?? payload?.created_at)
        : null,
    lastActivityAt:
      payload?.lastActivityAt != null || payload?.last_activity_at != null
        ? String(payload?.lastActivityAt ?? payload?.last_activity_at)
        : null,
    replyCount: Number(payload?.replyCount ?? payload?.reply_count ?? replies.length ?? 0),
    replies,
  };
}

function mapSubscriptionPayment(payload: any): SubscriptionPayment {
  return {
    id: String(payload?.id ?? ""),
    userId: String(payload?.userId ?? payload?.user_id ?? ""),
    payerName: String(payload?.payerName ?? payload?.payer_name ?? ""),
    payerPhone: String(payload?.payerPhone ?? payload?.payer_phone ?? ""),
    subscriptionPlan:
      payload?.subscriptionPlan === "monthly" ||
      payload?.subscriptionPlan === "six_months" ||
      payload?.subscriptionPlan === "annual"
        ? payload.subscriptionPlan
        : null,
    amount: Number(payload?.amount ?? 0),
    referenceNote: String(payload?.referenceNote ?? payload?.reference_note ?? ""),
    status:
      payload?.status === "confirmed" || payload?.status === "rejected"
        ? payload.status
        : "pending",
    submittedAt:
      payload?.submittedAt != null || payload?.submitted_at != null
        ? String(payload?.submittedAt ?? payload?.submitted_at)
        : null,
    reviewedAt:
      payload?.reviewedAt != null || payload?.reviewed_at != null
        ? String(payload?.reviewedAt ?? payload?.reviewed_at)
        : null,
    creditBalance:
      payload?.creditBalance != null || payload?.credit_balance != null
        ? Number(payload?.creditBalance ?? payload?.credit_balance)
        : undefined,
    paymentMethod:
      payload?.paymentMethod === "online_payment" || payload?.payment_method === "online_payment"
        ? "online_payment"
        : payload?.paymentMethod === "soteria_credits" || payload?.payment_method === "soteria_credits"
          ? "soteria_credits"
          : undefined,
    paymentUrl:
      payload?.paymentUrl != null || payload?.payment_url != null
        ? String(payload?.paymentUrl ?? payload?.payment_url)
        : undefined,
    reference: payload?.reference != null ? String(payload.reference) : undefined,
  };
}

function mapCommunityProfile(payload: any): CommunityProfile {
  return {
    id: String(payload?.id ?? ""),
    fullName: String(payload?.fullName ?? payload?.full_name ?? ""),
    role: "community",
    communityCoins: Number(payload?.communityCoins ?? payload?.community_coin_balance ?? 0),
    communityLifetimeCoins: Number(payload?.communityLifetimeCoins ?? payload?.community_lifetime_coins ?? 0),
    lastCommunityRewardAt:
      payload?.lastCommunityRewardAt != null || payload?.community_last_coin_activity_at != null
        ? String(payload?.lastCommunityRewardAt ?? payload?.community_last_coin_activity_at)
        : null,
    lastCommunityVisitRewardAt:
      payload?.lastCommunityVisitRewardAt != null || payload?.community_last_visit_reward_at != null
        ? String(payload?.lastCommunityVisitRewardAt ?? payload?.community_last_visit_reward_at)
        : null,
    communityCoinLockUntil:
      payload?.communityCoinLockUntil != null || payload?.community_coin_lock_until != null
        ? String(payload?.communityCoinLockUntil ?? payload?.community_coin_lock_until)
        : null,
  };
}

function mapCommunityRedemption(payload: any): CommunityRedemption {
  return {
    id: String(payload?.id ?? ""),
    userId: String(payload?.userId ?? payload?.user_id ?? ""),
    userName: String(payload?.userName ?? payload?.user_name ?? ""),
    userPhone: String(payload?.userPhone ?? payload?.user_phone ?? ""),
    rewardId: String(payload?.rewardId ?? payload?.reward_id ?? ""),
    rewardTitle: String(payload?.rewardTitle ?? payload?.reward_title ?? ""),
    cashValue: Number(payload?.cashValue ?? payload?.cash_value ?? 0),
    coinsRequired: Number(payload?.coinsRequired ?? payload?.coins_required ?? 0),
    coinsSpent: Number(payload?.coinsSpent ?? payload?.coins_spent ?? 0),
    gcashName: String(payload?.gcashName ?? payload?.gcash_name ?? ""),
    gcashNumber: String(payload?.gcashNumber ?? payload?.gcash_number ?? ""),
    status:
      payload?.status === "paid" || payload?.status === "rejected"
        ? payload.status
        : "pending",
    submittedAt:
      payload?.submittedAt != null || payload?.submitted_at != null
        ? String(payload?.submittedAt ?? payload?.submitted_at)
        : null,
    reviewedAt:
      payload?.reviewedAt != null || payload?.reviewed_at != null
        ? String(payload?.reviewedAt ?? payload?.reviewed_at)
        : null,
  };
}

export function updateAgentAvailability(agentId: string, isAvailable: boolean): Promise<void> {
  return apiRequest<void>(`/agents/${agentId}/availability`, {
    method: "PUT",
    body: JSON.stringify({ isAvailable }),
  });
}
export async function fetchDispatchDetails(dispatchId: string): Promise<DispatchDetails> {
  const payload = await apiRequest<any>(`/dispatches/${dispatchId}`);

  return {
    id: String(payload?.id ?? ""),
    emergencyReportId: String(payload?.emergencyReportId ?? payload?.emergency_report_id ?? ""),
    agentUserId:
      payload?.agentUserId != null || payload?.agent_user_id != null
        ? String(payload?.agentUserId ?? payload?.agent_user_id)
        : null,
    repairShopId:
      payload?.repairShopId != null || payload?.repair_shop_id != null
        ? String(payload?.repairShopId ?? payload?.repair_shop_id)
        : null,
    dispatchStatus: String(payload?.dispatchStatus ?? payload?.dispatch_status ?? ""),
    assignedAt: String(payload?.assignedAt ?? payload?.assigned_at ?? ""),
    acceptedAt:
      payload?.acceptedAt != null || payload?.accepted_at != null
        ? String(payload?.acceptedAt ?? payload?.accepted_at)
        : null,
    arrivedAt:
      payload?.arrivedAt != null || payload?.arrived_at != null
        ? String(payload?.arrivedAt ?? payload?.arrived_at)
        : null,
    completedAt:
      payload?.completedAt != null || payload?.completed_at != null
        ? String(payload?.completedAt ?? payload?.completed_at)
        : null,
    payment: payload?.payment
        ? {
          baseServiceAmount: Number(payload.payment.baseServiceAmount ?? payload.payment.base_service_amount ?? payload.payment.totalAmount ?? payload.payment.total_amount ?? 0),
          payoutTransferFee: Number(payload.payment.payoutTransferFee ?? payload.payment.payout_transfer_fee ?? 0),
          serviceAmount: Number(payload.payment.serviceAmount ?? payload.payment.service_amount ?? 0),
          totalAmount: Number(payload.payment.totalAmount ?? payload.payment.total_amount ?? 0),
          commissionAmount: Number(payload.payment.commissionAmount ?? payload.payment.commission_amount ?? 0),
          commissionRate: Number(payload.payment.commissionRate ?? payload.payment.commission_rate ?? 0),
          subscriptionStatus: payload.payment.subscriptionStatus === "active" ? "active" : "inactive",
          subscriptionPlan:
            payload.payment.subscriptionPlan === "monthly" ||
            payload.payment.subscriptionPlan === "six_months" ||
            payload.payment.subscriptionPlan === "annual"
              ? payload.payment.subscriptionPlan
              : null,
          paymentStatus: String(payload.payment.paymentStatus ?? payload.payment.payment_status ?? "system_received"),
          payoutStatus: String(payload.payment.payoutStatus ?? payload.payment.payout_status ?? "auto_transferred"),
          payoutTransferredAt:
            payload.payment.payoutTransferredAt != null || payload.payment.payout_transferred_at != null
              ? String(payload.payment.payoutTransferredAt ?? payload.payment.payout_transferred_at)
              : null,
          transferReference:
            payload.payment.transferReference != null || payload.payment.transfer_reference != null
              ? String(payload.payment.transferReference ?? payload.payment.transfer_reference)
              : null,
          creditBalanceAfter:
            payload.payment.creditBalanceAfter != null || payload.payment.credit_balance_after != null
              ? Number(payload.payment.creditBalanceAfter ?? payload.payment.credit_balance_after)
              : null,
          paymentMethod: String(payload.payment.paymentMethod ?? payload.payment.payment_method ?? "soteria_credits"),
        }
      : null,
    motorist: {
      id: String(payload?.motorist?.id ?? payload?.motorist_id ?? ""),
      fullName: String(payload?.motorist?.fullName ?? payload?.motorist?.full_name ?? payload?.motorist_name ?? ""),
      phone: String(payload?.motorist?.phone ?? payload?.motorist_phone ?? ""),
      latitude: Number(payload?.motorist?.latitude ?? payload?.motorist_latitude ?? 0),
      longitude: Number(payload?.motorist?.longitude ?? payload?.motorist_longitude ?? 0),
      locationLabel: String(payload?.motorist?.locationLabel ?? payload?.motorist?.location_label ?? payload?.location_label ?? ""),
      issueSummary: String(payload?.motorist?.issueSummary ?? payload?.motorist?.issue_summary ?? ""),
      symptoms: Array.isArray(payload?.motorist?.symptoms)
        ? payload.motorist.symptoms.map((item: unknown) => String(item))
        : [],
    },
    agent: payload?.agent
      ? {
          id: String(payload.agent.id ?? ""),
          fullName: String(payload.agent.fullName ?? payload.agent.full_name ?? ""),
          phone: String(payload.agent.phone ?? ""),
          businessName: String(payload.agent.businessName ?? payload.agent.business_name ?? ""),
          currentLatitude: payload.agent.currentLatitude != null ? Number(payload.agent.currentLatitude) : null,
          currentLongitude: payload.agent.currentLongitude != null ? Number(payload.agent.currentLongitude) : null,
        }
      : null,
  };
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
  phone?: string;
  role: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPlan?: SubscriptionPlan | null;
  subscriptionActivatedAt?: string | null;
  subscriptionExpiresAt?: string | null;
  soteriaCreditBalance?: number;
  communityCoins?: number;
  communityLifetimeCoins?: number;
  lastCommunityRewardAt?: string | null;
};

export type AgentLoginResponse = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  balanceProofStatus?: string;
  balanceProofExpiresAt?: string | null;
  walletReadinessTier?: "tier_1" | "tier_2" | null;
};

export type AgentBalanceProofStatus = {
  hasProof: boolean;
  isApproved: boolean;
  isExpired: boolean;
  canGoOnline: boolean;
  cashAssistEligible: boolean;
  cashAssistEnabled: boolean;
  cashAssistReady: boolean;
  status: string;
  tier: "tier_1" | "tier_2" | null;
  tierLabel: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  approvedBy: string | null;
  proofUrl: string | null;
  rejectionReason?: string;
};

export type AgentPaymentProfile = {
  userId: string;
  fullName: string;
  phone: string;
  businessName: string;
  organizationName: string;
  serviceArea: string;
  gcashName: string;
  gcashNumber: string;
  payoutNotes: string;
  liabilityAcknowledged: boolean;
  balanceProof: AgentBalanceProofStatus;
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
const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (typeof Constants.expoConfig?.extra?.apiBaseUrl === "string"
    ? Constants.expoConfig.extra.apiBaseUrl
    : null);

export const apiBaseUrl =
  configuredApiBaseUrl?.replace(/\/$/, "") ??
  (detectedHost
    ? `http://${detectedHost}:4000/api`
    : `http://${Platform.OS === "android" ? "10.0.2.2" : "localhost"}:4000/api`
  );

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new Error(`Cannot connect to the RoadResQ API at ${apiBaseUrl}. ${message}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText || `Request failed with status ${response.status}`;

    try {
      const payload = JSON.parse(errorText);
      if (typeof payload?.error === "string") {
        message = payload.error;
      }
    } catch {
      // Keep the raw response text when the server did not return JSON.
    }

    throw new Error(message);
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

export function registerCommunityProfile(input: UserRegistrationInput) {
  return apiRequest<{ id: string }>("/community/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchForumThreads(): Promise<ForumThread[]> {
  const payload = await apiRequest<any[]>("/forum/threads");
  return Array.isArray(payload) ? payload.map(mapForumThread) : [];
}

export async function createForumThread(input: CreateForumThreadInput): Promise<ForumThread> {
  const payload = await apiRequest<any>("/forum/threads", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return mapForumThread(payload);
}

export async function createForumReply(
  threadId: string,
  input: CreateForumReplyInput,
): Promise<ForumReply> {
  const payload = await apiRequest<any>(`/forum/threads/${threadId}/replies`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  return mapForumReply(payload);
}

export async function createSubscriptionPayment(input: {
  userId: string;
  subscriptionPlan: SubscriptionPlan;
  referenceNote?: string;
  paymentMethod?: "soteria_credits" | "online_payment";
}): Promise<SubscriptionPayment> {
  const payload = await apiRequest<any>("/subscription-payments", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return mapSubscriptionPayment(payload);
}

export async function fetchSoteriaCredits(userId: string): Promise<{ userId: string; balance: number }> {
  const payload = await apiRequest<any>(`/users/${userId}/credits`);
  return {
    userId: String(payload?.userId ?? payload?.user_id ?? userId),
    balance: Number(payload?.balance ?? 0),
  };
}

export async function topUpSoteriaCredits(
  userId: string,
  amount: number,
): Promise<SoteriaCreditTopUp> {
  const payload = await apiRequest<any>(`/users/${userId}/credits/topups`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });

  return {
    userId: String(payload?.userId ?? payload?.user_id ?? userId),
    amount: Number(payload?.amount ?? amount),
    balance: Number(payload?.balance ?? 0),
    status: String(payload?.status ?? "confirmed"),
    provider: payload?.provider != null ? String(payload.provider) : undefined,
    paymentUrl: payload?.paymentUrl != null || payload?.payment_url != null
      ? String(payload?.paymentUrl ?? payload?.payment_url)
      : undefined,
    reference: payload?.reference != null ? String(payload.reference) : undefined,
  };
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

function mapAgentPaymentProfile(payload: any): AgentPaymentProfile {
  return {
    userId: String(payload?.userId ?? payload?.user_id ?? ""),
    fullName: String(payload?.fullName ?? payload?.full_name ?? ""),
    phone: String(payload?.phone ?? ""),
    businessName: String(payload?.businessName ?? payload?.business_name ?? ""),
    organizationName: String(payload?.organizationName ?? payload?.organization_name ?? ""),
    serviceArea: String(payload?.serviceArea ?? payload?.service_area ?? ""),
    gcashName: String(payload?.gcashName ?? payload?.gcash_name ?? ""),
    gcashNumber: String(payload?.gcashNumber ?? payload?.gcash_number ?? ""),
    payoutNotes: String(payload?.payoutNotes ?? payload?.payout_notes ?? ""),
    liabilityAcknowledged: Boolean(payload?.liabilityAcknowledged ?? payload?.liability_acknowledged),
    balanceProof: {
      hasProof: Boolean(payload?.balanceProof?.hasProof),
      isApproved: Boolean(payload?.balanceProof?.isApproved),
      isExpired: Boolean(payload?.balanceProof?.isExpired),
      canGoOnline: Boolean(payload?.balanceProof?.canGoOnline),
      cashAssistEligible: Boolean(payload?.balanceProof?.cashAssistEligible),
      cashAssistEnabled: Boolean(payload?.balanceProof?.cashAssistEnabled),
      cashAssistReady: Boolean(payload?.balanceProof?.cashAssistReady),
      status: String(payload?.balanceProof?.status ?? "missing"),
      tier:
        payload?.balanceProof?.tier === "tier_1" || payload?.balanceProof?.tier === "tier_2"
          ? payload.balanceProof.tier
          : null,
      tierLabel: String(payload?.balanceProof?.tierLabel ?? "Not verified"),
      submittedAt:
        payload?.balanceProof?.submittedAt != null ? String(payload.balanceProof.submittedAt) : null,
      reviewedAt:
        payload?.balanceProof?.reviewedAt != null ? String(payload.balanceProof.reviewedAt) : null,
      expiresAt:
        payload?.balanceProof?.expiresAt != null ? String(payload.balanceProof.expiresAt) : null,
      approvedBy:
        payload?.balanceProof?.approvedBy != null ? String(payload.balanceProof.approvedBy) : null,
      proofUrl:
        payload?.balanceProof?.proofUrl != null ? String(payload.balanceProof.proofUrl) : null,
      rejectionReason:
        payload?.balanceProof?.rejectionReason != null ? String(payload.balanceProof.rejectionReason) : "",
    },
  };
}

export async function fetchAgentPaymentProfile(agentId: string): Promise<AgentPaymentProfile> {
  const payload = await apiRequest<any>(`/agents/${agentId}/profile`);
  return mapAgentPaymentProfile(payload);
}

export async function updateAgentPaymentProfile(
  agentId: string,
  input: { gcashName: string; gcashNumber: string; payoutNotes?: string },
): Promise<AgentPaymentProfile> {
  const payload = await apiRequest<any>(`/agents/${agentId}/profile/payment`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return mapAgentPaymentProfile(payload);
}

export async function updateAgentCashAssist(
  agentId: string,
  enabled: boolean,
): Promise<AgentPaymentProfile> {
  const payload = await apiRequest<any>(`/agents/${agentId}/cash-assist`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
  return mapAgentPaymentProfile(payload);
}

export async function uploadAgentBalanceProof(
  agentId: string,
  proofFile: CredentialFilePayload,
): Promise<AgentPaymentProfile> {
  const payload = await apiRequest<any>(`/agents/${agentId}/balance-proof`, {
    method: "POST",
    body: JSON.stringify({ proofFile }),
  });
  return mapAgentPaymentProfile(payload);
}

export function loginCommunity(input: UserLoginInput) {
  return apiRequest<UserLoginResponse>("/community/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchCommunityProfile(userId: string): Promise<CommunityProfile> {
  const payload = await apiRequest<any>(`/community/profile/${userId}`);
  return mapCommunityProfile(payload);
}

export async function awardCommunityForumVisit(userId: string): Promise<{
  awarded: boolean;
  amount: number;
  profile: CommunityProfile;
}> {
  const payload = await apiRequest<any>("/community/rewards/forum-visit", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

  return {
    awarded: Boolean(payload?.awarded),
    amount: Number(payload?.amount ?? 0),
    profile: mapCommunityProfile(payload?.profile),
  };
}

export async function fetchCommunityRewardOptions(): Promise<CommunityRewardOption[]> {
  const payload = await apiRequest<any[]>("/community/rewards/options");
  return Array.isArray(payload)
    ? payload.map((item) => ({
        id: String(item?.id ?? ""),
        title: String(item?.title ?? ""),
        coinsRequired: Number(item?.coinsRequired ?? item?.coins_required ?? 0),
        cashValue: Number(item?.cashValue ?? item?.cash_value ?? 0),
      }))
    : [];
}

export async function fetchCommunityRedemptions(): Promise<CommunityRedemption[]> {
  const payload = await apiRequest<any[]>("/community/redemptions");
  return Array.isArray(payload) ? payload.map(mapCommunityRedemption) : [];
}

export async function createCommunityRedemption(input: {
  userId: string;
  rewardId: string;
  gcashName: string;
  gcashNumber: string;
}): Promise<{ redemption: CommunityRedemption; profile: CommunityProfile | null }> {
  const payload = await apiRequest<any>("/community/redemptions", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return {
    redemption: mapCommunityRedemption(payload),
    profile: payload?.profile ? mapCommunityProfile(payload.profile) : null,
  };
}

export type NearbyAgent = {
  id: string;
  fullName: string;
  serviceCategory: string;
  distanceKm: number;
  services: string[];
  latitude: number;
  longitude: number;
  cashAssistReady?: boolean;
  cashAssistTier?: "tier_1" | "tier_2" | null;
  cashAssistTierLabel?: string;
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

export function completeDispatch(dispatchId: string, totalAmount: number) {
  return apiRequest<{
    success?: boolean;
    dispatch?: any;
    paymentRequired?: boolean;
    paymentUrl?: string;
    paymentMethod?: string;
    servicePaymentId?: string;
    amount?: number;
  }>(`/dispatches/${dispatchId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed", totalAmount }),
  });
}

export function createServiceOnlinePayment(dispatchId: string, totalAmount: number) {
  return apiRequest<{
    paymentRequired: boolean;
    paymentUrl?: string;
    paymentMethod?: string;
    servicePaymentId?: string;
    amount?: number;
    baseServiceAmount?: number;
    payoutTransferFee?: number;
  }>(`/dispatches/${dispatchId}/payment`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod: "online_payment" }),
  });
}

export function syncServiceOnlinePayment(dispatchId: string) {
  return apiRequest<{
    syncResult?: unknown;
    dispatch?: DispatchDetails | null;
  }>(`/dispatches/${dispatchId}/payment/sync`, {
    method: "POST",
  });
}

export function payServiceWithCredits(dispatchId: string) {
  return apiRequest<{
    id: string;
    dispatch_status: string;
    creditBalance?: number;
    dispatch?: DispatchDetails;
  }>(`/dispatches/${dispatchId}/payment`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod: "soteria_credits" }),
  });
}


function mapDispatchFeedback(payload: any): DispatchFeedback {
  return {
    id: String(payload?.id ?? ""),
    dispatchId: String(payload?.dispatch_id ?? payload?.dispatchId ?? ""),
    emergencyReportId:
      payload?.emergency_report_id != null || payload?.emergencyReportId != null
        ? String(payload?.emergency_report_id ?? payload?.emergencyReportId)
        : null,
    reviewerUserId: String(payload?.reviewer_user_id ?? payload?.reviewerUserId ?? ""),
    reviewerName: String(payload?.reviewer_name ?? payload?.reviewerName ?? ""),
    reviewerRole: String(payload?.reviewer_role ?? payload?.reviewerRole ?? "motorist") as DispatchFeedbackRole,
    revieweeUserId: String(payload?.reviewee_user_id ?? payload?.revieweeUserId ?? ""),
    revieweeName: String(payload?.reviewee_name ?? payload?.revieweeName ?? ""),
    revieweeRole: String(payload?.reviewee_role ?? payload?.revieweeRole ?? "agent") as DispatchFeedbackRole,
    overallRating: Number(payload?.overall_rating ?? payload?.overallRating ?? 0),
    categoryRatings:
      payload?.category_ratings && typeof payload.category_ratings === "object"
        ? payload.category_ratings
        : payload?.categoryRatings && typeof payload.categoryRatings === "object"
          ? payload.categoryRatings
          : {},
    paidCorrectAmount:
      typeof (payload?.paid_correct_amount ?? payload?.paidCorrectAmount) === "boolean"
        ? Boolean(payload?.paid_correct_amount ?? payload?.paidCorrectAmount)
        : null,
    comment: String(payload?.comment ?? ""),
    submittedAt:
      payload?.submitted_at != null || payload?.submittedAt != null
        ? String(payload?.submitted_at ?? payload?.submittedAt)
        : null,
  };
}

function mapDispatchHistoryEntry(payload: any): DispatchHistoryEntry {
  return {
    id: String(payload?.id ?? ""),
    dispatchId: String(payload?.dispatchId ?? payload?.dispatch_id ?? ""),
    emergencyReportId:
      payload?.emergencyReportId != null || payload?.emergency_report_id != null
        ? String(payload?.emergencyReportId ?? payload?.emergency_report_id)
        : null,
    dispatchStatus: String(payload?.dispatchStatus ?? payload?.dispatch_status ?? ""),
    completedAt:
      payload?.completedAt != null || payload?.completed_at != null
        ? String(payload?.completedAt ?? payload?.completed_at)
        : null,
    counterpartName: String(payload?.counterpartName ?? payload?.counterpart_name ?? ""),
    counterpartRole: String(payload?.counterpartRole ?? payload?.counterpart_role ?? "motorist") as DispatchFeedbackRole,
    locationLabel: String(payload?.locationLabel ?? payload?.location_label ?? ""),
    issueSummary: String(payload?.issueSummary ?? payload?.issue_summary ?? ""),
    serviceLabel: String(payload?.serviceLabel ?? payload?.service_label ?? ""),
    payment: payload?.payment
      ? {
          baseServiceAmount: Number(payload.payment.baseServiceAmount ?? payload.payment.base_service_amount ?? payload.payment.totalAmount ?? payload.payment.total_amount ?? 0),
          payoutTransferFee: Number(payload.payment.payoutTransferFee ?? payload.payment.payout_transfer_fee ?? 0),
          serviceAmount: Number(payload.payment.serviceAmount ?? payload.payment.service_amount ?? 0),
          totalAmount: Number(payload.payment.totalAmount ?? payload.payment.total_amount ?? 0),
          commissionAmount: Number(payload.payment.commissionAmount ?? payload.payment.commission_amount ?? 0),
          commissionRate: Number(payload.payment.commissionRate ?? payload.payment.commission_rate ?? 0),
          subscriptionStatus: payload.payment.subscriptionStatus === "active" ? "active" : "inactive",
          subscriptionPlan:
            payload.payment.subscriptionPlan === "monthly" ||
            payload.payment.subscriptionPlan === "six_months" ||
            payload.payment.subscriptionPlan === "annual"
              ? payload.payment.subscriptionPlan
              : null,
          paymentStatus: String(payload.payment.paymentStatus ?? payload.payment.payment_status ?? "system_received"),
          payoutStatus: String(payload.payment.payoutStatus ?? payload.payment.payout_status ?? "auto_transferred"),
          payoutTransferredAt:
            payload.payment.payoutTransferredAt != null || payload.payment.payout_transferred_at != null
              ? String(payload.payment.payoutTransferredAt ?? payload.payment.payout_transferred_at)
              : null,
          transferReference:
            payload.payment.transferReference != null || payload.payment.transfer_reference != null
              ? String(payload.payment.transferReference ?? payload.payment.transfer_reference)
              : null,
          creditBalanceAfter:
            payload.payment.creditBalanceAfter != null || payload.payment.credit_balance_after != null
              ? Number(payload.payment.creditBalanceAfter ?? payload.payment.credit_balance_after)
              : null,
          paymentMethod: String(payload.payment.paymentMethod ?? payload.payment.payment_method ?? "soteria_credits"),
        }
      : null,
    dispatch: payload?.dispatch
      ? {
          id: String(payload.dispatch.id ?? ""),
          emergencyReportId: String(payload.dispatch.emergencyReportId ?? payload.dispatch.emergency_report_id ?? ""),
          agentUserId:
            payload.dispatch.agentUserId != null || payload.dispatch.agent_user_id != null
              ? String(payload.dispatch.agentUserId ?? payload.dispatch.agent_user_id)
              : null,
          repairShopId:
            payload.dispatch.repairShopId != null || payload.dispatch.repair_shop_id != null
              ? String(payload.dispatch.repairShopId ?? payload.dispatch.repair_shop_id)
              : null,
          dispatchStatus: String(payload.dispatch.dispatchStatus ?? payload.dispatch.dispatch_status ?? ""),
          assignedAt: String(payload.dispatch.assignedAt ?? payload.dispatch.assigned_at ?? ""),
          acceptedAt:
            payload.dispatch.acceptedAt != null || payload.dispatch.accepted_at != null
              ? String(payload.dispatch.acceptedAt ?? payload.dispatch.accepted_at)
              : null,
          arrivedAt:
            payload.dispatch.arrivedAt != null || payload.dispatch.arrived_at != null
              ? String(payload.dispatch.arrivedAt ?? payload.dispatch.arrived_at)
              : null,
          completedAt:
            payload.dispatch.completedAt != null || payload.dispatch.completed_at != null
              ? String(payload.dispatch.completedAt ?? payload.dispatch.completed_at)
              : null,
          payment: payload.dispatch.payment
            ? {
                baseServiceAmount: Number(payload.dispatch.payment.baseServiceAmount ?? payload.dispatch.payment.base_service_amount ?? payload.dispatch.payment.totalAmount ?? payload.dispatch.payment.total_amount ?? 0),
                payoutTransferFee: Number(payload.dispatch.payment.payoutTransferFee ?? payload.dispatch.payment.payout_transfer_fee ?? 0),
                serviceAmount: Number(payload.dispatch.payment.serviceAmount ?? payload.dispatch.payment.service_amount ?? 0),
                totalAmount: Number(payload.dispatch.payment.totalAmount ?? payload.dispatch.payment.total_amount ?? 0),
                commissionAmount: Number(payload.dispatch.payment.commissionAmount ?? payload.dispatch.payment.commission_amount ?? 0),
                commissionRate: Number(payload.dispatch.payment.commissionRate ?? payload.dispatch.payment.commission_rate ?? 0),
                subscriptionStatus: payload.dispatch.payment.subscriptionStatus === "active" ? "active" : "inactive",
                subscriptionPlan:
                  payload.dispatch.payment.subscriptionPlan === "monthly" ||
                  payload.dispatch.payment.subscriptionPlan === "six_months" ||
                  payload.dispatch.payment.subscriptionPlan === "annual"
                    ? payload.dispatch.payment.subscriptionPlan
                    : null,
                paymentStatus: String(payload.dispatch.payment.paymentStatus ?? payload.dispatch.payment.payment_status ?? "system_received"),
                payoutStatus: String(payload.dispatch.payment.payoutStatus ?? payload.dispatch.payment.payout_status ?? "auto_transferred"),
                payoutTransferredAt:
                  payload.dispatch.payment.payoutTransferredAt != null || payload.dispatch.payment.payout_transferred_at != null
                    ? String(payload.dispatch.payment.payoutTransferredAt ?? payload.dispatch.payment.payout_transferred_at)
                    : null,
                transferReference:
                  payload.dispatch.payment.transferReference != null || payload.dispatch.payment.transfer_reference != null
                    ? String(payload.dispatch.payment.transferReference ?? payload.dispatch.payment.transfer_reference)
                    : null,
                creditBalanceAfter:
                  payload.dispatch.payment.creditBalanceAfter != null || payload.dispatch.payment.credit_balance_after != null
                    ? Number(payload.dispatch.payment.creditBalanceAfter ?? payload.dispatch.payment.credit_balance_after)
                    : null,
                paymentMethod: String(payload.dispatch.payment.paymentMethod ?? payload.dispatch.payment.payment_method ?? "soteria_credits"),
              }
            : null,
          motorist: {
            id: String(payload.dispatch.motorist?.id ?? ""),
            fullName: String(payload.dispatch.motorist?.fullName ?? payload.dispatch.motorist?.full_name ?? ""),
            phone: String(payload.dispatch.motorist?.phone ?? ""),
            latitude: Number(payload.dispatch.motorist?.latitude ?? 0),
            longitude: Number(payload.dispatch.motorist?.longitude ?? 0),
            locationLabel: String(payload.dispatch.motorist?.locationLabel ?? payload.dispatch.motorist?.location_label ?? ""),
            issueSummary: String(payload.dispatch.motorist?.issueSummary ?? payload.dispatch.motorist?.issue_summary ?? ""),
            symptoms: Array.isArray(payload.dispatch.motorist?.symptoms)
              ? payload.dispatch.motorist.symptoms.map((item: unknown) => String(item))
              : [],
          },
          agent: payload.dispatch.agent
            ? {
                id: String(payload.dispatch.agent.id ?? ""),
                fullName: String(payload.dispatch.agent.fullName ?? payload.dispatch.agent.full_name ?? ""),
                phone: String(payload.dispatch.agent.phone ?? ""),
                businessName: String(payload.dispatch.agent.businessName ?? payload.dispatch.agent.business_name ?? ""),
                currentLatitude:
                  payload.dispatch.agent.currentLatitude != null
                    ? Number(payload.dispatch.agent.currentLatitude)
                    : null,
                currentLongitude:
                  payload.dispatch.agent.currentLongitude != null
                    ? Number(payload.dispatch.agent.currentLongitude)
                    : null,
              }
            : null,
        }
      : null,
    viewerFeedback: payload?.viewerFeedback ? mapDispatchFeedback(payload.viewerFeedback) : null,
    counterpartFeedback: payload?.counterpartFeedback ? mapDispatchFeedback(payload.counterpartFeedback) : null,
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

  const payload = await apiRequest<any>(`/dispatches/${dispatchId}/feedback?${query.toString()}`);
  if (!payload) {
    return null;
  }

  return mapDispatchFeedback(payload);
}

export async function submitDispatchFeedback(
  dispatchId: string,
  payload: DispatchFeedbackPayload,
): Promise<DispatchFeedback> {
  const response = await apiRequest<any>(`/dispatches/${dispatchId}/feedback`, {
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

  const payload = await apiRequest<any>(`/dispatches/${dispatchId}/feedback/all?${query.toString()}`);

  return {
    dispatchId: String(payload?.dispatchId ?? dispatchId),
    dispatchStatus: String(payload?.dispatchStatus ?? ""),
    feedback: Array.isArray(payload?.feedback) ? payload.feedback.map(mapDispatchFeedback) : [],
  };
}

export async function fetchDispatchHistory(
  userId: string,
  role: DispatchFeedbackRole,
): Promise<DispatchHistoryEntry[]> {
  const query = new URLSearchParams({
    userId,
    role,
  });

  const payload = await apiRequest<any[]>(`/dispatches/history?${query.toString()}`);
  return Array.isArray(payload) ? payload.map(mapDispatchHistoryEntry) : [];
}

export function findNearbyAgents(latitude: number, longitude: number, serviceType?: string, userId?: string | null) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: "50",
  });

  if (serviceType) {
    params.set("serviceType", serviceType);
  }

  if (userId) {
    params.set("userId", userId);
  }

  return apiRequest<NearbyAgent[]>(`/agents/nearby?${params.toString()}`);
}
