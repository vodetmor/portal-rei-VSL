import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import { firebaseConfig } from '@/firebase/config';

// Re-export the providers and hooks
export { FirebaseProvider, useFirebaseApp, useAuth, useFirestore } from '@/firebase/provider';
export { FirebaseClientProvider } from '@/firebase/client-provider';
export { useUser } from '@/firebase/auth/use-user';


// Call this function to initialize Firebase and get the instances
// of the different services.
//
// This function is idempotent, meaning you can call it multiple times
// and it will only initialize Firebase once.
export function initializeFirebase(): {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} {
  const apps = getApps();
  const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  return { app, auth, firestore };
}
