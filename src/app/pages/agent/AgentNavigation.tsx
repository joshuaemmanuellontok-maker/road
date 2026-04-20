import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Wrench, MapPin, Phone, Navigation, CheckCircle, Clock, ArrowLeft, Edit2, Check, X } from "lucide-react";
import { motion } from "motion/react";
import { LocationMap } from "../../components/LocationMap";
import { fetchDispatchDetails, updateAgentLocation, updateDispatchStatus } from "../../api";

export function AgentNavigation() {
  const { dispatchId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"en-route" | "arrived" | "working">("en-route");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [agentLocation, setAgentLocation] = useState<[number, number] | null>(null);
  const [motoristLocation, setMotoristLocation] = useState<[number, number] | null>(null);
  const [dispatchData, setDispatchData] = useState<any>(null);
  const [estimatedFee, setEstimatedFee] = useState("₱350");
  const [isEditingFee, setIsEditingFee] = useState(false);
  const [tempFee, setTempFee] = useState("₱350");
  const [isLoading, setIsLoading] = useState(true);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);

  // Load dispatch details
  useEffect(() => {
    const loadDispatch = async () => {
      try {
        const data = await fetchDispatchDetails(dispatchId!);
        setDispatchData(data);
        setMotoristLocation([data.motorist.latitude, data.motorist.longitude]);
        setStatus(data.dispatchStatus === "accepted" ? "en-route" : 
                 data.dispatchStatus === "arrived" ? "arrived" : "en-route");
      } catch (error) {
        console.error("Failed to load dispatch:", error);
        alert("Failed to load dispatch details");
      } finally {
        setIsLoading(false);
      }
    };

    loadDispatch();
  }, [dispatchId]);

  // Start location tracking
  useEffect(() => {
    if (!dispatchData?.agent?.id) return;

    const startLocationTracking = () => {
      if ("geolocation" in navigator) {
        const watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const newLocation: [number, number] = [latitude, longitude];
            setAgentLocation(newLocation);

            // Send location update to backend
            try {
              await updateAgentLocation(dispatchData.agent.id, { latitude, longitude });
            } catch (error) {
              console.error("Failed to update location:", error);
            }
          },
          (error) => {
            console.warn("Geolocation error:", error);
            // Fallback to a default location near the motorist
            if (motoristLocation) {
              setAgentLocation(motoristLocation);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          }
        );

        setLocationWatchId(watchId);
      }
    };

    startLocationTracking();

    return () => {
      if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [dispatchData, motoristLocation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStatusUpdate = async (newStatus: typeof status) => {
    try {
      const statusMap = {
        "en-route": "accepted",
        "arrived": "arrived", 
        "working": "arrived" // Keep as arrived until completed
      };

      await updateDispatchStatus(dispatchId!, statusMap[newStatus]);
      setStatus(newStatus);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status");
    }
  };

  const handleCompleteJob = async () => {
    try {
      await updateDispatchStatus(dispatchId!, "completed");
      alert("Job marked as completed! Payment reminder sent to motorist.");
      navigate("/agent/dashboard");
    } catch (error) {
      console.error("Failed to complete job:", error);
      alert("Failed to complete job");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1f2937] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b3d] mx-auto mb-4"></div>
          <p>Loading dispatch details...</p>
        </div>
      </div>
    );
  }

  if (!dispatchData) {
    return (
      <div className="min-h-screen bg-[#1f2937] flex items-center justify-center text-white">
        <div className="text-center">
          <p>Dispatch not found</p>
          <button 
            onClick={() => navigate("/agent/dashboard")}
            className="mt-4 px-4 py-2 bg-[#ff6b3d] text-white rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const motorist = {
    name: dispatchData.motorist.fullName,
    phone: dispatchData.motorist.phone,
    location: dispatchData.motorist.locationLabel,
    symptoms: [], // Would need to fetch symptoms separately
  };

  return (
    <div className="min-h-screen bg-[#1f2937] flex flex-col text-white">
      {/* Header */}
      <header className="bg-black/20 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/agent/dashboard")}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back to dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div className="flex items-center gap-2">
              <Wrench className="w-6 h-6 text-[#ff6b3d]" />
              <span className="text-xl font-bold text-white">Active Job</span>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            ID: <span className="font-mono text-gray-300">{dispatchId}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
        {/* Status Display */}
        <div className={`rounded-2xl p-6 mb-6 ${
          status === "en-route" ? "bg-yellow-900/20 border border-yellow-500/50" :
          status === "arrived" ? "bg-purple-900/20 border border-purple-500/50" :
          "bg-blue-900/20 border border-blue-500/50"
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${
              status === "en-route" ? "bg-yellow-500/20" :
              status === "arrived" ? "bg-purple-500/20" :
              "bg-blue-500/20"
            }`}>
              {status === "en-route" && <Navigation className="w-8 h-8 text-yellow-500" />}
              {status === "arrived" && <MapPin className="w-8 h-8 text-purple-500" />}
              {status === "working" && <Wrench className="w-8 h-8 text-blue-500" />}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">
                {status === "en-route" && "En Route to Location"}
                {status === "arrived" && "Arrived at Location"}
                {status === "working" && "Service in Progress"}
              </h2>
              <p className="text-gray-300">
                {status === "en-route" && "Navigate to the motorist's location"}
                {status === "arrived" && "Motorist is waiting for your assistance"}
                {status === "working" && "Working on the vehicle"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Elapsed</p>
              <p className="text-2xl font-bold text-white font-mono">
                {formatTime(elapsedTime)}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Map */}
        <div className="bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-700 mb-6">
          <LocationMap
            center={motoristLocation || [14.0676, 121.4174]}
            zoom={14}
            agentLocation={agentLocation || undefined}
            userLocation={motoristLocation || undefined}
            showRoute={true}
            onDistanceCalculated={(dist, etaMinutes) => {
              setDistance(dist);
              setEta(etaMinutes);
            }}
            height="400px"
          />
          {distance !== null && eta !== null && (
            <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/50 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-300">Distance to motorist:</span>
                <span className="font-semibold text-white">{distance.toFixed(1)} km</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-gray-300">Estimated arrival:</span>
                <span className="font-semibold text-white">{eta} min</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Motorist Info */}
          <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700">
            <h3 className="font-semibold text-white mb-4">Motorist Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Name</p>
                <p className="font-medium text-white">{motorist.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Location</p>
                <p className="font-medium text-white text-sm">{motorist.location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Issue</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {motorist.symptoms.map((symptom) => (
                    <span
                      key={symptom}
                      className="px-2 py-1 bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-full"
                    >
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
              <a
                href={`tel:${motorist.phone}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#ff6b3d] text-white rounded-xl font-medium hover:bg-[#ff5722] transition-colors mt-4"
              >
                <Phone className="w-5 h-5" />
                Call Motorist
              </a>
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700">
            <h3 className="font-semibold text-white mb-4">Service Details</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-400">Estimated Service Fee</p>
                  {!isEditingFee && (
                    <button
                      onClick={() => setIsEditingFee(true)}
                      className="text-sm flex items-center gap-1 text-[#ff6b3d] hover:text-[#ff5722] transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                </div>
                {isEditingFee ? (
                  <div className="flex items-center gap-2 mt-1">
                    <label htmlFor="estimated-fee" className="sr-only">
                      Estimated service fee
                    </label>
                    <input
                      id="estimated-fee"
                      type="text"
                      value={tempFee}
                      onChange={(e) => setTempFee(e.target.value)}
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-1 text-white focus:outline-none focus:border-[#ff6b3d] w-32 font-bold text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEstimatedFee(tempFee);
                        setIsEditingFee(false);
                      }}
                      className="p-1.5 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition-colors"
                      aria-label="Save updated service fee"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempFee(estimatedFee);
                        setIsEditingFee(false);
                      }}
                      className="p-1.5 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
                      aria-label="Cancel fee edit"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-[#ff6b3d]">{estimatedFee}</p>
                )}
              </div>
              <div className="bg-yellow-900/20 rounded-lg p-3 border border-yellow-500/50">
                <p className="text-sm text-gray-300">
                  💡 <strong className="text-white">Payment:</strong> Collect payment directly via cash or mobile wallet after completing the service.
                </p>
              </div>
              <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/50">
                <p className="text-sm text-gray-300">
                  📋 <strong className="text-white">SLA Timer:</strong> Complete within the agreed timeframe for better ratings.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Update Buttons */}
        <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700 mb-6">
          <h3 className="font-semibold text-white mb-4">Update Status</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleStatusUpdate("en-route")}
              disabled={status === "en-route"}
              className={`py-3 px-4 rounded-xl font-semibold transition-colors ${
                status === "en-route"
                  ? "bg-yellow-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <Navigation className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">En Route</span>
            </button>
            <button
              onClick={() => handleStatusUpdate("arrived")}
              disabled={status === "arrived"}
              className={`py-3 px-4 rounded-xl font-semibold transition-colors ${
                status === "arrived"
                  ? "bg-purple-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <MapPin className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">Arrived</span>
            </button>
            <button
              onClick={() => handleStatusUpdate("working")}
              disabled={status === "working"}
              className={`py-3 px-4 rounded-xl font-semibold transition-colors ${
                status === "working"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <Wrench className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">Working</span>
            </button>
          </div>
        </div>

        {/* Complete Job Button */}
        {status === "working" && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleCompleteJob}
            className="w-full bg-[#ff6b3d] text-white py-5 rounded-xl font-semibold text-lg hover:bg-[#ff5722] transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <CheckCircle className="w-6 h-6" />
            Mark Job as Completed
          </motion.button>
        )}
      </main>
    </div>
  );
}