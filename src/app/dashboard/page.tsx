'use client';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CourseCard } from '@/components/course-card';
import { Skeleton } from '@/components/ui/skeleton';
import placeholderData from '@/lib/placeholder-images.json';
import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useEditMode } from '@/context/EditModeContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { isEditMode } = useEditMode();
  
  // State for editable content
  const [heroTitle, setHeroTitle] = useState("Seu Reinado <span class='text-primary'>começa aqui</span>.");
  const [heroSubtitle, setHeroSubtitle] = useState("No Rei da VSL, cada copy se torna uma conversão poderosa.");


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
    setLoading(true);
    // In a real app, you'd fetch courses from Firestore here
    // For now, we use placeholder data
    const featuredCourses = placeholderData.placeholderCourses.filter(c => c.isFeatured);
    const regularCourses = placeholderData.placeholderCourses.filter(c => !c.isFeatured);
    
    // In a real app with Firestore data, you would fetch and sort.
    // For this placeholder version, we just use the data as is.
    setCourses(placeholderData.placeholderCourses as Course[]);
    setLoading(false);
  }, []);

  if (userLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative flex h-[60vh] min-h-[500px] w-full flex-col items-center justify-center bg-black py-12 md:h-screen">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://picsum.photos/seed/hero-bg/1920/1080"
            alt="Hero background"
            fill
            className="object-cover"
            data-ai-hint="digital art collage"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-start px-4 text-left">
          {isEditMode ? (
            <Input
              type="text"
              value={heroTitle.replace(/<[^>]+>/g, '')} // Remove HTML for editing
              onChange={(e) => setHeroTitle(e.target.value)}
              className="w-full text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl bg-transparent border-dashed"
            />
          ) : (
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl"
                dangerouslySetInnerHTML={{ __html: heroTitle }}
            />
          )}

          {isEditMode ? (
             <Textarea
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl bg-transparent border-dashed"
              />
          ) : (
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
              {heroSubtitle}
            </p>
          )}

          <Button asChild size="lg" className="mt-8">
            <Link href="#">Começar Agora</Link>
          </Button>
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
                  <CourseCard
                    id={course.id}
                    title={course.title}
                    imageUrl={course.thumbnailUrl}
                    imageHint={course.imageHint}
                    priority={index < 5}
                    isAdmin={isAdmin}
                  />
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
