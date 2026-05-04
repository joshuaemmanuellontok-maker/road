import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ImageBackground,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Constants from "expo-constants";
import {
  createEmergencyDispatch,
  fetchRepairShops,
  registerUserProfile,
  registerCommunityProfile,
  submitAgentApplication,
  fetchForumThreads,
  createForumThread,
  createForumReply,
  createSubscriptionPayment,
  fetchSoteriaCredits,
  topUpSoteriaCredits,
  createCommunityRedemption,
  loginUser as apiLoginUser,
  loginAgent as apiLoginAgent,
  loginCommunity as apiLoginCommunity,
  awardCommunityForumVisit,
  fetchCommunityProfile,
  fetchCommunityRewardOptions,
  fetchCommunityRedemptions,
  updateAgentLocation,
  updateAgentAvailability,
  fetchAgentDispatches,
  acceptDispatch,
  declineDispatch,
  completeDispatch,
  fetchDispatchHistory,
  findNearbyAgents,
  fetchDispatchDetails,
  getRoute,
  calculateDistance,
  calculateETA,
  type CredentialFilePayload,
  type DbRepairShop,
  type DispatchDetails,
  type DispatchHistoryEntry,
  type ForumReply,
  type ForumThread,
  type ForumTopic,
  type CommunityProfile,
  type CommunityRewardOption,
  type CommunityRedemption,
  type AgentPaymentProfile,
  type SubscriptionPlan,
  type SubscriptionPayment,
  fetchAgentPaymentProfile,
  updateAgentPaymentProfile,
} from "./src/lib/roadresqApi";
import { SERVICE_CATEGORY_LABELS, type ServiceCategory } from "../packages/shared/src";
import { MotorietTrackingScreen } from "./src/components/MotorietTrackingScreen";
import { AgentTrackingScreen } from "./src/components/AgentTrackingScreen";
import { LeafletMap, type LeafletMarker, type LeafletRoutePoint } from "./src/components/LeafletMap";

let notificationsModulePromise: Promise<typeof import("expo-notifications") | null> | null = null;

const getNotificationsModule = async () => {
  if (Constants.appOwnership === "expo") {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications")
      .then((module) => {
        module.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        return module;
      })
      .catch((error) => {
        console.warn("Notifications module unavailable in this environment:", error);
        return null;
      });
  }

  return notificationsModulePromise;
};

// Notification functions
const requestNotificationPermissions = async () => {
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      return false;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.warn("Notification permissions unavailable in this environment:", error);
    return false;
  }
};

const sendLocalNotification = async (title: string, body: string) => {
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.warn("Local notifications unavailable in this environment:", error);
  }
};

type Screen = "role" | "user-login" | "user-register" | "user-triage" | "user-finding-agent" | "agent-login" | "agent-register" | "community-login" | "community-register" | "user-app" | "agent-app" | "community-app";
type UserTab = "subscription" | "explore" | "emergency" | "tracking" | "forum";
type AgentTab = "requests" | "navigation" | "stats" | "profile" | "forum";
type CommunityTab = "rewards" | "forum";
type Coords = { latitude: number; longitude: number };
type Errors = { identity?: string; password?: string };
type Shop = {
  id: string;
  name: string;
  category: ServiceCategory;
  rating: number;
  distanceKm: number;
  address: string;
  responseTime: string;
  openNow: boolean;
  coord: Coords;
  services: string[];
};
type AgentMatch = {
  id: string;
  name: string;
  category: ServiceCategory;
  rating: number;
  distanceKm: number;
  services: string[];
  cashAssistReady?: boolean;
};
type Request = {
  id: string;
  motorist: string;
  phone: string;
  location: string;
  distance: string;
  vehicleType: string;
  fee: string;
  priority: "high" | "medium";
  symptoms: string[];
};
type RegisterForm = {
  fullName: string;
  mobileNumber: string;
  username: string;
  password: string;
  confirmPassword: string;
};
type AgentRegisterForm = {
  ownerName: string;
  mobileNumber: string;
  organizationName: string;
  serviceCategories: string[];
  serviceArea: string;
  username: string;
  password: string;
  liabilityAcknowledged: boolean;
};
type SelectedCredentialFile = {
  name: string;
  uri: string;
  mimeType: string;
};
type ForumReplyDrafts = Record<string, string>;
type CredentialFiles = {
  driversLicense: SelectedCredentialFile | null;
  vehicleRegistration: SelectedCredentialFile | null;
  insurance: SelectedCredentialFile | null;
  nbiClearance: SelectedCredentialFile | null;
};

const mechanicalSymptoms = [
  "Flat tire",
  "Dead battery",
  "Engine won't start",
  "Overheating",
  "Strange noise",
  "Brake problem",
  "Fuel issue",
  "Transmission problem",
];

const baseLocation: Coords = { latitude: 14.4436, longitude: 121.4321 };
const shops: Shop[] = [
  { id: "1", name: "Siniloan Roadside Auto Care", category: "mechanical", rating: 4.8, distanceKm: 1.4, address: "Siniloan, Laguna", responseTime: "~15 min", openNow: true, coord: { latitude: 14.4211, longitude: 121.4461 }, services: ["Mechanical", "Engine repair", "Brake service", "Diagnostic scan"] },
  { id: "2", name: "Famy Tire and Vulcanizing Center", category: "vulcanizing", rating: 4.7, distanceKm: 2.1, address: "Famy, Laguna", responseTime: "~20 min", openNow: true, coord: { latitude: 14.4379, longitude: 121.4486 }, services: ["Vulcanizing", "Tire repair", "Wheel balancing", "Patch and inflate"] },
  { id: "3", name: "Santa Maria Laguna Towing and Auto Electric", category: "towing", rating: 4.6, distanceKm: 3.5, address: "Santa Maria, Laguna", responseTime: "~25 min", openNow: true, coord: { latitude: 14.4719, longitude: 121.4281 }, services: ["Mechanical", "Vulcanizing", "Towing", "Electrical", "Battery service", "General roadside assistance"] },
];
const requestsSeed: Request[] = [
  { id: "REQ-001", motorist: "Maria Santos", phone: "+63 917 123 4567", location: "San Pablo City - National Highway", distance: "1.2 km", vehicleType: "Sedan", fee: "PHP 350", priority: "high", symptoms: ["Flat tire"] },
  { id: "REQ-002", motorist: "Jose Garcia", phone: "+63 918 765 4321", location: "Bay, Laguna - Crossing Road", distance: "3.5 km", vehicleType: "SUV", fee: "PHP 500", priority: "medium", symptoms: ["Dead battery", "Engine won't start"] },
];
const historySeed = [
  "Flat tire repair - Ana Reyes - PHP 350",
  "Battery replacement - Carlos Mendoza - PHP 800",
  "Vulcanizing - Linda Cruz - PHP 250",
];
const categories = Object.entries(SERVICE_CATEGORY_LABELS) as [ServiceCategory, string][];

function shopOffersCategory(shop: Shop, category: ServiceCategory) {
  const selectedLabel = SERVICE_CATEGORY_LABELS[category].toLowerCase();
  const serviceTokens = shop.services.map((service) => service.toLowerCase());

  return (
    shop.category === category ||
    serviceTokens.some((service) =>
      service === selectedLabel ||
      service.includes(selectedLabel) ||
      service.includes(category),
    )
  );
}

const forumTopics: Array<{ value: ForumTopic; label: string }> = [
  { value: "general", label: "General" },
  { value: "agent", label: "Responders" },
  { value: "motorist", label: "Motorists" },
  { value: "payment", label: "Payments" },
  { value: "road", label: "Roads" },
  { value: "safety", label: "Safety" },
];

const forumTopicLabels: Record<ForumTopic, string> = {
  general: "General",
  agent: "Responder Concern",
  motorist: "Motorist Concern",
  payment: "Payment",
  road: "Road Condition",
  safety: "Safety",
};

const subscriptionOffers: Array<{
  value: SubscriptionPlan;
  label: string;
  price: string;
  badge: string;
  accessLevel: string;
  tagline: string;
  description: string;
  highlights: string[];
  features: string[];
  activeSummary: string;
}> = [
  {
    value: "monthly",
    label: "Monthly",
    price: "PHP 149",
    badge: "Starter",
    accessLevel: "Premium",
    tagline: "Smart starter protection",
    description: "Best for occasional motorists who want better trip documentation, priority handling, and lower service commission.",
    highlights: ["5% commission", "Photo triage", "Priority queue"],
    features: [
      "Lower 5% Soteria service commission",
      "Photo-based issue reports for faster assessment",
      "Priority matching when several motorists request help",
      "Digital payment receipts for every completed service",
    ],
    activeSummary: "Your monthly premium access is active for priority handling, lower commission, and better service records.",
  },
  {
    value: "six_months",
    label: "6 Months",
    price: "PHP 699",
    badge: "Most practical",
    accessLevel: "Enhanced",
    tagline: "Commuter confidence plan",
    description: "Built to make regular drivers feel protected every week, with stronger service access, smarter reminders, and better proof after every roadside event.",
    highlights: ["6-month protection", "Trip-ready care", "Stronger records"],
    features: [
      "Everything in Monthly, active for six months",
      "Enhanced priority matching for commute, school, and work trips",
      "Preventive safety check reminders before long drives and busy travel weeks",
      "Extended service history with photos, receipts, and responder notes for claims or resale proof",
      "Follow-up support after completed roadside jobs so motorists know what to monitor next",
      "Better value than paying monthly for six straight months",
    ],
    activeSummary: "Your 6 Months plan unlocks enhanced commuter protection with trip reminders, stronger service records, and follow-up support.",
  },
  {
    value: "annual",
    label: "Annual",
    price: "PHP 1,299",
    badge: "Strongest",
    accessLevel: "Elite",
    tagline: "Maximum road assurance",
    description: "The strongest Soteria protection for motorists who want the highest confidence, longest coverage, and the most complete roadside support experience.",
    highlights: ["Full-year shield", "Highest priority", "Complete archive"],
    features: [
      "Everything in 6 Months, active for a full year",
      "Top-tier priority handling during high-demand roadside periods",
      "Complete annual incident archive with photos, payment proof, and service timelines",
      "Year-round vehicle care reminders for seasonal checks, battery health, tires, and emergency readiness",
      "Strongest savings for families, commuters, delivery riders, and frequent travelers",
      "Best plan for motorists who need dependable protection without renewing every few months",
    ],
    activeSummary: "Your Annual plan is the strongest access level, with top priority, full-year care reminders, and the most complete service archive.",
  },
];

function formatSubscriptionPlanLabel(plan: SubscriptionPlan | null) {
  if (plan === "six_months") return "6 Months";
  if (plan === "annual") return "Annual";
  if (plan === "monthly") return "Monthly";
  return "Free";
}

function parseCurrencyAmount(value: string): number {
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrencyAmount(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function mapDbShop(shop: DbRepairShop): Shop {
  return {
    id: shop.id,
    name: shop.name,
    category: shop.category as ServiceCategory,
    rating: Number(shop.rating),
    distanceKm: Number(shop.distance_km),
    address: shop.address,
    responseTime: shop.response_time,
    openNow: shop.open_now,
    coord: { latitude: shop.latitude, longitude: shop.longitude },
    services: shop.services ?? [],
  };
}

async function toCredentialPayload(file: SelectedCredentialFile): Promise<CredentialFilePayload> {
  const response = await fetch(file.uri);
  const blob = await response.blob();

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to encode credential file."));
    };
    reader.onerror = () => reject(new Error("Failed to read credential file."));
    reader.readAsDataURL(blob);
  });

  return {
    name: file.name,
    type: file.mimeType,
    dataUrl,
  };
}

