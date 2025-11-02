'use client';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CourseCard } from '@/components/course-card';
import { collection, getDocs } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
  isFeatured?: boolean;
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    const fetchCourses = async () => {
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
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [firestore]);


  if (userLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const featuredCourses = courses.filter(course => course.isFeatured);

  const renderSkeletons = (count: number, gridClass: string) => (
    <div className={gridClass}>
        {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="space-y-2">
                <Skeleton className="h-[125px] w-full rounded-xl" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
      <div className="space-y-12">
        <section>
          <h2 className="mb-4 text-2xl font-bold text-white">Em Destaque</h2>
          {loading ? (
             renderSkeletons(4, "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {featuredCourses.map((course, index) => (
                <CourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    imageUrl={course.thumbnailUrl}
                    imageHint=""
                    priority={index < 4}
                />
                ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold text-white">Todos os Cursos</h2>
           {loading ? (
             renderSkeletons(10, "grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5")
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {courses.map(course => (
                <CourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    imageUrl={course.thumbnailUrl}
                    imageHint=""
                />
                ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
