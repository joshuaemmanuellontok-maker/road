import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Clock3, MessageSquareText, Star } from "lucide-react";

import {
  fetchDispatchDetails,
  fetchDispatchFeedbackThread,
  type DispatchDetails,
  type DispatchFeedback,
} from "../../api";
import { LogoWithSecret } from "../../components/LogoWithSecret";
import { getStoredUserSession } from "../../session";

function formatSubmittedAt(value: string | null) {
  if (!value) {
    return "Saved";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Saved";
  }

  return date.toLocaleString();
}

function renderStars(value: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={`${value}-${index}`}
      className={`h-4 w-4 ${
        index < value ? "fill-[#ff6b3d] text-[#ff6b3d]" : "text-gray-600"
      }`}
    />
  ));
}

function buildCategoryLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function FeedbackCard({
  title,
  subtitle,
  feedback,
}: {
  title: string;
  subtitle: string;
  feedback: DispatchFeedback | null;
}) {
  if (!feedback) {
    return (
      <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
            <Clock3 className="h-3.5 w-3.5" />
            Pending
          </span>
        </div>
        <p className="mt-6 text-sm text-gray-300">No review has been submitted yet for this side.</p>
      </section>
    );
  }

  const categoryEntries = Object.entries(feedback.categoryRatings);

  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Submitted
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-gray-700 bg-gray-900/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Overall Rating</p>
            <div className="mt-2 flex items-center gap-1">{renderStars(feedback.overallRating)}</div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{feedback.overallRating}/5</p>
            <p className="text-xs text-gray-500">{formatSubmittedAt(feedback.submittedAt)}</p>
          </div>
        </div>
      </div>

      {categoryEntries.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {categoryEntries.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
              <p className="text-sm font-medium text-white">{buildCategoryLabel(key)}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1">{renderStars(value)}</div>
                <span className="text-sm text-gray-300">{value}/5</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {feedback.paidCorrectAmount !== null ? (
        <div className="mt-4 rounded-xl border border-gray-700 bg-gray-900/50 p-4">
          <p className="text-sm font-medium text-white">Payment Status</p>
          <p
            className={`mt-1 text-sm ${
              feedback.paidCorrectAmount ? "text-green-300" : "text-red-300"
            }`}
          >
            {feedback.paidCorrectAmount
              ? "Responder confirmed the correct amount was paid."
              : "Responder reported an issue with the payment amount."}
          </p>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-gray-700 bg-gray-900/50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <MessageSquareText className="h-4 w-4 text-[#ff9a7a]" />
          Notes
        </div>
        <p className="mt-2 text-sm text-gray-300">
          {feedback.comment || "No additional notes were included in this review."}
        </p>
      </div>
    </section>
  );
}

export function DispatchFeedbackView() {
  const { dispatchId } = useParams();
  const navigate = useNavigate();
  const session = useMemo(() => getStoredUserSession(), []);

  const [dispatchDetails, setDispatchDetails] = useState<DispatchDetails | null>(null);
  const [feedback, setFeedback] = useState<DispatchFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dispatchId || !session?.id || (session.role !== "motorist" && session.role !== "agent")) {
      navigate("/");
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [details, feedbackThread] = await Promise.all([
          fetchDispatchDetails(dispatchId),
          fetchDispatchFeedbackThread(dispatchId, session.id, session.role),
        ]);

        setDispatchDetails(details);
        setFeedback(feedbackThread.feedback);
      } catch (loadError) {
        console.error("Failed to load dispatch feedback:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load feedback.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [dispatchId, navigate, session]);

  const motoristFeedback =
    feedback.find((item) => item.reviewerRole === "motorist") ?? null;
  const agentFeedback = feedback.find((item) => item.reviewerRole === "agent") ?? null;

  const backPath = session?.role === "agent"
    ? `/agent/navigate/${dispatchId}`
    : `/user/tracking/${dispatchId}`;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#ff6b3d]"></div>
          <p>Loading feedback...</p>
        </div>
      </div>
    );
  }

  if (error || !dispatchDetails) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-900 text-white">
        <header className="border-b border-gray-700 bg-gray-800 px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <button
              onClick={() => navigate(backPath)}
              className="rounded-lg p-2 transition-colors hover:bg-gray-700"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-300" />
            </button>
            <LogoWithSecret />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-8">
          <div className="w-full rounded-2xl border border-red-500/40 bg-red-900/20 p-6 text-center">
            <h1 className="text-xl font-semibold text-white">Unable to load feedback</h1>
            <p className="mt-2 text-sm text-red-100">{error ?? "Dispatch details were not found."}</p>
          </div>
        </main>
      </div>
    );
  }

  const agentName =
    dispatchDetails.agent?.businessName || dispatchDetails.agent?.fullName || "Rescue Responder";

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 bg-gray-800 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="rounded-lg p-2 transition-colors hover:bg-gray-700"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-300" />
          </button>
          <LogoWithSecret />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff9a7a]">
            Feedback Review
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Completed Dispatch Feedback</h1>
          <p className="mt-2 text-sm text-gray-300">
            Dispatch <span className="font-mono text-white">{dispatchId}</span> between{" "}
            <span className="font-semibold text-white">{dispatchDetails.motorist.fullName}</span> and{" "}
            <span className="font-semibold text-white">{agentName}</span>.
          </p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <FeedbackCard
            title="Motorist Review"
            subtitle={`From ${dispatchDetails.motorist.fullName} to ${agentName}`}
            feedback={motoristFeedback}
          />
          <FeedbackCard
            title="Responder Review"
            subtitle={`From ${agentName} to ${dispatchDetails.motorist.fullName}`}
            feedback={agentFeedback}
          />
        </div>
      </main>
    </div>
  );
}
