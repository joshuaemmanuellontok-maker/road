# Firebase Setup Guide for RoadResQ

## 🚀 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Name it "RoadResQ" (or your preferred name)
4. Enable Google Analytics (optional but recommended)
5. Choose your Google Analytics account
6. Click "Create project"

## 🔥 Step 2: Enable Firestore Database

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose one close to your users)
5. Click "Done"

## 🔑 Step 3: Generate Service Account Key

1. In Firebase Console, go to "Project Settings" (gear icon)
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file
5. **IMPORTANT**: Save this file as `backend/firebase-service-account.json`
6. **SECURITY**: Never commit this file to git!

## ⚙️ Step 4: Configure Environment Variables

Update your `backend/.env` file with:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id-here
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

# Server Configuration
PORT=4000
CORS_ORIGIN=*
```

**To get these values:**
- `FIREBASE_PROJECT_ID`: Found in the JSON file as `"project_id"`
- `FIREBASE_PRIVATE_KEY`: The entire `"private_key"` value from JSON (keep quotes and \n)
- `FIREBASE_CLIENT_EMAIL`: The `"client_email"` from JSON

## 🧪 Step 5: Test Firebase Connection

Run the test script:

```bash
cd backend
node test_firebase.js
```

You should see:
```
🔄 Testing Firebase connection...
✅ Firebase connected successfully
📋 Available collections: ...
✅ Firebase setup complete!
```

## 📱 Step 6: Update Mobile App (Optional)

If you want to use Firebase in the mobile app too, install Firebase SDK:

```bash
cd mobile
npm install @react-native-firebase/app @react-native-firebase/firestore
```

But for now, the backend will work with your existing mobile app.

## 🎯 What's Different from Supabase

- **Free Tier**: 1GB storage vs Supabase 500MB
- **Real-time**: Better real-time features
- **Mobile SDK**: Native Firebase SDKs available
- **No SQL**: Uses Firestore (document-based, not relational)
- **Scaling**: Better for high-traffic apps

## 🆘 Troubleshooting

**"Firebase configuration missing"**
- Make sure `firebase-service-account.json` exists in `backend/` folder
- Check that environment variables are set correctly

**"Invalid credentials"**
- Verify the service account key is correct
- Make sure Firestore is enabled

**Connection timeout**
- Check your internet connection
- Verify Firebase project is active

## 🚦 Next Steps

1. Test the backend: `npm start` in backend folder
2. Test mobile app still works with Firebase backend
3. Add some seed data if needed
4. Deploy to production when ready

---

**Note**: Firebase has a very generous free tier, but monitor your usage in the Firebase Console to avoid unexpected charges.