function formatForumTimestamp(value: string | null): string {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function App() {
  const [shopData, setShopData] = useState<Shop[]>(shops);
  const [backendMessage, setBackendMessage] = useState("Using demo-ready mobile data until backend records load.");
  const [agentSearchError, setAgentSearchError] = useState("");
  const [screen, setScreen] = useState<Screen>("role");
  const [userTab, setUserTab] = useState<UserTab>("explore");
  const [agentTab, setAgentTab] = useState<AgentTab>("requests");
  const [communityTab, setCommunityTab] = useState<CommunityTab>("rewards");
  const [userIdentity, setUserIdentity] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [agentIdentity, setAgentIdentity] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [communityIdentity, setCommunityIdentity] = useState("");
  const [communityPassword, setCommunityPassword] = useState("");
  const [userLoginLoading, setUserLoginLoading] = useState(false);
  const [agentLoginLoading, setAgentLoginLoading] = useState(false);
  const [communityLoginLoading, setCommunityLoginLoading] = useState(false);
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    fullName: "",
    mobileNumber: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [registerError, setRegisterError] = useState("");
  const [agentRegisterStep, setAgentRegisterStep] = useState<"info" | "credentials">("info");
  const [agentRegisterForm, setAgentRegisterForm] = useState<AgentRegisterForm>({
    ownerName: "",
    mobileNumber: "",
    organizationName: "",
    serviceCategories: [],
    serviceArea: "",
    username: "",
    password: "",
    liabilityAcknowledged: false,
  });
  const [credentialFiles, setCredentialFiles] = useState<CredentialFiles>({
    driversLicense: null,
    vehicleRegistration: null,
    insurance: null,
    nbiClearance: null,
  });
  const [agentRegisterError, setAgentRegisterError] = useState("");
  const [userErrors, setUserErrors] = useState<Errors>({});
  const [agentErrors, setAgentErrors] = useState<Errors>({});
  const [communityErrors, setCommunityErrors] = useState<Errors>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Motorist");
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [communityName, setCommunityName] = useState("Community Member");
  const [communityProfile, setCommunityProfile] = useState<CommunityProfile | null>(null);
  const [communityRewardOptions, setCommunityRewardOptions] = useState<CommunityRewardOption[]>([]);
  const [communityRedemptions, setCommunityRedemptions] = useState<CommunityRedemption[]>([]);
  const [communityRewardId, setCommunityRewardId] = useState("");
  const [communityGcashName, setCommunityGcashName] = useState("");
  const [communityGcashNumber, setCommunityGcashNumber] = useState("");
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communitySubmitting, setCommunitySubmitting] = useState(false);
  const [motoristSubscriptionStatus, setMotoristSubscriptionStatus] = useState<"active" | "inactive">("inactive");
  const [motoristSubscriptionPlan, setMotoristSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [motoristSubscriptionExpiresAt, setMotoristSubscriptionExpiresAt] = useState<string | null>(null);
  const [soteriaCreditBalance, setSoteriaCreditBalance] = useState(0);
  const [creditTopUpSubmitting, setCreditTopUpSubmitting] = useState(false);
  const [selectedSubscriptionOffer, setSelectedSubscriptionOffer] = useState<SubscriptionPlan>("monthly");
  const [subscriptionPaymentMethod, setSubscriptionPaymentMethod] = useState<"soteria_credits" | "online_payment">("soteria_credits");
  const [subscriptionPaymentSubmitting, setSubscriptionPaymentSubmitting] = useState(false);
  const [latestSubscriptionPayment, setLatestSubscriptionPayment] = useState<SubscriptionPayment | null>(null);
  const [agentName, setAgentName] = useState("Responder");
  const [userLocation, setUserLocation] = useState(baseLocation);
  const [locationLabel, setLocationLabel] = useState("San Pablo City, Laguna - National Highway");
  const [detecting, setDetecting] = useState(false);
  const [shopFilter, setShopFilter] = useState<ServiceCategory | "all">("all");
  const [selectedShopId, setSelectedShopId] = useState("1");
  const [issueSummary, setIssueSummary] = useState("Engine won't start");
  const [serviceType, setServiceType] = useState<"repair" | "transport" | "">("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [triageDescription, setTriageDescription] = useState("");
  const [triagePhotos, setTriagePhotos] = useState<string[]>([]);
  const [findingAgent, setFindingAgent] = useState(true);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [matchedAgent, setMatchedAgent] = useState<AgentMatch | null>(null);
  const [trackingStatus, setTrackingStatus] = useState("matched");
  const [elapsed, setElapsed] = useState(0);
  const [sla, setSla] = useState(480);
  const [agentLocation, setAgentLocation] = useState<Coords>({ latitude: 14.086, longitude: 121.447 });
  const [route, setRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [availability, setAvailability] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [jobHistory, setJobHistory] = useState<string[]>([]);
  const [motoristHistory, setMotoristHistory] = useState<DispatchHistoryEntry[]>([]);
  const [agentHistory, setAgentHistory] = useState<DispatchHistoryEntry[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [liveRequestId, setLiveRequestId] = useState<string | null>(null);
  const [liveDispatchId, setLiveDispatchId] = useState<string | null>(null);
  const [liveDispatchDetails, setLiveDispatchDetails] = useState<DispatchDetails | null>(null);
  const [agentDispatches, setAgentDispatches] = useState<DispatchDetails[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [activeDispatchId, setActiveDispatchId] = useState<string | null>(null);
  const [completedAgentDispatchId, setCompletedAgentDispatchId] = useState<string | null>(null);
  const [navStatus, setNavStatus] = useState<"en-route" | "arrived" | "working">("en-route");
  const [fee, setFee] = useState("PHP 350");
  const [editingFee, setEditingFee] = useState(false);
  const [feeDraft, setFeeDraft] = useState("PHP 350");
  const [forumThreads, setForumThreads] = useState<ForumThread[]>([]);
  const [forumLoading, setForumLoading] = useState(false);
  const [forumError, setForumError] = useState("");
  const [forumTitle, setForumTitle] = useState("");
  const [forumBody, setForumBody] = useState("");
  const [forumTopic, setForumTopic] = useState<ForumTopic>("general");
  const [forumPosting, setForumPosting] = useState(false);
  const [forumReplyDrafts, setForumReplyDrafts] = useState<ForumReplyDrafts>({});
  const [forumReplyingId, setForumReplyingId] = useState<string | null>(null);
  const [agentPaymentProfile, setAgentPaymentProfile] = useState<AgentPaymentProfile | null>(null);
  const [agentGcashName, setAgentGcashName] = useState("");
  const [agentGcashNumber, setAgentGcashNumber] = useState("");
  const [agentPayoutNotes, setAgentPayoutNotes] = useState("");
  const [agentPaymentSaving, setAgentPaymentSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    motoristSubscription: true,
    motoristHistory: false,
    agentProfile: false,
    agentWallet: false,
    agentPayment: false,
    communityRewardCenter: true,
    communityRecentRewards: false,
    communityCoinRules: false,
  });

  const filteredShops = useMemo(
    () => (shopFilter === "all" ? shopData : shopData.filter((shop) => shopOffersCategory(shop, shopFilter))),
    [shopData, shopFilter],
  );
  const selectedShop = filteredShops.find((s) => s.id === selectedShopId) ?? filteredShops[0];
  const activeRequest = activeRequestId ? requests.find((r) => r.id === activeRequestId) ?? null : null;
  const activeDispatch = activeDispatchId ? agentDispatches.find((d) => d.id === activeDispatchId) ?? null : null;
  const activeAgentRequest = activeDispatch;
  const selectedCommunityReward = useMemo(
    () => communityRewardOptions.find((option) => option.id === communityRewardId) ?? null,
    [communityRewardId, communityRewardOptions],
  );
  const selectedSubscriptionOfferDetails = useMemo(
    () => subscriptionOffers.find((offer) => offer.value === selectedSubscriptionOffer) ?? subscriptionOffers[0],
    [selectedSubscriptionOffer],
  );
  const activeSubscriptionOfferDetails = useMemo(
    () => subscriptionOffers.find((offer) => offer.value === motoristSubscriptionPlan) ?? null,
    [motoristSubscriptionPlan],
  );
  const activeMotoristLocation = useMemo(
    () =>
      activeAgentRequest?.motorist
        ? {
            latitude: activeAgentRequest.motorist.latitude,
            longitude: activeAgentRequest.motorist.longitude,
          }
        : userLocation,
    [activeAgentRequest, userLocation],
  );
  const pendingAgentDispatches = useMemo(
    () => agentDispatches.filter((dispatch) => dispatch.dispatchStatus === "pending"),
    [agentDispatches]
  );
  const openAgentDispatches = useMemo(
    () =>
      agentDispatches.filter((dispatch) =>
        ["pending", "accepted", "arrived", "in_progress"].includes(dispatch.dispatchStatus),
      ),
    [agentDispatches],
  );
  const completedAgentEarnings = useMemo(
    () => agentHistory.reduce((sum, item) => sum + (item.payment?.serviceAmount ?? 0), 0),
    [agentHistory],
  );
  const navigationMapCenter = useMemo(() => {
    if (!activeAgentRequest) return activeMotoristLocation;
    return {
      latitude: (agentLocation.latitude + activeMotoristLocation.latitude) / 2,
      longitude: (agentLocation.longitude + activeMotoristLocation.longitude) / 2,
    };
  }, [activeAgentRequest, activeMotoristLocation, agentLocation]);

  const navigationDistance = useMemo(() => {
    if (!activeAgentRequest) return 0;
    return calculateDistance(agentLocation.latitude, agentLocation.longitude, activeMotoristLocation.latitude, activeMotoristLocation.longitude);
  }, [activeAgentRequest, activeMotoristLocation, agentLocation]);

  const navigationETA = useMemo(() => {
    if (!activeAgentRequest) return 0;
    return calculateETA(navigationDistance);
  }, [activeAgentRequest, navigationDistance]);

  useEffect(() => {
    if (!agentId || activeDispatchId || screen !== "agent-app") return;
    const active = agentDispatches.find((dispatch) =>
      ["accepted", "arrived", "in_progress"].includes(dispatch.dispatchStatus),
    );
    if (!active) return;

    setActiveDispatchId(active.id);
    setAgentTab("navigation");
    setNavStatus(active.dispatchStatus === "arrived" ? "arrived" : "en-route");
  }, [agentId, activeDispatchId, agentDispatches, screen]);

  useEffect(() => {
    let active = true;

    const loadRepairShops = async () => {
      try {
        const data = await fetchRepairShops();
        if (!active || data.length === 0) {
          return;
        }
        setShopData(data.map(mapDbShop));
        setBackendMessage("Connected to Firebase-backed repair shop data.");
      } catch {
        if (!active) {
          return;
        }
        setBackendMessage("Backend tables are not available yet, so the mobile app is using local fallback data.");
      }
    };

    const loadAgentDispatches = async () => {
      if (!agentId || screen !== "agent-app") return;
      try {
        const dispatches = await fetchAgentDispatches(agentId);
        if (active) {
          setAgentDispatches(dispatches);
        }
      } catch (error) {
        console.warn("Failed to load responder dispatches:", error);
      }
    };

    const loadMotoristHistory = async () => {
      if (!userId || screen !== "user-app") return;
      try {
        const history = await fetchDispatchHistory(userId, "motorist");
        if (active) {
          setMotoristHistory(history);
        }
      } catch (error) {
        console.warn("Failed to load motorist history:", error);
      }
    };

    const loadAgentHistory = async () => {
      if (!agentId || screen !== "agent-app") return;
      try {
        const history = await fetchDispatchHistory(agentId, "agent");
        if (active) {
          setAgentHistory(history);
        }
      } catch (error) {
        console.warn("Failed to load responder history:", error);
      }
    };

    const loadMotoristCredits = async () => {
      if (!userId || screen !== "user-app") return;
      try {
        const wallet = await fetchSoteriaCredits(userId);
        if (active) {
          setSoteriaCreditBalance(wallet.balance);
        }
      } catch (error) {
        console.warn("Failed to load Soteria Credits:", error);
      }
    };

    const loadAgentPaymentProfile = async () => {
      if (!agentId || screen !== "agent-app") return;
      try {
        const profile = await fetchAgentPaymentProfile(agentId);
        if (active) {
          setAgentPaymentProfile(profile);
          setAgentGcashName(profile.gcashName);
          setAgentGcashNumber(profile.gcashNumber);
          setAgentPayoutNotes(profile.payoutNotes);
        }
      } catch (error) {
        console.warn("Failed to load responder payment profile:", error);
      }
    };

    void loadRepairShops();
    if (screen === "agent-app") {
      void loadAgentDispatches();
      void loadAgentHistory();
      void loadAgentPaymentProfile();
    }
    if (screen === "user-app") {
      void loadMotoristHistory();
      void loadMotoristCredits();
    }

    const interval = screen === "agent-app"
      ? setInterval(() => {
          void loadAgentDispatches();
          void loadAgentHistory();
          void loadAgentPaymentProfile();
        }, 10000)
      : screen === "user-app"
        ? setInterval(() => {
            void loadMotoristHistory();
            void loadMotoristCredits();
          }, 10000)
      : null;

    // Setup notifications
    const setupNotifications = async () => {
      await requestNotificationPermissions();
    };

    setupNotifications();

    return () => {
      active = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [agentId, userId, screen]);

  useEffect(() => {
    if (screen !== "community-app" || !communityId) {
      return;
    }

    let active = true;

    const loadCommunityData = async () => {
      try {
        setCommunityLoading(true);
        const [visitReward, rewards, redemptions] = await Promise.all([
          awardCommunityForumVisit(communityId),
          fetchCommunityRewardOptions(),
          fetchCommunityRedemptions(),
        ]);

        if (!active) {
          return;
        }

        setCommunityProfile(visitReward.profile);
        setCommunityRewardOptions(rewards);
        setCommunityRewardId((current) => current || rewards[0]?.id || "");
        setCommunityRedemptions(redemptions.filter((item) => item.userId === communityId));
      } catch (error) {
        console.warn("Failed to load community data:", error);
      } finally {
        if (active) {
          setCommunityLoading(false);
        }
      }
    };

    void loadCommunityData();

    return () => {
      active = false;
    };
  }, [screen, communityId]);

  // Calculate route when tracking agent location or navigating
  useEffect(() => {
    const shouldCalculateRoute = 
      (screen === "user-app" && userTab === "tracking") ||
      (screen === "agent-app" && agentTab === "navigation" && activeAgentRequest);

    if (!shouldCalculateRoute) {
      setRoute([]);
      return;
    }

    const calculateRoute = async () => {
      try {
        const routeData = await getRoute(
          [agentLocation.latitude, agentLocation.longitude],
          [activeMotoristLocation.latitude, activeMotoristLocation.longitude]
        );
        if (routeData) {
          setRoute(routeData.geometry.map((coord) => ({ latitude: coord[0], longitude: coord[1] })));
        }
      } catch (error) {
        console.error("Route calculation failed:", error);
        // Fallback to direct line
          setRoute([
            { latitude: agentLocation.latitude, longitude: agentLocation.longitude },
            { latitude: activeMotoristLocation.latitude, longitude: activeMotoristLocation.longitude }
          ]);
        }
      };

      calculateRoute();
  }, [screen, userTab, agentTab, activeAgentRequest, activeMotoristLocation, agentLocation]);

  useEffect(() => {
    if (screen !== "user-app" || userTab !== "tracking") return;
    const timer = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [screen, userTab]);

  useEffect(() => {
    if (screen !== "user-app" || userTab !== "tracking" || trackingStatus === "completed") return;
    const timer = setInterval(() => setSla((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [screen, userTab, trackingStatus]);

  useEffect(() => {
    const shouldLoadForum =
      (screen === "user-app" && userTab === "forum" && Boolean(userId)) ||
      (screen === "agent-app" && agentTab === "forum" && Boolean(agentId)) ||
      (screen === "community-app" && Boolean(communityId));

    if (!shouldLoadForum) {
      return;
    }

    let active = true;

    const loadForumThreads = async () => {
      try {
        setForumLoading(true);
        setForumError("");
        const threads = await fetchForumThreads();
        if (active) {
          setForumThreads(threads);
        }
      } catch (error) {
        if (active) {
          setForumError(error instanceof Error ? error.message : "Failed to load forum posts.");
        }
      } finally {
        if (active) {
          setForumLoading(false);
        }
      }
    };

    void loadForumThreads();

    return () => {
      active = false;
    };
  }, [screen, userTab, agentTab, userId, agentId]);

  useEffect(() => {
    if (screen !== "user-app" || userTab !== "tracking") return;
    if (liveRequestId) return;
    const ids = [
      setTimeout(() => {
        setTrackingStatus("accepted");
        sendLocalNotification("Responder Dispatched", "Your rescue responder has been assigned and is preparing to help you.");
      }, 3000),
      setTimeout(() => {
        setTrackingStatus("en-route");
        sendLocalNotification("Responder En Route", "Your rescue responder is now on the way to your location.");
      }, 6000),
      setTimeout(() => {
        setTrackingStatus("arrived");
        sendLocalNotification("Responder Arrived", "Your rescue responder has arrived at your location.");
      }, 12000),
      setTimeout(() => {
        setTrackingStatus("in-service");
        sendLocalNotification("Service Started", "Your rescue responder has begun working on your vehicle.");
      }, 17000),
    ];
    return () => ids.forEach(clearTimeout);
  }, [screen, userTab, liveRequestId]);

  // Real GPS updates are handled by Location.watchPositionAsync in the activeAgentRequest effect
  // No artificial movement or interpolation - agent marker only updates from real device GPS

  useEffect(() => {
    if (!liveRequestId || activeRequestId !== liveRequestId) return;
    if (navStatus === "en-route") {
      setTrackingStatus("en-route");
      sendLocalNotification("Navigation Started", "You are now navigating to the motorist's location.");
    }
    if (navStatus === "arrived") {
      setTrackingStatus("arrived");
      sendLocalNotification("Arrived at Location", "You have arrived at the motorist's location.");
    }
    if (navStatus === "working") {
      setTrackingStatus("in-service");
      sendLocalNotification("Service Started", "You have begun working on the motorist's vehicle.");
    }
  }, [liveRequestId, activeRequestId, navStatus]);

  // Real GPS location tracking for agents
  useEffect(() => {
    if (screen !== "agent-app" || !activeAgentRequest) return;

    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Location permission is required for navigation.');
          return;
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000, // Update every 2 seconds
            distanceInterval: 3, // Update every 3 meters
          },
          async (location) => {
            const { latitude, longitude } = location.coords;
            setAgentLocation({ latitude, longitude });

            // Send location update to backend
            try {
              if (agentId) {
                await updateAgentLocation(agentId, { latitude, longitude });
              }
            } catch (error) {
              console.warn("Failed to update responder location:", error);
            }
          }
        );
      } catch (error) {
        console.error('Failed to start location tracking:', error);
        Alert.alert('Location Error', 'Could not start GPS tracking.');
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [screen, activeAgentRequest, agentIdentity]);

  // Update agent availability in backend when it changes
  useEffect(() => {
    if (screen !== "agent-app" || !agentId) return;

    const updateAvailability = async () => {
      try {
        await updateAgentAvailability(agentId, availability);
        console.log(`Responder availability updated to: ${availability}`);
      } catch (error) {
        console.warn("Failed to update responder availability:", error);
        setAvailability(false);
        if (availability) {
          Alert.alert(
            "Could not go online",
            error instanceof Error
              ? error.message
              : "Your online status could not be updated. Please try again.",
          );
        }
      }
    };

    updateAvailability();
  }, [screen, agentId, availability]);

  // Update agent location when they switch to agent app
  useEffect(() => {
    if (screen !== "agent-app") return;

    const updateLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn("Responder location permission not granted");
          return;
        }

        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const currentCoords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };

        setAgentLocation(currentCoords);
        if (agentId) {
          await updateAgentLocation(agentId, currentCoords);
        }
        console.log(`Responder location updated: ${currentCoords.latitude}, ${currentCoords.longitude}`);
      } catch (error) {
        console.warn("Failed to update responder location:", error);
      }
    };

    updateLocation();
  }, [screen, agentId]);

  const validate = (identity: string, password: string) => {
    const next: Errors = {};
    if (!identity.trim()) next.identity = "This field is required.";
    if (!password.trim()) next.password = "Password is required.";
    return next;
  };

  const loginUser = () => {
    const next = validate(userIdentity, userPassword);
    setUserErrors(next);
    if (Object.keys(next).length) return;

    setUserLoginLoading(true);
    void (async () => {
      try {
        const result = await apiLoginUser({
          username: userIdentity.trim(),
          password: userPassword.trim(),
        });
        setUserId(result.id);
        setUserName(result.fullName || userIdentity.trim());
        setMotoristSubscriptionStatus(result.subscriptionStatus === "active" ? "active" : "inactive");
        setMotoristSubscriptionPlan(result.subscriptionPlan ?? null);
        setMotoristSubscriptionExpiresAt(result.subscriptionExpiresAt ?? null);
        setSoteriaCreditBalance(Number(result.soteriaCreditBalance ?? 0));
        setUserPassword("");
        setUserErrors({});
        setScreen("user-app");
        setUserTab("explore");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed. Please check your credentials.";
        const isCredentialError = message.toLowerCase().includes("invalid username or password") || message.toLowerCase().includes("credentials");
        setUserErrors({ 
          identity: isCredentialError ? "Invalid username or password." : message,
          password: isCredentialError ? "Invalid username or password." : ""
        });
      } finally {
        setUserLoginLoading(false);
      }
    })();
  };

  const loginAgent = () => {
    const next = validate(agentIdentity, agentPassword);
    setAgentErrors(next);
    if (Object.keys(next).length) return;

    setAgentLoginLoading(true);
    void (async () => {
      try {
        const result = await apiLoginAgent({
          username: agentIdentity.trim(),
          password: agentPassword.trim(),
        });
        setAgentName(result.fullName || agentIdentity.trim());
        setAgentId(result.id);
        setAvailability(false);
        setAgentPassword("");
        setAgentErrors({});
        setScreen("agent-app");
        setAgentTab("requests");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed. Please check your credentials.";
        const isCredentialError = message.toLowerCase().includes("invalid username or password") || message.toLowerCase().includes("credentials");
        setAgentErrors({
          identity: isCredentialError ? "Invalid username or password." : message,
          password: isCredentialError ? "Invalid username or password." : ""
        });
      } finally {
        setAgentLoginLoading(false);
      }
    })();
  };

  const loginCommunity = () => {
    const next = validate(communityIdentity, communityPassword);
    setCommunityErrors(next);
    if (Object.keys(next).length) return;

    setCommunityLoginLoading(true);
    void (async () => {
      try {
        const result = await apiLoginCommunity({
          username: communityIdentity.trim(),
          password: communityPassword.trim(),
        });
        setCommunityId(result.id);
        setCommunityName(result.fullName || communityIdentity.trim());
        setCommunityProfile({
          id: result.id,
          fullName: result.fullName || communityIdentity.trim(),
          role: "community",
          communityCoins: result.communityCoins ?? 0,
          communityLifetimeCoins: result.communityLifetimeCoins ?? 0,
          lastCommunityRewardAt: result.lastCommunityRewardAt ?? null,
        });
        setCommunityPassword("");
        setCommunityErrors({});
        setScreen("community-app");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed. Please check your credentials.";
        const isCredentialError = message.toLowerCase().includes("invalid username or password") || message.toLowerCase().includes("credentials");
        setCommunityErrors({
          identity: isCredentialError ? "Invalid username or password." : message,
          password: isCredentialError ? "Invalid username or password." : "",
        });
      } finally {
        setCommunityLoginLoading(false);
      }
    })();
  };

  const saveAgentPaymentDetails = async () => {
    if (!agentId) {
      Alert.alert("Responder missing", "Please log in again to update your payment details.");
      return;
    }

    if (!agentGcashName.trim() || !agentGcashNumber.trim()) {
      Alert.alert("Missing details", "Please enter your GCash account name and GCash number.");
      return;
    }

    try {
      setAgentPaymentSaving(true);
      const profile = await updateAgentPaymentProfile(agentId, {
        gcashName: agentGcashName.trim(),
        gcashNumber: agentGcashNumber.trim(),
        payoutNotes: agentPayoutNotes.trim(),
      });
      setAgentPaymentProfile(profile);
      setAgentGcashName(profile.gcashName);
      setAgentGcashNumber(profile.gcashNumber);
      setAgentPayoutNotes(profile.payoutNotes);
      Alert.alert("Payout details saved", "Your responder wallet details were saved for automated Soteria transfers.");
    } catch (error) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "Could not save your GCash payout details.",
      );
    } finally {
      setAgentPaymentSaving(false);
    }
  };

  const registerUser = () => {
    if (
      !registerForm.fullName.trim() ||
      !registerForm.mobileNumber.trim() ||
      !registerForm.username.trim() ||
      !registerForm.password.trim() ||
      !registerForm.confirmPassword.trim()
    ) {
      setRegisterError("Please complete all fields.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    setRegisterError("");
    void (async () => {
      try {
        const result = await registerUserProfile({
          fullName: registerForm.fullName,
          mobileNumber: registerForm.mobileNumber,
          username: registerForm.username,
          password: registerForm.password,
        });
        setUserId(result.id);
        setBackendMessage("User profile saved to backend.");
        setMotoristSubscriptionStatus("inactive");
        setMotoristSubscriptionPlan(null);
        setMotoristSubscriptionExpiresAt(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save user profile.";
        setRegisterError(message);
        setBackendMessage(`User registration failed: ${message}`);
        Alert.alert("Registration not saved", message);
        return;
      }

      setUserIdentity(registerForm.username);
      setUserPassword(registerForm.password);
      setUserName(registerForm.fullName);
      setScreen("user-app");
      setUserTab("explore");
    })();
  };

  const registerCommunity = () => {
    if (
      !registerForm.fullName.trim() ||
      !registerForm.mobileNumber.trim() ||
      !registerForm.username.trim() ||
      !registerForm.password.trim() ||
      !registerForm.confirmPassword.trim()
    ) {
      setRegisterError("Please complete all fields.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    setRegisterError("");
    void (async () => {
      try {
        const result = await registerCommunityProfile({
          fullName: registerForm.fullName,
          mobileNumber: registerForm.mobileNumber,
          username: registerForm.username,
          password: registerForm.password,
        });
        setCommunityId(result.id);
        setCommunityProfile({
          id: result.id,
          fullName: registerForm.fullName,
          role: "community",
          communityCoins: 0,
          communityLifetimeCoins: 0,
          lastCommunityRewardAt: null,
        });
        setBackendMessage("Community profile saved to backend.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save community profile.";
        setRegisterError(message);
        setBackendMessage(`Community registration failed: ${message}`);
        Alert.alert("Registration not saved", message);
        return;
      }

      setCommunityIdentity(registerForm.username);
      setCommunityPassword(registerForm.password);
      setCommunityName(registerForm.fullName);
      setScreen("community-app");
    })();
  };

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationLabel("Location permission denied. Using default location.");
        setUserLocation(baseLocation);
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setUserLocation(next);
      setLocationLabel(`Pinned near ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}`);
    } catch {
      setLocationLabel("Could not detect location. Using default location.");
      setUserLocation(baseLocation);
    } finally {
      setDetecting(false);
    }
  };

  const captureCurrentUserLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      throw new Error("Location permission is required.");
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    const next = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };

    setUserLocation(next);
    setLocationLabel(`Pinned near ${next.latitude.toFixed(5)}, ${next.longitude.toFixed(5)}`);
    return next;
  };

  const continueEmergency = () => {
    if (!serviceType || !issueSummary.trim()) {
      Alert.alert("Incomplete request", "Choose a service type and describe the issue first.");
      return;
    }
    setScreen("user-triage");
  };

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom],
    );
  };

  const pickTriagePhoto = async () => {
    if (motoristSubscriptionStatus !== "active") {
      Alert.alert(
        "Subscription required",
        "Image upload is locked for free accounts. Subscribe first to unlock photo attachments and priority support.",
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach images for responders.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 3,
    });

    if (!result.canceled) {
      setTriagePhotos(result.assets.map((asset) => asset.uri));
    }
  };

  const continueFromTriage = async () => {
    if (selectedSymptoms.length === 0) {
      Alert.alert("Select symptoms", "Choose at least one symptom before finding a rescue responder.");
      return;
    }

    setScreen("user-finding-agent");
    setFindingAgent(true);
    setMatchedAgent(null);
    setAgentSearchError("");

    try {
      const currentUserLocation = await captureCurrentUserLocation();
      const nearbyAgents = await findNearbyAgents(currentUserLocation.latitude, currentUserLocation.longitude, serviceType, userId);
      if (nearbyAgents && nearbyAgents.length > 0) {
        const agent = nearbyAgents[0];
        const matchedAgentData = {
          id: agent.id,
          name: agent.fullName,
          category: agent.serviceCategory as ServiceCategory,
          rating: 4.5,
          distanceKm: agent.distanceKm,
          services: agent.services || [],
          cashAssistReady: Boolean(agent.cashAssistReady),
        };
        setMatchedAgent(matchedAgentData);
        setFindingAgent(false);
        return;
      }

      setAgentSearchError("No available rescue responders were found nearby right now. Try again in a moment or adjust your pinned location.");
    } catch (error) {
      console.warn("Failed to find real responders:", error);
      setAgentSearchError("Unable to reach the backend. Please check your connection and try again.");
    } finally {
      setFindingAgent(false);
    }
  };

  const refreshAgentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', "Location permission is required for accurate responder tracking.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const currentCoords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setAgentLocation(currentCoords);
      if (agentId) {
        await updateAgentLocation(agentId, currentCoords);
      }
    } catch (error) {
      console.warn("Failed to refresh responder location:", error);
      Alert.alert('Location update failed', 'Could not get your current location. Please try again.');
    }
  };

  const detectAgentLocation = async () => {
    setDetecting(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to show nearby requests.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const currentCoords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setAgentLocation(currentCoords);
      if (agentId) {
        await updateAgentLocation(agentId, currentCoords);
        const refreshedDispatches = await fetchAgentDispatches(agentId);
        setAgentDispatches(refreshedDispatches);
      }
    } catch (error) {
      console.warn("Failed to detect responder location:", error);
      Alert.alert('Location failed', 'Could not determine your current location. Please try again.');
    } finally {
      setDetecting(false);
    }
  };

  const acceptRequest = async (id: string) => {
    const backendDispatch = agentDispatches.find((dispatch) => dispatch.id === id);

    if (backendDispatch && agentId) {
      try {
        await acceptDispatch(id, agentId);
        setCompletedAgentDispatchId(null);
        setActiveDispatchId(id);
        setAgentTab("navigation");
        setNavStatus("en-route");
        setTrackingStatus("accepted");
        const refreshedDispatches = await fetchAgentDispatches(agentId);
        setAgentDispatches(refreshedDispatches);
      } catch (error) {
        console.warn("Failed to accept backend dispatch:", error);
        Alert.alert("Accept failed", "Could not accept the request through the backend. Trying local navigation mode.");
        setCompletedAgentDispatchId(null);
        setActiveDispatchId(id);
        setAgentTab("navigation");
        setNavStatus("en-route");
        if (liveRequestId === id) {
          setTrackingStatus("accepted");
        }
      }
    } else {
      setCompletedAgentDispatchId(null);
      setActiveDispatchId(id);
      setAgentTab("navigation");
      setNavStatus("en-route");
      if (liveRequestId === id) {
        setTrackingStatus("accepted");
      }
    }

    await refreshAgentLocation();
  };

  useEffect(() => {
    if (screen !== "agent-app" || agentTab !== "navigation" || !activeAgentRequest) return;
    void refreshAgentLocation();
  }, [screen, agentTab, activeAgentRequest]);

  const requestRescue = () => {
    if (requestSubmitting) {
      return;
    }

    setRequestSubmitting(true);
    const submitRequest = async () => {
      let currentUserLocation = userLocation;

      try {
        currentUserLocation = await captureCurrentUserLocation();
      } catch (error) {
        console.warn("Using last known motorist location for dispatch:", error);
      }

      const requestId = `REQ-${Date.now()}`;
      const nextRequest: Request = {
        id: requestId,
        motorist: userName || registerForm.fullName || userIdentity || "Motorist",
        phone: registerForm.mobileNumber || "+63 900 000 0000",
        location: locationLabel,
        distance: matchedAgent ? `${matchedAgent.distanceKm} km` : "1.0 km",
        vehicleType: serviceType === "transport" ? "Rescue transport" : "Roadside repair",
        fee: "PHP 350",
        priority: "high",
        symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : [issueSummary],
      };

      setLiveDispatchId(null);
      setLiveDispatchDetails(null);

      try {
        const result = await createEmergencyDispatch({
          userId: userId ?? undefined,
          username: userIdentity || registerForm.username || userName,
          mobileNumber: registerForm.mobileNumber || "N/A",
          locationLabel,
          latitude: currentUserLocation.latitude,
          longitude: currentUserLocation.longitude,
          serviceType,
          issueSummary: [issueSummary, triageDescription].filter(Boolean).join(" | "),
          symptoms: selectedSymptoms,
          matchedShopId: null,
          matchedAgentId: matchedAgent?.id ?? null,
        });

        const dispatchDetails = await fetchDispatchDetails(result.dispatchId);
        setLiveDispatchId(result.dispatchId);
        setLiveDispatchDetails(dispatchDetails);
        setBackendMessage("Emergency report and dispatch saved to Firebase.");

        if (dispatchDetails.agent?.currentLatitude && dispatchDetails.agent?.currentLongitude) {
          setAgentLocation({ latitude: dispatchDetails.agent.currentLatitude, longitude: dispatchDetails.agent.currentLongitude });
        }
      } catch {
        setLiveDispatchId(null);
        setLiveDispatchDetails(null);
        setBackendMessage("Dispatch is still using local state because the database tables are not available yet.");
      }

      setRequests((current) => [nextRequest, ...current]);
      setLiveRequestId(requestId);
      setActiveRequestId(requestId);
      setTrackingStatus("matched");
      setElapsed(0);
      setSla(480);
      setFee("PHP 350");
      setFeeDraft("PHP 350");
      setNavStatus("en-route");
      // Agent location will be set from real GPS when agent calls detectAgentLocation()
      // Do not set artificial offset - use real device location only
      setScreen("user-app");
      setUserTab("tracking");
      setRequestSubmitting(false);
    };

    void submitRequest().catch((error) => {
      console.warn("Failed to request rescue:", error);
      setRequestSubmitting(false);
    });
  };

  const findAnotherAgent = async () => {
    setFindingAgent(true);
    setMatchedAgent(null);
    setAgentSearchError("");

    try {
      const currentUserLocation = await captureCurrentUserLocation();
      const nearbyAgents = await findNearbyAgents(currentUserLocation.latitude, currentUserLocation.longitude, serviceType, userId);
      if (!nearbyAgents || nearbyAgents.length === 0) {
        setAgentSearchError("No additional rescue responders are available near your pinned location right now.");
        return;
      }

      const currentIndex = matchedAgent ? nearbyAgents.findIndex((agent) => agent.id === matchedAgent.id) : -1;
      const nextAgent = currentIndex >= 0 && currentIndex < nearbyAgents.length - 1
        ? nearbyAgents[currentIndex + 1]
        : nearbyAgents[0];

      setMatchedAgent({
        id: nextAgent.id,
        name: nextAgent.fullName,
        category: nextAgent.serviceCategory as ServiceCategory,
        rating: 4.5,
        distanceKm: nextAgent.distanceKm,
        services: nextAgent.services || [],
        cashAssistReady: Boolean(nextAgent.cashAssistReady),
      });
    } catch (error) {
      console.warn("Failed to refresh nearby responders:", error);
      setAgentSearchError("Unable to refresh nearby responders. Please try again later.");
    } finally {
      setFindingAgent(false);
    }
  };

  const submitForumPost = async () => {
    const currentRole =
      screen === "agent-app"
        ? "agent"
        : screen === "community-app"
          ? "community"
          : "motorist";
    const currentUserId =
      currentRole === "agent"
        ? agentId
        : currentRole === "community"
          ? communityId
          : userId;

    if (!currentUserId) {
      setForumError("Please log in first before posting in the forum.");
      return;
    }

    if (!forumTitle.trim() || !forumBody.trim()) {
      setForumError("Please enter both a title and details for your post.");
      return;
    }

    try {
      setForumPosting(true);
      setForumError("");
      const created = await createForumThread({
        authorUserId: currentUserId,
        authorRole: currentRole,
        title: forumTitle.trim(),
        body: forumBody.trim(),
        topic: forumTopic,
      });

      setForumThreads((current) => [created, ...current]);
      setForumTitle("");
      setForumBody("");
      setForumTopic("general");
      if (currentRole === "community" && communityId) {
        const profile = await fetchCommunityProfile(communityId);
        setCommunityProfile(profile);
      }
    } catch (error) {
      setForumError(error instanceof Error ? error.message : "Could not publish your post.");
    } finally {
      setForumPosting(false);
    }
  };

  const submitForumReply = async (threadId: string) => {
    const currentRole =
      screen === "agent-app"
        ? "agent"
        : screen === "community-app"
          ? "community"
          : "motorist";
    const currentUserId =
      currentRole === "agent"
        ? agentId
        : currentRole === "community"
          ? communityId
          : userId;
    const draft = forumReplyDrafts[threadId]?.trim();

    if (!currentUserId) {
      setForumError("Please log in first before replying in the forum.");
      return;
    }

    if (!draft) {
      setForumError("Write a reply before sending.");
      return;
    }

    try {
      setForumReplyingId(threadId);
      setForumError("");
      const reply = await createForumReply(threadId, {
        authorUserId: currentUserId,
        authorRole: currentRole,
        body: draft,
      });

      setForumThreads((current) =>
        current.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                replies: [...thread.replies, reply],
                replyCount: thread.replyCount + 1,
                lastActivityAt: reply.createdAt,
              }
            : thread,
        ),
      );

      setForumReplyDrafts((current) => ({ ...current, [threadId]: "" }));
      if (currentRole === "community" && communityId) {
        const profile = await fetchCommunityProfile(communityId);
        setCommunityProfile(profile);
      }
    } catch (error) {
      setForumError(error instanceof Error ? error.message : "Could not send your reply.");
    } finally {
      setForumReplyingId(null);
    }
  };

  const submitSubscriptionPayment = async () => {
    if (!userId) {
      Alert.alert("Login required", "Please log in as a motorist before paying with Soteria Credits.");
      return;
    }

    try {
      setSubscriptionPaymentSubmitting(true);
      const payment = await createSubscriptionPayment({
        userId,
        subscriptionPlan: selectedSubscriptionOffer,
        paymentMethod: subscriptionPaymentMethod,
      });

      setLatestSubscriptionPayment(payment);
      if (payment.paymentUrl) {
        await Linking.openURL(payment.paymentUrl);
        Alert.alert(
          "Payment page opened",
          "Complete the online payment page. Your subscription will activate automatically after PayMongo confirms payment.",
        );
        return;
      }
      setMotoristSubscriptionStatus("active");
      setMotoristSubscriptionPlan(payment.subscriptionPlan ?? selectedSubscriptionOffer);
      setMotoristSubscriptionExpiresAt(null);
      if (typeof payment.creditBalance === "number") {
        setSoteriaCreditBalance(payment.creditBalance);
      }
      Alert.alert(
        "Subscription activated",
        subscriptionPaymentMethod === "online_payment"
          ? "Your online payment is being processed."
          : "Soteria deducted your credits and activated your plan automatically.",
      );
    } catch (error) {
      Alert.alert(
        subscriptionPaymentMethod === "online_payment" ? "Online payment failed" : "Credits payment failed",
        error instanceof Error
          ? error.message
          : subscriptionPaymentMethod === "online_payment"
            ? "Could not create the online subscription payment link."
            : "Could not process your subscription credits payment.",
      );
    } finally {
      setSubscriptionPaymentSubmitting(false);
    }
  };

  const topUpCredits = async (amount: number) => {
    if (!userId) {
      Alert.alert("Login required", "Please log in as a motorist before topping up Soteria Credits.");
      return;
    }

    try {
      setCreditTopUpSubmitting(true);
      const result = await topUpSoteriaCredits(userId, amount);
      if (result.paymentUrl) {
        await Linking.openURL(result.paymentUrl);
        Alert.alert(
          "Payment page opened",
          "Complete the PayMongo payment page. Your Soteria Credits will update automatically after the payment provider confirms the transaction.",
        );
      } else {
        setSoteriaCreditBalance(result.balance);
        Alert.alert(
          "Top-up successful",
          `PHP ${result.amount} was added to your Soteria Credits. Current balance: PHP ${result.balance}.`,
        );
      }
    } catch (error) {
      Alert.alert(
        "Top-up failed",
        error instanceof Error ? error.message : "Could not process your Soteria Credits top-up.",
      );
    } finally {
      setCreditTopUpSubmitting(false);
    }
  };

  const submitCommunityRedemption = async () => {
    if (!communityId || !communityRewardId) {
      Alert.alert("Reward unavailable", "Please choose a reward ticket first.");
      return;
    }

    if (!communityGcashName.trim() || !communityGcashNumber.trim()) {
      Alert.alert("Missing details", "Please enter your GCash name and GCash number.");
      return;
    }

    try {
      setCommunitySubmitting(true);
      const result = await createCommunityRedemption({
        userId: communityId,
        rewardId: communityRewardId,
        gcashName: communityGcashName.trim(),
        gcashNumber: communityGcashNumber.trim(),
      });

      if (result.profile) {
        setCommunityProfile(result.profile);
      }
      setCommunityRedemptions((current) => [result.redemption, ...current]);
      setCommunityGcashName("");
      setCommunityGcashNumber("");
      Alert.alert("Ticket submitted", "Your reward ticket was queued for Soteria payout processing.");
    } catch (error) {
      Alert.alert(
        "Redemption failed",
        error instanceof Error ? error.message : "Could not submit your reward ticket.",
      );
    } finally {
      setCommunitySubmitting(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const continueAgentRegisterInfo = () => {
    if (
      !agentRegisterForm.ownerName.trim() ||
      !agentRegisterForm.mobileNumber.trim() ||
      !agentRegisterForm.organizationName.trim() ||
      agentRegisterForm.serviceCategories.length === 0 ||
      !agentRegisterForm.serviceArea.trim() ||
      !agentRegisterForm.username.trim() ||
      !agentRegisterForm.password.trim()
    ) {
      setAgentRegisterError("Please complete all fields before continuing.");
      return;
    }
    if (!agentRegisterForm.liabilityAcknowledged) {
      setAgentRegisterError("Please acknowledge the organization liability declaration before continuing.");
      return;
    }
    setAgentRegisterError("");
    setAgentRegisterStep("credentials");
  };

  const pickCredentialFile = async (field: keyof CredentialFiles) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setCredentialFiles((current) => ({
        ...current,
        [field]: {
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType ?? "application/octet-stream",
        },
      }));
    }
  };

  const submitAgentRegistration = () => {
    const required = Object.values(credentialFiles).every(Boolean);
    if (!required) {
      setAgentRegisterError("Upload all required credential files before submitting.");
      return;
    }
    setAgentRegisterError("");
    void (async () => {
      try {
        await submitAgentApplication({
          ownerName: agentRegisterForm.ownerName,
          mobileNumber: agentRegisterForm.mobileNumber,
          organizationName: agentRegisterForm.organizationName,
          serviceCategory: agentRegisterForm.serviceCategories[0],
          serviceCategories: agentRegisterForm.serviceCategories,
          serviceArea: agentRegisterForm.serviceArea,
          username: agentRegisterForm.username,
          password: agentRegisterForm.password,
          liabilityAcknowledged: agentRegisterForm.liabilityAcknowledged,
          credentialManifest: Object.fromEntries(
            Object.entries(credentialFiles).map(([key, file]) => [key, file?.name ?? null]),
          ),
          credentialFiles: Object.fromEntries(
            (
              await Promise.all(
                Object.entries(credentialFiles).map(async ([key, file]) => [
                  key,
                  file ? await toCredentialPayload(file) : null,
                ]),
              )
            ).filter((entry): entry is [string, CredentialFilePayload] => entry[1] !== null),
          ),
        });
        setBackendMessage("Responder application saved to backend.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save responder application.";
        setAgentRegisterError(message);
        setBackendMessage(`Responder application failed: ${message}`);
        Alert.alert("Application not saved", message);
        return;
      }

      Alert.alert("Application submitted", "Admin will review your credentials and notify you once approved.");
      setScreen("agent-login");
      setAgentRegisterStep("info");
    })();
  };

  if (screen === "user-app" && userTab === "tracking" && liveDispatchId) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.trackingShell}>
          <View style={styles.trackingHeader}>
            <Pressable style={styles.secondary} onPress={() => setUserTab("emergency")}>
              <Text style={styles.secondaryText}>Back</Text>
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.titleDark}>Live Tracking</Text>
              <Text style={styles.textDark}>Watch your responder approach in real time.</Text>
            </View>
          </View>
          <MotorietTrackingScreen
            dispatchId={liveDispatchId}
            motoristLocation={userLocation}
            motoristName={userName}
            motoristUserId={userId}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "agent-app" && agentTab === "navigation" && (activeDispatchId || completedAgentDispatchId)) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.trackingShell}>
          <View style={styles.trackingHeader}>
            <Pressable
              style={styles.secondary}
              onPress={() => {
                setCompletedAgentDispatchId(null);
                setAgentTab("requests");
              }}
            >
              <Text style={styles.secondaryText}>Back</Text>
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.titleDark}>Responder Navigation</Text>
              <Text style={styles.textDark}>
                {completedAgentDispatchId
                  ? "Review the completed rescue and keep the handoff polished."
                  : "Watch your route to the motorist in real time."}
              </Text>
            </View>
          </View>
          <AgentTrackingScreen
            dispatchId={activeDispatchId ?? completedAgentDispatchId!}
            agentLocation={agentLocation}
            agentUserId={agentId}
            agentName={agentName}
            fee={fee}
            feeDraft={feeDraft}
            editingFee={editingFee}
            navStatus={navStatus}
            onBack={() => {
              setCompletedAgentDispatchId(null);
              setAgentTab("requests");
            }}
            onNavStatusChange={setNavStatus}
            onFeeDraftChange={setFeeDraft}
            onToggleEditFee={() => {
              if (editingFee) {
                setFee(feeDraft);
              }
              setEditingFee((current) => !current);
            }}
            onCompleteJob={() => {
              const completedId = activeAgentRequest?.id ?? activeDispatchId;
              if (!completedId) {
                return;
              }

              setCompletedAgentDispatchId(completedId);
              setActiveDispatchId(null);

              if (activeAgentRequest) {
                setAgentDispatches((current) => current.filter((item) => item.id !== activeAgentRequest.id));
              }

              if (activeRequestId === liveRequestId) {
                setTrackingStatus("completed");
              }

              if (activeRequest) {
                setJobHistory((current) => [
                  `${activeRequest.symptoms[0] ?? "Service"} - ${activeRequest.motorist} - ${fee}`,
                  ...current,
                ]);
                setRequests((current) => current.filter((item) => item.id !== activeRequest.id));
              }

              Alert.alert(
                "Payment requested",
                "The service amount was sent to the motorist. They can now pay with Soteria Credits or PayMongo.",
              );

              if (completedId && agentId) {
                (async () => {
                  try {
                    await completeDispatch(completedId, parseCurrencyAmount(fee));
                    const refreshedDispatches = await fetchAgentDispatches(agentId);
                    const refreshedHistory = await fetchDispatchHistory(agentId, "agent");
                    setAgentDispatches(refreshedDispatches);
                    setAgentHistory(refreshedHistory);
                  } catch (error) {
                    console.warn("Failed to complete job on backend:", error);
                    Alert.alert(
                      "Could not request payment",
                      error instanceof Error
                        ? error.message
                        : "Ask the motorist to stay on the tracking screen and try again.",
                    );
                  }
                })();
              }
            }}
            onDeclineJob={() => {
              const declinedId = activeAgentRequest?.id ?? activeDispatchId;
              if (!declinedId) {
                return;
              }

              Alert.alert(
                "Decline Request",
                "Are you sure you want to decline this active rescue request?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Decline",
                    style: "destructive",
                    onPress: () => {
                      setCompletedAgentDispatchId(null);
                      setActiveDispatchId(null);
                      setAgentTab("requests");

                      if (activeAgentRequest) {
                        setAgentDispatches((current) => current.filter((item) => item.id !== activeAgentRequest.id));
                      }

                      if (activeRequest) {
                        setRequests((current) => current.filter((item) => item.id !== activeRequest.id));
                      }

                      if (declinedId && agentId) {
                        (async () => {
                          try {
                            await declineDispatch(declinedId, agentId);
                            const refreshedDispatches = await fetchAgentDispatches(agentId);
                            setAgentDispatches(refreshedDispatches);
                          } catch (error) {
                            console.warn("Failed to decline active dispatch:", error);
                            Alert.alert("Decline failed", "Could not decline this dispatch right now.");
                          }
                        })();
                      }
                    },
                  },
                ],
              );
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.wrap}>
        {screen === "role" && (
          <>
            <ImageBackground
              source={{ uri: "https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1200&q=80" }}
              style={styles.heroBackground}
              imageStyle={styles.heroBackgroundImage}
              blurRadius={20}
            >
              <View style={styles.heroOverlay} />
              <View style={styles.heroGlow} />
              <View style={styles.heroGlowSecondary} />
              <View style={styles.heroContent}>
                <View style={styles.heroTopRow}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.eyebrow}>Soteria</Text>
                  </View>
                  <View style={styles.heroTrustBadge}>
                    <Text style={styles.heroTrustText}>Enterprise mobility suite</Text>
                  </View>
                </View>

                <View style={styles.heroCopy}>
                  <Text style={styles.heroLead}>Coordinated roadside operations</Text>
                  <Text style={styles.heroTitle}>Emergency Roadside Assistance</Text>
                  <Text style={styles.heroText}>A professional response platform for motorists, field responders, and community stakeholders with live GPS coordination, structured dispatch workflows, and incident reporting.</Text>
                </View>

                <View style={styles.heroHighlights}>
                  <View style={styles.heroHighlightCard}>
                    <Text style={styles.heroHighlightValue}>Live dispatch</Text>
                    <Text style={styles.heroHighlightLabel}>Real-time request handling</Text>
                  </View>
                  <View style={styles.heroHighlightCard}>
                    <Text style={styles.heroHighlightValue}>Tracked response</Text>
                    <Text style={styles.heroHighlightLabel}>GPS-guided coordination</Text>
                  </View>
                </View>

                <View style={styles.heroButtons}>
                  <Pressable style={[styles.heroButton, styles.heroPrimary]} onPress={() => setScreen("user-login")}>
                    <Text style={styles.heroPrimaryText}>Get Help Now</Text>
                  </Pressable>
                  <View style={styles.heroButtonRow}>
                    <Pressable style={[styles.heroButton, styles.heroSecondary, styles.heroButtonSplit]} onPress={() => setScreen("agent-login")}>
                      <Text style={styles.heroSecondaryText}>Responder Access</Text>
                    </Pressable>
                    <Pressable style={[styles.heroButton, styles.heroTertiary, styles.heroButtonSplit]} onPress={() => setScreen("community-login")}>
                      <Text style={styles.heroTertiaryText}>Community Forum</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.heroMetrics}>
                  <View style={styles.heroMetricCard}>
                    <Text style={styles.heroMetricLabel}>Coverage</Text>
                    <Text style={styles.heroMetricValue}>Motorist, responder, community</Text>
                  </View>
                  <View style={styles.heroMetricCard}>
                    <Text style={styles.heroMetricLabel}>Operations</Text>
                    <Text style={styles.heroMetricValue}>Dispatch-ready workflows</Text>
                  </View>
                </View>
              </View>
            </ImageBackground>

            <View style={[styles.card, styles.roleCard]}>
            <View style={styles.roleHeader}>
              <View style={styles.roleSectionBadge}>
                <Text style={styles.roleSectionBadgeText}>Platform entry</Text>
              </View>
              <View>
                <Text style={styles.title}>Choose your mobile role</Text>
                <Text style={styles.roleSubtitle}>Select the workspace that matches your responsibility. Each path preserves the same system functions with a more polished professional presentation.</Text>
              </View>
            </View>

            <Pressable style={[styles.option, styles.optionActive, styles.roleOptionCard]} onPress={() => setScreen("user-login")}>
              <View style={styles.roleOptionTop}>
                <View style={[styles.roleIconShell, styles.roleIconMotorist]}>
                  <Text style={styles.roleIconText}>M</Text>
                </View>
                <View style={styles.roleContent}>
                  <View style={styles.roleTitleRow}>
                    <Text style={styles.optionTitle}>Motorist app</Text>
                    <View style={styles.roleBadgeRecommended}>
                      <Text style={styles.roleBadgeRecommendedText}>Primary access</Text>
                    </View>
                  </View>
                  <Text style={styles.text}>Nearby shops, emergency reporting, and live responder tracking.</Text>
                </View>
              </View>
              <View style={styles.roleTagRow}>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>Roadside help</Text>
                </View>
                <View style={styles.rolePillMuted}>
                  <Text style={styles.rolePillTextMuted}>Live ETA visibility</Text>
                </View>
              </View>
            </Pressable>

            <Pressable style={[styles.option, styles.roleOptionCard]} onPress={() => setScreen("agent-login")}>
              <View style={styles.roleOptionTop}>
                <View style={[styles.roleIconShell, styles.roleIconAgent]}>
                  <Text style={styles.roleIconText}>A</Text>
                </View>
                <View style={styles.roleContent}>
                  <View style={styles.roleTitleRow}>
                    <Text style={styles.optionTitle}>Responder app</Text>
                    <View style={styles.roleBadgeNeutral}>
                      <Text style={styles.roleBadgeNeutralText}>Operations</Text>
                    </View>
                  </View>
                  <Text style={styles.text}>Incoming requests, navigation, fee updates, and service stats.</Text>
                </View>
              </View>
              <View style={styles.roleTagRow}>
                <View style={styles.rolePillMuted}>
                  <Text style={styles.rolePillTextMuted}>Dispatch queue</Text>
                </View>
                <View style={styles.rolePillMuted}>
                  <Text style={styles.rolePillTextMuted}>Navigation tools</Text>
                </View>
              </View>
            </Pressable>

            <Pressable style={[styles.option, styles.roleOptionCard]} onPress={() => setScreen("community-login")}>
              <View style={styles.roleOptionTop}>
                <View style={[styles.roleIconShell, styles.roleIconCommunity]}>
                  <Text style={styles.roleIconText}>C</Text>
                </View>
                <View style={styles.roleContent}>
                  <View style={styles.roleTitleRow}>
                    <Text style={styles.optionTitle}>Community app</Text>
                    <View style={styles.roleBadgeNeutral}>
                      <Text style={styles.roleBadgeNeutralText}>Public channel</Text>
                    </View>
                  </View>
                  <Text style={styles.text}>Forum-only access for public discussions, local updates, and community concerns.</Text>
                </View>
              </View>
              <View style={styles.roleTagRow}>
                <View style={styles.rolePillMuted}>
                  <Text style={styles.rolePillTextMuted}>Community forum</Text>
                </View>
                <View style={styles.rolePillMuted}>
                  <Text style={styles.rolePillTextMuted}>Local updates</Text>
                </View>
              </View>
            </Pressable>
            </View>
          </>
        )}

        {screen === "user-login" && (
          <>
            <LoginCard badge="Motorist" title="User Login" subtitle="Access nearby shops, emergency reporting, and live dispatch tracking." identityLabel="Username or Mobile Number" identity={userIdentity} password={userPassword} errors={userErrors} loading={userLoginLoading} onBack={() => setScreen("role")} onIdentityChange={setUserIdentity} onPasswordChange={setUserPassword} onSubmit={loginUser} />
            <View style={styles.card}>
              <Text style={styles.text}>Need a new account?</Text>
              <Pressable style={styles.secondary} onPress={() => setScreen("user-register")}>
                <Text style={styles.secondaryText}>Create user account</Text>
              </Pressable>
            </View>
          </>
        )}

        {screen === "user-register" && (
          <View style={styles.card}>
            <View style={styles.between}>
              <Pressable style={styles.secondary} onPress={() => setScreen("user-login")}><Text style={styles.secondaryText}>Back</Text></Pressable>
              <Pill label="Create account" active />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.text}>Sign up to access roadside assistance on mobile.</Text>
            <Text style={styles.label}>Full name</Text>
            <TextInput value={registerForm.fullName} onChangeText={(value) => setRegisterForm((current) => ({ ...current, fullName: value }))} placeholder="Juan Dela Cruz" placeholderTextColor="#94a3b8" style={styles.input} />
            <Text style={styles.label}>Mobile number</Text>
            <TextInput value={registerForm.mobileNumber} onChangeText={(value) => setRegisterForm((current) => ({ ...current, mobileNumber: value }))} placeholder="+63 917 123 4567" placeholderTextColor="#94a3b8" keyboardType="phone-pad" style={styles.input} />
            <Text style={styles.label}>Username</Text>
            <TextInput value={registerForm.username} onChangeText={(value) => setRegisterForm((current) => ({ ...current, username: value }))} placeholder="Choose a username" placeholderTextColor="#94a3b8" autoCapitalize="none" style={styles.input} />
            <Text style={styles.label}>Password</Text>
            <TextInput value={registerForm.password} onChangeText={(value) => setRegisterForm((current) => ({ ...current, password: value }))} placeholder="Create a strong password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} />
            <Text style={styles.label}>Confirm password</Text>
            <TextInput value={registerForm.confirmPassword} onChangeText={(value) => setRegisterForm((current) => ({ ...current, confirmPassword: value }))} placeholder="Re-enter password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} />
            {registerError ? <Text style={styles.error}>{registerError}</Text> : null}
            <Pressable style={styles.primary} onPress={registerUser}><Text style={styles.primaryText}>Create account</Text></Pressable>
          </View>
        )}

        {screen === "agent-login" && (
          <>
            <LoginCard badge="Responder" title="Responder Login" subtitle="Manage requests, navigate to motorists, and update service status." identityLabel="Responder ID or Username" identity={agentIdentity} password={agentPassword} errors={agentErrors} loading={agentLoginLoading} onBack={() => setScreen("role")} onIdentityChange={setAgentIdentity} onPasswordChange={setAgentPassword} onSubmit={loginAgent} />
            <View style={styles.card}>
              <Text style={styles.text}>Not registered yet?</Text>
              <Pressable style={styles.secondary} onPress={() => setScreen("agent-register")}>
                <Text style={styles.secondaryText}>Apply as responder</Text>
              </Pressable>
            </View>
          </>
        )}

        {screen === "community-login" && (
          <>
            <LoginCard badge="Community" title="Community Login" subtitle="Join the semi forum to share updates, ask concerns, and help stranded motorists." identityLabel="Username or Mobile Number" identity={communityIdentity} password={communityPassword} errors={communityErrors} loading={communityLoginLoading} onBack={() => setScreen("role")} onIdentityChange={setCommunityIdentity} onPasswordChange={setCommunityPassword} onSubmit={loginCommunity} />
            <View style={styles.card}>
              <Text style={styles.text}>Need a new community account?</Text>
              <Pressable style={styles.secondary} onPress={() => setScreen("community-register")}>
                <Text style={styles.secondaryText}>Create community account</Text>
              </Pressable>
            </View>
          </>
        )}

        {screen === "community-register" && (
          <View style={styles.card}>
            <View style={styles.between}>
              <Pressable style={styles.secondary} onPress={() => setScreen("community-login")}><Text style={styles.secondaryText}>Back</Text></Pressable>
              <Pill label="Community account" active />
            </View>
            <Text style={styles.title}>Create Community Account</Text>
            <Text style={styles.text}>Sign up for forum-only access so you can help with local roadside concerns.</Text>
            <Text style={styles.label}>Full name</Text>
            <TextInput value={registerForm.fullName} onChangeText={(value) => setRegisterForm((current) => ({ ...current, fullName: value }))} placeholder="Juan Dela Cruz" placeholderTextColor="#94a3b8" style={styles.input} />
            <Text style={styles.label}>Mobile number</Text>
            <TextInput value={registerForm.mobileNumber} onChangeText={(value) => setRegisterForm((current) => ({ ...current, mobileNumber: value }))} placeholder="+63 917 123 4567" placeholderTextColor="#94a3b8" keyboardType="phone-pad" style={styles.input} />
            <Text style={styles.label}>Username</Text>
            <TextInput value={registerForm.username} onChangeText={(value) => setRegisterForm((current) => ({ ...current, username: value }))} placeholder="Choose a username" placeholderTextColor="#94a3b8" autoCapitalize="none" style={styles.input} />
            <Text style={styles.label}>Password</Text>
            <TextInput value={registerForm.password} onChangeText={(value) => setRegisterForm((current) => ({ ...current, password: value }))} placeholder="Create a strong password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} />
            <Text style={styles.label}>Confirm password</Text>
            <TextInput value={registerForm.confirmPassword} onChangeText={(value) => setRegisterForm((current) => ({ ...current, confirmPassword: value }))} placeholder="Re-enter password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} />
            {registerError ? <Text style={styles.error}>{registerError}</Text> : null}
            <Pressable style={styles.primary} onPress={registerCommunity}><Text style={styles.primaryText}>Create community account</Text></Pressable>
          </View>
        )}

        {screen === "agent-register" && (
          <View style={styles.card}>
            <View style={styles.between}>
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  if (agentRegisterStep === "credentials") {
                    setAgentRegisterStep("info");
                    return;
                  }
                  setScreen("agent-login");
                }}
              >
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pill label={`Step ${agentRegisterStep === "info" ? "1" : "2"}`} active />
            </View>

            {agentRegisterStep === "info" ? (
              <>
                <Text style={styles.title}>Responder Registration</Text>
                <Text style={styles.text}>Step 1: Business information</Text>
                <Text style={styles.label}>Owner's full name</Text>
                <TextInput value={agentRegisterForm.ownerName} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, ownerName: value }))} placeholder="Juan Dela Cruz" placeholderTextColor="#94a3b8" style={styles.input} />
                <Text style={styles.label}>Mobile number</Text>
                <TextInput value={agentRegisterForm.mobileNumber} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, mobileNumber: value }))} placeholder="+63 917 123 4567" placeholderTextColor="#94a3b8" keyboardType="phone-pad" style={styles.input} />
                <Text style={styles.label}>Organization / group</Text>
                <TextInput value={agentRegisterForm.organizationName} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, organizationName: value }))} placeholder="e.g. John's Talyer or Maritoda" placeholderTextColor="#94a3b8" style={styles.input} />
                <Text style={styles.label}>Service category</Text>
                <View style={styles.rowWrap}>
                  {["mechanic", "vulcanizing", "towing"].map((category) => (
                    <Chip
                      key={category}
                      label={category}
                      active={agentRegisterForm.serviceCategories.includes(category)}
                      onPress={() =>
                        setAgentRegisterForm((current) => ({
                          ...current,
                          serviceCategories: current.serviceCategories.includes(category)
                            ? current.serviceCategories.filter((item) => item !== category)
                            : [...current.serviceCategories, category],
                        }))
                      }
                    />
                  ))}
                </View>
                <Text style={styles.label}>Service area coverage</Text>
                <TextInput value={agentRegisterForm.serviceArea} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, serviceArea: value }))} placeholder="e.g. San Pablo City, Alaminos, Bay" placeholderTextColor="#94a3b8" style={styles.input} />
                <Text style={styles.label}>Username</Text>
                <TextInput value={agentRegisterForm.username} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, username: value }))} placeholder="Choose a username" placeholderTextColor="#94a3b8" autoCapitalize="none" style={styles.input} />
                <Text style={styles.label}>Password</Text>
                <TextInput value={agentRegisterForm.password} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, password: value }))} placeholder="Create password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} />
                <Pressable
                  style={[styles.option, agentRegisterForm.liabilityAcknowledged && styles.optionActive]}
                  onPress={() => setAgentRegisterForm((current) => ({ ...current, liabilityAcknowledged: !current.liabilityAcknowledged }))}
                >
                  <Text style={styles.optionTitle}>
                    {agentRegisterForm.liabilityAcknowledged ? "Liability declaration acknowledged" : "Acknowledge liability declaration"}
                  </Text>
                  <Text style={styles.text}>
                    I confirm that I will provide accurate responder credentials and payout details for Soteria automated service transfers.
                  </Text>
                </Pressable>
                {agentRegisterError ? <Text style={styles.error}>{agentRegisterError}</Text> : null}
                <Pressable style={styles.primary} onPress={continueAgentRegisterInfo}>
                  <Text style={styles.primaryText}>Continue to credential upload</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.title}>Credential Submission</Text>
                <Text style={styles.text}>Step 2: Upload required documents</Text>
                {[
                  ["driversLicense", "Professional Driver's License"],
                  ["vehicleRegistration", "Vehicle Registration (OR/CR)"],
                  ["insurance", "Proof of Insurance"],
                  ["nbiClearance", "NBI Clearance"],
                ].map(([key, label]) => (
                  <View key={key} style={styles.list}>
                    <Text style={styles.listTitle}>{label}</Text>
                    <Text style={styles.text}>
                      {credentialFiles[key as keyof CredentialFiles]?.name ?? "No file selected yet"}
                    </Text>
                    <Pressable style={styles.secondary} onPress={() => pickCredentialFile(key as keyof CredentialFiles)}>
                      <Text style={styles.secondaryText}>Upload file</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={styles.alert}>
                  <Text style={styles.alertTitle}>Admin review</Text>
                  <Text style={styles.alertText}>All documents will be reviewed by administrators before your responder account is approved.</Text>
                </View>
                {agentRegisterError ? <Text style={styles.error}>{agentRegisterError}</Text> : null}
                <Pressable style={styles.primary} onPress={submitAgentRegistration}>
                  <Text style={styles.primaryText}>Submit application</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {screen === "user-app" && (
          <>
            <TopCard title={`Hello, ${userName}`} subtitle="Roadside help, maps, and live dispatch updates" onExit={() => setScreen("role")} />
            <Tabs active={userTab} setActive={setUserTab} labels={{ subscription: "Subscription", explore: "Explore", emergency: "Emergency", tracking: "Tracking", forum: "Forum" }} />

            {userTab === "subscription" && (
            <ExpandableCard
              title="Soteria Credits & Subscription"
              subtitle={
                motoristSubscriptionStatus === "active"
                  ? `Subscription active on the ${formatSubscriptionPlanLabel(motoristSubscriptionPlan)} offer. Priority handling, lower commission, and premium service records are unlocked.`
                  : "Top up Soteria Credits, then choose a plan for lower commission, priority handling, and richer service documentation."
              }
              expanded={Boolean(expandedSections.motoristSubscription)}
              onToggle={() => toggleSection("motoristSubscription")}
              summaryRight={
                <Pill
                  label={
                    motoristSubscriptionStatus === "active"
                      ? formatSubscriptionPlanLabel(motoristSubscriptionPlan)
                      : "Free"
                  }
                  active={motoristSubscriptionStatus === "active"}
                />
              }
            >
              <View style={styles.subscriptionCard}>
                <View style={styles.between}>
                  <View style={styles.flex}>
                    <Text style={styles.label}>Soteria Credits balance</Text>
                    <Text style={styles.valueBig}>{formatCurrencyAmount(soteriaCreditBalance)}</Text>
                    <Text style={styles.text}>Credits can be used for subscription plans and roadside service payments.</Text>
                  </View>
                  <Pill label="In-app currency" active />
                </View>
                <View style={styles.rowWrap}>
                  {[100, 300, 500, 1000].map((amount) => (
                    <Pressable
                      key={amount}
                      style={[styles.secondary, creditTopUpSubmitting && styles.buttonDisabled]}
                      onPress={() => void topUpCredits(amount)}
                      disabled={creditTopUpSubmitting}
                    >
                      <Text style={styles.secondaryText}>
                        {creditTopUpSubmitting ? "Processing..." : `Top up PHP ${amount}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.subscriptionOverviewGrid}>
                <View style={styles.subscriptionOverviewCard}>
                  <Text style={styles.subscriptionOverviewLabel}>Current plan</Text>
                  <Text style={styles.subscriptionOverviewValue}>
                    {motoristSubscriptionStatus === "active"
                      ? formatSubscriptionPlanLabel(motoristSubscriptionPlan)
                      : "Free"}
                  </Text>
                  <Text style={styles.text}>Responder access: wide-range matching for all motorists</Text>
                </View>
                <View style={styles.subscriptionOverviewCard}>
                  <Text style={styles.subscriptionOverviewLabel}>Access level</Text>
                  <Text style={styles.subscriptionOverviewValue}>
                    {motoristSubscriptionStatus === "active"
                      ? activeSubscriptionOfferDetails?.accessLevel ?? "Premium"
                      : "Basic"}
                  </Text>
                  <Text style={styles.text}>
                    {motoristSubscriptionStatus === "active"
                      ? activeSubscriptionOfferDetails?.activeSummary ?? "Priority assistance, photo reports, and lower commission are enabled."
                      : "Upgrade for lower commission, priority support, and richer triage records."}
                  </Text>
                </View>
              </View>
              {motoristSubscriptionStatus !== "active" ? (
                <View style={styles.subscriptionCard}>
                  <View style={styles.rowWrap}>
                    {subscriptionOffers.map((offer) => (
                      <Chip
                        key={offer.value}
                        label={`${offer.label} • ${offer.price}`}
                        active={selectedSubscriptionOffer === offer.value}
                        onPress={() => setSelectedSubscriptionOffer(offer.value)}
                      />
                    ))}
                  </View>
                  <View style={styles.subscriptionPlansStack}>
                    {subscriptionOffers.map((offer) => (
                      <Pressable
                        key={`${offer.value}-details`}
                        style={[styles.subscriptionPlanCard, selectedSubscriptionOffer === offer.value && styles.subscriptionPlanCardActive]}
                        onPress={() => setSelectedSubscriptionOffer(offer.value)}
                      >
                        <View style={styles.between}>
                          <View style={styles.flex}>
                            <View style={styles.subscriptionTitleRow}>
                              <Text style={styles.subscriptionPlanTitle}>{offer.label}</Text>
                              <View style={styles.subscriptionPlanBadge}>
                                <Text style={styles.subscriptionPlanBadgeText}>{offer.badge}</Text>
                              </View>
                            </View>
                            <Text style={styles.subscriptionPlanTagline}>{offer.tagline}</Text>
                          </View>
                          <View style={styles.subscriptionPlanPriceWrap}>
                            <Text style={styles.subscriptionPlanPrice}>{offer.price}</Text>
                            <Text style={styles.subscriptionPlanPriceMeta}>per plan</Text>
                          </View>
                        </View>
                        <Text style={styles.text}>{offer.description}</Text>
                        <View style={styles.rowWrap}>
                          {offer.highlights.map((highlight) => (
                            <Pill
                              key={`${offer.value}-${highlight}`}
                              label={highlight}
                              active={selectedSubscriptionOffer === offer.value}
                            />
                          ))}
                        </View>
                        <View style={styles.subscriptionFeatureList}>
                          {offer.features.map((feature) => (
                            <View key={feature} style={styles.subscriptionFeatureItem}>
                              <Text style={styles.subscriptionFeatureBullet}>-</Text>
                              <Text style={styles.text}>{feature}</Text>
                            </View>
                          ))}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.label}>
                      {selectedSubscriptionOfferDetails.label} plan
                    </Text>
                    <Text style={styles.text}>{selectedSubscriptionOfferDetails.description}</Text>
                    <Text style={styles.text}>
                      Pay using Soteria Credits or direct online payment. Both methods activate automatically after confirmation.
                    </Text>
                    <Text style={styles.label}>Payment method</Text>
                    <View style={styles.rowWrap}>
                      <Chip
                        label="Use Credits"
                        active={subscriptionPaymentMethod === "soteria_credits"}
                        onPress={() => setSubscriptionPaymentMethod("soteria_credits")}
                      />
                      <Chip
                        label="Pay Online"
                        active={subscriptionPaymentMethod === "online_payment"}
                        onPress={() => setSubscriptionPaymentMethod("online_payment")}
                      />
                    </View>
                    <Pressable
                      style={[styles.primary, subscriptionPaymentSubmitting && styles.buttonDisabled]}
                      onPress={() => void submitSubscriptionPayment()}
                      disabled={subscriptionPaymentSubmitting}
                    >
                      <Text style={styles.primaryText}>
                        {subscriptionPaymentSubmitting
                          ? "Processing..."
                          : subscriptionPaymentMethod === "online_payment"
                            ? "Pay online and activate"
                            : "Pay with credits and activate"}
                      </Text>
                    </Pressable>
                    {latestSubscriptionPayment ? (
                      <View style={styles.subscriptionStatusCard}>
                        <Text style={styles.label}>Latest credits payment</Text>
                        <Text style={styles.text}>
                          {formatSubscriptionPlanLabel(latestSubscriptionPayment.subscriptionPlan)} - PHP {latestSubscriptionPayment.amount}
                        </Text>
                        <Text style={styles.text}>
                          Status: {latestSubscriptionPayment.status === "confirmed" ? "Credits deducted and activated" : latestSubscriptionPayment.status}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.subscriptionCard}>
                  <View style={styles.subscriptionCardHeader}>
                    <View style={styles.flex}>
                      <Text style={styles.label}>Active plan</Text>
                      <Text style={styles.valueBig}>{formatSubscriptionPlanLabel(motoristSubscriptionPlan)}</Text>
                      <Text style={styles.text}>
                        Expiry: {motoristSubscriptionExpiresAt ? formatForumTimestamp(motoristSubscriptionExpiresAt) : "Not available"}
                      </Text>
                    </View>
                    {activeSubscriptionOfferDetails ? (
                      <View style={styles.subscriptionPriceBadge}>
                        <Text style={styles.subscriptionPriceBadgeText}>{activeSubscriptionOfferDetails.accessLevel}</Text>
                      </View>
                    ) : null}
                  </View>
                  {activeSubscriptionOfferDetails ? (
                    <>
                      <Text style={styles.text}>{activeSubscriptionOfferDetails.activeSummary}</Text>
                      <View style={styles.rowWrap}>
                        {activeSubscriptionOfferDetails.highlights.map((highlight) => (
                          <Pill key={`active-${highlight}`} label={highlight} active />
                        ))}
                      </View>
                      <View style={styles.subscriptionFeatureList}>
                        {activeSubscriptionOfferDetails.features.map((feature) => (
                          <View key={`active-${feature}`} style={styles.subscriptionFeatureItem}>
                            <Text style={styles.subscriptionFeatureBullet}>-</Text>
                            <Text style={styles.text}>{feature}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <View style={styles.subscriptionFeatureList}>
                      <View style={styles.subscriptionFeatureItem}>
                        <Text style={styles.subscriptionFeatureBullet}>-</Text>
                        <Text style={styles.text}>Wide-range responder matching remains available</Text>
                      </View>
                      <View style={styles.subscriptionFeatureItem}>
                        <Text style={styles.subscriptionFeatureBullet}>-</Text>
                        <Text style={styles.text}>Priority support routing remains enabled while active</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ExpandableCard>
            )}

            {userTab === "explore" && (
              <>
                <ExpandableCard
                  title="Booking history"
                  subtitle="Open completed requests and submitted feedback only when you need to review them."
                  expanded={Boolean(expandedSections.motoristHistory)}
                  onToggle={() => toggleSection("motoristHistory")}
                >
                  {motoristHistory.length ? motoristHistory.slice(0, 3).map((item) => (
                    <View key={item.id} style={styles.list}>
                      <Text style={styles.listTitle}>{item.serviceLabel}</Text>
                      <Text style={styles.text}>{item.counterpartName}</Text>
                      <Text style={styles.text}>
                        Your feedback: {item.viewerFeedback?.overallRating ?? 0}/5
                        {item.counterpartFeedback ? ` | Responder feedback: ${item.counterpartFeedback.overallRating}/5` : ""}
                      </Text>
                      <Text style={styles.text}>
                        {item.completedAt ? formatForumTimestamp(item.completedAt) : "Completed job"}
                      </Text>
                    </View>
                  )) : (
                    <Text style={styles.text}>Completed bookings with submitted feedback will appear here.</Text>
                  )}
                </ExpandableCard>
                <MapCard
                  title="Nearby repair shops"
                  subtitle={`${filteredShops.length} shops near your location`}
                  center={userLocation}
                  markers={[
                    {
                      id: "you",
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude,
                      title: "You",
                      color: "#fb923c",
                    },
                    ...filteredShops.map((shop) => ({
                      id: shop.id,
                      latitude: shop.coord.latitude,
                      longitude: shop.coord.longitude,
                      title: shop.name,
                      description: shop.address,
                      color: shop.id === selectedShop?.id ? "#fb923c" : "#38bdf8",
                    })),
                  ]}
                />
                <View style={styles.rowWrap}>
                  <Chip label="All" active={shopFilter === "all"} onPress={() => setShopFilter("all")} />
                  {categories.map(([value, label]) => <Chip key={value} label={label} active={shopFilter === value} onPress={() => setShopFilter(value)} />)}
                </View>
                {selectedShop ? (
                  <View style={styles.card}>
                    <Text style={styles.title}>{selectedShop.name}</Text>
                    <Text style={styles.text}>{SERVICE_CATEGORY_LABELS[selectedShop.category]} - {selectedShop.address}</Text>
                    <View style={styles.rowWrap}>
                      <Pill label={`${selectedShop.rating} rating`} />
                      <Pill label={`${selectedShop.distanceKm} km`} />
                      <Pill label={selectedShop.responseTime} />
                    </View>
                    <View style={styles.rowWrap}>
                      {selectedShop.services.map((service) => <Info key={service} label={service} />)}
                    </View>
                    <Pressable style={styles.primary} onPress={() => {
                      setServiceType(selectedShop.category === "towing" ? "transport" : "repair");
                      setIssueSummary(`${selectedShop.name} selected from shop discovery`);
                      setUserTab("emergency");
                    }}>
                      <Text style={styles.primaryText}>Request from this provider</Text>
                    </Pressable>
                  </View>
                ) : null}
                {filteredShops.map((shop) => (
                  <Pressable key={shop.id} style={[styles.list, selectedShopId === shop.id && styles.listActive]} onPress={() => setSelectedShopId(shop.id)}>
                    <View style={styles.between}>
                      <Text style={styles.listTitle}>{shop.name}</Text>
                      <Text style={styles.value}>{shop.distanceKm} km</Text>
                    </View>
                    <Text style={styles.text}>{SERVICE_CATEGORY_LABELS[shop.category]} - {shop.address}</Text>
                    <Text style={styles.text}>Response {shop.responseTime} - {shop.openNow ? "Open now" : "Closed"}</Text>
                  </Pressable>
                ))}
              </>
            )}

            {userTab === "emergency" && (
              <>
                <View style={styles.inlineBack}>
                  <Pressable style={styles.secondary} onPress={() => setUserTab("explore")}><Text style={styles.secondaryText}>Back to explore</Text></Pressable>
                </View>
                <MapCard
                  title="Emergency reporting"
                  subtitle="Pin your location and choose the help you need"
                  center={userLocation}
                  markers={[{
                    id: "pinned-location",
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    title: "Pinned location",
                    color: "#fb923c",
                  }]}
                />
                <View style={styles.card}>
                  <View style={styles.between}>
                    <View style={styles.flex}>
                      <Text style={styles.label}>Detected location</Text>
                      <Text style={styles.text}>{locationLabel}</Text>
                    </View>
                    <Pressable style={styles.secondary} onPress={detectLocation}>
                      <Text style={styles.secondaryText}>{detecting ? "Detecting..." : "Auto-detect"}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.label}>Issue summary</Text>
                  <TextInput value={issueSummary} onChangeText={setIssueSummary} placeholder="Describe the issue" placeholderTextColor="#94a3b8" multiline style={[styles.input, styles.multiline]} />
                  <Text style={styles.label}>Service type</Text>
                  {[
                    ["repair", "Repair / Mechanical", "Flat tire, battery issue, overheating, and roadside repair."],
                    ["transport", "Transport Rescue / Towing", "Vehicle needs towing or transport to a repair shop."],
                  ].map(([value, title, description]) => (
                    <Pressable key={value} style={[styles.option, serviceType === value && styles.optionActive]} onPress={() => setServiceType(value as "repair" | "transport")}>
                      <Text style={styles.optionTitle}>{title}</Text>
                      <Text style={styles.text}>{description}</Text>
                    </Pressable>
                  ))}
                  <Pressable style={styles.primary} onPress={continueEmergency}><Text style={styles.primaryText}>Continue to live tracking</Text></Pressable>
                </View>
              </>
            )}

            {userTab === "tracking" && (
              liveDispatchId ? (
                <MotorietTrackingScreen
                  dispatchId={liveDispatchId}
                  motoristLocation={userLocation}
                  motoristName={userName}
                  motoristUserId={userId}
                />
              ) : (
                <View style={styles.card}>
                  <Text style={styles.title}>Tracking your request</Text>
                  <Text style={styles.text}>
                    We have saved your rescue request locally and are waiting for the live dispatch record to become available.
                  </Text>
                  <Text style={styles.text}>
                    {backendMessage || "A responder can still receive your request once the backend sync finishes."}
                  </Text>
                </View>
              )
            )}

            {userTab === "forum" && (
              <ForumPanel
                role="motorist"
                threads={forumThreads}
                loading={forumLoading}
                error={forumError}
                title={forumTitle}
                body={forumBody}
                topic={forumTopic}
                posting={forumPosting}
                replyDrafts={forumReplyDrafts}
                replyingId={forumReplyingId}
                onTitleChange={setForumTitle}
                onBodyChange={setForumBody}
                onTopicChange={setForumTopic}
                onSubmitPost={() => void submitForumPost()}
                onReplyDraftChange={(threadId, value) =>
                  setForumReplyDrafts((current) => ({ ...current, [threadId]: value }))
                }
                onSubmitReply={(threadId) => void submitForumReply(threadId)}
              />
            )}
          </>
        )}

        {screen === "user-triage" && (
          <View style={styles.card}>
            <View style={styles.between}>
              <Pressable style={styles.secondary} onPress={() => {
                setScreen("user-app");
                setUserTab("emergency");
              }}><Text style={styles.secondaryText}>Back</Text></Pressable>
              <Pill label="Symptom triage" active />
            </View>
            <Text style={styles.title}>Symptom-Based Triage</Text>
            <Text style={styles.text}>Select all symptoms to help us match you with the right specialist.</Text>
            <View style={styles.stack}>
              {mechanicalSymptoms.map((symptom) => (
                <Pressable key={symptom} style={[styles.option, selectedSymptoms.includes(symptom) && styles.optionActive]} onPress={() => toggleSymptom(symptom)}>
                  <Text style={styles.optionTitle}>{symptom}</Text>
                  <Text style={styles.text}>{selectedSymptoms.includes(symptom) ? "Selected for triage" : "Tap to include this symptom in your report."}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Additional details</Text>
            <TextInput value={triageDescription} onChangeText={setTriageDescription} placeholder="Describe the problem in more detail..." placeholderTextColor="#94a3b8" multiline style={[styles.input, styles.multiline]} />
            <View style={styles.between}>
              <View style={styles.flex}>
                <Text style={styles.label}>Photo attachments</Text>
                <Text style={styles.text}>
                  {motoristSubscriptionStatus === "active"
                    ? (triagePhotos.length > 0 ? `${triagePhotos.length} photo(s) selected` : "Optional photos help responders diagnose faster.")
                    : "Locked for free users. Subscribe to unlock photo upload."}
                </Text>
              </View>
              {motoristSubscriptionStatus === "active" ? (
                <Pressable style={styles.secondary} onPress={pickTriagePhoto}>
                  <Text style={styles.secondaryText}>Add photos</Text>
                </Pressable>
              ) : (
                <View style={styles.lockedPill}>
                  <Text style={styles.lockedPillText}>Locked</Text>
                </View>
              )}
            </View>
            <View style={styles.alert}>
              <Text style={styles.alertTitle}>Symptom classification</Text>
              <Text style={styles.alertText}>Your selected symptoms will be used to match you with the most appropriate rescue responder.</Text>
            </View>
            <Pressable style={styles.primary} onPress={continueFromTriage}><Text style={styles.primaryText}>Find rescue responder</Text></Pressable>
          </View>
        )}

        {screen === "user-finding-agent" && (
          <View style={styles.card}>
            <View style={styles.between}>
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  setScreen("user-triage");
                }}
              >
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pill label="Responder match" active />
            </View>
            <Text style={styles.title}>Find Rescue Responder</Text>
            <Text style={styles.text}>
              {findingAgent
                ? "Searching for the nearest approved responder in your area."
                : "Review the matched responder and send your rescue request."}
            </Text>
            {findingAgent ? (
              <View style={styles.list}>
                <Text style={styles.listTitle}>Matching in progress</Text>
                <Text style={styles.text}>We are checking nearby available responders.</Text>
              </View>
            ) : matchedAgent ? (
              <>
                <View style={styles.cardMuted}>
                  <Text style={styles.title}>{matchedAgent.name}</Text>
                  <Text style={styles.text}>{SERVICE_CATEGORY_LABELS[matchedAgent.category]}</Text>
                  <View style={styles.rowWrap}>
                    <Pill label={`${matchedAgent.distanceKm.toFixed(1)} km away`} />
                    <Pill label={`${matchedAgent.rating.toFixed(1)} rating`} />
                  </View>
                  <View style={styles.rowWrap}>
                    {matchedAgent.services.map((service) => (
                      <Info key={service} label={service} />
                    ))}
                  </View>
                </View>
                <Pressable
                  style={[styles.primary, requestSubmitting && styles.buttonDisabled]}
                  onPress={requestRescue}
                  disabled={requestSubmitting}
                >
                  <Text style={styles.primaryText}>
                    {requestSubmitting ? "Sending request..." : "Send rescue request"}
                  </Text>
                </Pressable>
                <Pressable style={styles.secondary} onPress={findAnotherAgent}>
                  <Text style={styles.secondaryText}>Find another responder</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.error}>{agentSearchError || "No matching responder is available yet."}</Text>
                <Pressable style={styles.secondary} onPress={continueFromTriage}>
                  <Text style={styles.secondaryText}>Retry search</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {screen === "agent-app" && (
          <>
            <TopCard title={`Responder Hub - ${agentName}`} subtitle="Requests, navigation, and performance" onExit={() => setScreen("role")} />
            <View style={styles.card}>
              <View style={styles.between}>
                <View style={styles.flex}>
                  <Text style={styles.title}>{availability ? "You are online" : "You are offline"}</Text>
                  <Text style={styles.text}>{availability ? "Receiving nearby requests from motorists." : "Go online to receive new dispatches."}</Text>
                </View>
                <Switch value={availability} onValueChange={setAvailability} trackColor={{ false: "#475569", true: "#fb923c" }} />
              </View>
            </View>
            <Tabs active={agentTab} setActive={setAgentTab} labels={{ requests: "Requests", navigation: "Navigation", stats: "Stats", profile: "Profile", forum: "Forum" }} />

            {agentTab === "requests" && (
              <>
                <View style={styles.double}>
                  <Mini title="Open jobs" value={`${openAgentDispatches.length}`} />
                  <Mini title="Open earnings" value="PHP 0" accent="#fb923c" />
                </View>
                {agentId ? (
                  <>
                    <MapCard
                      title="Your location"
                      subtitle="Auto-detect your current GPS location"
                      center={agentLocation}
                      markers={[{
                        id: "agent-location",
                        latitude: agentLocation.latitude,
                        longitude: agentLocation.longitude,
                        title: "Your location",
                        color: "#22c55e",
                      }]}
                    />
                    <View style={styles.card}>
                      <View style={styles.between}>
                        <View style={styles.flex}>
                          <Text style={styles.label}>Detected location</Text>
                          <Text style={styles.text}>Near {agentLocation.latitude.toFixed(4)}, {agentLocation.longitude.toFixed(4)}</Text>
                        </View>
                        <Pressable style={styles.secondary} onPress={detectAgentLocation} disabled={detecting}>
                          <Text style={styles.secondaryText}>{detecting ? "Detecting..." : "Auto-detect"}</Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                ) : null}
                {!availability ? (
                  <Empty title="You are offline" subtitle="Enable availability to receive nearby rescue requests." />
                ) : (
                  pendingAgentDispatches.length > 0 ? (
                    pendingAgentDispatches.map((dispatch) => (
                      <View key={dispatch.id} style={styles.list}>
                        <View style={styles.between}>
                          <Text style={styles.listTitle}>{dispatch.motorist?.fullName ?? "Motorist"}</Text>
                          <Text style={styles.value}>{dispatch.dispatchStatus}</Text>
                        </View>
                        <Text style={styles.text}>{dispatch.motorist?.issueSummary || "Emergency assistance requested."}</Text>
                        <Text style={styles.text}>
                          {dispatch.motorist ? `${dispatch.motorist.latitude.toFixed(4)}, ${dispatch.motorist.longitude.toFixed(4)}` : "Location unavailable"}
                        </Text>
                        {dispatch.motorist?.symptoms?.length ? (
                          <View style={styles.rowWrap}>
                            {dispatch.motorist.symptoms.map((symptom: string) => (
                              <Info key={symptom} label={symptom} />
                            ))}
                          </View>
                        ) : null}
                        <View style={styles.between}>
                          <Pressable
                            style={styles.secondary}
                            onPress={() => {
                              if (!agentId) return;
                              void (async () => {
                                try {
                                  await declineDispatch(dispatch.id, agentId);
                                  const refreshedDispatches = await fetchAgentDispatches(agentId);
                                  setAgentDispatches(refreshedDispatches);
                                } catch (error) {
                                  console.warn("Failed to decline dispatch:", error);
                                  Alert.alert("Decline failed", "Could not decline this dispatch right now.");
                                }
                              })();
                            }}
                          >
                            <Text style={styles.secondaryText}>Decline</Text>
                          </Pressable>
                          <Pressable style={styles.primary} onPress={() => void acceptRequest(dispatch.id)}>
                            <Text style={styles.primaryText}>Accept request</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Empty title="No pending requests" subtitle="New dispatches will appear here once a motorist is matched to you." />
                  )
                )}
              </>
            )}

            {agentTab === "navigation" && (
              activeAgentRequest ? (
                <>
                  <View style={styles.inlineBack}>
                    <Pressable style={styles.secondary} onPress={() => setAgentTab("requests")}><Text style={styles.secondaryText}>Back to requests</Text></Pressable>
                  </View>
                  <MapCard
                    title="Navigation"
                    subtitle={`${activeAgentRequest.motorist?.fullName || activeAgentRequest.motorist} - Navigate to location`}
                    center={navigationMapCenter}
                    route={route}
                    markers={[
                      {
                        id: "motorist",
                        latitude: activeMotoristLocation.latitude,
                        longitude: activeMotoristLocation.longitude,
                        title: "Motorist",
                        color: "#fb923c",
                      },
                      {
                        id: "responder",
                        latitude: agentLocation.latitude,
                        longitude: agentLocation.longitude,
                        title: "Responder",
                        color: "#22c55e",
                      },
                    ]}
                  />
                  <View style={styles.double}>
                    <Mini title="Distance" value={`${navigationDistance.toFixed(1)} km`} />
                    <Mini title="ETA" value={`${Math.ceil(navigationETA)} min`} accent="#fb923c" />
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.title}>Motorist details</Text>
                    <Text style={styles.text}>{activeAgentRequest.motorist.fullName}</Text>
                    <Text style={styles.text}>{activeAgentRequest.motorist.issueSummary || activeAgentRequest.motorist.locationLabel}</Text>
                    <Text style={styles.text}>Phone {activeAgentRequest.motorist.phone}</Text>
                    {activeAgentRequest.motorist.symptoms.length ? <View style={styles.rowWrap}>{activeAgentRequest.motorist.symptoms.map((symptom) => <Info key={symptom} label={symptom} />)}</View> : null}
                  </View>
                  <View style={styles.card}>
                    <View style={styles.between}>
                      <View style={styles.flex}>
                        <Text style={styles.label}>Estimated fee</Text>
                        {editingFee ? <TextInput value={feeDraft} onChangeText={setFeeDraft} style={styles.input} /> : <Text style={styles.valueBig}>{fee}</Text>}
                      </View>
                      <Pressable style={styles.secondary} onPress={() => {
                        if (editingFee) setFee(feeDraft);
                        setEditingFee((current) => !current);
                      }}>
                        <Text style={styles.secondaryText}>{editingFee ? "Save fee" : "Edit fee"}</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.text}>The motorist will choose Soteria Credits or PayMongo after you request payment.</Text>
                    <Tabs active={navStatus} setActive={setNavStatus} labels={{ "en-route": "En route", arrived: "Arrived", working: "Working" }} />
                    {navStatus === "working" && (
                      <Pressable style={styles.success} onPress={() => {
                        // Clear UI state immediately - don't wait for backend
                        const completedId = activeAgentRequest?.id;
                        setActiveDispatchId(null);
                        if (activeAgentRequest) {
                          setAgentDispatches((current) => current.filter((item) => item.id !== activeAgentRequest.id));
                        }
                        setAgentTab("requests");

                        if (activeRequestId === liveRequestId) {
                          setTrackingStatus("completed");
                        }
                        if (activeRequest) {
                          setJobHistory((current) => [
                            `${activeRequest.symptoms[0] ?? "Service"} - ${activeRequest.motorist} - ${fee}`,
                            ...current,
                          ]);
                          setRequests((current) => current.filter((item) => item.id !== activeRequest.id));
                        }
                        Alert.alert(
                          "Payment requested",
                          "The service amount was sent to the motorist. They can now pay with Soteria Credits or PayMongo.",
                        );

                        // Update backend in background
                        if (completedId && agentId) {
                          (async () => {
                            try {
                              await completeDispatch(completedId, parseCurrencyAmount(fee));
                              const refreshedDispatches = await fetchAgentDispatches(agentId);
                              const refreshedHistory = await fetchDispatchHistory(agentId, "agent");
                              setAgentDispatches(refreshedDispatches);
                              setAgentHistory(refreshedHistory);
                            } catch (error) {
                              console.warn("Failed to complete job on backend:", error);
                              Alert.alert(
                                "Could not request payment",
                                error instanceof Error
                                  ? error.message
                                  : "Ask the motorist to stay on the tracking screen and try again.",
                              );
                            }
                          })();
                        }
                      }}>
                        <Text style={styles.successText}>Mark job completed</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              ) : <Empty title="No accepted request yet" subtitle="Accept a request first to open the navigation flow." />
            )}

            {agentTab === "stats" && (
              <>
                <View style={styles.double}>
                  <Mini title="Completed earnings" value={formatCurrencyAmount(completedAgentEarnings)} accent="#fb923c" />
                  <Mini title="Average rating" value="4.8 / 5" />
                </View>
                <View style={styles.card}>
                  <Text style={styles.title}>Recent job history</Text>
                  {agentHistory.length ? agentHistory.slice(0, 4).map((item) => (
                    <View key={item.id} style={styles.list}>
                      <Text style={styles.listTitle}>{item.serviceLabel}</Text>
                      <Text style={styles.text}>{item.counterpartName}</Text>
                      <Text style={styles.text}>Earned: {formatCurrencyAmount(item.payment?.serviceAmount ?? 0)}</Text>
                      <Text style={styles.text}>
                        Your feedback: {item.viewerFeedback?.overallRating ?? 0}/5
                        {item.counterpartFeedback ? ` | Motorist feedback: ${item.counterpartFeedback.overallRating}/5` : ""}
                      </Text>
                      <Text style={styles.text}>
                        {item.completedAt ? formatForumTimestamp(item.completedAt) : "Completed job"}
                      </Text>
                    </View>
                  )) : (
                    <Text style={styles.text}>Completed jobs will appear here with the real earned amount.</Text>
                  )}
                </View>
              </>
            )}

            {agentTab === "profile" && (
              <>
                <ExpandableCard
                  title="Responder Profile"
                  subtitle="Open responder identity and organization details when you need to review them."
                  expanded={Boolean(expandedSections.agentProfile)}
                  onToggle={() => toggleSection("agentProfile")}
                >
              <Text style={styles.text}>Motorist service payments can use Soteria Credits or direct online payment. The system deducts Soteria commission and transfers the net payout to your responder wallet automatically.</Text>
                  <View style={styles.subscriptionStatusCard}>
                    <Text style={styles.label}>Responder</Text>
                    <Text style={styles.text}>{agentPaymentProfile?.fullName || agentName}</Text>
                    <Text style={styles.text}>Business: {agentPaymentProfile?.businessName || agentName}</Text>
                    <Text style={styles.text}>Organization: {agentPaymentProfile?.organizationName || "Not set yet"}</Text>
                    <Text style={styles.text}>Service area: {agentPaymentProfile?.serviceArea || "Not set yet"}</Text>
                  </View>
                </ExpandableCard>
                <ExpandableCard
                  title="Automated Payout Details"
                  subtitle="Add the wallet where automated net payouts should be transferred."
                  expanded={Boolean(expandedSections.agentPayment)}
                  onToggle={() => toggleSection("agentPayment")}
                >
                  <Text style={styles.text}>Provide the GCash account where Soteria should automatically transfer your net service earnings after commission deduction.</Text>
                  <Text style={styles.label}>GCash account name</Text>
                  <TextInput
                    value={agentGcashName}
                    onChangeText={setAgentGcashName}
                    placeholder="Enter GCash account name"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />
                  <Text style={styles.label}>GCash number</Text>
                  <TextInput
                    value={agentGcashNumber}
                    onChangeText={setAgentGcashNumber}
                    placeholder="09xxxxxxxxx"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    style={styles.input}
                  />
                  <Text style={styles.label}>Payout notes</Text>
                  <TextInput
                    value={agentPayoutNotes}
                    onChangeText={setAgentPayoutNotes}
                    placeholder="Optional payout routing notes"
                    placeholderTextColor="#94a3b8"
                    multiline
                    style={[styles.input, styles.multiline]}
                  />
                  <Pressable
                    style={[styles.primary, agentPaymentSaving && styles.buttonDisabled]}
                    onPress={() => void saveAgentPaymentDetails()}
                    disabled={agentPaymentSaving}
                  >
                    <Text style={styles.primaryText}>{agentPaymentSaving ? "Saving..." : "Save payment details"}</Text>
                  </Pressable>
                </ExpandableCard>
              </>
            )}

            {agentTab === "forum" && (
              <ForumPanel
                role="agent"
                threads={forumThreads}
                loading={forumLoading}
                error={forumError}
                title={forumTitle}
                body={forumBody}
                topic={forumTopic}
                posting={forumPosting}
                replyDrafts={forumReplyDrafts}
                replyingId={forumReplyingId}
                onTitleChange={setForumTitle}
                onBodyChange={setForumBody}
                onTopicChange={setForumTopic}
                onSubmitPost={() => void submitForumPost()}
                onReplyDraftChange={(threadId, value) =>
                  setForumReplyDrafts((current) => ({ ...current, [threadId]: value }))
                }
                onSubmitReply={(threadId) => void submitForumReply(threadId)}
              />
            )}
          </>
        )}

        {screen === "community-app" && (
          <>
            <TopCard title={`Community Hub - ${communityName}`} subtitle="Coins, reward center, and semi-forum access for local roadside support" onExit={() => setScreen("role")} />
            <Tabs active={communityTab} setActive={setCommunityTab} labels={{ rewards: "Rewards", forum: "Forum" }} />
            <View style={styles.double}>
              <Mini title="Current coins" value={`${communityProfile?.communityCoins ?? 0}`} accent="#f59e0b" />
              <Mini title="Lifetime coins" value={`${communityProfile?.communityLifetimeCoins ?? 0}`} accent="#38bdf8" />
            </View>
            {communityTab === "rewards" && (
            <>
            <ExpandableCard
              title="Reward Center"
              subtitle="Open reward redemption tools only when you are ready to choose a ticket or submit payout details."
              expanded={Boolean(expandedSections.communityRewardCenter)}
              onToggle={() => toggleSection("communityRewardCenter")}
            >
              <Text style={styles.text}>
                Save small coins from community activity, then redeem a cash ticket and submit your GCash details for admin payout.
              </Text>
              {communityLoading ? (
                <Text style={styles.text}>Loading your community rewards...</Text>
              ) : (
                <>
                  <View style={styles.rowWrap}>
                    {communityRewardOptions.map((option) => (
                      <Chip
                        key={option.id}
                        label={`${option.title} • ${option.coinsRequired}`}
                        active={communityRewardId === option.id}
                        onPress={() => setCommunityRewardId(option.id)}
                      />
                    ))}
                  </View>
                  {communityRewardId ? (
                    <View style={styles.subscriptionStatusCard}>
                      <Text style={styles.label}>Selected reward</Text>
                      <Text style={styles.text}>
                        {communityRewardOptions.find((option) => option.id === communityRewardId)?.title ?? "Reward ticket"}
                      </Text>
                      <Text style={styles.text}>
                        Cash value: PHP {communityRewardOptions.find((option) => option.id === communityRewardId)?.cashValue ?? 0}
                      </Text>
                      <Text style={styles.text}>
                        Coins needed: {communityRewardOptions.find((option) => option.id === communityRewardId)?.coinsRequired ?? 0}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.label}>GCash name</Text>
                  <TextInput
                    value={communityGcashName}
                    onChangeText={setCommunityGcashName}
                    placeholder="Enter GCash account name"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />
                  <Text style={styles.label}>GCash number</Text>
                  <TextInput
                    value={communityGcashNumber}
                    onChangeText={setCommunityGcashNumber}
                    placeholder="09xxxxxxxxx"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    style={styles.input}
                  />
                  <Pressable
                    style={[styles.primary, communitySubmitting && styles.buttonDisabled]}
                    onPress={() => void submitCommunityRedemption()}
                    disabled={communitySubmitting}
                  >
                    <Text style={styles.primaryText}>
                      {communitySubmitting ? "Submitting..." : "Redeem reward ticket"}
                    </Text>
                  </Pressable>
                </>
              )}
            </ExpandableCard>
            <ExpandableCard
              title="Recent Reward Tickets"
              subtitle="Review previous redemptions without keeping the full ticket list always open."
              expanded={Boolean(expandedSections.communityRecentRewards)}
              onToggle={() => toggleSection("communityRecentRewards")}
            >
              {communityRedemptions.length > 0 ? (
                communityRedemptions.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.list}>
                    <Text style={styles.listTitle}>{item.rewardTitle}</Text>
                    <Text style={styles.text}>PHP {item.cashValue} • {item.coinsSpent} coins spent</Text>
                    <Text style={styles.text}>Status: {item.status}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.text}>No reward tickets yet. Keep helping in the forum to earn coins.</Text>
              )}
            </ExpandableCard>
            <ExpandableCard
              title="How coins work"
              subtitle="Open the earning and redemption rules when you want to review the program policy."
              expanded={Boolean(expandedSections.communityCoinRules)}
              onToggle={() => toggleSection("communityCoinRules")}
            >
              <Text style={styles.text}>Daily visit to the forum: +1 coin</Text>
              <Text style={styles.text}>Creating a new post: +2 coins</Text>
              <Text style={styles.text}>Posting a reply: +1 coin</Text>
              <Text style={styles.text}>Maximum total coin earnings: 4 coins per 24 hours</Text>
              <Text style={styles.text}>Once you reach 4 coins, earning is locked until the 24-hour cooldown ends.</Text>
              <Text style={styles.text}>Redeeming a reward resets your current coin balance to zero.</Text>
            </ExpandableCard>
            </>
            )}
            {communityTab === "forum" && (
            <ForumPanel
              role="community"
              threads={forumThreads}
              loading={forumLoading}
              error={forumError}
              title={forumTitle}
              body={forumBody}
              topic={forumTopic}
              posting={forumPosting}
              replyDrafts={forumReplyDrafts}
              replyingId={forumReplyingId}
              onTitleChange={setForumTitle}
              onBodyChange={setForumBody}
              onTopicChange={setForumTopic}
              onSubmitPost={() => void submitForumPost()}
              onReplyDraftChange={(threadId, value) =>
                setForumReplyDrafts((current) => ({ ...current, [threadId]: value }))
              }
              onSubmitReply={(threadId) => void submitForumReply(threadId)}
            />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LoginCard(props: {
  badge: string;
  title: string;
  subtitle: string;
  identityLabel: string;
  identity: string;
  password: string;
  errors: Errors;
  loading?: boolean;
  onBack: () => void;
  onIdentityChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={[styles.card, styles.authCard]}>
      <View style={styles.between}>
        <Pressable style={styles.secondary} onPress={props.onBack} disabled={props.loading}><Text style={styles.secondaryText}>Back</Text></Pressable>
        <View style={styles.authBadge}>
          <Text style={styles.authBadgeText}>{props.badge}</Text>
        </View>
      </View>
      <Text style={styles.title}>{props.title}</Text>
      <Text style={styles.text}>{props.subtitle}</Text>
      <Text style={styles.label}>{props.identityLabel}</Text>
      <TextInput value={props.identity} onChangeText={props.onIdentityChange} placeholder={props.identityLabel} placeholderTextColor="#94a3b8" autoCapitalize="none" editable={!props.loading} style={styles.input} />
      {props.errors.identity ? <Text style={styles.error}>{props.errors.identity}</Text> : null}
      <Text style={styles.label}>Password</Text>
      <TextInput value={props.password} onChangeText={props.onPasswordChange} placeholder="Enter password" placeholderTextColor="#94a3b8" secureTextEntry editable={!props.loading} style={styles.input} />
      {props.errors.password ? <Text style={styles.error}>{props.errors.password}</Text> : null}
      <Pressable style={[styles.primary, props.loading && styles.buttonDisabled]} onPress={props.onSubmit} disabled={props.loading}><Text style={styles.primaryText}>{props.loading ? "Logging in..." : "Log in"}</Text></Pressable>
    </View>
  );
}

function ExpandableCard(props: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  summaryRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.expandableHeader} onPress={props.onToggle}>
        <View style={styles.flex}>
          <Text style={styles.title}>{props.title}</Text>
          {props.subtitle ? <Text style={styles.text}>{props.subtitle}</Text> : null}
        </View>
        <View style={styles.expandableHeaderRight}>
          {props.summaryRight}
          <View style={styles.expandableTogglePill}>
            <Text style={styles.expandableToggleText}>{props.expanded ? "Hide" : "Show"}</Text>
          </View>
        </View>
      </Pressable>
      {props.expanded ? <View style={styles.expandableContent}>{props.children}</View> : null}
    </View>
  );
}

function TopCard(props: { title: string; subtitle: string; onExit: () => void }) {
  return (
    <View style={styles.topCard}>
      <View style={styles.topCardGlow} />
      <View style={styles.topCardHeader}>
        <View style={styles.topCardBadge}>
          <Text style={styles.topCardBadgeText}>Active Workspace</Text>
        </View>
        <Pressable style={styles.secondary} onPress={props.onExit}><Text style={styles.secondaryText}>Logout</Text></Pressable>
      </View>
      <View style={styles.topCardCopy}>
        <Text style={styles.topCardTitle}>{props.title}</Text>
        <Text style={styles.topCardSubtitle}>{props.subtitle}</Text>
      </View>
      <View style={styles.topCardFooter}>
        <View style={styles.topCardMetric}>
          <Text style={styles.topCardMetricLabel}>Status</Text>
          <Text style={styles.topCardMetricValue}>Live system access</Text>
        </View>
        <View style={styles.topCardMetric}>
          <Text style={styles.topCardMetricLabel}>Experience</Text>
          <Text style={styles.topCardMetricValue}>Professional mobile workflow</Text>
        </View>
      </View>
    </View>
  );
}

function Tabs<T extends string>({ active, setActive, labels }: { active: T; setActive: (value: T) => void; labels: Record<T, string> }) {
  const entries = Object.entries(labels) as [T, string][];

  return (
    <View style={styles.tabs}>
      {entries.map(([key, label]) => (
        <Pressable key={key} style={[styles.tab, active === key && styles.tabActive]} onPress={() => setActive(key)}>
          <Text style={[styles.tabText, active === key && styles.tabTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ForumPanel(props: {
  role: "motorist" | "agent" | "community";
  threads: ForumThread[];
  loading: boolean;
  error: string;
  title: string;
  body: string;
  topic: ForumTopic;
  posting: boolean;
  replyDrafts: ForumReplyDrafts;
  replyingId: string | null;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onTopicChange: (value: ForumTopic) => void;
  onSubmitPost: () => void;
  onReplyDraftChange: (threadId: string, value: string) => void;
  onSubmitReply: (threadId: string) => void;
}) {
  const rolePrompt =
    props.role === "agent"
      ? "Ask about road access, payment habits, or operational concerns."
      : props.role === "community"
        ? "Ask about stranded motorists, responder quality, road passability, or community safety."
        : "Ask about responders, road conditions, payment concerns, or safety.";

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>Community Forum</Text>
        <Text style={styles.text}>{rolePrompt}</Text>
        <View style={styles.rowWrap}>
          {forumTopics.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={props.topic === item.value}
              onPress={() => props.onTopicChange(item.value)}
            />
          ))}
        </View>
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={props.title}
          onChangeText={props.onTitleChange}
          placeholder={
            props.role === "agent"
              ? "Is this road passable for towing tonight?"
              : "Is this responder reliable and responsive?"
          }
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
        <Text style={styles.label}>Post details</Text>
        <TextInput
          value={props.body}
          onChangeText={props.onBodyChange}
          placeholder="Share the concern so motorists and responders can help."
          placeholderTextColor="#94a3b8"
          multiline
          style={[styles.input, styles.multiline]}
        />
        {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
        <Pressable
          style={[styles.primary, props.posting && styles.buttonDisabled]}
          onPress={props.onSubmitPost}
          disabled={props.posting}
        >
          <Text style={styles.primaryText}>{props.posting ? "Posting..." : "Post to forum"}</Text>
        </Pressable>
      </View>

      {props.loading ? (
        <View style={styles.card}>
          <Text style={styles.title}>Loading forum</Text>
          <Text style={styles.text}>Fetching the latest posts from motorists and responders.</Text>
        </View>
      ) : props.threads.length > 0 ? (
        props.threads.map((thread) => (
          <View key={thread.id} style={styles.card}>
            <View style={styles.between}>
              <View style={styles.flex}>
                <Text style={styles.title}>{thread.title}</Text>
                <Text style={styles.text}>
                  {forumTopicLabels[thread.topic]} - {thread.authorName} ({thread.authorRole}) - {formatForumTimestamp(thread.createdAt)}
                </Text>
              </View>
              <Pill label={`${thread.replyCount} replies`} />
            </View>
            <Text style={styles.text}>{thread.body}</Text>
            {thread.replies.length > 0 ? (
              thread.replies.map((reply: ForumReply) => (
                <View key={reply.id} style={styles.forumReply}>
                  <Text style={styles.forumReplyMeta}>
                    {reply.authorName} ({reply.authorRole}) - {formatForumTimestamp(reply.createdAt)}
                  </Text>
                  <Text style={styles.text}>{reply.body}</Text>
                </View>
              ))
            ) : (
              <View style={styles.forumReply}>
                <Text style={styles.text}>No replies yet. Be the first to respond.</Text>
              </View>
            )}
            <TextInput
              value={props.replyDrafts[thread.id] ?? ""}
              onChangeText={(value) => props.onReplyDraftChange(thread.id, value)}
              placeholder="Write a reply"
              placeholderTextColor="#94a3b8"
              multiline
              style={[styles.input, styles.forumReplyInput]}
            />
            <Pressable
              style={[styles.secondary, props.replyingId === thread.id && styles.buttonDisabled]}
              onPress={() => props.onSubmitReply(thread.id)}
              disabled={props.replyingId === thread.id}
            >
              <Text style={styles.secondaryText}>
                {props.replyingId === thread.id ? "Sending..." : "Reply"}
              </Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Empty title="No forum posts yet" subtitle="Start the first conversation for motorists and responders." />
      )}
    </>
  );
}

function MapCard(props: {
  title: string;
  subtitle: string;
  center: Coords;
  markers?: LeafletMarker[];
  route?: LeafletRoutePoint[];
}) {
  return (
    <View style={[styles.card, styles.mapCardShell]}>
      <View style={styles.between}>
        <View style={styles.flex}>
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.text}>{props.subtitle}</Text>
        </View>
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>Live map</Text>
        </View>
      </View>
      <View style={styles.map}>
        <LeafletMap
          center={props.center}
          markers={props.markers}
          route={props.route}
        />
      </View>
    </View>
  );
}

function Mini(props: { title: string; value: string; accent?: string }) {
  return (
    <View style={styles.mini}>
      <View style={[styles.miniAccent, props.accent ? { backgroundColor: props.accent } : null]} />
      <Text style={styles.miniLabel}>{props.title}</Text>
      <Text style={[styles.miniValue, props.accent ? { color: props.accent } : null]}>{props.value}</Text>
    </View>
  );
}

function Pill(props: { label: string; active?: boolean }) {
  return <View style={[styles.pill, props.active && styles.pillActive]}><Text style={[styles.pillText, props.active && styles.pillTextActive]}>{props.label}</Text></View>;
}

function Chip(props: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.chip, props.active && styles.chipActive]} onPress={props.onPress}><Text style={[styles.chipText, props.active && styles.chipTextActive]}>{props.label}</Text></Pressable>;
}

function Info(props: { label: string }) {
  return <View style={styles.info}><Text style={styles.infoText}>{props.label}</Text></View>;
}

function Empty(props: { title: string; subtitle: string }) {
  return <View style={styles.empty}><Text style={styles.title}>{props.title}</Text><Text style={styles.text}>{props.subtitle}</Text></View>;
}

function clock(value: number) {
  const m = Math.floor(value / 60);
  const s = value % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#081120" },
  wrap: { paddingHorizontal: 16, paddingTop: 12, gap: 18, paddingBottom: 34, backgroundColor: "#081120" },
  trackingShell: { flex: 1, backgroundColor: "#ffffff" },
  trackingHeader: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#ffffff" },
  inlineBack: { marginBottom: -2 },
  heroBackground: { borderRadius: 32, overflow: "hidden", minHeight: 410, justifyContent: "flex-end", paddingHorizontal: 22, paddingTop: 22, paddingBottom: 24, marginBottom: 2, backgroundColor: "#0c1728", borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", shadowColor: "#020617", shadowOpacity: 0.42, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 10 },
  heroBackgroundImage: { opacity: 0.32, transform: [{ scale: 1.08 }] },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,10,20,0.82)" },
  heroGlow: { position: "absolute", top: -54, right: -28, height: 214, width: 214, borderRadius: 999, backgroundColor: "rgba(245,158,11,0.18)" },
  heroGlowSecondary: { position: "absolute", bottom: -42, left: -26, height: 174, width: 174, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.1)" },
  heroContent: { position: "relative", gap: 18, maxWidth: "100%" },
  hero: { backgroundColor: "#172033", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#334155", gap: 8 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroBadge: { alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "rgba(245,158,11,0.28)", backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 12, paddingVertical: 8 },
  heroTrustBadge: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(15,23,42,0.58)", paddingHorizontal: 12, paddingVertical: 8 },
  heroTrustText: { color: "#dbe7f5", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.85 },
  eyebrow: { color: "#f59e0b", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.4 },
  heroCopy: { gap: 10 },
  heroLead: { color: "#fbbf24", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.8 },
  heroTitle: { color: "#f8fafc", fontSize: 38, lineHeight: 42, fontWeight: "900", letterSpacing: -1, maxWidth: "96%" },
  heroText: { color: "#d3deea", fontSize: 15, lineHeight: 24, maxWidth: "96%" },
  heroHighlights: { flexDirection: "row", gap: 10 },
  heroHighlightCard: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 15, borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", backgroundColor: "rgba(255,255,255,0.06)", gap: 5 },
  heroHighlightValue: { color: "#f8fafc", fontSize: 15, fontWeight: "800" },
  heroHighlightLabel: { color: "#9fb0c3", fontSize: 12, lineHeight: 17 },
  heroButtons: { gap: 12, marginTop: 2 },
  heroButtonRow: { flexDirection: "row", gap: 10 },
  heroButton: { borderRadius: 18, minHeight: 58, paddingVertical: 15, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", width: "100%" },
  heroButtonSplit: { flex: 1, width: "auto" },
  heroPrimary: { backgroundColor: "#f59e0b", shadowColor: "#f59e0b", shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 7 },
  heroPrimaryText: { color: "#0f172a", fontSize: 16, fontWeight: "900", letterSpacing: 0.2 },
  heroSecondary: { borderColor: "rgba(245,158,11,0.72)", borderWidth: 1, backgroundColor: "rgba(13,22,38,0.68)" },
  heroSecondaryText: { color: "#fbbf24", fontSize: 15, fontWeight: "800", textAlign: "center" },
  heroTertiary: { borderColor: "rgba(148,163,184,0.22)", borderWidth: 1, backgroundColor: "rgba(255,255,255,0.05)" },
  heroTertiaryText: { color: "#e2e8f0", fontSize: 15, fontWeight: "800", textAlign: "center" },
  heroMetrics: { flexDirection: "row", gap: 10, marginTop: 2 },
  heroMetricCard: { flex: 1, borderRadius: 20, borderWidth: 1, borderColor: "rgba(148,163,184,0.18)", backgroundColor: "rgba(7,14,25,0.5)", paddingHorizontal: 14, paddingVertical: 15, gap: 6 },
  heroMetricLabel: { color: "#8ea1b7", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.9 },
  heroMetricValue: { color: "#f8fafc", fontSize: 14, fontWeight: "800", lineHeight: 19 },
  backendNote: { color: "#fdba74", fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: "#0d1728", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", gap: 10, shadowColor: "#020617", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  authCard: { backgroundColor: "#101b2d" },
  authBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", backgroundColor: "rgba(245,158,11,0.1)" },
  authBadgeText: { color: "#fbbf24", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  roleCard: { borderRadius: 30, padding: 18, gap: 14, backgroundColor: "#0d1728", borderColor: "rgba(148,163,184,0.16)", shadowColor: "#020617", shadowOpacity: 0.32, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  cardMuted: { backgroundColor: "#091321", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(71,85,105,0.85)", gap: 10 },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  titleDark: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  text: { color: "#a7b6c8", fontSize: 13, lineHeight: 20 },
  textDark: { color: "#475569", fontSize: 13, lineHeight: 19 },
  label: { color: "#d6e1ee", fontSize: 13, fontWeight: "700" },
  value: { color: "#fdba74", fontSize: 13, fontWeight: "800" },
  valueBig: { color: "#fb923c", fontSize: 24, fontWeight: "800" },
  input: { backgroundColor: "#08111f", borderRadius: 16, borderWidth: 1, borderColor: "rgba(71,85,105,0.78)", color: "#f8fafc", paddingHorizontal: 15, paddingVertical: 13, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  error: { color: "#fda4af", fontSize: 12 },
  primary: { backgroundColor: "#f59e0b", borderRadius: 16, paddingVertical: 15, alignItems: "center", shadowColor: "#f59e0b", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  primaryText: { color: "#0f172a", fontSize: 15, fontWeight: "900", letterSpacing: 0.2 },
  buttonDisabled: { opacity: 0.6 },
  secondary: { backgroundColor: "#0a1423", borderRadius: 999, borderWidth: 1, borderColor: "rgba(71,85,105,0.8)", paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: "#d7e2ef", fontWeight: "700" },
  success: { backgroundColor: "#16a34a", borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  successText: { color: "#f8fafc", fontSize: 15, fontWeight: "800" },
  option: { backgroundColor: "#0a1423", borderRadius: 16, borderWidth: 1, borderColor: "rgba(71,85,105,0.7)", padding: 14, gap: 6 },
  optionActive: { borderColor: "#f59e0b", backgroundColor: "#1d1810" },
  optionTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  roleHeader: { gap: 8, marginBottom: 4 },
  roleSectionBadge: { alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "rgba(148,163,184,0.18)", backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 11, paddingVertical: 6 },
  roleSectionBadgeText: { color: "#cbd5e1", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.9 },
  roleSubtitle: { color: "#94a3b8", fontSize: 13, lineHeight: 20, marginTop: 6 },
  roleOptionCard: { borderRadius: 24, padding: 16, gap: 14 },
  roleOptionTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  roleIconShell: { height: 48, width: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  roleIconMotorist: { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.38)" },
  roleIconAgent: { backgroundColor: "rgba(56,189,248,0.12)", borderColor: "rgba(56,189,248,0.32)" },
  roleIconCommunity: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.3)" },
  roleIconText: { color: "#f8fafc", fontSize: 15, fontWeight: "900" },
  roleContent: { flex: 1, gap: 4 },
  roleTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  roleTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleBadgeRecommended: { borderRadius: 999, backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.28)", paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeRecommendedText: { color: "#fbbf24", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  roleBadgeNeutral: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(148,163,184,0.18)", paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeNeutralText: { color: "#d0dae7", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  rolePill: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.28)", paddingHorizontal: 12, paddingVertical: 7 },
  rolePillMuted: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 7 },
  rolePillText: { color: "#fbbf24", fontSize: 12, fontWeight: "700" },
  rolePillTextMuted: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  flex: { flex: 1 },
  expandableHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  expandableHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  expandableTogglePill: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 11, paddingVertical: 6 },
  expandableToggleText: { color: "#d6e1ee", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  expandableContent: { gap: 12 },
  tabs: { backgroundColor: "#0b1423", borderRadius: 20, padding: 6, borderWidth: 1, borderColor: "rgba(71,85,105,0.82)", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tab: { flexGrow: 1, minWidth: 92, borderRadius: 14, paddingVertical: 12, alignItems: "center", backgroundColor: "transparent" },
  tabActive: { backgroundColor: "#f59e0b", shadowColor: "#f59e0b", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  tabText: { color: "#8fa4ba", fontWeight: "700" },
  tabTextActive: { color: "#0f172a" },
  mapCardShell: { gap: 12 },
  map: { height: 290, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(71,85,105,0.82)" },
  mapBadge: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(56,189,248,0.24)", backgroundColor: "rgba(56,189,248,0.1)", paddingHorizontal: 11, paddingVertical: 6 },
  mapBadgeText: { color: "#67e8f9", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stack: { gap: 8 },
  chip: { backgroundColor: "#0c1728", borderRadius: 999, borderWidth: 1, borderColor: "rgba(71,85,105,0.9)", paddingHorizontal: 14, paddingVertical: 10 },
  chipActive: { backgroundColor: "#f59e0b", borderColor: "#f59e0b" },
  chipText: { color: "#d2dbe7", fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#0f172a" },
  pill: { backgroundColor: "#091321", borderRadius: 999, borderWidth: 1, borderColor: "rgba(71,85,105,0.76)", paddingHorizontal: 10, paddingVertical: 7 },
  pillActive: { backgroundColor: "#22170b", borderColor: "#f59e0b" },
  pillText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  pillTextActive: { color: "#fbbf24" },
  info: { backgroundColor: "#091321", borderRadius: 14, borderWidth: 1, borderColor: "rgba(71,85,105,0.76)", paddingHorizontal: 12, paddingVertical: 8 },
  infoText: { color: "#d1dbe7", fontSize: 12, fontWeight: "600" },
  list: { backgroundColor: "#091321", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(71,85,105,0.76)", gap: 7 },
  listActive: { borderColor: "#f59e0b", backgroundColor: "#111c2d" },
  listTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "800", flex: 1 },
  double: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mini: { flex: 1, minWidth: 140, backgroundColor: "#0d1728", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", gap: 8, overflow: "hidden" },
  miniAccent: { width: 42, height: 4, borderRadius: 999, backgroundColor: "#f59e0b" },
  miniLabel: { color: "#97aabd", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  miniValue: { color: "#f8fafc", fontSize: 22, fontWeight: "800" },
  alert: { backgroundColor: "#261d18", borderRadius: 18, borderWidth: 1, borderColor: "#fb923c", padding: 16, gap: 6 },
  alertTitle: { color: "#fdba74", fontSize: 16, fontWeight: "800", textTransform: "capitalize" },
  alertText: { color: "#fed7aa", fontSize: 13, lineHeight: 19 },
  subscriptionCard: { backgroundColor: "#091321", borderRadius: 20, borderWidth: 1, borderColor: "rgba(71,85,105,0.76)", padding: 14, gap: 12, alignItems: "center" },
  subscriptionStatusCard: { backgroundColor: "#0d1728", borderRadius: 18, borderWidth: 1, borderColor: "rgba(71,85,105,0.78)", padding: 12, gap: 6, width: "100%" },
  subscriptionQr: { width: 180, height: 180, borderRadius: 16, backgroundColor: "#ffffff" },
  subscriptionOverviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  subscriptionOverviewCard: { flex: 1, minWidth: 150, backgroundColor: "#091321", borderRadius: 18, borderWidth: 1, borderColor: "rgba(71,85,105,0.76)", padding: 14, gap: 6 },
  subscriptionOverviewLabel: { color: "#8fa4ba", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.85 },
  subscriptionOverviewValue: { color: "#f8fafc", fontSize: 18, fontWeight: "800" },
  subscriptionPlansStack: { gap: 12, width: "100%" },
  subscriptionPlanCard: { backgroundColor: "#0d1728", borderRadius: 20, borderWidth: 1, borderColor: "rgba(71,85,105,0.76)", padding: 14, gap: 10 },
  subscriptionPlanCardActive: { borderColor: "#f59e0b", backgroundColor: "#111c2d" },
  subscriptionTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  subscriptionPlanTitle: { color: "#f8fafc", fontSize: 20, fontWeight: "800" },
  subscriptionPlanBadge: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(34,197,94,0.28)", backgroundColor: "rgba(34,197,94,0.12)", paddingHorizontal: 9, paddingVertical: 5 },
  subscriptionPlanBadgeText: { color: "#86efac", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  subscriptionPlanTagline: { color: "#fbbf24", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  subscriptionPlanPriceWrap: { alignItems: "flex-end", gap: 2 },
  subscriptionPlanPrice: { color: "#f8fafc", fontSize: 18, fontWeight: "900" },
  subscriptionPlanPriceMeta: { color: "#8fa4ba", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 },
  subscriptionFeatureList: { gap: 8, width: "100%" },
  subscriptionFeatureItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  subscriptionFeatureBullet: { color: "#f59e0b", fontSize: 14, fontWeight: "900", lineHeight: 20 },
  subscriptionCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, width: "100%" },
  subscriptionPriceBadge: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(245,158,11,0.28)", backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 12, paddingVertical: 7 },
  subscriptionPriceBadgeText: { color: "#fbbf24", fontSize: 12, fontWeight: "800" },
  cashAssistBadge: { alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.12)", paddingHorizontal: 11, paddingVertical: 6, marginTop: 8 },
  cashAssistBadgeText: { color: "#86efac", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  lockedPill: { backgroundColor: "#261d18", borderRadius: 999, borderWidth: 1, borderColor: "#fb923c", paddingHorizontal: 14, paddingVertical: 10 },
  lockedPillText: { color: "#fdba74", fontWeight: "800" },
  forumReply: { backgroundColor: "#091321", borderRadius: 16, borderWidth: 1, borderColor: "rgba(71,85,105,0.76)", padding: 12, gap: 6 },
  forumReplyMeta: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  forumReplyInput: { minHeight: 72 },
  empty: { backgroundColor: "#0d1728", borderRadius: 22, borderWidth: 1, borderColor: "rgba(71,85,105,0.76)", padding: 28, alignItems: "center", gap: 8 },
  topCard: { position: "relative", overflow: "hidden", backgroundColor: "#0d1728", borderRadius: 28, padding: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", gap: 16, shadowColor: "#020617", shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  topCardGlow: { position: "absolute", top: -60, right: -30, width: 200, height: 200, borderRadius: 999, backgroundColor: "rgba(245,158,11,0.12)" },
  topCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  topCardBadge: { alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "rgba(245,158,11,0.28)", backgroundColor: "rgba(245,158,11,0.1)", paddingHorizontal: 12, paddingVertical: 7 },
  topCardBadgeText: { color: "#fbbf24", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.9 },
  topCardCopy: { gap: 8, maxWidth: "96%" },
  topCardTitle: { color: "#f8fafc", fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 },
  topCardSubtitle: { color: "#b3c1d1", fontSize: 14, lineHeight: 22 },
  topCardFooter: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  topCardMetric: { flex: 1, minWidth: 150, borderRadius: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", backgroundColor: "rgba(255,255,255,0.04)", padding: 12, gap: 4 },
  topCardMetricLabel: { color: "#8da0b6", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.85 },
  topCardMetricValue: { color: "#f8fafc", fontSize: 14, fontWeight: "800", lineHeight: 18 },
  loadingRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: "#fb923c55", alignItems: "center", justifyContent: "center", alignSelf: "center", marginVertical: 8 },
  loadingPin: { color: "#fb923c", fontSize: 28, fontWeight: "800" },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: "#334155", overflow: "hidden" },
  progressFill: { width: "100%", height: "100%", backgroundColor: "#fb923c" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  ghost: { flex: 1, minWidth: 120, backgroundColor: "#0f172a", borderRadius: 14, borderWidth: 1, borderColor: "#334155", paddingVertical: 12, alignItems: "center" },
  ghostText: { color: "#cbd5e1", fontWeight: "700" },
  action: { flex: 1, minWidth: 140, backgroundColor: "#fb923c", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  actionText: { color: "#111827", fontWeight: "800" },
});
