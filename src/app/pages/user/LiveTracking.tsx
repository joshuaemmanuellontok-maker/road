import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  MapPin,
  Navigation,
  Phone,
} from "lucide-react";
import { motion } from "motion/react";

import {
  fetchDispatchDetails,
  fetchDispatchFeedback,
  submitDispatchFeedback,
  type DispatchDetails,
} from "../../api";
import {
  DispatchFeedbackDialog,
  type DispatchFeedbackFormValues,
} from "../../components/DispatchFeedbackDialog";
import { LocationMap } from "../../components/LocationMap";
import { LogoWithSecret } from "../../components/LogoWithSecret";
import { SUSResponses, SUSSurvey } from "../../components/SUSSurvey";
import { getStoredUserSession } from "../../session";

type TrackingStatus = "dispatched" | "en-route" | "arrived" | "in-service" | "completed";

function mapDispatchStatus(dispatchStatus: string): TrackingStatus {
  if (dispatchStatus === "accepted") {
    return "en-route";
  }

  if (dispatchStatus === "arrived") {
    return "arrived";
  }

  if (dispatchStatus === "in_progress") {
    return "in-service";
  }

  if (dispatchStatus === "completed") {
    return "completed";
  }

  return "dispatched";
}

function calculateETA(agentLoc: [number, number], userLoc: [number, number]): string {
  const R = 6371;
  const dLat = ((userLoc[0] - agentLoc[0]) * Math.PI) / 180;
  const dLon = ((userLoc[1] - agentLoc[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((agentLoc[0] * Math.PI) / 180) *
      Math.cos((userLoc[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  const etaMinutes = Math.ceil((distance / 30) * 60);
  return `${etaMinutes} min`;
}

export function LiveTracking() {
  const { dispatchId } = useParams();
  const navigate = useNavigate();
  const session = useMemo(() => getStoredUserSession(), []);

  const [status, setStatus] = useState<TrackingStatus>("dispatched");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [slaTimer, setSlaTimer] = useState(480);
  const [agentLocation, setAgentLocation] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchDetails | null>(null);
  const [showSUSSurvey, setShowSUSSurvey] = useState(false);
  const [surveySubmitted, setSurveySubmitted] = useState(false);
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
        setUserLocation([data.motorist.latitude, data.motorist.longitude]);
        setAgentLocation(
          data.agent?.currentLatitude != null && data.agent?.currentLongitude != null
            ? [data.agent.currentLatitude, data.agent.currentLongitude]
            : null,
        );
        setStatus(mapDispatchStatus(data.dispatchStatus));
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
    if (!dispatchData) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const data = await fetchDispatchDetails(dispatchId!);
        setDispatchData(data);
        setAgentLocation(
          data.agent?.currentLatitude != null && data.agent?.currentLongitude != null
            ? [data.agent.currentLatitude, data.agent.currentLongitude]
            : null,
        );
        setStatus(mapDispatchStatus(data.dispatchStatus));
      } catch (error) {
        console.error("Failed to poll dispatch updates:", error);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [dispatchData, dispatchId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status !== "completed" && slaTimer > 0) {
      const timer = setInterval(() => {
        setSlaTimer((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [slaTimer, status]);

  useEffect(() => {
    const checkFeedbackStatus = async () => {
      if (!dispatchId || !session?.id || status !== "completed") {
        return;
      }

      try {
        const existingFeedback = await fetchDispatchFeedback(dispatchId, session.id, "motorist");
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

  const handleSurveySubmit = (responses: SUSResponses) => {
    console.log("SUS Survey Responses:", responses);
    setSurveySubmitted(true);
    setShowSUSSurvey(false);
    alert("Thank you for your feedback! Your responses help us improve Soteria.");
  };

  const handleFeedbackSubmit = async ({
    overallRating,
    categoryRatings,
    comment,
  }: DispatchFeedbackFormValues) => {
    if (!dispatchData?.agent || !session?.id || !dispatchId) {
      alert("Unable to submit feedback right now.");
      return;
    }

    try {
      setFeedbackSubmitting(true);
      await submitDispatchFeedback(dispatchId, {
        reviewerUserId: session.id,
        reviewerRole: "motorist",
        overallRating,
        categoryRatings,
        comment,
      });
      setFeedbackSubmitted(true);
      setShowFeedbackDialog(false);
      setShowSUSSurvey(true);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert(error instanceof Error ? error.message : "Failed to submit feedback.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#ff6b3d]"></div>
          <p>Loading tracking information...</p>
        </div>
      </div>
    );
  }

  if (!dispatchData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p>Dispatch not found</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 rounded-lg bg-[#ff6b3d] px-4 py-2 text-white"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const agent = {
    name: dispatchData.agent?.businessName || "Soteria Responder",
    phone: dispatchData.agent?.phone || "+63 917 123 4567",
    vehicleNumber: "ABC 1234",
    eta:
      agentLocation && userLocation ? calculateETA(agentLocation, userLocation) : "Calculating...",
  };

  const statusConfig = {
    dispatched: {
      icon: Clock,
      label: "Responder Dispatched",
      description: "Your rescue responder has been notified and is preparing to assist you",
    },
    "en-route": {
      icon: Navigation,
      label: "Responder En Route",
      description: "Responder is on the way to your location",
    },
    arrived: {
      icon: MapPin,
      label: "Responder Arrived",
      description: "Responder has arrived at your location",
    },
    "in-service": {
      icon: CheckCircle,
      label: "Service In Progress",
      description: "Responder is working on your vehicle",
    },
    completed: {
      icon: CheckCircle,
      label: "Service Completed",
      description: "Your rescue service has been completed",
    },
  };

  const currentConfig = statusConfig[status];
  const StatusIcon = currentConfig.icon;

  if (status === "completed") {
    return (
      <div className="flex min-h-screen flex-col bg-gray-900">
        <DispatchFeedbackDialog
          open={showFeedbackDialog}
          mode="motorist-to-agent"
          subjectName={agent.name}
          submitting={feedbackSubmitting}
          onClose={() => setShowFeedbackDialog(false)}
          onSubmit={handleFeedbackSubmit}
        />

        {showSUSSurvey ? (
          <SUSSurvey onClose={() => setShowSUSSurvey(false)} onSubmit={handleSurveySubmit} />
        ) : null}

        <header className="border-b border-gray-700 bg-gray-800 px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-center gap-2">
            <LogoWithSecret />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center"
          >
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500 bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">Service Completed!</h1>
            <p className="mb-6 text-sm text-gray-400">
              Thank you for using Soteria. We hope your vehicle is back on the road safely.
            </p>

            <div className="mb-5 rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-white">Service Summary</h3>
              <div className="space-y-2.5 text-left">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Dispatch ID:</span>
                  <span className="font-mono font-medium text-white">{dispatchId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Responder:</span>
                  <span className="ml-2 truncate font-medium text-white">{agent.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Total Time:</span>
                  <span className="font-medium text-white">{formatTime(elapsedTime)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Motorist Paid:</span>
                  <span className="font-medium text-green-400">
                    PHP {dispatchData.payment?.totalAmount ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Soteria Commission:</span>
                  <span className="font-medium text-white">
                    PHP {dispatchData.payment?.commissionAmount ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Responder Payout:</span>
                  <span className="font-medium text-green-400">
                    PHP {dispatchData.payment?.serviceAmount ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-green-500/50 bg-green-900/30 p-3">
              <p className="text-xs text-green-100">
                Payment was processed through Soteria. The system deducted commission and transferred the responder payout automatically.
              </p>
            </div>

            {!feedbackSubmitted ? (
              <div className="mb-4 rounded-lg border border-[#ff6b3d]/50 bg-[#ff6b3d]/20 p-3">
                <p className="mb-2.5 text-xs text-gray-200">
                  Your service review is ready. Please rate the rescue responder before you leave.
                </p>
                <button
                  onClick={() => setShowFeedbackDialog(true)}
                  className="w-full rounded-lg bg-[#ff6b3d] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#ff5722]"
                >
                  Rate Responder Now
                </button>
              </div>
            ) : (
              <div className="mb-4 rounded-lg border border-green-500/50 bg-green-900/30 p-3">
                <p className="text-xs text-green-300">Your service review has been submitted.</p>
              </div>
            )}

            <button
              onClick={() => navigate(`/feedback/${dispatchId}`)}
              className="mb-4 w-full rounded-lg border border-gray-600 bg-transparent py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800"
            >
              View Feedback
            </button>

            {!surveySubmitted ? (
              <div className="mb-4 rounded-lg border border-blue-500/50 bg-blue-900/20 p-3">
                <p className="mb-2.5 text-xs text-gray-200">
                  You can also complete the quick system survey to help improve Soteria.
                </p>
                <button
                  onClick={() => setShowSUSSurvey(true)}
                  className="w-full rounded-lg border border-blue-500/50 bg-transparent py-2.5 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-500/10"
                >
                  Open Survey
                </button>
              </div>
            ) : (
              <div className="mb-4 rounded-lg border border-green-500/50 bg-green-900/30 p-3">
                <p className="text-xs text-green-300">Thank you for completing the survey.</p>
              </div>
            )}

            <button
              onClick={() => navigate("/")}
              className="w-full rounded-xl bg-[#ff6b3d] py-3.5 font-semibold text-white transition-colors hover:bg-[#ff5722]"
            >
              Back to Home
            </button>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-900 text-white">
      <header className="border-b border-gray-700 bg-gray-800 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button
            onClick={() => navigate("/user/dashboard")}
            className="rounded-lg p-2 transition-colors hover:bg-gray-700"
            aria-label="Go back to dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-gray-300" />
          </button>
          <LogoWithSecret />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-5 rounded-xl border p-4 ${
            status === "dispatched"
              ? "border-blue-500/50 bg-blue-900/30"
              : status === "en-route"
                ? "border-yellow-500/50 bg-yellow-900/30"
                : status === "arrived"
                  ? "border-purple-500/50 bg-purple-900/30"
                  : "border-[#ff6b3d]/50 bg-[#ff6b3d]/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-2 ${
                status === "dispatched"
                  ? "bg-blue-900/50"
                  : status === "en-route"
                    ? "bg-yellow-900/50"
                    : status === "arrived"
                      ? "bg-purple-900/50"
                      : "bg-[#ff6b3d]/30"
              }`}
            >
              <StatusIcon
                className={`h-6 w-6 ${
                  status === "dispatched"
                    ? "text-blue-400"
                    : status === "en-route"
                      ? "text-yellow-400"
                      : status === "arrived"
                        ? "text-purple-400"
                        : "text-[#ff6b3d]"
                }`}
              />
            </div>
            <div className="flex-1">
              <h2 className="mb-0.5 text-base font-bold text-white">{currentConfig.label}</h2>
              <p className="text-xs text-gray-300">{currentConfig.description}</p>
            </div>
          </div>
        </motion.div>

        <div className="mb-5 rounded-xl border border-gray-700 bg-gray-800 p-3 shadow-sm">
          <LocationMap
            center={userLocation || [14.0676, 121.4174]}
            zoom={14}
            agentLocation={agentLocation || undefined}
            userLocation={userLocation || undefined}
            showRoute={true}
            onDistanceCalculated={(dist, etaMinutes) => {
              setDistance(dist);
              setEta(etaMinutes);
            }}
            height="400px"
          />
          {distance !== null && eta !== null && agentLocation ? (
            <div className="mt-3 rounded-lg border border-blue-500/50 bg-blue-900/20 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">Responder distance:</span>
                <span className="font-semibold text-white">{distance.toFixed(1)} km</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-gray-300">Estimated arrival:</span>
                <span className="font-semibold text-white">{eta} min</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-5 space-y-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-white">Service Timers</h3>
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Elapsed Time</span>
                  <span className="font-mono text-base font-bold text-white">
                    {formatTime(elapsedTime)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((elapsedTime / 600) * 100, 100)}%` }}
                    className="h-full bg-[#ff6b3d]"
                  ></motion.div>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <AlertCircle className="h-3 w-3" />
                    SLA Timer
                  </span>
                  <span
                    className={`font-mono text-base font-bold ${
                      slaTimer < 60 ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {formatTime(slaTimer)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
                  <motion.div
                    animate={{ width: `${(slaTimer / 480) * 100}%` }}
                    className={`h-full ${slaTimer < 60 ? "bg-red-500" : "bg-green-500"}`}
                  ></motion.div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-white">Responder Details</h3>
            <div className="space-y-2.5">
              <div>
                <p className="text-xs text-gray-400">Name</p>
                <p className="text-sm font-medium text-white">{agent.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Vehicle Number</p>
                <p className="text-sm font-medium text-white">{agent.vehicleNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Estimated Arrival</p>
                <p className="text-sm font-medium text-white">{agent.eta}</p>
              </div>
              <a
                href={`tel:${agent.phone}`}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff6b3d] py-3 text-sm font-medium text-white transition-colors hover:bg-[#ff5722]"
              >
                <Phone className="h-4 w-4" />
                Call Responder
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-red-500/50 bg-red-900/30 p-3">
          <p className="text-xs text-red-200">
            <strong>Safety First:</strong> If you have medical injuries or require emergency
            medical services, please contact 911 or your local emergency hotline immediately.
          </p>
        </div>
      </main>
    </div>
  );
}
