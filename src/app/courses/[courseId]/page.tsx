'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import ReactPlayer from 'react-player/lazy';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlayCircle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Lesson {
    id: string;
    title: string;
    videoUrl?: string; 
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
  videoUrl: string;
}

export default function CoursePlayerPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const params = useParams();
  const { toast } = useToast();
  const courseId = params.courseId as string;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [unlocked, setUnlocked] = useState(false); // For now, simple lock state

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
          
          // For simplicity, let's say the course is unlocked if the user is logged in
          // In a real app, you'd check for purchase/enrollment here.
          setUnlocked(!!user);

          // Set the first lesson of the first module as the initial active lesson if unlocked
          if (!!user && courseData.modules && courseData.modules.length > 0 && courseData.modules[0].lessons.length > 0) {
            setActiveLesson(courseData.modules[0].lessons[0]);
          } else {
            setActiveLesson(null);
          }
        } else {
          console.log('No such document!');
           toast({ variant: "destructive", title: "Erro", description: "Curso não encontrado."});
        }
      } catch (error) {
        console.error('Error fetching course:', error);
        toast({ variant: "destructive", title: "Erro de Permissão", description: "Você não tem permissão para ver este curso."});
      } finally {
        setLoading(false);
      }
    };

    // No need to wait for user to fetch course metadata, but user is needed to determine unlocked state
    fetchCourse();

  }, [firestore, courseId, user, toast]);

  const handleLessonClick = (lesson: Lesson) => {
    if (!unlocked) {
        toast({
            title: "Conteúdo Bloqueado",
            description: "Você precisa adquirir este curso para assistir às aulas.",
        });
        return;
    }
    if (!lesson.videoUrl) {
        toast({
            variant: "destructive",
            title: "Vídeo Indisponível",
            description: "Ainda não há um vídeo para esta aula.",
        });
        return;
    }
    setActiveLesson(lesson);
  }
  
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
        <p>Curso não encontrado ou você não tem permissão para acessá-lo.</p>
      </div>
    );
  }

  // Determine the video URL based on the active lesson, fallback to course's main video or an empty string
  const currentVideoUrl = unlocked && activeLesson?.videoUrl ? activeLesson.videoUrl : (course.videoUrl || '');

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8 grid lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Player and Description */}
        <div className="lg:col-span-2">
            <div className="aspect-video mb-6 bg-black rounded-lg overflow-hidden flex items-center justify-center">
                {currentVideoUrl ? (
                    <ReactPlayer
                        url={currentVideoUrl}
                        controls
                        playing
                        width="100%"
                        height="100%"
                        config={{ 
                            file: { attributes: { controlsList: 'nodownload' } } 
                        }}
                        onContextMenu={(e: { preventDefault: () => any; }) => e.preventDefault()}
                    />
                ) : (
                    <div className="text-center text-muted-foreground">
                        <PlayCircle className="mx-auto h-16 w-16 mb-4" />
                        <p>{unlocked ? 'Selecione uma aula para começar.' : 'Adquira o curso para assistir.'}</p>
                    </div>
                )}
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
                          onClick={() => handleLessonClick(lesson)}
                          className={cn(
                            "flex items-center gap-3 w-full text-left p-3 rounded-md transition-colors",
                            activeLesson?.title === lesson.title && unlocked
                                ? "bg-primary/20 text-primary" 
                                : "hover:bg-primary/10"
                          )}
                        >
                          {unlocked ? <PlayCircle className="h-5 w-5 flex-shrink-0" /> : <Lock className="h-5 w-5 flex-shrink-0 text-muted-foreground" />}
                          <span className={cn("flex-grow", !unlocked && "text-muted-foreground")}>{lesson.title}</span>
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
