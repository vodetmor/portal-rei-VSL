
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import ReactPlayer from 'react-player/lazy';
import { Reorder, useDragControls } from 'framer-motion';

import AdminGuard from '@/components/admin/admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, Upload, Link2, GripVertical, FileVideo, Eye, CalendarDays, Send, BarChart2, Book, Bold, Italic, Underline, Palette, Monitor, Smartphone, ShoppingCart, AlignLeft, AlignCenter, AlignRight, EyeOff, Video } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { logAdminAction } from '@/lib/audit';
import { Badge } from '@/components/ui/badge';
import CourseAnalytics from '@/components/admin/course-analytics';
import { ActionToolbar } from '@/components/ui/action-toolbar';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ComplementaryMaterial {
  id: string;
  title: string;
  url: string;
}

interface Lesson {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  isDemo?: boolean;
  releaseDelayDays?: number;
  complementaryMaterials?: ComplementaryMaterial[];
}

interface Module {
  id:string;
  title: string;
  subtitle: string;
  thumbnailUrl: string;
  imageHint: string;
  lessons: Lesson[];
  releaseDelayDays?: number;
}

interface Course {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  modules: Module[];
  status: 'draft' | 'published';
  heroImageUrlDesktop?: string;
  heroImageUrlMobile?: string;
  checkoutUrl?: string;
  vslUrl?: string;
  isDemoEnabled?: boolean;
  isFree?: boolean;
  heroAlignment?: "left" | "center" | "end";
  heroTextVisible?: boolean;
}

const DEFAULT_MODULE_IMAGE = "https://i.imgur.com/1X3ta7W.png";
const DEFAULT_HERO_IMAGE_DESKTOP = "https://i.imgur.com/1X3ta7W.png";
const DEFAULT_HERO_IMAGE_MOBILE = "https://i.imgur.com/PFv07gS.png";

