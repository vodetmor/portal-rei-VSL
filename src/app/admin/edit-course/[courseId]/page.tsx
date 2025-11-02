'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc, DocumentData } from 'firebase/firestore';

import AdminGuard from '@/components/admin/admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const editCourseSchema = z.object({
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres.'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
});

type EditCourseFormValues = z.infer<typeof editCourseSchema>;

interface Course extends DocumentData {
  id: string;
  title: string;
  description: string;
}

function EditCourseForm() {
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditCourseFormValues>({
    resolver: zodResolver(editCourseSchema),
  });

  useEffect(() => {
    if (!firestore || !courseId) return;

    const fetchCourse = async () => {
      setLoading(true);
      try {
        const courseRef = doc(firestore, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);

        if (courseSnap.exists()) {
          const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
          setCourse(courseData);
          form.reset({
            title: courseData.title,
            description: courseData.description,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Erro",
            description: "Curso não encontrado.",
          });
          router.push('/admin');
        }
      } catch (error) {
        console.error('Error fetching course:', error);
        toast({
            variant: "destructive",
            title: "Erro de Permissão",
            description: "Você não tem permissão para carregar este curso.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [firestore, courseId, router, form, toast]);

  const onSubmit = async (data: EditCourseFormValues) => {
    if (!firestore || !courseId) return;
    setIsSubmitting(true);

    try {
      const courseRef = doc(firestore, 'courses', courseId);
      await updateDoc(courseRef, data);
      toast({
        title: "Sucesso!",
        description: "O curso foi atualizado.",
      });
      router.push('/admin');
    } catch (error) {
      console.error('Error updating course:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: "Ocorreu um erro ao salvar as alterações. Verifique as permissões.",
      });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (loading) {
    return (
        <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!course) {
    return null; // Or show a not found message, handled by the redirect in useEffect
  }


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
          <CardTitle>Editar Curso: {course.title}</CardTitle>
          <CardDescription>
            Faça alterações nos detalhes do curso abaixo.
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
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
      </Card>
    </div>
  );
}


export default function EditCoursePage() {
    return (
        <AdminGuard>
            <EditCourseForm />
        </AdminGuard>
    )
}
