import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
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

interface Props {
  dispatchId: string;
  motoristLocation: { latitude: number; longitude: number };
  motoristName?: string;
  motoristUserId?: string | null;
}

export const MotorietTrackingScreen: React.FC<Props> = ({
  dispatchId,
  motoristLocation,
  motoristName = "Motorist",
  motoristUserId,
}) => {
  const [dispatch, setDispatch] = useState<DispatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [agentLocation, setAgentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
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
    timeliness: 0,
    professionalism: 0,
    serviceQuality: 0,
  });
  const [comment, setComment] = useState("");
  const mapRef = useRef<MapView>(null);
  const trackedMotoristLocation = dispatch?.motorist
    ? {
        latitude: dispatch.motorist.latitude,
        longitude: dispatch.motorist.longitude,
      }
    : motoristLocation;

  useEffect(() => {
    let active = true;

    const loadDispatch = async () => {
      try {
        const details = await fetchDispatchDetails(dispatchId);
        if (!active) return;

        setDispatch(details);
        setError(null);

        if (details.agent?.currentLatitude != null && details.agent?.currentLongitude != null) {
          setAgentLocation({
            latitude: details.agent.currentLatitude,
            longitude: details.agent.currentLongitude,
          });
        }
      } catch (err) {
        if (!active) return;
        setError(err as Error);
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
    if (!agentLocation) {
      setRoute([]);
      return;
    }

    const dist = calculateDistance(
      trackedMotoristLocation.latitude,
      trackedMotoristLocation.longitude,
      agentLocation.latitude,
      agentLocation.longitude,
    );
    setDistance(dist);
    setEta(`${Math.ceil((dist / 30) * 60)} min`);

    const loadRoute = async () => {
      try {
        const routeData = await getRoute(
          [trackedMotoristLocation.latitude, trackedMotoristLocation.longitude],
          [agentLocation.latitude, agentLocation.longitude],
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
      } catch (err) {
        console.warn("Route fetch failed, using straight line fallback:", err);
      }

      setRoute([trackedMotoristLocation, agentLocation]);
    };

    void loadRoute();
  }, [agentLocation, trackedMotoristLocation]);

  useEffect(() => {
    if (!mapRef.current || !agentLocation) return;

    mapRef.current.fitToCoordinates([trackedMotoristLocation, agentLocation], {
      edgePadding: { top: 80, right: 60, bottom: 220, left: 60 },
      animated: true,
    });
  }, [agentLocation, trackedMotoristLocation]);

  useEffect(() => {
    if (dispatch?.dispatchStatus === "completed") {
      setReviewOpen(true);
    }
  }, [dispatch?.dispatchStatus]);

  useEffect(() => {
    if (dispatch?.dispatchStatus !== "completed" || !motoristUserId) {
      return;
    }

    let active = true;

    const loadFeedback = async () => {
      try {
        const [ownFeedback, thread] = await Promise.all([
          fetchDispatchFeedback(dispatchId, motoristUserId, "motorist"),
          fetchDispatchFeedbackThread(dispatchId, motoristUserId, "motorist"),
        ]);

        if (!active) return;
        setExistingFeedback(ownFeedback);
        setFeedbackThread(thread.feedback);
        setFeedbackError(null);

        if (ownFeedback) {
          setOverallRating(ownFeedback.overallRating);
          setCategoryRatings({
            timeliness: ownFeedback.categoryRatings.timeliness ?? 0,
            professionalism: ownFeedback.categoryRatings.professionalism ?? 0,
            serviceQuality: ownFeedback.categoryRatings.serviceQuality ?? 0,
          });
          setComment(ownFeedback.comment ?? "");
        }
      } catch (loadError) {
        if (!active) return;
        console.warn("Failed to load dispatch feedback:", loadError);
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
  }, [dispatch?.dispatchStatus, dispatchId, motoristUserId]);

  const handleFeedbackSubmit = async () => {
    if (!motoristUserId) {
      setFeedbackError("Unable to identify the motorist account for this review.");
      return;
    }

    if (
      overallRating < 1 ||
      categoryRatings.timeliness < 1 ||
      categoryRatings.professionalism < 1 ||
      categoryRatings.serviceQuality < 1
    ) {
      setFeedbackError("Please complete all ratings before submitting your review.");
      return;
    }

    try {
      setFeedbackSubmitting(true);
      setFeedbackError(null);

      const saved = await submitDispatchFeedback(dispatchId, {
        reviewerUserId: motoristUserId,
        reviewerRole: "motorist",
        overallRating,
        categoryRatings,
        comment: comment.trim(),
      });

      setExistingFeedback(saved);
      const thread = await fetchDispatchFeedbackThread(dispatchId, motoristUserId, "motorist");
      setFeedbackThread(thread.feedback);
    } catch (submitError) {
      console.error("Failed to submit feedback:", submitError);
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
          <Text style={styles.loadingText}>Loading dispatch...</Text>
        </View>
      </View>
    );
  }

  if (error || !dispatch) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading dispatch</Text>
          <Text style={styles.errorSubtext}>{error?.message}</Text>
        </View>
      </View>
    );
  }

  const motoristReview = feedbackThread.find((item) => item.reviewerRole === "motorist") ?? existingFeedback;
  const agentReview = feedbackThread.find((item) => item.reviewerRole === "agent") ?? null;
  const canSubmitReview = !existingFeedback;
  const payment = dispatch.payment;

  if (dispatch.dispatchStatus === "completed") {
    return (
      <View style={styles.container}>
        <View style={[styles.completedMapWrap, mapMinimized && styles.completedMapWrapMinimized]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: trackedMotoristLocation.latitude,
              longitude: trackedMotoristLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker
              coordinate={trackedMotoristLocation}
              title="Your Location"
              pinColor="#fb923c"
              description={dispatch.motorist?.fullName || motoristName}
            />

            {agentLocation ? (
              <Marker
                coordinate={agentLocation}
                title="Rescue Responder"
                pinColor="#22c55e"
                description={dispatch.agent?.fullName || dispatch.agent?.businessName || "Responder"}
              />
            ) : null}

            {route.length > 1 ? <Polyline coordinates={route} strokeWidth={3} strokeColor="#3b82f6" /> : null}
          </MapView>

          <Pressable
            style={styles.minimizeButton}
            onPress={() => setMapMinimized((current) => !current)}
          >
            <Text style={styles.minimizeButtonText}>{mapMinimized ? "Expand Map" : "Minimize Map"}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.completedPanel} contentContainerStyle={styles.completedPanelContent}>
          <View style={[styles.statusBar, getStatusColor(dispatch.dispatchStatus)]}>
            <Text style={styles.statusTitle}>Service Completed</Text>
            <Text style={styles.statusSubtext}>
              Your job is complete. You can now access the feedback review for this responder.
            </Text>
          </View>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>Service Summary</Text>
            <Text style={styles.reviewMeta}>Responder: {dispatch.agent?.fullName || dispatch.agent?.businessName || "Responder"}</Text>
            <Text style={styles.reviewMeta}>Distance covered: {distance.toFixed(1)} km</Text>
            <Text style={styles.reviewMeta}>Status: Completed</Text>
          </View>

          {payment ? (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>KalsadaKonek Payment</Text>
              <Text style={styles.reviewHint}>
                Scan this sample QR for now. Replace it later with your real payment QR when you are ready.
              </Text>
              <View style={styles.paymentLayout}>
                <SampleQr />
                <View style={styles.paymentSummary}>
                  <Text style={styles.summaryHeading}>Payment breakdown</Text>
                  <Text style={styles.summaryLine}>Total payment: {formatPeso(payment.totalAmount)}</Text>
                  <Text style={styles.summaryLine}>Responder service fee: {formatPeso(payment.serviceAmount)}</Text>
                  <Text style={styles.summaryLine}>KalsadaKonek commission: {formatPeso(payment.commissionAmount)}</Text>
                  <Text style={styles.summaryLine}>
                    Commission rate: {Math.round(payment.commissionRate * 100)}%
                    {payment.subscriptionStatus === "active" ? " for subscribed motorists" : " for non-subscribed motorists"}
                  </Text>
                  <Text style={styles.summaryComment}>
                    {payment.subscriptionStatus === "active"
                      ? "This completed service used the lower 5% subscriber commission."
                      : "Free motorists are charged the 20% commission. Subscribing lowers it to 5% on future services."}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.reviewCard}>
            <View style={styles.reviewHeaderRow}>
              <Text style={styles.reviewTitle}>Feedback Review</Text>
              <Pressable style={styles.linkButton} onPress={() => setReviewOpen((current) => !current)}>
                <Text style={styles.linkButtonText}>{reviewOpen ? "Hide" : "Open"}</Text>
              </Pressable>
            </View>

            {!reviewOpen ? (
              <Text style={styles.reviewHint}>Tap Open to rate the responder or check submitted feedback.</Text>
            ) : canSubmitReview ? (
              <>
                <Text style={styles.reviewHint}>Rate the rescue responder before leaving this completed job.</Text>
                <RatingRow
                  label="Overall experience"
                  value={overallRating}
                  onChange={setOverallRating}
                />
                <RatingRow
                  label="Arrival time"
                  value={categoryRatings.timeliness}
                  onChange={(value) => setCategoryRatings((current) => ({ ...current, timeliness: value }))}
                />
                <RatingRow
                  label="Professionalism"
                  value={categoryRatings.professionalism}
                  onChange={(value) => setCategoryRatings((current) => ({ ...current, professionalism: value }))}
                />
                <RatingRow
                  label="Service quality"
                  value={categoryRatings.serviceQuality}
                  onChange={(value) => setCategoryRatings((current) => ({ ...current, serviceQuality: value }))}
                />
                <Text style={styles.inputLabel}>Comment</Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Share your experience with the responder"
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
                <Text style={styles.successText}>Your service review has been submitted.</Text>
                {motoristReview ? (
                  <View style={styles.feedbackSummary}>
                    <Text style={styles.summaryHeading}>Your review</Text>
                    <Text style={styles.summaryLine}>Overall: {renderStarsText(motoristReview.overallRating)}</Text>
                    <Text style={styles.summaryLine}>
                      Arrival time: {renderStarsText(motoristReview.categoryRatings.timeliness ?? 0)}
                    </Text>
                    <Text style={styles.summaryLine}>
                      Professionalism: {renderStarsText(motoristReview.categoryRatings.professionalism ?? 0)}
                    </Text>
                    <Text style={styles.summaryLine}>
                      Service quality: {renderStarsText(motoristReview.categoryRatings.serviceQuality ?? 0)}
                    </Text>
                    <Text style={styles.summaryComment}>
                      {motoristReview.comment || "No additional comment was added."}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.feedbackSummary}>
                  <Text style={styles.summaryHeading}>Responder feedback</Text>
                  <Text style={styles.summaryComment}>
                    {agentReview
                      ? agentReview.comment || "The responder submitted a review without additional notes."
                      : "No responder feedback has been shared yet."}
                  </Text>
                </View>
              </>
            )}
          </View>
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
          latitude: trackedMotoristLocation.latitude,
          longitude: trackedMotoristLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={trackedMotoristLocation}
          title="Your Location"
          pinColor="#fb923c"
          description={dispatch?.motorist?.fullName || motoristName}
        />

        {agentLocation ? (
          <Marker
            coordinate={agentLocation}
            title="Rescue Responder"
            pinColor="#22c55e"
            description={dispatch.agent?.fullName || dispatch.agent?.businessName || "Responder"}
          />
        ) : null}

        {route.length > 1 ? <Polyline coordinates={route} strokeWidth={3} strokeColor="#3b82f6" /> : null}
      </MapView>

      <View style={[styles.statusBar, getStatusColor(dispatch.dispatchStatus)]}>
        <Text style={styles.statusTitle}>{getStatusText(dispatch.dispatchStatus)}</Text>
        <Text style={styles.statusSubtext}>
          {dispatch.dispatchStatus === "pending" && "Waiting for responder to accept..."}
          {dispatch.dispatchStatus === "accepted" && `${distance.toFixed(1)} km away, ETA ${eta}`}
          {dispatch.dispatchStatus === "arrived" && "Your responder has arrived."}
          {dispatch.dispatchStatus === "completed" && "Service completed"}
          {dispatch.dispatchStatus === "declined" && "Request declined. Please try another responder."}
        </Text>
      </View>

      {agentLocation && (dispatch.dispatchStatus === "accepted" || dispatch.dispatchStatus === "arrived") ? (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Distance:</Text>
            <Text style={styles.infoValue}>{distance.toFixed(1)} km</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ETA:</Text>
            <Text style={styles.infoValue}>{eta}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, { color: "#22c55e" }]}>
              {dispatch.dispatchStatus === "arrived" ? "Arrived" : "On the way"}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

function formatPeso(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function SampleQr() {
  const cells = [
    "111111100100111111",
    "100000101110100001",
    "101110100010101111",
    "101110101110101111",
    "101110100010101111",
    "100000101110100001",
    "111111101010111111",
    "000000001001000000",
    "111011111010111001",
    "001100010101001110",
    "110011101110110010",
    "010101000011100101",
    "111011111010101111",
    "000000001110000000",
    "111111101001111111",
    "100000100111100001",
    "101110101001101111",
    "100000101110100001",
  ];

  return (
    <View style={styles.qrWrap}>
      {cells.map((row, rowIndex) => (
        <View key={`qr-row-${rowIndex}`} style={styles.qrRow}>
          {row.split("").map((cell, cellIndex) => (
            <View
              key={`qr-cell-${rowIndex}-${cellIndex}`}
              style={[styles.qrCell, cell === "1" ? styles.qrCellDark : styles.qrCellLight]}
            />
          ))}
        </View>
      ))}
      <Text style={styles.qrCaption}>Sample QR</Text>
    </View>
  );
}

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
            <Text style={[styles.starText, star <= value && styles.starTextActive]}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function renderStarsText(value: number) {
  if (!value) {
    return "0/5";
  }

  return `${"★".repeat(value)}${"☆".repeat(Math.max(0, 5 - value))} (${value}/5)`;
}

function getStatusText(status: string | undefined): string {
  switch (status) {
    case "pending":
      return "Request Pending";
    case "accepted":
      return "Responder Accepted";
    case "arrived":
      return "Responder Arrived";
    case "completed":
      return "Service Completed";
    case "declined":
      return "Request Declined";
    default:
      return "Loading...";
  }
}

function getStatusColor(status: string | undefined) {
  switch (status) {
    case "pending":
      return { backgroundColor: "#fef3c7" };
    case "accepted":
      return { backgroundColor: "#dcfce7" };
    case "arrived":
      return { backgroundColor: "#dbeafe" };
    case "completed":
      return { backgroundColor: "#dcfce7" };
    case "declined":
      return { backgroundColor: "#fee2e2" };
    default:
      return { backgroundColor: "#f5f5f5" };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  map: {
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },
  errorSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  statusSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
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
  reviewHint: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 19,
  },
  paymentLayout: {
    marginTop: 14,
    gap: 16,
    alignItems: "center",
  },
  paymentSummary: {
    width: "100%",
  },
  qrWrap: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  qrRow: {
    flexDirection: "row",
  },
  qrCell: {
    width: 8,
    height: 8,
  },
  qrCellDark: {
    backgroundColor: "#020617",
  },
  qrCellLight: {
    backgroundColor: "#ffffff",
  },
  qrCaption: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
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
});
