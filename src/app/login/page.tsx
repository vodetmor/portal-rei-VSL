
'use client';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(1, { message: 'A senha não pode estar em branco.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px" {...props}>
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.618-3.317-11.28-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C44.193,35.536,46,30.028,46,24C46,22.345,45.535,20.78,44.86,19.355L43.611,20.083z"/>
        </svg>
    )
}

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const customMessage = params.get('message');
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (user && !user.isAnonymous && !loading) {
        const redirectPath = localStorage.getItem('redirectAfterLogin');
        localStorage.removeItem('redirectAfterLogin'); // Limpa após o uso
        router.push(redirectPath || '/dashboard');
    }
  }, [user, loading, router]);

  const mapFirebaseError = (code: string) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Credenciais inválidas. Verifique seu e-mail e senha.';
      case 'auth/invalid-email':
          return "Email inválido.";
      case 'auth/too-many-requests':
        return "Muitas tentativas. Tente mais tarde.";
      case 'auth/popup-closed-by-user':
        return "O pop-up de login foi fechado. Tente novamente.";
      default:
        return 'Ocorreu um erro ao fazer login. Tente novamente mais tarde.';
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore) return;
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if user exists in Firestore
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            // Create user document if it doesn't exist
            await setDoc(userDocRef, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: 'user', // default role
            });
        }
        // Redirection is handled by the useEffect
    } catch (error: any) {
        const message = mapFirebaseError(error.code);
        setAuthError(message);
        console.error('Error signing in with Google', error);
    }
  }

  const onSubmit = async (data: LoginFormValues) => {
    if (!auth) return;
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // The useEffect will handle redirection once the user state updates.
    } catch (error: any) {
      const message = mapFirebaseError(error.code);
      setAuthError(message);
      console.error('Error signing in', error);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>;
  }
  
  if (user && !user.isAnonymous) {
      return <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Acessar Plataforma
          </h1>
          <p className="mt-2 text-muted-foreground">
            Faça login para acessar a área de membros.
          </p>
        </div>

        {customMessage && (
          <Alert>
            <AlertDescription className="text-center">
              {decodeURIComponent(customMessage)}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            <GoogleIcon className="mr-2 h-6 w-6" />
            Continuar com Google
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Ou continue com
            </span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Email</FormLabel>
                  <FormControl>
                    <Input placeholder="seu@email.com" {...field} className="bg-secondary/50 border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="Sua senha" 
                        {...field} 
                        className="bg-secondary/50 border-border pr-10" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-white"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {authError && <p className="text-sm font-medium text-destructive">{authError}</p>}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Não tem uma conta?{' '}
          <Link href={`/register`} className="font-medium text-primary hover:underline">
            Cadastre-se
          </Link>
        </div>
      </div>
    </div>
  );
}

    