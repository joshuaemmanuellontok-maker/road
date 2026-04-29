import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  MapPin,
  Phone,
  LogOut,
  Car,
  AlertCircle,
  Wrench,
  XCircle,
  ArrowLeft,
  Star,
  MessageSquareText,
} from "lucide-react";
import { LogoWithSecret } from "../../components/LogoWithSecret";
import { LocationMap } from "../../components/LocationMap";
import { getStoredUserSession, clearStoredUserSession } from "../../session";
import {
  fetchAvailableAgents,
  fetchDispatchHistory,
  type AvailableAgent,
  type DispatchHistoryEntry,
  calculateDistance,
} from "../../api";

export function MotoristDashboard() {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<[number, number]>([14.0676, 121.4174]);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [agents, setAgents] = useState<AvailableAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<AvailableAgent | null>(null);
  const [feedbackHistory, setFeedbackHistory] = useState<DispatchHistoryEntry[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  // Check user session
  useEffect(() => {
    const session = getStoredUserSession();
    if (!session) {
      navigate("/user/login");
    }
  }, [navigate]);

  // Detect location
  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (err) => {
          console.warn("Geolocation error:", err);
          setUserLocation([14.0676, 121.4174]);
        }
      );
    }
  };

  useEffect(() => {
    handleDetectLocation();
  }, []);

  useEffect(() => {
    const session = getStoredUserSession();
    if (!session?.id || session.role !== "motorist") {
      setFeedbackLoading(false);
      return;
    }

    const loadFeedbackHistory = async () => {
      try {
        setFeedbackLoading(true);
        const history = await fetchDispatchHistory(session.id, "motorist");
        setFeedbackHistory(history);
      } catch (loadError) {
        console.error("Error fetching feedback history:", loadError);
      } finally {
        setFeedbackLoading(false);
      }
    };

    loadFeedbackHistory();
  }, []);

  // Fetch real agents from Firebase
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        setError(null);
        const availableAgents = await fetchAvailableAgents();
        setAgents(availableAgents);
        
        if (availableAgents.length === 0) {
          setError("No rescue responders available in your area");
        }
      } catch (err) {
        console.error("Error fetching responders:", err);
        setError(err instanceof Error ? err.message : "Failed to load rescue responders");
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
    
    // Refresh agents every 5 seconds for live updates
    const interval = setInterval(loadAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestOnSpot = () => {
    navigate("/user/emergency");
  };

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgent(agentId);
  };

  const handleOpenDetails = (agent: AvailableAgent) => {
    setSelectedAgentDetails(agent);
    setDetailsModalOpen(true);
  };

  const handleLogout = () => {
    clearStoredUserSession();
    navigate("/");
  };

  // Calculate distance from user to each agent
  const agentsWithDistance = agents.map(agent => ({
    ...agent,
    distance: calculateDistance(
      userLocation[0], userLocation[1],
      agent.currentLatitude, agent.currentLongitude
    )
  })).sort((a, b) => a.distance - b.distance);

  const recentFeedback = feedbackHistory.slice(0, 4);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
            <LogoWithSecret />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs sm:text-sm">Log Out</span>
          </button>
        </div>
      </header>

      {/* Quick Action */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-3">
          <button
            onClick={handleRequestOnSpot}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-xl font-semibold transition-colors shadow-lg"
          >
            <AlertCircle className="w-5 h-5" />
            Request Emergency Rescue
          </button>
          <div className="flex-1 flex items-center justify-center gap-2 bg-[#ff6b3d] text-white px-6 py-4 rounded-xl font-semibold shadow-lg opacity-70 cursor-default">
            <Car className="w-5 h-5" />
            {agents.length} Available Responders
          </div>
          <button
            onClick={() => navigate("/community/forum")}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-6 py-4 font-semibold text-white transition-colors hover:border-[#ff6b3d] hover:text-[#ff9a7a]"
          >
            <MessageSquareText className="w-5 h-5" />
            Community Forum
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">
        <section className="mb-6 rounded-2xl border border-gray-700 bg-gray-800 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Feedback History</h2>
              <p className="mt-1 text-sm text-gray-400">
                Reviews you submitted and feedback you received from rescue responders.
              </p>
            </div>
            <div className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-gray-300">
              {feedbackHistory.length} total
            </div>
          </div>

          {feedbackLoading ? (
            <div className="mt-4 rounded-xl border border-blue-500/40 bg-blue-900/20 px-4 py-3 text-sm text-blue-100">
              Loading feedback history...
            </div>
          ) : recentFeedback.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {recentFeedback.map((item) => {
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/feedback/${item.dispatchId}`)}
                    className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-left transition-colors hover:border-[#ff6b3d]/50 hover:bg-gray-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Completed booking
                        </p>
                        <p className="mt-1 text-sm text-gray-400">{item.counterpartName}</p>
                      </div>
                      <span className="rounded-full bg-[#ff6b3d]/15 px-2 py-1 text-xs font-semibold text-[#ff9a7a]">
                        {item.viewerFeedback?.overallRating ?? 0}/5
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          key={`${item.id}-${index}`}
                          className={`h-4 w-4 ${
                            index < (item.viewerFeedback?.overallRating ?? 0)
                              ? "fill-[#ff6b3d] text-[#ff6b3d]"
                              : "text-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex items-start gap-2 text-sm text-gray-300">
                      <MessageSquareText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                      <p className="line-clamp-2">
                        {item.viewerFeedback?.comment || "No additional notes were included in this review."}
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">
                      {item.serviceLabel} at {item.locationLabel || "Roadside location"}
                    </p>
                    <p className="mt-3 text-xs text-gray-500">
                      Dispatch <span className="font-mono">{item.dispatchId}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-gray-700 bg-gray-900/50 px-4 py-6 text-center">
              <p className="text-sm text-gray-300">No feedback history yet.</p>
            </div>
          )}
        </section>

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Available Rescue Responders
            </h1>
            <p className="text-sm text-gray-400 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {agentsWithDistance.length} responders active
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("map")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                viewMode === "map" ? "bg-[#ff6b3d] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                viewMode === "list" ? "bg-[#ff6b3d] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 rounded-xl border border-yellow-500/50 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-6 rounded-xl border border-blue-500/50 bg-blue-900/20 px-4 py-3 text-sm text-blue-200 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            Loading rescue responders...
          </div>
        )}

        {/* Map View */}
        {!loading && agents.length > 0 && viewMode === "map" ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="relative h-[500px]">
              <LocationMap
                center={userLocation}
                zoom={13}
                showUserLocation={true}
                userLocation={userLocation}
                markers={agentsWithDistance.map(agent => ({
                  position: [agent.currentLatitude, agent.currentLongitude] as [number, number],
                  title: agent.businessName,
                  description: `${(agent.distance).toFixed(1)} km away`
                }))}
                height="500px"
              />
            </div>

            {/* Agent Cards */}
            <div className="p-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700">
              <div className="flex gap-4 overflow-x-auto pb-2">
                {agentsWithDistance.map((agent) => (
                  <div
                    key={agent.id}
                    className={`flex-shrink-0 w-80 bg-gray-800 rounded-xl p-4 border-2 transition-all cursor-pointer ${
                      selectedAgent === agent.id
                        ? "border-[#ff6b3d]"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                    onClick={() => handleAgentSelect(agent.id)}
                  >
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg bg-[#ff6b3d]/20 flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-8 h-8 text-[#ff6b3d]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-sm mb-1 truncate">
                          {agent.businessName}
                        </h3>
                        <div className="flex items-center gap-1 mb-2">
                          <MapPin className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-400">{agent.distance.toFixed(1)} km</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(agent);
                          }}
                          className="w-full py-1.5 bg-[#ff6b3d] hover:bg-[#ff5722] text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : !loading && agents.length > 0 && viewMode === "list" ? (
          <div className="space-y-4">
            {agentsWithDistance.map((agent) => (
              <div
                key={agent.id}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all"
              >
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-xl bg-[#ff6b3d]/20 flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-12 h-12 text-[#ff6b3d]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{agent.businessName}</h3>
                        <p className="text-sm text-gray-400 flex items-center gap-1.5">
                          <Phone className="w-4 h-4" />
                          {agent.phone}
                        </p>
                      </div>
                      <p className="text-sm text-gray-400 text-right">{agent.distance.toFixed(1)} km away</p>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <span className="px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded-lg border border-green-700">
                        🟢 Available
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenDetails(agent)}
                      className="px-4 py-2 bg-[#ff6b3d] hover:bg-[#ff5722] text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">No Responders Available</h3>
            <p className="text-sm text-gray-400 mb-4">
              No rescue responders are currently active. Request help anyway and we'll connect you.
            </p>
            <button
              onClick={handleRequestOnSpot}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
            >
              <AlertCircle className="w-4 h-4" />
              Request Emergency Help
            </button>
          </div>
        )}
      </main>

      {/* Agent Details Modal */}
      {detailsModalOpen && selectedAgentDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-0 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="relative h-40 flex-shrink-0 bg-gradient-to-br from-[#ff6b3d] to-[#ff5722]">
              <div className="absolute inset-0 flex items-center justify-center">
                <Wrench className="w-16 h-16 text-white opacity-20" />
              </div>
              <button
                onClick={() => setDetailsModalOpen(false)}
                aria-label="Close"
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <XCircle className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-4">
                <span className="px-3 py-1 bg-black/60 text-white text-sm rounded-lg font-medium">
                  🟢 Available Now
                </span>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <h2 className="text-2xl font-bold text-white mb-4">
                {selectedAgentDetails.businessName}
              </h2>

              <div className="space-y-4">
                <div className="bg-gray-900 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Contact</h3>
                  <p className="text-white font-mono">{selectedAgentDetails.phone}</p>
                </div>

                <div className="bg-gray-900 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Distance</h3>
                  <p className="text-white">{calculateDistance(userLocation[0], userLocation[1], selectedAgentDetails.currentLatitude, selectedAgentDetails.currentLongitude).toFixed(1)} km away</p>
                </div>

                <div className="bg-gray-900 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Location</h3>
                  <p className="text-white text-sm">
                    Lat: {selectedAgentDetails.currentLatitude.toFixed(6)}<br/>
                    Lng: {selectedAgentDetails.currentLongitude.toFixed(6)}
                  </p>
                </div>

                <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/50">
                  <p className="text-xs text-green-100">
                    ✓ Verified and approved responder<br/>
                    ✓ Real-time location tracking<br/>
                    ✓ Ready to respond immediately
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-900 border-t border-gray-700">
              <a
                href={`tel:${selectedAgentDetails.phone}`}
                className="w-full py-4 bg-[#ff6b3d] hover:bg-[#ff5722] text-white font-bold text-lg rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <Phone className="w-5 h-5" />
                Call Responder Now
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
