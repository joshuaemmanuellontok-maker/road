import { useEffect, useState, useCallback } from "react";
import {
  listenToAgentRequests,
  listenToAgentLocation,
  listenToRequest,
  listenToAssignedAgentLocation,
} from "../lib/firebaseHelpers";

/**
 * AGENT HOOKS
 */

/**
 * Hook: Listen to pending rescue requests for an agent
 * Real-time - fires instantly when motorist sends request
 */
export const useAgentRequests = (agentId: string) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Real-time listener
    const unsubscribe = listenToAgentRequests(
      agentId,
      (updatedRequests) => {
        setRequests(updatedRequests);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    // Cleanup on unmount or agentId change
    return unsubscribe;
  }, [agentId]);

  return { requests, loading, error };
};

/**
 * Hook: Listen to agent's own location updates
 * Used by motorists to track agent in real-time
 */
export const useAgentLocation = (agentId: string) => {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    lastUpdated: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = listenToAgentLocation(
      agentId,
      (updatedLocation) => {
        setLocation(updatedLocation);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [agentId]);

  return { location, loading, error };
};

/**
 * MOTORIST HOOKS
 */

/**
 * Hook: Listen to rescue request status
 * Motorist sees: pending → accepted → completed
 */
export const useRescueRequest = (requestId: string | null) => {
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!requestId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = listenToRequest(
      requestId,
      (updatedRequest) => {
        setRequest(updatedRequest);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [requestId]);

  return { request, loading, error };
};

/**
 * Hook: Listen to assigned agent's location
 * Motorist tracks agent movement on map in real-time
 */
export const useAssignedAgentLocation = (agentId: string | null) => {
  const [agentLocation, setAgentLocation] = useState<{
    latitude: number;
    longitude: number;
    lastUpdated: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = listenToAssignedAgentLocation(
      agentId,
      (location) => {
        setAgentLocation(location);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [agentId]);

  return { agentLocation, loading, error };
};
