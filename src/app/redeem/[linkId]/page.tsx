'use client';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, writeBatch, serverTimestamp, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Alert, AlertDescription } from '@/components/ui/alert';

const authSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

type AuthFormValues = z.infer<typeof authSchema>;

interface PremiumLinkData {
    name: string;
    courseIds: string[];
    courses: { id: string; title: string; }[];
    maxUses: number;
    uses: number;
    active: boolean;
}

export default function PremiumAccessPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const linkId = params.linkId as string;
  
  const [linkData, setLinkData] = useState<PremiumLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formMode, setFormMode] = useState<'login' | 'register'>('login');
  
  const customMessage = searchParams.get('message');


  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' },
  });

  const redeemAccess = useCallback(async (user: any) => {
    if (!firestore || !linkId || !user) return;

    const linkRef = doc(firestore, 'premiumLinks', linkId);
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const linkSnap = await transaction.get(linkRef);
        if (!linkSnap.exists() || !linkSnap.data()?.active) {
            throw new Error("Link inválido ou expirado.");
        }

        const currentLinkData = linkSnap.data();
        const maxUses = currentLinkData.maxUses || 0;
        const currentUses = currentLinkData.uses || 0;

        if (maxUses !== 0 && currentUses >= maxUses) {
            throw new Error("Este link já atingiu o número máximo de usos.");
        }
        
        const courseIdsToGrant = currentLinkData.courseIds || [];
        const accessCollectionRef = collection(firestore, `users/${user.uid}/courseAccess`);
        
        // This is a simplified check. A more robust check would query the subcollection.
        // For this flow, we grant access idempotently.
        const batch = writeBatch(firestore);
        courseIdsToGrant.forEach((courseId: string) => {
            const accessRef = doc(accessCollectionRef, courseId);
            batch.set(accessRef, {
                courseId: courseId,
                grantedAt: serverTimestamp(),
                redeemedByLink: linkId,
            });
        });
        await batch.commit();

        if (maxUses !== 0) {
            transaction.update(linkRef, { 
                uses: increment(1),
                active: (currentUses + 1) >= maxUses ? false : true 
            });
        } else {
            transaction.update(linkRef, { uses: increment(1) });
        }
      });
      
      toast({ title: "Acesso Liberado!", description: "Os cursos foram adicionados à sua conta." });
      router.push('/dashboard');

    } catch (e: any) {
        console.error("Redemption error: ", e);
        setError(e.message || "Não foi possível resgatar o acesso.");
        setLoading(false);
    }

  }, [firestore, linkId, router, toast]);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is logged in, proceed to redeem.
            await redeemAccess(user);
        } else {
            // No user is signed in, show the login/register form.
            setLoading(false);
        }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth, redeemAccess]);

  const mapFirebaseError = (code: string) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Credenciais inválidas. Verifique seu e-mail e senha.';
      case 'auth/email-already-in-use':
        return 'Este email já está em uso. Tente fazer login.';
      case 'auth/invalid-email':
          return "Email inválido.";
      case 'auth/weak-password':
          return "Senha fraca. A senha deve ter pelo menos 6 caracteres.";
      case 'auth/too-many-requests':
        return "Muitas tentativas. Tente mais tarde.";
      default:
        return 'Ocorreu um erro. Tente novamente mais tarde.';
    }
  };

  const onSubmit = async (data: AuthFormValues) => {
    if (!auth || !firestore) return;
    setAuthError(null);

    try {
        if (formMode === 'login') {
            await signInWithEmailAndPassword(auth, data.email, data.password);
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const userDocRef = doc(firestore, 'users', userCredential.user.uid);
            const userDocData = {
                email: userCredential.user.email,
                displayName: userCredential.user.email?.split('@')[0] || 'Novo Usuário',
                photoURL: '',
                role: 'user',
            };
            setDoc(userDocRef, userDocData).catch(err => {
                const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'create', requestResourceData: userDocData });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
        // The onAuthStateChanged listener will handle the redirection and redemption.
    } catch (error: any) {
        const message = mapFirebaseError(error.code);
        setAuthError(message);
        console.error(`Error during ${formMode}`, error);
    }
  };
  
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  
  if (error) {
    return <div className="flex min-h-screen items-center justify-center text-center text-destructive px-4"><h1>{error}</h1></div>;
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
            <Lock className="mx-auto h-10 w-10 text-primary mb-4" />
             <h1 className="text-2xl font-bold tracking-tight text-white">
                Crie uma conta para você acessar seus cursos
            </h1>
            <p className="mt-2 text-muted-foreground">
                Você está resgatando um acesso premium.
            </p>
             {customMessage && (
              <Alert className="mt-4">
                <AlertDescription className="text-center">
                  {decodeURIComponent(customMessage)}
                </AlertDescription>
              </Alert>
            )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Email</FormLabel>
                  <FormControl><Input placeholder="seu@email.com" {...field} className="bg-secondary/50 border-border" /></FormControl>
                  <FormMessage />
                </FormItem>
            )}/>
            <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} placeholder="Sua senha" {...field} className="bg-secondary/50 border-border pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-white">
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )}/>
            {authError && <p className="text-sm font-medium text-destructive">{authError}</p>}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Processando...' : (formMode === 'login' ? 'Entrar e Acessar' : 'Criar Conta e Acessar')}
            </Button>
          </form>
        </Form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {formMode === 'login' ? "Não tem uma conta?" : "Já tem uma conta?"}{' '}
          <button onClick={() => setFormMode(formMode === 'login' ? 'register' : 'login')} className="font-medium text-primary hover:underline">
            {formMode === 'login' ? 'Cadastre-se' : 'Faça login'}
          </button>
        </div>

      </div>
    </div>
  );
}