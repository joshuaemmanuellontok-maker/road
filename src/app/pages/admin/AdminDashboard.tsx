import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  ArrowLeft,
  CheckCircle,
  Eye,
  LogOut,
  Shield,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";

import {
  fetchAgentApplications,
  fetchUsers,
  updateAgentApplicationStatus,
  type AgentApplication,
  type UserSummary,
} from "../../api";

type AdminTab = "overview" | "agents";

export function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [agentApplications, setAgentApplications] = useState<AgentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const loadAdminData = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const [usersData, applicationsData] = await Promise.all([
          fetchUsers(),
          fetchAgentApplications(),
        ]);

        if (!active) {
          return;
        }

        setUsers(usersData);
        setAgentApplications(applicationsData);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load admin data.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadAdminData();

    return () => {
      active = false;
    };
  }, []);

  const pendingApplications = useMemo(
    () => agentApplications.filter((application) => application.status === "pending"),
    [agentApplications],
  );

  const approvedAgents = useMemo(
    () => users.filter((user) => user.role === "agent" && user.status === "active"),
    [users],
  );

  const motoristCount = useMemo(
    () => users.filter((user) => user.role === "motorist").length,
    [users],
  );

  const adminCount = useMemo(
    () => users.filter((user) => user.role === "admin").length,
    [users],
  );

  const handleApplicationAction = async (
    applicationId: string,
    status: "approved" | "rejected",
  ) => {
    setActionId(applicationId);
    setErrorMessage("");

    try {
      await updateAgentApplicationStatus(applicationId, status);

      setAgentApplications((current) =>
        current.map((application) =>
          application.id === applicationId
            ? { ...application, status }
            : application,
        ),
      );

      const refreshedUsers = await fetchUsers();
      setUsers(refreshedUsers);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update application.",
      );
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b3d]">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-gray-400">Connected to your local PostgreSQL data</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-right">
              <p className="text-xs text-gray-500">System Time</p>
              <p className="font-mono text-sm font-semibold">
                {currentTime.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-7xl gap-8 px-6">
          {[
            { id: "overview", label: "Overview" },
            { id: "agents", label: "Agent Management" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`border-b-2 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[#ff6b3d] text-[#ff6b3d]"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {activeTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-4">
              <StatCard
                icon={<Users className="h-6 w-6 text-blue-400" />}
                label="Total Users"
                value={String(users.length)}
                helper={`${motoristCount} motorists`}
              />
              <StatCard
                icon={<Wrench className="h-6 w-6 text-green-400" />}
                label="Active Agents"
                value={String(approvedAgents.length)}
                helper="Approved and active"
              />
              <StatCard
                icon={<Activity className="h-6 w-6 text-yellow-400" />}
                label="Pending Applications"
                value={String(pendingApplications.length)}
                helper="Waiting for review"
              />
              <StatCard
                icon={<Shield className="h-6 w-6 text-purple-400" />}
                label="Administrators"
                value={String(adminCount)}
                helper="Admin accounts"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-lg font-bold">Pending Agent Applications</h2>
                {loading ? (
                  <p className="text-sm text-gray-400">Loading applications...</p>
                ) : pendingApplications.length === 0 ? (
                  <p className="text-sm text-gray-400">No pending applications found.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingApplications.slice(0, 5).map((application) => (
                      <div
                        key={application.id}
                        className="rounded-xl border border-gray-800 bg-gray-950 p-4"
                      >
                        <p className="font-semibold text-white">
                          {application.fullName || "Unnamed applicant"}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          {application.serviceType || "Unspecified category"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {application.submittedAt ?? "Unknown submission date"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-lg font-bold">Active Agents</h2>
                {loading ? (
                  <p className="text-sm text-gray-400">Loading agents...</p>
                ) : approvedAgents.length === 0 ? (
                  <p className="text-sm text-gray-400">No active agents found.</p>
                ) : (
                  <div className="space-y-3">
                    {approvedAgents.slice(0, 5).map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950 p-4"
                      >
                        <div>
                          <p className="font-semibold text-white">{agent.fullName}</p>
                          <p className="mt-1 text-sm text-gray-400">{agent.phone || agent.email}</p>
                        </div>
                        <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
                          {agent.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Agent Accreditation Management</h2>
                <p className="text-sm text-gray-400">
                  Review applications from the live `agent_applications` table.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Loading applications...</p>
            ) : pendingApplications.length === 0 ? (
              <p className="text-sm text-gray-400">No pending applications found.</p>
            ) : (
              <div className="space-y-4">
                {pendingApplications.map((application) => (
                  <div
                    key={application.id}
                    className="rounded-2xl border border-gray-800 bg-gray-950 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">
                          {application.fullName || "Unnamed applicant"}
                        </h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {application.phone || "No phone on file"}
                        </p>
                      </div>
                      <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-300">
                        Pending Review
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Detail label="Category" value={application.serviceType || "Unknown"} />
                      <Detail label="Service Area" value={application.serviceArea || "Not provided"} />
                      <Detail
                        label="Submitted"
                        value={application.submittedAt ?? "Unknown"}
                      />
                      <Detail label="Application ID" value={application.id} />
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Credentials
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {credentialBadges(application).map((label) => (
                          <span
                            key={label}
                            className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-gray-300"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => void handleApplicationAction(application.id, "approved")}
                        disabled={actionId === application.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {actionId === application.id ? "Processing..." : "Approve"}
                      </button>
                      <button
                        onClick={() => void handleApplicationAction(application.id, "rejected")}
                        disabled={actionId === application.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                  Active Agent Accounts
                </h3>
              </div>

              {approvedAgents.length === 0 ? (
                <p className="text-sm text-gray-400">No approved agents found.</p>
              ) : (
                <div className="space-y-3">
                  {approvedAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4"
                    >
                      <div>
                        <p className="font-semibold text-white">{agent.fullName}</p>
                        <p className="mt-1 text-sm text-gray-400">
                          {agent.phone || agent.email}
                        </p>
                      </div>
                      <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
                        {agent.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard(props: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
          {props.icon}
        </div>
        <div>
          <p className="text-sm text-gray-400">{props.label}</p>
          <p className="text-2xl font-bold text-white">{props.value}</p>
          <p className="text-xs text-gray-500">{props.helper}</p>
        </div>
      </div>
    </div>
  );
}

function Detail(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{props.label}</p>
      <p className="mt-2 text-sm font-medium text-white">{props.value}</p>
    </div>
  );
}

function credentialBadges(application: AgentApplication) {
  const credentialsValue = application.remarks?.credentials;
  const credentials =
    typeof credentialsValue === "object" && credentialsValue !== null
      ? (credentialsValue as Record<string, unknown>)
      : {};

  const labels = Object.entries(credentials)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${String(value)}`);

  return labels.length > 0 ? labels : ["No credential references saved"];
}
