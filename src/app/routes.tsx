import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Home } from "./pages/Home";
import { UserLogin } from "./pages/user/UserLogin";
import { UserRegister } from "./pages/user/UserRegister";
import { MotoristDashboard } from "./pages/user/MotoristDashboard";
import { EmergencyReport } from "./pages/user/EmergencyReport";
import { SymptomTriage } from "./pages/user/SymptomTriage";
import { FindingAgent } from "./pages/user/FindingAgent";
import { LiveTracking } from "./pages/user/LiveTracking";
import { AgentLogin } from "./pages/agent/AgentLogin";
import { AgentRegister } from "./pages/agent/AgentRegister";
import { AgentDashboard } from "./pages/agent/AgentDashboard";
import { AgentNavigation } from "./pages/agent/AgentNavigation";
import { AdminLogin } from "./pages/admin/AdminLogin";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { SuperAdminDashboard } from "./pages/admin/SuperAdminDashboard";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      
      // User (Motorist) Routes
      { path: "user/login", Component: UserLogin },
      { path: "user/register", Component: UserRegister },
      { path: "user/dashboard", Component: MotoristDashboard },
      { path: "user/emergency", Component: EmergencyReport },
      { path: "user/triage", Component: SymptomTriage },
      { path: "user/finding-agent", Component: FindingAgent },
      { path: "user/tracking/:dispatchId", Component: LiveTracking },
      
      // Agent (Responder) Routes
      { path: "agent/login", Component: AgentLogin },
      { path: "agent/register", Component: AgentRegister },
      { path: "agent/dashboard", Component: AgentDashboard },
      { path: "agent/navigate/:dispatchId", Component: AgentNavigation },
      
      // Admin Routes
      { path: "admin/login", Component: AdminLogin },
      { path: "admin/dashboard", Component: AdminDashboard },
      { path: "admin/super", Component: SuperAdminDashboard },
      
      // 404
      { path: "*", Component: NotFound },
    ],
  },
]);