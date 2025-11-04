
'use client';

import { useAuth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function RedeemPage() {
  const auth = useAuth();
  const router = useRouter();
  const params = useParams();
  const linkId = params.linkId as string;
  const [message, setMessage] = useState("Verificando seu acesso...");

  useEffect(() => {
    if (!auth || !linkId) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in. Redirect to dashboard to handle redemption securely.
        setMessage("Usuário autenticado. Redirecionando para o painel...");
        router.replace(`/dashboard?linkId=${linkId}`);
      } else {
        // User is not logged in. Redirect to the premium access page which handles login/register.
        setMessage("Você precisa fazer login para resgatar o acesso. Redirecionando...");
        router.replace(`/premium/${linkId}`);
      }
    });

    return () => unsubscribe();
  }, [auth, linkId, router]);
  
  return (
      <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
          <h1 className="text-2xl font-bold text-white">Um momento...</h1>
          <p className="text-muted-foreground mt-2">{message}</p>
      </div>
  );
}
