'use client';

import { useState, useEffect, type ReactNode } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

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
    const { app, auth, firestore } = initializeFirebase();
    setFirebase({ app, auth, firestore });
  }, []);

  if (!firebase) {
    // You can render a loading state here
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
