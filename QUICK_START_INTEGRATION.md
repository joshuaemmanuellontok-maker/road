/**
 * QUICK START: How to Integrate Real-Time Code into App.tsx
 *
 * This file shows code snippets for replacing polling with real-time listeners
 */

// ============================================================================
// BEFORE (Current - Polling Every 2 Seconds) ❌
// ============================================================================

// In mobile/App.tsx - OLD CODE (DON'T USE)
const AgentAppBEFORE = () => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    // ❌ POLLING - fires every 2 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://api/agents/${agentId}/requests`);
        const data = await response.json();
        setRequests(data);
      } catch (error) {
        console.error(error);
      }
    }, 2000); // 2 second delay!

    return () => clearInterval(interval);
  }, [agentId]);

  // Problem: Requests appear 2 seconds late
  // Problem: Wastes battery polling constantly
  // Problem: Could miss rapid requests
};

// ============================================================================
// AFTER (New - Real-Time Listeners) ✅
// ============================================================================

// In mobile/App.tsx - NEW CODE (USE THIS)
import { useAgentRequests } from "./src/hooks/useRealTimeListeners";
import { acceptRequest, declineRequest } from "./src/lib/firebaseHelpers";

const AgentAppAFTER = ({ agentId }) => {
  // ✅ REAL-TIME - listener fires instantly on changes
  const { requests, loading, error } = useAgentRequests(agentId);
  const [accepting, setAccepting] = useState(false);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      setAccepting(true);
      await acceptRequest(requestId, agentId);
      // Listener automatically updates because request status changed
    } catch (error) {
      console.error(error);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;

  return (
    <FlatList
      data={requests}
      renderItem={({ item }) => (
        <RequestCard
          request={item}
          onAccept={() => handleAcceptRequest(item.id)}
        />
      )}
    />
  );
};

// ============================================================================
// BEFORE: Agent Location Polling ❌
// ============================================================================

