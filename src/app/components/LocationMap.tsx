import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "lucide-react";
import { getRoute, calculateDistance, calculateETA } from "../api";

// Fix default marker icon issue in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom marker icon for user location
const userLocationIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;base64," + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff6b3d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" fill="#ff6b3d" opacity="0.2"/>
      <circle cx="12" cy="12" r="3" fill="#ff6b3d"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Custom marker icon for agent location
const agentLocationIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;base64," + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" fill="#22c55e" opacity="0.3"/>
      <circle cx="7" cy="17" r="2" fill="#22c55e"/>
      <circle cx="17" cy="17" r="2" fill="#22c55e"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

interface LocationMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    title: string;
    description?: string;
  }>;
  showUserLocation?: boolean;
  userLocation?: [number, number] | null;
  agentLocation?: [number, number] | null;
  onLocationDetected?: (lat: number, lng: number, address: string) => void;
  showRoute?: boolean;
  onDistanceCalculated?: (distance: number, eta: number) => void;
  height?: string;
}

// Component to handle map center updates and bounds fitting
function MapController({
  center,
  shouldFitBounds,
  userLocation,
  agentLocation
}: {
  center: [number, number];
  shouldFitBounds: boolean;
  userLocation?: [number, number] | null;
  agentLocation?: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !map.getContainer()) return;

    // Stop any ongoing animations to prevent "_leaflet_pos" errors
    map.stop();

    if (shouldFitBounds && userLocation && agentLocation) {
      const bounds = L.latLngBounds([userLocation, agentLocation]);
      map.fitBounds(bounds, { padding: [50, 50], animate: false });
    } else {
      map.setView(center, map.getZoom(), { animate: false });
    }
  }, [center, shouldFitBounds, userLocation, agentLocation]);

  return null;
}

export function LocationMap({
  center,
  zoom = 15,
  markers = [],
  showUserLocation = false,
  userLocation,
  agentLocation,
  onLocationDetected,
  showRoute = false,
  onDistanceCalculated,
  height = "300px",
}: LocationMapProps) {
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(
    userLocation || null
  );
  const [detecting, setDetecting] = useState(false);
  const [route, setRoute] = useState<[number, number][]>([]);
  const mapRef = useRef<L.Map | null>(null);

  // Calculate route and distance when both locations are available
  useEffect(() => {
    if (showRoute && agentLocation && userLocation) {
      const calculateRoute = async () => {
        const routeData = await getRoute(agentLocation, userLocation);
        if (routeData) {
          setRoute(routeData.geometry);
          
          // Calculate distance and ETA
          const distanceKm = calculateDistance(
            agentLocation[0], agentLocation[1], 
            userLocation[0], userLocation[1]
          );
          const etaMinutes = calculateETA(distanceKm);
          
          if (onDistanceCalculated) {
            onDistanceCalculated(distanceKm, etaMinutes);
          }
        }
      };
      
      calculateRoute();
    } else {
      setRoute([]);
    }
  }, [agentLocation, userLocation, showRoute, onDistanceCalculated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.stop();
      }
    };
  }, []);

  const detectLocation = () => {
    setDetecting(true);
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation: [number, number] = [latitude, longitude];
          setCurrentLocation(newLocation);
          
          // Reverse geocode to get address
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            const address = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            
            if (onLocationDetected) {
              onLocationDetected(latitude, longitude, address);
            }
          } catch (error) {
            console.error("Reverse geocoding failed:", error);
            if (onLocationDetected) {
              onLocationDetected(latitude, longitude, `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            }
          }
          
          setDetecting(false);
        },
        (error) => {
          console.warn("Geolocation failed, using fallback location for Laguna province:", error);
          // Fallback to a central location in Laguna province (e.g., Calamba)
          const fallbackLat = 14.2046;
          const fallbackLng = 121.1560;
          const newLocation: [number, number] = [fallbackLat, fallbackLng];
          setCurrentLocation(newLocation);
          
          if (onLocationDetected) {
            onLocationDetected(fallbackLat, fallbackLng, "Calamba, Laguna (Fallback Location)");
          }
          
          setDetecting(false);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser");
      setDetecting(false);
    }
  };

  const displayLocation = currentLocation || center || [0, 0];
  const shouldFitBounds = Boolean(userLocation && agentLocation);

  return (
    <div className="relative">
      <MapContainer
        center={displayLocation}
        zoom={zoom}
        style={{ height, width: "100%", borderRadius: "12px" }}
        ref={mapRef}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController 
          center={displayLocation} 
          shouldFitBounds={shouldFitBounds} 
          userLocation={userLocation} 
          agentLocation={agentLocation} 
        />
        
        {/* User location marker */}
        {showUserLocation && currentLocation && (
          <>
            <Marker position={currentLocation} icon={userLocationIcon}>
              <Popup>
                <div className="text-sm">
                  <strong>Your Location</strong>
                </div>
              </Popup>
            </Marker>
            {/* Accuracy circle */}
            <Circle 
              center={currentLocation} 
              radius={50} 
              pathOptions={{ 
                color: '#ff6b3d', 
                fillColor: '#ff6b3d', 
                fillOpacity: 0.1,
                weight: 2,
                opacity: 0.5
              }} 
            />
          </>
        )}
        
        {/* User location marker (when passed as prop) */}
        {!showUserLocation && userLocation && (
          <>
            <Marker position={userLocation} icon={userLocationIcon}>
              <Popup>
                <div className="text-sm">
                  <strong>Your Location</strong>
                  <p className="text-xs text-gray-600 mt-1">Waiting for rescue</p>
                </div>
              </Popup>
            </Marker>
            <Circle 
              center={userLocation} 
              radius={50} 
              pathOptions={{ 
                color: '#ff6b3d', 
                fillColor: '#ff6b3d', 
                fillOpacity: 0.1,
                weight: 2,
                opacity: 0.5
              }} 
            />
          </>
        )}
        
        {/* Agent location marker */}
        {agentLocation && (
          <>
            <Marker position={agentLocation} icon={agentLocationIcon}>
              <Popup>
                <div className="text-sm">
                  <strong>Agent Location</strong>
                  <p className="text-xs text-gray-600 mt-1">On the way to assist you</p>
                </div>
              </Popup>
            </Marker>
            <Circle 
              center={agentLocation} 
              radius={30} 
              pathOptions={{ 
                color: '#22c55e', 
                fillColor: '#22c55e', 
                fillOpacity: 0.1,
                weight: 2,
                opacity: 0.5
              }} 
            />
          </>
        )}

        {/* Route polyline */}
        {showRoute && route.length > 0 && (
          <Polyline 
            positions={route} 
            pathOptions={{ 
              color: '#3b82f6', 
              weight: 4, 
              opacity: 0.8,
              dashArray: '10, 10' // Dashed line for route
            }} 
          />
        )}
        
        {/* Other markers */}
        {markers.map((marker, index) => (
          <Marker key={index} position={marker.position}>
            <Popup>
              <div className="text-sm">
                <strong>{marker.title}</strong>
                {marker.description && <p className="mt-1">{marker.description}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Detect Location Button Overlay */}
      {showUserLocation && onLocationDetected && (
        <button
          onClick={detectLocation}
          disabled={detecting}
          className="absolute bottom-4 right-4 z-[1000] px-3 py-2 bg-[#ff6b3d] text-white text-xs rounded-lg font-semibold hover:bg-[#ff5722] transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg"
        >
          <Navigation className="w-3.5 h-3.5" />
          {detecting ? "Detecting..." : "My Location"}
        </button>
      )}
    </div>
  );
}