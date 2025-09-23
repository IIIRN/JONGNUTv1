import admin from 'firebase-admin';

// Create variables that can be exported
let db;
let auth;

// Check if the app has already been initialized
if (!admin.apps.length) {
  try {
    // Verify that all required environment variables are present
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      throw new Error("Missing required Firebase environment variables.");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // This ensures the private key format is correct
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });

    // Assign the db and auth instances only after a successful initialization
    db = admin.firestore();
    auth = admin.auth();
    console.log('Firebase Admin SDK initialized successfully.');

  } catch (error) {
    // Log the full error stack for better debugging
    console.error('Firebase Admin Initialization Error:', error.stack);
  }
} else {
  // If already initialized, use the existing instance
  db = admin.firestore();
  auth = admin.auth();
}

// Export the db and auth instances
export { db, auth };