const AgentNavigationBEFORE = () => {
  useEffect(() => {
    // ❌ POLLING every 5 seconds for location
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://api/agents/${agentId}/location`);
        const data = await response.json();
        setAgentLocation(data);
      } catch (error) {}
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Problem: Old location data on map
  // Problem: Map lag when motorist is watching
  // Problem: Fake smooth movement (interpolation)
};

// ============================================================================
// AFTER: Real GPS Tracking ✅
// ============================================================================

import { useGPSTracking } from "./src/hooks/useGPSTracking";
import { useAssignedAgentLocation } from "./src/hooks/useRealTimeListeners";

// MOTORIST SIDE - Listen to agent location
const MotoristTrackingAFTER = ({ requestId, agentId }) => {
  // ✅ REAL-TIME listener for agent location
  const { agentLocation, loading, error } = useAssignedAgentLocation(agentId);
  const [route, setRoute] = useState([]);

  useEffect(() => {
    // Route recalculates only when agentLocation actually changes (real GPS)
    if (agentLocation) {
      calculateRoute();
    }
  }, [agentLocation]); // Only re-run when location from Firebase changes

  return (
    <MapView>
      {/* Map updates ONLY when agentLocation changes from real GPS */}
      {agentLocation && <Marker coordinate={agentLocation} />}
      {route && <Polyline coordinates={route} />}
    </MapView>
  );
};

// AGENT SIDE - Continuous GPS tracking
const AgentNavigationAFTER = ({ agentId }) => {
  const [currentLocation, setCurrentLocation] = useState(null);

  // ✅ Real device GPS, continuously
  useGPSTracking({
    agentId,
    enabled: true,
    minDistance: 5, // Only update every 5 meters
    updateInterval: 5000, // Or every 5 seconds
    onLocationUpdate: (location) => {
      // This updates BOTH local state AND Firebase
      setCurrentLocation(location);
      console.log("Moving:", location);
    },
    onError: (error) => console.error(error),
  });

  return (
    <MapView>
      {currentLocation && <Marker coordinate={currentLocation} />}
      {/* Shows REAL movement, not animation or simulation */}
    </MapView>
  );
};

// ============================================================================
// BEFORE: Manual Status Simulation ❌
// ============================================================================

const RequestHandlingBEFORE = () => {
  // ❌ FAKE STATUS CHANGES with setTimeout
  useEffect(() => {
    setTimeout(() => setStatus("accepted"), 3000);
    setTimeout(() => setStatus("en-route"), 6000);
    setTimeout(() => setStatus("arrived"), 12000);
    setTimeout(() => setStatus("completed"), 17000);
  }, []);

  // Problem: Fake progress
  // Problem: Doesn't match real agent acceptance
  // Problem: Status can be wrong if timing differs
};

// ============================================================================
// AFTER: Real Firebase Status Updates ✅
// ============================================================================

const RequestHandlingAFTER = ({ requestId }) => {
  // ✅ REAL status from Firebase
  const { request, loading, error } = useRescueRequest(requestId);

  // Status updates ONLY when agent actually accepts
  // No fake delays, no simulation
  const statusText = request?.status === "accepted" ? "Agent Accepted!" : "Waiting...";

  return <Text>{statusText}</Text>;
};

// ============================================================================
// INTEGRATION: Replace Motorist "Find Agent" Screen
// ============================================================================

import { MotorietFindAgentScreen } from "./src/components/MotorietFindAgentScreen";

const MotorietAppTabs = ({ motoristId, motoristName }) => {
  const [requestId, setRequestId] = useState(null);

  if (requestId) {
    // Show tracking screen when request created
    return (
      <MotorietTrackingScreen
        requestId={requestId}
        motoristLocation={motoristLocation}
      />
    );
  }

  return (
    <MotorietFindAgentScreen
      motoristId={motoristId}
      motoristName={motoristName}
      serviceType="tire_replacement"
      issue="Flat tire"
      onRequestCreated={(id) => setRequestId(id)}
    />
  );
};

// ============================================================================
// INTEGRATION: Replace Agent "Active Tasks" Screen
// ============================================================================

import { AgentRequestsScreen } from "./src/components/AgentRequestsScreen";

const AgentAppTabs = ({ agentId }) => {
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  if (selectedRequestId) {
    // Show navigation screen when request accepted
    return <AgentNavigationScreen requestId={selectedRequestId} />;
  }

  return (
    <AgentRequestsScreen
      agentId={agentId}
      onAcceptRequest={(requestId) => {
        setSelectedRequestId(requestId);
        // Start GPS tracking
      }}
    />
  );
};

// ============================================================================
// INTEGRATION: Agent Status Management
// ============================================================================

import { setAgentStatus } from "./src/lib/firebaseHelpers";

const AgentAppInit = ({ agentId }) => {
  useEffect(() => {
    // When agent opens app
    setAgentStatus(agentId, "online");

    return () => {
      // When agent closes app
      setAgentStatus(agentId, "offline");
    };
  }, [agentId]);

  return <AgentAppTabs />;
};

// ============================================================================
// COMPARISON TABLE
// ============================================================================

/*
┌─────────────────────┬──────────────────┬──────────────────────┐
│ Feature             │ OLD (Polling)    │ NEW (Real-Time)      │
├─────────────────────┼──────────────────┼──────────────────────┤
│ Request delay       │ 2 seconds        │ < 1 second           │
│ Agent notification  │ Slow             │ INSTANT              │
│ GPS update lag      │ Up to 5 seconds  │ Real-time            │
│ Battery usage       │ HIGH (constant)  │ LOW (event-driven)   │
│ Map accuracy        │ Outdated         │ Current              │
│ Fake movement       │ YES (animated)   │ NO (real GPS only)   │
│ Scalability         │ Polling fails    │ Efficient            │
│ Network usage       │ Continuous       │ Only on changes      │
└─────────────────────┴──────────────────┴──────────────────────┘
*/

// ============================================================================
// DEBUGGING: How to Verify Real-Time is Working
// ============================================================================

// Add these logs to verify real-time listeners are working:

import { listenToAgentRequests } from "./src/lib/firebaseHelpers";

const TestRealTime = ({ agentId }) => {
  useEffect(() => {
    console.log("🔴 Starting real-time listener...");

    const unsubscribe = listenToAgentRequests(
      agentId,
      (requests) => {
        console.log("✅ REAL-TIME UPDATE:", requests.length, "requests");
        // This should log instantly when motorist sends request
      },
      (error) => {
        console.error("❌ ERROR:", error);
      }
    );

    return unsubscribe;
  }, [agentId]);

  // Check browser console/Expo logs:
  // - Should see "🔴 Starting real-time listener..."
  // - When motorist sends request, should see "✅ REAL-TIME UPDATE"
  // - Should NOT see repeated fetches every 2 seconds
};

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

/*
✅ Test Real-Time Request Notification:
1. Open agent app on Phone A
2. Agent sets status to "online"
3. Open motorist app on Phone B
4. Motorist finds and requests agent
5. Check agent app → should show request INSTANTLY (< 1 second)
6. Check console for "✅ REAL-TIME UPDATE" log

✅ Test Real GPS Tracking:
1. Agent accepts request
2. Agent opens navigation screen
3. GPS tracking starts (check for permission prompt)
4. Agent physically walks/drives 5+ meters
5. Check motorist map → agent marker moves (no animation)
6. Agent stops moving
7. Check motorist map → agent marker STOPS (no fake movement)

✅ Test Status Updates:
1. Motorist sends request
2. Check motorist app → status shows "pending"
3. Agent accepts
4. Check motorist app → status shows "accepted" INSTANTLY
5. Agent completes
6. Check motorist app → status shows "completed" INSTANTLY

✅ Test with No Internet:
1. Disable WiFi/mobile data on both phones
2. Try to send request → should fail gracefully
3. Enable internet
4. Try again → should work

✅ Battery/Performance:
1. Agent leaves app open for 30 minutes
2. Check battery usage (should be minimal)
3. Check GPS still tracking correctly
*/
