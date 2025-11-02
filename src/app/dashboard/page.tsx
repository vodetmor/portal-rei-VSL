'use client';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { CourseCard } from '@/components/course-card';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, type DocumentData } from 'firebase/firestore';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
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
  const router = useRouter();
  const { toast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [heroTitle, setHeroTitle] = useState(DEFAULT_HERO_TITLE);
  const [heroSubtitle, setHeroSubtitle] = useState(DEFAULT_HERO_SUBTITLE);
  const [heroImage, setHeroImage] = useState(DEFAULT_HERO_IMAGE);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  const [contentLoading, setContentLoading] = useState(true);

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
          setHeroTitle(DEFAULT_HERO_TITLE);
          setHeroSubtitle(DEFAULT_HERO_SUBTITLE);
          setHeroImage(DEFAULT_HERO_IMAGE);
        }
      } catch (error) {
         console.error("Error fetching layout:", error);
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
        
        await fetchPageContent();
        
        await fetchCourses();

      } else {
        setIsAdmin(false);
        setLoading(false);
        setContentLoading(false);
      }
    };

    if (user && firestore) {
      checkAdminAndFetchData();
    }
  }, [user, firestore, fetchCourses]);

  if (userLoading || !user) {
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
        <section className="relative flex h-[70vh] min-h-[600px] w-full flex-col items-center justify-center py-12">
          {contentLoading ? <Skeleton className="absolute inset-0 z-0" /> : (
              <div className="absolute inset-0 z-0">
                <Image
                  src={heroImage}
                  alt="Hero background"
                  fill
                  className="object-cover"
                  data-ai-hint="digital art collage"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
              </div>
          )}

          <div className="relative z-20 mx-auto flex max-w-4xl flex-col items-start px-4 text-left -mt-20">
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl"
                  dangerouslySetInnerHTML={{ __html: heroTitle }}
              />

              <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
                {heroSubtitle}
              </p>

            <div className="mt-8">
              <Button asChild size="lg" variant="destructive" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="#">Assistir Agora</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Members Area Section */}
        <section className="container mx-auto px-4 py-16 md:px-8 -mt-24 space-y-12">
          
          {/* Featured Carousel */}
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Cursos em Destaque</h2>
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
              <Carousel opts={{ align: "start", loop: courses.filter(c => c.isFeatured).length > 4 }} className="w-full">
                <CarouselContent className="-ml-4">
                  {courses.filter(c => c.isFeatured).map((course, index) => (
                    <CarouselItem key={course.id} className="md:basis-1/2 lg:basis-1/3 xl:basis-1/4 pl-4">
                      <AlertDialogTrigger asChild>
                          <CourseCard
                            id={course.id}
                            title={course.title}
                            imageUrl={course.thumbnailUrl}
                            imageHint={course.imageHint || 'abstract'}
                            priority={index < 4}
                            isAdmin={isAdmin}
                            onDelete={() => setCourseToDelete(course.id)}
                          />
                      </AlertDialogTrigger>
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
            <h2 className="text-2xl font-bold text-white mb-4">Todos os Cursos</h2>
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
                    <CarouselItem key={course.id} className="md:basis-1/2 lg:basis-1/3 xl:basis-1/4 pl-4">
                        <AlertDialogTrigger asChild>
                           <CourseCard
                            id={course.id}
                            title={course.title}
                            imageUrl={course.thumbnailUrl}
                            imageHint={course.imageHint || 'abstract'}
                            priority={index < 4}
                            isAdmin={isAdmin}
                            onDelete={() => setCourseToDelete(course.id)}
                           />
                        </AlertDialogTrigger>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex -left-4" />
                <CarouselNext className="hidden md:flex -right-4" />
              </Carousel>
            )}
          </div>
        </section>
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
