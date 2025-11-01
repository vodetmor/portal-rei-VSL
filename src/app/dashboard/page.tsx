'use client';
import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  }

  if (!user) {
    return null; // or a redirect component
  }

  return (
    <div className="container mx-auto p-4 pt-20">
      <h1 className="text-4xl font-bold">Área de Membros</h1>
      <p className="text-muted-foreground mt-2">Bem-vindo(a) de volta, {user.displayName || 'Membro'}!</p>
      
      {/* Placeholder for course content */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {/* Course cards will go here */}
         <div className="h-64 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
            <p className="text-muted-foreground">Conteúdo do Curso em Breve...</p>
         </div>
         <div className="h-64 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
            <p className="text-muted-foreground">Conteúdo do Curso em Breve...</p>
         </div>
         <div className="h-64 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
            <p className="text-muted-foreground">Conteúdo do Curso em Breve...</p>
         </div>
      </div>
    </div>
  );
}
