import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { MapPin, Phone, LogOut, Store, Star, Filter, Clock, ChevronDown, Car, AlertCircle, Wrench, XCircle, Info, CheckCircle2, ArrowLeft } from "lucide-react";
import { LogoWithSecret } from "../../components/LogoWithSecret";
import { LocationMap } from "../../components/LocationMap";

// Mock data for nearby repair shops
const mockRepairShops = [
  {
    id: "shop-1",
    name: "Mang Pedring's Auto Repair",
    category: "Mechanic",
    rating: 4.9,
    reviewCount: 124,
    distance: 1.2,
    location: { lat: 14.0680, lng: 121.4180 },
    address: "San Pablo City, Laguna",
    services: ["Engine Repair", "Oil Change", "Brake Service", "Transmission", "Diagnostic Check"],
    priceRange: "₱₱",
    openNow: true,
    responseTime: "~15 min",
    image: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400",
    phone: "0917-123-4567",
  },
  {
    id: "shop-2",
    name: "Bay Vulcanizing Shop",
    category: "Vulcanizing",
    rating: 4.8,
    reviewCount: 89,
    distance: 2.5,
    location: { lat: 14.0650, lng: 121.4200 },
    address: "Bay, Laguna",
    services: ["Tire Repair", "Wheel Balancing", "Tire Replacement", "Patching", "Pressure Check"],
    priceRange: "₱",
    openNow: true,
    responseTime: "~20 min",
    image: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400",
    phone: "0918-234-5678",
  },
  {
    id: "shop-3",
    name: "Calauan Towing Service",
    category: "Towing",
    rating: 4.7,
    reviewCount: 156,
    distance: 3.8,
    location: { lat: 14.0700, lng: 121.4150 },
    address: "Calauan, Laguna",
    services: ["Towing", "Roadside Assistance", "Jumpstart", "Lockout Service", "Fuel Delivery"],
    priceRange: "₱₱₱",
    openNow: true,
    responseTime: "~25 min",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400",
    phone: "0919-345-6789",
  },
  {
    id: "shop-4",
    name: "Los Baños Auto Electric",
    category: "Electrical",
    rating: 4.6,
    reviewCount: 67,
    distance: 4.2,
    location: { lat: 14.0630, lng: 121.4220 },
    address: "Los Baños, Laguna",
    services: ["Electrical Repair", "Battery Replacement", "Wiring", "Alternator Repair", "Lighting Fixes"],
    priceRange: "₱₱",
    openNow: false,
    responseTime: "~30 min",
    image: "https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=400",
    phone: "0920-456-7890",
  },
  {
    id: "shop-5",
    name: "Alaminos Quick Fix",
    category: "Mechanic",
    rating: 4.5,
    reviewCount: 92,
    distance: 5.1,
    location: { lat: 14.0620, lng: 121.4240 },
    address: "Alaminos, Laguna",
    services: ["Quick Repairs", "Diagnostics", "Maintenance", "Belt Replacement"],
    priceRange: "₱₱",
    openNow: true,
    responseTime: "~35 min",
    image: "https://images.unsplash.com/photo-1632823469770-22f4f17e22c7?w=400",
    phone: "0921-567-8901",
  },
  {
    id: "shop-6",
    name: "Sta. Rosa Auto Masters",
    category: "Mechanic",
    rating: 4.8,
    reviewCount: 210,
    distance: 6.5,
    location: { lat: 14.0690, lng: 121.4280 },
    address: "Sta. Rosa, Laguna",
    services: ["Full Engine Overhaul", "Aircon Repair", "Suspension Check", "Alignment"],
    priceRange: "₱₱₱",
    openNow: true,
    responseTime: "~40 min",
    image: "https://images.unsplash.com/photo-1619642737579-a7474bee1044?w=400",
    phone: "0922-678-9012",
  },
  {
    id: "shop-7",
    name: "Cabuyao Rapid Towing",
    category: "Towing",
    rating: 4.9,
    reviewCount: 145,
    distance: 7.2,
    location: { lat: 14.0580, lng: 121.4120 },
    address: "Cabuyao, Laguna",
    services: ["Flatbed Towing", "Heavy Duty Towing", "Accident Recovery", "Winch Out"],
    priceRange: "₱₱₱",
    openNow: true,
    responseTime: "~30 min",
    image: "https://images.unsplash.com/photo-1686966933735-305bd8fe0a77?w=400",
    phone: "0923-789-0123",
  },
  {
    id: "shop-8",
    name: "Biñan Tire Center",
    category: "Vulcanizing",
    rating: 4.6,
    reviewCount: 110,
    distance: 8.0,
    location: { lat: 14.0550, lng: 121.4300 },
    address: "Biñan, Laguna",
    services: ["Tire Sales", "Vulcanizing", "Nitrogen Inflation", "Mag Wheels Alignment"],
    priceRange: "₱₱",
    openNow: true,
    responseTime: "~25 min",
    image: "https://images.unsplash.com/photo-1661745805760-a27e3405b47b?w=400",
    phone: "0924-890-1234",
  }
];

