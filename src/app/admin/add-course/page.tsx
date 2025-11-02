'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
import { ArrowLeft, Plus, Trash2, Upload, Link2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const addCourseSchema = z.object({
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres.'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
});

type AddCourseFormValues = z.infer<typeof addCourseSchema>;

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

const DEFAULT_COURSE_IMAGE = "https://placehold.co/400x600/0f0f0f/b3b3b3?text=400x600";

function AddCourseForm() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);

  const [tempImage, setTempImage] = useState(DEFAULT_COURSE_IMAGE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [newCourseId, setNewCourseId] = useState<string | null>(null);

  const form = useForm<AddCourseFormValues>({
    resolver: zodResolver(addCourseSchema),
    defaultValues: {
        title: '',
        description: '',
    }
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setImageUrlInput(newUrl);
    if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
      setTempImage(newUrl);
    }
  };

  const handleRemoveImage = () => {
    setTempImage(DEFAULT_COURSE_IMAGE);
    setImageUrlInput('');
    setImageFile(null);
  };

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


  const onSubmit = async (data: AddCourseFormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);
    setUploadProgress(null);

    let finalImageUrl = DEFAULT_COURSE_IMAGE;
    
    try {
        if (imageInputMode === 'upload' && imageFile) {
            const storage = getStorage();
            const storageRef = ref(storage, `courses/${uuidv4()}/${imageFile.name}`);
            const uploadTask = uploadBytesResumable(storageRef, imageFile);

            finalImageUrl = await new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                    (error) => {
                        console.error("Upload failed:", error);
                        toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar a imagem." });
                        reject(error);
                    },
                    () => getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject)
                );
            });
        } else if (imageInputMode === 'url' && imageUrlInput) {
            finalImageUrl = imageUrlInput;
        }

        const courseData = {
            title: data.title,
            description: data.description,
            videoUrl: '', 
            thumbnailUrl: finalImageUrl,
            imageHint: 'placeholder',
            createdAt: new Date(),
            modules: modules.map(({ id, ...moduleRest }) => ({
                ...moduleRest,
                lessons: moduleRest.lessons.map(({ id: lessonId, ...lessonRest }) => lessonRest),
            })),
        };
      
        const courseDocRef = await addDoc(collection(firestore, 'courses'), courseData);
        setNewCourseId(courseDocRef.id);
        setShowSuccessDialog(true);

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
    <>
    <div className="container mx-auto px-4 py-8 md:px-8">
       <div className="mb-6 pt-20">
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
            Preencha os detalhes iniciais do curso, defina a imagem e adicione os módulos e aulas.
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
                     
                    {/* Thumbnail Section */}
                     <div className="space-y-4">
                        <h3 className="text-base font-medium text-white">Imagem da Miniatura</h3>
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <div className="aspect-[2/3] w-full max-w-[200px] mx-auto sm:mx-0 rounded-lg overflow-hidden bg-muted relative shrink-0">
                                <Image src={tempImage} alt="Pré-visualização da miniatura" fill className="object-cover"/>
                            </div>
                            <div className="w-full space-y-2">
                                <Tabs value={imageInputMode} onValueChange={(value) => setImageInputMode(value as 'upload' | 'url')} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="upload">Enviar Arquivo</TabsTrigger>
                                        <TabsTrigger value="url">Usar URL</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="upload" className="mt-4">
                                        <label htmlFor="course-image-upload" className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-white border border-dashed rounded-md p-3 justify-center bg-background/50">
                                            <Upload className="h-4 w-4" />
                                            <span>{imageFile ? imageFile.name : 'Clique para selecionar'}</span>
                                        </label>
                                        <Input id="course-image-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                        {uploadProgress !== null && imageInputMode === 'upload' && (
                                            <Progress value={uploadProgress} className="w-full h-2 mt-2" />
                                        )}
                                    </TabsContent>
                                    <TabsContent value="url" className="mt-4">
                                        <div className="relative">
                                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="text"
                                                placeholder="https://exemplo.com/imagem.png"
                                                value={imageUrlInput}
                                                onChange={handleUrlInputChange}
                                                className="w-full bg-background/50 pl-9"
                                            />
                                        </div>
                                    </TabsContent>
                                </Tabs>
                                <Button onClick={handleRemoveImage} variant="outline" size="sm" className="w-full gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                    Remover Imagem
                                </Button>
                            </div>
                        </div>
                    </div>


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
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Salvando...' : 'Salvar e Continuar'}
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
      </Card>
    </div>
    <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Curso Criado com Sucesso!</AlertDialogTitle>
            <AlertDialogDescription>
                Seu novo curso foi salvo. Agora você pode continuar para a página de edição para adicionar mais detalhes e conteúdo.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => router.push(`/admin/edit-course/${newCourseId}`)}>
                    Continuar para Edição
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}


export default function AddCoursePage() {
    return (
        <AdminGuard>
            <AddCourseForm />
        </AdminGuard>
    )
}
