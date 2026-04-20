import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ImageBackground,
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
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Notifications from "expo-notifications";
import {
  createEmergencyDispatch,
  fetchRepairShops,
  registerUserProfile,
  submitAgentApplication,
  loginUser as apiLoginUser,
  loginAgent as apiLoginAgent,
  updateAgentLocation,
  updateAgentAvailability,
  fetchAgentDispatches,
  acceptDispatch,
  declineDispatch,
  updateDispatchStatus,
  findNearbyAgents,
  fetchDispatchDetails,
  getRoute,
  calculateDistance,
  calculateETA,
  type DbRepairShop,
  type DispatchDetails,
} from "./src/lib/roadresqApi";
import { SERVICE_CATEGORY_LABELS, type ServiceCategory } from "../packages/shared/src";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Notification functions
const requestNotificationPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

const sendLocalNotification = async (title: string, body: string) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: null, // Show immediately
  });
};

type Screen = "role" | "user-login" | "user-register" | "user-triage" | "user-finding-agent" | "agent-login" | "agent-register" | "user-app" | "agent-app";
type UserTab = "explore" | "emergency" | "tracking";
type AgentTab = "requests" | "navigation" | "stats";
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
  serviceCategory: string;
  serviceArea: string;
  username: string;
  password: string;
};
type CredentialFiles = {
  driversLicense: string | null;
  vehicleRegistration: string | null;
  insurance: string | null;
  nbiClearance: string | null;
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

const baseLocation: Coords = { latitude: 14.0676, longitude: 121.4174 };
const shops: Shop[] = [
  { id: "1", name: "Mang Pedring Auto Repair", category: "mechanical", rating: 4.9, distanceKm: 1.2, address: "San Pablo City, Laguna", responseTime: "~15 min", openNow: true, coord: { latitude: 14.068, longitude: 121.418 }, services: ["Engine repair", "Brake service", "Diagnostic scan"] },
  { id: "2", name: "Bay Vulcanizing Shop", category: "vulcanizing", rating: 4.8, distanceKm: 2.5, address: "Bay, Laguna", responseTime: "~20 min", openNow: true, coord: { latitude: 14.065, longitude: 121.42 }, services: ["Tire repair", "Wheel balancing", "Patch and inflate"] },
  { id: "3", name: "Calauan Towing Service", category: "towing", rating: 4.7, distanceKm: 3.8, address: "Calauan, Laguna", responseTime: "~25 min", openNow: true, coord: { latitude: 14.07, longitude: 121.415 }, services: ["Flatbed towing", "Roadside pickup", "Winch out"] },
  { id: "4", name: "Los Banos Auto Electric", category: "electrical", rating: 4.6, distanceKm: 4.2, address: "Los Banos, Laguna", responseTime: "~30 min", openNow: false, coord: { latitude: 14.063, longitude: 121.422 }, services: ["Battery replacement", "Wiring check", "Alternator repair"] },
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

export default function App() {
  const [shopData, setShopData] = useState<Shop[]>(shops);
  const [backendMessage, setBackendMessage] = useState("Using demo-ready mobile data until backend records load.");
  const [agentSearchError, setAgentSearchError] = useState("");
  const [screen, setScreen] = useState<Screen>("role");
  const [userTab, setUserTab] = useState<UserTab>("explore");
  const [agentTab, setAgentTab] = useState<AgentTab>("requests");
  const [userIdentity, setUserIdentity] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [agentIdentity, setAgentIdentity] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [userLoginLoading, setUserLoginLoading] = useState(false);
  const [agentLoginLoading, setAgentLoginLoading] = useState(false);
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
    serviceCategory: "",
    serviceArea: "",
    username: "",
    password: "",
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
  const [userName, setUserName] = useState("Motorist");
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
  const [matchedAgent, setMatchedAgent] = useState<AgentMatch | null>(null);
  const [trackingStatus, setTrackingStatus] = useState("matched");
  const [elapsed, setElapsed] = useState(0);
  const [sla, setSla] = useState(480);
  const [agentLocation, setAgentLocation] = useState<Coords>({ latitude: 14.086, longitude: 121.447 });
  const [route, setRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [availability, setAvailability] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [jobHistory, setJobHistory] = useState<string[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [liveRequestId, setLiveRequestId] = useState<string | null>(null);
  const [liveDispatchId, setLiveDispatchId] = useState<string | null>(null);
  const [liveDispatchDetails, setLiveDispatchDetails] = useState<DispatchDetails | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentDispatches, setAgentDispatches] = useState<DispatchDetails[]>([]);
  const [activeDispatchId, setActiveDispatchId] = useState<string | null>(null);
  const [navStatus, setNavStatus] = useState<"en-route" | "arrived" | "working">("en-route");
  const [fee, setFee] = useState("PHP 350");
  const [editingFee, setEditingFee] = useState(false);
  const [feeDraft, setFeeDraft] = useState("PHP 350");

  const filteredShops = useMemo(() => (shopFilter === "all" ? shopData : shopData.filter((s) => s.category === shopFilter)), [shopData, shopFilter]);
  const selectedShop = filteredShops.find((s) => s.id === selectedShopId) ?? filteredShops[0];
  const activeRequest = activeRequestId ? requests.find((r) => r.id === activeRequestId) ?? null : null;
  const activeDispatch = activeDispatchId ? agentDispatches.find((d) => d.id === activeDispatchId) ?? null : null;
  const activeAgentRequest = activeDispatch;
  const pendingAgentDispatches = useMemo(
    () => agentDispatches.filter((dispatch) => dispatch.dispatchStatus === "pending"),
    [agentDispatches]
  );
  const navigationMapCenter = useMemo(() => {
    if (!activeAgentRequest) return userLocation;
    return {
      latitude: (agentLocation.latitude + userLocation.latitude) / 2,
      longitude: (agentLocation.longitude + userLocation.longitude) / 2,
    };
  }, [activeAgentRequest, agentLocation, userLocation]);

  const navigationDistance = useMemo(() => {
    if (!activeAgentRequest) return 0;
    return calculateDistance(agentLocation.latitude, agentLocation.longitude, userLocation.latitude, userLocation.longitude);
  }, [activeAgentRequest, agentLocation, userLocation]);

  const navigationETA = useMemo(() => {
    if (!activeAgentRequest) return 0;
    return calculateETA(navigationDistance);
  }, [activeAgentRequest, navigationDistance]);

  useEffect(() => {
    if (!agentId || activeDispatchId || screen !== "agent-app") return;
    const active = agentDispatches.find((dispatch) => dispatch.dispatchStatus !== "pending");
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
        setBackendMessage("Connected to PostgreSQL-backed repair shop data.");
      } catch {
        if (!active) {
          return;
        }
        setBackendMessage("Backend tables are not available yet, so the mobile app is using local fallback data.");
      }
    };

    const loadAgentDispatches = async () => {
      if (!agentId) return;
      try {
        const dispatches = await fetchAgentDispatches(agentId);
        if (active) {
          setAgentDispatches(dispatches);
        }
      } catch (error) {
        console.warn("Failed to load agent dispatches:", error);
      }
    };

    void loadRepairShops();
    void loadAgentDispatches();

    const interval = setInterval(() => {
      void loadAgentDispatches();
    }, 2000);

    // Setup notifications
    const setupNotifications = async () => {
      await requestNotificationPermissions();
    };

    setupNotifications();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [agentId]);

  useEffect(() => {
    if (!liveDispatchId || screen !== "user-app" || userTab !== "tracking") return;
    let active = true;

    const refreshDispatchDetails = async () => {
      try {
        const dispatchDetails = await fetchDispatchDetails(liveDispatchId);
        if (!active) return;
        setLiveDispatchDetails(dispatchDetails);
        if (dispatchDetails.agent?.currentLatitude && dispatchDetails.agent?.currentLongitude) {
          setAgentLocation({ latitude: dispatchDetails.agent.currentLatitude, longitude: dispatchDetails.agent.currentLongitude });
        }
        const statusMap: Record<string, string> = {
          matched: "matched",
          assigned: "matched",
          accepted: "accepted",
          "en-route": "en-route",
          arrived: "arrived",
          "in-service": "in-service",
          in_service: "in-service",
          completed: "completed",
        };
        const nextStatus = statusMap[dispatchDetails.dispatchStatus] ?? "matched";
        setTrackingStatus((currentStatus) => currentStatus === nextStatus ? currentStatus : nextStatus);
      } catch (error) {
        console.warn("Failed to refresh live dispatch details:", error);
      }
    };

    void refreshDispatchDetails();
    const interval = setInterval(refreshDispatchDetails, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [screen, userTab, liveDispatchId]);

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
          [userLocation.latitude, userLocation.longitude]
        );
        if (routeData) {
          setRoute(routeData.geometry.map(coord => ({ latitude: coord[1], longitude: coord[0] })));
        }
      } catch (error) {
        console.error("Route calculation failed:", error);
        // Fallback to direct line
        setRoute([
          { latitude: agentLocation.latitude, longitude: agentLocation.longitude },
          { latitude: userLocation.latitude, longitude: userLocation.longitude }
        ]);
      }
    };

    calculateRoute();
  }, [screen, userTab, agentTab, activeAgentRequest, agentLocation, userLocation]);

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
    if (screen !== "user-app" || userTab !== "tracking") return;
    if (liveRequestId) return;
    const ids = [
      setTimeout(() => {
        setTrackingStatus("accepted");
        sendLocalNotification("Agent Dispatched", "Your rescue agent has been assigned and is preparing to help you.");
      }, 3000),
      setTimeout(() => {
        setTrackingStatus("en-route");
        sendLocalNotification("Agent En Route", "Your rescue agent is now on the way to your location.");
      }, 6000),
      setTimeout(() => {
        setTrackingStatus("arrived");
        sendLocalNotification("Agent Arrived", "Your rescue agent has arrived at your location.");
      }, 12000),
      setTimeout(() => {
        setTrackingStatus("in-service");
        sendLocalNotification("Service Started", "Your rescue agent has begun working on your vehicle.");
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
            accuracy: Location.Accuracy.High,
            timeInterval: 5000, // Update every 5 seconds
            distanceInterval: 10, // Update every 10 meters
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
              console.warn('Failed to update agent location:', error);
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

  // Periodic refresh of agent dispatches when online - faster polling for real-time updates
  useEffect(() => {
    if (screen !== "agent-app" || !agentId || !availability) return;

    const fetchDispatches = async () => {
      try {
        const dispatches = await fetchAgentDispatches(agentId);
        setAgentDispatches(dispatches);
      } catch (error) {
        console.warn('Failed to fetch agent dispatches:', error);
      }
    };

    // Fetch immediately
    fetchDispatches();

    // Then fetch every 2 seconds for real-time updates
    const interval = setInterval(fetchDispatches, 2000);

    return () => clearInterval(interval);
  }, [screen, agentId, availability]);

  // Update agent availability in backend when it changes
  useEffect(() => {
    if (screen !== "agent-app" || !agentId) return;

    const updateAvailability = async () => {
      try {
        await updateAgentAvailability(agentId, availability);
        console.log(`Agent availability updated to: ${availability}`);
      } catch (error) {
        console.warn('Failed to update agent availability:', error);
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
          console.warn('Agent location permission not granted');
          return;
        }

        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const currentCoords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };

        setAgentLocation(currentCoords);
        if (agentId) {
          await updateAgentLocation(agentId, currentCoords);
        }
        console.log(`Agent location updated: ${currentCoords.latitude}, ${currentCoords.longitude}`);
      } catch (error) {
        console.warn('Failed to update agent location:', error);
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
        setUserName(result.fullName || userIdentity.trim());
        setUserPassword("");
        setUserErrors({});
        setScreen("user-app");
        setUserTab("explore");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed. Please check your credentials.";
        setUserErrors({ 
          identity: message.includes("credentials") ? "Invalid username or password." : "",
          password: message.includes("credentials") ? "Invalid username or password." : ""
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
        setAgentPassword("");
        setAgentErrors({});
        setScreen("agent-app");
        setAgentTab("requests");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed. Please check your credentials.";
        setAgentErrors({
          identity: message.includes("credentials") ? "Invalid username or password." : "",
          password: message.includes("credentials") ? "Invalid username or password." : ""
        });
      } finally {
        setAgentLoginLoading(false);
      }
    })();
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
        await registerUserProfile({
          fullName: registerForm.fullName,
          mobileNumber: registerForm.mobileNumber,
          username: registerForm.username,
          password: registerForm.password,
        });
        setBackendMessage("User profile saved to PostgreSQL.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save user profile.";
        setBackendMessage(`User registration fallback active: ${message}`);
        Alert.alert("Registration not saved", message);
      }

      setUserIdentity(registerForm.username);
      setUserPassword(registerForm.password);
      setUserName(registerForm.fullName);
      setScreen("user-app");
      setUserTab("explore");
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
      Alert.alert("Select symptoms", "Choose at least one symptom before finding a rescue agent.");
      return;
    }

    setScreen("user-finding-agent");
    setFindingAgent(true);
    setMatchedAgent(null);
    setAgentSearchError("");

    try {
      const nearbyAgents = await findNearbyAgents(userLocation.latitude, userLocation.longitude);
      if (nearbyAgents && nearbyAgents.length > 0) {
        const agent = nearbyAgents[0];
        const matchedAgentData = {
          id: agent.id,
          name: agent.fullName,
          category: agent.serviceCategory as ServiceCategory,
          rating: 4.5,
          distanceKm: agent.distanceKm,
          services: agent.services || [],
        };
        setMatchedAgent(matchedAgentData);
        setFindingAgent(false);
        return;
      }

      setAgentSearchError("No available rescue agents found nearby. Please try again later.");
    } catch (error) {
      console.warn("Failed to find real agents:", error);
      setAgentSearchError("Unable to reach the backend. Please check your connection and try again.");
    } finally {
      setFindingAgent(false);
    }
  };

  const refreshAgentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for accurate agent tracking.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const currentCoords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setAgentLocation(currentCoords);
      if (agentId) {
        await updateAgentLocation(agentId, currentCoords);
      }
    } catch (error) {
      console.warn('Failed to refresh agent location:', error);
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

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const currentCoords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setAgentLocation(currentCoords);
      if (agentId) {
        await updateAgentLocation(agentId, currentCoords);
        if (!availability) {
          setAvailability(true);
          await updateAgentAvailability(agentId, true);
        }
        const refreshedDispatches = await fetchAgentDispatches(agentId);
        setAgentDispatches(refreshedDispatches);
      }
    } catch (error) {
      console.warn('Failed to detect agent location:', error);
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
        setActiveDispatchId(id);
        setAgentTab("navigation");
        setNavStatus("en-route");
        setTrackingStatus("accepted");
        const refreshedDispatches = await fetchAgentDispatches(agentId);
        setAgentDispatches(refreshedDispatches);
      } catch (error) {
        console.warn("Failed to accept backend dispatch:", error);
        Alert.alert("Accept failed", "Could not accept the request through the backend. Trying local navigation mode.");
        setActiveDispatchId(id);
        setAgentTab("navigation");
        setNavStatus("en-route");
        if (liveRequestId === id) {
          setTrackingStatus("accepted");
        }
      }
    } else {
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
    void (async () => {
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

      try {
        const result = await createEmergencyDispatch({
          username: userIdentity || registerForm.username || userName,
          mobileNumber: registerForm.mobileNumber || "N/A",
          locationLabel,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          serviceType,
          issueSummary: [issueSummary, triageDescription].filter(Boolean).join(" | "),
          symptoms: selectedSymptoms,
          matchedShopId: null,
          matchedAgentId: matchedAgent?.id ?? null,
        });
        setLiveDispatchId(result.dispatchId);
        setBackendMessage("Emergency report and dispatch saved to PostgreSQL.");

        const dispatchDetails = await fetchDispatchDetails(result.dispatchId);
        setLiveDispatchDetails(dispatchDetails);
        if (dispatchDetails.agent?.currentLatitude && dispatchDetails.agent?.currentLongitude) {
          setAgentLocation({ latitude: dispatchDetails.agent.currentLatitude, longitude: dispatchDetails.agent.currentLongitude });
        }
      } catch {
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
    })();
  };

  const findAnotherAgent = async () => {
    setFindingAgent(true);
    setMatchedAgent(null);
    setAgentSearchError("");

    try {
      const nearbyAgents = await findNearbyAgents(userLocation.latitude, userLocation.longitude);
      if (!nearbyAgents || nearbyAgents.length === 0) {
        setAgentSearchError("No available rescue agents found nearby. Please try again later.");
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
      });
    } catch (error) {
      console.warn("Failed to refresh nearby agents:", error);
      setAgentSearchError("Unable to refresh nearby agents. Please try again later.");
    } finally {
      setFindingAgent(false);
    }
  };

  const continueAgentRegisterInfo = () => {
    if (
      !agentRegisterForm.ownerName.trim() ||
      !agentRegisterForm.mobileNumber.trim() ||
      !agentRegisterForm.serviceCategory.trim() ||
      !agentRegisterForm.serviceArea.trim() ||
      !agentRegisterForm.username.trim() ||
      !agentRegisterForm.password.trim()
    ) {
      setAgentRegisterError("Please complete all fields before continuing.");
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
      setCredentialFiles((current) => ({ ...current, [field]: result.assets[0].name }));
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
          serviceCategory: agentRegisterForm.serviceCategory,
          serviceArea: agentRegisterForm.serviceArea,
          username: agentRegisterForm.username,
          password: agentRegisterForm.password,
          credentialManifest: credentialFiles,
        });
        setBackendMessage("Agent application saved to PostgreSQL.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save agent application.";
        setBackendMessage(`Agent application fallback active: ${message}`);
        Alert.alert("Application not saved", message);
      }

      Alert.alert("Application submitted", "Admin will review your credentials and notify you once approved.");
      setScreen("agent-login");
      setAgentRegisterStep("info");
    })();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.wrap}>
        <ImageBackground
          source={{ uri: "https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1200&q=80" }}
          style={styles.heroBackground}
          imageStyle={styles.heroBackgroundImage}
          blurRadius={20}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.eyebrow}>RoadResQ</Text>
            <Text style={styles.heroTitle}>Emergency Roadside Assistance</Text>
            <Text style={styles.heroText}>Fast, secure roadside help with live GPS tracking, responder navigation, and emergency reporting.</Text>
            <View style={styles.heroButtons}>
              <Pressable style={styles.heroPrimary} onPress={() => setScreen("user-login")}> 
                <Text style={styles.heroPrimaryText}>Get Help Now</Text>
              </Pressable>
              <Pressable style={styles.heroSecondary} onPress={() => setScreen("agent-login")}> 
                <Text style={styles.heroSecondaryText}>Responder Access</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>

        {screen === "role" && (
          <View style={styles.card}>
            <Text style={styles.title}>Choose your mobile role</Text>
            <Pressable style={[styles.option, styles.optionActive]} onPress={() => setScreen("user-login")}>
              <Text style={styles.optionTitle}>Motorist app</Text>
              <Text style={styles.text}>Nearby shops, emergency reporting, and live responder tracking.</Text>
            </Pressable>
            <Pressable style={styles.option} onPress={() => setScreen("agent-login")}>
              <Text style={styles.optionTitle}>Responder app</Text>
              <Text style={styles.text}>Incoming requests, navigation, fee updates, and service stats.</Text>
            </Pressable>
          </View>
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
            <LoginCard badge="Responder" title="Agent Login" subtitle="Manage requests, navigate to motorists, and update service status." identityLabel="Agent ID or Username" identity={agentIdentity} password={agentPassword} errors={agentErrors} loading={agentLoginLoading} onBack={() => setScreen("role")} onIdentityChange={setAgentIdentity} onPasswordChange={setAgentPassword} onSubmit={loginAgent} />
            <View style={styles.card}>
              <Text style={styles.text}>Not registered yet?</Text>
              <Pressable style={styles.secondary} onPress={() => setScreen("agent-register")}>
                <Text style={styles.secondaryText}>Apply as responder</Text>
              </Pressable>
            </View>
          </>
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
                <Text style={styles.title}>Agent Registration</Text>
                <Text style={styles.text}>Step 1: Business information</Text>
                <Text style={styles.label}>Owner's full name</Text>
                <TextInput value={agentRegisterForm.ownerName} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, ownerName: value }))} placeholder="Juan Dela Cruz" placeholderTextColor="#94a3b8" style={styles.input} />
                <Text style={styles.label}>Mobile number</Text>
                <TextInput value={agentRegisterForm.mobileNumber} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, mobileNumber: value }))} placeholder="+63 917 123 4567" placeholderTextColor="#94a3b8" keyboardType="phone-pad" style={styles.input} />
                <Text style={styles.label}>Service category</Text>
                <View style={styles.rowWrap}>
                  {["mechanic", "vulcanizing", "towing"].map((category) => (
                    <Chip key={category} label={category} active={agentRegisterForm.serviceCategory === category} onPress={() => setAgentRegisterForm((current) => ({ ...current, serviceCategory: category }))} />
                  ))}
                </View>
                <Text style={styles.label}>Service area coverage</Text>
                <TextInput value={agentRegisterForm.serviceArea} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, serviceArea: value }))} placeholder="e.g. San Pablo City, Alaminos, Bay" placeholderTextColor="#94a3b8" style={styles.input} />
                <Text style={styles.label}>Username</Text>
                <TextInput value={agentRegisterForm.username} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, username: value }))} placeholder="Choose a username" placeholderTextColor="#94a3b8" autoCapitalize="none" style={styles.input} />
                <Text style={styles.label}>Password</Text>
                <TextInput value={agentRegisterForm.password} onChangeText={(value) => setAgentRegisterForm((current) => ({ ...current, password: value }))} placeholder="Create password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} />
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
                    <Text style={styles.text}>{credentialFiles[key as keyof CredentialFiles] ?? "No file selected yet"}</Text>
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
            <Tabs active={userTab} setActive={setUserTab} labels={{ explore: "Explore", emergency: "Emergency", tracking: "Tracking" }} />

            {userTab === "explore" && (
              <>
                <MapCard title="Nearby repair shops" subtitle={`${filteredShops.length} shops near your location`} center={userLocation}>
                  <Marker coordinate={userLocation} title="You" pinColor="#fb923c" />
                  {filteredShops.map((shop) => <Marker key={shop.id} coordinate={shop.coord} title={shop.name} description={shop.address} pinColor={shop.id === selectedShop?.id ? "#fb923c" : "#38bdf8"} onPress={() => setSelectedShopId(shop.id)} />)}
                </MapCard>
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
                <MapCard title="Emergency reporting" subtitle="Pin your location and choose the help you need" center={userLocation}>
                  <Marker coordinate={userLocation} title="Pinned location" pinColor="#fb923c" />
                </MapCard>
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
              <>
                <View style={styles.inlineBack}>
                  <Pressable style={styles.secondary} onPress={() => setUserTab("emergency")}><Text style={styles.secondaryText}>Back to emergency</Text></Pressable>
                </View>
                <View style={styles.alert}>
                  <Text style={styles.alertTitle}>{trackingStatus.replace("-", " ")}</Text>
                  <Text style={styles.alertText}>Stay on this screen to keep watching the responder trip and service state.</Text>
                </View>
                <MapCard title="Live rescue map" subtitle="Track your responder in real time" center={userLocation} route={route} showRoute={true}>
                  <Marker coordinate={userLocation} title="Your location" pinColor="#fb923c" />
                  <Marker coordinate={agentLocation} title="Responder" pinColor="#22c55e" />
                </MapCard>
                <View style={styles.double}>
                  <Mini title="Elapsed time" value={clock(elapsed)} />
                  <Mini title="SLA timer" value={clock(sla)} accent={sla < 60 ? "#f87171" : "#4ade80"} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.title}>Responder details</Text>
                  <Text style={styles.text}>{liveDispatchDetails?.agent?.fullName ?? matchedAgent?.name ?? "Awaiting responder assignment"}</Text>
                  <Text style={styles.text}>
                    {liveDispatchDetails ? `${liveDispatchDetails.motorist.issueSummary} - ${liveDispatchDetails.motorist.phone}` : "Vehicle ABC 1234 - ETA 5 minutes"}
                  </Text>
                  {liveDispatchDetails ? (
                    <Text style={styles.text}>
                      Request {liveDispatchDetails.id} - {liveDispatchDetails.motorist.locationLabel}
                    </Text>
                  ) : null}
                  <View style={styles.rowWrap}>
                    {["matched", "accepted", "en-route", "arrived", "in-service", "completed"].map((stage) => <Pill key={stage} label={stage} active={["matched", "accepted", "en-route", "arrived", "in-service", "completed"].indexOf(stage) <= ["matched", "accepted", "en-route", "arrived", "in-service", "completed"].indexOf(trackingStatus)} />)}
                  </View>
                </View>
              </>
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
                <Text style={styles.text}>{triagePhotos.length > 0 ? `${triagePhotos.length} photo(s) selected` : "Optional photos help responders diagnose faster."}</Text>
              </View>
              <Pressable style={styles.secondary} onPress={pickTriagePhoto}>
                <Text style={styles.secondaryText}>Add photos</Text>
              </Pressable>
            </View>
            <View style={styles.alert}>
              <Text style={styles.alertTitle}>Symptom classification</Text>
              <Text style={styles.alertText}>Your selected symptoms will be used to match you with the most appropriate rescue responder.</Text>
            </View>
            <Pressable style={styles.primary} onPress={continueFromTriage}><Text style={styles.primaryText}>Find rescue agent</Text></Pressable>
          </View>
        )}

        {screen === "user-finding-agent" && (
          <View style={styles.card}>
            <View style={styles.between}>
              <Pressable style={styles.secondary} onPress={() => setScreen("user-triage")}><Text style={styles.secondaryText}>Back</Text></Pressable>
              <Pill label="Agent matching" active />
            </View>
            {findingAgent ? (
              <>
                <Text style={styles.title}>Finding Nearest Agent...</Text>
                <Text style={styles.text}>Searching for available rescue agents in your area using proximity-based matching.</Text>
                <View style={styles.loadingRing}>
                  <Text style={styles.loadingPin}>+</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={styles.progressFill} />
                </View>
                <Text style={styles.text}>Using proximity-based matching engine...</Text>
              </>
            ) : matchedAgent ? (
              <>
                <Text style={styles.title}>Agent Found!</Text>
                <Text style={styles.text}>We've matched you with a nearby rescue agent.</Text>
                <View style={styles.card}>
                  <Text style={styles.title}>{matchedAgent.name}</Text>
                  <Text style={styles.text}>{SERVICE_CATEGORY_LABELS[matchedAgent.category]} specialist</Text>
                  <View style={styles.rowWrap}>
                    <Pill label={`${matchedAgent.rating} rating`} active />
                    <Pill label={`${matchedAgent.distanceKm} km`} />
                    <Pill label="ETA 8 minutes" />
                  </View>
                  <View style={styles.rowWrap}>
                    {matchedAgent.services.map((service) => <Info key={service} label={service} />)}
                  </View>
                  <View style={styles.alert}>
                    <Text style={styles.alertTitle}>Estimated service fee</Text>
                    <Text style={styles.alertText}>PHP 350 - PHP 500. Standardized pricing helps prevent overcharging.</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable style={styles.ghost} onPress={findAnotherAgent}>
                    <Text style={styles.ghostText}>Find another</Text>
                  </Pressable>
                  <Pressable style={styles.action} onPress={requestRescue}>
                    <Text style={styles.actionText}>Request rescue</Text>
                  </Pressable>
                </View>
              </>
            ) : agentSearchError ? (
              <>
                <Text style={styles.title}>No Agent Available</Text>
                <Text style={styles.text}>{agentSearchError}</Text>
              </>
            ) : null}
          </View>
        )}

        {screen === "agent-app" && (
          <>
            <TopCard title={`Agent Hub - ${agentName}`} subtitle="Requests, navigation, and performance" onExit={() => setScreen("role")} />
            <View style={styles.card}>
              <View style={styles.between}>
                <View style={styles.flex}>
                  <Text style={styles.title}>{availability ? "You are online" : "You are offline"}</Text>
                  <Text style={styles.text}>{availability ? "Receiving nearby requests from motorists." : "Go online to receive new dispatches."}</Text>
                </View>
                <Switch value={availability} onValueChange={setAvailability} trackColor={{ false: "#475569", true: "#fb923c" }} />
              </View>
            </View>
            <Tabs active={agentTab} setActive={setAgentTab} labels={{ requests: "Requests", navigation: "Navigation", stats: "Stats" }} />

            {agentTab === "requests" && (
              <>
                <View style={styles.double}>
                  <Mini title="Today jobs" value={`${agentDispatches.length}`} />
                  <Mini title="Today earnings" value={agentDispatches.length > 0 ? `PHP ${agentDispatches.length * 350}` : "PHP 0"} accent="#fb923c" />
                </View>
                {agentId ? (
                  <>
                    <MapCard title="Your location" subtitle="Auto-detect your current GPS location" center={agentLocation}>
                      <Marker coordinate={agentLocation} title="Your location" pinColor="#22c55e" />
                    </MapCard>
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
                ) : pendingAgentDispatches.length === 0 ? (
                  activeAgentRequest ? (
                    <View style={styles.card}>
                      <Text style={styles.title}>Ongoing Assignment</Text>
                      <Text style={styles.text}>You have an active rescue request already in progress. Continue in Navigation to finish the job.</Text>
                      <Pressable style={styles.action} onPress={() => setAgentTab("navigation")}>
                        <Text style={styles.actionText}>Go to Navigation</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Empty title="No active requests" subtitle="New motorist requests will appear here." />
                  )
                ) : (
                  pendingAgentDispatches.map((dispatch) => (
                    <View key={dispatch.id} style={styles.card}>
                      <View style={styles.between}>
                        <Text style={styles.title}>{dispatch.motorist.fullName}</Text>
                        <Pill label={dispatch.dispatchStatus === "pending" ? "New Request" : dispatch.dispatchStatus} active={dispatch.dispatchStatus === "pending"} />
                      </View>
                      <Text style={styles.text}>{dispatch.motorist.issueSummary}</Text>
                      <Text style={styles.text}>Location: {dispatch.motorist.latitude.toFixed(4)}, {dispatch.motorist.longitude.toFixed(4)}</Text>
                      <View style={styles.actions}>
                        <Pressable style={styles.ghost} onPress={() => {
                          Alert.alert(
                            "Decline Request",
                            "Are you sure you want to decline this rescue request? This action cannot be undone.",
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "Decline", style: "destructive", onPress: async () => {
                                const backendDispatch = agentDispatches.find((d) => d.id === dispatch.id);
                                if (backendDispatch && agentId) {
                                  try {
                                    await declineDispatch(dispatch.id, agentId);
                                    const refreshedDispatches = await fetchAgentDispatches(agentId);
                                    setAgentDispatches(refreshedDispatches);
                                  } catch (error) {
                                    console.warn("Failed to decline dispatch:", error);
                                    const message = error instanceof Error ? error.message : "Failed to decline the request. Please try again.";
                                    if (/Network request failed|Failed to fetch|404|500/.test(message)) {
                                      setAgentDispatches((current) => current.filter((item) => item.id !== dispatch.id));
                                      Alert.alert("Offline decline", "The request was removed locally, but the backend could not be reached.");
                                    } else if (/not assigned to you|already .*Cannot decline/i.test(message)) {
                                      const refreshedDispatches = await fetchAgentDispatches(agentId);
                                      setAgentDispatches(refreshedDispatches);
                                      Alert.alert("Unable to decline", "This request is no longer pending and cannot be declined.");
                                    } else {
                                      Alert.alert("Error", message);
                                    }
                                  }
                                } else {
                                  // Fallback for local dispatches
                                  setAgentDispatches((current) => current.filter((item) => item.id !== dispatch.id));
                                }
                              }},
                            ]
                          );
                        }}>
                          <Text style={styles.ghostText}>Decline</Text>
                        </Pressable>
                        <Pressable style={styles.action} onPress={() => acceptRequest(dispatch.id)}>
                          <Text style={styles.actionText}>Accept and navigate</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {agentTab === "navigation" && (
              activeAgentRequest ? (
                <>
                  <View style={styles.inlineBack}>
                    <Pressable style={styles.secondary} onPress={() => setAgentTab("requests")}><Text style={styles.secondaryText}>Back to requests</Text></Pressable>
                  </View>
                  <MapCard title="Navigation" subtitle={`${activeAgentRequest.motorist?.fullName || activeAgentRequest.motorist} - Navigate to location`} center={navigationMapCenter} route={route} showRoute={true}>
                    <Marker coordinate={userLocation} title="Motorist" pinColor="#fb923c" />
                    <Marker coordinate={agentLocation} title="Agent" pinColor="#22c55e" />
                  </MapCard>
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
                        Alert.alert("Job completed", "Payment reminder sent to the motorist.");

                        // Update backend in background
                        if (completedId && agentId) {
                          (async () => {
                            try {
                              await updateDispatchStatus(completedId, "completed");
                              const refreshedDispatches = await fetchAgentDispatches(agentId);
                              setAgentDispatches(refreshedDispatches);
                            } catch (error) {
                              console.warn("Failed to complete job on backend:", error);
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
                  <Mini title="Weekly earnings" value="PHP 12,400" accent="#fb923c" />
                  <Mini title="Average rating" value="4.8 / 5" />
                </View>
                <View style={styles.card}>
                  <Text style={styles.title}>Recent job history</Text>
                  {jobHistory.map((item) => (
                    <View key={item} style={styles.list}>
                      <Text style={styles.listTitle}>{item}</Text>
                      <Text style={styles.text}>Completed today</Text>
                    </View>
                  ))}
                </View>
              </>
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
    <View style={styles.card}>
      <View style={styles.between}>
        <Pressable style={styles.secondary} onPress={props.onBack} disabled={props.loading}><Text style={styles.secondaryText}>Back</Text></Pressable>
        <Pill label={props.badge} active />
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

function TopCard(props: { title: string; subtitle: string; onExit: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.between}>
        <View style={styles.flex}>
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.text}>{props.subtitle}</Text>
        </View>
        <Pressable style={styles.secondary} onPress={props.onExit}><Text style={styles.secondaryText}>Switch role</Text></Pressable>
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

function MapCard(props: { title: string; subtitle: string; center: Coords; children: React.ReactNode; route?: Array<{ latitude: number; longitude: number }>; showRoute?: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.between}>
        <View style={styles.flex}>
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.text}>{props.subtitle}</Text>
        </View>
      </View>
      <View style={styles.map}>
        <MapView style={StyleSheet.absoluteFill} region={{ ...props.center, latitudeDelta: 0.08, longitudeDelta: 0.08 }}>
          {props.children}
          {props.showRoute && props.route && props.route.length > 0 && (
            <Polyline
              coordinates={props.route}
              strokeColor="#3b82f6"
              strokeWidth={4}
              lineDashPattern={[10, 10]}
            />
          )}
        </MapView>
      </View>
    </View>
  );
}

function Mini(props: { title: string; value: string; accent?: string }) {
  return <View style={styles.mini}><Text style={styles.label}>{props.title}</Text><Text style={[styles.miniValue, props.accent ? { color: props.accent } : null]}>{props.value}</Text></View>;
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
  safe: { flex: 1, backgroundColor: "#0f172a" },
  wrap: { padding: 16, gap: 14 },
  inlineBack: { marginBottom: -2 },
  heroBackground: { borderRadius: 28, overflow: "hidden", minHeight: 260, justifyContent: "flex-end", padding: 24, marginBottom: 16, backgroundColor: "#0f172a" },
  heroBackgroundImage: { opacity: 0.8 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.7)" },
  heroContent: { position: "relative", gap: 12, maxWidth: "100%" },
  hero: { backgroundColor: "#172033", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#334155", gap: 8 },
  eyebrow: { color: "#fb923c", fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { color: "#f8fafc", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  heroText: { color: "#cbd5e1", fontSize: 15, lineHeight: 22, maxWidth: "85%" },
  heroButtons: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  heroPrimary: { backgroundColor: "#fb923c", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, minWidth: 140, alignItems: "center" },
  heroPrimaryText: { color: "#111827", fontSize: 15, fontWeight: "800" },
  heroSecondary: { borderColor: "#fb923c", borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, minWidth: 140, alignItems: "center" },
  heroSecondaryText: { color: "#fb923c", fontSize: 15, fontWeight: "800" },
  backendNote: { color: "#fdba74", fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: "#172033", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#334155", gap: 10 },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "800" },
  text: { color: "#94a3b8", fontSize: 13, lineHeight: 19 },
  label: { color: "#cbd5e1", fontSize: 13, fontWeight: "700" },
  value: { color: "#fdba74", fontSize: 13, fontWeight: "800" },
  valueBig: { color: "#fb923c", fontSize: 24, fontWeight: "800" },
  input: { backgroundColor: "#0f172a", borderRadius: 14, borderWidth: 1, borderColor: "#334155", color: "#f8fafc", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  error: { color: "#fda4af", fontSize: 12 },
  primary: { backgroundColor: "#fb923c", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#111827", fontSize: 15, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
  secondary: { backgroundColor: "#0f172a", borderRadius: 999, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: "#cbd5e1", fontWeight: "700" },
  success: { backgroundColor: "#16a34a", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  successText: { color: "#f8fafc", fontSize: 15, fontWeight: "800" },
  option: { backgroundColor: "#0f172a", borderRadius: 16, borderWidth: 1, borderColor: "#334155", padding: 14, gap: 6 },
  optionActive: { borderColor: "#fb923c", backgroundColor: "#261d18" },
  optionTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  flex: { flex: 1 },
  tabs: { backgroundColor: "#172033", borderRadius: 18, padding: 4, borderWidth: 1, borderColor: "#334155", flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tab: { flexGrow: 1, minWidth: 92, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  tabActive: { backgroundColor: "#fb923c" },
  tabText: { color: "#94a3b8", fontWeight: "700" },
  tabTextActive: { color: "#111827" },
  map: { height: 280, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "#334155" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stack: { gap: 8 },
  chip: { backgroundColor: "#172033", borderRadius: 999, borderWidth: 1, borderColor: "#475569", paddingHorizontal: 14, paddingVertical: 10 },
  chipActive: { backgroundColor: "#fb923c", borderColor: "#fb923c" },
  chipText: { color: "#cbd5e1", fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#111827" },
  pill: { backgroundColor: "#0f172a", borderRadius: 999, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 10, paddingVertical: 7 },
  pillActive: { backgroundColor: "#261d18", borderColor: "#fb923c" },
  pillText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  pillTextActive: { color: "#fdba74" },
  info: { backgroundColor: "#0f172a", borderRadius: 14, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 8 },
  infoText: { color: "#cbd5e1", fontSize: 12, fontWeight: "600" },
  list: { backgroundColor: "#0f172a", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#334155", gap: 6 },
  listActive: { borderColor: "#fb923c" },
  listTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "800", flex: 1 },
  double: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mini: { flex: 1, minWidth: 140, backgroundColor: "#172033", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#334155", gap: 8 },
  miniValue: { color: "#f8fafc", fontSize: 22, fontWeight: "800" },
  alert: { backgroundColor: "#261d18", borderRadius: 18, borderWidth: 1, borderColor: "#fb923c", padding: 16, gap: 6 },
  alertTitle: { color: "#fdba74", fontSize: 16, fontWeight: "800", textTransform: "capitalize" },
  alertText: { color: "#fed7aa", fontSize: 13, lineHeight: 19 },
  empty: { backgroundColor: "#172033", borderRadius: 20, borderWidth: 1, borderColor: "#334155", padding: 28, alignItems: "center", gap: 8 },
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
