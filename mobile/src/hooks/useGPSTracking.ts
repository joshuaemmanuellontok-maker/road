import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { updateAgentLocation } from "../lib/firebaseHelpers";

/**
 * REAL GPS TRACKING HOOK
 *
 * Continuously tracks agent's actual GPS position
 * Updates Firebase in real-time as agent moves
 *
 * Key features:
 * - Only updates on real movement (5m distance filter)
 * - High accuracy GPS
 * - Efficient updates (background-friendly)
 * - Automatic cleanup on unmount
 */

interface UseGPSTrackingOptions {
  agentId: string;
  enabled?: boolean;
  minDistance?: number; // meters between updates
  updateInterval?: number; // milliseconds
  onLocationUpdate?: (location: { latitude: number; longitude: number }) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook: Track agent's real GPS location continuously
 * Call this in agent navigation screen when agent is en-route
 */
export const useGPSTracking = ({
  agentId,
  enabled = true,
  minDistance = 5, // Update only if agent moved 5+ meters
  updateInterval = 5000, // Check every 5 seconds
  onLocationUpdate,
  onError,
}: UseGPSTrackingOptions) => {
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled || !agentId) {
      return;
    }

    let isMounted = true;

    const startTracking = async () => {
      try {
        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          const error = new Error("Location permission denied");
          onError?.(error);
          return;
        }

        // Start watching position with real device GPS
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High, // High accuracy for real-time
            distanceInterval: minDistance, // Only trigger on movement
            timeInterval: updateInterval,
          },
          async (location) => {
            if (!isMounted) return;

            const { latitude, longitude } = location.coords;

            // Callback to parent component
            onLocationUpdate?.({ latitude, longitude });

            // Update Firebase in real-time
            try {
              await updateAgentLocation(agentId, {
                latitude,
                longitude,
              });
            } catch (error) {
              console.error("Error updating location in Firebase:", error);
              onError?.(error as Error);
            }
          }
        );
      } catch (error) {
        console.error("Error starting GPS tracking:", error);
        onError?.(error as Error);
      }
    };

    startTracking();

    // Cleanup: stop tracking on unmount
      return () => {
        isMounted = false;
        if (watchRef.current) {
          watchRef.current.remove();
        }
      };
  }, [enabled, agentId, minDistance, updateInterval, onLocationUpdate, onError]);
};

/**
 * Alternative: Manual GPS location getter (for one-time updates)
 * Use this if you only need location occasionally
 */
export const getAgentLocation = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission denied");
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error("Error getting responder location:", error);
    throw error;
  }
};
