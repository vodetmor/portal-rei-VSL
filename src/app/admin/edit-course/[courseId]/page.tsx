'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc, deleteDoc, DocumentData } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';


import AdminGuard from '@/components/admin/admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const editCourseSchema = z.object({
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres.'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
});

type EditCourseFormValues = z.infer<typeof editCourseSchema>;

interface Lesson {
    id: string;
    title: string;
    videoUrl: string;
}
  
interface Module {
    id: string;
    title: string;
    lessons: Lesson[];
}

interface Course extends DocumentData {
  id: string;
  title: string;
  description: string;
  modules: Module[];
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);

  const form = useForm<EditCourseFormValues>({
    resolver: zodResolver(editCourseSchema),
    defaultValues: {
        title: '',
        description: '',
    }
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
          // Add temporary UUIDs for client-side key management
          const initialModules = (courseData.modules || []).map(m => ({
            ...(m as Omit<Module, 'id'>),
            id: uuidv4(),
            lessons: (m.lessons || []).map((l: Omit<Lesson, 'id'>) => ({ ...l, id: uuidv4() }))
          }));
          setModules(initialModules);
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

    // Module and Lesson handlers
    const addModule = () => {
        setModules([...modules, { id: uuidv4(), title: '', lessons: [] }]);
    };
    
    const removeModule = (moduleId: string) => {
        setModules(modules.filter(m => m.id !== moduleId));
    };

    const updateModuleTitle = (moduleId: string, title: string) => {
        setModules(modules.map(m => m.id === moduleId ? { ...m, title } : m));
    };
    
    const addLesson = (moduleId: string) => {
        setModules(modules.map(m => 
        m.id === moduleId 
            ? { ...m, lessons: [...m.lessons, { id: uuidv4(), title: '', videoUrl: '' }] }
            : m
        ));
    };

    const removeLesson = (moduleId: string, lessonId: string) => {
        setModules(modules.map(m => 
            m.id === moduleId 
            ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) }
            : m
        ));
    };

    const updateLessonTitle = (moduleId: string, lessonId: string, title: string) => {
        setModules(modules.map(m => 
        m.id === moduleId 
            ? { ...m, lessons: m.lessons.map(l => l.id === lessonId ? { ...l, title } : l) }
            : m
        ));
    };

    const updateLessonVideoUrl = (moduleId: string, lessonId: string, videoUrl: string) => {
        setModules(modules.map(m => 
          m.id === moduleId 
            ? { ...m, lessons: m.lessons.map(l => l.id === lessonId ? { ...l, videoUrl } : l) }
            : m
        ));
    };

  const onSubmit = async (data: EditCourseFormValues) => {
    if (!firestore || !courseId) return;
    setIsSubmitting(true);

    try {
      const courseRef = doc(firestore, 'courses', courseId);
      await updateDoc(courseRef, {
        ...data,
        modules: modules.map(({ id, ...restModule }) => ({
            ...restModule,
            lessons: restModule.lessons.map(({ id: lessonId, ...restLesson }) => restLesson)
        })), // Strip temporary IDs before saving
      });
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

  const handleDelete = async () => {
    if (!firestore || !courseId) return;
    setIsDeleting(true);

    try {
        await deleteDoc(doc(firestore, 'courses', courseId));
        toast({
            title: "Curso Excluído",
            description: "O curso foi removido com sucesso.",
        });
        router.push('/admin');
    } catch (error) {
        console.error("Error deleting course: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao Excluir",
            description: "Não foi possível excluir o curso. Verifique as permissões."
        });
        setIsDeleting(false);
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
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>Editar Curso: {course.title}</CardTitle>
                    <CardDescription className="mt-2">
                        Faça alterações nos detalhes, módulos e aulas do curso abaixo.
                    </CardDescription>
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isSubmitting || isDeleting}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Curso
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso irá excluir permanentemente o curso e todos os seus dados.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
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

                    <Separator />

                    {/* Modules and Lessons Section */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Módulos e Aulas</h2>
                            <Button type="button" variant="outline" size="sm" onClick={addModule}>
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar Módulo
                            </Button>
                        </div>
                        
                        <div className="space-y-4">
                        {modules.map((module, moduleIndex) => (
                            <div key={module.id} className="bg-secondary/50 p-4 rounded-lg space-y-4 border border-border">
                                <div className="flex items-center gap-2">
                                    <Input 
                                        placeholder={`Título do Módulo ${moduleIndex + 1}`}
                                        value={module.title}
                                        onChange={(e) => updateModuleTitle(module.id, e.target.value)}
                                        className="font-semibold"
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeModule(module.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                                <div className="pl-4 space-y-3">
                                    {module.lessons.map((lesson, lessonIndex) => (
                                        <div key={lesson.id} className="flex flex-col gap-2 p-3 rounded-md border border-border/50 bg-background/30">
                                             <div className="flex items-center gap-2">
                                                <Input
                                                    placeholder={`Título da Aula ${lessonIndex + 1}`}
                                                    value={lesson.title}
                                                    onChange={(e) => updateLessonTitle(module.id, lesson.id, e.target.value)}
                                                />
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeLesson(module.id, lesson.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive/70" />
                                                </Button>
                                            </div>
                                            <Input
                                                placeholder="URL do Vídeo da Aula (Ex: https://...)"
                                                value={lesson.videoUrl}
                                                onChange={(e) => updateLessonVideoUrl(module.id, lesson.id, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" variant="link" size="sm" onClick={() => addLesson(module.id)}>
                                    <Plus className="mr-2 h-4 w-4" /> Adicionar Aula
                                </Button>
                            </div>
                        ))}
                        {modules.length === 0 && (
                            <div className="p-8 rounded-lg bg-secondary text-center text-muted-foreground">
                                <p>Nenhum módulo adicionado ainda. Clique em "Adicionar Módulo" para começar.</p>
                            </div>
                        )}
                        </div>
                    </div>


                    <div className="flex justify-end mt-8">
                        <Button type="submit" disabled={isSubmitting || isDeleting}>
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
