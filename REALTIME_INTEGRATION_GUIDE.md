# KalsadaKonek Real-Time Rescue - Integration Guide

## 📋 Overview

This guide explains how to implement real-time Responder matching and GPS tracking using Firebase and React Native.

**Key Changes:**
- ✅ Replaces polling (2 sec intervals) with real-time listeners
- ✅ Instant request notifications to Responders (no delay)
- ✅ Real GPS tracking (only physical movement)
- ✅ Grab-like real-time matching experience

---

## 🔥 Firebase Collection Structure

### 1. **`Responders` Collection**

Schema for Responder profiles with real-time location:

```javascript
Responders/{ResponderId}
├── id: string                    // Document ID
├── userId: string                // Reference to users collection
├── businessName: string          // "John's Roadside Assist"
├── serviceType: string           // "mechanical" | "locksmith" | etc
├── status: "online" | "offline"  // Real-time availability
├── location: {
│   ├── latitude: number
│   └── longitude: number
├── lastUpdated: timestamp        // When location was last updated
├── rating: number                // 4.5
├── phone: string
└── verificationStatus: "approved" | "pending" | "rejected"
```

**Example:**
```json
{
  "id": "Responder_001",
  "userId": "user_5432",
  "businessName": "John's Auto Assist",
  "serviceType": "mechanical",
  "status": "online",
  "location": {
    "latitude": 14.5528,
    "longitude": 121.0115
  },
  "lastUpdated": 1708950123456,
  "rating": 4.8,
  "phone": "+63912345678",
  "verificationStatus": "approved"
}
```

### 2. **`requests` Collection**

Schema for rescue requests (real-time matching):

```javascript
requests/{requestId}
├── id: string                         // Document ID
├── motoristId: string                 // Reference to motorist
├── ResponderId: string                    // Reference to assigned Responder
├── status: "pending" | "accepted" | "declined" | "completed"
├── motoristLocation: {
│   ├── latitude: number
│   └── longitude: number
├── motoristName: string
├── serviceType: string                // What service is needed
├── issue: string                      // Problem description
├── createdAt: timestamp               // When request was created
├── acceptedAt: timestamp | null       // When Responder accepted
└── completedAt: timestamp | null      // When service was completed
```

**Example:**
```json
{
  "id": "req_xyz789",
  "motoristId": "user_1234",
  "ResponderId": "Responder_001",
  "status": "accepted",
  "motoristLocation": {
    "latitude": 14.5548,
    "longitude": 121.0105
  },
  "motoristName": "Maria Santos",
  "serviceType": "tire_replacement",
  "issue": "Flat tire on Makati Avenue",
  "createdAt": 1708950100000,
  "acceptedAt": 1708950115000,
  "completedAt": null
}
```

---

## 🏗️ File Structure

**New files created:**

```
mobile/
├── src/
│   ├── hooks/
│   │   ├── useRealTimeListeners.ts     (NEW) Real-time Firestore listeners
│   │   └── useGPSTracking.ts           (NEW) Continuous GPS tracking
│   ├── lib/
│   │   └── firebaseHelpers.ts          (NEW) Firebase CRUD + listeners
│   └── components/
│       ├── ResponderRequestsScreen.tsx     (NEW) Responder receives requests
│       ├── MotorietFindResponderscreen.tsx (NEW) Motorist finds Responder
│       └── MotorietTrackingScreen.tsx  (NEW) Real-time tracking map

backend/
├── src/
│   └── server_firebase.js              (UPDATED) New endpoints added
```

---

## 🚀 Implementation Steps

### Step 1: Setup Firebase Collections

Create these collections in Firestore Console:

1. Go to **Firestore Database** → **Collections**
2. Create collection `Responders` (add sample document)
3. Create collection `requests` (leave empty, will populate on requests)

### Step 2: Update Responder Profile in Firebase

When Responder goes online, update their status:

```typescript
import { setResponderstatus } from "../lib/firebaseHelpers";

// When Responder opens app
await setResponderstatus(ResponderId, "online");

// When Responder closes app
await setResponderstatus(ResponderId, "offline");
```

### Step 3: Start Real GPS Tracking (Responder Side)

When Responder starts navigation:

```typescript
import { useGPSTracking } from "../hooks/useGPSTracking";

const ResponderNavigationScreen = ({ ResponderId }) => {
  useGPSTracking({
    ResponderId,
    enabled: true,
    minDistance: 5,         // Update every 5 meters
    updateInterval: 5000,   // Or every 5 seconds
    onLocationUpdate: (location) => {
      console.log("Responder moved:", location);
    },
  });

  return <YourMapComponent />;
};
```

### Step 4: Responder Screen - Listen to Requests

```typescript
import { ResponderRequestsScreen } from "../components/ResponderRequestsScreen";

const ResponderApp = ({ ResponderId }) => {
  return (
    <ResponderRequestsScreen
      ResponderId={ResponderId}
      onAcceptRequest={(requestId) => {
        // Navigate to navigation screen
        navigateToNavigation(requestId);
      }}
    />
  );
};
```

### Step 5: Motorist Screen - Find Responder

```typescript
import { MotorietFindResponderscreen } from "../components/MotorietFindResponderscreen";

const MotorietApp = ({ motoristId, motoristName }) => {
  return (
    <MotorietFindResponderscreen
      motoristId={motoristId}
      motoristName={motoristName}
      serviceType="tire_replacement"
      issue="Flat tire"
      onRequestCreated={(requestId) => {
        // Show tracking screen
        navigateToTracking(requestId);
      }}
    />
  );
};
```

### Step 6: Motorist Screen - Track Responder

