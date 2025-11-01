'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseContextValue {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  app: null,
  auth: null,
  firestore: null,
});

// The provider component that wraps your app and makes the Firebase
// instances available to all of its children.
export function FirebaseProvider({
  children,
  app,
  auth,
  firestore,
}: {
  children: ReactNode;
} & FirebaseContextValue) {
  return (
    <FirebaseContext.Provider value={{ app, auth, firestore }}>
      {children}
    </FirebaseContext.Provider>
  );
}

// Custom hooks to easily access the Firebase instances.
export function useFirebaseApp() {
  return useContext(FirebaseContext)?.app;
}

export function useAuth() {
  return useContext(FirebaseContext)?.auth;
}

export function useFirestore() {
  return useContext(FirebaseContext)?.firestore;
}
