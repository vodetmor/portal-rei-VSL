'use client';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CourseCard } from '@/components/course-card';
import { placeholderCourses } from '@/lib/placeholder-images.json';

export default function DashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const featuredCourses = placeholderCourses.filter(course => course.isFeatured);
  const allCourses = placeholderCourses;

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
      <div className="space-y-12">
        {/* Featured Section */}
        <section>
          <h2 className="mb-4 text-2xl font-bold text-white">Em Destaque</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredCourses.map((course, index) => (
              <CourseCard
                key={course.id}
                title={course.title}
                imageUrl={course.thumbnailUrl}
                imageHint={course.imageHint}
                priority={index < 4}
              />
            ))}
          </div>
        </section>

        {/* All Courses Section */}
        <section>
          <h2 className="mb-4 text-2xl font-bold text-white">Todos os Cursos</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {allCourses.map(course => (
              <CourseCard
                key={course.id}
                title={course.title}
                imageUrl={course.thumbnailUrl}
                imageHint={course.imageHint}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
