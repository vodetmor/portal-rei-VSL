'use client';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center">
        <h1 className="text-5xl font-bold mb-4 text-white">Bem-vindo ao Portal <span className="brand-red">Rei da VSL</span></h1>
        <p className="text-xl text-muted-foreground mb-8">Sua plataforma para dominar a arte das VSLs.</p>
        <div className="flex gap-4">
            <Button asChild size="lg" className="bg-brand-red text-white hover:bg-brand-red-dark">
                <Link href="/login">Acessar Plataforma</Link>
            </Button>
             <Button asChild variant="outline" size="lg">
                <Link href="/register">Criar Conta</Link>
            </Button>
        </div>
      </main>
    );
  }

  return null;
}
