import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { createRescueRequest, calculateDistance } from "../lib/firebaseHelpers";

/**
 * MOTORIST FIND RESCUE AGENT SCREEN
 *
 * Real-time matching flow:
 * 1. Motorist clicks "Find Rescue Agent"
 * 2. Get motorist's current GPS location
 * 3. Query nearby online agents from Firebase
 * 4. Select nearest agent
 * 5. Create request document in Firebase
 * 6. Agent's listener fires instantly → shows in their requests
 * 7. Motorist waits for agent to accept
 *
 * Key: No polling - Firebase real-time listener handles updates
 */

interface NearbyAgent {
  id: string;
  name: string;
  businessName: string;
  distance: number;
  location: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  status: "online" | "offline";
}

interface Props {
  motoristId: string;
  motoristName: string;
  serviceType: string;
  issue: string;
  onRequestCreated?: (requestId: string) => void;
}

export const MotorietFindAgentScreen: React.FC<Props> = ({
  motoristId,
  motoristName,
  serviceType,
  issue,
  onRequestCreated,
}) => {
  const [nearbyAgents, setNearbyAgents] = useState<NearbyAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<NearbyAgent | null>(null);
  const [motoristLocation, setMotoristLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Get motorist's current location on mount
  useEffect(() => {
    getMotorientLocation();
  }, []);

  const getMotorientLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location permission is required.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setMotoristLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error("Error getting motorist location:", error);
      Alert.alert("Error", "Could not get your location. Please enable GPS.");
    }
  };

  /**
   * Search for nearby agents in real-time
   * Queries Firebase for agents within 5km radius
   */
  const handleFindNearbyAgents = async () => {
    if (!motoristLocation) {
      Alert.alert("Error", "Could not determine your location.");
      return;
    }

    try {
      setSearching(true);

      // Call backend to get nearby agents
      const response = await fetch(
        `http://your-api.com/api/agents/nearby?lat=${motoristLocation.latitude}&lng=${motoristLocation.longitude}&radius=5`
      );

      if (!response.ok) {
        throw new Error("Failed to find nearby responders");
      }

      const agents = await response.json();

      if (agents.length === 0) {
        Alert.alert("No responders found", "Sorry, no responders available in your area right now.");
        setNearbyAgents([]);
        return;
      }

      // Transform data and calculate distances
      const formattedAgents = agents.map((agent: any) => ({
        id: agent.id,
        name: agent.name || "Unknown Responder",
        businessName: agent.business_name || agent.businessName || "",
        distance: agent.distance || calculateDistance(
          motoristLocation.latitude,
          motoristLocation.longitude,
          agent.location?.latitude || 0,
          agent.location?.longitude || 0
        ),
        location: agent.location || {
          latitude: agent.current_latitude || 0,
          longitude: agent.current_longitude || 0,
        },
        rating: agent.rating || 4.5,
        status: agent.status || "online",
      }));

      // Sort by distance (nearest first)
      formattedAgents.sort((a: NearbyAgent, b: NearbyAgent) => a.distance - b.distance);

      setNearbyAgents(formattedAgents);
    } catch (error) {
      console.error("Error finding nearby responders:", error);
      Alert.alert("Error", "Failed to search for nearby responders. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  /**
   * Send rescue request to selected agent
   * This creates a document in Firebase that triggers agent's listener
   */
  const handleRequestRescue = async (agent: NearbyAgent) => {
    if (!motoristLocation) {
      Alert.alert("Error", "Location required.");
      return;
    }

    try {
      setLoading(true);

      // Create rescue request in Firebase
      const requestId = await createRescueRequest(
        motoristId,
        agent.id,
        motoristLocation,
        motoristName,
        serviceType,
        issue
      );

      Alert.alert(
        "Request sent!",
        `Your request has been sent to ${agent.businessName}.\nWaiting for acceptance...`
      );

      if (onRequestCreated) {
        onRequestCreated(requestId);
      }
    } catch (error) {
      console.error("Error creating rescue request:", error);
      Alert.alert("Error", "Failed to send request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Location Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Location</Text>
        {motoristLocation ? (
          <View style={styles.locationBox}>
            <Text style={styles.locationText}>
              📍 {motoristLocation.latitude.toFixed(4)}, {motoristLocation.longitude.toFixed(4)}
            </Text>
          </View>
        ) : (
          <View style={styles.locationBox}>
            <ActivityIndicator size="small" color="#22c55e" />
            <Text style={styles.loadingText}>Getting your location...</Text>
          </View>
        )}
      </View>

      {/* Search Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.primaryButton, searching && styles.disabledButton]}
          onPress={handleFindNearbyAgents}
          disabled={searching || !motoristLocation}
        >
          {searching ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>🔍 Find Nearby Responders</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Nearby Agents List */}
      {nearbyAgents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Responders</Text>
          {nearbyAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={selectedAgent?.id === agent.id}
              onSelect={() => setSelectedAgent(agent)}
              onRequestRescue={() => handleRequestRescue(agent)}
              isLoading={loading}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

interface AgentCardProps {
  agent: NearbyAgent;
  isSelected: boolean;
  onSelect: () => void;
  onRequestRescue: () => void;
  isLoading: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isSelected,
  onSelect,
  onRequestRescue,
  isLoading,
}) => {
  return (
    <TouchableOpacity
      style={[styles.agentCard, isSelected && styles.selectedCard]}
      onPress={onSelect}
    >
      {/* Agent Info */}
      <View style={styles.agentInfo}>
        <Text style={styles.agentName}>{agent.businessName}</Text>
        <View style={styles.agentMetrics}>
          <Text style={styles.metric}>⭐ {agent.rating?.toFixed(1)}</Text>
          <Text style={styles.metric}>📍 {agent.distance.toFixed(1)} km away</Text>
        </View>
      </View>

      {/* Action Button */}
      {isSelected && (
        <TouchableOpacity
          style={[styles.requestButton, isLoading && styles.disabledButton]}
          onPress={onRequestRescue}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.requestButtonText}>Request Rescue</Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  locationBox: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  locationText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  loadingText: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  disabledButton: {
    opacity: 0.5,
  },
  agentCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "transparent",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedCard: {
    borderColor: "#22c55e",
    backgroundColor: "#f0fdf4",
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 6,
  },
  agentMetrics: {
    flexDirection: "row",
    gap: 16,
  },
  metric: {
    fontSize: 12,
    color: "#666",
  },
  requestButton: {
    backgroundColor: "#22c55e",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  requestButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
});
