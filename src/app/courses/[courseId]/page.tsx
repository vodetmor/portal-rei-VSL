'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import ReactPlayer from 'react-player/lazy';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Lesson {
    id: string;
    title: string;
    videoUrl?: string; // Each lesson can have its own video
}
  
interface Module {
    id: string;
    title: string;
    lessons: Lesson[];
}

interface Course extends DocumentData {
  id: string;
  title: string;
  description: string;
  modules: Module[];
  videoUrl: string; // Keep a main videoUrl as fallback or intro
}

export default function CoursePlayerPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const params = useParams();
  const courseId = params.courseId as string;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!firestore || !courseId) return;
      setLoading(true);
      try {
        const courseRef = doc(firestore, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);

        if (courseSnap.exists()) {
          const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
          setCourse(courseData);
          // Set the first lesson of the first module as the initial active lesson
          if (courseData.modules && courseData.modules.length > 0 && courseData.modules[0].lessons.length > 0) {
            setActiveLesson(courseData.modules[0].lessons[0]);
          }
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
      <div className="container mx-auto px-4 py-8 pt-24 md:px-8 grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
            <Skeleton className="w-full aspect-video rounded-lg" />
            <div className="mt-6 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        </div>
        <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
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

  const currentVideoUrl = activeLesson?.videoUrl || course.videoUrl || '';

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8 grid lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Player and Description */}
        <div className="lg:col-span-2">
            <div className="aspect-video mb-6">
                <ReactPlayer
                url={currentVideoUrl}
                controls
                playing // Auto-play when lesson changes
                width="100%"
                height="100%"
                className="rounded-lg overflow-hidden bg-black"
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
        </div>

      {/* Right Side: Modules and Lessons */}
      <div className="lg:col-span-1 space-y-4">
        <h2 className="text-2xl font-bold text-white">Módulos e Aulas</h2>
        {course.modules && course.modules.length > 0 ? (
          <Accordion type="single" collapsible defaultValue="module-0" className="w-full">
            {course.modules.map((module, moduleIndex) => (
              <AccordionItem key={module.id || moduleIndex} value={`module-${moduleIndex}`} className="bg-secondary/50 rounded-lg mb-2 px-4 border-b-0">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">{module.title}</AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 pt-2">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <li key={lesson.id || lessonIndex}>
                        <button 
                          onClick={() => setActiveLesson(lesson)}
                          className={cn(
                            "flex items-center gap-3 w-full text-left p-3 rounded-md transition-colors",
                            activeLesson?.title === lesson.title 
                                ? "bg-primary/20 text-primary" 
                                : "hover:bg-primary/10"
                          )}
                        >
                          <PlayCircle className="h-5 w-5 flex-shrink-0" />
                          <span className="flex-grow">{lesson.title}</span>
                        </button>
                      </li>
                    ))}
                    {module.lessons.length === 0 && (
                        <p className="p-3 text-sm text-muted-foreground">Nenhuma aula neste módulo.</p>
                    )}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="p-8 rounded-lg bg-secondary text-center text-muted-foreground">
            <p>Nenhum módulo ou aula disponível para este curso ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
