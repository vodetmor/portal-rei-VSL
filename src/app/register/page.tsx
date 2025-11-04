
'use client';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Alert, AlertDescription } from '@/components/ui/alert';

const registerSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const customMessage = params.get('message');


  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (user && !user.isAnonymous && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const mapFirebaseError = (code: string | undefined) => {
    switch (code) {
      case "auth/email-already-in-use":
        return "Este email já está em uso.";
      case "auth/invalid-email":
        return "Email inválido.";
      case "auth/weak-password":
        return "Senha fraca. Escolha uma senha mais segura.";
      default:
        return "Erro ao criar conta. Tente novamente.";
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    if (!auth || !firestore) {
        setAuthError('O serviço de autenticação não está disponível. Tente novamente mais tarde.');
        return;
    };
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const newUser = userCredential.user;

      const userRole = data.email === 'admin@reidavsl.com' ? 'admin' : 'user';
      const userDocRef = doc(firestore, 'users', newUser.uid);
      const userDocData = {
        email: newUser.email,
        displayName: newUser.email?.split('@')[0] || 'Novo Usuário',
        photoURL: '',
        role: userRole,
      };

      // Non-blocking write with specific error handling
      setDoc(userDocRef, userDocData)
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'create',
                requestResourceData: userDocData
            });
            errorEmitter.emit('permission-error', permissionError);
        });

      router.push('/dashboard');

    } catch (error: any) {
      const message = mapFirebaseError(error.code);
      setAuthError(message);
      // This catch block handles errors from createUserWithEmailAndPassword, not setDoc
    }
  };

    if (loading || (user && !user.isAnonymous)) {
    return <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Criar Conta</h1>
          <p className="mt-2 text-muted-foreground">Junte-se à nossa comunidade de criadores de VSLs.</p>
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
                        placeholder="Crie uma senha forte" 
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
              {form.formState.isSubmitting ? 'Criando...' : 'Criar Conta'}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Já tem uma conta?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Faça login
          </Link>
        </div>
      </div>
    </div>
  );
}
