'use client';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

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
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const onSubmit = async (data: RegisterFormValues) => {
    if (!auth || !firestore) return;
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const newUser = userCredential.user;

      // Assign role based on email
      const userRole = data.email === 'admin@reidavsl.com' ? 'admin' : 'user';

      // Create a user profile in Firestore
      await setDoc(doc(firestore, 'users', newUser.uid), {
        email: newUser.email,
        displayName: newUser.email?.split('@')[0] || 'Novo Usuário',
        photoURL: '',
        role: userRole,
      });

      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error signing up', error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este email já está em uso. Tente fazer login.');
      } else {
        setAuthError('Ocorreu um erro ao criar a conta. Tente novamente mais tarde.');
      }
    }
  };

    if (loading || user) {
    return <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Criar Conta</h1>
          <p className="mt-2 text-muted-foreground">Junte-se à nossa comunidade de criadores de VSLs.</p>
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
                    <Input type="password" placeholder="Crie uma senha forte" {...field} className="bg-secondary/50 border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {authError && <p className="text-sm font-medium text-destructive">{authError}</p>}
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={form.formState.isSubmitting}>
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
