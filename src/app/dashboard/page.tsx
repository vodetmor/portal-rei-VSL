'use client';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { CourseCard } from '@/components/course-card';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, getDoc, collection, getDocs, setDoc, type DocumentData } from 'firebase/firestore';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Trophy, UploadCloud } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useEditMode } from '@/context/EditModeContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageHint: string;
  isFeatured?: boolean;
}

const DEFAULT_HERO_TITLE = "Seu Reinado <span class='text-primary'>começa aqui</span>.";
const DEFAULT_HERO_SUBTITLE = "No Rei da VSL, cada copy se torna uma conversão poderosa.";
const DEFAULT_HERO_IMAGE = "https://picsum.photos/seed/hero-bg/1920/1080";

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const router = useRouter();
  const { toast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { isEditMode, registerSaveHandler } = useEditMode();
  
  // State for editable content
  const [heroTitle, setHeroTitle] = useState(DEFAULT_HERO_TITLE);
  const [heroSubtitle, setHeroSubtitle] = useState(DEFAULT_HERO_SUBTITLE);
  const [heroImage, setHeroImage] = useState(DEFAULT_HERO_IMAGE);
  const [isUploading, setIsUploading] = useState(false);
  const [contentLoading, setContentLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveChanges = useCallback(async () => {
    if (!firestore) {
      toast({ variant: "destructive", title: "Erro", description: "Conexão com o banco de dados não disponível." });
      return;
    }
    const layoutRef = doc(firestore, 'layout', 'dashboard-hero');
    const dataToSave = {
      title: heroTitle,
      subtitle: heroSubtitle,
      imageUrl: heroImage,
    };
    
    // Use a non-blocking write and catch permission errors
    setDoc(layoutRef, dataToSave, { merge: true })
      .catch((error) => {
        console.error("Error saving layout:", error); // Keep console error for debugging, but emit specific error.
        const permissionError = new FirestorePermissionError({
          path: layoutRef.path,
          operation: 'write', // 'write' covers create and update with merge
          requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
        // Re-throw to be caught by the calling function in nav.tsx
        throw permissionError;
      });

  }, [firestore, heroTitle, heroSubtitle, heroImage, toast]);

  useEffect(() => {
    // Register the save handler if the user is an admin
    if (isAdmin) {
      registerSaveHandler(handleSaveChanges);
    }
  }, [isAdmin, registerSaveHandler, handleSaveChanges]);


  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    const fetchPageContent = async () => {
      if (!firestore) return;
      setContentLoading(true);
      const layoutRef = doc(firestore, 'layout', 'dashboard-hero');
      try {
        const docSnap = await getDoc(layoutRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setHeroTitle(data.title || DEFAULT_HERO_TITLE);
          setHeroSubtitle(data.subtitle || DEFAULT_HERO_SUBTITLE);
          setHeroImage(data.imageUrl || DEFAULT_HERO_IMAGE);
        } else {
          // Use defaults if doc doesn't exist
          setHeroTitle(DEFAULT_HERO_TITLE);
          setHeroSubtitle(DEFAULT_HERO_SUBTITLE);
          setHeroImage(DEFAULT_HERO_IMAGE);
        }
      } catch (error) {
         console.error("Error fetching layout:", error);
         // Fallback to defaults on error
         setHeroTitle(DEFAULT_HERO_TITLE);
         setHeroSubtitle(DEFAULT_HERO_SUBTITLE);
         setHeroImage(DEFAULT_HERO_IMAGE);
      } finally {
        setContentLoading(false);
      }
    };
    
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
        
        // Fetch courses and page content
        setLoading(true);
        await fetchPageContent();
        try {
          const querySnapshot = await getDocs(collection(firestore, 'courses'));
          if (querySnapshot.empty) {
            setCourses([]);
          } else {
            const coursesData = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Course[];
            setCourses(coursesData);
          }
        } catch (error) {
          console.error("Error fetching courses: ", error);
          setCourses([]); // Set to empty array on error
        } finally {
          setLoading(false);
        }

      } else {
        setIsAdmin(false);
        setLoading(false);
        setContentLoading(false);
      }
    };

    if (user && firestore) {
      checkAdminAndFetchData();
    }
  }, [user, firestore]);


  const handleImageContainerClick = () => {
    if (isEditMode && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !storage) return;

    setIsUploading(true);
    const storageRef = ref(storage, `layout-images/hero-background-${Date.now()}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        // Optional: update progress
      },
      (error) => {
        setIsUploading(false);
        toast({
          variant: "destructive",
          title: "Erro no Upload",
          description: "Não foi possível enviar a imagem. Tente novamente.",
        });
        console.error("Upload failed:", error);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setHeroImage(downloadURL);
          setIsUploading(false);
          toast({
            title: "Sucesso!",
            description: "A imagem de fundo foi atualizada. Clique em 'Salvar Alterações' para persistir a mudança.",
          });
        }).catch((error) => {
           setIsUploading(false);
           console.error("Failed to get download URL:", error);
           toast({
            variant: "destructive",
            title: "Erro",
            description: "Falha ao obter a URL da imagem.",
           });
        });
      }
    );
  };


  if (userLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="w-full" data-edit-mode={isEditMode}>
      {/* Hero Section */}
      <section className="relative flex h-[60vh] min-h-[500px] w-full flex-col items-center justify-center bg-black py-12 md:h-screen">
        {contentLoading ? <Skeleton className="absolute inset-0 z-0" /> : (
            <>
              {/* Background Image and Overlay Container */}
              <div className="absolute inset-0 z-0">
                  <Image
                    src={heroImage}
                    alt="Hero background"
                    fill
                    className="object-cover"
                    data-ai-hint="digital art collage"
                    priority
                  />
                  <div className="absolute inset-0 bg-black/70" />
              </div>
              
              {/* Interactive container for editing */}
              <div 
                  data-editable={isEditMode}
                  className={cn(
                    "absolute inset-0 z-10 flex items-center justify-center",
                    isEditMode && "cursor-pointer"
                  )}
                  onClick={handleImageContainerClick}
              >
                  {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
                      </div>
                  )}
                   {isEditMode && !isUploading && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-black/30">
                          <div className="flex flex-col items-center text-white">
                              <UploadCloud className="h-12 w-12" />
                              <p className="font-semibold mt-2">Trocar Imagem de Fundo</p>
                          </div>
                      </div>
                  )}
              </div>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
              />
            </>
        )}

        <div className="relative z-20 mx-auto flex max-w-4xl flex-col items-start px-4 text-left">
          {isEditMode ? (
            <div data-editable="true" className="w-full">
              <Input
                type="text"
                value={heroTitle.replace(/<[^>]+>/g, '')} // Remove HTML for editing
                onChange={(e) => setHeroTitle(e.target.value.replace(/<[^>]+>/g, '') + " <span class='text-primary'>começa aqui</span>.")}
                className="w-full text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl bg-transparent border-dashed"
              />
            </div>
          ) : (
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl"
                dangerouslySetInnerHTML={{ __html: heroTitle }}
            />
          )}

          {isEditMode ? (
             <div data-editable="true" className="w-full mt-4">
              <Textarea
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  className="max-w-2xl text-lg text-muted-foreground md:text-xl bg-transparent border-dashed"
                />
             </div>
          ) : (
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
              {heroSubtitle}
            </p>
          )}

          <div data-editable={isEditMode} className="mt-8">
            <Button asChild size="lg">
              <Link href="#">Começar Agora</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Members Area Section */}
      <section className="container mx-auto px-4 py-16 md:px-8">
        <div className="mb-8">
          <h2 className="flex items-center gap-3 text-2xl font-bold text-white">
            <Trophy className="h-7 w-7 text-primary" />
            Área de Membros Premium
          </h2>
          <p className="text-muted-foreground">Rei da VSL ®</p>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                    <Skeleton className="h-[333px] w-full rounded-xl" />
                </div>
            ))}
          </div>
        ) : (
          <Carousel
            opts={{
              align: "start",
              loop: courses.length > 5, // Only loop if there are more courses than can be shown
            }}
            className="w-full"
          >
            <CarouselContent>
              {courses.map((course, index) => (
                <CarouselItem key={course.id} className="md:basis-1/2 lg:basis-1/3 xl:basis-1/4 2xl:basis-1/5">
                   <div data-editable={isEditMode} className="h-full">
                      <CourseCard
                        id={course.id}
                        title={course.title}
                        imageUrl={course.thumbnailUrl}
                        imageHint={course.imageHint || 'abstract'}
                        priority={index < 5}
                        isAdmin={isAdmin}
                      />
                   </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex" />
            <CarouselNext className="hidden md:flex" />
          </Carousel>
        )}
      </section>
    </div>
  );
}
