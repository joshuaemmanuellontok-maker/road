import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Wrench, MapPin, Clock, AlertCircle, CheckCircle, LogOut, Bell, ToggleLeft, ToggleRight, TrendingUp, DollarSign, Star, Navigation, Phone, Shield, Award, Activity, Calendar, XCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Mock dispatch requests
const mockRequests = [
  {
    id: "req-001",
    motorist: "Maria Santos",
    phone: "+63 917 123 4567",
    location: "San Pablo City, National Highway",
    distance: "1.2 km",
    symptoms: ["Flat Tire"],
    priority: "high" as const,
    estimatedFee: "₱350",
    timestamp: "2 minutes ago",
    vehicleType: "Sedan",
  },
  {
    id: "req-002",
    motorist: "Jose Garcia",
    phone: "+63 918 765 4321",
    location: "Bay, Laguna - Crossing Road",
    distance: "3.5 km",
    symptoms: ["Dead Battery", "Engine Won't Start"],
    priority: "medium" as const,
    estimatedFee: "₱500",
    timestamp: "5 minutes ago",
    vehicleType: "SUV",
  },
];

const weeklyEarnings = [
  { day: "Mon", amount: 850 },
  { day: "Tue", amount: 1200 },
  { day: "Wed", amount: 950 },
  { day: "Thu", amount: 1450 },
  { day: "Fri", amount: 1650 },
  { day: "Sat", amount: 1850 },
  { day: "Sun", amount: 1300 },
];

const recentJobs = [
  { id: 1, motorist: "Ana Reyes", service: "Flat tire repair", time: "1 hour ago", fee: "₱350", rating: 5 },
  { id: 2, motorist: "Carlos Mendoza", service: "Battery replacement", time: "3 hours ago", fee: "₱800", rating: 5 },
  { id: 3, motorist: "Linda Cruz", service: "Tire vulcanizing", time: "5 hours ago", fee: "₱250", rating: 4 },
];

