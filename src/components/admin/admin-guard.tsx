'use client';

import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (loading) return;

      if (!user) {
        router.replace('/login');
        return;
      }
      
      // Force grant admin role if email matches, as a fallback.
      if (user.email === 'admin@reidavsl.com') {
        setIsAdmin(true);
        setIsChecking(false);
        return;
      }

      if (firestore) {
        try {
            const userDocRef = doc(firestore, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists() && userDoc.data().role === 'admin') {
              setIsAdmin(true);
            } else {
              // Non-admins shouldn't access admin pages, redirect them.
              // Allow access for this check to complete on non-admin pages.
              // The page using the guard will handle the final redirection if needed.
              setIsAdmin(false);
            }
        } catch (error) {
            console.error("Error checking admin role:", error);
            // If we can't check the role, assume not admin and redirect.
            router.replace('/dashboard');
        }
      }
      setIsChecking(false);
    };

    checkRole();
  }, [user, loading, firestore, router]);

  if (isChecking) {
     return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  // If not checking and not admin, redirect.
  // This might cause a flash of content if the check is slow.
  // A better approach is often to handle this at the page level.
  // For a simple guard, this is a reasonable default.
  useEffect(() => {
    if (!isChecking && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isChecking, isAdmin, router]);

  // Render nothing while redirecting
  return null;
}