function EditCoursePageContent() {
  const firestore = useFirestore();
  const { user: adminUser } = useUser();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [tempTitle, setTempTitle] = useState('');
  const [tempSubtitle, setTempSubtitle] = useState('');
  const [tempDescription, setTempDescription] = useState('');
  const [tempCheckoutUrl, setTempCheckoutUrl] = useState('');
  const [tempVslUrl, setTempVslUrl] = useState('');
  const [tempIsDemoEnabled, setTempIsDemoEnabled] = useState(false);
  const [tempIsFree, setTempIsFree] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [activeEditor, setActiveEditor] = useState<string | null>(null);

  // States for banner editing
  const [tempHeroImageDesktop, setTempHeroImageDesktop] = useState(DEFAULT_HERO_IMAGE_DESKTOP);
  const [tempHeroImageMobile, setTempHeroImageMobile] = useState(DEFAULT_HERO_IMAGE_MOBILE);
  const [heroImageDesktopFile, setHeroImageDesktopFile] = useState<File | null>(null);
  const [heroImageMobileFile, setHeroImageMobileFile] = useState<File | null>(null);
  const [heroImageUrlInputDesktop, setHeroImageUrlInputDesktop] = useState('');
  const [heroImageUrlInputMobile, setHeroImageUrlInputMobile] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'desktop' | 'mobile'>('desktop');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [tempHeroAlignment, setTempHeroAlignment] = useState<'left' | 'center' | 'end'>('left');
  const [tempHeroTextVisible, setTempHeroTextVisible] = useState(true);
  
  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
  };

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
        setTempSubtitle(courseData.subtitle || '');
        setTempDescription(courseData.description || '');
        setTempCheckoutUrl(courseData.checkoutUrl || '');
        setTempVslUrl(courseData.vslUrl || '');
        setTempIsDemoEnabled(courseData.isDemoEnabled || false);
        setTempIsFree(courseData.isFree || false);
        setTempHeroImageDesktop(courseData.heroImageUrlDesktop || DEFAULT_HERO_IMAGE_DESKTOP);
        setTempHeroImageMobile(courseData.heroImageUrlMobile || DEFAULT_HERO_IMAGE_MOBILE);
        setHeroImageUrlInputDesktop(courseData.heroImageUrlDesktop || '');
        setHeroImageUrlInputMobile(courseData.heroImageUrlMobile || '');
        setTempHeroAlignment(courseData.heroAlignment || 'left');
        setTempHeroTextVisible(courseData.heroTextVisible !== undefined ? courseData.heroTextVisible : true);
        setModules((courseData.modules || []).map(m => ({
          ...m,
          id: m.id || uuidv4(),
          releaseDelayDays: m.releaseDelayDays || 0,
          lessons: (m.lessons || []).map(l => ({ ...l, id: l.id || uuidv4(), description: l.description || '', videoUrl: l.videoUrl || '', isDemo: l.isDemo || false, releaseDelayDays: l.releaseDelayDays || 0, complementaryMaterials: (l.complementaryMaterials || []).map(cm => ({...cm, id: cm.id || uuidv4()})) }))
        })));
      } else {
        toast({ variant: "destructive", title: "Erro", description: "Curso não encontrado." });
        router.push('/admin');
      }
    } catch (error) {
      console.error('Error fetching course:', error);
      const permissionError = new FirestorePermissionError({
          path: `courses/${courseId}`,
          operation: 'get'
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({ variant: "destructive", title: "Erro de Permissão", description: "Você não tem permissão para carregar este curso." });
    } finally {
      setLoading(false);
    }
  }, [firestore, courseId, router, toast]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

   useEffect(() => {
        if (descriptionRef.current) {
            descriptionRef.current.innerHTML = tempDescription;
        }
    }, [tempDescription]);


  const addModule = () => {
    const newModule: Module = {
      id: uuidv4(),
      title: `Novo Módulo ${modules.length + 1}`,
      subtitle: 'Rei da VSL®',
      thumbnailUrl: DEFAULT_MODULE_IMAGE,
      imageHint: 'abstract',
      lessons: [],
      releaseDelayDays: 0,
    };
    setModules([...modules, newModule]);
  };

  const removeModule = (moduleId: string, moduleTitle: string) => {
    setModules(modules.filter(m => m.id !== moduleId));
     if (adminUser && firestore) {
        logAdminAction(firestore, adminUser, 'module_deleted', {
            type: 'Module',
            id: moduleId,
            title: `${moduleTitle} (do curso ${course?.title})`
        })
    }
  };
  
  const updateModuleField = <K extends keyof Module>(moduleId: string, field: K, value: Module[K]) => {
    setModules(modules.map(m => m.id === moduleId ? { ...m, [field]: value } : m));
  };

  const addLesson = (moduleId: string) => {
    setModules(modules.map(m => 
      m.id === moduleId 
        ? { ...m, lessons: [...m.lessons, { id: uuidv4(), title: `Nova Aula ${m.lessons.length + 1}`, description: '', videoUrl: '', isDemo: false, releaseDelayDays: 0, complementaryMaterials: [] }] }
        : m
    ));
  };

  const updateLessonField = (moduleId: string, lessonId: string, field: keyof Lesson, value: any) => {
    setModules(modules.map(m => 
      m.id === moduleId 
        ? { ...m, lessons: m.lessons.map(l => l.id === lessonId ? { ...l, [field]: value } : l) }
        : m
    ));
  };

  const reorderLessons = (moduleId: string, reorderedLessons: Lesson[]) => {
    setModules(modules.map(m => 
      m.id === moduleId 
        ? { ...m, lessons: reorderedLessons }
        : m
    ));
  };

  const removeLesson = (moduleId: string, lessonId: string, lessonTitle: string) => {
    setModules(modules.map(m => 
      m.id === moduleId 
        ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) }
        : m
    ));
    if (adminUser && firestore) {
        logAdminAction(firestore, adminUser, 'lesson_deleted', {
            type: 'Lesson',
            id: lessonId,
            title: `${lessonTitle} (do curso ${course?.title})`
        })
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, device: 'desktop' | 'mobile') => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      if (device === 'desktop') {
        setHeroImageDesktopFile(file);
        reader.onloadend = () => setTempHeroImageDesktop(reader.result as string);
      } else {
        setHeroImageMobileFile(file);
        reader.onloadend = () => setTempHeroImageMobile(reader.result as string);
      }
      reader.readAsDataURL(file);
    }
  };

  const handleUrlInputChange = (event: React.ChangeEvent<HTMLInputElement>, device: 'desktop' | 'mobile') => {
    const newUrl = event.target.value;
    if (device === 'desktop') {
        setHeroImageUrlInputDesktop(newUrl);
        if (newUrl.startsWith('http')) setTempHeroImageDesktop(newUrl);
    } else {
        setHeroImageUrlInputMobile(newUrl);
        if (newUrl.startsWith('http')) setTempHeroImageMobile(newUrl);
    }
  };

  const handleSave = async (status: 'draft' | 'published' = 'draft') => {
    if (!firestore || !courseId || !adminUser) return;
    setIsSaving(true);
    setUploadProgress(null);
    
    try {
      let finalHeroImageUrlDesktop = course?.heroImageUrlDesktop || DEFAULT_HERO_IMAGE_DESKTOP;
      let finalHeroImageUrlMobile = course?.heroImageUrlMobile || DEFAULT_HERO_IMAGE_MOBILE;

      const uploadImage = async (file: File, path: string) => {
          const storage = getStorage();
          const storageRef = ref(storage, `courses/${courseId}/hero/${path}/${Date.now()}-${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          
          return new Promise<string>((resolve, reject) => {
              uploadTask.on('state_changed',
                  (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                  (error) => reject(error),
                  () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
              );
          });
      };
      
      if (heroImageDesktopFile) {
          finalHeroImageUrlDesktop = await uploadImage(heroImageDesktopFile, 'desktop');
      } else if (heroImageUrlInputDesktop) {
          finalHeroImageUrlDesktop = heroImageUrlInputDesktop;
      }

      if (heroImageMobileFile) {
          finalHeroImageUrlMobile = await uploadImage(heroImageMobileFile, 'mobile');
      } else if (heroImageUrlInputMobile) {
          finalHeroImageUrlMobile = heroImageUrlInputMobile;
      }


      const courseRef = doc(firestore, 'courses', courseId);
      const modulesToSave = modules.map(({ ...rest }) => ({
        ...rest,
        releaseDelayDays: Number(rest.releaseDelayDays || 0),
        lessons: rest.lessons.map(({ ...lessonRest }) => ({
            ...lessonRest,
            description: lessonRest.description || '',
            videoUrl: lessonRest.videoUrl || '',
            isDemo: lessonRest.isDemo || false,
            releaseDelayDays: Number(lessonRest.releaseDelayDays || 0)
        }))
      }));
      
      const courseDataToSave = {
        title: tempTitle,
        subtitle: tempSubtitle,
        description: tempDescription,
        checkoutUrl: tempCheckoutUrl,
        vslUrl: tempVslUrl,
        isDemoEnabled: tempIsDemoEnabled,
        isFree: tempIsFree,
        heroImageUrlDesktop: finalHeroImageUrlDesktop,
        heroImageUrlMobile: finalHeroImageUrlMobile,
        heroAlignment: tempHeroAlignment,
        heroTextVisible: tempHeroTextVisible,
        modules: modulesToSave,
        status: status,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(courseRef, courseDataToSave);
      
      const action = status === 'published' ? 'course_published' : 'course_updated';
      const toastTitle = status === 'published' ? 'Curso Publicado!' : 'Rascunho Salvo!';
      const toastDescription = status === 'published' 
          ? "O curso e todas as suas alterações estão agora visíveis para os alunos."
          : "Suas alterações foram salvas como um rascunho.";

      await logAdminAction(firestore, adminUser, action, {
          type: 'Course',
          id: courseId,
          title: tempTitle
      });

      toast({ title: toastTitle, description: toastDescription });
      fetchCourse(); 
    } catch (error) {
      console.error('Error updating course:', error);
      const permissionError = new FirestorePermissionError({
          path: `courses/${courseId}`,
          operation: 'update',
          requestResourceData: { title: tempTitle, status } 
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Ocorreu um erro ao salvar o curso." });
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !courseId || !adminUser || !course) return;

    try {
      const courseRef = doc(firestore, 'courses', courseId);
      await deleteDoc(courseRef);

      await logAdminAction(firestore, adminUser, 'course_deleted', {
        type: 'Course',
        id: courseId,
        title: course.title,
      });

      toast({
        title: 'Curso Excluído',
        description: `O curso "${course.title}" foi excluído permanentemente.`,
      });

      router.push('/admin');
    } catch (error) {
      console.error('Error deleting course:', error);
      const permissionError = new FirestorePermissionError({
        path: `courses/${courseId}`,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Erro ao Excluir',
        description: 'Não foi possível excluir o curso.',
      });
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
    <div className="container mx-auto px-4 py-8 md:px-8 pt-24 relative pb-32 md:pb-24">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-2">
            <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para o Painel</Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Editor de Curso</h1>
            {course.status === 'published' ? (
                <Badge variant="default" className="bg-green-600">Publicado</Badge>
            ) : (
                <Badge variant="secondary">Rascunho</Badge>
            )}
          </div>
          <p className="text-muted-foreground">Edite todos os aspectos do seu curso em um só lugar.</p>
        </div>
      </div>
      
      <Tabs defaultValue="content" className="w-full">
        <TabsList className="mb-6">
            <TabsTrigger value="content"><FileVideo className="mr-2 h-4 w-4" />Conteúdo</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart2 className="mr-2 h-4 w-4" />Análise de Progresso</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
            <div className="space-y-8">
                {/* Course Details Editor */}
                <Card>
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
                            <label htmlFor="course-subtitle" className="text-sm font-medium text-white">Subtítulo</label>
                            <Input 
                                id="course-subtitle"
                                placeholder="Ex: Rei da VSL®" 
                                value={tempSubtitle}
                                onChange={(e) => setTempSubtitle(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label htmlFor="course-checkout" className="text-sm font-medium text-white">Link de Checkout (Opcional)</label>
                            <div className="relative mt-1">
                                <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="course-checkout"
                                    placeholder="https://suapagina.com/checkout" 
                                    value={tempCheckoutUrl}
                                    onChange={(e) => setTempCheckoutUrl(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                         <div>
                            <label htmlFor="course-vsl" className="text-sm font-medium text-white">URL da VSL (Opcional)</label>
                            <div className="relative mt-1">
                                <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="course-vsl"
                                    placeholder="https://youtube.com/seu-video" 
                                    value={tempVslUrl}
                                    onChange={(e) => setTempVslUrl(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                         <div className='relative'>
                            <label htmlFor="course-description" className="text-sm font-medium text-white">Descrição</label>
                             {activeEditor === 'course-description' && (
                                <ActionToolbar
                                    className="absolute -top-12 z-10"
                                    buttons={[
                                       { label: 'Negrito', icon: <Bold className="size-4" />, onClick: () => applyFormat('bold') },
                                       { label: 'Itálico', icon: <Italic className="size-4" />, onClick: () => applyFormat('italic') },
                                       { label: 'Sublinhado', icon: <Underline className="size-4" />, onClick: () => applyFormat('underline') },
                                       { label: 'Cor', icon: <Palette className="size-4" />, onClick: () => applyFormat('foreColor', '#FFD700') },
                                    ]}
                                />
                            )}
                            <div
                                id="course-description"
                                ref={descriptionRef}
                                contentEditable
                                suppressContentEditableWarning
                                onFocus={() => setActiveEditor('course-description')}
                                onBlur={(e) => {
                                    setActiveEditor(null);
                                    setTempDescription(e.currentTarget.innerHTML);
                                }}
                                className="mt-1 min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 prose prose-sm prose-invert max-w-none"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                           <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 bg-secondary/30">
                                <div className="space-y-0.5">
                                    <Label htmlFor="is-demo" className="text-base font-medium text-white">Modo Demo</Label>
                                    <p className="text-xs text-muted-foreground">Libera aulas selecionadas para não-inscritos.</p>
                                </div>
                                <Switch id="is-demo" checked={tempIsDemoEnabled} onCheckedChange={setTempIsDemoEnabled} />
                            </div>
                             <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 bg-secondary/30">
                                <div className="space-y-0.5">
                                    <Label htmlFor="is-free" className="text-base font-medium text-white">Curso Gratuito</Label>
                                    <p className="text-xs text-muted-foreground">Libera o curso completo para todos.</p>
                                </div>
                                <Switch id="is-free" checked={tempIsFree} onCheckedChange={setTempIsFree} />
                            </div>
                        </div>
                         <div className="pt-4 space-y-2">
                             <label className="text-sm font-medium text-white">Banner e Layout da Página do Curso</label>
                             <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-4">
                               <div className='flex items-center justify-between'>
                                   <Label className="text-white">Alinhamento do Texto</Label>
                                   <ActionToolbar
                                        buttons={[
                                            { label: "Esquerda", icon: <AlignLeft className="size-4" />, onClick: () => setTempHeroAlignment('left'), active: tempHeroAlignment === 'left' },
                                            { label: "Centro", icon: <AlignCenter className="size-4" />, onClick: () => setTempHeroAlignment('center'), active: tempHeroAlignment === 'center' },
                                            { label: "Direita", icon: <AlignRight className="size-4" />, onClick: () => setTempHeroAlignment('end'), active: tempHeroAlignment === 'end' },
                                        ]}
                                        compact
                                    />
                               </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="text-visibility" className="text-white">
                                        Visibilidade do Texto
                                    </Label>
                                    <Switch
                                        id="text-visibility"
                                        checked={tempHeroTextVisible}
                                        onCheckedChange={setTempHeroTextVisible}
                                        />
                                </div>
                                <Separator />
                                <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as 'desktop' | 'mobile')} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="desktop"><Monitor className="mr-2 h-4 w-4"/> Computador</TabsTrigger>
                                        <TabsTrigger value="mobile"><Smartphone className="mr-2 h-4 w-4"/> Celular</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="desktop" className="mt-4">
                                        <div className="space-y-2">
                                            <div className="aspect-video relative rounded-md overflow-hidden bg-muted mb-2">
                                                <Image src={tempHeroImageDesktop} alt="Preview Desktop" fill className="object-cover" />
                                            </div>
                                            <Tabs defaultValue="upload" className="w-full">
                                                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="upload">Enviar</TabsTrigger><TabsTrigger value="url">URL</TabsTrigger></TabsList>
                                                <TabsContent value="upload" className="mt-2">
                                                    <label htmlFor="hero-image-upload-desktop" className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-white border border-dashed rounded-md p-2 justify-center bg-background/50">
                                                        <Upload className="h-3 w-3" /><span>{heroImageDesktopFile ? heroImageDesktopFile.name : 'Selecione a imagem'}</span>
                                                    </label>
                                                    <Input id="hero-image-upload-desktop" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'desktop')} className="hidden" />
                                                </TabsContent>
                                                <TabsContent value="url" className="mt-2">
                                                    <div className="relative">
                                                        <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                                        <Input type="text" placeholder="https://..." value={heroImageUrlInputDesktop} onChange={(e) => handleUrlInputChange(e, 'desktop')} className="w-full bg-background/50 pl-7 text-xs h-9"/>
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                            {uploadProgress !== null && imageInputMode === 'desktop' && (<Progress value={uploadProgress} className="w-full h-1 mt-2" />)}
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="mobile" className="mt-4">
                                        <div className="space-y-2">
                                            <div className="aspect-[9/16] relative rounded-md overflow-hidden bg-muted mb-2 max-w-xs mx-auto">
                                                <Image src={tempHeroImageMobile} alt="Preview Mobile" fill className="object-cover" />
                                            </div>
                                            <Tabs defaultValue="upload" className="w-full">
                                                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="upload">Enviar</TabsTrigger><TabsTrigger value="url">URL</TabsTrigger></TabsList>
                                                <TabsContent value="upload" className="mt-2">
                                                    <label htmlFor="hero-image-upload-mobile" className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-white border border-dashed rounded-md p-2 justify-center bg-background/50">
                                                        <Upload className="h-3 w-3" /><span>{heroImageMobileFile ? heroImageMobileFile.name : 'Selecione a imagem'}</span>
                                                    </label>
                                                    <Input id="hero-image-upload-mobile" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'mobile')} className="hidden" />
                                                </TabsContent>
                                                <TabsContent value="url" className="mt-2">
                                                    <div className="relative">
                                                        <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                                        <Input type="text" placeholder="https://..." value={heroImageUrlInputMobile} onChange={(e) => handleUrlInputChange(e, 'mobile')} className="w-full bg-background/50 pl-7 text-xs h-9"/>
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                            {uploadProgress !== null && imageInputMode === 'mobile' && (<Progress value={uploadProgress} className="w-full h-1 mt-2" />)}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Separator />

                {/* Modules and Lessons Editor */}
                <Card>
                    <CardHeader>
                        <div>
                            <CardTitle>Módulos e Aulas</CardTitle>
                            <CardDescription>Organize o conteúdo do seu curso. Arraste para reordenar, edite os detalhes e adicione aulas.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                    <div className="space-y-4">
                        <Reorder.Group axis="y" values={modules} onReorder={setModules} className="space-y-4">
                            {modules.map((module) => (
                            <ModuleEditor 
                                key={module.id} 
                                module={module}
                                onUpdate={updateModuleField}
                                onRemove={removeModule}
                                onAddLesson={addLesson}
                                onUpdateLesson={updateLessonField}
                                onRemoveLesson={removeLesson}
                                onReorderLessons={reorderLessons}
                                applyFormat={applyFormat}
                                isDemoEnabled={tempIsDemoEnabled}
                            />
                            ))}
                        </Reorder.Group>
                        <Button onClick={addModule} size="sm" variant="outline" className="w-full mt-4">
                            <Plus className="mr-2 h-4 w-4" /> Adicionar Módulo
                        </Button>
                    </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
        <TabsContent value="analytics">
            <CourseAnalytics courseId={courseId} courseTitle={course.title} />
        </TabsContent>
      </Tabs>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-md border-t border-border">
          <div className="container mx-auto flex justify-between items-center gap-4">
              <div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSaving}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir Curso
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir este curso?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação é permanente e não pode ser desfeita. Todos os módulos, aulas e dados de progresso dos alunos associados a este curso serão excluídos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                        Confirmar Exclusão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="flex items-center gap-4">
                <Button asChild variant="outline">
                      <Link href={`/courses/${courseId}`}>
                          <Eye className="mr-2 h-4 w-4" /> Visualizar
                      </Link>
                  </Button>
                  <Button onClick={() => handleSave('draft')} disabled={isSaving} variant="secondary">
                      <Save className="mr-2 h-4 w-4" />{isSaving ? "Salvando..." : "Salvar Rascunho"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isSaving}>
                        <Send className="mr-2 h-4 w-4" />{isSaving ? "Publicando..." : "Publicar"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Publicar o curso?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação tornará o curso e todas as suas alterações visíveis para os alunos com acesso.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleSave('published')}>Confirmar e Publicar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              </div>
          </div>
      </div>
    </div>
  );
}


// --- ModuleEditor Component ---

interface ModuleEditorProps {
    module: Module;
    onUpdate: <K extends keyof Module>(moduleId: string, field: K, value: Module[K]) => void;
    onRemove: (moduleId: string, moduleTitle: string) => void;
    onAddLesson: (moduleId: string) => void;
    onUpdateLesson: (moduleId: string, lessonId: string, field: keyof Lesson, value: any) => void;
    onRemoveLesson: (moduleId: string, lessonId: string, lessonTitle: string) => void;
    onReorderLessons: (moduleId: string, reorderedLessons: Lesson[]) => void;
    applyFormat: (command: string, value?: string) => void;
    isDemoEnabled: boolean;
}

function ModuleEditor({ module, onUpdate, onRemove, onAddLesson, onUpdateLesson, onRemoveLesson, onReorderLessons, applyFormat, isDemoEnabled }: ModuleEditorProps) {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
    const { toast } = useToast();
    const dragControls = useDragControls();

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
        <Reorder.Item
            value={module}
            dragListener={false}
            dragControls={dragControls}
            className="bg-secondary/30 rounded-lg border transition-shadow"
            whileDrag={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.1)' }}
        >
            <Collapsible defaultOpen className="group/collapsible transition-all hover:bg-secondary/40 rounded-lg">
                <div className="flex items-start gap-4 p-4 ">
                    <div className="flex-shrink-0 flex items-center gap-2 h-full">
                        <GripVertical
                          className="h-5 w-5 text-muted-foreground cursor-grab"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation(); 
                            dragControls.start(e);
                          }}
                        />
                        <div className="relative aspect-[2/3] w-24 rounded-md overflow-hidden bg-muted">
                            <Image src={module.thumbnailUrl || DEFAULT_MODULE_IMAGE} alt={module.title} fill className="object-cover" />
                        </div>
                    </div>

                    <div className="flex-grow w-full space-y-3">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Título do Módulo"
                                value={module.title}
                                onChange={(e) => onUpdate(module.id, 'title', e.target.value)}
                                className="font-semibold flex-grow"
                            />
                             <div className="relative w-36">
                                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="number"
                                    placeholder="Dias"
                                    value={module.releaseDelayDays || ''}
                                    onChange={(e) => onUpdate(module.id, 'releaseDelayDays', Number(e.target.value))}
                                    className="pl-8"
                                    min={0}
                                />
                            </div>
                        </div>


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
                            <TabsContent value="url" className="mt-2 relative">
                                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input 
                                    type="text" 
                                    placeholder="https://exemplo.com/capa.png" 
                                    value={module.thumbnailUrl === DEFAULT_MODULE_IMAGE ? '' : module.thumbnailUrl} 
                                    onChange={(e) => handleUrlChange(e.target.value)} 
                                    className="w-full bg-background/50 pl-8 text-xs h-9"
                                />
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
                                    <AlertDialogAction onClick={() => onRemove(module.id, module.title)}>Confirmar Exclusão</AlertDialogAction>
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
                        <Reorder.Group axis="y" values={module.lessons} onReorder={(reordered) => onReorderLessons(module.id, reordered)} className="space-y-3">
                            {module.lessons.map((lesson) => (
                               <LessonEditor 
                                  key={lesson.id}
                                  lesson={lesson}
                                  moduleId={module.id}
                                  onUpdate={onUpdateLesson}
                                  onRemove={onRemoveLesson}
                                  applyFormat={applyFormat}
                                  isDemoEnabled={isDemoEnabled}
                               />
                            ))}
                        </Reorder.Group>
                         <Button type="button" variant="link" size="sm" className="w-full" onClick={() => onAddLesson(module.id)}>
                            <Plus className="mr-2 h-4 w-4" /> Adicionar Aula
                        </Button>
                     </div>
                </CollapsibleContent>
            </Collapsible>
        </Reorder.Item>
    );
}

// --- LessonEditor Component ---

interface LessonEditorProps {
  lesson: Lesson;
  moduleId: string;
  onUpdate: (moduleId: string, lessonId: string, field: keyof Lesson, value: any) => void;
  onRemove: (moduleId: string, lessonId: string, lessonTitle: string) => void;
  applyFormat: (command: string, value?:string) => void;
  isDemoEnabled: boolean;
}

function LessonEditor({ lesson, moduleId, onUpdate, onRemove, applyFormat, isDemoEnabled }: LessonEditorProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
    const { toast } = useToast();
    const dragControls = useDragControls();

    const isDriveLink = lesson.videoUrl && lesson.videoUrl.includes('drive.google.com');

    const [activeEditor, setActiveEditor] = useState<string | null>(null);
    const lessonDescriptionRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (lessonDescriptionRef.current) {
            lessonDescriptionRef.current.innerHTML = lesson.description || '';
        }
    }, [lesson.description]);


    const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setVideoFile(file);
            setVideoUploadProgress(0);

            const storage = getStorage();
            const storageRef = ref(storage, `courses/lessons/${moduleId}/${lesson.id}/${Date.now()}-${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => setVideoUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => {
                    console.error(error);
                    toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar o vídeo." });
                    setVideoUploadProgress(null);
                },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                        onUpdate(moduleId, lesson.id, 'videoUrl', downloadURL);
                        setVideoUploadProgress(null);
                        setVideoFile(null);
                        toast({ title: "Sucesso!", description: "Vídeo da aula enviado." });
                    });
                }
            );
        }
    };

    const handleAddMaterial = () => {
        const newMaterial: ComplementaryMaterial = { id: uuidv4(), title: '', url: '' };
        const updatedMaterials = [...(lesson.complementaryMaterials || []), newMaterial];
        onUpdate(moduleId, lesson.id, 'complementaryMaterials', updatedMaterials);
    };

    const handleUpdateMaterial = (materialId: string, field: keyof Omit<ComplementaryMaterial, 'id'>, value: string) => {
        const updatedMaterials = (lesson.complementaryMaterials || []).map(m =>
            m.id === materialId ? { ...m, [field]: value } : m
        );
        onUpdate(moduleId, lesson.id, 'complementaryMaterials', updatedMaterials);
    };

    const handleRemoveMaterial = (materialId: string) => {
        const updatedMaterials = (lesson.complementaryMaterials || []).filter(m => m.id !== materialId);
        onUpdate(moduleId, lesson.id, 'complementaryMaterials', updatedMaterials);
    };
    
    const toggleIsDemo = () => {
        onUpdate(moduleId, lesson.id, 'isDemo', !lesson.isDemo);
    }

    return (
        <Reorder.Item
            value={lesson}
            dragListener={false}
            dragControls={dragControls}
            className="p-3 space-y-3 rounded-md border bg-background/50 transition-shadow"
            whileDrag={{ boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' }}
        >
            <div className="flex items-center gap-2">
                <GripVertical
                    className="h-5 w-5 text-muted-foreground cursor-grab"
                    onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dragControls.start(e);
                    }}
                />
                <Input
                    placeholder="Título da Aula"
                    value={lesson.title}
                    onChange={(e) => onUpdate(moduleId, lesson.id, 'title', e.target.value)}
                    className="h-9 flex-grow"
                />
                <div className="relative w-36">
                    <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="number"
                        placeholder="Dias"
                        value={lesson.releaseDelayDays || ''}
                        onChange={(e) => onUpdate(moduleId, lesson.id, 'releaseDelayDays', Number(e.target.value))}
                        className="h-9 pl-8"
                        min={0}
                    />
                </div>
                 {isDemoEnabled && (
                    <Button type="button" variant="ghost" size="icon" onClick={toggleIsDemo} title={lesson.isDemo ? "Remover da demo" : "Adicionar à demo"}>
                        {lesson.isDemo ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground/70" />}
                    </Button>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(moduleId, lesson.id, lesson.title)}>
                    <Trash2 className="h-4 w-4 text-destructive/70" />
                </Button>
            </div>

            <div className="relative">
                <label className="text-xs text-muted-foreground">Descrição da aula</label>
                 {activeEditor === lesson.id && (
                    <ActionToolbar
                        className="absolute -top-12 z-10"
                        buttons={[
                           { label: 'Negrito', icon: <Bold className="size-4" />, onClick: () => applyFormat('bold') },
                           { label: 'Itálico', icon: <Italic className="size-4" />, onClick: () => applyFormat('italic') },
                           { label: 'Sublinhado', icon: <Underline className="size-4" />, onClick: () => applyFormat('underline') },
                           { label: 'Cor', icon: <Palette className="size-4" />, onClick: () => applyFormat('foreColor', '#FFD700') },
                        ]}
                    />
                )}
                <div
                    id={`lesson-desc-${lesson.id}`}
                    ref={lessonDescriptionRef}
                    contentEditable
                    suppressContentEditableWarning
                    onFocus={() => setActiveEditor(lesson.id)}
                    onBlur={(e) => {
                        setActiveEditor(null);
                        onUpdate(moduleId, lesson.id, 'description', e.currentTarget.innerHTML);
                    }}
                    className="mt-1 min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 prose prose-sm prose-invert max-w-none"
                />
            </div>

            {/* Main Video Section */}
            <div className="space-y-2 pt-2">
                <h5 className="text-sm font-semibold text-white flex items-center gap-2"><FileVideo className="h-4 w-4 text-primary" />Vídeo Principal (Opcional)</h5>
                 <p className="text-xs text-muted-foreground italic -mt-1">Caso nenhum vídeo seja adicionado, a aula será classificada como conteúdo de texto/extra.</p>

                {lesson.videoUrl && !isDriveLink && (
                    <div className="aspect-video w-full rounded-md overflow-hidden bg-muted my-2">
                        <ReactPlayer
                            url={lesson.videoUrl}
                            width="100%"
                            height="100%"
                            controls={true}
                            light={false}
                            playing={false}
                        />
                    </div>
                )}

                {isDriveLink && (
                    <div className="my-2 p-3 rounded-md bg-secondary/50 border border-blue-500/50 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-400 flex-shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m10.4 17.6 1.6-1.6"></path><path d="m12 16 3-3"></path><path d="m11.2 14.8 3.2-3.2"></path></svg>
                        <div>
                            <p className="text-sm font-medium text-white">Link do Google Drive Anexado</p>
                            <p className="text-xs text-muted-foreground truncate">{lesson.videoUrl}</p>
                        </div>
                    </div>
                )}

                <Tabs defaultValue="url" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-8">
                        <TabsTrigger value="upload" className="text-xs">Enviar Mídia</TabsTrigger>
                        <TabsTrigger value="url" className="text-xs">Usar URL</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload" className="mt-2">
                        <label htmlFor={`lesson-video-upload-${lesson.id}`} className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-white border border-dashed rounded-md p-2 justify-center bg-background/50">
                            <Upload className="h-3 w-3" /><span>{videoFile ? videoFile.name : 'Selecionar arquivo (vídeo, pdf...)'}</span>
                        </label>
                        <Input id={`lesson-video-upload-${lesson.id}`} type="file" accept="video/*,application/pdf,image/*" onChange={handleVideoFileChange} className="hidden" />
                        {videoUploadProgress !== null && (<Progress value={videoUploadProgress} className="w-full h-1 mt-2" />)}
                    </TabsContent>
                    <TabsContent value="url" className="mt-2">
                        <Input
                            placeholder="URL do Vídeo (YouTube, Vimeo) ou Link (Google Drive)"
                            value={lesson.videoUrl}
                            onChange={(e) => onUpdate(moduleId, lesson.id, 'videoUrl', e.target.value)}
                            className="h-8 text-xs"
                        />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Complementary Content Section */}
            <div className="space-y-3 pt-4 mt-4 border-t border-border/50">
                <h5 className="text-sm font-semibold text-white flex items-center gap-2"><Book className="h-4 w-4 text-primary" />Conteúdo Complementar (Opcional)</h5>
                {(lesson.complementaryMaterials || []).map((material) => (
                   <ComplementaryMaterialEditor 
                        key={material.id}
                        material={material}
                        moduleId={moduleId}
                        lessonId={lesson.id}
                        onUpdate={handleUpdateMaterial}
                        onRemove={handleRemoveMaterial}
                   />
                ))}
                <Button type="button" variant="link" size="sm" className="w-full" onClick={handleAddMaterial}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Material
                </Button>
            </div>
        </Reorder.Item>
    );
}

