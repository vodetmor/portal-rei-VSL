'use client';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

export default function LoginPage() {
  const auth = useAuth();
  const { user, loading } = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const customMessage = params.get('message');
  
  // Do not get redirectUrl from params anymore, we'll use localStorage
  // const redirectUrl = params.get('redirect');

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    // This effect is for users who are already logged in and land here.
    if (user && !user.isAnonymous && !loading) {
        const redirectPath = localStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          localStorage.removeItem('redirectAfterLogin');
          router.push(redirectPath);
        } else {
          router.push('/dashboard');
        }
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
      default:
        return 'Ocorreu um erro ao fazer login. Tente novamente mais tarde.';
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    if (!auth) return;
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // The useEffect will handle redirection once the user state updates.
      // The logic is now inside the useEffect to also handle users who land here already logged in.
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
  
  // Render form if user is not logged in
  if (!user || user.isAnonymous) {
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

  // If user is logged in, show a loading spinner while redirecting.
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
