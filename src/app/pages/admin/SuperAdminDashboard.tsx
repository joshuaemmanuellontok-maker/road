import { useState } from "react";
import { useNavigate } from "react-router";
import { Shield, LogOut, Workflow, BarChart3, Database, Users, Settings, TrendingUp, ArrowLeft } from "lucide-react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Mock SUS Survey Data
const susDetailedData = [
  { question: "Frequent Use", score: 4.7, responses: 156 },
  { question: "Not Complex", score: 4.6, responses: 156 },
  { question: "Easy to Use", score: 4.5, responses: 156 },
  { question: "No Support Needed", score: 4.8, responses: 156 },
  { question: "Well Integrated", score: 4.9, responses: 156 },
];

const processFlowData = [
  { stage: "Emergency Report", avgTime: 45, completionRate: 98 },
  { stage: "Symptom Triage", avgTime: 60, completionRate: 96 },
  { stage: "Agent Matching", avgTime: 15, completionRate: 94 },
  { stage: "Dispatch Accept", avgTime: 30, completionRate: 92 },
  { stage: "En Route", avgTime: 420, completionRate: 98 },
  { stage: "Service Complete", avgTime: 900, completionRate: 95 },
];

const userTypeDistribution = [
  { type: "Motorists", active: 1243, registered: 1580 },
  { type: "Agents", active: 47, registered: 52 },
  { type: "Admins", active: 3, registered: 3 },
];

const slaPerformance = [
  { week: "Week 1", onTime: 92, breached: 8 },
  { week: "Week 2", onTime: 95, breached: 5 },
  { week: "Week 3", onTime: 89, breached: 11 },
  { week: "Week 4", onTime: 97, breached: 3 },
];

