import { MapPin } from "lucide-react";

interface LocationCardProps {
  address: string;
  distance?: string;
  estimatedTime?: string;
  latitude: number;
  longitude: number;
}

export function LocationCard({
  address,
  distance,
  estimatedTime,
  latitude,
  longitude,
}: LocationCardProps) {
  const handleOpenInMaps = () => {
    // Open in Google Maps with coordinates
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(mapsUrl, "_blank");
  };

  return (
    <div className="bg-white/95 rounded-xl p-4 shadow-lg flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 mt-0.5">
          <MapPin className="w-5 h-5 text-gray-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 mb-1">{address}</p>
          {(distance || estimatedTime) && (
            <p className="text-xs text-gray-600">
              {distance && <span>{distance}</span>}
              {distance && estimatedTime && <span> • </span>}
              {estimatedTime && <span>{estimatedTime} away</span>}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={handleOpenInMaps}
        className="px-4 py-2.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap shadow-md"
      >
        Open in Maps
      </button>
    </div>
  );
}