interface ComplementaryMaterialEditorProps {
    material: ComplementaryMaterial;
    moduleId: string;
    lessonId: string;
    onUpdate: (materialId: string, field: keyof Omit<ComplementaryMaterial, 'id'>, value: string) => void;
    onRemove: (materialId: string) => void;
}

function ComplementaryMaterialEditor({ material, moduleId, lessonId, onUpdate, onRemove }: ComplementaryMaterialEditorProps) {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setUploadProgress(0);

            const storage = getStorage();
            const storageRef = ref(storage, `courses/lessons/${moduleId}/${lessonId}/complementary/${Date.now()}-${selectedFile.name}`);
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);

            uploadTask.on('state_changed',
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => {
                    console.error("Upload failed: ", error);
                    toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar o material." });
                    setUploadProgress(null);
                },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                        onUpdate(material.id, 'url', downloadURL);
                        if (!material.title) {
                            onUpdate(material.id, 'title', selectedFile.name);
                        }
                        toast({ title: "Sucesso!", description: "Material complementar enviado." });
                        setUploadProgress(null);
                        setFile(null);
                    });
                }
            );
        }
    };
    
    return (
        <div className="flex flex-col gap-2 p-3 rounded-md bg-secondary/40 border border-border/50">
             <div className="flex justify-between items-start">
                <Input
                    placeholder="Título do material"
                    value={material.title}
                    onChange={(e) => onUpdate(material.id, 'title', e.target.value)}
                    className="h-8 text-xs flex-grow"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(material.id)}>
                    <Trash2 className="h-4 w-4 text-destructive/70" />
                </Button>
            </div>

            <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="upload" className="text-xs">Enviar Arquivo</TabsTrigger>
                    <TabsTrigger value="url" className="text-xs">Usar URL</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="mt-2">
                    <label htmlFor={`material-upload-${material.id}`} className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-white border border-dashed rounded-md p-2 justify-center bg-background/50">
                        <Upload className="h-3 w-3" /><span>{file ? file.name : 'Selecionar arquivo'}</span>
                    </label>
                    <Input id={`material-upload-${material.id}`} type="file" onChange={handleFileChange} className="hidden" />
                    {uploadProgress !== null && (<Progress value={uploadProgress} className="w-full h-1 mt-2" />)}
                </TabsContent>
                <TabsContent value="url" className="mt-2">
                     <Input
                        placeholder="URL do material"
                        value={material.url}
                        onChange={(e) => onUpdate(material.id, 'url', e.target.value)}
                        className="h-8 text-xs"
                    />
                </TabsContent>
            </Tabs>
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

    