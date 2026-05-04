import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CheckCircle,
  Eye,
  LogOut,
  Shield,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchAgentApplications,
  fetchAdminEarnings,
  fetchCommunityRedemptions,
  fetchRepairShops,
  fetchSubscriptionPayments,
  fetchAgentBalanceProofs,
  fetchUsers,
  resolveAssetUrl,
  createRepairShop,
  deleteManagedUser,
  deleteRepairShop,
  updateAgentBalanceProofStatus,
  updateCommunityRedemptionStatus,
  updateAgentApplicationStatus,
  updateRepairShop,
  updateSubscriptionPaymentStatus,
  updateUserSubscriptionStatus,
  getAdminSession,
  clearAdminSession,
  type AgentApplication,
  type AgentBalanceProofReview,
  type AdminEarningsSummary,
  type CommunityRedemption,
  type CredentialAsset,
  type RepairShop,
  type RepairShopInput,
  type SubscriptionPayment,
  type UserSummary,
} from "../../api";

type AdminTab = "overview" | "analytics" | "agents" | "motorists" | "repairshops" | "community";
type SubscriptionPlan = "monthly" | "six_months" | "annual";
type RepairShopCategory = RepairShop["category"];

const chartPalette = ["#ff6b3d", "#38bdf8", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];

const subscriptionPlanOptions: Array<{ value: SubscriptionPlan; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "six_months", label: "6 Months" },
  { value: "annual", label: "Annual" },
];

const repairShopCategoryOptions: Array<{ value: RepairShopCategory; label: string }> = [
  { value: "mechanical", label: "Mechanical" },
  { value: "vulcanizing", label: "Vulcanizing" },
  { value: "towing", label: "Towing" },
  { value: "electrical", label: "Electrical" },
];

const repairShopServiceOptions = [
  "Mechanical",
  "Vulcanizing",
  "Towing",
  "Electrical",
  "Battery service",
  "Fuel delivery",
  "Lockout help",
  "General roadside assistance",
];

const coreRepairShopServices = repairShopCategoryOptions.map((option) => option.label);

const defaultRepairShopForm: RepairShopInput = {
  name: "",
  ownerName: "",
  category: "mechanical",
  rating: 4.5,
  distanceKm: 0,
  address: "",
  responseTime: "~15 min",
  openNow: true,
  phone: "",
  email: "",
  status: "active",
  latitude: 14.4211,
  longitude: 121.4461,
  services: ["General roadside assistance"],
};

function formatSubscriptionPlan(plan: UserSummary["subscriptionPlan"]) {
  if (plan === "six_months") return "6 Months";
  if (plan === "annual") return "Annual";
  if (plan === "monthly") return "Monthly";
  return "No plan";
}

