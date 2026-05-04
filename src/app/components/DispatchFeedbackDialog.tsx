import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";

type ReviewMode = "motorist-to-agent" | "agent-to-motorist";

export interface DispatchFeedbackFormValues {
  overallRating: number;
  categoryRatings: Record<string, number>;
  paidCorrectAmount: boolean | null;
  comment: string;
}

interface DispatchFeedbackDialogProps {
  open: boolean;
  mode: ReviewMode;
  subjectName: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: DispatchFeedbackFormValues) => Promise<void> | void;
}

interface FeedbackFieldConfig {
  key: string;
  label: string;
  hint: string;
}

const feedbackConfigs: Record<
  ReviewMode,
  {
    title: string;
    description: string;
    commentLabel: string;
    commentPlaceholder: string;
    categoryFields: FeedbackFieldConfig[];
    paymentPrompt?: string;
  }
> = {
  "motorist-to-agent": {
    title: "Rate your rescue responder",
    description: "Share how the service went so Soteria can keep track of service quality.",
    commentLabel: "Service feedback",
    commentPlaceholder: "Tell us what the responder did well or what can still improve.",
    categoryFields: [
      {
        key: "timeliness",
        label: "Arrival time",
        hint: "Did the responder arrive on time?",
      },
      {
        key: "professionalism",
        label: "Professionalism",
        hint: "Was the responder respectful and careful?",
      },
      {
        key: "serviceQuality",
        label: "Service quality",
        hint: "Was the work helpful and effective?",
      },
    ],
  },
  "agent-to-motorist": {
    title: "Review the motorist",
    description: "Record how the motorist handled communication and cooperation during the job. Payment is processed by Soteria automatically.",
    commentLabel: "Motorist notes",
    commentPlaceholder: "Add any quick notes about cooperation or communication.",
    categoryFields: [
      {
        key: "communication",
        label: "Communication",
        hint: "Was the motorist easy to contact and understand?",
      },
      {
        key: "cooperation",
        label: "Cooperation",
        hint: "Was the motorist cooperative during service?",
      },
      {
        key: "paymentExperience",
        label: "Payment experience",
        hint: "How smooth was the payment process?",
      },
    ],
  },
};

function StarRating({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs text-gray-400">{hint}</p>
        </div>
        <span className="rounded-full bg-[#ff6b3d]/15 px-2 py-1 text-xs font-semibold text-[#ff9a7a]">
          {value || 0}/5
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className="rounded-lg p-1 transition-colors"
            aria-label={`${label} ${rating} star${rating > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-6 w-6 ${
                rating <= value ? "fill-[#ff6b3d] text-[#ff6b3d]" : "text-gray-600"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function DispatchFeedbackDialog({
  open,
  mode,
  subjectName,
  submitting = false,
  onClose,
  onSubmit,
}: DispatchFeedbackDialogProps) {
  const config = feedbackConfigs[mode];
  const initialCategoryRatings = useMemo(
    () =>
      Object.fromEntries(config.categoryFields.map((field) => [field.key, 0])) as Record<string, number>,
    [config.categoryFields],
  );
  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>(initialCategoryRatings);
  const [paidCorrectAmount, setPaidCorrectAmount] = useState<boolean | null>(
    mode === "agent-to-motorist" ? true : null,
  );
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) {
      setOverallRating(0);
      setCategoryRatings(initialCategoryRatings);
      setPaidCorrectAmount(mode === "agent-to-motorist" ? true : null);
      setComment("");
    }
  }, [initialCategoryRatings, mode, open]);

  if (!open) {
    return null;
  }

  const canSubmit =
    overallRating > 0 &&
    config.categoryFields.every((field) => (categoryRatings[field.key] ?? 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-gray-700 bg-[#111827] p-6 shadow-2xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff9a7a]">
            Post-service review
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">{config.title}</h2>
          <p className="mt-2 text-sm text-gray-300">
            {config.description} Reviewing: <span className="font-semibold text-white">{subjectName}</span>
          </p>
        </div>

        <div className="space-y-4">
          <StarRating
            label="Overall experience"
            hint="Give your overall rating for this completed rescue job."
            value={overallRating}
            onChange={setOverallRating}
          />

          {config.categoryFields.map((field) => (
            <StarRating
              key={field.key}
              label={field.label}
              hint={field.hint}
              value={categoryRatings[field.key] ?? 0}
              onChange={(value) =>
                setCategoryRatings((current) => ({
                  ...current,
                  [field.key]: value,
                }))
              }
            />
          ))}

          <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
            <label htmlFor="dispatch-feedback-comment" className="text-sm font-semibold text-white">
              {config.commentLabel}
            </label>
            <textarea
              id="dispatch-feedback-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#ff6b3d]"
              placeholder={config.commentPlaceholder}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-600 px-4 py-3 text-sm font-semibold text-gray-200 transition-colors hover:bg-gray-800"
          >
            Later
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() =>
              onSubmit({
                overallRating,
                categoryRatings,
                paidCorrectAmount,
                comment: comment.trim(),
              })
            }
            className="rounded-xl bg-[#ff6b3d] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff5722] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit review"}
          </button>
        </div>
      </div>
    </div>
  );
}