export function AgentDashboard() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(true);
  const [requests, setRequests] = useState(mockRequests);
  const [activeRequest, setActiveRequest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"requests" | "earnings" | "history">("requests");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats] = useState({
    todayJobs: 3,
    weeklyJobs: 18,
    monthlyJobs: 89,
    rating: 4.8,
    todayEarnings: "₱5,250",
    weeklyEarnings: "₱12,400",
    responseTime: "4.2 min",
    completionRate: "98%",
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAcceptRequest = (requestId: string) => {
    setActiveRequest(requestId);
    navigate(`/agent/navigate/${requestId}`);
  };

  const handleRejectRequest = (requestId: string) => {
    setRequests(requests.filter((r) => r.id !== requestId));
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#ff6b3d] rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-white">Agent Hub</span>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{currentTime.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              isOnline
                ? "bg-[#ff6b3d]/20 border-[#ff6b3d]"
                : "bg-gray-800 border-gray-700"
            }`}>
              <Activity className={`w-4 h-4 ${isOnline ? "text-[#ff6b3d] animate-pulse" : "text-gray-500"}`} />
              <span className={`text-sm font-medium ${isOnline ? "text-[#ff6b3d]" : "text-gray-500"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            <button
              className="relative p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-300 hover:text-white"
              aria-label="View notifications"
              type="button"
            >
              <Bell className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#ff6b3d]" />
              </div>
              <button
                onClick={() => navigate("/")}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-300 hover:text-white"
                aria-label="Logout"
                type="button"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
        {/* Availability Toggle */}
        <div className={`rounded-2xl p-6 shadow-sm border-2 mb-6 transition-all ${
          isOnline
            ? "bg-gray-800/80 border-[#ff6b3d]"
            : "bg-gray-800 border-gray-700"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isOnline ? "bg-[#ff6b3d]" : "bg-gray-600"
              }`}>
                <Activity className={`w-8 h-8 text-white ${isOnline ? "animate-pulse" : ""}`} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {isOnline ? "You're Online & Ready" : "You're Offline"}
                </h3>
                <p className="text-sm text-gray-400">
                  {isOnline ? "Accepting dispatch requests from nearby motorists" : "Won't receive new requests until you go online"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`relative w-20 h-10 rounded-full transition-all shadow-lg ${
                isOnline ? "bg-[#ff6b3d]" : "bg-gray-600"
              }`}
            >
              <motion.div
                layout
                className="absolute top-1 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center"
                animate={{ left: isOnline ? "calc(100% - 36px)" : "4px" }}
              >
                {isOnline ? (
                  <CheckCircle className="w-5 h-5 text-[#ff6b3d]" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                )}
              </motion.div>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#ff6b3d]" />
              </div>
              <TrendingUp className="w-5 h-5 text-[#ff6b3d]" />
            </div>
            <p className="text-sm text-gray-400 mb-1">Today's Jobs</p>
            <p className="text-3xl font-bold text-white">{stats.todayJobs}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.weeklyJobs} this week</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#ff6b3d]" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Today's Earnings</p>
            <p className="text-3xl font-bold text-[#ff6b3d]">{stats.todayEarnings}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.weeklyEarnings} this week</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Rating</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-white">{stats.rating}</p>
              <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Based on {stats.monthlyJobs} jobs</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Avg Response</p>
            <p className="text-3xl font-bold text-white">{stats.responseTime}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.completionRate} completion</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 mb-6">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex-1 py-4 px-6 font-semibold transition-colors relative ${
                activeTab === "requests"
                  ? "text-[#ff6b3d]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Incoming Requests
              {requests.length > 0 && (
                <span className="absolute top-3 right-3 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {requests.length}
                </span>
              )}
              {activeTab === "requests" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff6b3d]"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("earnings")}
              className={`flex-1 py-4 px-6 font-semibold transition-colors relative ${
                activeTab === "earnings"
                  ? "text-[#ff6b3d]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Earnings & Analytics
              {activeTab === "earnings" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff6b3d]"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-4 px-6 font-semibold transition-colors relative ${
                activeTab === "history"
                  ? "text-[#ff6b3d]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Job History
              {activeTab === "history" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff6b3d]"
                />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "requests" && (
          <div>
            {!isOnline ? (
              <div className="bg-gray-800 rounded-2xl p-16 text-center border-2 border-dashed border-gray-600">
                <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-xl font-bold text-white mb-2">
                  You're Currently Offline
                </p>
                <p className="text-gray-400 mb-6">
                  Turn on your availability to start receiving rescue requests
                </p>
                <button
                  onClick={() => setIsOnline(true)}
                  className="px-6 py-3 bg-[#ff6b3d] text-white rounded-xl font-semibold hover:bg-[#ff5722] transition-colors"
                >
                  Go Online Now
                </button>
              </div>
            ) : requests.length === 0 ? (
              <div className="bg-gray-800 rounded-2xl p-16 text-center border border-gray-700">
                <Clock className="w-16 h-16 text-[#ff6b3d] mx-auto mb-4" />
                <p className="text-xl font-bold text-white mb-2">
                  No Active Requests
                </p>
                <p className="text-gray-400">
                  You'll be notified when motorists need assistance nearby
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {requests.map((request) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className={`bg-gray-800 rounded-2xl p-6 shadow-lg border-2 ${
                        request.priority === "high"
                          ? "border-red-500/50 bg-red-900/20"
                          : "border-gray-700"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-gray-700 border border-gray-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {request.motorist.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-white">
                                  {request.motorist}
                                </h3>
                                {request.priority === "high" && (
                                  <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/50 text-xs font-bold rounded-full animate-pulse">
                                    URGENT
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                <span>{request.vehicleType}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {request.timestamp}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-900/50 rounded-xl p-4 mb-3 border border-gray-700">
                            <div className="flex items-start gap-2 mb-3">
                              <MapPin className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-semibold text-white mb-1">{request.location}</p>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="px-2 py-1 bg-[#ff6b3d]/20 text-[#ff6b3d] rounded-full font-semibold">
                                    {request.distance} away
                                  </span>
                                  <span className="text-gray-400">~6 min drive</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mb-4">
                            <p className="text-sm font-semibold text-gray-300 mb-2">Reported Symptoms:</p>
                            <div className="flex flex-wrap gap-2">
                              {request.symptoms.map((symptom) => (
                                <span
                                  key={symptom}
                                  className="px-3 py-1.5 bg-gray-700 text-gray-200 border border-gray-600 text-sm font-medium rounded-lg"
                                >
                                  {symptom}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-700">
                            <div>
                              <p className="text-sm text-gray-400 mb-1">Estimated Service Fee</p>
                              <p className="text-2xl font-bold text-[#ff6b3d]">{request.estimatedFee}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                className="p-3 bg-gray-800 border-2 border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
                                aria-label={`Call ${request.motorist}`}
                              >
                                <Phone className="w-5 h-5 text-gray-300" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="py-3.5 border-2 border-gray-700 text-gray-300 rounded-xl font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-5 h-5" />
                          Decline
                        </button>
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          className="py-3.5 bg-[#ff6b3d] text-white rounded-xl font-semibold hover:bg-[#ff5722] transition-colors flex items-center justify-center gap-2"
                        >
                          <Navigation className="w-5 h-5" />
                          Accept & Navigate
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {activeTab === "earnings" && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Weekly Earnings Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={weeklyEarnings}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    formatter={(value) => `₱${value}`} 
                    contentStyle={{ backgroundColor: "#1f2937", borderColor: "#374151", color: "#fff" }} 
                  />
                  <Area type="monotone" dataKey="amount" stroke="#ff6b3d" fill="#ff6b3d" fillOpacity={0.3} name="Earnings" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white">Total This Week</h4>
                  <DollarSign className="w-5 h-5 text-[#ff6b3d]" />
                </div>
                <p className="text-3xl font-bold text-[#ff6b3d]">{stats.weeklyEarnings}</p>
                <p className="text-sm text-gray-400 mt-2">From {stats.weeklyJobs} completed jobs</p>
              </div>
              <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white">Avg per Job</h4>
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-3xl font-bold text-white">₱688</p>
                <p className="text-sm text-[#ff6b3d] mt-2">↑ 12% from last week</p>
              </div>
              <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white">This Month</h4>
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-3xl font-bold text-white">₱45,200</p>
                <p className="text-sm text-gray-400 mt-2">Projected: ₱62,500</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff6b3d]/10 rounded-full blur-2xl"></div>
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-gray-300 mb-1">Performance Bonus Available</p>
                  <p className="text-3xl font-bold mb-2 text-[#ff6b3d]">₱1,250</p>
                  <p className="text-sm text-gray-400">Complete 2 more jobs this week to unlock!</p>
                </div>
                <Award className="w-12 h-12 text-[#ff6b3d]/80" />
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {recentJobs.map((job) => (
              <div key={job.id} className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-[#ff6b3d]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-white">{job.service}</h4>
                        <span className="px-2 py-1 bg-[#ff6b3d]/20 text-[#ff6b3d] text-xs font-semibold rounded-full border border-[#ff6b3d]/30">
                          COMPLETED
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">Motorist: {job.motorist}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {job.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                          {job.rating}/5
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#ff6b3d]">{job.fee}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}