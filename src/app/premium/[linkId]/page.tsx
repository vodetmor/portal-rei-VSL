
'use client';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
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

    try {
      const linkRef = doc(firestore, 'premiumLinks', linkId);
      const linkSnap = await getDoc(linkRef);

      if (!linkSnap.exists()) {
        setError("Este link de acesso é inválido ou expirou.");
        return;
      }

      const link = linkSnap.data();
      const coursePromises = link.courseIds.map((id: string) => getDoc(doc(firestore, 'courses', id)));
      const courseSnaps = await Promise.all(coursePromises);
      const courses = courseSnaps
        .filter(snap => snap.exists() && snap.data()?.status === 'published')
        .map(snap => ({ id: snap.id, title: snap.data()?.title || 'Curso Desconhecido' }));

      setLinkData({
        name: link.name,
        courseIds: link.courseIds,
        courses: courses,
      });

    } catch (err) {
      console.error(err);
      setError("Ocorreu um erro ao verificar o link de acesso.");
    } finally {
      setLoadingLink(false);
    }
  }, [firestore, linkId]);

  useEffect(() => {
    fetchLinkData();
  }, [fetchLinkData]);
  
  const redirectIfLoggedIn = useCallback(() => {
    if (user && !userLoading) {
      toast({ title: "Acesso Premium", description: "Verificando seus cursos..." });
      router.push(`/dashboard?linkId=${linkId}`);
    }
  }, [user, userLoading, router, toast, linkId]);

  useEffect(() => {
    redirectIfLoggedIn();
  }, [redirectIfLoggedIn]);


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
    if (!auth || !firestore || !linkData) return;
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
            // Non-blocking write
            setDoc(userDocRef, userDocData).catch(err => {
                const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'create', requestResourceData: userDocData });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
        
        // Redirect to dashboard with linkId, let dashboard handle access grant
        router.push(`/dashboard?linkId=${linkId}`);

    } catch (error: any) {
        const message = mapFirebaseError(error.code);
        setAuthError(message);
        console.error(`Error during ${formMode}`, error);
    }
  };
  
  if (userLoading || loadingLink) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  
  if (error) {
    return <div className="flex min-h-screen items-center justify-center text-center text-destructive px-4"><h1>{error}</h1></div>;
  }

  // This prevents the form from flashing for already logged-in users while redirecting
  if (user) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
            <Lock className="mx-auto h-10 w-10 text-primary mb-4" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
                Acesso Premium
            </h1>
            <p className="mt-2 text-muted-foreground">
                {formMode === 'login' ? 'Faça login para acessar:' : 'Crie uma conta para acessar:'}
            </p>
            <p className="mt-1 font-semibold text-primary">{linkData?.courses.map(c => c.title).join(', ')}</p>
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
