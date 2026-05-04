import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Coins,
  Gift,
  LogOut,
  MessageSquare,
  Wallet,
} from "lucide-react";
import {
  createCommunityRedemption,
  fetchCommunityProfile,
  fetchCommunityRedemptions,
  fetchCommunityRewardOptions,
  type CommunityProfile,
  type CommunityRedemption,
  type CommunityRewardOption,
} from "../../api";
import {
  clearStoredUserSession,
  getStoredUserSession,
  setStoredUserSession,
} from "../../session";

type CommunityTab = "forum" | "rewards";

export function CommunityDashboard() {
  const navigate = useNavigate();
  const session = useMemo(() => getStoredUserSession(), []);
  const [activeTab, setActiveTab] = useState<CommunityTab>("forum");
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [rewardOptions, setRewardOptions] = useState<CommunityRewardOption[]>([]);
  const [redemptions, setRedemptions] = useState<CommunityRedemption[]>([]);
  const [selectedRewardId, setSelectedRewardId] = useState("");
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!session?.id || session.role !== "community") {
      navigate("/community/login");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setErrorMessage("");
        const [nextProfile, nextRewards, nextRedemptions] = await Promise.all([
          fetchCommunityProfile(session.id),
          fetchCommunityRewardOptions(),
          fetchCommunityRedemptions(),
        ]);
        setProfile(nextProfile);
        setRewardOptions(nextRewards);
        setSelectedRewardId((current) => current || nextRewards[0]?.id || "");
        setRedemptions(nextRedemptions.filter((item) => item.userId === session.id));
        setStoredUserSession({
          ...session,
          communityCoins: nextProfile.communityCoins,
          communityLifetimeCoins: nextProfile.communityLifetimeCoins,
          lastCommunityRewardAt: nextProfile.lastCommunityRewardAt,
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load community dashboard.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [navigate, session]);

  const selectedReward = useMemo(
    () => rewardOptions.find((item) => item.id === selectedRewardId) ?? null,
    [rewardOptions, selectedRewardId],
  );

  const eligibleRewards = useMemo(
    () => rewardOptions.filter((item) => (profile?.communityCoins ?? 0) >= item.coinsRequired),
    [profile?.communityCoins, rewardOptions],
  );

  const handleLogout = () => {
    clearStoredUserSession();
    navigate("/community/login");
  };

  const handleRedeem = async () => {
    if (!session?.id || !selectedRewardId) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const result = await createCommunityRedemption({
        userId: session.id,
        rewardId: selectedRewardId,
        gcashName,
        gcashNumber,
      });

      if (result.profile) {
        setProfile(result.profile);
        setStoredUserSession({
          ...session,
          communityCoins: result.profile.communityCoins,
          communityLifetimeCoins: result.profile.communityLifetimeCoins,
          lastCommunityRewardAt: result.profile.lastCommunityRewardAt,
        });
      }

      setRedemptions((current) => [result.redemption, ...current]);
      setGcashName("");
      setGcashNumber("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit redemption ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff8a65]">Community Access</p>
            <h1 className="mt-1 text-2xl font-bold">Forum And Reward Center</h1>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-3">
          <StatCard label="Current Coins" value={String(profile?.communityCoins ?? session?.communityCoins ?? 0)} icon={<Coins className="h-5 w-5 text-amber-300" />} />
          <StatCard label="Lifetime Coins" value={String(profile?.communityLifetimeCoins ?? session?.communityLifetimeCoins ?? 0)} icon={<Wallet className="h-5 w-5 text-sky-300" />} />
          <StatCard label="Pending Tickets" value={String(redemptions.filter((item) => item.status === "pending").length)} icon={<Gift className="h-5 w-5 text-emerald-300" />} />
        </div>

        <div className="mt-8 flex gap-3 border-b border-gray-800">
          {[
            { id: "forum", label: "Forum" },
            { id: "rewards", label: "Reward Center" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CommunityTab)}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[#ff6b3d] text-[#ff8a65]"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 rounded-3xl border border-gray-800 bg-gray-900 p-8 text-sm text-gray-400">
            Loading community dashboard...
          </div>
        ) : activeTab === "forum" ? (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1.3fr,0.9fr]">
            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-[#ff6b3d]/10 p-3 text-[#ff8a65]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Semi Forum Access</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
                    Community members can join discussions about stranded motorists, helpful responders, payment behavior,
                    and road conditions. Small coins are earned for daily forum visits and useful participation.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <EarningCard title="Daily Visit" value="+1 coin" detail="Awarded once per day when you open the forum." />
                <EarningCard title="New Post" value="+2 coins" detail="Ask or share something useful about real roadside situations." />
                <EarningCard title="Helpful Reply" value="+1 coin" detail="Answer questions, confirm road conditions, or share payment experience." />
              </div>

              <p className="mt-4 text-sm text-amber-300">
                Community coins are limited to 4 total earned coins per 24 hours. Once you hit the limit, earning locks until the cooldown ends.
              </p>

              <button
                onClick={() => navigate("/community/forum")}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#ff6b3d] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#ff7a52]"
              >
                Open Community Forum
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="text-lg font-bold">Reward Rules</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-gray-300">
                <p>Coins stay small by design so rewards feel earned over time, not instant.</p>
                <p>When you redeem a cash ticket, your current coin balance resets to zero.</p>
                <p>Soteria will process the payout to the GCash account you submit in the ticket.</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-xl font-bold">Cash Ticket Exchange Shop</h2>
              <p className="mt-2 text-sm text-gray-300">
                Choose the ticket you can already afford. Submitting a ticket queues it for Soteria payout processing.
              </p>

              <div className="mt-6 space-y-3">
                {rewardOptions.map((option) => {
                  const selected = option.id === selectedRewardId;
                  const eligible = (profile?.communityCoins ?? 0) >= option.coinsRequired;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedRewardId(option.id)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition-colors ${
                        selected
                          ? "border-[#ff6b3d] bg-[#ff6b3d]/10"
                          : "border-gray-800 bg-gray-950 hover:border-gray-700"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-white">{option.title}</p>
                        <p className="mt-1 text-sm text-gray-400">
                          {option.coinsRequired} coins for PHP {option.cashValue}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          eligible
                            ? "border border-green-500/30 bg-green-500/10 text-green-300"
                            : "border border-gray-700 bg-gray-800 text-gray-300"
                        }`}
                      >
                        {eligible ? "Ready" : "Keep earning"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="gcashName" className="mb-2 block text-sm font-medium text-gray-300">
                    GCash Name
                  </label>
                  <input
                    id="gcashName"
                    value={gcashName}
                    onChange={(event) => setGcashName(event.target.value)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white focus:border-[#ff6b3d] focus:outline-none"
                    placeholder="Account holder name"
                  />
                </div>
                <div>
                  <label htmlFor="gcashNumber" className="mb-2 block text-sm font-medium text-gray-300">
                    GCash Number
                  </label>
                  <input
                    id="gcashNumber"
                    value={gcashNumber}
                    onChange={(event) => setGcashNumber(event.target.value)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white focus:border-[#ff6b3d] focus:outline-none"
                    placeholder="09xxxxxxxxx"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleRedeem()}
                disabled={
                  submitting ||
                  !selectedReward ||
                  eligibleRewards.every((item) => item.id !== selectedRewardId) ||
                  !gcashName.trim() ||
                  !gcashNumber.trim()
                }
                className="mt-6 w-full rounded-xl bg-[#ff6b3d] px-5 py-4 font-semibold text-white transition-colors hover:bg-[#ff7a52] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting Ticket..." : "Redeem Ticket And Reset Coins"}
              </button>
            </div>

            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="text-lg font-bold">Recent Redemption Tickets</h3>
              <div className="mt-4 space-y-3">
                {redemptions.length === 0 ? (
                  <p className="text-sm text-gray-400">No tickets yet.</p>
                ) : (
                  redemptions.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                      <p className="font-semibold text-white">{item.rewardTitle}</p>
                      <p className="mt-1 text-sm text-gray-400">
                        PHP {item.cashValue} • spent {item.coinsSpent} coins
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.submittedAt ?? "Unknown date"}
                      </p>
                      <span
                        className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          item.status === "paid"
                            ? "border border-green-500/30 bg-green-500/10 text-green-300"
                            : item.status === "rejected"
                              ? "border border-red-500/30 bg-red-500/10 text-red-300"
                              : "border border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard(props: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-3">{props.icon}</div>
        <div>
          <p className="text-sm text-gray-400">{props.label}</p>
          <p className="text-2xl font-bold text-white">{props.value}</p>
        </div>
      </div>
    </div>
  );
}

function EarningCard(props: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
      <p className="text-sm text-gray-400">{props.title}</p>
      <p className="mt-2 text-lg font-bold text-white">{props.value}</p>
      <p className="mt-2 text-sm leading-6 text-gray-300">{props.detail}</p>
    </div>
  );
}
