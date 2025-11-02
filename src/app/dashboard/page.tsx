'use client';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useContext } from 'react';
import { CourseCard } from '@/components/course-card';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, type DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { LayoutContext, LayoutProvider, useLayout } from '@/context/layout-context';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Pencil, Save, X, Trophy, Gem, Crown, Star, type LucideIcon, Upload, Link2, Trash2 } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useToast } from '@/hooks/use-toast';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EditCourseModal } from '@/components/admin/edit-course-modal';

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageHint: string;
  isFeatured?: boolean;
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
  const { layoutData, setLayoutData } = useLayout();


  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // States for temporary edits
  const [tempHeroTitle, setTempHeroTitle] = useState(layoutData.heroTitle);
  const [tempHeroSubtitle, setTempHeroSubtitle] = useState(layoutData.heroSubtitle);
  const [tempHeroImage, setTempHeroImage] = useState(layoutData.heroImage);
  const [tempMembersTitle, setTempMembersTitle] = useState(layoutData.membersTitle);
  const [tempMembersSubtitle, setTempMembersSubtitle] = useState(layoutData.membersSubtitle);
  const [tempMembersIcon, setTempMembersIcon] = useState(layoutData.membersIcon);
  const [tempLogoUrl, setTempLogoUrl] = useState(layoutData.logoUrl);

  
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [tempHeroImageUrlInput, setTempHeroImageUrlInput] = useState('');
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploadProgress, setLogoUploadProgress] = useState<number | null>(null);
  const [logoInputMode, setLogoInputMode] = useState<'upload' | 'url'>('upload');
  const [tempLogoUrlInput, setTempLogoUrlInput] = useState('');

  
  const SelectedIcon = iconMap[isEditMode ? tempMembersIcon : layoutData.membersIcon] || Trophy;


  const enterEditMode = () => {
    setTempHeroTitle(layoutData.heroTitle);
    setTempHeroSubtitle(layoutData.heroSubtitle);
    setTempHeroImage(layoutData.heroImage);
    setTempMembersTitle(layoutData.membersTitle);
    setTempMembersSubtitle(layoutData.membersSubtitle);
    setTempMembersIcon(layoutData.membersIcon);
    setTempLogoUrl(layoutData.logoUrl);
    
    setTempHeroImageUrlInput(layoutData.heroImage);
    setTempLogoUrlInput(layoutData.logoUrl);

    setImageInputMode('upload');
    setHeroImageFile(null);
    setUploadProgress(null);

    setLogoInputMode('upload');
    setLogoFile(null);
    setLogoUploadProgress(null);

    setIsEditMode(true);
  };

  const cancelEditMode = () => {
    setIsEditMode(false);
  };

  // Hero Image Handlers
  const handleHeroFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setHeroImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempHeroImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHeroUrlInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setTempHeroImageUrlInput(newUrl);
    if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
      setTempHeroImage(newUrl);
    }
  };
  
  const handleRemoveHeroImage = () => {
    setTempHeroImage(layoutData.defaults.heroImage);
    setTempHeroImageUrlInput('');
    setHeroImageFile(null);
  };

  // Logo Image Handlers
  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleLogoUrlInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setTempLogoUrlInput(newUrl);
    if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
      setTempLogoUrl(newUrl);
    }
  };
  
  const handleRemoveLogo = () => {
    setTempLogoUrl(layoutData.defaults.logoUrl);
    setTempLogoUrlInput('');
    setLogoFile(null);
  };


  const uploadImage = async (file: File, path: string, progressSetter: (p: number) => void): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => progressSetter((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
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
    setLogoUploadProgress(null);

    let finalHeroImageUrl = tempHeroImage;
    if (imageInputMode === 'upload' && heroImageFile) {
        finalHeroImageUrl = await uploadImage(heroImageFile, 'layout/dashboard-hero', setUploadProgress);
    } else if (imageInputMode === 'url') {
        finalHeroImageUrl = tempHeroImageUrlInput;
    }
    
    let finalLogoUrl = tempLogoUrl;
    if (logoInputMode === 'upload' && logoFile) {
        finalLogoUrl = await uploadImage(logoFile, 'layout/logo', setLogoUploadProgress);
    } else if (logoInputMode === 'url') {
        finalLogoUrl = tempLogoUrlInput;
    }

    if (!finalHeroImageUrl || !finalLogoUrl) {
        toast({ variant: "destructive", title: "Erro", description: "Uma das imagens não foi fornecida." });
        setIsSaving(false);
        return;
    }

    const layoutRef = doc(firestore, 'layout', 'dashboard-hero');
    try {
      const dataToSave = {
        title: tempHeroTitle,
        subtitle: tempHeroSubtitle,
        imageUrl: finalHeroImageUrl,
        membersTitle: tempMembersTitle,
        membersSubtitle: tempMembersSubtitle,
        membersIcon: tempMembersIcon,
        logoUrl: finalLogoUrl,
      };

      await setDoc(layoutRef, dataToSave, { merge: true });
      
      setLayoutData(prev => ({ ...prev, ...dataToSave }));

      toast({
        title: "Sucesso!",
        description: "As alterações do layout foram salvas.",
      });
      setIsEditMode(false);
    } catch (error) {
      console.error("Error saving layout:", error);
      const permissionError = new FirestorePermissionError({
        path: layoutRef.path,
        operation: 'write',
        requestResourceData: { /*...dataToSave*/ },
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
      setLogoUploadProgress(null);
      setHeroImageFile(null);
      setLogoFile(null);
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
  
  const handleConfirmDelete = async () => {
    if (!firestore || !courseToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'courses', courseToDelete));
      toast({
        title: "Curso Excluído",
        description: "O curso foi removido com sucesso.",
      })
      fetchCourses();
    } catch (error) {
      console.error("Error deleting course: ", error);
      toast({
        variant: "destructive",
        title: "Erro ao Excluir",
        description: "Não foi possível excluir o curso. Verifique as permissões."
      });
    } finally {
      setCourseToDelete(null);
    }
  };

  const handleEdit = (course: Course) => {
    setCourseToEdit(course);
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

  if (userLoading || !user || layoutData.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  return (
    <AlertDialog onOpenChange={(open) => !open && setCourseToDelete(null)}>
      <div className="w-full">
        {/* Hero Section */}
        <section className="relative flex h-[60vh] min-h-[450px] w-full flex-col items-center justify-center py-12">
          {layoutData.isLoading ? <Skeleton className="absolute inset-0 z-0" /> : (
              <div className="absolute inset-0 z-0">
                <Image
                  src={isEditMode ? tempHeroImage : layoutData.heroImage}
                  alt="Hero background"
                  fill
                  className="object-cover"
                  data-ai-hint="digital art collage"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
              </div>
          )}

          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-start px-4 text-left">
              {isEditMode ? (
                  <div className='w-full space-y-4 rounded-xl bg-background/50 p-4 border border-border backdrop-blur-sm'>
                      <Input 
                        data-editable="true"
                        value={tempHeroTitle.replace(/<[^>]+>/g, '')} 
                        onChange={(e) => setTempHeroTitle(e.target.value.replace(/<[^>]+>/g, '') + " <span class='text-primary'>começa aqui</span>.")} 
                        className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl bg-transparent border-dashed"
                      />
                      <Input
                        data-editable="true"
                        value={tempHeroSubtitle}
                        onChange={(e) => setTempHeroSubtitle(e.target.value)}
                        className="mt-4 max-w-2xl text-lg md:text-xl bg-transparent border-dashed"
                      />
                     <div className="mt-2 w-full space-y-2">
                      <p className="text-sm font-medium">Imagem do Banner</p>
                      <Tabs value={imageInputMode} onValueChange={(value) => setImageInputMode(value as 'upload' | 'url')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="upload">Enviar Arquivo</TabsTrigger>
                          <TabsTrigger value="url">Usar URL</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upload" className="mt-4">
                          <label htmlFor="hero-image-upload" className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-white border border-dashed rounded-md p-3 justify-center bg-background/50">
                              <Upload className="h-4 w-4" />
                              <span>{heroImageFile ? heroImageFile.name : 'Clique para selecionar a imagem'}</span>
                          </label>
                          <Input
                              id="hero-image-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleHeroFileChange}
                              className="hidden"
                          />
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
                              value={tempHeroImageUrlInput}
                              onChange={handleHeroUrlInputChange}
                              className="w-full bg-background/50 pl-9"
                            />
                           </div>
                        </TabsContent>
                      </Tabs>
                        <Button onClick={handleRemoveHeroImage} variant="outline" size="sm" className="w-full gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
                           <Trash2 className="h-4 w-4" />
                            Remover Imagem do Banner
                        </Button>
                    </div>

                    <div className="mt-4 w-full space-y-2 pt-4 border-t border-border">
                      <p className="text-sm font-medium">Logo</p>
                      <Tabs value={logoInputMode} onValueChange={(value) => setLogoInputMode(value as 'upload' | 'url')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="upload">Enviar Arquivo</TabsTrigger>
                          <TabsTrigger value="url">Usar URL</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upload" className="mt-4">
                          <label htmlFor="logo-image-upload" className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-white border border-dashed rounded-md p-3 justify-center bg-background/50">
                              <Upload className="h-4 w-4" />
                              <span>{logoFile ? logoFile.name : 'Clique para selecionar o logo'}</span>
                          </label>
                          <Input
                              id="logo-image-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoFileChange}
                              className="hidden"
                          />
                           {logoUploadProgress !== null && logoInputMode === 'upload' && (
                              <Progress value={logoUploadProgress} className="w-full h-2 mt-2" />
                          )}
                        </TabsContent>
                        <TabsContent value="url" className="mt-4">
                           <div className="relative">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="https://exemplo.com/logo.png"
                              value={tempLogoUrlInput}
                              onChange={handleLogoUrlInputChange}
                              className="w-full bg-background/50 pl-9"
                            />
                           </div>
                        </TabsContent>
                      </Tabs>
                        <Button onClick={handleRemoveLogo} variant="outline" size="sm" className="w-full gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
                           <Trash2 className="h-4 w-4" />
                            Remover Logo
                        </Button>
                    </div>
                  </div>
              ) : (
                <>
                  <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl"
                      dangerouslySetInnerHTML={{ __html: layoutData.heroTitle }}
                  />

                  <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
                    {layoutData.heroSubtitle}
                  </p>
                </>
              )}

            <div className="mt-8">
              <Button asChild size="lg" variant="destructive" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="#">Assistir Agora</Link>
              </Button>
            </div>
          </div>
          {isAdmin && !isEditMode && (
            <div className="absolute top-24 right-8 z-30">
              <Button onClick={enterEditMode} variant="outline">
                <Pencil className="mr-2 h-4 w-4" /> Editar Página
              </Button>
            </div>
          )}
          {isAdmin && isEditMode && (
             <div className="absolute top-24 right-8 z-30 flex gap-2">
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button onClick={cancelEditMode} variant="secondary">
                    <X className="mr-2 h-4 w-4" /> Cancelar
                </Button>
            </div>
          )}

        </section>

        {/* Members Area Section */}
        <section className="container mx-auto px-4 py-16 md:px-8 space-y-12">
          
          {/* Featured Carousel */}
          <div>
            <div className="mb-4 flex items-center gap-4">
                {isEditMode ? (
                  <div className='flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-dashed border-border'>
                    <Select value={tempMembersIcon} onValueChange={setTempMembersIcon}>
                      <SelectTrigger className="w-fit bg-transparent border-none h-12 px-3" data-editable="true">
                        <SelectValue>
                          <SelectedIcon className="h-8 w-8 text-primary" />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Trophy"><Trophy className="mr-2 h-4 w-4"/>Troféu</SelectItem>
                        <SelectItem value="Gem"><Gem className="mr-2 h-4 w-4"/>Joia</SelectItem>
                        <SelectItem value="Crown"><Crown className="mr-2 h-4 w-4"/>Coroa</SelectItem>
                        <SelectItem value="Star"><Star className="mr-2 h-4 w-4"/>Estrela</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className='flex flex-col'>
                      <Input
                          data-editable="true"
                          value={tempMembersTitle.replace(/<[^>]+>/g, '')}
                          onChange={(e) => setTempMembersTitle(e.target.value.replace(/<[^>]+>/g, '') + " <span class='text-primary'>Premium</span>")}
                          className="text-2xl font-bold bg-transparent border-none"
                      />
                       <Input
                          data-editable="true"
                          value={tempMembersSubtitle}
                          onChange={(e) => setTempMembersSubtitle(e.target.value)}
                          className="text-sm bg-transparent border-none"
                      />
                    </div>
                  </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <SelectedIcon className="h-10 w-10 text-primary" />
                        <div>
                            <h2 className="text-2xl font-bold text-white" dangerouslySetInnerHTML={{ __html: layoutData.membersTitle }} />
                            <p className="text-sm text-muted-foreground">{layoutData.membersSubtitle}</p>
                        </div>
                    </div>
                )}
            </div>
            
            {loading ? (
              <div className="flex space-x-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="w-1/4">
                        <Skeleton className="h-[180px] w-full rounded-lg" />
                    </div>
                ))}
              </div>
            ) : (
              <Carousel opts={{ align: "start", loop: courses.filter(c => c.isFeatured).length > 4 }} className="w-full">
                <CarouselContent className="-ml-4">
                  {courses.filter(c => c.isFeatured).map((course, index) => (
                    <CarouselItem key={course.id} className="md:basis-1/2 lg:basis-1/3 xl:basis-1/5 pl-4">
                        <CourseCard
                          id={course.id}
                          title={course.title}
                          imageUrl={course.thumbnailUrl}
                          imageHint={course.imageHint || 'abstract'}
                          priority={index < 4}
                          isAdmin={isAdmin}
                          onEdit={() => handleEdit(course)}
                          onDelete={() => setCourseToDelete(course.id)}
                        />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex -left-4" />
                <CarouselNext className="hidden md:flex -right-4" />
              </Carousel>
            )}
          </div>
          
          {/* All Courses Carousel */}
           <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Todos os Cursos</h2>
                 {isAdmin && (
                    <Button asChild variant="outline" size="sm">
                        <Link href="/admin/add-course">
                            <Plus className="mr-2 h-4 w-4" /> Adicionar Curso
                        </Link>
                    </Button>
                )}
            </div>
            {loading ? (
              <div className="flex space-x-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="w-1/4">
                          <Skeleton className="h-[180px] w-full rounded-lg" />
                      </div>
                  ))}
                </div>
            ) : (
              <Carousel opts={{ align: "start", loop: courses.length > 4 }} className="w-full">
                <CarouselContent className="-ml-4">
                  {courses.map((course, index) => (
                    <CarouselItem key={course.id} className="md:basis-1/2 lg:basis-1/3 xl:basis-1/5 pl-4">
                        <CourseCard
                          id={course.id}
                          title={course.title}
                          imageUrl={course.thumbnailUrl}
                          imageHint={course.imageHint || 'abstract'}
                          priority={index < 4}
                          isAdmin={isAdmin}
                          onEdit={() => handleEdit(course)}
                          onDelete={() => setCourseToDelete(course.id)}
                        />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex -left-4" />
                <CarouselNext className="hidden md:flex -right-4" />
              </Carousel>
            )}
          </div>
        </section>

        {courseToEdit && (
            <EditCourseModal
                isOpen={!!courseToEdit}
                onClose={() => setCourseToEdit(null)}
                course={courseToEdit}
                onCourseUpdate={fetchCourses}
            />
        )}
        
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso irá excluir permanentemente o curso e todos os seus dados.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </div>
    </AlertDialog>
  );
}

export default function DashboardPage() {
  return (
    <LayoutProvider>
      <DashboardClientPage />
    </LayoutProvider>
  )
}
