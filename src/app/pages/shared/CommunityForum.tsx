import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  TriangleAlert,
  UserRound,
  Wrench,
} from "lucide-react";
import {
  awardCommunityForumVisit,
  createForumReply,
  createForumThread,
  fetchCommunityProfile,
  fetchForumThreads,
  getAdminSession,
  type ForumReply,
  type ForumRole,
  type ForumThread,
  type ForumTopic,
} from "../../api";
import { LogoWithSecret } from "../../components/LogoWithSecret";
import { getStoredUserSession, setStoredUserSession } from "../../session";

const topicOptions: Array<{ value: ForumTopic | "all"; label: string }> = [
  { value: "all", label: "All Topics" },
  { value: "general", label: "General" },
  { value: "agent", label: "Responders" },
  { value: "motorist", label: "Motorists" },
  { value: "payment", label: "Payments" },
  { value: "road", label: "Road Conditions" },
  { value: "safety", label: "Safety" },
];

const topicLabelMap: Record<ForumTopic, string> = {
  general: "General",
  agent: "Responder Concern",
  motorist: "Motorist Concern",
  payment: "Payment",
  road: "Road Conditions",
  safety: "Safety",
};

export function CommunityForum() {
  const navigate = useNavigate();
  const location = useLocation();
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTopic, setActiveTopic] = useState<ForumTopic | "all">("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState<ForumTopic>("general");
  const [submitting, setSubmitting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingThreadId, setReplyingThreadId] = useState<string | null>(null);
  const session = useMemo(() => getStoredUserSession(), []);
  const adminSession = useMemo(() => getAdminSession(), []);
  const isAdminMonitor = location.pathname.startsWith("/admin") && adminSession?.role === "admin";
  const canParticipate = Boolean(session?.id && ["motorist", "agent", "community"].includes(session.role));

  useEffect(() => {
    if (!canParticipate && !isAdminMonitor) {
      navigate("/community/login");
      return;
    }

    let active = true;
    let visitAwarded = false;

    const loadThreads = async (awardVisit = false) => {
      try {
        setLoading((current) => current);
        setErrorMessage("");
        if (awardVisit && !visitAwarded && session?.role === "community") {
          visitAwarded = true;
          const visit = await awardCommunityForumVisit(session.id);
          setStoredUserSession({
            ...session,
            communityCoins: visit.profile.communityCoins,
            communityLifetimeCoins: visit.profile.communityLifetimeCoins,
            lastCommunityRewardAt: visit.profile.lastCommunityRewardAt,
          });
        }
        const forumThreads = await fetchForumThreads();
        if (active) {
          setThreads(forumThreads);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load forum discussions.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadThreads(true);
    const refreshTimer = window.setInterval(() => {
      void loadThreads(false);
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [canParticipate, isAdminMonitor, navigate, session]);

  const filteredThreads = useMemo(
    () => threads.filter((thread) => activeTopic === "all" || thread.topic === activeTopic),
    [activeTopic, threads],
  );

  const backPath =
    isAdminMonitor
      ? "/admin/dashboard"
      : session?.role === "agent"
      ? "/agent/dashboard"
      : session?.role === "community"
        ? "/community/dashboard"
        : "/user/dashboard";
  const roleLabel =
    isAdminMonitor
      ? "Admin"
      : session?.role === "agent"
      ? "Responder"
      : session?.role === "community"
        ? "Community"
        : "Motorist";
  const placeholderTitle =
    session?.role === "agent"
      ? "Example: Is this road passable for towing tonight?"
      : session?.role === "community"
        ? "Example: Which responder really helped stranded motorists here?"
      : "Example: Is this responder reliable and responsive?";
  const placeholderBody =
    session?.role === "agent"
      ? "Share the situation, place, payment concern, or road issue so other users can respond."
      : session?.role === "community"
        ? "Share local updates, helpful experiences, or warnings that can help stranded motorists and responders."
      : "Ask about a responder, payment experience, safety concern, or road issue in your area.";

  const handleCreateThread = async (event: FormEvent) => {
    event.preventDefault();

    if (!session?.id || !canParticipate) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const created = await createForumThread({
        authorUserId: session.id,
        authorRole: session.role,
        title,
        body,
        topic,
      });

      setThreads((current) => [created, ...current]);
      setTitle("");
      setBody("");
      setTopic("general");
      if (session.role === "community") {
        const profile = await fetchCommunityProfile(session.id);
        setStoredUserSession({
          ...session,
          communityCoins: profile.communityCoins,
          communityLifetimeCoins: profile.communityLifetimeCoins,
          lastCommunityRewardAt: profile.lastCommunityRewardAt,
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to publish your post.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (threadId: string) => {
    if (!session?.id || !canParticipate) {
      return;
    }

    const draft = replyDrafts[threadId]?.trim();
    if (!draft) {
      return;
    }

    setReplyingThreadId(threadId);
    setErrorMessage("");

    try {
      const reply = await createForumReply(threadId, {
        authorUserId: session.id,
        authorRole: session.role,
        body: draft,
      });

      setThreads((current) =>
        current.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                replies: [...thread.replies, reply],
                replyCount: thread.replyCount + 1,
                lastActivityAt: reply.createdAt,
              }
            : thread,
        ),
      );
      setReplyDrafts((current) => ({ ...current, [threadId]: "" }));
      if (session.role === "community") {
        const profile = await fetchCommunityProfile(session.id);
        setStoredUserSession({
          ...session,
          communityCoins: profile.communityCoins,
          communityLifetimeCoins: profile.communityLifetimeCoins,
          lastCommunityRewardAt: profile.lastCommunityRewardAt,
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send reply.");
    } finally {
      setReplyingThreadId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(backPath)}
              className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <LogoWithSecret />
          </div>
          <div className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300">
            {roleLabel} Forum Access
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[360px,minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-2xl border border-gray-800 bg-gray-800 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#ff6b3d]/15 p-3 text-[#ff8a65]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Community Forum</h1>
                <p className="mt-1 text-sm text-gray-400">
                  A shared space where motorists, responders, and community members can ask, answer, and flag concerns.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  Keep posts factual and respectful. Avoid posting private phone numbers, exact home
                  addresses, or accusations without context.
                </p>
              </div>
            </div>
          </section>

          {isAdminMonitor ? (
            <section className="rounded-2xl border border-gray-800 bg-gray-800 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Forum Monitor
              </h2>
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
                  <p className="text-2xl font-bold text-white">{threads.length}</p>
                  <p className="text-sm text-gray-400">Visible discussions</p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
                  <p className="text-2xl font-bold text-white">
                    {threads.reduce((sum, thread) => sum + thread.replyCount, 0)}
                  </p>
                  <p className="text-sm text-gray-400">Total replies</p>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-gray-800 bg-gray-800 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Start A Discussion
              </h2>
              <form onSubmit={handleCreateThread} className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300" htmlFor="forum-topic">
                    Topic
                  </label>
                  <select
                    id="forum-topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value as ForumTopic)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white focus:border-[#ff6b3d] focus:outline-none"
                  >
                    {topicOptions
                      .filter((option): option is { value: ForumTopic; label: string } => option.value !== "all")
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300" htmlFor="forum-title">
                    Title
                  </label>
                  <input
                    id="forum-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={placeholderTitle}
                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-[#ff6b3d] focus:outline-none"
                    maxLength={120}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300" htmlFor="forum-body">
                    Details
                  </label>
                  <textarea
                    id="forum-body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder={placeholderBody}
                    className="min-h-32 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-[#ff6b3d] focus:outline-none"
                    maxLength={800}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b3d] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#ff7a52] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? "Posting..." : "Post Concern"}
                </button>
              </form>
            </section>
          )}
        </aside>

        <section className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {topicOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setActiveTopic(option.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeTopic === option.value
                    ? "bg-[#ff6b3d] text-white"
                    : "border border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-800 p-6 text-sm text-gray-300">
              Loading community discussions...
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-800 p-8 text-center">
              <p className="text-lg font-semibold text-white">No discussions yet</p>
              <p className="mt-2 text-sm text-gray-400">
                Start the first thread for this topic and invite feedback from motorists, responders, and the community.
              </p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <article key={thread.id} className="rounded-2xl border border-gray-800 bg-gray-800 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#ff6b3d]/15 px-3 py-1 text-xs font-semibold text-[#ff9a7a]">
                        {topicLabelMap[thread.topic]}
                      </span>
                      <RoleBadge role={thread.authorRole} />
                    </div>
                    <h2 className="text-xl font-semibold text-white">{thread.title}</h2>
                    <p className="mt-1 text-sm text-gray-400">
                      {thread.authorName} • {thread.createdAt ?? "Unknown date"}
                    </p>
                  </div>
                  <div className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-gray-300">
                    {thread.replyCount} replies
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-200">{thread.body}</p>

                <div className="mt-5 space-y-3 border-t border-gray-700 pt-4">
                  {thread.replies.length > 0 ? (
                    thread.replies.map((reply) => <ReplyCard key={reply.id} reply={reply} />)
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 px-4 py-4 text-sm text-gray-400">
                      No replies yet. Be the first to respond.
                    </div>
                  )}
                </div>

                {isAdminMonitor ? null : (
                  <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                    <textarea
                      value={replyDrafts[thread.id] ?? ""}
                      onChange={(event) =>
                        setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))
                      }
                      placeholder="Add a helpful reply, warning, or local update."
                      className="min-h-24 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-[#ff6b3d] focus:outline-none"
                      maxLength={500}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => void handleReplySubmit(thread.id)}
                        disabled={replyingThreadId === thread.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-[#ff6b3d] hover:text-[#ff9a7a] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                        {replyingThreadId === thread.id ? "Sending..." : "Reply"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

function RoleBadge({ role }: { role: ForumRole }) {
  const isAgent = role === "agent";
  const isCommunity = role === "community";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
        isAgent
          ? "bg-blue-500/10 text-blue-200"
          : isCommunity
            ? "bg-amber-500/10 text-amber-200"
            : "bg-emerald-500/10 text-emerald-200"
      }`}
    >
      {isAgent ? <Wrench className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
      {isAgent ? "Responder" : isCommunity ? "Community" : "Motorist"}
    </span>
  );
}

function ReplyCard({ reply }: { reply: ForumReply }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
      <div className="flex items-center gap-2">
        <RoleBadge role={reply.authorRole} />
        <span className="text-sm font-medium text-white">{reply.authorName}</span>
        <span className="text-xs text-gray-500">{reply.createdAt ?? "Unknown date"}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-200">{reply.body}</p>
    </div>
  );
}
