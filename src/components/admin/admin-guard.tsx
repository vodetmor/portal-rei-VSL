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
      if (loading) {
        setIsChecking(true);
        return;
      }

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
              setIsAdmin(false);
              router.replace('/dashboard');
            }
        } catch (error) {
            console.error("Error checking admin role:", error);
            setIsAdmin(false);
            router.replace('/dashboard');
        } finally {
             setIsChecking(false);
        }
      } else {
         // If firestore is not available, we can't verify role.
         // Default to non-admin and redirect for safety.
         setIsAdmin(false);
         setIsChecking(false);
         router.replace('/dashboard');
      }
    };

    checkRole();
  }, [user, loading, firestore, router]);

  if (isChecking || !isAdmin) {
     return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
