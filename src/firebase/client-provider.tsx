'use client';

import { useState, useEffect, type ReactNode } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { firebaseConfig } from './config';

// This provider is responsible for initializing Firebase on the client
// and providing the Firebase instances to the rest of the app.
// It ensures that Firebase is initialized only once.
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [firebase, setFirebase] = useState<{
    app: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  } | null>(null);

  useEffect(() => {
    // Only initialize Firebase if the API key is provided
    if (firebaseConfig.apiKey) {
      const { app, auth, firestore } = initializeFirebase();
      setFirebase({ app, auth, firestore });
    }
  }, []);

  if (!firebase && !firebaseConfig.apiKey) {
    // If Firebase is not initialized because of missing config,
    // you can render the children without the provider, or show a message.
    // For now, just render children but be aware Firebase features won't work.
    return <>{children}</>;
  }


  if (!firebase) {
    // You can render a loading state here while Firebase initializes
    return null;
  }

  return (
    <FirebaseProvider
      app={firebase.app}
      auth={firebase.auth}
      firestore={firebase.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