function formatPeso(value: number) {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [agentApplications, setAgentApplications] = useState<AgentApplication[]>([]);
  const [agentBalanceProofs, setAgentBalanceProofs] = useState<AgentBalanceProofReview[]>([]);
  const [adminEarnings, setAdminEarnings] = useState<AdminEarningsSummary | null>(null);
  const [repairShops, setRepairShops] = useState<RepairShop[]>([]);
  const [editingRepairShopId, setEditingRepairShopId] = useState<string | null>(null);
  const [repairShopForm, setRepairShopForm] = useState<RepairShopInput>(defaultRepairShopForm);
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPayment[]>([]);
  const [communityRedemptions, setCommunityRedemptions] = useState<CommunityRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [communityWarning, setCommunityWarning] = useState("");
  const [motoristPlanDrafts, setMotoristPlanDrafts] = useState<Record<string, SubscriptionPlan>>({});

  // Check admin session on mount
  useEffect(() => {
    const session = getAdminSession();
    if (!session || session.role !== "admin") {
      clearAdminSession();
      navigate("/admin/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    clearAdminSession();
    navigate("/admin/login");
  };

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const loadAdminData = async () => {
      const session = getAdminSession();
      if (!session || session.role !== "admin") {
        clearAdminSession();
        navigate("/admin/login");
        return;
      }

      setLoading((current) => current || users.length === 0 || agentApplications.length === 0);
      setErrorMessage("");
      setCommunityWarning("");

      try {
        const [usersData, applicationsData, paymentsData, balanceProofsData, earningsData, repairShopsData] = await Promise.all([
          fetchUsers(),
          fetchAgentApplications(),
          fetchSubscriptionPayments(),
          fetchAgentBalanceProofs(),
          fetchAdminEarnings(),
          fetchRepairShops(),
        ]);

        if (!active) {
          return;
        }

        setUsers(usersData);
        setAgentApplications(applicationsData);
        setSubscriptionPayments(paymentsData);
        setAgentBalanceProofs(balanceProofsData);
        setAdminEarnings(earningsData);
        setRepairShops(repairShopsData);

        try {
          const communityRedemptionsData = await fetchCommunityRedemptions();
          if (active) {
            setCommunityRedemptions(communityRedemptionsData);
          }
        } catch (error) {
          if (active) {
            setCommunityRedemptions([]);
            setCommunityWarning(
              error instanceof Error
                ? `Community data is temporarily unavailable: ${error.message}`
                : "Community data is temporarily unavailable.",
            );
          }
        }
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

    const refreshTimer = window.setInterval(() => {
      void loadAdminData();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [navigate, users.length, agentApplications.length]);

  const pendingApplications = useMemo(
    () => agentApplications.filter((application) => application.status === "pending"),
    [agentApplications],
  );
  const pendingBalanceProofs = useMemo(
    () => agentBalanceProofs.filter((proof) => proof.status === "pending"),
    [agentBalanceProofs],
  );

  const approvedAgents = useMemo(
    () => users.filter((user) => user.role === "agent" && user.status === "active"),
    [users],
  );

  const allAgents = useMemo(
    () => users.filter((user) => user.role === "agent"),
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

  const communityUsers = useMemo(
    () => users.filter((user) => user.role === "community"),
    [users],
  );

  const motorists = useMemo(
    () => users.filter((user) => user.role === "motorist"),
    [users],
  );

  const inactiveMotorists = useMemo(
    () => motorists.filter((user) => user.subscriptionStatus !== "active").length,
    [motorists],
  );

  const pendingAgents = useMemo(
    () => allAgents.filter((user) => user.status === "pending").length,
    [allAgents],
  );

  const rejectedAgents = useMemo(
    () => allAgents.filter((user) => user.status === "rejected").length,
    [allAgents],
  );

  const totalManagedUsers = useMemo(
    () => motorists.length + allAgents.length + communityUsers.length,
    [motorists.length, allAgents.length, communityUsers.length],
  );

  const subscribedMotorists = useMemo(
    () => motorists.filter((user) => user.subscriptionStatus === "active").length,
    [motorists],
  );

  const pendingSubscriptionPayments = useMemo(
    () => subscriptionPayments.filter((payment) => payment.status === "pending"),
    [subscriptionPayments],
  );

  const monthlySubscriptionStats = useMemo(
    () => adminEarnings?.monthlySubscriptionStats ?? [],
    [adminEarnings?.monthlySubscriptionStats],
  );

  const unsubscribedMotoristRows = useMemo(
    () => adminEarnings?.unsubscribedMotorists ?? [],
    [adminEarnings?.unsubscribedMotorists],
  );

  const pendingCommunityRedemptions = useMemo(
    () => communityRedemptions.filter((item) => item.status === "pending"),
    [communityRedemptions],
  );

  const respondersWithPayoutDetails = useMemo(
    () => agentBalanceProofs.filter((proof) => proof.gcashName || proof.gcashNumber),
    [agentBalanceProofs],
  );

  const activeRepairShops = useMemo(
    () => repairShops.filter((shop) => shop.status === "active"),
    [repairShops],
  );

  const userRoleChartData = useMemo(
    () => [
      { name: "Motorists", value: motorists.length },
      { name: "Responders", value: allAgents.length },
      { name: "Community", value: communityUsers.length },
    ].filter((item) => item.value > 0),
    [motorists.length, allAgents.length, communityUsers.length],
  );

  const motoristSubscriptionChartData = useMemo(
    () => [
      { name: "Active", value: subscribedMotorists },
      { name: "Inactive", value: inactiveMotorists },
    ],
    [subscribedMotorists, inactiveMotorists],
  );

  const agentStatusChartData = useMemo(
    () => [
      { name: "Approved", value: approvedAgents.length },
      { name: "Pending", value: pendingAgents },
      { name: "Rejected", value: rejectedAgents },
    ],
    [approvedAgents.length, pendingAgents, rejectedAgents],
  );

  const subscriptionPlanChartData = useMemo(
    () => {
      const planCounts = motorists.reduce(
        (acc, user) => {
          const plan = user.subscriptionPlan;
          if (plan === "monthly") acc.monthly += 1;
          if (plan === "six_months") acc.sixMonths += 1;
          if (plan === "annual") acc.annual += 1;
          return acc;
        },
        { monthly: 0, sixMonths: 0, annual: 0 },
      );

      return [
        { name: "Monthly", value: planCounts.monthly },
        { name: "6 Months", value: planCounts.sixMonths },
        { name: "Annual", value: planCounts.annual },
      ];
    },
    [motorists],
  );

  const registrationTrendData = useMemo(() => {
    const allRegistrations = users
      .filter((user) => user.role !== "admin" && user.createdAt)
      .map((user) => ({
        date: user.createdAt as string,
        role: user.role,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const lastDates = Array.from(new Set(allRegistrations.map((item) => item.date))).slice(-7);

    return lastDates.map((date) => ({
      date,
      motorists: allRegistrations.filter((item) => item.date === date && item.role === "motorist").length,
      agents: allRegistrations.filter((item) => item.date === date && item.role === "agent").length,
      community: allRegistrations.filter((item) => item.date === date && item.role === "community").length,
    }));
  }, [users]);

  const analyticsHighlights = useMemo(
    () => [
      {
        label: "Motorist conversion",
        value: motoristCount === 0 ? "0%" : `${Math.round((subscribedMotorists / motoristCount) * 100)}%`,
        helper: "Motorists with active subscriptions",
      },
      {
        label: "Responder approval rate",
        value: allAgents.length === 0 ? "0%" : `${Math.round((approvedAgents.length / allAgents.length) * 100)}%`,
        helper: "Approved responders out of all registered responders",
      },
      {
        label: "Community payout queue",
        value: String(pendingCommunityRedemptions.length),
        helper: "Reward center tickets queued for payout processing",
      },
      {
        label: "Pending subscription checks",
        value: String(pendingSubscriptionPayments.length),
        helper: "Motorist payments waiting for admin confirmation",
      },
      {
        label: "Admin earnings",
        value: formatPeso(adminEarnings?.totalRevenue ?? 0),
        helper: "Confirmed subscriptions plus service commissions",
      },
    ],
    [
      motoristCount,
      subscribedMotorists,
      allAgents.length,
      approvedAgents.length,
      pendingCommunityRedemptions.length,
      pendingSubscriptionPayments.length,
      adminEarnings?.totalRevenue,
    ],
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

  const handleAgentBalanceProofAction = async (
    agentId: string,
    status: "approved" | "rejected",
    readinessTier?: "tier_1" | "tier_2",
  ) => {
    const session = getAdminSession();
    setActionId(`proof-${agentId}`);
    setErrorMessage("");

    try {
      const result = await updateAgentBalanceProofStatus(
        agentId,
        status,
        session?.username ?? "Admin",
        readinessTier,
        status === "rejected" ? "Invalid payout readiness document." : "",
      );

      setAgentBalanceProofs((current) =>
        current.map((proof) => (proof.userId === agentId ? result : proof)),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to review payout readiness.",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleMotoristSubscriptionAction = async (
    userId: string,
    subscriptionStatus: "active" | "inactive",
    subscriptionPlan?: SubscriptionPlan,
  ) => {
    setActionId(userId);
    setErrorMessage("");

    try {
      const result = await updateUserSubscriptionStatus(userId, subscriptionStatus, subscriptionPlan);
      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                subscriptionStatus: result.subscriptionStatus,
                subscriptionPlan: result.subscriptionPlan,
                subscriptionActivatedAt: result.subscriptionActivatedAt,
                subscriptionExpiresAt: result.subscriptionExpiresAt,
              }
            : user,
        ),
      );

      const [refreshedPayments, refreshedEarnings] = await Promise.all([
        fetchSubscriptionPayments(),
        fetchAdminEarnings(),
      ]);
      setSubscriptionPayments(refreshedPayments);
      setAdminEarnings(refreshedEarnings);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update motorist subscription.",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleSubscriptionPaymentAction = async (
    paymentId: string,
    status: "confirmed" | "rejected",
  ) => {
    setActionId(paymentId);
    setErrorMessage("");

    try {
      const result = await updateSubscriptionPaymentStatus(paymentId, status);
      setSubscriptionPayments((current) =>
        current.map((payment) => (payment.id === paymentId ? result : payment)),
      );

      if (status === "confirmed") {
        const refreshedUsers = await fetchUsers();
        setUsers(refreshedUsers);
      }

      const refreshedEarnings = await fetchAdminEarnings();
      setAdminEarnings(refreshedEarnings);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update subscription payment.",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleCommunityRedemptionAction = async (
    redemptionId: string,
    status: "paid" | "rejected",
  ) => {
    setActionId(redemptionId);
    setErrorMessage("");

    try {
      const result = await updateCommunityRedemptionStatus(redemptionId, status);
      setCommunityRedemptions((current) =>
        current.map((item) => (item.id === redemptionId ? result : item)),
      );

      const refreshedUsers = await fetchUsers();
      setUsers(refreshedUsers);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update community redemption.",
      );
    } finally {
      setActionId(null);
    }
  };

  const resetRepairShopForm = () => {
    setEditingRepairShopId(null);
    setRepairShopForm(defaultRepairShopForm);
  };

  const handleRepairShopSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionId(editingRepairShopId ?? "repair-shop-create");
    setErrorMessage("");

    try {
      const input: RepairShopInput = {
        ...repairShopForm,
        services: repairShopForm.services.map((service) => service.trim()).filter(Boolean),
        openNow: repairShopForm.status === "active" && repairShopForm.openNow,
      };
      const result = editingRepairShopId
        ? await updateRepairShop(editingRepairShopId, input)
        : await createRepairShop(input);

      setRepairShops((current) =>
        editingRepairShopId
          ? current.map((shop) => (shop.id === result.id ? result : shop))
          : [result, ...current],
      );
      resetRepairShopForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save repair shop.");
    } finally {
      setActionId(null);
    }
  };

  const handleRepairShopEdit = (shop: RepairShop) => {
    setEditingRepairShopId(shop.id);
    setRepairShopForm({
      name: shop.name,
      ownerName: shop.ownerName,
      category: shop.category,
      rating: shop.rating,
      distanceKm: shop.distanceKm,
      address: shop.address,
      responseTime: shop.responseTime,
      openNow: shop.openNow,
      phone: shop.phone,
      email: shop.email,
      status: shop.status,
      latitude: shop.latitude,
      longitude: shop.longitude,
      services: shop.services.length ? shop.services : ["General roadside assistance"],
    });
    setActiveTab("repairshops");
  };

  const toggleRepairShopService = (service: string) => {
    setRepairShopForm((current) => {
      const hasService = current.services.includes(service);
      return {
        ...current,
        services: hasService
          ? current.services.filter((item) => item !== service)
          : [...current.services, service],
      };
    });
  };

  const toggleAllRepairShopServices = () => {
    setRepairShopForm((current) => {
      const hasAllCoreServices = coreRepairShopServices.every((service) =>
        current.services.includes(service),
      );
      const nextServices = hasAllCoreServices
        ? current.services.filter((service) => !coreRepairShopServices.includes(service))
        : Array.from(new Set([...current.services, ...coreRepairShopServices]));

      return {
        ...current,
        services: nextServices.length ? nextServices : ["General roadside assistance"],
      };
    });
  };

  const handleRepairShopDelete = async (shop: RepairShop) => {
    const confirmed = window.confirm(`Remove ${shop.name} from the motorist map?`);
    if (!confirmed) {
      return;
    }

    setActionId(shop.id);
    setErrorMessage("");

    try {
      await deleteRepairShop(shop.id);
      setRepairShops((current) => current.filter((item) => item.id !== shop.id));
      if (editingRepairShopId === shop.id) {
        resetRepairShopForm();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove repair shop.");
    } finally {
      setActionId(null);
    }
  };

  const handleUserRemoval = async (user: UserSummary) => {
    const confirmed = window.confirm(
      `Remove ${user.fullName} (${user.role}) from the system? This also deletes related records for this account.`,
    );

    if (!confirmed) {
      return;
    }

    setActionId(user.id);
    setErrorMessage("");

    try {
      await deleteManagedUser(user.id);

      const [refreshedUsers, refreshedApplications, refreshedPayments] = await Promise.all([
        fetchUsers(),
        fetchAgentApplications(),
        fetchSubscriptionPayments(),
      ]);

      setUsers(refreshedUsers);
      setAgentApplications(refreshedApplications);
      setSubscriptionPayments(refreshedPayments);

      try {
        const refreshedCommunityRedemptions = await fetchCommunityRedemptions();
        setCommunityRedemptions(refreshedCommunityRedemptions);
      } catch (error) {
        setCommunityRedemptions([]);
        setCommunityWarning(
          error instanceof Error
            ? `Community data is temporarily unavailable: ${error.message}`
            : "Community data is temporarily unavailable.",
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to remove user.",
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b3d]">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-gray-400">Connected to Firebase backend data</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
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
            { id: "analytics", label: "Analytics" },
            { id: "agents", label: "Responder Management" },
            { id: "motorists", label: "Motorist Management" },
            { id: "repairshops", label: "Repair Shops" },
            { id: "community", label: "Community Management" },
            { id: "forum", label: "Forum Monitor" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "forum") {
                  navigate("/admin/forum");
                  return;
                }

                setActiveTab(tab.id as AdminTab);
              }}
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

        {communityWarning ? (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            {communityWarning}
          </div>
        ) : null}

        {activeTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-6">
              <StatCard
                icon={<Users className="h-6 w-6 text-blue-400" />}
                label="Motorists"
                value={String(motoristCount)}
                helper="Registered motorists"
              />
              <StatCard
                icon={<Wrench className="h-6 w-6 text-green-400" />}
                label="Responders"
                value={String(approvedAgents.length)}
                helper="Approved and active responders"
              />
              <StatCard
                icon={<Users className="h-6 w-6 text-amber-300" />}
                label="Community"
                value={String(communityUsers.length)}
                helper="Forum-only community users"
              />
              <StatCard
                icon={<Activity className="h-6 w-6 text-yellow-400" />}
                label="Pending Applications"
                value={String(pendingApplications.length)}
                helper="Waiting for review"
              />
              <StatCard
                icon={<Eye className="h-6 w-6 text-purple-400" />}
                label="Motorist Subscriptions"
                value={String(subscribedMotorists)}
                helper={`${motoristCount} total motorists`}
              />
              <StatCard
                icon={<BarChart3 className="h-6 w-6 text-emerald-400" />}
                label="Admin Earnings"
                value={formatPeso(adminEarnings?.totalRevenue ?? 0)}
                helper="Subscriptions + commission"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-lg font-bold">Registration Statistics</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <Detail label="Total Managed Users" value={String(totalManagedUsers)} />
                  <Detail label="Admin Accounts" value={String(adminCount)} />
                  <Detail label="Registered Motorists" value={String(motorists.length)} />
                  <Detail label="Free Motorists" value={String(inactiveMotorists)} />
                  <Detail label="Registered Responders" value={String(allAgents.length)} />
                  <Detail label="Community Users" value={String(communityUsers.length)} />
                </div>
              </section>

              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-lg font-bold">Responder Pipeline</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <Detail label="Approved Responders" value={String(approvedAgents.length)} />
                  <Detail label="Pending Responders" value={String(pendingAgents)} />
                  <Detail label="Pending Applications" value={String(pendingApplications.length)} />
                  <Detail label="Rejected Responders" value={String(rejectedAgents)} />
                </div>
              </section>

              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-lg font-bold">Admin Earnings</h2>
                <div className="grid gap-4">
                  <Detail label="Subscription Earnings" value={formatPeso(adminEarnings?.subscriptionRevenue ?? 0)} />
                  <Detail label="Service Commission" value={formatPeso(adminEarnings?.serviceCommissionRevenue ?? 0)} />
                  <Detail
                    label="Commission Rule"
                    value={`Free ${formatPercent(adminEarnings?.commissionPolicy.freeMotoristRate ?? 0)} / Paid ${formatPercent(adminEarnings?.commissionPolicy.paidMotoristRate ?? 0)}`}
                  />
                </div>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-lg font-bold">Pending Responder Applications</h2>
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
                        <p className="font-semibold text-white">{application.ownerName}</p>
                        <p className="mt-1 text-sm text-gray-400">
                          {application.serviceCategory || "Unspecified category"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {application.submittedDate ?? "Unknown submission date"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="mb-4 text-lg font-bold">Active Responders</h2>
                {loading ? (
                  <p className="text-sm text-gray-400">Loading responders...</p>
                ) : approvedAgents.length === 0 ? (
                  <p className="text-sm text-gray-400">No active responders found.</p>
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
                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
                            {agent.status}
                          </span>
                          <button
                            onClick={() => void handleUserRemoval(agent)}
                            disabled={actionId === agent.id}
                            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionId === agent.id ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : activeTab === "analytics" ? (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
              {analyticsHighlights.map((item, index) => (
                <StatCard
                  key={item.label}
                  icon={
                    index === 0 ? <Users className="h-6 w-6 text-blue-400" /> :
                    index === 1 ? <Wrench className="h-6 w-6 text-green-400" /> :
                    index === 2 ? <Activity className="h-6 w-6 text-amber-300" /> :
                    <BarChart3 className="h-6 w-6 text-purple-400" />
                  }
                  label={item.label}
                  value={item.value}
                  helper={item.helper}
                />
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="text-lg font-bold text-white">Admin Earnings Breakdown</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Earnings connect to confirmed motorist subscriptions and completed service commissions.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Detail label="Total Earnings" value={formatPeso(adminEarnings?.totalRevenue ?? 0)} />
                  <Detail label="Confirmed Subscriptions" value={formatPeso(adminEarnings?.subscriptionRevenue ?? 0)} />
                  <Detail label="Free-Plan Commission" value={formatPeso(adminEarnings?.freeMotoristCommissionRevenue ?? 0)} />
                  <Detail label="Paid-Plan Commission" value={formatPeso(adminEarnings?.paidMotoristCommissionRevenue ?? 0)} />
                  <Detail label="Confirmed Payments" value={String(adminEarnings?.confirmedSubscriptionCount ?? 0)} />
                  <Detail label="Commissioned Jobs" value={String(adminEarnings?.completedCommissionDispatchCount ?? 0)} />
                </div>
              </section>

              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="text-lg font-bold text-white">Recent Service Commissions</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Commission is calculated when a dispatch is completed and payment is recorded.
                </p>
                {adminEarnings?.recentCommissions.length ? (
                  <div className="mt-5 space-y-3">
                    {adminEarnings.recentCommissions.map((commission) => (
                      <div key={commission.id} className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs text-gray-500">{commission.id}</p>
                            <p className="mt-1 text-sm text-gray-300">
                              {commission.subscriptionStatus === "active" ? "Paid motorist" : "Free motorist"} at {formatPercent(commission.commissionRate)}
                            </p>
                          </div>
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            {formatPeso(commission.commissionAmount)}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <Detail label="Total Paid" value={formatPeso(commission.totalAmount)} />
                          <Detail label="Responder Share" value={formatPeso(commission.serviceAmount)} />
                          <Detail label="Completed" value={commission.completedAt ?? "Unknown"} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-gray-400">No completed service commissions recorded yet.</p>
                )}
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard
                title="User Distribution"
                subtitle="Breakdown of registered motorists, responders, and community users"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={userRoleChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {userRoleChartData.map((entry, index) => (
                        <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Registration Trend"
                subtitle="Latest registration activity across user groups"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={registrationTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" allowDecimals={false} fontSize={12} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar dataKey="motorists" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="agents" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="community" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard
                title="Motorist Subscription Status"
                subtitle="Quick view of paying vs free motorists"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={motoristSubscriptionChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9ca3af" allowDecimals={false} fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={70} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {motoristSubscriptionChartData.map((entry, index) => (
                        <Cell key={entry.name} fill={index === 0 ? "#22c55e" : "#64748b"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Responder Status Pipeline"
                subtitle="How registered responders are moving through the approval flow"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={agentStatusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" allowDecimals={false} fontSize={12} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {agentStatusChartData.map((entry, index) => (
                        <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard
                title="Monthly Subscription Status"
                subtitle="Active paid motorists, free motorists, and monthly subscription revenue"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlySubscriptionStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                    <YAxis yAxisId="count" stroke="#9ca3af" allowDecimals={false} fontSize={12} />
                    <YAxis yAxisId="revenue" orientation="right" stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar yAxisId="count" dataKey="active" name="Subscribed" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="count" dataKey="inactive" name="Not subscribed" fill="#64748b" radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill="#ff6b3d" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="text-lg font-bold text-white">Registered Motorists Not Subscribed</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Motorist accounts currently counted as free or inactive.
                </p>
                {unsubscribedMotoristRows.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-400">No unsubscribed motorists.</p>
                ) : (
                  <div className="mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                    {unsubscribedMotoristRows.map((motorist) => (
                      <div key={motorist.id} className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold text-white">{motorist.fullName || "Motorist"}</p>
                            <p className="mt-1 text-sm text-gray-400">
                              {motorist.phone || motorist.email || "No contact info"}
                            </p>
                          </div>
                          <span className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs font-medium text-gray-300">
                            Not Subscribed
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Detail label="Registered" value={motorist.registeredAt ?? "Unknown"} />
                          <Detail label="Account Status" value={motorist.accountStatus || "Unknown"} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <ChartCard
                title="Subscription Plan Mix"
                subtitle="Current plan preference among subscribed motorists"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={subscriptionPlanChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" allowDecimals={false} fontSize={12} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar dataKey="value" fill="#ff6b3d" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="text-lg font-bold text-white">Admin Insights</h2>
                <div className="mt-4 space-y-4">
                  <InsightCard
                    label="Strongest audience"
                    value={
                      [...userRoleChartData].sort((a, b) => b.value - a.value)[0]?.name ?? "No data"
                    }
                    helper="Largest active registered user group right now"
                  />
                  <InsightCard
                    label="Approval backlog"
                    value={pendingApplications.length > 0 ? `${pendingApplications.length} waiting` : "Clear"}
                    helper="Pending responder applications waiting for review"
                  />
                  <InsightCard
                    label="Monetization pressure"
                    value={pendingSubscriptionPayments.length > 0 ? `${pendingSubscriptionPayments.length} pending` : "Stable"}
                    helper="Subscription payments that still need admin action"
                  />
                  <InsightCard
                    label="Community payouts"
                    value={pendingCommunityRedemptions.length > 0 ? `${pendingCommunityRedemptions.length} queued` : "No queue"}
                    helper="Cash-out requests queued for payout processing"
                  />
                </div>
              </section>
            </div>

          </div>
        ) : activeTab === "agents" ? (
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Responder Accreditation Management</h2>
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
                          {application.ownerName}
                        </h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {application.mobileNumber || "No phone on file"}
                        </p>
                      </div>
                      <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-300">
                        Pending Review
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Detail label="Category" value={application.serviceCategory || "Unknown"} />
                      <Detail label="Service Area" value={application.serviceArea || "Not provided"} />
                      <Detail label="Organization" value={application.organizationName || "Not provided"} />
                      <Detail
                        label="Submitted"
                        value={application.submittedDate ?? "Unknown"}
                      />
                      <Detail label="Application ID" value={application.id} />
                    </div>

                    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                        Liability Declaration
                      </p>
                      <p className="mt-2 text-sm text-amber-100">
                        {application.remarks?.liabilityAcknowledged
                          ? `Accepted. ${application.organizationName || "The declared organization"} may be held liable if the responder submits false credentials or payout details.`
                          : "No liability declaration was saved on this application."}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Credentials
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {credentialEntries(application).map((credential) => (
                          credential.empty ? (
                            <span
                              key={`${application.id}-${credential.key}`}
                              className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-gray-300"
                            >
                              {credential.label}
                            </span>
                          ) :
                          credential.url ? (
                            <a
                              key={`${application.id}-${credential.key}`}
                              href={resolveAssetUrl(credential.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-200 transition-colors hover:bg-blue-500/20"
                            >
                              View {credential.label}
                            </a>
                          ) : (
                            <span
                              key={`${application.id}-${credential.key}`}
                              className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-gray-300"
                            >
                              {credential.label}: {credential.name}
                            </span>
                          )
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
                      {users.find((user) => user.id === application.userId) ? (
                        <button
                          onClick={() => {
                            const user = users.find((item) => item.id === application.userId);
                            if (user) {
                              void handleUserRemoval(user);
                            }
                          }}
                          disabled={actionId === application.userId}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          {actionId === application.userId ? "Removing..." : "Remove Responder User"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                  Responder Payout GCash Accounts
                </h3>
              </div>

              {respondersWithPayoutDetails.length === 0 ? (
                <p className="text-sm text-gray-400">No responder payout GCash accounts have been submitted yet.</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {respondersWithPayoutDetails.map((proof) => (
                    <div key={proof.userId} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{proof.agentName}</p>
                          <p className="mt-1 text-sm text-gray-400">{proof.businessName || "No business name"}</p>
                          <p className="mt-1 text-xs text-gray-500">{proof.phone || "No phone on file"}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          proof.status === "approved"
                            ? "border-green-500/40 bg-green-500/10 text-green-300"
                            : proof.status === "pending"
                              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                              : "border-gray-700 bg-gray-800 text-gray-300"
                        }`}>
                          {proof.status}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Detail label="GCash Name" value={proof.gcashName || "Not submitted"} />
                        <Detail label="GCash Number" value={proof.gcashNumber || "Not submitted"} />
                      </div>
                      <div className="mt-4">
                        <Detail label="Payout Notes" value={proof.payoutNotes || "No notes"} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                  Active Responder Accounts
                </h3>
              </div>

              {approvedAgents.length === 0 ? (
                <p className="text-sm text-gray-400">No approved responders found.</p>
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
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
                          {agent.status}
                        </span>
                        <button
                          onClick={() => void handleUserRemoval(agent)}
                          disabled={actionId === agent.id}
                          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionId === agent.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : activeTab === "motorists" ? (
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Motorist Management</h2>
                <p className="text-sm text-gray-400">
                  Subscription payments can use Soteria Credits or direct online payment and activate automatically after confirmation.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
              >
                Refresh
              </button>
            </div>

            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <Detail label="Total Motorists" value={String(motorists.length)} />
              <Detail label="Subscribed" value={String(subscribedMotorists)} />
              <Detail label="Credits Payments" value={String(subscriptionPayments.length)} />
            </div>

            <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <h3 className="text-base font-bold text-white">Subscription Credits Status</h3>
              <p className="mt-1 text-sm text-gray-400">
                New subscription payments activate automatically when credits are deducted or PayMongo confirms online payment.
              </p>

              {pendingSubscriptionPayments.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">No pending confirmations. Credits payment is active.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {pendingSubscriptionPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-xl border border-gray-800 bg-gray-900 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold text-white">{payment.payerName}</p>
                          <p className="mt-1 text-sm text-gray-400">
                            {payment.payerPhone || "No phone on file"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Submitted {payment.submittedAt ?? "Unknown date"}
                          </p>
                        </div>
                        <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-300">
                          Pending Confirmation
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <Detail label="Plan" value={formatSubscriptionPlan(payment.subscriptionPlan)} />
                        <Detail label="Amount" value={`PHP ${payment.amount}`} />
                        <Detail label="Reference" value={payment.referenceNote || "No note"} />
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          onClick={() => void handleSubscriptionPaymentAction(payment.id, "confirmed")}
                          disabled={actionId === payment.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {actionId === payment.id ? "Processing..." : "Confirm & Activate"}
                        </button>
                        <button
                          onClick={() => void handleSubscriptionPaymentAction(payment.id, "rejected")}
                          disabled={actionId === payment.id}
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
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Loading motorists...</p>
            ) : motorists.length === 0 ? (
              <p className="text-sm text-gray-400">No motorists found.</p>
            ) : (
              <div className="space-y-4">
                {motorists.map((motorist) => {
                  const isSubscribed = motorist.subscriptionStatus === "active";

                  return (
                    <div
                      key={motorist.id}
                      className="rounded-2xl border border-gray-800 bg-gray-950 p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="text-base font-bold text-white">{motorist.fullName}</h3>
                          <p className="mt-1 text-sm text-gray-400">
                            {motorist.phone || motorist.email || "No contact info"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Joined {motorist.createdAt ?? "Unknown date"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isSubscribed
                              ? "border border-green-500/40 bg-green-500/10 text-green-300"
                              : "border border-gray-700 bg-gray-800 text-gray-300"
                          }`}
                        >
                          {isSubscribed ? "Subscription Active" : "Subscription Inactive"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <Detail label="User ID" value={motorist.id} />
                        <Detail label="Plan" value={formatSubscriptionPlan(motorist.subscriptionPlan)} />
                        <Detail
                          label="Activated"
                          value={motorist.subscriptionActivatedAt ?? "Not activated"}
                        />
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Detail label="Account Status" value={motorist.status || "Unknown"} />
                        <Detail
                          label="Expires"
                          value={motorist.subscriptionExpiresAt ?? "Not scheduled"}
                        />
                      </div>

                      <div className="mt-5">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Subscription Offer
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {subscriptionPlanOptions.map((option) => {
                            const selectedPlan = motoristPlanDrafts[motorist.id] ?? "monthly";
                            return (
                              <button
                                key={`${motorist.id}-${option.value}`}
                                onClick={() =>
                                  setMotoristPlanDrafts((current) => ({
                                    ...current,
                                    [motorist.id]: option.value,
                                  }))
                                }
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                  selectedPlan === option.value
                                    ? "border border-[#ff6b3d] bg-[#ff6b3d]/10 text-[#ff9a7a]"
                                    : "border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600"
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          onClick={() =>
                            void handleMotoristSubscriptionAction(
                              motorist.id,
                              "active",
                              motoristPlanDrafts[motorist.id] ?? "monthly",
                            )
                          }
                          disabled={actionId === motorist.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {actionId === motorist.id ? "Processing..." : isSubscribed ? "Renew / Change Plan" : "Activate"}
                        </button>
                        <button
                          onClick={() => void handleMotoristSubscriptionAction(motorist.id, "inactive")}
                          disabled={actionId === motorist.id || !isSubscribed}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          Deactivate
                        </button>
                        <button
                          onClick={() => void handleUserRemoval(motorist)}
                          disabled={actionId === motorist.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          {actionId === motorist.id ? "Removing..." : "Remove User"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : activeTab === "repairshops" ? (
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold">Repair Shop Management</h2>
                <p className="text-sm text-gray-400">
                  Shops saved here appear in the motorist nearby repair shop map.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Total Shops" value={String(repairShops.length)} />
                <Detail label="Active On Map" value={String(activeRepairShops.length)} />
              </div>
            </div>

            <form onSubmit={handleRepairShopSubmit} className="mb-6 rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingRepairShopId ? "Edit Repair Shop" : "Add Repair Shop"}
                  </h3>
                  <p className="text-sm text-gray-400">
                    Use exact map coordinates so motorists can detect the correct nearest shop.
                  </p>
                </div>
                {editingRepairShopId ? (
                  <button
                    type="button"
                    onClick={resetRepairShopForm}
                    className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Shop Name</span>
                  <input
                    value={repairShopForm.name}
                    onChange={(event) => setRepairShopForm((current) => ({ ...current, name: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Owner Name</span>
                  <input
                    value={repairShopForm.ownerName}
                    onChange={(event) => setRepairShopForm((current) => ({ ...current, ownerName: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expertise</span>
                  <select
                    value={repairShopForm.category}
                    onChange={(event) =>
                      setRepairShopForm((current) => ({
                        ...current,
                        category: event.target.value as RepairShopCategory,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                  >
                    {repairShopCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</span>
                  <input
                    value={repairShopForm.address}
                    onChange={(event) => setRepairShopForm((current) => ({ ...current, address: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
                  <select
                    value={repairShopForm.status}
                    onChange={(event) =>
                      setRepairShopForm((current) => ({
                        ...current,
                        status: event.target.value as RepairShop["status"],
                        openNow: event.target.value === "active",
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Latitude</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={repairShopForm.latitude}
                    onChange={(event) => setRepairShopForm((current) => ({ ...current, latitude: Number(event.target.value) }))}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Longitude</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={repairShopForm.longitude}
                    onChange={(event) => setRepairShopForm((current) => ({ ...current, longitude: Number(event.target.value) }))}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</span>
                  <input
                    value={repairShopForm.phone}
                    onChange={(event) => setRepairShopForm((current) => ({ ...current, phone: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</span>
                  <input
                    type="email"
                    value={repairShopForm.email}
                    onChange={(event) => setRepairShopForm((current) => ({ ...current, email: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Response Time</span>
                  <input
                    value={repairShopForm.responseTime}
                    onChange={(event) => setRepairShopForm((current) => ({ ...current, responseTime: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rating</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={repairShopForm.rating}
                    onChange={(event) => setRepairShopForm((current) => ({ ...current, rating: Number(event.target.value) }))}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                  />
                </label>
                <div className="md:col-span-2 xl:col-span-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Services</span>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <button
                      type="button"
                      onClick={toggleAllRepairShopServices}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        coreRepairShopServices.every((service) => repairShopForm.services.includes(service))
                          ? "border-[#ff6b3d] bg-[#ff6b3d]/10 text-[#ffb197]"
                          : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600"
                      }`}
                    >
                      All Services
                    </button>
                    {repairShopServiceOptions.map((service) => (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleRepairShopService(service)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          repairShopForm.services.includes(service)
                            ? "border-[#ff6b3d] bg-[#ff6b3d]/10 text-[#ffb197]"
                            : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600"
                        }`}
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={repairShopForm.services.join(", ")}
                    onChange={(event) =>
                      setRepairShopForm((current) => ({
                        ...current,
                        services: event.target.value.split(",").map((item) => item.trim()),
                      }))
                    }
                    className="mt-3 min-h-20 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b3d]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionId === (editingRepairShopId ?? "repair-shop-create")}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle className="h-4 w-4" />
                {actionId === (editingRepairShopId ?? "repair-shop-create")
                  ? "Saving..."
                  : editingRepairShopId ? "Save Repair Shop" : "Add Repair Shop"}
              </button>
            </form>

            {loading ? (
              <p className="text-sm text-gray-400">Loading repair shops...</p>
            ) : repairShops.length === 0 ? (
              <p className="text-sm text-gray-400">No repair shops found.</p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {repairShops.map((shop) => (
                  <div key={shop.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">{shop.name}</h3>
                        <p className="mt-1 text-sm text-gray-400">{shop.address}</p>
                        <p className="mt-1 text-xs text-gray-500">{shop.latitude}, {shop.longitude}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        shop.status === "active"
                          ? "border border-green-500/40 bg-green-500/10 text-green-300"
                          : "border border-gray-700 bg-gray-800 text-gray-300"
                      }`}>
                        {shop.status === "active" ? "Visible On Map" : "Inactive"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <Detail label="Expertise" value={repairShopCategoryOptions.find((item) => item.value === shop.category)?.label ?? shop.category} />
                      <Detail label="Phone" value={shop.phone || "No phone"} />
                      <Detail label="Response" value={shop.responseTime} />
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Detail label="Owner" value={shop.ownerName || "No owner listed"} />
                      <Detail label="Services" value={shop.services.join(", ") || "Roadside assistance"} />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => handleRepairShopEdit(shop)}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleRepairShopDelete(shop)}
                        disabled={actionId === shop.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        {actionId === shop.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Community Management</h2>
                <p className="text-sm text-gray-400">
                  Review cash redemption tickets and monitor community coin balances.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
              >
                Refresh
              </button>
            </div>

            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <Detail label="Community Users" value={String(communityUsers.length)} />
              <Detail label="Pending Cash Tickets" value={String(pendingCommunityRedemptions.length)} />
              <Detail
                label="Coins In Circulation"
                value={String(communityUsers.reduce((sum, user) => sum + Number(user.communityCoins ?? 0), 0))}
              />
            </div>

            <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <h3 className="text-base font-bold text-white">Pending Reward Center Tickets</h3>
              <p className="mt-1 text-sm text-gray-400">
                Review reward tickets and mark them paid after Soteria payout processing. Rejecting restores the member's coins.
              </p>

              {pendingCommunityRedemptions.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">No pending cash tickets.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {pendingCommunityRedemptions.map((redemption) => (
                    <div key={redemption.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold text-white">{redemption.userName}</p>
                          <p className="mt-1 text-sm text-gray-400">
                            {redemption.userPhone || "No phone on file"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Submitted {redemption.submittedAt ?? "Unknown date"}
                          </p>
                        </div>
                        <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-300">
                          Pending Payout
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <Detail label="Ticket" value={redemption.rewardTitle} />
                        <Detail label="Cash Value" value={`PHP ${redemption.cashValue}`} />
                        <Detail label="Coins Spent" value={String(redemption.coinsSpent)} />
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Detail label="GCash Name" value={redemption.gcashName} />
                        <Detail label="GCash Number" value={redemption.gcashNumber} />
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          onClick={() => void handleCommunityRedemptionAction(redemption.id, "paid")}
                          disabled={actionId === redemption.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {actionId === redemption.id ? "Processing..." : "Mark As Paid"}
                        </button>
                        <button
                          onClick={() => void handleCommunityRedemptionAction(redemption.id, "rejected")}
                          disabled={actionId === redemption.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject And Restore Coins
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Loading community members...</p>
            ) : communityUsers.length === 0 ? (
              <p className="text-sm text-gray-400">No community members found.</p>
            ) : (
              <div className="space-y-4">
                {communityUsers.map((member) => (
                  <div key={member.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">{member.fullName}</h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {member.phone || member.email || "No contact info"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Joined {member.createdAt ?? "Unknown date"}
                        </p>
                      </div>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                        {member.communityCoins ?? 0} active coins
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <Detail label="User ID" value={member.id} />
                      <Detail label="Current Coins" value={String(member.communityCoins ?? 0)} />
                      <Detail label="Lifetime Coins" value={String(member.communityLifetimeCoins ?? 0)} />
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Detail label="Account Status" value={member.status || "Unknown"} />
                      <Detail label="Last Reward Activity" value={member.lastCommunityRewardAt ?? "No coin activity yet"} />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => void handleUserRemoval(member)}
                        disabled={actionId === member.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        {actionId === member.id ? "Removing..." : "Remove User"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard(props: {
  icon: React.ReactNode;
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

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: "0.75rem",
  color: "#f9fafb",
};

const tooltipItemStyle = {
  color: "#f9fafb",
};

const tooltipLabelStyle = {
  color: "#f9fafb",
};

function ChartCard(props: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="text-lg font-bold text-white">{props.title}</h2>
      <p className="mt-1 text-sm text-gray-400">{props.subtitle}</p>
      <div className="mt-6">{props.children}</div>
    </section>
  );
}

function InsightCard(props: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{props.label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{props.value}</p>
      <p className="mt-1 text-sm text-gray-400">{props.helper}</p>
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

function credentialEntries(application: AgentApplication): Array<{
  key: string;
  label: string;
  name: string;
  url?: string;
  empty?: boolean;
}> {
  if (!application.remarks) {
    return [{ key: "none", label: "No credential references saved", name: "", empty: true }];
  }

  const credentials =
    typeof application.remarks.credentials === "object" &&
    application.remarks.credentials !== null
      ? (application.remarks.credentials as Record<string, unknown>)
      : {};

  const labels = Object.entries(credentials)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => {
      const asset = value as CredentialAsset | string;
      if (typeof asset === "string") {
        const normalizedValue = asset.trim();
        const looksLikeUrl = /^(https?:\/\/|\/uploads\/)/i.test(normalizedValue);
        return {
          key,
          label: formatCredentialLabel(key),
          name: normalizedValue,
          url: looksLikeUrl ? normalizedValue : undefined,
        };
      }

      return {
        key,
        label: formatCredentialLabel(key),
        name: asset?.name || key,
        url: asset?.url,
      };
    });

  return labels.length > 0
    ? labels
    : [{ key: "none", label: "No credential references saved", name: "", empty: true }];
}

function formatCredentialLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
