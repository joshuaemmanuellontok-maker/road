import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import {
  calculateDistance,
  fetchDispatchDetails,
  fetchDispatchFeedback,
  fetchDispatchFeedbackThread,
  getRoute,
  submitDispatchFeedback,
  type DispatchDetails,
  type DispatchFeedback,
} from "../lib/roadresqApi";

type AgentNavStatus = "en-route" | "arrived" | "working";

interface Props {
  dispatchId: string;
  agentLocation: { latitude: number; longitude: number };
  agentUserId?: string | null;
  agentName?: string;
  fee: string;
  feeDraft: string;
  editingFee: boolean;
  navStatus: AgentNavStatus;
  onBack: () => void;
  onNavStatusChange: (status: AgentNavStatus) => void;
  onFeeDraftChange: (value: string) => void;
  onToggleEditFee: () => void;
  onCompleteJob: () => void;
  onDeclineJob: () => void;
}

export const AgentTrackingScreen: React.FC<Props> = ({
  dispatchId,
  agentLocation,
  agentUserId,
  agentName = "Responder",
  fee,
  feeDraft,
  editingFee,
  navStatus,
  onBack,
  onNavStatusChange,
  onFeeDraftChange,
  onToggleEditFee,
  onCompleteJob,
  onDeclineJob,
}) => {
  const [dispatch, setDispatch] = useState<DispatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [route, setRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState("--");
  const [mapMinimized, setMapMinimized] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [existingFeedback, setExistingFeedback] = useState<DispatchFeedback | null>(null);
  const [feedbackThread, setFeedbackThread] = useState<DispatchFeedback[]>([]);
  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState({
    communication: 0,
    cooperation: 0,
    paymentExperience: 0,
  });
  const [paidCorrectAmount, setPaidCorrectAmount] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const mapRef = useRef<MapView>(null);

  const motoristLocation = dispatch?.motorist
    ? {
        latitude: dispatch.motorist.latitude,
        longitude: dispatch.motorist.longitude,
      }
    : null;

  useEffect(() => {
    let active = true;

    const loadDispatch = async () => {
      try {
        const details = await fetchDispatchDetails(dispatchId);
        if (!active) return;
        setDispatch(details);
        setError(null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError as Error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDispatch();
    const interval = setInterval(() => {
      void loadDispatch();
    }, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [dispatchId]);

  useEffect(() => {
    if (!motoristLocation) {
      setRoute([]);
      return;
    }

    const nextDistance = calculateDistance(
      agentLocation.latitude,
      agentLocation.longitude,
      motoristLocation.latitude,
      motoristLocation.longitude,
    );
    setDistance(nextDistance);
    setEta(`${Math.ceil((nextDistance / 30) * 60)} min`);

    const loadRoute = async () => {
      try {
        const routeData = await getRoute(
          [agentLocation.latitude, agentLocation.longitude],
          [motoristLocation.latitude, motoristLocation.longitude],
        );

        if (routeData?.geometry?.length) {
          setRoute(
            routeData.geometry.map((coord) => ({
              latitude: coord[0],
              longitude: coord[1],
            })),
          );
          return;
        }
      } catch (routeError) {
        console.warn("Responder route fetch failed, using straight line fallback:", routeError);
      }

      setRoute([agentLocation, motoristLocation]);
    };

    void loadRoute();
  }, [agentLocation, motoristLocation]);

  useEffect(() => {
    if (!mapRef.current || !motoristLocation) return;

    mapRef.current.fitToCoordinates([agentLocation, motoristLocation], {
      edgePadding: { top: 80, right: 60, bottom: 220, left: 60 },
      animated: true,
    });
  }, [agentLocation, motoristLocation]);

  useEffect(() => {
    if (dispatch?.dispatchStatus === "completed") {
      setReviewOpen(true);
    }
  }, [dispatch?.dispatchStatus]);

  useEffect(() => {
    if (dispatch?.dispatchStatus !== "completed" || !agentUserId) {
      return;
    }

    let active = true;

    const loadFeedback = async () => {
      try {
        const [ownFeedback, thread] = await Promise.all([
          fetchDispatchFeedback(dispatchId, agentUserId, "agent"),
          fetchDispatchFeedbackThread(dispatchId, agentUserId, "agent"),
        ]);

        if (!active) return;
        setExistingFeedback(ownFeedback);
        setFeedbackThread(thread.feedback);
        setFeedbackError(null);

        if (ownFeedback) {
          setOverallRating(ownFeedback.overallRating);
          setCategoryRatings({
            communication: ownFeedback.categoryRatings.communication ?? 0,
            cooperation: ownFeedback.categoryRatings.cooperation ?? 0,
            paymentExperience: ownFeedback.categoryRatings.paymentExperience ?? 0,
          });
          setPaidCorrectAmount(ownFeedback.paidCorrectAmount);
          setComment(ownFeedback.comment ?? "");
        }
      } catch (loadError) {
        if (!active) return;
        console.warn("Failed to load responder feedback:", loadError);
      }
    };

    void loadFeedback();
    const interval = setInterval(() => {
      void loadFeedback();
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [agentUserId, dispatch?.dispatchStatus, dispatchId]);

  const handleFeedbackSubmit = async () => {
    if (!agentUserId) {
      setFeedbackError("Unable to identify the responder account for this review.");
      return;
    }

    if (
      overallRating < 1 ||
      categoryRatings.communication < 1 ||
      categoryRatings.cooperation < 1 ||
      categoryRatings.paymentExperience < 1 ||
      paidCorrectAmount === null
    ) {
      setFeedbackError("Please complete all ratings and payment confirmation before submitting.");
      return;
    }

    try {
      setFeedbackSubmitting(true);
      setFeedbackError(null);

      const saved = await submitDispatchFeedback(dispatchId, {
        reviewerUserId: agentUserId,
        reviewerRole: "agent",
        overallRating,
        categoryRatings,
        paidCorrectAmount,
        comment: comment.trim(),
      });

      setExistingFeedback(saved);
      const thread = await fetchDispatchFeedbackThread(dispatchId, agentUserId, "agent");
      setFeedbackThread(thread.feedback);
    } catch (submitError) {
      console.error("Failed to submit responder feedback:", submitError);
      setFeedbackError(submitError instanceof Error ? submitError.message : "Failed to submit feedback.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading navigation...</Text>
        </View>
      </View>
    );
  }

  if (error || !dispatch || !motoristLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading dispatch</Text>
          <Text style={styles.errorSubtext}>{error?.message}</Text>
        </View>
      </View>
    );
  }

  const motoristReview = feedbackThread.find((item) => item.reviewerRole === "motorist") ?? null;
  const agentReview = feedbackThread.find((item) => item.reviewerRole === "agent") ?? existingFeedback;
  const canSubmitReview = !existingFeedback;
  const isCompleted = dispatch.dispatchStatus === "completed";

  if (isCompleted) {
    return (
      <View style={styles.container}>
        <View style={[styles.completedMapWrap, mapMinimized && styles.completedMapWrapMinimized]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: motoristLocation.latitude,
              longitude: motoristLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker coordinate={motoristLocation} title="Motorist" pinColor="#fb923c" />
            <Marker coordinate={agentLocation} title="Responder" pinColor="#22c55e" description={agentName} />
            {route.length > 1 ? <Polyline coordinates={route} strokeWidth={3} strokeColor="#3b82f6" /> : null}
          </MapView>

          <Pressable style={styles.minimizeButton} onPress={() => setMapMinimized((current) => !current)}>
            <Text style={styles.minimizeButtonText}>{mapMinimized ? "Expand Map" : "Minimize Map"}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.completedPanel} contentContainerStyle={styles.completedPanelContent}>
          <View style={[styles.statusBar, styles.completedStatusBar]}>
            <Text style={styles.statusTitle}>Job Completed</Text>
            <Text style={styles.statusSubtext}>
              The rescue job is complete. Review the motorist and keep the experience smooth like a ride app handoff.
            </Text>
          </View>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>Service Summary</Text>
            <Text style={styles.reviewMeta}>Motorist: {dispatch.motorist.fullName}</Text>
            <Text style={styles.reviewMeta}>Distance covered: {distance.toFixed(1)} km</Text>
            <Text style={styles.reviewMeta}>Final fee: {fee}</Text>
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.reviewHeaderRow}>
              <Text style={styles.reviewTitle}>Feedback Review</Text>
              <Pressable style={styles.linkButton} onPress={() => setReviewOpen((current) => !current)}>
                <Text style={styles.linkButtonText}>{reviewOpen ? "Hide" : "Open"}</Text>
              </Pressable>
            </View>

            {!reviewOpen ? (
              <Text style={styles.reviewHint}>Open the feedback panel to review the motorist.</Text>
            ) : canSubmitReview ? (
              <>
                <Text style={styles.reviewHint}>Rate the motorist before leaving this completed job.</Text>
                <RatingRow label="Overall experience" value={overallRating} onChange={setOverallRating} />
                <RatingRow
                  label="Communication"
                  value={categoryRatings.communication}
                  onChange={(value) => setCategoryRatings((current) => ({ ...current, communication: value }))}
                />
                <RatingRow
                  label="Cooperation"
                  value={categoryRatings.cooperation}
                  onChange={(value) => setCategoryRatings((current) => ({ ...current, cooperation: value }))}
                />
                <RatingRow
                  label="Payment experience"
                  value={categoryRatings.paymentExperience}
                  onChange={(value) => setCategoryRatings((current) => ({ ...current, paymentExperience: value }))}
                />
                <Text style={styles.inputLabel}>Did the motorist pay the correct amount?</Text>
                <View style={styles.paymentRow}>
                  <Pressable
                    style={[styles.paymentChoice, paidCorrectAmount === true && styles.paymentChoiceActive]}
                    onPress={() => setPaidCorrectAmount(true)}
                  >
                    <Text style={[styles.paymentChoiceText, paidCorrectAmount === true && styles.paymentChoiceTextActive]}>
                      Yes
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.paymentChoice, paidCorrectAmount === false && styles.paymentChoiceDanger]}
                    onPress={() => setPaidCorrectAmount(false)}
                  >
                    <Text style={[styles.paymentChoiceText, paidCorrectAmount === false && styles.paymentChoiceTextDanger]}>
                      No
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.inputLabel}>Comment</Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Add quick notes about payment, cooperation, or communication"
                  placeholderTextColor="#94a3b8"
                  multiline
                  style={styles.commentInput}
                />
                {feedbackError ? <Text style={styles.feedbackError}>{feedbackError}</Text> : null}
                <Pressable
                  style={[styles.submitButton, feedbackSubmitting && styles.buttonDisabled]}
                  onPress={() => void handleFeedbackSubmit()}
                  disabled={feedbackSubmitting}
                >
                  <Text style={styles.submitButtonText}>
                    {feedbackSubmitting ? "Submitting..." : "Submit Review"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.successText}>Your motorist review has been submitted.</Text>
                {agentReview ? (
                  <View style={styles.feedbackSummary}>
                    <Text style={styles.summaryHeading}>Your review</Text>
                    <Text style={styles.summaryLine}>Overall: {renderStarsText(agentReview.overallRating)}</Text>
                    <Text style={styles.summaryLine}>
                      Communication: {renderStarsText(agentReview.categoryRatings.communication ?? 0)}
                    </Text>
                    <Text style={styles.summaryLine}>
                      Cooperation: {renderStarsText(agentReview.categoryRatings.cooperation ?? 0)}
                    </Text>
                    <Text style={styles.summaryLine}>
                      Payment experience: {renderStarsText(agentReview.categoryRatings.paymentExperience ?? 0)}
                    </Text>
                    <Text style={styles.summaryLine}>
                      Paid correctly: {agentReview.paidCorrectAmount ? "Yes" : "No"}
                    </Text>
                    <Text style={styles.summaryComment}>
                      {agentReview.comment || "No additional notes were added."}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.feedbackSummary}>
                  <Text style={styles.summaryHeading}>Motorist feedback</Text>
                  <Text style={styles.summaryComment}>
                    {motoristReview
                      ? motoristReview.comment || "The motorist submitted a review without additional notes."
                      : "No motorist feedback has been shared yet."}
                  </Text>
                </View>
              </>
            )}
          </View>

          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back to Requests</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: motoristLocation.latitude,
          longitude: motoristLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker coordinate={motoristLocation} title="Motorist" pinColor="#fb923c" />
        <Marker coordinate={agentLocation} title="Responder" pinColor="#22c55e" description={agentName} />
        {route.length > 1 ? <Polyline coordinates={route} strokeWidth={3} strokeColor="#3b82f6" /> : null}
      </MapView>

      <View style={styles.statusBar}>
        <Text style={styles.statusTitle}>Live Navigation</Text>
        <Text style={styles.statusSubtext}>
          Head to {dispatch.motorist.fullName}. Keep the map center-stage while the job is active.
        </Text>
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <View style={styles.doubleRow}>
          <MiniStat label="Distance" value={`${distance.toFixed(1)} km`} />
          <MiniStat label="ETA" value={eta} accent />
        </View>

        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>Motorist Details</Text>
          <Text style={styles.reviewMeta}>{dispatch.motorist.fullName}</Text>
          <Text style={styles.reviewMeta}>{dispatch.motorist.issueSummary || dispatch.motorist.locationLabel}</Text>
          <Text style={styles.reviewMeta}>Phone {dispatch.motorist.phone}</Text>
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewHeaderRow}>
            <View>
              <Text style={styles.reviewTitle}>Estimated Fee</Text>
              {editingFee ? (
                <TextInput value={feeDraft} onChangeText={onFeeDraftChange} style={styles.feeInput} />
              ) : (
                <Text style={styles.feeValue}>{fee}</Text>
              )}
            </View>
            <Pressable style={styles.linkButton} onPress={onToggleEditFee}>
              <Text style={styles.linkButtonText}>{editingFee ? "Save Fee" : "Edit Fee"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>Trip Stage</Text>
          <View style={styles.stageRow}>
            {(["en-route", "arrived", "working"] as AgentNavStatus[]).map((status) => (
              <Pressable
                key={status}
                style={[styles.stageChip, navStatus === status && styles.stageChipActive]}
                onPress={() => onNavStatusChange(status)}
              >
                <Text style={[styles.stageChipText, navStatus === status && styles.stageChipTextActive]}>
                  {status === "en-route" ? "En Route" : status === "arrived" ? "Arrived" : "Working"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.declineButton} onPress={onDeclineJob}>
            <Text style={styles.declineButtonText}>Decline Request</Text>
          </Pressable>
          {navStatus === "working" ? (
            <Pressable style={styles.completeButton} onPress={onCompleteJob}>
              <Text style={styles.completeButtonText}>Mark Job Completed</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.ratingBlock}>
      <View style={styles.reviewHeaderRow}>
        <Text style={styles.ratingLabel}>{label}</Text>
        <Text style={styles.ratingValue}>{value}/5</Text>
      </View>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={`${label}-${star}`} style={styles.starButton} onPress={() => onChange(star)}>
            <Text style={[styles.starText, star <= value && styles.starTextActive]}>*</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function renderStarsText(value: number) {
  return value ? `${value}/5` : "0/5";
}

function MiniStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, accent && styles.miniValueAccent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  map: {
    flex: 1,
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "white",
  },
  completedStatusBar: {
    backgroundColor: "#dcfce7",
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  statusSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: "#4b5563",
    lineHeight: 18,
  },
  panel: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  panelContent: {
    paddingBottom: 24,
  },
  completedMapWrap: {
    height: "42%",
  },
  completedMapWrapMinimized: {
    height: 180,
  },
  completedPanel: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  completedPanelContent: {
    paddingBottom: 24,
  },
  minimizeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  minimizeButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  doubleRow: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
  },
  miniCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  miniLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  miniValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  miniValueAccent: {
    color: "#ea580c",
  },
  reviewCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  reviewMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#475569",
  },
  reviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  feeInput: {
    marginTop: 8,
    minWidth: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#0f172a",
  },
  feeValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "800",
    color: "#ea580c",
  },
  linkButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
  },
  linkButtonText: {
    color: "#0369a1",
    fontSize: 12,
    fontWeight: "700",
  },
  stageRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  stageChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    alignItems: "center",
  },
  stageChipActive: {
    borderColor: "#ea580c",
    backgroundColor: "#fff7ed",
  },
  stageChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  stageChipTextActive: {
    color: "#c2410c",
  },
  completeButton: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    alignItems: "center",
  },
  declineButton: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fda4af",
    paddingVertical: 14,
    alignItems: "center",
  },
  declineButtonText: {
    color: "#be123c",
    fontSize: 14,
    fontWeight: "800",
  },
  completeButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },
  reviewHint: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 19,
  },
  ratingBlock: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f97316",
  },
  starRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  starButton: {
    marginRight: 10,
  },
  starText: {
    fontSize: 28,
    color: "#cbd5e1",
  },
  starTextActive: {
    color: "#f97316",
  },
  inputLabel: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  paymentRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  paymentChoice: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    alignItems: "center",
  },
  paymentChoiceActive: {
    borderColor: "#16a34a",
    backgroundColor: "#dcfce7",
  },
  paymentChoiceDanger: {
    borderColor: "#dc2626",
    backgroundColor: "#fee2e2",
  },
  paymentChoiceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  paymentChoiceTextActive: {
    color: "#166534",
  },
  paymentChoiceTextDanger: {
    color: "#991b1b",
  },
  commentInput: {
    marginTop: 8,
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#0f172a",
    textAlignVertical: "top",
  },
  feedbackError: {
    marginTop: 10,
    color: "#dc2626",
    fontSize: 12,
  },
  submitButton: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#ea580c",
    paddingVertical: 14,
    alignItems: "center",
  },
  submitButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  successText: {
    marginTop: 12,
    color: "#15803d",
    fontSize: 13,
    fontWeight: "700",
  },
  feedbackSummary: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  summaryLine: {
    marginTop: 8,
    fontSize: 12,
    color: "#334155",
  },
  summaryComment: {
    marginTop: 8,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  backButton: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    alignItems: "center",
  },
  backButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#dc2626",
  },
  errorSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },
});
