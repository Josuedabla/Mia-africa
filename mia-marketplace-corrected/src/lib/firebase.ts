/**
 * Firebase Configuration for MIA Marketplace
 * Initialize Firebase with Firestore, Auth, and Storage
 *
 * IMPORTANT: this file lives under src/lib so that every relative/alias
 * import inside src/ can resolve it. It was previously located at
 * /firebase/config/firebase.config.ts (outside src/), which broke every
 * import in the app (Cannot find module) because tsconfig.json only
 * includes "src" and vite's "@" alias only points to "./src".
 *
 * It also now reads VITE_-prefixed env vars via import.meta.env, which is
 * the only convention Vite actually exposes to the browser. The previous
 * REACT_APP_-prefixed variables read via process.env are a Create React
 * App convention and are never injected by Vite, so firebaseConfig used to
 * silently resolve to a set of empty strings.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  // Fails fast and loudly instead of Firebase throwing a cryptic
  // "auth/invalid-api-key" deep inside the SDK later.
  console.error(
    '[Firebase] Missing configuration. Check that VITE_FIREBASE_* variables are set in your .env file and that the dev/build process was restarted after editing it.'
  );
}

// Avoid re-initializing on hot-module-reload during development.
export const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
