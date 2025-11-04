
'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, updateDoc, type DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Save, X, Upload, Link2, Smartphone, Monitor, Lock, Trophy, AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline, Palette, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { addDays, differenceInDays, parseISO } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ActionToolbar } from '@/components/ui/action-toolbar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Module {
    id: string;
    title: string;
    thumbnailUrl: string;
    imageHint: string;
    releaseDelayDays?: number;
    lessons: { id: string; title: string; releaseDelayDays?: number }[];
}
  
interface Course extends DocumentData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  modules: Module[];
  heroImageUrlDesktop?: string;
  heroImageUrlMobile?: string;
  status: 'draft' | 'published';
  heroAlignment?: "left" | "center" | "end";
  heroTextVisible?: boolean;
}

interface CourseAccessInfo {
    grantedAt: string; // ISO string date
}

interface UserProgress {
    completedLessons: Record<string, any>;
}

const DEFAULT_HERO_IMAGE_DESKTOP = "https://i.imgur.com/1X3ta7W.png";
const DEFAULT_HERO_IMAGE_MOBILE = "https://i.imgur.com/PFv07gS.png";


export default function CoursePlayerPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [courseAccessInfo, setCourseAccessInfo] = useState<CourseAccessInfo | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Temp states for editing
  const [tempHeroImageDesktop, setTempHeroImageDesktop] = useState(DEFAULT_HERO_IMAGE_DESKTOP);
  const [tempHeroImageMobile, setTempHeroImageMobile] = useState(DEFAULT_HERO_IMAGE_MOBILE);

  const [heroImageDesktopFile, setHeroImageDesktopFile] = useState<File | null>(null);
  const [heroImageMobileFile, setHeroImageMobileFile] = useState<File | null>(null);
  
  const [heroImageUrlInputDesktop, setHeroImageUrlInputDesktop] = useState('');
  const [heroImageUrlInputMobile, setHeroImageUrlInputMobile] = useState('');

  const [imageInputMode, setImageInputMode] = useState<'desktop' | 'mobile'>('desktop');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [tempSubtitle, setTempSubtitle] = useState('');
  const [tempDescription, setTempDescription] = useState('');
  const [tempHeroAlignment, setTempHeroAlignment] = useState<'left' | 'center' | 'end'>('left');
  const [tempHeroTextVisible, setTempHeroTextVisible] = useState(true);

  const [activeEditor, setActiveEditor] = useState<string | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [openCollapsible, setOpenCollapsible] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchCourseData = useCallback(async () => {
    if (!user || !firestore) {
        if(!userLoading) router.push('/login');
        return;
    };

    setLoading(true);

    try {
        // Check admin status
        let userIsAdmin = false;
        if (user.email === 'admin@reidavsl.com') {
            userIsAdmin = true;
        } else {
            const userDocRef = doc(firestore, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            userIsAdmin = userDocSnap.exists() && userDocSnap.data().role === 'admin';
        }
        setIsAdmin(userIsAdmin);

        // Check course access
        const accessDocRef = doc(firestore, `users/${user.uid}/courseAccess`, courseId);
        const accessDocSnap = await getDoc(accessDocRef);

        if (!accessDocSnap.exists() && !userIsAdmin) {
            toast({ variant: "destructive", title: "Acesso Negado", description: "Você não tem acesso a este curso." });
            router.push('/dashboard');
            return;
        }
        if(accessDocSnap.exists()){
            const accessTimestamp = accessDocSnap.data().grantedAt?.toDate();
            if (accessTimestamp) {
                setCourseAccessInfo({ grantedAt: accessTimestamp.toISOString() });
            }
        } else if (userIsAdmin) {
            setCourseAccessInfo({ grantedAt: new Date().toISOString() });
        }

        // Fetch course data
        const courseRef = doc(firestore, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);
        if (!courseSnap.exists()) {
            toast({ variant: "destructive", title: "Erro", description: "Curso não encontrado." });
            router.push('/dashboard');
            return;
        }

        const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
        if (courseData.status === 'draft' && !userIsAdmin) {
            toast({ variant: "destructive", title: "Curso Indisponível", description: "Este curso ainda não foi publicado." });
            router.push('/dashboard');
            return;
        }
        
        setCourse(courseData);
        setTempTitle(courseData.title);
        setTempSubtitle(courseData.subtitle || 'Rei da VSL®');
        setTempDescription(courseData.description);
        setTempHeroImageDesktop(courseData.heroImageUrlDesktop || DEFAULT_HERO_IMAGE_DESKTOP);
        setTempHeroImageMobile(courseData.heroImageUrlMobile || DEFAULT_HERO_IMAGE_MOBILE);
        setHeroImageUrlInputDesktop(courseData.heroImageUrlDesktop || '');
        setHeroImageUrlInputMobile(courseData.heroImageUrlMobile || '');
        setTempHeroAlignment(courseData.heroAlignment || 'left');
        setTempHeroTextVisible(courseData.heroTextVisible !== undefined ? courseData.heroTextVisible : true);

        // Fetch user progress
        const progressRef = doc(firestore, `users/${user.uid}/progress`, courseId);
        const progressSnap = await getDoc(progressRef);
        if (progressSnap.exists()) {
            setUserProgress(progressSnap.data() as UserProgress);
        }
    } catch (error: any) {
        console.error('Error fetching course data:', error);
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `courses/${courseId}`,
                operation: 'get'
            }));
        }
        toast({ variant: "destructive", title: "Erro de Permissão", description: "Ocorreu um erro ao carregar o curso." });
    } finally {
        setLoading(false);
    }
  }, [user, firestore, courseId, router, toast, userLoading]);

  useEffect(() => {
    if (!userLoading && user && firestore) {
      fetchCourseData();
    }
  }, [user, userLoading, firestore, fetchCourseData]);

  const enterEditMode = () => {
    setIsEditMode(true);
    if (course) {
        setTempTitle(course.title);
        setTempSubtitle(course.subtitle || 'Rei da VSL®');
        setTempDescription(course.description);
        setTempHeroImageDesktop(course.heroImageUrlDesktop || DEFAULT_HERO_IMAGE_DESKTOP);
        setTempHeroImageMobile(course.heroImageUrlMobile || DEFAULT_HERO_IMAGE_MOBILE);
        setHeroImageUrlInputDesktop(course.heroImageUrlDesktop || '');
        setHeroImageUrlInputMobile(course.heroImageUrlMobile || '');
        setTempHeroAlignment(course.heroAlignment || 'left');
        setTempHeroTextVisible(course.heroTextVisible !== undefined ? course.heroTextVisible : true);
    }
  };

  const cancelEditMode = () => {
    setIsEditMode(false);
    if (course) {
      setTempTitle(course.title);
      setTempSubtitle(course.subtitle || 'Rei da VSL®');
      setTempDescription(course.description);
      setTempHeroImageDesktop(course.heroImageUrlDesktop || DEFAULT_HERO_IMAGE_DESKTOP);
      setTempHeroImageMobile(course.heroImageUrlMobile || DEFAULT_HERO_IMAGE_MOBILE);
      setHeroImageUrlInputDesktop(course.heroImageUrlDesktop || '');
      setHeroImageUrlInputMobile(course.heroImageUrlMobile || '');
      setTempHeroAlignment(course.heroAlignment || 'left');
      setTempHeroTextVisible(course.heroTextVisible !== undefined ? course.heroTextVisible : true);
    }
    setHeroImageDesktopFile(null);
    setHeroImageMobileFile(null);
    setUploadProgress(null);
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
  
  const handleSaveChanges = async () => {
    if (!firestore || !courseId) return;
    setIsSaving(true);
    setUploadProgress(null);

    let finalHeroImageUrlDesktop = tempHeroImageDesktop;
    let finalHeroImageUrlMobile = tempHeroImageMobile;

    try {
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
        const dataToSave = {
            title: tempTitle,
            subtitle: tempSubtitle,
            description: tempDescription,
            heroImageUrlDesktop: finalHeroImageUrlDesktop,
            heroImageUrlMobile: finalHeroImageUrlMobile,
            heroAlignment: tempHeroAlignment,
            heroTextVisible: tempHeroTextVisible,
        };

        await updateDoc(courseRef, dataToSave);

        setCourse(prev => prev ? { ...prev, ...dataToSave } : null);
        toast({ title: "Sucesso!", description: "O curso foi atualizado." });
        setIsEditMode(false);

    } catch (error: any) {
        console.error('Error saving course:', error);
        const permissionError = new FirestorePermissionError({
            path: `courses/${courseId}`,
            operation: 'update',
            requestResourceData: { title: tempTitle }
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível salvar as alterações." });
    } finally {
        setIsSaving(false);
        setUploadProgress(null);
    }
  };

  const isModuleUnlocked = useCallback((module: Module): boolean => {
    if (isAdmin || !isClient) return true;
    if (!courseAccessInfo) return false;

    const delay = module.releaseDelayDays || 0;
    if (delay === 0) return true;

    try {
      const grantedDate = parseISO(courseAccessInfo.grantedAt);
      const releaseDate = addDays(grantedDate, delay);
      return new Date() >= releaseDate;
    } catch (e) {
      console.error("Error parsing date for module unlock check", e);
      return false;
    }
  }, [isAdmin, isClient, courseAccessInfo]);

  const getDaysUntilRelease = (module: Module): number | null => {
    if (!courseAccessInfo || isAdmin || !isClient) return null;
    
    const delay = module.releaseDelayDays || 0;
    if (delay === 0) return null;
    
    try {
        const grantedDate = parseISO(courseAccessInfo.grantedAt);
        const releaseDate = addDays(grantedDate, delay);
        const daysRemaining = differenceInDays(releaseDate, new Date());
        return daysRemaining >= 0 ? daysRemaining : null;
    } catch (e) {
        console.error("Error parsing date for days until release", e);
        return null;
    }
  };

  const calculateModuleProgress = (module: Module) => {
    if (!userProgress) return 0;
    const moduleLessons = module.lessons || [];
    if (moduleLessons.length === 0) return 0;

    const completedLessonsInModule = moduleLessons.filter(
        lesson => userProgress.completedLessons?.[lesson.id]
    ).length;
    
    return (completedLessonsInModule / moduleLessons.length) * 100;
  };
  
    const applyFormat = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
    };

    useEffect(() => {
        if (isEditMode) {
            if (titleRef.current) titleRef.current.innerHTML = tempTitle;
            if (descriptionRef.current) descriptionRef.current.innerHTML = tempDescription;
        } else if (course) {
            if (titleRef.current) titleRef.current.innerHTML = course.title;
            if (descriptionRef.current) descriptionRef.current.innerHTML = course.description;
        }
    }, [isEditMode, tempTitle, tempDescription, course]);

  if (loading || userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando curso ou verificando permissões...</p>
      </div>
    );
  }

  const firstLessonId = course.modules?.[0]?.lessons?.[0]?.id;

  const heroContainerClasses = cn(
    "relative z-10 mx-auto flex w-full max-w-3xl flex-col px-4",
    {
      'items-start text-left': tempHeroAlignment === 'left',
      'items-center text-center': tempHeroAlignment === 'center',
      'items-end text-right': tempHeroAlignment === 'end'
    }
  );

  const heroContentVisible = isEditMode || (course.heroTextVisible !== undefined ? course.heroTextVisible : true);


  return (
    <div className="w-full">
      <section className={cn(
        "relative flex h-[60vh] min-h-[450px] w-full items-center justify-center py-12",
        isEditMode && "border-2 border-dashed border-primary/50"
      )}>
        <div className="absolute inset-0 z-0">
          <picture>
            <source srcSet={isEditMode ? tempHeroImageMobile : course.heroImageUrlMobile || DEFAULT_HERO_IMAGE_MOBILE} media="(max-width: 768px)" />
            <img
                src={isEditMode ? tempHeroImageDesktop : course.heroImageUrlDesktop || DEFAULT_HERO_IMAGE_DESKTOP}
                alt={course.title}
                className="object-cover w-full h-full"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        {heroContentVisible && (
        <div className={heroContainerClasses}>
             <div
                ref={titleRef}
                contentEditable={isEditMode}
                suppressContentEditableWarning
                onFocus={() => setActiveEditor('title')}
                onBlur={(e) => {
                    setActiveEditor(null);
                    setTempTitle(e.currentTarget.innerHTML);
                }}
                className={cn(
                    "text-4xl md:text-6xl font-bold tracking-tight text-white",
                    "prose prose-xl prose-invert max-w-none",
                    isEditMode && "outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2"
                )}
                dangerouslySetInnerHTML={{ __html: isEditMode ? tempTitle : course.title }}
              />
              {isEditMode && activeEditor === 'title' && (
                <ActionToolbar
                    className="absolute -top-14"
                    buttons={[
                        { label: "Esquerda", icon: <AlignLeft className="size-4" />, onClick: () => setTempHeroAlignment('left') },
                        { label: "Centro", icon: <AlignCenter className="size-4" />, onClick: () => setTempHeroAlignment('center') },
                        { label: "Direita", icon: <AlignRight className="size-4" />, onClick: () => setTempHeroAlignment('end') },
                        { label: "Negrito", icon: <Bold className="size-4" />, onClick: () => applyFormat('bold') },
                        { label: "Itálico", icon: <Italic className="size-4" />, onClick: () => applyFormat('italic') },
                        { label: "Sublinhado", icon: <Underline className="size-4" />, onClick: () => applyFormat('underline') },
                    ]}
                />
              )}

             <div
                ref={descriptionRef}
                contentEditable={isEditMode}
                suppressContentEditableWarning
                onFocus={() => setActiveEditor('description')}
                onBlur={(e) => {
                    setActiveEditor(null);
                    setTempDescription(e.currentTarget.innerHTML);
                }}
                className={cn(
                    "mt-4 text-lg text-muted-foreground",
                    "prose prose-invert max-w-none",
                    isEditMode && "outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2"
                )}
                dangerouslySetInnerHTML={{ __html: isEditMode ? tempDescription : course.description }}
             />
              {isEditMode && activeEditor === 'description' && (
                  <ActionToolbar
                      className="absolute -bottom-14"
                      buttons={[
                        { label: "Negrito", icon: <Bold className="size-4" />, onClick: () => applyFormat('bold') },
                        { label: "Itálico", icon: <Italic className="size-4" />, onClick: () => applyFormat('italic') },
                        { label: "Sublinhado", icon: <Underline className="size-4" />, onClick: () => applyFormat('underline') },
                      ]}
                  />
              )}
        </div>
        )}
        
        {isAdmin && !isEditMode && (
          <div className="absolute top-24 right-8 z-20 flex items-center gap-2">
            <Button onClick={enterEditMode} variant="outline"><Pencil className="mr-2 h-4 w-4" /> Editar Página</Button>
            <Button asChild variant="default">
                <Link href={`/admin/edit-course/${courseId}`}>Gerenciar Módulos</Link>
            </Button>
          </div>
        )}

        {isAdmin && isEditMode && (
          <div className="absolute top-24 right-8 z-20 flex flex-col items-end gap-2">
            <Collapsible open={openCollapsible === 'banner'} onOpenChange={(isOpen) => setOpenCollapsible(isOpen ? 'banner' : null)} className="w-full max-w-xs">
                    <CollapsibleTrigger asChild>
                        <Button variant="outline"><Pencil className="mr-2 h-4 w-4" /> Editar Banner</Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 w-full space-y-4 p-4 rounded-lg bg-background/80 border border-border backdrop-blur-sm">
                        <div className="flex items-center justify-between space-x-2 rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <Label htmlFor="text-visibility" className="text-sm font-medium text-white">
                                  Exibir Textos
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Mostrar/ocultar título e descrição.
                                </p>
                            </div>
                            <Switch
                                id="text-visibility"
                                checked={tempHeroTextVisible}
                                onCheckedChange={setTempHeroTextVisible}
                            />
                        </div>
                         <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as 'desktop' | 'mobile')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="desktop"><Monitor className="mr-2 h-4 w-4"/> Computador</TabsTrigger>
                                <TabsTrigger value="mobile"><Smartphone className="mr-2 h-4 w-4"/> Celular</TabsTrigger>
                            </TabsList>
                            <TabsContent value="desktop" className="mt-4">
                                <div className="space-y-2">
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
                    </CollapsibleContent>
                </Collapsible>
                <div className="flex gap-2">
                    <Button onClick={handleSaveChanges} disabled={isSaving}><Save className="mr-2 h-4 w-4" /> {isSaving ? 'Salvando...' : 'Salvar'}</Button>
                    <Button onClick={cancelEditMode} variant="secondary"><X className="mr-2 h-4 w-4" /> Cancelar</Button>
                </div>
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 py-12 md:px-8">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-primary" />
                <div>
                  {isEditMode ? (
                    <Input 
                        value={tempSubtitle}
                        onChange={(e) => setTempSubtitle(e.target.value)}
                        className="text-sm text-muted-foreground bg-transparent border-2 border-dashed border-primary/50"
                    />
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-white">{course.title}</h2>
                      <p className="text-sm text-muted-foreground">{course.subtitle || 'Rei da VSL®'}</p>
                    </>
                  )}
                </div>
            </div>
             {isAdmin && (
                <Button asChild variant="outline">
                    <Link href={`/admin/edit-course/${courseId}`}>
                        <Pencil className="mr-2 h-4 w-4" /> Gerenciar Módulos
                    </Link>
                </Button>
            )}
        </div>
        
        {course.modules && course.modules.length > 0 ? (
          <Carousel
            opts={{
              align: "start",
              loop: false,
            }}
            className="w-full group"
          >
            <CarouselContent>
              {course.modules.map((module, index) => {
                  const unlocked = isModuleUnlocked(module);
                  const daysRemaining = getDaysUntilRelease(module);
                  const progress = unlocked ? calculateModuleProgress(module) : null;
                  const firstLessonId = module.lessons?.[0]?.id;

                  return (
                    <CarouselItem key={module.id || index} className="basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                        <Link 
                            href={unlocked && firstLessonId ? `/courses/${courseId}/${firstLessonId}` : '#'}
                            className={cn("block", !unlocked && "pointer-events-none")}
                        >
                            <div className="relative p-1">
                                <div className={cn(
                                    "group relative block aspect-[2/3] w-full overflow-hidden rounded-lg bg-card shadow-lg transition-all",
                                    !unlocked && "cursor-not-allowed"
                                )}>
                                    <Image
                                        src={module.thumbnailUrl || `https://picsum.photos/seed/${module.id}/400/600`}
                                        alt={module.title}
                                        width={400}
                                        height={600}
                                        data-ai-hint={module.imageHint}
                                        priority={index < 5}
                                        className={cn(
                                            "object-cover transition-transform duration-300 ease-in-out h-full w-full",
                                            unlocked && "group-hover:scale-105",
                                            !unlocked && "grayscale"
                                        )}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                    <div className="absolute bottom-0 left-0 p-4 w-full">
                                        <h3 className="font-semibold text-white transition-colors duration-300 group-hover:text-primary">{module.title}</h3>
                                        {progress !== null && progress >= 0 && (
                                            <div className="mt-2">
                                                <Progress value={progress} className="h-1.5" />
                                                <p className="text-xs text-white/80 mt-1">{Math.round(progress)}% concluído</p>
                                            </div>
                                        )}
                                    </div>

                                    {!unlocked && (
                                    <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center text-center p-4">
                                        <Lock className="h-8 w-8 text-primary mb-2" />
                                        <p className="text-white font-semibold">Bloqueado</p>
                                        <p className="text-xs text-muted-foreground">
                                            {daysRemaining !== null 
                                                ? `Libera em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}`
                                                : 'Em breve'}
                                        </p>
                                    </div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </CarouselItem>
                  )
              })}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-12 rounded-lg bg-secondary/50">
            <p className="text-muted-foreground">Nenhum módulo encontrado para este curso.</p>
            {isAdmin && (
                 <Button asChild className="mt-4">
                    <Link href={`/admin/edit-course/${courseId}`}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Módulo
                    </Link>
                </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
