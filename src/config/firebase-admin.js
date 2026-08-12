/**
 * @file src/config/firebase-admin.js
 * @description Firebase Admin SDK Initialization for Server-Side Token Verification.
 */

const admin = require('firebase-admin');

let firebaseApp;

try {
  const existingApps = admin.getApps ? admin.getApps() : (admin.apps || []);
  if (existingApps.length === 0) {
    const projectId   = process.env.FIREBASE_PROJECT_ID || 'foodrush-app-e8b58';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (clientEmail && privateKey) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('✅ Firebase Admin SDK initialized with Service Account Credentials.');
    } else {
      firebaseApp = admin.initializeApp({
        projectId,
      });
      console.log('ℹ️ Firebase Admin SDK initialized with Default Project ID.');
    }
  } else {
    firebaseApp = existingApps[0];
  }
} catch (err) {
  console.error('⚠️ Firebase Admin SDK Initialization Warning:', err.message);
}

module.exports = admin;
