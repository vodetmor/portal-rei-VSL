
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

import AdminGuard from '@/components/admin/admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, Upload, Link2, GripVertical, FileVideo } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

interface Lesson {
  id: string;
  title: string;
  videoUrl: string;
}

interface Module {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageHint: string;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  modules: Module[];
}

const DEFAULT_MODULE_IMAGE = "https://placehold.co/400x600/0f0f0f/b3b3b3?text=Module";

function EditCoursePageContent() {
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Temp state for editing course details
  const [tempTitle, setTempTitle] = useState('');
  const [tempDescription, setTempDescription] = useState('');
  const [modules, setModules] = useState<Module[]>([]);

  const fetchCourse = useCallback(async () => {
    if (!firestore || !courseId) return;
    setLoading(true);
    try {
      const courseRef = doc(firestore, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);

      if (courseSnap.exists()) {
        const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
        setCourse(courseData);
        setTempTitle(courseData.title || '');
        setTempDescription(courseData.description || '');
        setModules((courseData.modules || []).map(m => ({
          ...m,
          id: uuidv4(), // Client-side ID
          lessons: (m.lessons || []).map(l => ({ ...l, id: uuidv4() }))
        })));
      } else {
        toast({ variant: "destructive", title: "Erro", description: "Curso não encontrado." });
        router.push('/admin');
      }
    } catch (error) {
      console.error('Error fetching course:', error);
      toast({ variant: "destructive", title: "Erro de Permissão", description: "Você não tem permissão para carregar este curso." });
    } finally {
      setLoading(false);
    }
  }, [firestore, courseId, router, toast]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);


  const addModule = () => {
    const newModule: Module = {
      id: uuidv4(),
      title: `Novo Módulo ${modules.length + 1}`,
      thumbnailUrl: DEFAULT_MODULE_IMAGE,
      imageHint: 'abstract',
      lessons: [],
    };
    setModules([...modules, newModule]);
  };

  const removeModule = (moduleId: string) => {
    setModules(modules.filter(m => m.id !== moduleId));
  };
  
  const updateModuleField = <K extends keyof Module>(moduleId: string, field: K, value: Module[K]) => {
    setModules(modules.map(m => m.id === moduleId ? { ...m, [field]: value } : m));
  };

  const addLesson = (moduleId: string) => {
    setModules(modules.map(m => 
      m.id === moduleId 
        ? { ...m, lessons: [...m.lessons, { id: uuidv4(), title: '', videoUrl: '' }] }
        : m
    ));
  };

  const updateLessonField = (moduleId: string, lessonId: string, field: keyof Lesson, value: string) => {
    setModules(modules.map(m => 
      m.id === moduleId 
        ? { ...m, lessons: m.lessons.map(l => l.id === lessonId ? { ...l, [field]: value } : l) }
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


  const handleSaveChanges = async () => {
    if (!firestore || !courseId) return;
    setIsSaving(true);
    
    try {
      const courseRef = doc(firestore, 'courses', courseId);
      // Strip client-side 'id's before saving to Firestore
      const modulesToSave = modules.map(({ id, lessons, ...rest }) => ({
        ...rest,
        lessons: lessons.map(({ id: lessonId, ...lessonRest }) => lessonRest)
      }));
      
      const courseDataToSave = {
        title: tempTitle,
        description: tempDescription,
        modules: modulesToSave,
      };

      await updateDoc(courseRef, courseDataToSave);
      toast({ title: "Sucesso!", description: "O curso foi atualizado com sucesso." });
    } catch (error) {
      console.error('Error updating course:', error);
      toast({ variant: "destructive", title: "Erro ao atualizar", description: "Ocorreu um erro ao salvar o curso." });
    } finally {
      setIsSaving(false);
    }
  };
  

  if (loading) {
    return (
        <div className="container mx-auto px-4 py-8 md:px-8 space-y-6 pt-24">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
    );
  }
  
  if (!course) return null;

  return (
    <div className="container mx-auto px-4 py-8 md:px-8">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8 pt-24">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-2">
            <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para o Painel</Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Editor de Curso</h1>
          <p className="text-muted-foreground">Edite todos os aspectos do seu curso em um só lugar.</p>
        </div>
        <div className="flex gap-2">
            <Button asChild variant="secondary">
                <Link href={`/courses/${courseId}`}>
                    Visualizar Curso
                </Link>
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? 'Salvando...' : 'Salvar Alterações'}</Button>
        </div>
      </div>
      
      {/* Course Details Editor */}
      <Card className="mb-8">
        <CardHeader>
            <CardTitle>Detalhes do Curso</CardTitle>
            <CardDescription>Edite as informações principais que os alunos verão primeiro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <label htmlFor="course-title" className="text-sm font-medium text-white">Título do Curso</label>
                <Input 
                    id="course-title"
                    placeholder="Ex: VSL do Zero ao Lançamento" 
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    className="mt-1"
                />
            </div>
            <div>
                <label htmlFor="course-description" className="text-sm font-medium text-white">Descrição</label>
                <Textarea 
                    id="course-description"
                    placeholder="Descreva o que o aluno irá aprender..." 
                    value={tempDescription}
                    onChange={(e) => setTempDescription(e.target.value)}
                    className="mt-1"
                    rows={4}
                />
            </div>
        </CardContent>
      </Card>
      
      <Separator className="my-8" />

      {/* Modules and Lessons Editor */}
      <Card>
        <CardHeader>
            <CardTitle>Módulos e Aulas</CardTitle>
            <CardDescription>Organize o conteúdo do seu curso. Arraste para reordenar, edite os detalhes e adicione aulas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
              {modules.map((module) => (
                <ModuleEditor 
                    key={module.id} 
                    module={module}
                    onUpdate={updateModuleField}
                    onRemove={removeModule}
                    onAddLesson={addLesson}
                    onUpdateLesson={updateLessonField}
                    onRemoveLesson={removeLesson}
                />
              ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addModule}><Plus className="mr-2 h-4 w-4" />Adicionar Módulo</Button>
        </CardContent>
      </Card>

    </div>
  );
}


// --- ModuleEditor Component ---

interface ModuleEditorProps {
    module: Module;
    onUpdate: <K extends keyof Module>(moduleId: string, field: K, value: Module[K]) => void;
    onRemove: (moduleId: string) => void;
    onAddLesson: (moduleId: string) => void;
    onUpdateLesson: (moduleId: string, lessonId: string, field: keyof Lesson, value: string) => void;
    onRemoveLesson: (moduleId: string, lessonId: string) => void;
}

function ModuleEditor({ module, onUpdate, onRemove, onAddLesson, onUpdateLesson, onRemoveLesson }: ModuleEditorProps) {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
    const { toast } = useToast();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            setUploadProgress(0);
            
            const storage = getStorage();
            const storageRef = ref(storage, `courses/modules/${module.id}/${Date.now()}-${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => { 
                    console.error(error); 
                    toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar a imagem da capa."});
                    setUploadProgress(null); 
                },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                        onUpdate(module.id, 'thumbnailUrl', downloadURL);
                        setUploadProgress(null);
                        setImageFile(null);
                    });
                }
            );
        }
    };
    
    const handleUrlChange = (newUrl: string) => {
        onUpdate(module.id, 'thumbnailUrl', newUrl);
    };

    return (
        <Collapsible defaultOpen className="group/collapsible border rounded-lg bg-secondary/30 transition-all hover:bg-secondary/40">
            <div className="flex items-start gap-4 p-4 ">
                <div className="flex-shrink-0 flex items-center gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    <div className="relative aspect-[2/3] w-24 rounded-md overflow-hidden bg-muted">
                        <Image src={module.thumbnailUrl || DEFAULT_MODULE_IMAGE} alt={module.title} fill className="object-cover" />
                    </div>
                </div>

                <div className="flex-grow w-full space-y-3">
                     <Input
                        placeholder="Título do Módulo"
                        value={module.title}
                        onChange={(e) => onUpdate(module.id, 'title', e.target.value)}
                        className="font-semibold"
                    />

                    <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as 'upload' | 'url')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-9">
                            <TabsTrigger value="upload" className="text-xs">Enviar Capa</TabsTrigger>
                            <TabsTrigger value="url" className="text-xs">Usar URL</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upload" className="mt-2">
                            <label htmlFor={`module-img-${module.id}`} className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-white border border-dashed rounded-md p-2 justify-center bg-background/50">
                                <Upload className="h-3 w-3" /><span>{imageFile ? imageFile.name : 'Selecionar imagem'}</span>
                            </label>
                            <Input id={`module-img-${module.id}`} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                            {uploadProgress !== null && (<Progress value={uploadProgress} className="w-full h-1 mt-2" />)}
                        </TabsContent>
                        <TabsContent value="url" className="mt-2">
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full h-9 text-xs gap-2">
                                        <Link2 className="h-3 w-3" /> Colar URL da Capa
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-2" side="bottom" align="start">
                                    <div className="grid gap-2">
                                    <p className="text-xs text-muted-foreground">Cole a URL da imagem</p>
                                    <Input 
                                        type="text" 
                                        placeholder="https://exemplo.com/capa.png" 
                                        value={module.thumbnailUrl === DEFAULT_MODULE_IMAGE ? '' : module.thumbnailUrl} 
                                        onChange={(e) => handleUrlChange(e.target.value)} 
                                        className="w-full bg-background/50 pl-2 text-xs h-8"
                                    />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </TabsContent>
                    </Tabs>
                </div>
                
                <div className="flex flex-col gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir Módulo?</AlertDialogTitle><AlertDialogDescription>Isso removerá "{module.title}" permanentemente. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onRemove(module.id)}>Confirmar Exclusão</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <CollapsibleTrigger asChild>
                         <Button variant="ghost" size="icon" className="group-data-[state=open]/collapsible:bg-accent">
                            <FileVideo className="h-4 w-4" />
                        </Button>
                    </CollapsibleTrigger>
                </div>
            </div>

            <CollapsibleContent className="px-4 pb-4">
                 <div className="border-t pt-4 mt-4 space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Aulas do Módulo</h4>
                    {module.lessons.map((lesson, lessonIndex) => (
                        <div key={lesson.id} className="flex items-center gap-2 p-3 rounded-md border bg-background/50">
                            <Input
                                placeholder={`Título da Aula ${lessonIndex + 1}`}
                                value={lesson.title}
                                onChange={(e) => onUpdateLesson(module.id, lesson.id, 'title', e.target.value)}
                                className="h-9"
                            />
                            <Input
                                placeholder="URL do Vídeo"
                                value={lesson.videoUrl}
                                onChange={(e) => onUpdateLesson(module.id, lesson.id, 'videoUrl', e.target.value)}
                                className="h-9"
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveLesson(module.id, lesson.id)}>
                                <Trash2 className="h-4 w-4 text-destructive/70" />
                            </Button>
                        </div>
                    ))}
                     <Button type="button" variant="link" size="sm" className="w-full" onClick={() => onAddLesson(module.id)}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Aula
                    </Button>
                 </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

export default function EditCoursePage() {
    return (
        <AdminGuard>
            <EditCoursePageContent />
        </AdminGuard>
    )
}

    