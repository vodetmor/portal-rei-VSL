'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc, deleteDoc, DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import ReactPlayer from 'react-player/lazy';

import AdminGuard from '@/components/admin/admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, X, Edit, GripVertical, PlayCircle, Upload, Link2, Bold, Italic, Underline, Palette } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActionToolbar } from '@/components/ui/action-toolbar';
import { cn } from '@/lib/utils';


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
  thumbnailUrl: string;
  modules: Module[];
}

const DEFAULT_COURSE_IMAGE = "https://placehold.co/400x600/0f0f0f/b3b3b3?text=400x600";

function EditCoursePageContent() {
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeEditor, setActiveEditor] = useState<string | null>(null);

  const [tempTitle, setTempTitle] = useState('');
  const [tempDescription, setTempDescription] = useState('');
  const [tempImage, setTempImage] = useState(DEFAULT_COURSE_IMAGE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [modules, setModules] = useState<Module[]>([]);

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
          setTempTitle(courseData.title);
          setTempDescription(courseData.description);
          setTempImage(courseData.thumbnailUrl || DEFAULT_COURSE_IMAGE);
          setImageUrlInput(courseData.thumbnailUrl || '');
          
          const initialModules = (courseData.modules || []).map(m => ({
            ...(m as Omit<Module, 'id'>),
            id: uuidv4(),
            lessons: (m.lessons || []).map((l: Omit<Lesson, 'id'>) => ({ ...l, id: uuidv4() }))
          }));
          setModules(initialModules);
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
    };

    fetchCourse();
  }, [firestore, courseId, router, toast]);

  const applyFormat = (command: 'bold' | 'italic' | 'underline' | 'foreColor', editorId: string) => {
    const editorElement = document.getElementById(editorId);
    if (!editorElement || !editorElement.isContentEditable) return;
    
    if (command === 'foreColor') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'text-primary';
      span.textContent = range.toString();
      range.deleteContents();
      range.insertNode(span);
    } else {
      document.execCommand(command, false, undefined);
    }
  
    if (editorId === 'course-title-editor') setTempTitle(editorElement.innerHTML);
    else if (editorId === 'course-description-editor') setTempDescription(editorElement.innerHTML);
  };
  
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
  
  const addModule = () => setModules([...modules, { id: uuidv4(), title: `Novo Módulo ${modules.length + 1}`, lessons: [] }]);
  const removeModule = (moduleId: string) => setModules(modules.filter(m => m.id !== moduleId));
  const updateModuleTitle = (moduleId: string, title: string) => setModules(modules.map(m => m.id === moduleId ? { ...m, title } : m));
  const addLesson = (moduleId: string) => setModules(modules.map(m => m.id === moduleId ? { ...m, lessons: [...m.lessons, { id: uuidv4(), title: `Nova Aula ${m.lessons.length + 1}`, videoUrl: '' }] } : m));
  const removeLesson = (moduleId: string, lessonId: string) => setModules(modules.map(m => m.id === moduleId ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) } : m));
  const updateLessonTitle = (moduleId: string, lessonId: string, title: string) => setModules(modules.map(m => m.id === moduleId ? { ...m, lessons: m.lessons.map(l => l.id === lessonId ? { ...l, title } : l) } : m));
  const updateLessonVideoUrl = (moduleId: string, lessonId: string, videoUrl: string) => setModules(modules.map(m => m.id === moduleId ? { ...m, lessons: m.lessons.map(l => l.id === lessonId ? { ...l, videoUrl } : l) } : m));

  const handleSaveChanges = async () => {
    if (!firestore || !courseId) return;
    setIsSaving(true);
    setUploadProgress(null);

    let finalImageUrl = tempImage;
    if (imageInputMode === 'upload' && imageFile) {
        const storage = getStorage();
        const storageRef = ref(storage, `courses/${courseId}/${Date.now()}-${imageFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, imageFile);
        finalImageUrl = await new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => {
                    toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar a imagem." });
                    reject(error);
                },
                () => getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject)
            );
        });
    } else if (imageInputMode === 'url') {
        finalImageUrl = imageUrlInput;
    }

    try {
      const courseRef = doc(firestore, 'courses', courseId);
      await updateDoc(courseRef, {
        title: tempTitle,
        description: tempDescription,
        thumbnailUrl: finalImageUrl,
        modules: modules.map(({ id, ...restModule }) => ({
            ...restModule,
            lessons: restModule.lessons.map(({ id: lessonId, ...restLesson }) => restLesson)
        })),
      });
      toast({ title: "Sucesso!", description: "O curso foi atualizado." });
    } catch (error) {
      console.error('Error updating course:', error);
      toast({ variant: "destructive", title: "Erro ao atualizar", description: "Ocorreu um erro ao salvar. Verifique as permissões." });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!firestore || !courseId) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'courses', courseId));
        toast({ title: "Curso Excluído", description: "O curso foi removido com sucesso." });
        router.push('/admin');
    } catch (error) {
        toast({ variant: "destructive", title: "Erro ao Excluir", description: "Não foi possível excluir o curso." });
        setIsDeleting(false);
    }
  };

  if (loading) {
    return (
        <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
            <div className="flex justify-between items-center mb-6">
                <Skeleton className="h-10 w-48" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>
            <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <Skeleton className="w-full aspect-video rounded-lg" />
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-20 w-full" />
                </div>
                <div className="lg:col-span-1 space-y-4">
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            </div>
        </div>
    );
  }
  
  if (!course) return null;

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-2">
            <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para o Painel</Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Modo de Edição</h1>
          <p className="text-muted-foreground">Clique nos elementos para editar, arraste para reordenar e salve suas alterações.</p>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isSaving || isDeleting}><Trash2 className="mr-2 h-4 w-4" />Excluir Curso</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Isso irá excluir permanentemente o curso.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isDeleting}>{isDeleting ? 'Excluindo...' : 'Excluir'}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSaveChanges} disabled={isSaving} size="sm"><Save className="mr-2 h-4 w-4" />{isSaving ? 'Salvando...' : 'Salvar Alterações'}</Button>
        </div>
      </div>
      
      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Preview & Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Pré-visualização do Conteúdo</CardTitle></CardHeader>
            <CardContent>
              <div className="aspect-video mb-6 bg-black rounded-lg overflow-hidden flex items-center justify-center text-muted-foreground">
                  <PlayCircle className="mx-auto h-16 w-16" />
                  <p>A pré-visualização do vídeo aparecerá aqui.</p>
              </div>
              <div className="space-y-4">
                  <div className="relative">
                      <div id="course-title-editor" contentEditable suppressContentEditableWarning onFocus={() => setActiveEditor('title')} onBlur={() => setActiveEditor(null)} onInput={(e) => setTempTitle(e.currentTarget.innerHTML)} className="text-3xl font-bold text-white outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2" dangerouslySetInnerHTML={{ __html: tempTitle }} />
                      {activeEditor === 'title' && (
                        <ActionToolbar className="absolute -top-14" buttons={[{ label: "Bold", icon: <Bold className="size-4" />, onClick: () => applyFormat('bold', 'course-title-editor') }, { label: "Italic", icon: <Italic className="size-4" />, onClick: () => applyFormat('italic', 'course-title-editor') }, { label: "Underline", icon: <Underline className="size-4" />, onClick: () => applyFormat('underline', 'course-title-editor') }, { label: "Color", icon: <Palette className="size-4" />, onClick: () => applyFormat('foreColor', 'course-title-editor') }]} />
                      )}
                  </div>
                  <div className="relative">
                      <div id="course-description-editor" contentEditable suppressContentEditableWarning onFocus={() => setActiveEditor('description')} onBlur={() => setActiveEditor(null)} onInput={(e) => setTempDescription(e.currentTarget.innerHTML)} className="text-muted-foreground outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2" dangerouslySetInnerHTML={{ __html: tempDescription }} />
                      {activeEditor === 'description' && (
                          <ActionToolbar className="absolute -top-14" buttons={[{ label: "Bold", icon: <Bold className="size-4" />, onClick: () => applyFormat('bold', 'course-description-editor') }, { label: "Italic", icon: <Italic className="size-4" />, onClick: () => applyFormat('italic', 'course-description-editor') }, { label: "Underline", icon: <Underline className="size-4" />, onClick: () => applyFormat('underline', 'course-description-editor') }, { label: "Color", icon: <Palette className="size-4" />, onClick: () => applyFormat('foreColor', 'course-description-editor') }]} />
                      )}
                  </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Editing Tools */}
        <div className="lg:col-span-1 space-y-6">
            <Card>
                <CardHeader><CardTitle>Estrutura do Curso</CardTitle><CardDescription>Adicione e organize os módulos e aulas.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <Accordion type="single" collapsible className="w-full space-y-3" defaultValue='module-0'>
                      {modules.map((module, moduleIndex) => (
                        <AccordionItem key={module.id} value={`module-${moduleIndex}`} className="bg-secondary/30 rounded-lg px-4 border">
                          <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-2 w-full">
                                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                                  <Input value={module.title} onChange={(e) => updateModuleTitle(module.id, e.target.value)} className="font-semibold bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary" />
                                  <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeModule(module.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                          </AccordionTrigger>
                          <AccordionContent className="pl-6 pr-2 space-y-3">
                              {module.lessons.map((lesson, lessonIndex) => (
                                  <div key={lesson.id} className="flex flex-col gap-2 p-3 rounded-md border border-border/50 bg-background/50">
                                      <div className="flex items-center gap-2">
                                          <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                                          <Input placeholder={`Título da Aula ${lessonIndex + 1}`} value={lesson.title} onChange={(e) => updateLessonTitle(module.id, lesson.id, e.target.value)} className="bg-transparent border-none h-8 focus-visible:ring-1 focus-visible:ring-primary" />
                                          <Button type="button" variant="ghost" size="icon" onClick={() => removeLesson(module.id, lesson.id)}><Trash2 className="h-4 w-4 text-destructive/70" /></Button>
                                      </div>
                                      <Input placeholder="URL do Vídeo da Aula (Ex: https://...)" value={lesson.videoUrl} onChange={(e) => updateLessonVideoUrl(module.id, lesson.id, e.target.value)} className="bg-transparent border-none h-8 focus-visible:ring-1 focus-visible:ring-primary" />
                                  </div>
                              ))}
                              <Button type="button" variant="link" size="sm" onClick={() => addLesson(module.id)}><Plus className="mr-2 h-4 w-4" /> Adicionar Aula</Button>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                  </Accordion>
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={addModule}><Plus className="mr-2 h-4 w-4" />Adicionar Módulo</Button>
                </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Imagem do Curso</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                  <div className="aspect-[2/3] w-full max-w-[200px] mx-auto rounded-lg overflow-hidden bg-muted relative">
                      <Image src={tempImage} alt="Pré-visualização da miniatura" fill className="object-cover"/>
                  </div>
                  <div className="w-full space-y-2">
                      <Tabs value={imageInputMode} onValueChange={(value) => setImageInputMode(value as 'upload' | 'url')} className="w-full">
                          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="upload">Enviar</TabsTrigger><TabsTrigger value="url">URL</TabsTrigger></TabsList>
                          <TabsContent value="upload" className="mt-4">
                              <label htmlFor="course-image-upload" className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-white border border-dashed rounded-md p-3 justify-center bg-background/50"><Upload className="h-4 w-4" /><span>{imageFile ? imageFile.name : 'Selecione o arquivo'}</span></label>
                              <Input id="course-image-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                              {uploadProgress !== null && imageInputMode === 'upload' && (<Progress value={uploadProgress} className="w-full h-2 mt-2" />)}
                          </TabsContent>
                          <TabsContent value="url" className="mt-4">
                              <div className="relative"><Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="text" placeholder="https://exemplo.com/imagem.png" value={imageUrlInput} onChange={handleUrlInputChange} className="w-full bg-background/50 pl-9" /></div>
                          </TabsContent>
                      </Tabs>
                      <Button onClick={handleRemoveImage} variant="outline" size="sm" className="w-full gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" />Remover Imagem</Button>
                  </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

export default function EditCoursePage() {
    return (
        <AdminGuard>
            <EditCoursePageContent />
        </AdminGuard>
    )
}
