'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase, getSdks } from '@/firebase';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseServices, setFirebaseServices] = useState<FirebaseServices | null>(null);

  useEffect(() => {
    // Initialize Firebase on the client side, once per component mount.
    // This ensures that any code that relies on browser-specific APIs
    // or produces dynamic values (like new Date()) runs only on the client,
    // after the initial server render, thus preventing hydration errors.
    const services = initializeFirebase();
    setFirebaseServices(services);
  }, []); // Empty dependency array ensures this runs only once on mount

  // While Firebase is initializing, we can render nothing or a loading spinner.
  // This prevents children from trying to access Firebase services before they are ready.
  if (!firebaseServices) {
    return null; // Or a loading component
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