```typescript
import { MotorietTrackingScreen } from "../components/MotorietTrackingScreen";

const MotorietTracking = ({ requestId, motoristLocation }) => {
  return (
    <MotorietTrackingScreen
      requestId={requestId}
      motoristLocation={motoristLocation}
    />
  );
};
```

---

## 📡 API Endpoints Added

All endpoints in `backend/src/server_firebase.js`:

### Create Rescue Request
```bash
POST /api/requests
Body: {
  "motoristId": "user_1234",
  "ResponderId": "Responder_001",
  "motoristLocation": { "latitude": 14.5548, "longitude": 121.0105 },
  "motoristName": "Maria Santos",
  "serviceType": "tire_replacement",
  "issue": "Flat tire"
}
Response: { "id": "req_xyz789", "status": "pending" }
```

### Get Responder's Pending Requests
```bash
GET /api/Responders/{ResponderId}/requests
Response: [{ id, motoristName, issue, motoristLocation, ... }]
```

### Accept Request
```bash
PATCH /api/requests/{requestId}/accept
Response: { "id": "req_xyz789", "status": "accepted" }
```

### Decline Request
```bash
PATCH /api/requests/{requestId}/decline
Response: { "id": "req_xyz789", "status": "declined" }
```

### Complete Request
```bash
PATCH /api/requests/{requestId}/complete
Response: { "id": "req_xyz789", "status": "completed" }
```

### Get Nearby Responders
```bash
GET /api/Responders/nearby?lat=14.5548&lng=121.0105&radius=5
Response: [
  {
    "id": "Responder_001",
    "businessName": "John's Auto",
    "distance": 0.8,
    "location": { "latitude": 14.5528, "longitude": 121.0115 },
    "rating": 4.8,
    "status": "online"
  }
]
```

---

## ⚡ Real-Time Data Flow

### Motorist Sends Request → Responder Gets Instant Notification

```
1. Motorist clicks "Find Rescue Responder"
   ↓
2. System queries GET /api/Responders/nearby
   ↓
3. Motorist selects Responder & clicks "Request Rescue"
   ↓
4. POST /api/requests creates document in Firebase
   ↓
5. Responder's onSnapshot() listener fires INSTANTLY
   ↓
6. Responder sees request in their Active Requests list
   ↓
7. Responder clicks "Accept"
   ↓
8. PATCH /api/requests/{id}/accept updates status
   ↓
9. Motorist's onSnapshot() listener fires
   ↓
10. Motorist sees "Responder Accepted" + real-time tracking starts
```

### Responder Moves → Motorist Sees Real Movement

```
1. Responder starts navigation with GPS enabled
   ↓
2. useGPSTracking() watches position (5m min distance)
   ↓
3. Responder physically moves 5+ meters
   ↓
4. Location updates in Firebase via updateResponderLocation()
   ↓
5. Motorist's useAssignedResponderLocation() listener fires
   ↓
6. Map marker updates to new position (NO animation)
   ↓
7. Distance & ETA recalculated
```

---

## 🧪 Testing Real-Time

### Test 1: Request Instant Notification
1. Open Responder app on phone A
2. Responder sets status "online"
3. Open motorist app on phone B
4. Motorist finds and requests Responder
5. ✅ Responder should see request **instantly** (< 1 second)

### Test 2: Real GPS Tracking
1. Responder accepts request
2. Responder navigates with real GPS
3. Walk/drive 5+ meters
4. ✅ Responder marker on motorist's map **moves** (no animation)
5. Walk stops
6. ✅ Marker **stops moving** (no fake simulation)

### Test 3: Status Updates
1. Responder accepts request
2. ✅ Motorist sees "Responder Accepted" **instantly**
3. Responder completes request
4. ✅ Motorist sees "Service Completed" **instantly**

---

## 🔧 Firestore Security Rules

Set these rules for production:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Responders can update their own location
    match /Responders/{ResponderId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow update: if request.auth.uid == resource.data.userId
                      && request.resource.data.userId == resource.data.userId;
    }

    // Anyone can read requests
    match /requests/{requestId} {
      allow read: if request.auth.uid == resource.data.motoristId
                   || request.auth.uid == resource.data.ResponderId;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.motoristId
                      || request.auth.uid == resource.data.ResponderId;
    }
  }
}
```

---

## 💡 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Requests not appearing on Responder | Check `onSnapshot()` is called, Responder status is "online" |
| Responder location not updating | Verify GPS permission granted, `useGPSTracking` is enabled |
| Map shows old location | Ensure motorist listener uses `ResponderId` from request, not hardcoded |
| Polling still happening | Remove `setInterval` fetches, use listeners only |
| Fake movement detected | Check `Location.watchPosition` has `distanceInterval`, remove interpolation |

---

## ✅ Checklist

- [ ] Firebase collections created (Responders, requests)
- [ ] Backend endpoints implemented (/api/requests, etc)
- [ ] `firebaseHelpers.ts` imported in components
- [ ] `useRealTimeListeners` hooks installed
- [ ] `useGPSTracking` hook added to Responder navigation
- [ ] Responder screen shows real-time requests
- [ ] Motorist find Responder screen working
- [ ] Tracking screen updates on Responder movement
- [ ] Tested with two physical devices
- [ ] GPS permission requested on app startup
- [ ] Firestore rules updated

---

## 📚 References

- [Firebase Real-time Listeners](https://firebase.google.com/docs/firestore/query-data/listen)
- [Expo Location API](https://docs.expo.dev/versions/latest/sdk/location/)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)
- [Haversine Distance Formula](https://en.wikipedia.org/wiki/Haversine_formula)
