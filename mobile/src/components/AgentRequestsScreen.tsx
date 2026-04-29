import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAgentRequests } from "../hooks/useRealTimeListeners";
import { acceptRequest, declineRequest } from "../lib/firebaseHelpers";

/**
 * AGENT ACTIVE REQUESTS SCREEN
 *
 * Shows all pending requests in real-time
 * When motorist sends request → appears instantly (no polling delay)
 *
 * Real-time flow:
 * 1. Agent app opens → listener starts with onSnapshot()
 * 2. Motorist sends request → Firebase writes document
 * 3. onSnapshot fires immediately → requests state updates
 * 4. UI re-renders with new request
 */
interface RescueRequest {
  id: string;
  motoristId: string;
  motoristName: string;
  serviceType: string;
  issue: string;
  motoristLocation: {
    latitude: number;
    longitude: number;
  };
  createdAt: any;
}

interface Props {
  agentId: string;
  onAcceptRequest?: (requestId: string) => void;
}

export const AgentRequestsScreen: React.FC<Props> = ({ agentId, onAcceptRequest }) => {
  // Real-time listener - updates instantly when requests change
  const { requests, loading, error } = useAgentRequests(agentId);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const handleAccept = async (requestId: string) => {
    try {
      setAccepting(true);
      await acceptRequest(requestId, agentId);

      // This change will be reflected in motorist's listener immediately
      Alert.alert("Success", "Request accepted! You're on the way.");

      if (onAcceptRequest) {
        onAcceptRequest(requestId);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to accept request. Please try again.");
      console.error(err);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      setDeclining(true);
      await declineRequest(requestId);
      Alert.alert("Success", "Request declined.");
    } catch (err) {
      Alert.alert("Error", "Failed to decline request.");
      console.error(err);
    } finally {
      setDeclining(false);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading requests: {error.message}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Listening for requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending requests</Text>
          <Text style={styles.emptySubtext}>You'll see requests here instantly</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: RescueRequest }) => (
            <RequestCard
              request={item}
              onAccept={() => handleAccept(item.id)}
              onDecline={() => handleDecline(item.id)}
              isLoading={accepting || declining}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

interface RequestCardProps {
  request: RescueRequest;
  onAccept: () => void;
  onDecline: () => void;
  isLoading: boolean;
}

const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onAccept,
  onDecline,
  isLoading,
}) => {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.motoristName}>{request.motoristName}</Text>
        <Text style={styles.time}>
          {new Date(request.createdAt?.toDate?.()).toLocaleTimeString()}
        </Text>
      </View>

      {/* Details */}
      <View style={styles.detailsContainer}>
        <DetailRow label="Service" value={request.serviceType} />
        <DetailRow label="Issue" value={request.issue} />
        <DetailRow
          label="Location"
          value={`${request.motoristLocation.latitude.toFixed(4)}, ${request.motoristLocation.longitude.toFixed(4)}`}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.declineButton, isLoading && styles.disabledButton]}
          onPress={onDecline}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ef4444" size="small" />
          ) : (
            <Text style={styles.declineButtonText}>Decline</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptButton, isLoading && styles.disabledButton]}
          onPress={onAccept}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept & Go</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
  },
  listContent: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
  },
  motoristName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
  detailsContainer: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
    width: 60,
  },
  detailValue: {
    fontSize: 12,
    color: "#333",
    flex: 1,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 8,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#ef4444",
    backgroundColor: "#fff5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  disabledButton: {
    opacity: 0.6,
  },
});
