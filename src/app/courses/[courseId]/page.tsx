
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, useAuth } from '@/firebase';
import { doc, getDoc, updateDoc, type DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { CourseCard } from '@/components/course-card';
import { Plus, Pencil, Save, X, Upload, Link2, Bold, Italic, Underline, Palette, Smartphone, Monitor, Lock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ActionToolbar } from '@/components/ui/action-toolbar';
import { addDays, differenceInDays, parseISO } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

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
  const auth = useAuth();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeEditor, setActiveEditor] = useState<string | null>(null);
  const [courseAccessInfo, setCourseAccessInfo] = useState<CourseAccessInfo | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);


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


  const applyFormat = (command: string) => {
    if (command === 'foreColor') {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (range.collapsed) return;

        const span = document.createElement('span');
        span.className = 'text-primary';
        
        try {
            // This is the robust way to wrap the selected content
            range.surroundContents(span);
        } catch(e) {
            // Fallback for complex selections that can't be surrounded
            document.execCommand('foreColor', false, 'hsl(var(--primary))');
            console.warn("surroundContents failed, using fallback.", e);
        }
        
        // Clear the selection after applying the format
        selection.removeAllRanges();

    } else {
        document.execCommand(command, false);
    }
};

  const checkAdminStatus = useCallback(async () => {
    if (!user || !auth || !firestore) return false;
    if (user.email === 'admin@reidavsl.com') return true;

    try {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        return userDoc.exists() && userDoc.data().role === 'admin';
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
  }, [user, auth, firestore]);


  useEffect(() => {
    // This effect runs when user status changes or firestore is available
    const checkAccessAndFetchData = async () => {
      // Wait until user loading is finished
      if (userLoading) {
        return;
      }

      // If loading is done and there's no user, redirect
      if (!user) {
        toast({ variant: "destructive", title: "Acesso Negado", description: "Você precisa estar logado para ver este curso."});
        router.push('/login');
        return;
      }

      // At this point, we have a user. Now fetch course and check permissions.
      setLoading(true);

      try {
        const userIsAdmin = await checkAdminStatus();
        setIsAdmin(userIsAdmin);

        // Step 2: Fetch course data
        const courseRef = doc(firestore, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);
        if (!courseSnap.exists()) {
          toast({ variant: "destructive", title: "Erro", description: "Curso não encontrado."});
          router.push('/dashboard');
          return;
        }

        const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
        
        // Step 3: Verify access and status
        if (!userIsAdmin && courseData.status !== 'published') {
            toast({ variant: "destructive", title: "Curso Indisponível", description: "Este curso não está disponível no momento."});
            router.push('/dashboard');
            return;
        }
        
        setCourse(courseData);
        // Initialize editing states
        setTempTitle(courseData.title);
        setTempSubtitle(courseData.subtitle || 'Rei da VSL®');
        setTempDescription(courseData.description);
        setTempHeroImageDesktop(courseData.heroImageUrlDesktop || DEFAULT_HERO_IMAGE_DESKTOP);
        setTempHeroImageMobile(courseData.heroImageUrlMobile || DEFAULT_HERO_IMAGE_MOBILE);
        setHeroImageUrlInputDesktop(courseData.heroImageUrlDesktop || '');
        setHeroImageUrlInputMobile(courseData.heroImageUrlMobile || '');

        // Step 4: Verify access record & Fetch progress
        let hasAccess = false;
        if (userIsAdmin) {
          hasAccess = true;
          setCourseAccessInfo({ grantedAt: new Date().toISOString() });
        } else {
          // Check for specific course access for regular users
          const accessRef = doc(firestore, `users/${user.uid}/courseAccess`, courseId);
          const accessSnap = await getDoc(accessRef);
          if (accessSnap.exists()) {
            hasAccess = true;
            const accessData = accessSnap.data();
            const grantedAtDate = accessData.grantedAt.toDate();
            setCourseAccessInfo({ grantedAt: grantedAtDate.toISOString() });
          }
        }
        
        if (!hasAccess) {
            toast({ variant: "destructive", title: "Acesso Negado", description: "Você não tem acesso a este curso."});
            router.push('/dashboard');
            return;
        }

        // Step 5: Fetch progress for the user if they have access
        const progressRef = doc(firestore, `users/${user.uid}/progress`, courseId);
        const progressSnap = await getDoc(progressRef);
        if (progressSnap.exists()) {
            setUserProgress(progressSnap.data() as UserProgress);
        }

      } catch (error) {
        console.error('Error fetching course or access:', error);
        toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao carregar o curso."});
      } finally {
        setLoading(false);
      }
    };
    
    if (firestore && courseId && auth) {
      checkAccessAndFetchData();
    }
  }, [user, userLoading, firestore, courseId, router, toast, auth, checkAdminStatus]);

  // Edit Mode Handlers
  const enterEditMode = () => setIsEditMode(true);
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
    }
    setHeroImageDesktopFile(null);
    setHeroImageMobileFile(null);
    setUploadProgress(null);
    setActiveEditor(null);
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
        };

        updateDoc(courseRef, dataToSave).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: courseRef.path,
                operation: 'update',
                requestResourceData: dataToSave,
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        setCourse(prev => prev ? { ...prev, ...dataToSave } : null);
        toast({ title: "Sucesso!", description: "O curso foi atualizado." });
        setIsEditMode(false);
        setActiveEditor(null);

    } catch (error) {
        console.error('Error saving course:', error);
        toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível salvar as alterações." });
    } finally {
        setIsSaving(false);
        setUploadProgress(null);
    }
  };

  const isModuleUnlocked = useCallback((module: Module) => {
    if (isAdmin) return true; // Admins see everything
    if (!courseAccessInfo) return false; // No access info means no access
    const delay = module.releaseDelayDays || 0;
    if (delay === 0) return true; // No delay means instant access

    const grantedDate = parseISO(courseAccessInfo.grantedAt);
    const releaseDate = addDays(grantedDate, delay);
    return new Date() >= releaseDate;

  }, [courseAccessInfo, isAdmin]);
  
  const getDaysUntilRelease = (module: Module): number | null => {
    if (!courseAccessInfo || isAdmin) return null;
    const delay = module.releaseDelayDays || 0;
    if (delay === 0) return null;
    
    const grantedDate = parseISO(courseAccessInfo.grantedAt);
    const releaseDate = addDays(grantedDate, delay);
    const daysRemaining = differenceInDays(releaseDate, new Date());
    
    return daysRemaining >= 0 ? daysRemaining : null; // Return null if date has passed
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


  if (loading || userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!course) {
    // This state is hit while loading or if access is denied and redirection is pending
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando curso ou verificando permissões...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className={cn(
        "relative flex h-[60vh] min-h-[450px] w-full items-center justify-center text-center py-12",
        isEditMode && "border-2 border-dashed border-primary/50"
      )}>
        <div className="absolute inset-0 z-0">
          <picture>
            <source srcSet={isEditMode ? tempHeroImageMobile : course.heroImageUrlMobile || DEFAULT_HERO_IMAGE_MOBILE} media="(max-width: 768px)" />
            <source srcSet={isEditMode ? tempHeroImageDesktop : course.heroImageUrlDesktop || DEFAULT_HERO_IMAGE_DESKTOP} media="(min-width: 769px)" />
            <Image
                src={isEditMode ? tempHeroImageDesktop : course.heroImageUrlDesktop || DEFAULT_HERO_IMAGE_DESKTOP}
                alt={course.title}
                fill
                className="object-cover"
                priority
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        <div className="relative z-10 p-4 max-w-3xl mx-auto">
             <div className="relative">
                <div
                    id="course-title-editor"
                    contentEditable={isEditMode}
                    suppressContentEditableWarning={true}
                    onFocus={() => setActiveEditor('course-title-editor')}
                    onBlur={() => setActiveEditor(null)}
                    onInput={(e) => setTempTitle(e.currentTarget.innerHTML)}
                    className={cn(
                        "text-4xl md:text-6xl font-bold tracking-tight text-white",
                        isEditMode && "outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2"
                    )}
                    dangerouslySetInnerHTML={{ __html: isEditMode ? tempTitle : course.title }}
                />
                 {isEditMode && activeEditor === 'course-title-editor' && (
                    <ActionToolbar
                        className="absolute -top-14 left-1/2 -translate-x-1/2"
                        buttons={[
                            { label: "Bold", icon: <Bold className="size-4" />, onClick: () => applyFormat('bold') },
                            { label: "Italic", icon: <Italic className="size-4" />, onClick: () => applyFormat('italic') },
                            { label: "Underline", icon: <Underline className="size-4" />, onClick: () => applyFormat('underline') },
                            { label: "Cor", icon: <Palette className="size-4" />, onClick: () => applyFormat('foreColor') },
                        ]}
                    />
                )}
            </div>
             <div className="relative mt-4">
                <div
                    id="course-description-editor"
                    contentEditable={isEditMode}
                    suppressContentEditableWarning={true}
                    onFocus={() => setActiveEditor('course-description-editor')}
                    onBlur={() => setActiveEditor(null)}
                    onInput={(e) => setTempDescription(e.currentTarget.innerHTML)}
                    className={cn(
                        "text-lg text-muted-foreground",
                        isEditMode && "outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2"
                    )}
                    dangerouslySetInnerHTML={{ __html: isEditMode ? tempDescription : course.description }}
                />
                 {isEditMode && activeEditor === 'course-description-editor' && (
                    <ActionToolbar
                        className="absolute -top-14 left-1/2 -translate-x-1/2"
                        buttons={[
                           { label: "Bold", icon: <Bold className="size-4" />, onClick: () => applyFormat('bold') },
                           { label: "Italic", icon: <Italic className="size-4" />, onClick: () => applyFormat('italic') },
                           { label: "Underline", icon: <Underline className="size-4" />, onClick: () => applyFormat('underline') },
                           { label: "Cor", icon: <Palette className="size-4" />, onClick: () => applyFormat('foreColor') },
                        ]}
                    />
                )}
            </div>
        </div>
        
        {isAdmin && !isEditMode && (
          <div className="absolute top-24 right-8 z-20">
            <Button onClick={enterEditMode} variant="outline"><Pencil className="mr-2 h-4 w-4" /> Editar Curso</Button>
          </div>
        )}

        {isAdmin && isEditMode && (
          <div className="absolute bottom-8 right-8 z-20 flex flex-col gap-2 items-end">
            <div className="flex gap-2">
                <Button onClick={handleSaveChanges} disabled={isSaving}><Save className="mr-2 h-4 w-4" /> {isSaving ? 'Salvando...' : 'Salvar'}</Button>
                <Button onClick={cancelEditMode} variant="secondary"><X className="mr-2 h-4 w-4" /> Cancelar</Button>
            </div>
             <div className="w-full max-w-sm p-4 rounded-lg bg-background/80 border border-border backdrop-blur-sm space-y-2">
                <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as 'desktop' | 'mobile')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="desktop"><Monitor className="mr-2 h-4 w-4"/> Computador</TabsTrigger>
                        <TabsTrigger value="mobile"><Smartphone className="mr-2 h-4 w-4"/> Celular</TabsTrigger>
                    </TabsList>
                    <TabsContent value="desktop" className="mt-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-white">Banner do Computador</p>
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
                            <p className="text-sm font-medium text-white">Banner do Celular</p>
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
        )}
      </section>

      {/* Modules Carousel */}
      <section className="container mx-auto px-4 py-12 md:px-8">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-primary" />
                <div>
                    <h2 className="text-xl font-bold text-white">{course.title}</h2>
                    <div
                      id="course-subtitle-editor"
                      contentEditable={isEditMode}
                      suppressContentEditableWarning={true}
                      onFocus={() => setActiveEditor('course-subtitle-editor')}
                      onBlur={() => setActiveEditor(null)}
                      onInput={(e) => setTempSubtitle(e.currentTarget.innerHTML)}
                      className={cn(
                          "text-sm text-muted-foreground",
                          isEditMode && "outline-none focus:ring-2 focus:ring-primary rounded-md p-1 -m-1"
                      )}
                      dangerouslySetInnerHTML={{ __html: isEditMode ? tempSubtitle : (course.subtitle || 'Rei da VSL®') }}
                  />
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
            className="w-full"
          >
            <CarouselContent>
              {course.modules.map((module, index) => {
                  const unlocked = isModuleUnlocked(module);
                  const daysRemaining = getDaysUntilRelease(module);
                  const progress = unlocked ? calculateModuleProgress(module) : null;

                  return (
                    <CarouselItem key={module.id || index} className="basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                      <div className="relative p-1">
                        <CourseCard
                          course={{ ...module, id: module.id || `module-${index}` }}
                          progress={progress}
                          priority={index < 5}
                          isAdmin={false} // Editing happens at the course level for now
                          isLocked={!unlocked}
                        />
                        {!unlocked && (
                          <div className="absolute inset-1 bg-black/70 rounded-lg flex flex-col items-center justify-center text-center p-4">
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
