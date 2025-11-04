'use client';
import { useAuth, useFirestore } from '@/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, runTransaction, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function RedeemPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const linkId = params.linkId as string;
  
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Verificando seu acesso...");
  const [error, setError] = useState<string | null>(null);

  const redeemAccess = useCallback(async (user: User) => {
    if (!firestore || !linkId) {
        setError("Ocorreu um erro interno. Tente novamente.");
        setLoading(false);
        return;
    };

    setStatusMessage("Verificando link de acesso...");
    const linkRef = doc(firestore, 'premiumLinks', linkId);
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const linkSnap = await transaction.get(linkRef);
        if (!linkSnap.exists() || !linkSnap.data()?.active) {
            throw new Error("Este link de acesso é inválido ou expirou.");
        }

        const currentLinkData = linkSnap.data();
        const maxUses = currentLinkData.maxUses || 0;
        const currentUses = currentLinkData.uses || 0;

        if (maxUses > 0 && currentUses >= maxUses) {
            throw new Error("Este link já atingiu o número máximo de usos.");
        }
        
        const courseIdsToGrant: string[] = currentLinkData.courseIds || [];
        
        if (courseIdsToGrant.length === 0) {
            toast({ title: "Nenhum curso encontrado", description: "Este link não está associado a nenhum curso."});
            router.push('/dashboard');
            return;
        }
        
        setStatusMessage(`Concedendo acesso a ${courseIdsToGrant.length} curso(s)...`);

        const batch = writeBatch(firestore);
        
        for (const courseId of courseIdsToGrant) {
            const accessRef = doc(firestore, `users/${user.uid}/courseAccess`, courseId);
            // We check for existence within the transaction
            const accessDoc = await transaction.get(accessRef);
            if (!accessDoc.exists()) {
                batch.set(accessRef, {
                    courseId: courseId,
                    grantedAt: serverTimestamp(),
                    redeemedByLink: linkId,
                });
            }
        }
        
        // Only commit if there are changes
        if (batch.length > 0) {
             await batch.commit();
        }

        // Update the link usage
        const newUses = increment(1);
        if (maxUses > 0 && currentUses + 1 >= maxUses) {
          transaction.update(linkRef, { uses: newUses, active: false });
        } else {
          transaction.update(linkRef, { uses: newUses });
        }
      });
      
      toast({ title: "Acesso Liberado!", description: "Os cursos foram adicionados à sua conta." });
      router.push('/dashboard');

    } catch (e: any) {
        console.error("Redemption transaction error: ", e);
        setError(e.message || "Não foi possível resgatar o acesso. Por favor, contate o suporte.");
        setLoading(false);
    }

  }, [firestore, linkId, router, toast]);

  useEffect(() => {
    if (!auth || !linkId) {
        if (!auth) setError("Serviço de autenticação indisponível.");
        if (!linkId) setError("ID do link não encontrado.");
        setLoading(false);
        return;
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, proceed to redeem access.
            await redeemAccess(user);
        } else {
            // No user is signed in, save the path and redirect to login.
            setStatusMessage("Redirecionando para a área de acesso...");
            localStorage.setItem("redirectAfterLogin", `/redeem/${linkId}`);
            router.push(`/login?message=${encodeURIComponent("Crie uma conta para acessar seus cursos")}`);
        }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth, linkId, redeemAccess, router]);
  
  if (error) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
            <Lock className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-bold text-white">Erro ao Resgatar Acesso</h1>
            <p className="text-muted-foreground mt-2">{error}</p>
            <Button asChild className="mt-6">
                <Link href="/dashboard">Voltar ao Início</Link>
            </Button>
        </div>
    );
  }
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
        <h1 className="text-2xl font-bold text-white">Um momento...</h1>
        <p className="text-muted-foreground mt-2">{statusMessage}</p>
    </div>
  );
}
