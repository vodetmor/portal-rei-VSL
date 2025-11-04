
'use client';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter, useParams } from 'next/navigation';
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

const authSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

type AuthFormValues = z.infer<typeof authSchema>;

interface PremiumLinkData {
    name: string;
    courseIds: string[];
    courses: { id: string; title: string; }[];
}

export default function PremiumAccessPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const linkId = params.linkId as string;
  
  const [linkData, setLinkData] = useState<PremiumLinkData | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formMode, setFormMode] = useState<'login' | 'register'>('login');

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' },
  });

  const fetchLinkData = useCallback(async () => {
    if (!firestore || !linkId) return;

    setLoadingLink(true);
    setError(null);
    try {
      const linkRef = doc(firestore, 'premiumLinks', linkId);
      const linkSnap = await getDoc(linkRef);

      if (!linkSnap.exists()) {
        setError("Este link de acesso é inválido ou expirou.");
        return;
      }

      const link = linkSnap.data();
      const coursePromises = (link.courseIds || []).map((id: string) => getDoc(doc(firestore, 'courses', id)));
      const courseSnaps = await Promise.all(coursePromises);
      const courses = courseSnaps
        .filter(snap => snap.exists() && snap.data()?.status === 'published')
        .map(snap => ({ id: snap.id, title: snap.data()?.title || 'Curso Desconhecido' }));

      setLinkData({
        name: link.name,
        courseIds: link.courseIds,
        courses: courses,
      });

    } catch (err: any) {
        if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: `premiumLinks/${linkId}`, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
            setError("Você não tem permissão para visualizar este link. Faça o login para continuar.");
        } else {
            console.error(err);
            setError("Ocorreu um erro ao verificar o link de acesso.");
        }
    } finally {
      setLoadingLink(false);
    }
  }, [firestore, linkId]);

  useEffect(() => {
    // This effect handles the core logic based on authentication state
    if (userLoading) {
      // Still checking auth state, do nothing yet. The loading spinner will show.
      return;
    }

    if (user) {
      // User is logged in, redirect to the dashboard to handle redemption securely.
      router.push(`/dashboard?linkId=${linkId}`);
    } else {
      // No user is logged in. It's now safe to fetch public link data if we wanted to,
      // but for max security, we will just show the login form.
      // We can fetch minimal data here if rules were public.
      // For now, just stop the main loading spinner.
      setLoadingLink(false);
    }
  }, [user, userLoading, router, linkId, fetchLinkData]);


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
    if (!auth || !firestore || !linkId) return;
    setAuthError(null);

    try {
        let userCredential;
        if (formMode === 'login') {
            userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        } else {
            userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const userDocRef = doc(firestore, 'users', userCredential.user.uid);
            const userDocData = {
                email: userCredential.user.email,
                displayName: userCredential.user.email?.split('@')[0] || 'Novo Usuário',
                photoURL: '',
                role: 'user',
            };
            await setDoc(userDocRef, userDocData).catch(err => {
                const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'create', requestResourceData: userDocData });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
        
        // After successful login/signup, the useEffect will detect the user change and redirect to the dashboard.
        // No manual redirect is needed here.

    } catch (error: any) {
        const message = mapFirebaseError(error.code);
        setAuthError(message);
        console.error(`Error during ${formMode}`, error);
    }
  };
  
  // This is the main loading gate. It waits for the initial user check.
  if (userLoading || user) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  
  // If we are here, it means userLoading is false AND user is null.
  // We show the login/register form.

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
            <Lock className="mx-auto h-10 w-10 text-primary mb-4" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
                Acesso Premium
            </h1>
            <p className="mt-2 text-muted-foreground">
                {formMode === 'login' ? 'Faça login para resgatar seu acesso.' : 'Crie uma conta para resgatar seu acesso.'}
            </p>
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
              {form.formState.isSubmitting ? 'Processando...' : (formMode === 'login' ? 'Entrar e Resgatar' : 'Criar Conta e Resgatar')}
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
