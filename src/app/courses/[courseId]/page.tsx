'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import ReactPlayer from 'react-player/lazy';
import { Skeleton } from '@/components/ui/skeleton';

interface Course extends DocumentData {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
}

export default function CoursePlayerPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const params = useParams();
  const courseId = params.courseId as string;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!firestore || !courseId) return;
      setLoading(true);
      try {
        const courseRef = doc(firestore, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);

        if (courseSnap.exists()) {
          setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
        } else {
          console.log('No such document!');
        }
      } catch (error) {
        console.error('Error fetching course:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchCourse();
    }
  }, [firestore, courseId, user]);
  
  if (userLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
        <Skeleton className="w-full h-[56.25vw] max-h-[70vh] rounded-lg" />
        <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Curso não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
      <div className="aspect-video mb-6">
        <ReactPlayer
          url={course.videoUrl}
          controls
          width="100%"
          height="100%"
          className="rounded-lg overflow-hidden"
          config={{ 
            file: { 
              attributes: { 
                controlsList: 'nodownload' 
              } 
            } 
          }}
          onContextMenu={(e: { preventDefault: () => any; }) => e.preventDefault()}
        />
      </div>

      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-white">{course.title}</h1>
        <p className="text-muted-foreground">{course.description}</p>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-4">Módulos e Aulas</h2>
         <div className="p-8 rounded-lg bg-secondary text-center text-muted-foreground">
            <p>Em breve: Aulas e módulos do curso aparecerão aqui.</p>
         </div>
      </div>
    </div>
  );
}