export function MotoristDashboard() {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<[number, number]>([14.0676, 121.4174]); // Default: Calamba
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [filterCategory, setFilterCategory] = useState<"all" | "mechanic" | "vulcanizing" | "towing" | "electrical">("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  
  // Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedShopDetails, setSelectedShopDetails] = useState<typeof mockRepairShops[0] | null>(null);

  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        () => {
          // Silently fallback to default location
          setUserLocation([14.0676, 121.4174]);
        }
      );
    }
  };

  useEffect(() => {
    handleDetectLocation();
  }, []);

  const filteredShops = filterCategory === "all" 
    ? mockRepairShops 
    : mockRepairShops.filter(shop => shop.category.toLowerCase() === filterCategory);

  const handleRequestOnSpot = () => {
    navigate("/user/emergency");
  };

  const handleShopSelect = (shopId: string) => {
    setSelectedShop(shopId);
  };

  const handleOpenDetails = (shop: typeof mockRepairShops[0]) => {
    setSelectedShopDetails(shop);
    setDetailsModalOpen(true);
  };

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
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs sm:text-sm">Log Out</span>
          </button>
        </div>
      </header>

      {/* Quick Action Buttons */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRequestOnSpot}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-xl font-semibold transition-colors shadow-lg"
          >
            <AlertCircle className="w-5 h-5" />
            Request On-Spot Help (Emergency)
          </button>
          <div className="flex-1 flex items-center justify-center gap-2 bg-[#ff6b3d] text-white px-6 py-4 rounded-xl font-semibold shadow-lg opacity-70 cursor-default">
            <Store className="w-5 h-5" />
            Discover Nearby Shops
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">
        {/* Header Controls */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Nearby Repair Shops
            </h1>
            <p className="text-sm text-gray-400 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              Found {filteredShops.length} shops near you
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">Filter</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50">
                  <div className="p-2">
                    <button
                      onClick={() => { setFilterCategory("all"); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        filterCategory === "all" ? "bg-[#ff6b3d] text-white" : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      All Categories
                    </button>
                    <button
                      onClick={() => { setFilterCategory("mechanic"); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        filterCategory === "mechanic" ? "bg-[#ff6b3d] text-white" : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      Mechanic
                    </button>
                    <button
                      onClick={() => { setFilterCategory("vulcanizing"); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        filterCategory === "vulcanizing" ? "bg-[#ff6b3d] text-white" : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      Vulcanizing
                    </button>
                    <button
                      onClick={() => { setFilterCategory("towing"); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        filterCategory === "towing" ? "bg-[#ff6b3d] text-white" : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      Towing
                    </button>
                    <button
                      onClick={() => { setFilterCategory("electrical"); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        filterCategory === "electrical" ? "bg-[#ff6b3d] text-white" : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      Electrical
                    </button>
                  </div>
                </div>
              )}
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
        </div>

        {/* Content Area */}
        {viewMode === "map" ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="relative h-[500px]">
              <LocationMap
                center={userLocation}
                zoom={13}
                showUserLocation={true}
                userLocation={userLocation}
                markers={filteredShops.map(shop => ({
                  position: [shop.location.lat, shop.location.lng] as [number, number],
                  label: shop.name,
                  onClick: () => handleShopSelect(shop.id)
                }))}
                height="500px"
              />
            </div>

            {/* Shop Cards Overlay at Bottom */}
            <div className="p-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700">
              <div className="flex gap-4 overflow-x-auto pb-2">
                {filteredShops.map((shop) => (
                  <div
                    key={shop.id}
                    className={`flex-shrink-0 w-80 bg-gray-800 rounded-xl p-4 border-2 transition-all cursor-pointer ${
                      selectedShop === shop.id
                        ? "border-[#ff6b3d]"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                    onClick={() => handleShopSelect(shop.id)}
                  >
                    <div className="flex gap-3">
                      <img
                        src={shop.image}
                        alt={shop.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                         <h3 className="font-semibold text-white text-sm mb-1 truncate">
                          {shop.name}
                        </h3>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-xs text-gray-300">{shop.rating}</span>
                            <span className="text-xs text-gray-500">({shop.reviewCount})</span>
                          </div>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-400">{shop.distance} km</span>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          <Clock className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-400">{shop.responseTime}</span>
                          {shop.openNow && (
                            <>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-green-400">Open now</span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(shop);
                          }}
                          className="w-full py-1.5 bg-[#ff6b3d] hover:bg-[#ff5722] text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          <Info className="w-3 h-3" />
                          View Services & Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredShops.map((shop) => (
              <div
                key={shop.id}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all"
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  <img
                    src={shop.image}
                    alt={shop.name}
                    className="w-full sm:w-32 sm:h-32 h-48 rounded-xl object-cover"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{shop.name}</h3>
                        <p className="text-sm text-gray-400 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          {shop.address}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 mb-1 justify-end">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="font-semibold text-white">{shop.rating}</span>
                          <span className="text-xs text-gray-500">({shop.reviewCount})</span>
                        </div>
                        <p className="text-sm text-gray-400">{shop.distance} km away</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-lg">
                        {shop.category}
                      </span>
                      <span className="text-xs text-gray-400">{shop.priceRange}</span>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {shop.responseTime}
                      </div>
                      {shop.openNow && (
                        <span className="text-xs text-green-400 font-medium">• Open now</span>
                      )}
                    </div>

                    <div className="flex gap-3 mt-auto">
                      <button
                         onClick={() => handleOpenDetails(shop)}
                         className="flex-1 py-2.5 bg-[#ff6b3d] hover:bg-[#ff5722] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                         <Info className="w-4 h-4" />
                         View Services & Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Shop Details Modal */}
      {detailsModalOpen && selectedShopDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-0 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
             <div className="relative h-48 sm:h-64 flex-shrink-0">
               <img 
                 src={selectedShopDetails.image} 
                 alt={selectedShopDetails.name}
                 className="w-full h-full object-cover"
               />
               <button
                  onClick={() => setDetailsModalOpen(false)}
                  className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md"
                >
                  <XCircle className="w-6 h-6" />
                </button>
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-sm rounded-lg font-medium">
                    {selectedShopDetails.category}
                  </span>
                  {selectedShopDetails.openNow && (
                     <span className="px-3 py-1 bg-green-500/80 backdrop-blur-md text-white text-sm rounded-lg font-medium">
                      Open Now
                    </span>
                  )}
                </div>
             </div>

             <div className="p-6 overflow-y-auto flex-1">
               <div className="flex justify-between items-start mb-2">
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {selectedShopDetails.name}
                  </h2>
                  <div className="flex items-center gap-1 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold text-white">{selectedShopDetails.rating}</span>
                  </div>
               </div>

               <p className="text-gray-400 flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4" />
                  {selectedShopDetails.address} ({selectedShopDetails.distance} km)
               </p>

               <div className="mb-6">
                 <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                   <Wrench className="w-5 h-5 text-[#ff6b3d]" />
                   Services Offered
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {selectedShopDetails.services.map((service, idx) => (
                     <div key={idx} className="flex items-start gap-2 bg-gray-900 p-3 rounded-xl border border-gray-700">
                       <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                       <span className="text-sm text-gray-300">{service}</span>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="border-t border-gray-700 pt-6">
                 <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                   <Clock className="w-5 h-5 text-[#ff6b3d]" />
                   Details
                 </h3>
                 <div className="grid grid-cols-2 gap-4 text-sm">
                   <div className="bg-gray-900 p-3 rounded-xl border border-gray-700">
                      <p className="text-gray-500 mb-1">Est. Response Time</p>
                      <p className="text-white font-medium">{selectedShopDetails.responseTime}</p>
                   </div>
                   <div className="bg-gray-900 p-3 rounded-xl border border-gray-700">
                      <p className="text-gray-500 mb-1">Price Range</p>
                      <p className="text-white font-medium">{selectedShopDetails.priceRange}</p>
                   </div>
                 </div>
               </div>
             </div>

             <div className="p-6 bg-gray-900 border-t border-gray-700">
               <button 
                  className="w-full py-4 bg-[#ff6b3d] hover:bg-[#ff5722] text-white font-bold text-lg rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg"
                  onClick={() => alert(`Calling ${selectedShopDetails.name} at ${selectedShopDetails.phone}`)}
               >
                 <Phone className="w-5 h-5" />
                 Call Shop Now ({selectedShopDetails.phone})
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}