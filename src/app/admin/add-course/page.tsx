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
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const addCourseSchema = z.object({
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres.'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
});

type AddCourseFormValues = z.infer<typeof addCourseSchema>;

interface Lesson {
    id: string;
    title: string;
}
  
interface Module {
    id: string;
    title: string;
    lessons: Lesson[];
}

function AddCourseForm() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);

  const form = useForm<AddCourseFormValues>({
    resolver: zodResolver(addCourseSchema),
    defaultValues: {
        title: '',
        description: '',
    }
  });

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
        ? { ...m, lessons: [...m.lessons, { id: uuidv4(), title: '' }] }
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


  const onSubmit = async (data: AddCourseFormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);
    
    // For simplicity, using a placeholder thumbnail and video URL.
    // A real implementation would involve file uploads.
    const videoId = uuidv4();
    const thumbnailUrl = `https://picsum.photos/seed/${videoId}/400/225`;
    const videoUrl = ''; // Placeholder

    try {
      const courseDocRef = await addDoc(collection(firestore, 'courses'), {
        title: data.title,
        description: data.description,
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        createdAt: new Date(),
        modules: modules.map(({ id, ...rest }) => rest), // Don't save temporary UUIDs
      });

      toast({
        title: "Sucesso!",
        description: "O curso foi criado. Agora você pode adicionar módulos e vídeos.",
      });
      router.push(`/admin/edit-course/${courseDocRef.id}`);
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
            Preencha os detalhes iniciais do curso e adicione os módulos e aulas.
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
                                <div className="pl-4 space-y-2">
                                    {module.lessons.map((lesson, lessonIndex) => (
                                        <div key={lesson.id} className="flex items-center gap-2">
                                            <Input
                                                placeholder={`Título da Aula ${lessonIndex + 1}`}
                                                value={lesson.title}
                                                onChange={(e) => updateLessonTitle(module.id, lesson.id, e.target.value)}
                                            />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeLesson(module.id, lesson.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive/70" />
                                            </Button>
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
