'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

import AdminGuard from '@/components/admin/admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const addCourseSchema = z.object({
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres.'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
});

type AddCourseFormValues = z.infer<typeof addCourseSchema>;

function AddCourseForm() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddCourseFormValues>({
    resolver: zodResolver(addCourseSchema),
    defaultValues: {
        title: '',
        description: '',
    }
  });

  const onSubmit = async (data: AddCourseFormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);
    
    // For simplicity, using a placeholder thumbnail and video URL.
    // A real implementation would involve file uploads.
    const videoId = uuidv4();
    const thumbnailUrl = `https://picsum.photos/seed/${videoId}/400/225`;
    const videoUrl = ''; // Placeholder

    try {
      await addDoc(collection(firestore, 'courses'), {
        title: data.title,
        description: data.description,
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        createdAt: new Date(),
      });

      toast({
        title: "Sucesso!",
        description: "O curso foi criado. Agora você pode adicionar módulos e vídeos.",
      });
      router.push('/admin'); // Redirect to admin panel to see the new course
    } catch (error) {
      console.error('Error creating course:', error);
      toast({
        variant: "destructive",
        title: "Erro ao criar curso",
        description: "Ocorreu um erro ao salvar o curso. Verifique as permissões.",
      });
    } finally {
        setIsSubmitting(false);
    }
  };
  

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
       <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o Painel
            </Link>
          </Button>
        </div>
      <Card>
         <CardHeader>
          <CardTitle>Adicionar Novo Curso</CardTitle>
          <CardDescription>
            Preencha os detalhes iniciais do curso. Você poderá adicionar módulos e vídeos depois.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Título do Curso</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: VSL do Zero ao Lançamento" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Descrição</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Descreva o que o aluno irá aprender..." {...field} rows={5} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <div className="mt-12">
                        <h2 className="text-xl font-bold text-white mb-4">Módulos e Aulas</h2>
                        <div className="p-8 rounded-lg bg-secondary text-center text-muted-foreground">
                            <p>Em breve: Salve o curso para poder adicionar módulos e aulas.</p>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Salvando...' : 'Salvar Curso'}
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
      </Card>
    </div>
  );
}


export default function AddCoursePage() {
    return (
        <AdminGuard>
            <AddCourseForm />
        </AdminGuard>
    )
}
