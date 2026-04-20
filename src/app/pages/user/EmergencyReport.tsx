import { useState } from "react";
import { useNavigate } from "react-router";
import { MapPin, Phone, LogOut, Navigation, Car, ArrowLeft } from "lucide-react";
import { LogoWithSecret } from "../../components/LogoWithSecret";
import { LocationMap } from "../../components/LocationMap";
import { LocationCard } from "../../components/LocationCard";
import { setEmergencyDraft } from "../../session";

export function EmergencyReport() {
  const navigate = useNavigate();
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState<[number, number]>([14.0676, 121.4174]); // Default: San Pablo City, Laguna
  const [serviceType, setServiceType] = useState<"repair" | "transport" | "">("");
  const [detecting, setDetecting] = useState(false);
  const [showLocationCard, setShowLocationCard] = useState(false);

  const handleDetectLocation = () => {
    setDetecting(true);
    // Mock GPS detection - in real app this would use navigator.geolocation
    setTimeout(() => {
      setLocation("San Pablo City, Laguna - National Highway, Brgy. San Antonio");
      setCoordinates([14.0676, 121.4174]);
      setDetecting(false);
    }, 1500);
  };

  const handleLocationDetected = (lat: number, lng: number, address: string) => {
    setLocation(address);
    setCoordinates([lat, lng]);
    setShowLocationCard(true);
  };

  const handleContinue = () => {
    if (serviceType) {
      setEmergencyDraft({
        locationLabel: location,
        latitude: coordinates[0],
        longitude: coordinates[1],
        serviceType,
        issueSummary: "",
        symptoms: [],
      });
      navigate("/user/triage");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
            <LogoWithSecret />
          </div>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs sm:text-sm">Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Emergency Reporting
          </h1>
          <p className="text-sm text-gray-400">
            Tell us where you are and what type of help you need
          </p>
        </div>

        <div className="space-y-5">
          {/* Map Section */}
          <div className="bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-700">
            <label className="block text-sm font-semibold text-white mb-3">
              Your Location on Map
            </label>
            <div className="relative">
              <LocationMap
                center={coordinates}
                zoom={15}
                showUserLocation={true}
                userLocation={coordinates}
                onLocationDetected={handleLocationDetected}
                height="300px"
              />
              {/* Location Card Overlay */}
              {showLocationCard && location && (
                <div className="absolute bottom-4 left-4 right-4 z-[1001]">
                  <LocationCard
                    address={location}
                    distance="1.2 km"
                    estimatedTime="5 min"
                    latitude={coordinates[0]}
                    longitude={coordinates[1]}
                  />
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-gray-400 flex items-start gap-1.5">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
              Click "My Location" button on the map to detect your current position
            </p>
          </div>

          {/* Location Input */}
          <div className="bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-700">
            <label className="block text-sm font-semibold text-white mb-3">
              Your Location
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter your location"
                  className="w-full pl-10 pr-3 py-3 bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent placeholder-gray-500"
                />
              </div>
              <button
                onClick={handleDetectLocation}
                disabled={detecting}
                className="px-4 py-3 bg-[#ff6b3d] text-white text-sm rounded-lg font-semibold hover:bg-[#ff5722] transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Navigation className="w-4 h-4" />
                {detecting ? "Detecting..." : "Auto-Detect"}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400 flex items-start gap-1.5">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
              GPS location will be captured automatically
            </p>
          </div>

          {/* Service Type Selection */}
          <div className="bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-700">
            <label className="block text-sm font-semibold text-white mb-3">
              Service Type Needed
            </label>
            <div className="space-y-3">
              <button
                onClick={() => setServiceType("repair")}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  serviceType === "repair"
                    ? "border-[#ff6b3d] bg-[#ff6b3d]/10"
                    : "border-gray-600 hover:border-gray-500"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    serviceType === "repair" ? "bg-[#ff6b3d]" : "bg-gray-700"
                  }`}>
                    <Car className={`w-5 h-5 ${
                      serviceType === "repair" ? "text-white" : "text-gray-400"
                    }`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">
                      Repair / Mechanical
                    </h3>
                    <p className="text-xs text-gray-400">
                      Flat tire, engine trouble, battery issues
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setServiceType("transport")}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  serviceType === "transport"
                    ? "border-[#ff6b3d] bg-[#ff6b3d]/10"
                    : "border-gray-600 hover:border-gray-500"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    serviceType === "transport" ? "bg-[#ff6b3d]" : "bg-gray-700"
                  }`}>
                    <Car className={`w-5 h-5 ${
                      serviceType === "transport" ? "text-white" : "text-gray-400"
                    }`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">
                      Transport Rescue / Towing
                    </h3>
                    <p className="text-xs text-gray-400">
                      Vehicle needs to be towed to a repair shop
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!location || !serviceType}
            className="w-full bg-[#ff6b3d] text-white py-4 rounded-xl font-semibold hover:bg-[#ff5722] transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            Continue to Symptom Report
          </button>
        </div>
      </main>
    </div>
  );
}
