import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Car, MapPin, Phone, Clock, CheckCircle, AlertCircle, Navigation, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { SUSSurvey, SUSResponses } from "../../components/SUSSurvey";
import { LogoWithSecret } from "../../components/LogoWithSecret";
import { LocationMap } from "../../components/LocationMap";
import { fetchDispatchDetails } from "../../api";

export function LiveTracking() {
  const { dispatchId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"dispatched" | "en-route" | "arrived" | "in-service" | "completed">("dispatched");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [slaTimer, setSlaTimer] = useState(480); // 8 minutes SLA
  const [agentLocation, setAgentLocation] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [dispatchData, setDispatchData] = useState<any>(null);
  const [showSUSSurvey, setShowSUSSurvey] = useState(false);
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);

  // Load dispatch details
  useEffect(() => {
    const loadDispatch = async () => {
      try {
        const data = await fetchDispatchDetails(dispatchId!);
        setDispatchData(data);
        setUserLocation([data.motorist.latitude, data.motorist.longitude]);
        setAgentLocation(data.agent?.currentLatitude && data.agent?.currentLongitude 
          ? [data.agent.currentLatitude, data.agent.currentLongitude] 
          : null);
        setStatus(data.dispatchStatus === "accepted" ? "en-route" :
                 data.dispatchStatus === "arrived" ? "arrived" :
                 data.dispatchStatus === "completed" ? "completed" : "dispatched");
      } catch (error) {
        console.error("Failed to load dispatch:", error);
        alert("Failed to load dispatch details");
      } finally {
        setIsLoading(false);
      }
    };

    loadDispatch();
  }, [dispatchId]);

  // Poll for real-time updates
  useEffect(() => {
    if (!dispatchData) return;

    const pollInterval = setInterval(async () => {
      try {
        const data = await fetchDispatchDetails(dispatchId!);
        setDispatchData(data);
        setAgentLocation(data.agent?.currentLatitude && data.agent?.currentLongitude 
          ? [data.agent.currentLatitude, data.agent.currentLongitude] 
          : null);
        setStatus(data.dispatchStatus === "accepted" ? "en-route" :
                 data.dispatchStatus === "arrived" ? "arrived" :
                 data.dispatchStatus === "completed" ? "completed" : "dispatched");
      } catch (error) {
        console.error("Failed to poll dispatch updates:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [dispatchData, dispatchId]);

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // SLA countdown
  useEffect(() => {
    if (status !== "completed" && slaTimer > 0) {
      const timer = setInterval(() => {
        setSlaTimer((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, slaTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCompleteService = () => {
    setStatus("completed");
    // Show SUS survey after a short delay
    setTimeout(() => {
      setShowSUSSurvey(true);
    }, 1000);
  };

  const handleSurveySubmit = (responses: SUSResponses) => {
    console.log("SUS Survey Responses:", responses);
    setSurveySubmitted(true);
    setShowSUSSurvey(false);
    alert("Thank you for your feedback! Your responses help us improve RoadResQ.");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b3d] mx-auto mb-4"></div>
          <p>Loading tracking information...</p>
        </div>
      </div>
    );
  }

  if (!dispatchData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <p>Dispatch not found</p>
          <button 
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 bg-[#ff6b3d] text-white rounded-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Mock agent data - replace with real data from dispatchData.agent
  const agent = {
    name: dispatchData.agent?.businessName || "RoadResQ Agent",
    phone: dispatchData.agent?.phone || "+63 917 123 4567",
    vehicleNumber: "ABC 1234", // This would need to be added to the schema
    eta: agentLocation && userLocation ? calculateETA(agentLocation, userLocation) : "Calculating...",
  };

  function calculateETA(agentLoc: [number, number], userLoc: [number, number]): string {
    // Simple distance calculation (rough estimate)
    const R = 6371; // Earth's radius in km
    const dLat = (userLoc[0] - agentLoc[0]) * Math.PI / 180;
    const dLon = (userLoc[1] - agentLoc[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(agentLoc[0] * Math.PI / 180) * Math.cos(userLoc[0] * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in km

    // Assume average speed of 30 km/h in city traffic
    const etaMinutes = Math.ceil((distance / 30) * 60);
    return `${etaMinutes} min`;
  }

  const statusConfig = {
    dispatched: {
      icon: Clock,
      color: "blue",
      label: "Agent Dispatched",
      description: "Your rescue agent has been notified and is preparing to assist you",
    },
    "en-route": {
      icon: Navigation,
      color: "yellow",
      label: "Agent En Route",
      description: "Agent is on the way to your location",
    },
    arrived: {
      icon: MapPin,
      color: "purple",
      label: "Agent Arrived",
      description: "Agent has arrived at your location",
    },
    "in-service": {
      icon: CheckCircle,
      color: "orange",
      label: "Service In Progress",
      description: "Agent is working on your vehicle",
    },
    completed: {
      icon: CheckCircle,
      color: "green",
      label: "Service Completed",
      description: "Your rescue service has been completed",
    },
  };

  const currentConfig = statusConfig[status];
  const StatusIcon = currentConfig.icon;

  if (status === "completed") {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {showSUSSurvey && (
          <SUSSurvey
            onClose={() => setShowSUSSurvey(false)}
            onSubmit={handleSurveySubmit}
          />
        )}

        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <LogoWithSecret />
          </div>
        </header>

        <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center w-full"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/30 rounded-full mb-5 border-2 border-green-500">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Service Completed!
            </h1>
            <p className="text-sm text-gray-400 mb-6">
              Thank you for using RoadResQ. We hope your vehicle is back on the road safely.
            </p>

            <div className="bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-700 mb-5">
              <h3 className="text-sm font-semibold text-white mb-3">Service Summary</h3>
              <div className="space-y-2.5 text-left">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Dispatch ID:</span>
                  <span className="font-medium text-white font-mono">{dispatchId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Agent:</span>
                  <span className="font-medium text-white truncate ml-2">{agent.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Total Time:</span>
                  <span className="font-medium text-white">{formatTime(elapsedTime)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Service Fee:</span>
                  <span className="font-medium text-green-400">₱450</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-500/50 mb-4">
              <p className="text-xs text-yellow-100">
                💰 Please settle payment directly with the agent via cash or mobile wallet
              </p>
            </div>

            {!surveySubmitted && (
              <div className="bg-[#ff6b3d]/20 rounded-lg p-3 border border-[#ff6b3d]/50 mb-4">
                <p className="text-xs text-gray-200 mb-2.5">
                  📋 Help us improve! Share your experience with our quick survey.
                </p>
                <button
                  onClick={() => setShowSUSSurvey(true)}
                  className="w-full bg-[#ff6b3d] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#ff5722] transition-colors"
                >
                  Take Survey Now
                </button>
              </div>
            )}

            {surveySubmitted && (
              <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/50 mb-4">
                <p className="text-xs text-green-400">
                  ✓ Thank you for completing the survey!
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => navigate("/")}
                className="w-full bg-[#ff6b3d] text-white py-3.5 rounded-xl font-semibold hover:bg-[#ff5722] transition-colors"
              >
                Back to Home
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/user/dashboard")}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Go back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <LogoWithSecret />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-5 max-w-4xl mx-auto w-full">
        {/* Status Header */}
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-4 mb-5 border ${
            status === "dispatched" ? "bg-blue-900/30 border-blue-500/50" :
            status === "en-route" ? "bg-yellow-900/30 border-yellow-500/50" :
            status === "arrived" ? "bg-purple-900/30 border-purple-500/50" :
            status === "in-service" ? "bg-[#ff6b3d]/20 border-[#ff6b3d]/50" :
            "bg-green-900/30 border-green-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${
              status === "dispatched" ? "bg-blue-900/50" :
              status === "en-route" ? "bg-yellow-900/50" :
              status === "arrived" ? "bg-purple-900/50" :
              status === "in-service" ? "bg-[#ff6b3d]/30" :
              "bg-green-900/50"
            }`}>
              <StatusIcon className={`w-6 h-6 ${
                status === "dispatched" ? "text-blue-400" :
                status === "en-route" ? "text-yellow-400" :
                status === "arrived" ? "text-purple-400" :
                status === "in-service" ? "text-[#ff6b3d]" :
                "text-green-400"
              }`} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-white mb-0.5">
                {currentConfig.label}
              </h2>
              <p className="text-xs text-gray-300">{currentConfig.description}</p>
            </div>
          </div>
        </motion.div>

        {/* Map Placeholder */}
        <div className="bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-700 mb-5">
          <LocationMap
            center={userLocation || [14.0676, 121.4174]}
            zoom={14}
            agentLocation={agentLocation || undefined}
            userLocation={userLocation || undefined}
            showRoute={true}
            onDistanceCalculated={(dist, etaMinutes) => {
              setDistance(dist);
              setEta(etaMinutes);
            }}
            height="400px"
          />
          {distance !== null && eta !== null && agentLocation && (
            <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/50 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-300">Agent distance:</span>
                <span className="font-semibold text-white">{distance.toFixed(1)} km</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-gray-300">Estimated arrival:</span>
                <span className="font-semibold text-white">{eta} min</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 mb-5">
          {/* Timers */}
          <div className="bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-3">Service Timers</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400">Elapsed Time</span>
                  <span className="text-base font-mono font-bold text-white">
                    {formatTime(elapsedTime)}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((elapsedTime / 600) * 100, 100)}%` }}
                    className="h-full bg-[#ff6b3d]"
                  ></motion.div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    SLA Timer
                  </span>
                  <span className={`text-base font-mono font-bold ${
                    slaTimer < 60 ? "text-red-400" : "text-green-400"
                  }`}>
                    {formatTime(slaTimer)}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${(slaTimer / 480) * 100}%` }}
                    className={`h-full ${
                      slaTimer < 60 ? "bg-red-500" : "bg-green-500"
                    }`}
                  ></motion.div>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Info */}
          <div className="bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-3">Agent Details</h3>
            <div className="space-y-2.5">
              <div>
                <p className="text-xs text-gray-400">Name</p>
                <p className="text-sm font-medium text-white">{agent.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Vehicle Number</p>
                <p className="text-sm font-medium text-white">{agent.vehicleNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Estimated Arrival</p>
                <p className="text-sm font-medium text-white">{agent.eta}</p>
              </div>
              <a
                href={`tel:${agent.phone}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#ff6b3d] text-white text-sm rounded-lg font-medium hover:bg-[#ff5722] transition-colors mt-3"
              >
                <Phone className="w-4 h-4" />
                Call Agent
              </a>
            </div>
          </div>
        </div>

        {/* Demo Action Button */}
        {status === "in-service" && (
          <button
            onClick={handleCompleteService}
            className="w-full bg-green-600 text-white py-3.5 rounded-xl font-semibold hover:bg-green-700 transition-colors mb-5"
          >
            Mark as Completed (Demo)
          </button>
        )}

        {/* Safety Notice */}
        <div className="bg-red-900/30 rounded-lg p-3 border border-red-500/50">
          <p className="text-xs text-red-200">
            <strong>Safety First:</strong> If you have medical injuries or require emergency medical services, please contact 911 or your local emergency hotline immediately.
          </p>
        </div>
      </main>
    </div>
  );
}