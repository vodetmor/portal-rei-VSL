'use client';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { CourseCard } from '@/components/course-card';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, getDoc, collection, getDocs, type DocumentData } from 'firebase/firestore';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useEditMode } from '@/context/EditModeContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageHint: string;
  isFeatured?: boolean;
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const router = useRouter();
  const { toast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { isEditMode } = useEditMode();
  
  // State for editable content
  const [heroTitle, setHeroTitle] = useState("Seu Reinado <span class='text-primary'>começa aqui</span>.");
  const [heroSubtitle, setHeroSubtitle] = useState("No Rei da VSL, cada copy se torna uma conversão poderosa.");
  const [heroImage, setHeroImage] = useState("https://picsum.photos/seed/hero-bg/1920/1080");
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (user && firestore) {
        if (user.email === 'admin@reidavsl.com') {
          setIsAdmin(true);
          return;
        }
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
      } else {
        setIsAdmin(false);
      }
    };

    if (user) {
      checkAdminRole();
    }
  }, [user, firestore]);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!firestore) return;
      setLoading(true);
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
    };

    fetchCourses();
  }, [firestore]);

  const handleImageContainerClick = () => {
    if (isEditMode) {
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
            description: "A imagem de fundo foi atualizada. Lembre-se de salvar o layout.",
          });
          // In a future step, we will save this URL to Firestore.
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
        <div className="absolute inset-0 z-0">
          <div 
            data-editable={isEditMode}
            className="w-full h-full relative"
            onClick={handleImageContainerClick}
          >
             {isEditMode && (
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                />
              )}
            <Image
              src={heroImage}
              alt="Hero background"
              fill
              className="object-cover"
              data-ai-hint="digital art collage"
              priority
            />
             {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" /></div>}
          </div>
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-start px-4 text-left">
          {isEditMode ? (
            <div data-editable="true" className="w-full">
              <Input
                type="text"
                value={heroTitle.replace(/<[^>]+>/g, '')} // Remove HTML for editing
                onChange={(e) => setHeroTitle(e.target.value)}
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
