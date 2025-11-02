'use client';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CourseCard } from '@/components/course-card';
import { Skeleton } from '@/components/ui/skeleton';
import placeholderData from '@/lib/placeholder-images.json';
import type { DocumentData } from 'firebase/firestore';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageHint: string;
  isFeatured?: boolean;
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    setLoading(true);
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
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
            <span className="text-primary">Inspire-se</span>, Aprenda, Cresça.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Na Monster Copy, cada obstáculo se torna uma oportunidade de inovação e sucesso.
          </p>
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
          <p className="text-muted-foreground">Monster Copy ®</p>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                    <Skeleton className="h-[125px] w-full rounded-xl" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            ))}
          </div>
        ) : (
          <Carousel
            opts={{
              align: "start",
              loop: true,
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
