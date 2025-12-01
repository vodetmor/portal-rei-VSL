
'use client';
import { useUser, useFirestore } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { CourseCard } from '@/components/course-card';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, type DocumentData, updateDoc, addDoc, query, where, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useLayout } from '@/context/layout-context';
import { ActionToolbar } from '@/components/ui/action-toolbar';
import { PageEditActions } from '@/components/admin/page-edit-actions';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Pencil, Save, X, Trophy, Gem, Crown, Star, type LucideIcon, Upload, Link2, Trash2, ChevronDown, AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline, Palette, Smartphone, Monitor, Eye, EyeOff } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';


interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageHint: string;
  checkoutUrl?: string;
  vslUrl?: string;
  isDemoEnabled?: boolean;
  isFree?: boolean;
  modules: { lessons: any[] }[];
  status: 'draft' | 'published';
}

interface UserProgress {
    [courseId: string]: {
        completedLessons: Record<string, any>;
    }
}

interface CourseAccess {
    [courseId: string]: boolean;
}


const iconMap: { [key: string]: LucideIcon } = {
  Trophy,
  Gem,
  Crown,
  Star,
};


function DashboardClientPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { layoutData, setLayoutData, isEditMode, setIsEditMode } = useLayout();


  const [courses, setCourses] = useState<Course[]>([]);
  const [courseAccess, setCourseAccess] = useState<CourseAccess>({});
  const [loadingData, setLoadingData] = useState(true);
  const [userProgress, setUserProgress] = useState<UserProgress>({});
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [activeEditor, setActiveEditor] = useState<string | null>(null);


  // States for temporary edits
  const [tempHeroTitle, setTempHeroTitle] = useState(layoutData.heroTitle);
  const [tempHeroSubtitle, setTempHeroSubtitle] = useState(layoutData.heroSubtitle);
  const [tempHeroImageDesktop, setTempHeroImageDesktop] = useState(layoutData.heroImageDesktop);
  const [tempHeroImageMobile, setTempHeroImageMobile] = useState(layoutData.heroImageMobile);
  const [tempCtaText, setTempCtaText] = useState(layoutData.ctaText);
  const [heroAlignment, setHeroAlignment] = useState(layoutData.heroAlignment);
  const [tempHeroTextVisible, setTempHeroTextVisible] = useState(layoutData.heroTextVisible);
  
  const [heroImageDesktopFile, setHeroImageDesktopFile] = useState<File | null>(null);
  const [heroImageMobileFile, setHeroImageMobileFile] = useState<File | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'desktop' | 'mobile'>('desktop');
  const [tempHeroImageUrlInputDesktop, setTempHeroImageUrlInputDesktop] = useState('');
  const [tempHeroImageUrlInputMobile, setTempHeroImageUrlInputMobile] = useState('');

  const [openCollapsible, setOpenCollapsible] = useState<string | null>(null);
  
  const coursesSectionRef = useRef<HTMLDivElement>(null);

  const calculateProgress = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    const progress = userProgress[courseId];
    if (!course || !progress) return 0;
    
    const totalLessons = course.modules?.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0) || 0;
    if (totalLessons === 0) return 0;

    const completedCount = Object.keys(progress.completedLessons).length;
    return (completedCount / totalLessons) * 100;
};


  const applyFormat = (command: string) => {
    const editorId = activeEditor;
    if (!editorId) return;

    const editorElement = document.getElementById(editorId);
    if (!editorElement || !editorElement.isContentEditable) return;
    
    // For applying color, we'll wrap the selection in a span
    if (command === 'foreColor') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
  
      if (selectedText) {
        const span = document.createElement('span');
        span.className = 'text-primary';
        span.textContent = selectedText;
  
        range.deleteContents();
        range.insertNode(span);
      }
      return;
    }
  
    // For other commands like bold, italic, just use execCommand
    document.execCommand(command, false, undefined);
  };
  
  
  const enterEditMode = () => {
    setTempHeroTitle(layoutData.heroTitle);
    setTempHeroSubtitle(layoutData.heroSubtitle);
    setTempHeroImageDesktop(layoutData.heroImageDesktop);
    setTempHeroImageMobile(layoutData.heroImageMobile);
    setTempCtaText(layoutData.ctaText);
    setHeroAlignment(layoutData.heroAlignment);
    setTempHeroTextVisible(layoutData.heroTextVisible);
    setTempHeroImageUrlInputDesktop(layoutData.heroImageDesktop);
    setTempHeroImageUrlInputMobile(layoutData.heroImageMobile);
    setHeroImageDesktopFile(null);
    setHeroImageMobileFile(null);
    setUploadProgress(null);
    setIsEditMode(true);
  };


  const cancelEditMode = () => {
    setIsEditMode(false);
    setActiveEditor(null);
    setOpenCollapsible(null);
  };

  const uploadImage = async (file: File, path: string): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
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
  };

  const handleSaveChanges = async () => {
    if (!firestore) return;
    setIsSaving(true);
    setUploadProgress(null);

    try {
        let finalHeroImageUrlDesktop = tempHeroImageDesktop;
        if (heroImageDesktopFile) {
            finalHeroImageUrlDesktop = await uploadImage(heroImageDesktopFile, 'layout/dashboard-hero/desktop');
        } else if (tempHeroImageUrlInputDesktop) {
            finalHeroImageUrlDesktop = tempHeroImageUrlInputDesktop;
        }

        let finalHeroImageUrlMobile = tempHeroImageMobile;
        if (heroImageMobileFile) {
            finalHeroImageUrlMobile = await uploadImage(heroImageMobileFile, 'layout/dashboard-hero/mobile');
        } else if (tempHeroImageUrlInputMobile) {
            finalHeroImageUrlMobile = tempHeroImageUrlInputMobile;
        }

        const dataToSave = {
            title: tempHeroTitle,
            subtitle: tempHeroSubtitle,
            imageUrlDesktop: finalHeroImageUrlDesktop,
            imageUrlMobile: finalHeroImageUrlMobile,
            ctaText: tempCtaText,
            heroAlignment: heroAlignment,
            heroTextVisible: tempHeroTextVisible,
        };
        
        const layoutRef = doc(firestore, 'layout', 'dashboard-hero');
      
        await setDoc(layoutRef, dataToSave, { merge: true });
        
        setLayoutData(prev => ({ 
            ...prev, 
            heroTitle: dataToSave.title,
            heroSubtitle: dataToSave.subtitle,
            heroImageDesktop: dataToSave.imageUrlDesktop,
            heroImageMobile: dataToSave.imageUrlMobile,
            ctaText: dataToSave.ctaText,
            heroAlignment: dataToSave.heroAlignment,
            heroTextVisible: dataToSave.heroTextVisible,
        }));

        toast({
            title: "Sucesso!",
            description: "As alterações do layout foram salvas.",
        });
        setIsEditMode(false);
        setActiveEditor(null);
    } catch (error) {
      console.error("Error saving layout:", error);
      const permissionError = new FirestorePermissionError({
          path: `layout/dashboard-hero`,
          operation: 'update',
          requestResourceData: { error: 'data not shown for brevity' }
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Não foi possível salvar as alterações. Verifique as permissões.",
      });
    } finally {
        setIsSaving(false);
        setUploadProgress(null);
        setHeroImageDesktopFile(null);
        setHeroImageMobileFile(null);
    }
  };


  const handleHeroFileChange = (e: React.ChangeEvent<HTMLInputElement>, device: 'desktop' | 'mobile') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
          if (device === 'desktop') {
            setHeroImageDesktopFile(file);
            setTempHeroImageDesktop(reader.result as string);
          } else {
            setHeroImageMobileFile(file);
            setTempHeroImageMobile(reader.result as string);
          }
      };
    }
  };

  const handleHeroUrlChange = (e: React.ChangeEvent<HTMLInputElement>, device: 'desktop' | 'mobile') => {
    const url = e.target.value;
     if (device === 'desktop') {
        setTempHeroImageUrlInputDesktop(url);
        if (url.startsWith('http')) setTempHeroImageDesktop(url);
    } else {
        setTempHeroImageUrlInputMobile(url);
        if (url.startsWith('http')) setTempHeroImageMobile(url);
    }
  };

  const handleRemoveHeroImage = (device: 'desktop' | 'mobile') => {
    if (device === 'desktop') {
        setTempHeroImageDesktop(layoutData.defaults.heroImageDesktop);
        setTempHeroImageUrlInputDesktop('');
        setHeroImageDesktopFile(null);
    } else {
        setTempHeroImageMobile(layoutData.defaults.heroImageMobile);
        setTempHeroImageUrlInputMobile('');
        setHeroImageMobileFile(null);
    }
  };

  const handleCourseUpdate = async (courseId: string, data: Partial<Course>) => {
    if (!firestore) return;

    const courseRef = doc(firestore, 'courses', courseId);
    try {
      await updateDoc(courseRef, data);
      toast({ title: 'Curso atualizado!' });
      // Refresh local state
      setCourses(courses.map(c => c.id === courseId ? { ...c, ...data } : c));
    } catch (error: any) {
      console.error('Error updating course:', error);
      const permissionError = new FirestorePermissionError({
        path: courseRef.path,
        operation: 'update',
        requestResourceData: data,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({ variant: 'destructive', title: 'Erro ao atualizar curso.' });
    }
  };

  const handleConfirmDelete = (courseId: string) => {
    if (!firestore) return;
    const courseRef = doc(firestore, 'courses', courseId);
    deleteDoc(courseRef)
      .then(() => {
        toast({
          title: "Curso Excluído",
          description: "O curso foi removido com sucesso.",
        });
        if (user) {
            fetchCoursesAndProgress();
        }
      })
      .catch((error) => {
        console.error("Error deleting course: ", error);
        const permissionError = new FirestorePermissionError({
          path: courseRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: "destructive",
          title: "Erro ao Excluir",
          description: "Não foi possível excluir o curso. Verifique as permissões."
        });
      });
  };

  const handleAddCourse = () => {
    if (!firestore) return;
    const newCourseData = {
      title: "Novo Curso (Rascunho)",
      description: "Adicione uma descrição incrível para o seu novo curso.",
      thumbnailUrl: "https://i.imgur.com/1X3ta7W.png",
      imageHint: 'placeholder',
      createdAt: new Date(),
      modules: [],
      status: 'draft' as 'draft' | 'published',
    };
    const coursesCollection = collection(firestore, 'courses');
    addDoc(coursesCollection, newCourseData)
      .then((docRef) => {
        toast({
          title: "Rascunho Criado!",
          description: "Seu novo curso foi iniciado. Agora edite os detalhes.",
        });
        router.push(`/admin/edit-course/${docRef.id}`);
      })
      .catch((error) => {
        console.error("Error creating new course draft: ", error);
        const permissionError = new FirestorePermissionError({
            path: coursesCollection.path,
            operation: 'create',
            requestResourceData: newCourseData
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: "destructive",
          title: "Erro ao Criar Rascunho",
          description: "Não foi possível criar o rascunho do curso."
        });
      });
  };

  const fetchCoursesAndProgress = useCallback(async (userIsAdmin?: boolean) => {
    if (!firestore || !user) return;
    setLoadingData(true);
  
    try {
      const coursesRef = collection(firestore, 'courses');
      const coursesQuery = userIsAdmin ? query(coursesRef) : query(coursesRef, where('status', '==', 'published'));
      
      const coursesSnapshot = await getDocs(coursesQuery);
      const fetchedCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      
      setCourses(fetchedCourses);
  
      // Fetch course access
      const newCourseAccess: CourseAccess = {};
      const accessSnapshot = await getDocs(collection(firestore, `users/${user.uid}/courseAccess`));
      accessSnapshot.docs.forEach(doc => newCourseAccess[doc.id] = true);
      
      fetchedCourses.forEach(course => {
          if (course.isFree || userIsAdmin) {
              newCourseAccess[course.id] = true;
          }
      });
      setCourseAccess(newCourseAccess);
  
      // Fetch progress for accessible courses
      const accessibleCourseIds = Object.keys(newCourseAccess);
      if (accessibleCourseIds.length > 0) {
          const progressPromises = accessibleCourseIds.map(id => getDoc(doc(firestore, `users/${user.uid}/progress`, id)));
          const progressSnaps = await Promise.all(progressPromises);
          const progressData: UserProgress = {};
          progressSnaps.forEach(snap => {
              if (snap.exists()) {
                  progressData[snap.id] = snap.data() as UserProgress[string];
              }
          });
          setUserProgress(progressData);
      }
    } catch (error: any) {
        console.error("Error fetching courses and progress: ", error);
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `courses`,
                operation: 'list'
            }));
        }
        toast({ variant: "destructive", title: "Erro ao Carregar", description: "Não foi possível carregar os cursos." });
        setCourses([]);
    } finally {
        setLoadingData(false);
    }
  }, [firestore, user, toast]);

  const redeemPremiumLink = useCallback(async (linkId: string) => {
    if (!firestore || !user) return;

    try {
        const linkRef = doc(firestore, 'premiumLinks', linkId);
        const linkSnap = await getDoc(linkRef);

        if (!linkSnap.exists()) {
            toast({ variant: "destructive", title: "Link Inválido", description: "O link de acesso premium não foi encontrado." });
            return;
        }

        const linkData = linkSnap.data();
        if (linkData.active === false) {
            toast({ variant: "destructive", title: "Link Inativo", description: "Este link de acesso não está mais ativo." });
            return;
        }

        if (linkData.maxUses > 0 && linkData.uses >= linkData.maxUses) {
            toast({ variant: "destructive", title: "Limite Atingido", description: "O limite de usos para este link foi atingido." });
            return;
        }
        
        const courseIdsToGrant: string[] = linkData.courseIds || [];
        if (courseIdsToGrant.length === 0) {
            toast({ title: "Nenhum curso no link", description: "Este link premium não contém cursos." });
            return;
        }

        const batch = writeBatch(firestore);
        let grantedCount = 0;
        
        const currentAccessSnapshot = await getDocs(collection(firestore, `users/${user.uid}/courseAccess`));
        const currentAccessIds = new Set(currentAccessSnapshot.docs.map(d => d.id));

        courseIdsToGrant.forEach((courseId: string) => {
            if (!currentAccessIds.has(courseId)) {
                const accessRef = doc(firestore, `users/${user.uid}/courseAccess`, courseId);
                batch.set(accessRef, {
                    courseId: courseId,
                    grantedAt: serverTimestamp()
                });
                grantedCount++;
            }
        });
        
        if (grantedCount > 0) {
            batch.update(linkRef, {
                uses: increment(1)
            });
            
            await batch.commit();
            toast({ title: "Acesso Liberado!", description: `${grantedCount} novo(s) curso(s) foram adicionados à sua conta.` });
            if (user) {
              const userDocRef = doc(firestore, 'users', user.uid);
              const userDocSnap = await getDoc(userDocRef);
              const userIsAdmin = userDocSnap.exists() && userDocSnap.data().role === 'admin';
              await fetchCoursesAndProgress(userIsAdmin);
            }
        } else {
            toast({ title: "Tudo Certo!", description: "Você já tem acesso a todos os cursos deste link." });
        }

    } catch (error: any) {
        console.error("Error redeeming premium link: ", error);
        const permissionError = new FirestorePermissionError({
            path: `premiumLinks/${linkId}`,
            operation: 'get'
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível resgatar o acesso premium." });
    } finally {
        router.replace('/dashboard', { scroll: false });
    }
  }, [firestore, user, toast, router, fetchCoursesAndProgress]);

 useEffect(() => {
    if (userLoading || !firestore) {
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }

    const checkAdminAndFetch = async () => {
      let userIsAdmin = false;
      if (user?.email === 'admin@reidavsl.com') {
          userIsAdmin = true;
      } else if(user && firestore) {
          try {
              const userDocRef = doc(firestore, 'users', user.uid);
              const userDocSnap = await getDoc(userDocRef);
              userIsAdmin = userDocSnap.exists() && userDocSnap.data().role === 'admin';
          } catch (e) {
              console.error("Failed to check admin status", e);
          }
      }
      setIsAdmin(userIsAdmin);
      await fetchCoursesAndProgress(userIsAdmin);
    };

    checkAdminAndFetch();
    
    const linkId = searchParams.get('linkId');
    if (linkId) {
        redeemPremiumLink(linkId);
    }
  }, [user, userLoading, firestore, router, fetchCoursesAndProgress, redeemPremiumLink, searchParams]);


  if (userLoading || loadingData || layoutData.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  const heroContainerClasses = cn(
    "relative z-10 mx-auto flex w-full max-w-4xl flex-col px-4",
    {
      'items-start': heroAlignment === 'left',
      'items-center': heroAlignment === 'center',
      'items-end': heroAlignment === 'end'
    }
  );

  const textContainerClasses = cn(
    "w-full",
    {
      'text-left': heroAlignment === 'left',
      'text-center': heroAlignment === 'center',
      'text-right': heroAlignment === 'end'
    }
  );


  const handleCtaClick = () => {
    if (isEditMode) return;
    coursesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const heroContentVisible = isEditMode || layoutData.heroTextVisible;

  return (
      <div className="w-full">
        {/* Hero Section */}
        <section className={cn(
          "relative flex h-[60vh] min-h-[500px] w-full flex-col justify-center",
          isEditMode && "border-2 border-dashed border-primary/50"
        )}>
          {layoutData.isLoading ? <Skeleton className="absolute inset-0 z-0" /> : (
              <div className="absolute inset-0 z-0">
                <picture>
                  <source srcSet={isEditMode ? tempHeroImageMobile : layoutData.heroImageMobile} media="(max-width: 768px)" />
                  <source srcSet={isEditMode ? tempHeroImageDesktop : layoutData.heroImageDesktop} media="(min-width: 769px)" />
                  <Image
                    src={isEditMode ? tempHeroImageDesktop : layoutData.heroImageDesktop}
                    alt="Hero background"
                    fill
                    className="object-cover"
                    data-ai-hint="digital art collage"
                    priority
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
              </div>
          )}

          {heroContentVisible && (
            <div className={heroContainerClasses}>
                <div className={cn("relative w-full", textContainerClasses)}>
                  <div
                      id="hero-title-editor"
                      contentEditable={isEditMode}
                      suppressContentEditableWarning={true}
                      onFocus={() => setActiveEditor('hero-title-editor')}
                      onBlur={() => setActiveEditor(null)}
                      onInput={(e) => setTempHeroTitle(e.currentTarget.innerHTML)}
                      className={cn(
                          "text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl",
                          "prose prose-xl prose-invert max-w-none",
                          isEditMode && "outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2"
                      )}
                      dangerouslySetInnerHTML={{ __html: isEditMode ? tempHeroTitle : layoutData.heroTitle }}
                  />
                  {isEditMode && activeEditor === 'hero-title-editor' && (
                    <ActionToolbar
                      className="absolute -top-14"
                      buttons={[
                        { label: "Esquerda", icon: <AlignLeft className="size-4" />, onClick: () => setHeroAlignment('left'), active: heroAlignment === 'left' },
                        { label: "Centro", icon: <AlignCenter className="size-4" />, onClick: () => setHeroAlignment('center'), active: heroAlignment === 'center' },
                        { label: "Direita", icon: <AlignRight className="size-4" />, onClick: () => setHeroAlignment('end'), active: heroAlignment === 'end' },
                        { label: "Bold", icon: <Bold className="size-4" />, onClick: () => applyFormat('bold') },
                        { label: "Italic", icon: <Italic className="size-4" />, onClick: () => applyFormat('italic') },
                        { label: "Underline", icon: <Underline className="size-4" />, onClick: () => applyFormat('underline') },
                        { label: "Cor", icon: <Palette className="size-4" />, onClick: () => applyFormat('foreColor') },
                      ]}
                    />
                  )}
                </div>

                <div className={cn("relative mt-4 w-full", textContainerClasses)}>
                  <div
                      id="hero-subtitle-editor"
                      contentEditable={isEditMode}
                      suppressContentEditableWarning={true}
                      onFocus={() => setActiveEditor('hero-subtitle-editor')}
                      onBlur={() => setActiveEditor(null)}
                      onInput={(e) => setTempHeroSubtitle(e.currentTarget.innerHTML)}
                      className={cn(
                          "max-w-2xl text-lg text-muted-foreground md:text-xl",
                          "prose prose-lg prose-invert max-w-none",
                          isEditMode && "outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2"
                      )}
                      dangerouslySetInnerHTML={{ __html: isEditMode ? tempHeroSubtitle : layoutData.heroSubtitle }}
                  />
                  {isEditMode && activeEditor === 'hero-subtitle-editor' && (
                      <ActionToolbar
                          className="absolute -top-14"
                          buttons={[
                              { label: "Bold", icon: <Bold className="size-4" />, onClick: () => applyFormat('bold') },
                              { label: "Italic", icon: <Italic className="size-4" />, onClick: () => applyFormat('italic') },
                              { label: "Underline", icon: <Underline className="size-4" />, onClick: () => applyFormat('underline') },
                              { label: "Cor", icon: <Palette className="size-4" />, onClick: () => applyFormat('foreColor') },
                          ]}
                      />
                  )}
                </div>

              <div className={cn("mt-8", textContainerClasses)}>
                {isEditMode ? (
                  <div
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onInput={(e) => setTempCtaText(e.currentTarget.innerHTML)}
                      className="inline-block px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-lg font-semibold outline-none focus:ring-2 focus:ring-ring"
                      dangerouslySetInnerHTML={{ __html: tempCtaText }}
                  >
                  </div>
                ) : (
                  <Button onClick={handleCtaClick} size="lg" variant="default" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <span dangerouslySetInnerHTML={{ __html: layoutData.ctaText }} />
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {isAdmin && !isEditMode && (
            <div className="absolute top-24 right-8 z-20">
              <Button onClick={enterEditMode} variant="outline">
                <Pencil className="mr-2 h-4 w-4" /> Editar Página
              </Button>
            </div>
          )}
          {isAdmin && isEditMode && (
             <div className="absolute top-24 right-8 z-20 flex flex-col items-end gap-4">
                <Collapsible open={openCollapsible === 'banner'} onOpenChange={(isOpen) => setOpenCollapsible(isOpen ? 'banner' : null)} className="w-full max-w-xs">
                    <CollapsibleTrigger asChild>
                        <Button variant="outline"><Pencil className="mr-2 h-4 w-4" /> Editar Banner</Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 w-full space-y-4 p-4 rounded-lg bg-background/80 border border-border backdrop-blur-sm">
                        <div className="flex items-center justify-between space-x-2 rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <Label htmlFor="text-visibility" className="text-sm font-medium text-white">
                                  Exibir Textos e Botão
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Desative para exibir apenas a imagem de fundo.
                                </p>
                            </div>
                            <Switch
                                id="text-visibility"
                                checked={tempHeroTextVisible}
                                onCheckedChange={setTempHeroTextVisible}
                            />
                        </div>
                         <Tabs value={imageInputMode} onValueChange={(value) => setImageInputMode(value as 'desktop' | 'mobile')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="desktop"><Monitor className="mr-2 h-4 w-4" /> Computador</TabsTrigger>
                                <TabsTrigger value="mobile"><Smartphone className="mr-2 h-4 w-4" /> Celular</TabsTrigger>
                            </TabsList>
                            <TabsContent value="desktop" className="mt-4 space-y-3">
                                <ImageUploader
                                    device="desktop"
                                    file={heroImageDesktopFile}
                                    onFileChange={handleHeroFileChange}
                                    url={tempHeroImageUrlInputDesktop}
                                    onUrlChange={handleHeroUrlChange}
                                    onRemove={handleRemoveHeroImage}
                                    uploadProgress={uploadProgress}
                                    isUploading={isSaving && imageInputMode === 'desktop'}
                                />
                            </TabsContent>
                            <TabsContent value="mobile" className="mt-4 space-y-3">
                                <ImageUploader
                                    device="mobile"
                                    file={heroImageMobileFile}
                                    onFileChange={handleHeroFileChange}
                                    url={tempHeroImageUrlInputMobile}
                                    onUrlChange={handleHeroUrlChange}
                                    onRemove={handleRemoveHeroImage}
                                    uploadProgress={uploadProgress}
                                    isUploading={isSaving && imageInputMode === 'mobile'}
                                />
                            </TabsContent>
                        </Tabs>
                    </CollapsibleContent>
                </Collapsible>
                 <PageEditActions
                    onSave={handleSaveChanges}
                    onCancel={cancelEditMode}
                    isSaving={isSaving}
                 />
             </div>
          )}

        </section>

        {/* All Courses Section */}
        <section ref={coursesSectionRef} className="container mx-auto px-4 py-16 md:px-8 space-y-12">
          
           <div>
            <div className="flex justify-between items-center mb-4 pt-20">
                <h2 className="text-2xl font-bold text-white">Meus Cursos</h2>
                 {isAdmin && (
                    <Button onClick={handleAddCourse} variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Curso
                    </Button>
                )}
            </div>
            {loadingData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index}>
                          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                      </div>
                  ))}
                </div>
            ) : courses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {courses.map((course, index) => (
                    <CourseCard
                        key={course.id}
                        course={course}
                        progress={isAdmin || courseAccess[course.id] ? calculateProgress(course.id) : null}
                        isLocked={!isAdmin && !courseAccess[course.id]}
                        priority={index < 4}
                        isAdmin={isAdmin}
                        isEditing={isEditMode}
                        onUpdate={handleCourseUpdate}
                        onDelete={handleConfirmDelete}
                    />
                  ))}
              </div>
            ) : (
                <div className="text-center py-16 px-4 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">Você ainda não tem acesso a nenhum curso.</p>
                    <p className="text-sm text-muted-foreground mt-2">Explore a plataforma ou contate o suporte.</p>
                </div>
            )}
          </div>
        </section>
      </div>
  );
}

function ImageUploader({
  device,
  file,
  onFileChange,
  url,
  onUrlChange,
  onRemove,
  uploadProgress,
  isUploading
}: {
  device: 'desktop' | 'mobile';
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, device: 'desktop' | 'mobile') => void;
  url: string;
  onUrlChange: (e: React.ChangeEvent<HTMLInputElement>, device: 'desktop' | 'mobile') => void;
  onRemove: (device: 'desktop' | 'mobile') => void;
  uploadProgress: number | null;
  isUploading: boolean;
}) {
  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="upload">Enviar</TabsTrigger>
        <TabsTrigger value="url">URL</TabsTrigger>
      </TabsList>
      <TabsContent value="upload" className="mt-4 space-y-3">
        <label htmlFor={`hero-image-upload-${device}`} className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-white border border-dashed rounded-md p-3 justify-center bg-background/50">
          <Upload className="h-4 w-4" />
          <span>{file ? file.name : 'Selecionar imagem'}</span>
        </label>
        <Input id={`hero-image-upload-${device}`} type="file" accept="image/*" onChange={(e) => onFileChange(e, device)} className="hidden" />
        {isUploading && uploadProgress !== null && <Progress value={uploadProgress} className="w-full h-2" />}
      </TabsContent>
      <TabsContent value="url" className="mt-4">
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="text" placeholder="https://exemplo.com/imagem.png" value={url} onChange={(e) => onUrlChange(e, device)} className="w-full bg-background/50 pl-9" />
        </div>
      </TabsContent>
      <Button onClick={() => onRemove(device)} variant="outline" size="sm" className="w-full gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
        <Trash2 className="h-4 w-4" />
        Remover Imagem
      </Button>
    </Tabs>
  );
}

export default function DashboardPage() {
  return (
    <DashboardClientPage />
  )
}
