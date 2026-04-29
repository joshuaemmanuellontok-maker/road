/**
 * FIRESTORE SECURITY RULES & INDEXES
 * Copy this to Firestore Console → Rules tab
 */

// ============================================================================
// FIRESTORE SECURITY RULES
// ============================================================================

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ========================================================================
    // RESPONDERS Collection
    // ========================================================================

    match /responders/{responderId} {
      // Responders can read their own document
      allow read: if request.auth.uid == resource.data.userId
                  || request.auth.token.claims.admin == true;

      // Responders can update their own location & status
      allow update: if request.auth.uid == resource.data.userId
                    && (request.resource.data.userId == resource.data.userId)
                    && !("businessName" in request.resource.data.keys()
                         || "userId" in request.resource.data.keys());

      // Only admins can create/delete responders
      allow create, delete: if request.auth.token.claims.admin == true;
    }

    // Legacy collection retained during migration.
    match /agents/{agentId} {
      allow read: if request.auth.uid == resource.data.userId
                  || request.auth.token.claims.admin == true;
      allow update: if request.auth.uid == resource.data.userId
                    && (request.resource.data.userId == resource.data.userId)
                    && !("businessName" in request.resource.data.keys()
                         || "userId" in request.resource.data.keys());
      allow create, delete: if request.auth.token.claims.admin == true;
    }

    // ========================================================================
    // REQUESTS Collection
    // ========================================================================

    match /requests/{requestId} {
      // Anyone authenticated can read their own requests
      allow read: if request.auth.uid == resource.data.motoristId
                  || request.auth.uid == resource.data.responderId
                  || request.auth.uid == resource.data.agentId
                  || request.auth.token.claims.admin == true;

      // Motorists can create new requests
      allow create: if request.auth != null
                    && request.resource.data.motoristId == request.auth.uid
                    && request.resource.data.status == "pending"
                    && request.resource.data.keys().hasAll(
                        ["motoristId", "responderId", "motoristLocation", "status"]
                      );

      // Responders and motorists can update requests (but not all fields)
      allow update: if (request.auth.uid == resource.data.motoristId
                        || request.auth.uid == resource.data.responderId
                        || request.auth.uid == resource.data.agentId)
                    && !("motoristId" in request.resource.data.keys()
                         || "responderId" in request.resource.data.keys()
                         || "agentId" in request.resource.data.keys())
                    && resource.data.status != "completed";

      // Admins can do anything
      allow delete: if request.auth.token.claims.admin == true;
    }

    // ========================================================================
    // USERS Collection (Restricted)
    // ========================================================================

    match /users/{userId} {
      // Users can read their own document
      allow read: if request.auth.uid == userId
                  || request.auth.token.claims.admin == true;

      // Users can update their own document (some fields only)
      allow update: if request.auth.uid == userId
                    && !("role" in request.resource.data.keys()
                         || "id" in request.resource.data.keys());

      // Only admins can create/delete
      allow create, delete: if request.auth.token.claims.admin == true;
    }

    // ========================================================================
    // Other Collections (Restrict by default)
    // ========================================================================

    match /{document=**} {
      allow read, write: if false; // Deny all by default
    }
  }
}

// ============================================================================
// FIRESTORE INDEXES
// ============================================================================
/*
Create these indexes in Firestore Console → Indexes tab

COLLECTION: agents
- Field: status (Ascending)
- Field: lastUpdated (Descending)
Purpose: Query online agents sorted by recent activity

COLLECTION: requests
- Field: agentId (Ascending)
- Field: status (Ascending)
- Field: createdAt (Descending)
Purpose: Query agent's pending requests, sorted by newest first

COLLECTION: requests
- Field: motoristId (Ascending)
- Field: status (Ascending)
Purpose: Query motorist's active requests

COLLECTION: requests
- Field: status (Ascending)
- Field: createdAt (Descending)
Purpose: Query all pending requests (admin view)
*/

// ============================================================================
// HOW TO SET UP IN FIRESTORE CONSOLE
// ============================================================================

/*
1. Go to Firebase Console → Select your project
2. Click "Firestore Database" in left sidebar
3. Click "Rules" tab at top
4. Clear existing rules and paste the SECURITY RULES above
5. Click "Publish"

6. Go to "Indexes" tab
7. Create each index listed above:
   - Click "Create Index"
   - Select Collection
   - Add fields
   - Click "Create"

Wait for indexes to finish building (shows as "Enabled" when done)
*/

// ============================================================================
// TESTING SECURITY RULES
// ============================================================================

/*
Use Firestore Emulator for local testing:

1. Install Firebase Emulator Suite
2. Run: firebase emulators:start
3. Go to http://localhost:4000

Testing scenarios:

✅ Motorist should be able to:
- Read their own requests
- Create new requests (only their requests)
- Update their requests (only non-critical fields)

❌ Motorist should NOT be able to:
- Read other motorist's requests
- Update request motoristId/agentId
- Update completed requests
- Delete requests

✅ Agent should be able to:
- Read requests assigned to them
- Update request status (accept/decline)
- Update their own location
- Update their own status

❌ Agent should NOT be able to:
- Read other agent's location
- Update motorist data
- Create requests
- Delete requests
*/

// ============================================================================
// RECOMMENDED FIRESTORE SETUP
// ============================================================================

/*
Database Settings:
- Region: asia-southeast1 (or closest to your users)
- Multi-region replication: Optional (depends on availability needs)

Backup:
- Enable automatic backups (daily, 30-day retention)

Monitoring:
- Set up Cloud Monitoring for query metrics
- Alert if read/write exceeds limits

Billing:
- Monitor usage in Billing console
- Set alerts for unexpected costs
- Estimate: ~100k requests/day ≈ $2-5/month
*/