const radarData = [
  { metric: "Ease of Use", userScore: 4.6, agentScore: 4.4 },
  { metric: "Usefulness", userScore: 4.8, agentScore: 4.7 },
  { metric: "Reliability", userScore: 4.5, agentScore: 4.6 },
  { metric: "Speed", userScore: 4.7, agentScore: 4.5 },
  { metric: "Satisfaction", userScore: 4.6, agentScore: 4.5 },
];

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "process" | "sus" | "system">("overview");

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back to admin dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="p-2 bg-yellow-400 rounded-lg">
              <Shield className="w-8 h-8 text-purple-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Super Administrator</h1>
              <p className="text-sm text-purple-200">System-Level Analytics & Process Monitoring</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">Exit Super Admin</span>
          </button>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === "overview"
                  ? "border-yellow-400 text-yellow-400"
                  : "border-transparent text-white/70 hover:text-white"
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("process")}
              className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === "process"
                  ? "border-yellow-400 text-yellow-400"
                  : "border-transparent text-white/70 hover:text-white"
              }`}
            >
              <Workflow className="w-5 h-5" />
              Process Flow
            </button>
            <button
              onClick={() => setActiveTab("sus")}
              className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === "sus"
                  ? "border-yellow-400 text-yellow-400"
                  : "border-transparent text-white/70 hover:text-white"
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              SUS Analytics
            </button>
            <button
              onClick={() => setActiveTab("system")}
              className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === "system"
                  ? "border-yellow-400 text-yellow-400"
                  : "border-transparent text-white/70 hover:text-white"
              }`}
            >
              <Database className="w-5 h-5" />
              System Health
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-6 py-8 max-w-7xl mx-auto">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-6 h-6 text-yellow-400" />
                  <p className="text-purple-200 text-sm">Total Users</p>
                </div>
                <p className="text-4xl font-bold text-white">1,635</p>
                <p className="text-sm text-green-400 mt-1">↑ 12% this month</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="w-6 h-6 text-blue-400" />
                  <p className="text-purple-200 text-sm">Total Dispatches</p>
                </div>
                <p className="text-4xl font-bold text-white">2,847</p>
                <p className="text-sm text-green-400 mt-1">↑ 23% this month</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                  <p className="text-purple-200 text-sm">Success Rate</p>
                </div>
                <p className="text-4xl font-bold text-white">94.2%</p>
                <p className="text-sm text-green-400 mt-1">↑ 2.1% improvement</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-6 h-6 text-purple-400" />
                  <p className="text-purple-200 text-sm">Avg SUS Score</p>
                </div>
                <p className="text-4xl font-bold text-white">4.7/5</p>
                <p className="text-sm text-green-400 mt-1">High usability</p>
              </div>
            </div>

            {/* User Distribution */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">User Type Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userTypeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="type" stroke="#ffffff80" />
                  <YAxis stroke="#ffffff80" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e1b4b", border: "1px solid #ffffff20", borderRadius: "8px" }}
                    labelStyle={{ color: "#ffffff" }}
                  />
                  <Legend />
                  <Bar dataKey="registered" fill="#818cf8" name="Registered" />
                  <Bar dataKey="active" fill="#34d399" name="Active" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* SLA Performance */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">SLA Performance Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={slaPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="week" stroke="#ffffff80" />
                  <YAxis stroke="#ffffff80" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e1b4b", border: "1px solid #ffffff20", borderRadius: "8px" }}
                    labelStyle={{ color: "#ffffff" }}
                  />
                  <Legend />
                  <Area key="onTime" type="monotone" dataKey="onTime" stackId="1" stroke="#10b981" fill="#10b981" name="On Time %" />
                  <Area key="breached" type="monotone" dataKey="breached" stackId="1" stroke="#ef4444" fill="#ef4444" name="Breached %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "process" && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-2">End-to-End Process Flow Analysis</h2>
              <p className="text-purple-200 mb-6">Average time and completion rate per stage</p>
              
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={processFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="stage" stroke="#ffffff80" angle={-45} textAnchor="end" height={100} />
                  <YAxis yAxisId="left" stroke="#ffffff80" label={{ value: 'Avg Time (sec)', angle: -90, position: 'insideLeft', fill: '#ffffff80' }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#ffffff80" label={{ value: 'Completion %', angle: 90, position: 'insideRight', fill: '#ffffff80' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e1b4b", border: "1px solid #ffffff20", borderRadius: "8px" }}
                    labelStyle={{ color: "#ffffff" }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="avgTime" fill="#fbbf24" name="Avg Time (sec)" />
                  <Bar yAxisId="right" dataKey="completionRate" fill="#34d399" name="Completion Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Process Stages Detail */}
            <div className="grid md:grid-cols-2 gap-6">
              {processFlowData.map((stage, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">{stage.stage}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      stage.completionRate >= 95 ? "bg-green-500 text-white" :
                      stage.completionRate >= 90 ? "bg-yellow-500 text-white" :
                      "bg-red-500 text-white"
                    }`}>
                      {stage.completionRate}% Complete
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-purple-200">Average Time</p>
                      <p className="text-2xl font-bold text-white">
                        {stage.avgTime >= 60 ? `${Math.floor(stage.avgTime / 60)}m ${stage.avgTime % 60}s` : `${stage.avgTime}s`}
                      </p>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-green-400"
                        style={{ width: `${stage.completionRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "sus" && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-2">System Usability Scale (SUS) Detailed Analytics</h2>
              <p className="text-purple-200 mb-6">Based on 156 motorist and agent survey responses</p>
              
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={susDetailedData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis type="number" domain={[0, 5]} stroke="#ffffff80" />
                  <YAxis dataKey="question" type="category" width={150} stroke="#ffffff80" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e1b4b", border: "1px solid #ffffff20", borderRadius: "8px" }}
                    labelStyle={{ color: "#ffffff" }}
                  />
                  <Bar dataKey="score" fill="#818cf8" name="Average Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar Chart Comparison */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">User vs Agent SUS Comparison</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#ffffff20" />
                  <PolarAngleAxis dataKey="metric" stroke="#ffffff80" />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} stroke="#ffffff80" />
                  <Radar name="Motorist Score" dataKey="userScore" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  <Radar name="Agent Score" dataKey="agentScore" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                  <Legend />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e1b4b", border: "1px solid #ffffff20", borderRadius: "8px" }}
                    labelStyle={{ color: "#ffffff" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* SUS Metrics Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
                <p className="text-sm opacity-90 mb-1">Easy to Learn</p>
                <p className="text-4xl font-bold mb-2">4.6/5.0</p>
                <p className="text-sm opacity-75">92% positive feedback</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
                <p className="text-sm opacity-90 mb-1">Frequent Use</p>
                <p className="text-4xl font-bold mb-2">4.8/5.0</p>
                <p className="text-sm opacity-75">96% positive feedback</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
                <p className="text-sm opacity-90 mb-1">Overall Satisfaction</p>
                <p className="text-4xl font-bold mb-2">4.7/5.0</p>
                <p className="text-sm opacity-75">94% positive feedback</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "system" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <Database className="w-8 h-8 text-blue-400" />
                  <h3 className="text-lg font-bold text-white">Database</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">Status</span>
                    <span className="text-green-400 font-semibold">● Online</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">Records</span>
                    <span className="text-white font-semibold">4,482</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">Queries/min</span>
                    <span className="text-white font-semibold">127</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <Settings className="w-8 h-8 text-yellow-400" />
                  <h3 className="text-lg font-bold text-white">API Services</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">Status</span>
                    <span className="text-green-400 font-semibold">● Operational</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">Uptime</span>
                    <span className="text-white font-semibold">99.97%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">Avg Response</span>
                    <span className="text-white font-semibold">45ms</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-8 h-8 text-green-400" />
                  <h3 className="text-lg font-bold text-white">Security</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">SSL/TLS</span>
                    <span className="text-green-400 font-semibold">✓ Enabled</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">Auth System</span>
                    <span className="text-green-400 font-semibold">✓ Active</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">Firewall</span>
                    <span className="text-green-400 font-semibold">✓ Protected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System Logs */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Recent System Activity</h3>
              <div className="space-y-2 font-mono text-sm">
                <div className="p-3 bg-black/30 rounded-lg">
                  <span className="text-green-400">[2026-03-08 14:23:15]</span>
                  <span className="text-purple-200 ml-2">Dispatch DISP-847 completed successfully</span>
                </div>
                <div className="p-3 bg-black/30 rounded-lg">
                  <span className="text-blue-400">[2026-03-08 14:22:48]</span>
                  <span className="text-purple-200 ml-2">New agent registration: Bay Vulcanizing Shop</span>
                </div>
                <div className="p-3 bg-black/30 rounded-lg">
                  <span className="text-yellow-400">[2026-03-08 14:21:33]</span>
                  <span className="text-purple-200 ml-2">SUS Survey submitted by user #1243</span>
                </div>
                <div className="p-3 bg-black/30 rounded-lg">
                  <span className="text-green-400">[2026-03-08 14:20:12]</span>
                  <span className="text-purple-200 ml-2">Proximity match completed in 127ms</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}