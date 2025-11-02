'use client';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { CourseCard } from '@/components/course-card';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, type DocumentData, updateDoc, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useLayout } from '@/context/layout-context';
import { ActionToolbar } from '@/components/ui/action-toolbar';
import { PageEditActions } from '@/components/admin/page-edit-actions';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Pencil, Save, X, Trophy, Gem, Crown, Star, type LucideIcon, Upload, Link2, Trash2, ChevronDown, AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline, Palette, Smartphone, Monitor } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageHint: string;
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
  const { toast } = useToast();
  const { layoutData, setLayoutData, isEditMode, setIsEditMode } = useLayout();


  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
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
  
  const [heroImageDesktopFile, setHeroImageDesktopFile] = useState<File | null>(null);
  const [heroImageMobileFile, setHeroImageMobileFile] = useState<File | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'desktop' | 'mobile'>('desktop');
  const [tempHeroImageUrlInputDesktop, setTempHeroImageUrlInputDesktop] = useState('');
  const [tempHeroImageUrlInputMobile, setTempHeroImageUrlInputMobile] = useState('');

  const [openCollapsible, setOpenCollapsible] = useState<string | null>(null);
  
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const coursesSectionRef = useRef<HTMLDivElement>(null);


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
        }

        let finalHeroImageUrlMobile = tempHeroImageMobile;
        if (heroImageMobileFile) {
            finalHeroImageUrlMobile = await uploadImage(heroImageMobileFile, 'layout/dashboard-hero/mobile');
        }

        const titleContent = titleRef.current?.innerHTML || tempHeroTitle;
        const subtitleContent = subtitleRef.current?.innerHTML || tempHeroSubtitle;
        const ctaContent = ctaRef.current?.innerHTML || tempCtaText;

        const dataToSave = {
            title: titleContent,
            subtitle: subtitleContent,
            imageUrlDesktop: finalHeroImageUrlDesktop,
            imageUrlMobile: finalHeroImageUrlMobile,
            ctaText: ctaContent,
            heroAlignment: heroAlignment,
        };
        
        const layoutRef = doc(firestore, 'layout', 'dashboard-hero');
      
        setDoc(layoutRef, dataToSave, { merge: true }).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: layoutRef.path,
                operation: 'update',
                requestResourceData: dataToSave,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
        
        setLayoutData(prev => ({ 
            ...prev, 
            heroTitle: dataToSave.title,
            heroSubtitle: dataToSave.subtitle,
            heroImageDesktop: dataToSave.imageUrlDesktop,
            heroImageMobile: dataToSave.imageUrlMobile,
            ctaText: dataToSave.ctaText,
            heroAlignment: dataToSave.heroAlignment,
        }));

        toast({
            title: "Sucesso!",
            description: "As alterações do layout foram salvas.",
        });
        setIsEditMode(false);
        setActiveEditor(null);
    } catch (error) {
      console.error("Error saving layout:", error);
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
    } catch (error) {
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


  const fetchCourses = useCallback(async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, 'courses'));
      const coursesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Course[];
      setCourses(coursesData);
    } catch (error) {
      console.error("Error fetching courses: ", error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [firestore]);
  
  const handleConfirmDelete = (courseId: string) => {
    if (!firestore) return;
    const courseRef = doc(firestore, 'courses', courseId);
    deleteDoc(courseRef)
      .then(() => {
        toast({
          title: "Curso Excluído",
          description: "O curso foi removido com sucesso.",
        });
        fetchCourses();
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
      thumbnailUrl: "https://picsum.photos/seed/new-course/400/600",
      imageHint: 'placeholder',
      createdAt: new Date(),
      modules: [],
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


  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    const checkAdminAndFetchData = async () => {
      if (user && firestore) {
        if (user.email === 'admin@reidavsl.com') {
          setIsAdmin(true);
        } else {
            const userDocRef = doc(firestore, 'users', user.uid);
            try {
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists() && userDoc.data().role === 'admin') {
                setIsAdmin(true);
              } else {
                setIsAdmin(false);
              }
            } catch (error) {
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
                setIsAdmin(false);
            }
        }
        
        await fetchCourses();

      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    };

    if (user && firestore) {
      checkAdminAndFetchData();
    }
  }, [user, firestore, fetchCourses]);
  
  // Effect to set initial content of contentEditable divs & sync state
  useEffect(() => {
    const titleEl = titleRef.current;
    const subtitleEl = subtitleRef.current;
    const ctaEl = ctaRef.current;
  
    if (titleEl && isEditMode) {
      titleEl.innerHTML = tempHeroTitle;
    }
    if (subtitleEl && isEditMode) {
      subtitleEl.innerHTML = tempHeroSubtitle;
    }
    if (ctaEl && isEditMode) {
        ctaEl.innerHTML = tempCtaText;
    }
}, [isEditMode, tempHeroTitle, tempHeroSubtitle, tempCtaText]);

// Load initial data into non-edit mode
useEffect(() => {
    const titleEl = titleRef.current;
    const subtitleEl = subtitleRef.current;
    const ctaEl = ctaRef.current;
    if (!isEditMode) {
        if (titleEl) titleEl.innerHTML = layoutData.heroTitle;
        if (subtitleEl) subtitleEl.innerHTML = layoutData.heroSubtitle;
        if (ctaEl) ctaEl.innerHTML = layoutData.ctaText;
    }
}, [isEditMode, layoutData]);


  if (userLoading || !user || layoutData.isLoading) {
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

          <div className={heroContainerClasses}>
              <div className={cn("relative w-full", textContainerClasses)}>
                 <div
                    id="hero-title-editor"
                    ref={titleRef}
                    contentEditable={isEditMode}
                    suppressContentEditableWarning={true}
                    onFocus={() => setActiveEditor('hero-title-editor')}
                    onBlur={(e) => {
                      setActiveEditor(null);
                      setTempHeroTitle(e.currentTarget.innerHTML);
                    }}
                    className={cn(
                        "text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl",
                        isEditMode && "outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2"
                    )}
                 />
                {isEditMode && activeEditor === 'hero-title-editor' && (
                  <ActionToolbar
                    className="absolute -top-14"
                    buttons={[
                      { label: "Esquerda", icon: <AlignLeft className="size-4" />, onClick: () => setHeroAlignment('left') },
                      { label: "Centro", icon: <AlignCenter className="size-4" />, onClick: () => setHeroAlignment('center') },
                      { label: "Direita", icon: <AlignRight className="size-4" />, onClick: () => setHeroAlignment('end') },
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
                    ref={subtitleRef}
                    contentEditable={isEditMode}
                    suppressContentEditableWarning={true}
                    onFocus={() => setActiveEditor('hero-subtitle-editor')}
                    onBlur={(e) => {
                      setActiveEditor(null);
                      setTempHeroSubtitle(e.currentTarget.innerHTML);
                    }}
                    className={cn(
                        "max-w-2xl text-lg text-muted-foreground md:text-xl",
                        isEditMode && "outline-none focus:ring-2 focus:ring-primary rounded-md p-2 -m-2"
                    )}
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
                    ref={ctaRef}
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => setTempCtaText(e.currentTarget.innerHTML)}
                    className="inline-block px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-lg font-semibold outline-none focus:ring-2 focus:ring-ring"
                 >
                 </div>
              ) : (
                <Button onClick={handleCtaClick} size="lg" variant="default" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <span dangerouslySetInnerHTML={{ __html: layoutData.ctaText }} />
                </Button>
              )}
            </div>
          </div>
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
                    <CollapsibleContent className="mt-2 w-full space-y-2 p-4 rounded-lg bg-background/80 border border-border backdrop-blur-sm">
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
             </div>
          )}

        </section>

        {/* All Courses Section */}
        <section ref={coursesSectionRef} className="container mx-auto px-4 py-16 md:px-8 space-y-12">
          
           <div>
            <div className="flex justify-between items-center mb-4 pt-20">
                <h2 className="text-2xl font-bold text-white">Todos os Cursos</h2>
                 {isAdmin && (
                    <Button onClick={handleAddCourse} variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Curso
                    </Button>
                )}
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index}>
                          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                      </div>
                  ))}
                </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {courses.map((course, index) => (
                    <CourseCard
                        key={course.id}
                        course={course}
                        priority={index < 4}
                        isAdmin={isAdmin}
                        isEditing={isEditMode}
                        onUpdate={handleCourseUpdate}
                        onDelete={handleConfirmDelete}
                    />
                  ))}
              </div>
            )}
          </div>
        </section>

        {isEditMode && (
          <PageEditActions
            onSave={handleSaveChanges}
            onCancel={cancelEditMode}
            isSaving={isSaving}
          />
        )}
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
