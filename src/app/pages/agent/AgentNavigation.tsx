import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Edit2,
  MapPin,
  Navigation,
  Phone,
  Wrench,
  X,
} from "lucide-react";
import { motion } from "motion/react";

import {
  fetchDispatchDetails,
  fetchDispatchFeedback,
  submitDispatchFeedback,
  updateAgentLocation,
  updateDispatchStatus,
  type DispatchDetails,
} from "../../api";
import {
  DispatchFeedbackDialog,
  type DispatchFeedbackFormValues,
} from "../../components/DispatchFeedbackDialog";
import { LocationMap } from "../../components/LocationMap";
import { getStoredUserSession } from "../../session";

type AgentJobStatus = "en-route" | "arrived" | "working" | "completed";

function mapAgentStatus(dispatchStatus: string): AgentJobStatus {
  if (dispatchStatus === "arrived") {
    return "arrived";
  }

  if (dispatchStatus === "in_progress") {
    return "working";
  }

  if (dispatchStatus === "completed") {
    return "completed";
  }

  return "en-route";
}

function parsePesoAmount(value: string): number {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

export function AgentNavigation() {
  const { dispatchId } = useParams();
  const navigate = useNavigate();
  const session = useMemo(() => getStoredUserSession(), []);

  const [status, setStatus] = useState<AgentJobStatus>("en-route");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [agentLocation, setAgentLocation] = useState<[number, number] | null>(null);
  const [motoristLocation, setMotoristLocation] = useState<[number, number] | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchDetails | null>(null);
  const [estimatedFee, setEstimatedFee] = useState("PHP 350");
  const [isEditingFee, setIsEditingFee] = useState(false);
  const [tempFee, setTempFee] = useState("PHP 350");
  const [isLoading, setIsLoading] = useState(true);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  useEffect(() => {
    const loadDispatch = async () => {
      try {
        const data = await fetchDispatchDetails(dispatchId!);
        setDispatchData(data);
        setMotoristLocation([data.motorist.latitude, data.motorist.longitude]);
        setStatus(mapAgentStatus(data.dispatchStatus));
      } catch (error) {
        console.error("Failed to load dispatch:", error);
        alert("Failed to load dispatch details");
      } finally {
        setIsLoading(false);
      }
    };

    loadDispatch();
  }, [dispatchId]);

  useEffect(() => {
    if (!dispatchData?.agent?.id) {
      return;
    }

    if (!("geolocation" in navigator)) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation: [number, number] = [latitude, longitude];
        setAgentLocation(newLocation);

        try {
          await updateAgentLocation(dispatchData.agent!.id, { latitude, longitude });
        } catch (error) {
          console.error("Failed to update location:", error);
        }
      },
      (error) => {
        console.warn("Geolocation error:", error);
        if (motoristLocation) {
          setAgentLocation(motoristLocation);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [dispatchData, motoristLocation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkFeedbackStatus = async () => {
      if (!dispatchId || !session?.id || status !== "completed") {
        return;
      }

      try {
        const existingFeedback = await fetchDispatchFeedback(dispatchId, session.id, "agent");
        const alreadySubmitted = Boolean(existingFeedback);
        setFeedbackSubmitted(alreadySubmitted);
        if (!alreadySubmitted) {
          setShowFeedbackDialog(true);
        }
      } catch (error) {
        console.error("Failed to check feedback status:", error);
      }
    };

    checkFeedbackStatus();
  }, [dispatchId, session?.id, status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStatusUpdate = async (newStatus: Exclude<AgentJobStatus, "completed">) => {
    try {
      const statusMap = {
        "en-route": "accepted",
        arrived: "arrived",
        working: "in_progress",
      } as const;

      await updateDispatchStatus(dispatchId!, statusMap[newStatus]);
      setStatus(newStatus);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status");
    }
  };

  const handleCompleteJob = async () => {
    try {
      await updateDispatchStatus(dispatchId!, "completed", parsePesoAmount(estimatedFee));
      const updatedDispatch = await fetchDispatchDetails(dispatchId!);
      setStatus("completed");
      setDispatchData(updatedDispatch);
    } catch (error) {
      console.error("Failed to complete job:", error);
      alert("Failed to complete job");
    }
  };

  const handleFeedbackSubmit = async ({
    overallRating,
    categoryRatings,
    paidCorrectAmount,
    comment,
  }: DispatchFeedbackFormValues) => {
    if (!dispatchData?.motorist || !session?.id || !dispatchId) {
      alert("Unable to submit feedback right now.");
      return;
    }

    try {
      setFeedbackSubmitting(true);
      await submitDispatchFeedback(dispatchId, {
        reviewerUserId: session.id,
        reviewerRole: "agent",
        overallRating,
        categoryRatings,
        paidCorrectAmount,
        comment,
      });
      setFeedbackSubmitted(true);
      setShowFeedbackDialog(false);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert(error instanceof Error ? error.message : "Failed to submit feedback.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1f2937] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#ff6b3d]"></div>
          <p>Loading dispatch details...</p>
        </div>
      </div>
    );
  }

  if (!dispatchData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1f2937] text-white">
        <div className="text-center">
          <p>Dispatch not found</p>
          <button
            onClick={() => navigate("/agent/dashboard")}
            className="mt-4 rounded-lg bg-[#ff6b3d] px-4 py-2 text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const motorist = {
    name: dispatchData.motorist.fullName,
    phone: dispatchData.motorist.phone,
    location: dispatchData.motorist.locationLabel,
    symptoms: [],
  };

  if (status === "completed") {
    return (
      <div className="flex min-h-screen flex-col bg-[#1f2937] text-white">
        <DispatchFeedbackDialog
          open={showFeedbackDialog}
          mode="agent-to-motorist"
          subjectName={motorist.name}
          submitting={feedbackSubmitting}
          onClose={() => setShowFeedbackDialog(false)}
          onSubmit={handleFeedbackSubmit}
        />

        <header className="border-b border-gray-700 bg-black/20 px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/agent/dashboard")}
                className="rounded-lg p-2 transition-colors hover:bg-gray-700"
                aria-label="Go back to dashboard"
              >
                <ArrowLeft className="h-5 w-5 text-gray-300" />
              </button>
              <div className="flex items-center gap-2">
                <Wrench className="h-6 w-6 text-[#ff6b3d]" />
                <span className="text-xl font-bold text-white">Job Completed</span>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              ID: <span className="font-mono text-gray-300">{dispatchId}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-6 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full rounded-3xl border border-gray-700 bg-gray-800 p-8 shadow-2xl"
          >
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500 bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Job marked as completed</h1>
            <p className="mt-2 text-sm text-gray-300">
              Soteria deducted the motorist credits, kept commission, and started the automated net payout.
            </p>

            <div className="mt-6 rounded-2xl border border-gray-700 bg-gray-900/70 p-5">
              <h3 className="mb-3 text-sm font-semibold text-white">Job Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Motorist</span>
                  <span className="font-medium text-white">{motorist.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Location</span>
                  <span className="text-right font-medium text-white">{motorist.location}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Elapsed time</span>
                  <span className="font-medium text-white">{formatTime(elapsedTime)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Motorist paid</span>
                  <span className="font-medium text-[#ff9a7a]">{estimatedFee}</span>
                </div>
                {dispatchData.payment ? (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Soteria commission</span>
                      <span className="font-medium text-white">PHP {dispatchData.payment.commissionAmount}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Responder payout</span>
                      <span className="font-medium text-green-300">PHP {dispatchData.payment.serviceAmount}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {!feedbackSubmitted ? (
              <div className="mt-5 rounded-2xl border border-[#ff6b3d]/50 bg-[#ff6b3d]/15 p-4">
                <p className="text-sm text-gray-100">
                  Please review the motorist before returning to the dashboard. Payment is processed through Soteria automatically.
                </p>
                <button
                  onClick={() => setShowFeedbackDialog(true)}
                  className="mt-3 w-full rounded-xl bg-[#ff6b3d] py-3 font-semibold text-white transition-colors hover:bg-[#ff5722]"
                >
                  Review Motorist
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-green-500/50 bg-green-900/25 p-4">
                <p className="text-sm text-green-300">Your motorist review has been saved.</p>
              </div>
            )}

            <button
              onClick={() => navigate(`/feedback/${dispatchId}`)}
              className="mt-5 w-full rounded-xl border border-gray-600 py-3 font-semibold text-gray-100 transition-colors hover:bg-gray-700"
            >
              View Feedback
            </button>

            <button
              onClick={() => navigate("/agent/dashboard")}
              className="mt-5 w-full rounded-xl border border-gray-600 py-3 font-semibold text-gray-100 transition-colors hover:bg-gray-700"
            >
              Back to Dashboard
            </button>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#1f2937] text-white">
      <header className="border-b border-gray-700 bg-black/20 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/agent/dashboard")}
              className="rounded-lg p-2 transition-colors hover:bg-gray-700"
              aria-label="Go back to dashboard"
            >
              <ArrowLeft className="h-5 w-5 text-gray-300" />
            </button>
            <div className="flex items-center gap-2">
              <Wrench className="h-6 w-6 text-[#ff6b3d]" />
              <span className="text-xl font-bold text-white">Active Job</span>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            ID: <span className="font-mono text-gray-300">{dispatchId}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div
          className={`mb-6 rounded-2xl p-6 ${
            status === "en-route"
              ? "border border-yellow-500/50 bg-yellow-900/20"
              : status === "arrived"
                ? "border border-purple-500/50 bg-purple-900/20"
                : "border border-blue-500/50 bg-blue-900/20"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`rounded-full p-3 ${
                status === "en-route"
                  ? "bg-yellow-500/20"
                  : status === "arrived"
                    ? "bg-purple-500/20"
                    : "bg-blue-500/20"
              }`}
            >
              {status === "en-route" ? (
                <Navigation className="h-8 w-8 text-yellow-500" />
              ) : status === "arrived" ? (
                <MapPin className="h-8 w-8 text-purple-500" />
              ) : (
                <Wrench className="h-8 w-8 text-blue-500" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="mb-1 text-xl font-bold text-white">
                {status === "en-route" && "En Route to Location"}
                {status === "arrived" && "Arrived at Location"}
                {status === "working" && "Service in Progress"}
              </h2>
              <p className="text-gray-300">
                {status === "en-route" && "Navigate to the motorist's location"}
                {status === "arrived" && "Motorist is waiting for your assistance"}
                {status === "working" && "Working on the vehicle"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Elapsed</p>
              <p className="font-mono text-2xl font-bold text-white">{formatTime(elapsedTime)}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-sm">
          <LocationMap
            center={motoristLocation || [14.0676, 121.4174]}
            zoom={14}
            agentLocation={agentLocation || undefined}
            userLocation={motoristLocation || undefined}
            showRoute={true}
            onDistanceCalculated={(dist, etaMinutes) => {
              setDistance(dist);
              setEta(etaMinutes);
            }}
            height="400px"
          />
          {distance !== null && eta !== null ? (
            <div className="mt-3 rounded-lg border border-blue-500/50 bg-blue-900/20 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">Distance to motorist:</span>
                <span className="font-semibold text-white">{distance.toFixed(1)} km</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-gray-300">Estimated arrival:</span>
                <span className="font-semibold text-white">{eta} min</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-white">Motorist Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Name</p>
                <p className="font-medium text-white">{motorist.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Location</p>
                <p className="text-sm font-medium text-white">{motorist.location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Issue</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {motorist.symptoms.map((symptom) => (
                    <span
                      key={symptom}
                      className="rounded-full border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-200"
                    >
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
              <a
                href={`tel:${motorist.phone}`}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b3d] py-3 font-medium text-white transition-colors hover:bg-[#ff5722]"
              >
                <Phone className="h-5 w-5" />
                Call Motorist
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-white">Service Details</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Estimated Service Fee</p>
                  {!isEditingFee ? (
                    <button
                      onClick={() => setIsEditingFee(true)}
                      className="flex items-center gap-1 text-sm text-[#ff6b3d] transition-colors hover:text-[#ff5722]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  ) : null}
                </div>
                {isEditingFee ? (
                  <div className="mt-1 flex items-center gap-2">
                    <label htmlFor="estimated-fee" className="sr-only">
                      Estimated service fee
                    </label>
                    <input
                      id="estimated-fee"
                      type="text"
                      value={tempFee}
                      onChange={(event) => setTempFee(event.target.value)}
                      className="w-32 rounded-lg border border-gray-600 bg-gray-900 px-3 py-1 text-lg font-bold text-white focus:border-[#ff6b3d] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEstimatedFee(tempFee);
                        setIsEditingFee(false);
                      }}
                      className="rounded-lg bg-green-500/20 p-1.5 text-green-500 transition-colors hover:bg-green-500/30"
                      aria-label="Save updated service fee"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempFee(estimatedFee);
                        setIsEditingFee(false);
                      }}
                      className="rounded-lg bg-red-500/20 p-1.5 text-red-500 transition-colors hover:bg-red-500/30"
                      aria-label="Cancel fee edit"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-[#ff6b3d]">{estimatedFee}</p>
                )}
              </div>

              <div className="rounded-lg border border-yellow-500/50 bg-yellow-900/20 p-3">
                <p className="text-sm text-gray-300">
                  <strong className="text-white">Payment:</strong> Motorist service payment can use Soteria Credits or direct online payment. Commission is deducted automatically and your net payout is transferred to your responder wallet.
                </p>
              </div>

              <div className="rounded-lg border border-blue-500/50 bg-blue-900/20 p-3">
                <p className="text-sm text-gray-300">
                  <strong className="text-white">SLA Timer:</strong> Complete within the agreed
                  timeframe for better ratings.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-white">Update Status</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleStatusUpdate("en-route")}
              disabled={status === "en-route"}
              className={`rounded-xl px-4 py-3 font-semibold transition-colors ${
                status === "en-route"
                  ? "bg-yellow-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <Navigation className="mx-auto mb-1 h-5 w-5" />
              <span className="text-xs">En Route</span>
            </button>
            <button
              onClick={() => handleStatusUpdate("arrived")}
              disabled={status === "arrived"}
              className={`rounded-xl px-4 py-3 font-semibold transition-colors ${
                status === "arrived"
                  ? "bg-purple-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <MapPin className="mx-auto mb-1 h-5 w-5" />
              <span className="text-xs">Arrived</span>
            </button>
            <button
              onClick={() => handleStatusUpdate("working")}
              disabled={status === "working"}
              className={`rounded-xl px-4 py-3 font-semibold transition-colors ${
                status === "working"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <Wrench className="mx-auto mb-1 h-5 w-5" />
              <span className="text-xs">Working</span>
            </button>
          </div>
        </div>

        {status === "working" ? (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleCompleteJob}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b3d] py-5 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-[#ff5722]"
          >
            <CheckCircle className="h-6 w-6" />
            Mark Job as Completed
          </motion.button>
        ) : null}
      </main>
    </div>
  );
}
