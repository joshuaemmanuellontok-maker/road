import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Car, MapPin, Clock, Star, Phone, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { LogoWithSecret } from "../../components/LogoWithSecret";
import { createEmergencyDispatch } from "../../api";
import {
  clearEmergencyDraft,
  getEmergencyDraft,
  getStoredUserSession,
  setActiveDispatch,
} from "../../session";

// Mock agent data
const mockAgent = {
  id: "agent-001",
  name: "Mang Pedring's Auto Repair",
  type: "Mechanic",
  rating: 4.8,
  distance: "1.2 km",
  eta: "8 minutes",
  specialties: ["Tire Repair", "Battery Replacement", "Engine Diagnostics"],
  completedJobs: 247,
  phone: "+63 917 123 4567",
};

export function FindingAgent() {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(true);
  const [agentFound, setAgentFound] = useState(false);
  const [matchedAgent, setMatchedAgent] = useState<typeof mockAgent | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Simulate proximity-based matching
    const searchTimer = setTimeout(() => {
      setSearching(false);
      setAgentFound(true);
      setMatchedAgent(mockAgent);
    }, 3000);

    return () => clearTimeout(searchTimer);
  }, []);

  const handleAcceptAgent = async () => {
    const draft = getEmergencyDraft();
    const session = getStoredUserSession();

    if (!draft || !session?.username || !session.mobileNumber) {
      setErrorMessage("Missing emergency report details. Please restart the request flow.");
      return;
    }

    setRequesting(true);
    setErrorMessage("");

    try {
      const result = await createEmergencyDispatch({
        username: session.username,
        mobileNumber: session.mobileNumber,
        locationLabel: draft.locationLabel,
        latitude: draft.latitude,
        longitude: draft.longitude,
        serviceType: draft.serviceType,
        issueSummary: draft.issueSummary || draft.symptoms.join(", "),
        symptoms: draft.symptoms,
      });

      setActiveDispatch(result.dispatchId);
      clearEmergencyDraft();
      navigate(`/user/tracking/${result.dispatchId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create dispatch.");
    } finally {
      setRequesting(false);
    }
  };

  const handleRejectAgent = () => {
    // Restart search
    setSearching(true);
    setAgentFound(false);
    setMatchedAgent(null);

    setTimeout(() => {
      setSearching(false);
      setAgentFound(true);
      setMatchedAgent(mockAgent);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <LogoWithSecret />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full flex items-center justify-center">
        {searching ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center px-4"
          >
            <div className="relative mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 mx-auto"
              >
                <div className="w-full h-full rounded-full border-4 border-[#ff6b3d]/30 border-t-[#ff6b3d]"></div>
              </motion.div>
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="w-8 h-8 text-[#ff6b3d]" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Finding Nearest Responder...
            </h2>
            <p className="text-sm text-gray-400 mb-5">
              Searching for available rescue responders in your area
            </p>
            <div className="space-y-2 max-w-md mx-auto">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3 }}
                className="h-1 bg-[#ff6b3d] rounded-full"
              ></motion.div>
              <p className="text-xs text-gray-500">
                Using proximity-based matching engine...
              </p>
            </div>
          </motion.div>
        ) : agentFound && matchedAgent ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-900/30 rounded-full mb-3 border-2 border-green-500">
                <Car className="w-7 h-7 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1.5">
                Responder Found!
              </h2>
              <p className="text-sm text-gray-400">
                We've matched you with a nearby rescue responder
              </p>
            </div>

            {errorMessage ? (
              <div className="mb-5 rounded-xl border border-red-500/50 bg-red-900/20 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700 mb-5">
              {/* Agent Info */}
              <div className="flex items-start gap-3 mb-5 pb-5 border-b border-gray-700">
                <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Car className="w-6 h-6 text-[#ff6b3d]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white mb-0.5 truncate">
                    {matchedAgent.name}
                  </h3>
                  <p className="text-xs text-gray-400 mb-2">{matchedAgent.type}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="font-medium text-white">{matchedAgent.rating}</span>
                    </div>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-400">
                      {matchedAgent.completedJobs} jobs
                    </span>
                  </div>
                </div>
              </div>

              {/* Distance & ETA */}
              <div className="grid grid-cols-2 gap-3 mb-5 pb-5 border-b border-gray-700">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#ff6b3d]/20 rounded-lg">
                    <MapPin className="w-4 h-4 text-[#ff6b3d]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Distance</p>
                    <p className="text-sm font-semibold text-white">
                      {matchedAgent.distance}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-green-900/30 rounded-lg">
                    <Clock className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Est. Arrival</p>
                    <p className="text-sm font-semibold text-white">
                      {matchedAgent.eta}
                    </p>
                  </div>
                </div>
              </div>

              {/* Specialties */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-white mb-2">
                  Specialties
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchedAgent.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="px-2 py-1 bg-[#ff6b3d]/20 text-[#ff6b3d] text-xs rounded-full border border-[#ff6b3d]/30"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <a
                href={`tel:${matchedAgent.phone}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-gray-700 text-white text-sm rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Contact Responder
              </a>
            </div>

            {/* Fare Estimate */}
            <div className="bg-green-900/30 rounded-xl p-3.5 border border-green-500/50 mb-5">
              <p className="text-xs font-semibold text-white mb-1.5">
                Estimated Service Fee
              </p>
              <p className="text-xl font-bold text-green-400 mb-1">₱350 - ₱500</p>
              <p className="text-xs text-gray-400">
                Standardized pricing to prevent overcharging. Final payment can use Soteria Credits or direct online payment.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRejectAgent}
                className="py-3.5 border-2 border-gray-600 text-gray-300 text-sm rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                Find Another
              </button>
              <button
                onClick={handleAcceptAgent}
                disabled={requesting}
                className="py-3.5 bg-[#ff6b3d] text-white text-sm rounded-lg font-semibold hover:bg-[#ff5722] transition-colors"
              >
                {requesting ? "Requesting..." : "Request Rescue"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </main>
    </div>
  );
}
