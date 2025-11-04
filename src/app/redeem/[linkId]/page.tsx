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

    setStatusMessage("Validando o link de acesso...");
    const linkRef = doc(firestore, 'premiumLinks', linkId);
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const linkSnap = await transaction.get(linkRef);
        if (!linkSnap.exists() || !linkSnap.data()?.active) {
            throw new Error("Este link de acesso é inválido ou expirou.");
        }

        const currentLinkData = linkSnap.data();
        const maxUses = currentLinkData.maxUses || 0; // 0 for unlimited
        const currentUses = currentLinkData.uses || 0;

        if (maxUses > 0 && currentUses >= maxUses) {
            throw new Error("Este link já atingiu o número máximo de usos.");
        }
        
        const courseIdsToGrant: string[] = currentLinkData.courseIds || [];
        
        if (courseIdsToGrant.length === 0) {
            toast({ title: "Nenhum curso encontrado", description: "Este link não está associado a nenhum curso."});
            return; 
        }
        
        setStatusMessage(`Concedendo acesso a ${courseIdsToGrant.length} curso(s)...`);

        const accessCheckPromises = courseIdsToGrant.map(courseId => 
            transaction.get(doc(firestore, `users/${user.uid}/courseAccess`, courseId))
        );
        const accessDocs = await Promise.all(accessCheckPromises);
        
        const coursesToActuallyGrant = courseIdsToGrant.filter((_, index) => !accessDocs[index].exists());
        
        if (coursesToActuallyGrant.length > 0) {
            const batch = writeBatch(transaction.firestore);
            coursesToActuallyGrant.forEach(courseId => {
                const accessRef = doc(firestore, `users/${user.uid}/courseAccess`, courseId);
                 batch.set(accessRef, {
                    courseId: courseId,
                    grantedAt: serverTimestamp(),
                    redeemedByLink: linkId,
                });
            });
            await batch.commit(); 
        }

        const newUses = increment(1);
        if (maxUses > 0 && currentUses + 1 >= maxUses) {
          transaction.update(linkRef, { uses: newUses, active: false });
        } else {
          transaction.update(linkRef, { uses: newUses });
        }
        
        toast({ title: "Acesso Liberado!", description: `${coursesToActuallyGrant.length > 0 ? `${coursesToActuallyGrant.length} novo(s) curso(s) foram adicionados à sua conta.` : 'Você já possui acesso a todos os cursos deste link.'}` });
      });
      
      router.push('/dashboard');

    } catch (e: any) {
        console.error("Redemption transaction error: ", e);
        setError(e.message || "Não foi possível resgatar o acesso. Por favor, contate o suporte.");
        setLoading(false);
    }

  }, [firestore, linkId, router, toast]);

  useEffect(() => {
    if (!auth || !linkId) {
        setLoading(false);
        setError("Ocorreu um erro de inicialização.");
        return;
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuário está logado, pode prosseguir com o resgate
            redeemAccess(user);
        } else {
            // Usuário não está logado, redireciona para login
            setStatusMessage("Redirecionando para a área de acesso...");
            localStorage.setItem("redirectAfterLogin", `/redeem/${linkId}`);
            router.push(`/login`);
        }
    });

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
  
  if(loading) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
            <h1 className="text-2xl font-bold text-white">Um momento...</h1>
            <p className="text-muted-foreground mt-2">{statusMessage}</p>
        </div>
    );
  }

  // Se o carregamento terminou e não houve erro, o redirecionamento já terá ocorrido.
  // Este retorno é apenas um fallback.
  return null;
}
