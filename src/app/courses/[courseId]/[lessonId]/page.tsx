
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import ReactPlayer from 'react-player/lazy';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, Circle, Lock, ArrowLeft, ArrowRight, X, Download, Link2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { addDays, parseISO } from 'date-fns';

// --- Type Definitions ---
interface ComplementaryMaterial {
  id: string;
  title: string;
  url: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  releaseDelayDays?: number;
  complementaryMaterials?: ComplementaryMaterial[];
}

interface Module {
  id: string;
  title: string;
  releaseDelayDays?: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  modules: Module[];
}

interface UserProgress {
    completedLessons: { [lessonId: string]: string }; // lessonId -> completion timestamp
}

interface CourseAccessInfo {
    grantedAt: string; // ISO string date
}

const urlRegex = /(https?:\/\/[^\s]+)/g;

function makeLinksClickable(text: string) {
    return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${url}</a>`);
}

function GoogleDriveIcon(props: React.ComponentProps<'svg'>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M18.88 9.94l-3.32-5.4A2 2 0 0 0 13.88 4H10.1a2 2 0 0 0-1.7 1.52l-3.3 5.44a2 2 0 0 0 .34 2.2l5.88 8.64a2 2 0 0 0 3.36 0l5.88-8.64a2 2 0 0 0 .32-2.22Z"/>
        </svg>
    )
}

export default function LessonPage() {
  const { courseId, lessonId } = useParams();
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [courseAccessInfo, setCourseAccessInfo] = useState<CourseAccessInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [nextLesson, setNextLesson] = useState<{ courseId: string; lessonId: string } | null>(null);
  const [isCurrentLessonCompleted, setIsCurrentLessonCompleted] = useState(false);

  const fetchLessonData = useCallback(async () => {
    if (!user || !firestore) return;
    setLoading(true);
    setIsCurrentLessonCompleted(false);

    try {
      // 1. Check admin status
      const userDocSnap = await getDoc(doc(firestore, 'users', user.uid));
      const userRole = userDocSnap.data()?.role;
      const isAdminUser = userRole === 'admin' || user.email === 'admin@reidavsl.com';
      setIsAdmin(isAdminUser);
      
      // 2. Check course access
      const accessDocSnap = await getDoc(doc(firestore, `users/${user.uid}/courseAccess`, courseId as string));
      if (!accessDocSnap.exists() && !isAdminUser) {
        toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Você não tem acesso a este curso.' });
        router.push('/dashboard');
        return;
      }
      const accessTimestamp = accessDocSnap.data()?.grantedAt?.toDate();
      setCourseAccessInfo({ grantedAt: accessTimestamp ? accessTimestamp.toISOString() : new Date().toISOString() });

      // 3. Fetch course data
      const courseDocSnap = await getDoc(doc(firestore, 'courses', courseId as string));
      if (!courseDocSnap.exists()) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Curso não encontrado.' });
        router.push('/dashboard');
        return;
      }
      const courseData = { id: courseDocSnap.id, ...courseDocSnap.data() } as Course;
      setCourse(courseData);

      // 4. Find the current lesson and module
      let foundLesson: Lesson | null = null;
      let foundModule: Module | null = null;
      for (const module of courseData.modules) {
        const lesson = module.lessons.find(l => l.id === lessonId);
        if (lesson) {
          foundLesson = lesson;
          foundModule = module;
          break;
        }
      }

      if (!foundLesson || !foundModule) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Aula não encontrada.' });
        router.push(`/courses/${courseId}`);
        return;
      }
      
      // 5. Check if lesson is unlocked (drip content)
      const isUnlocked = isAdminUser || (
        (foundModule.releaseDelayDays || 0) === 0 && (foundLesson.releaseDelayDays || 0) === 0
      ) || (accessTimestamp && (
          addDays(accessTimestamp, (foundModule.releaseDelayDays || 0) + (foundLesson.releaseDelayDays || 0)) <= new Date()
      ));

      if (!isUnlocked) {
          toast({ variant: 'destructive', title: 'Conteúdo Bloqueado', description: 'Esta aula ainda não foi liberada.' });
          router.push(`/courses/${courseId}`);
          return;
      }

      setCurrentLesson(foundLesson);
      setCurrentModule(foundModule);

      // 6. Fetch user progress
      const progressDocSnap = await getDoc(doc(firestore, `users/${user.uid}/progress`, courseId as string));
      if (progressDocSnap.exists()) {
        const progressData = progressDocSnap.data() as UserProgress;
        setUserProgress(progressData);
        if (progressData.completedLessons[lessonId as string]) {
          setIsCurrentLessonCompleted(true);
        }
      } else {
        setUserProgress({ completedLessons: {} });
      }

      // 7. Determine the next lesson
      const moduleIndex = courseData.modules.findIndex(m => m.id === foundModule!.id);
      const lessonIndex = foundModule!.lessons.findIndex(l => l.id === foundLesson!.id);

      if (lessonIndex < foundModule!.lessons.length - 1) {
        setNextLesson({ courseId: courseId as string, lessonId: foundModule!.lessons[lessonIndex + 1].id });
      } else if (moduleIndex < courseData.modules.length - 1) {
        const nextModule = courseData.modules[moduleIndex + 1];
        if (nextModule && nextModule.lessons.length > 0) {
            setNextLesson({ courseId: courseId as string, lessonId: nextModule.lessons[0].id });
        }
      } else {
        setNextLesson(null); // Last lesson of the course
      }


    } catch (error) {
      console.error("Error fetching lesson data:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar a aula.' });
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, user, firestore, router, toast]);

  useEffect(() => {
    if (user && !userLoading) {
      fetchLessonData();
    } else if (!user && !userLoading) {
      router.push('/login');
    }
  }, [user, userLoading, fetchLessonData, router]);

 const handleProgress = async (played: number) => {
    if (isCurrentLessonCompleted) return; // Don't re-run if already completed

    if (played > 0.9 && user && firestore) {
      setIsCurrentLessonCompleted(true); // Optimistic UI update

      const progressRef = doc(firestore, `users/${user.uid}/progress`, courseId as string);
      const newProgressPayload = {
        [`completedLessons.${lessonId}`]: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      try {
        await updateDoc(progressRef, newProgressPayload);
        toast({ title: "Aula Concluída!", description: `"${currentLesson?.title}" foi marcada como concluída.` });
      } catch (error: any) {
        // If the document doesn't exist, create it.
        if (error.code === 'not-found') {
          const initialProgress = {
            courseId: courseId,
            updatedAt: serverTimestamp(),
            completedLessons: {
              [lessonId as string]: serverTimestamp(),
            },
          };
          await setDoc(progressRef, initialProgress);
          toast({ title: "Aula Concluída!", description: `"${currentLesson?.title}" foi marcada como concluída.` });
        } else {
          console.error("Failed to update progress:", error);
          setIsCurrentLessonCompleted(false); // Revert optimistic update on failure
        }
      }
    }
  };
  
  const totalLessons = useMemo(() => course?.modules.reduce((sum, mod) => sum + mod.lessons.length, 0) || 0, [course]);
  const completedLessonsCount = useMemo(() => userProgress ? Object.keys(userProgress.completedLessons).length : 0, [userProgress]);
  const courseProgressPercentage = totalLessons > 0 ? (completedLessonsCount / totalLessons) * 100 : 0;


  if (loading || !course || !currentLesson || !currentModule) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Skeleton className="h-16 w-16 rounded-full animate-pulse" />
      </div>
    );
  }

  const isLessonCompleted = (lessonId: string) => !!userProgress?.completedLessons[lessonId];
  const isModuleUnlocked = (module: Module) => {
      if (isAdmin || !courseAccessInfo) return true;
      const delay = module.releaseDelayDays || 0;
      if (delay === 0) return true;
      const grantedDate = parseISO(courseAccessInfo.grantedAt);
      const releaseDate = addDays(grantedDate, delay);
      return new Date() >= releaseDate;
  };
  
  const processedDescription = makeLinksClickable(currentLesson.description || '');

  return (
    <div className="flex min-h-screen bg-black text-white pt-20">
      {/* Sidebar */}
      <aside className={cn(
        "bg-background h-[calc(100vh-5rem)] flex-col transition-all duration-300 ease-in-out fixed top-20 left-0 z-20 hidden md:flex",
        isSidebarOpen ? "w-80" : "w-0 overflow-hidden"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-r border-border h-20">
          <Link href={`/courses/${courseId}`} className="text-sm font-semibold hover:text-primary">
            <ArrowLeft className="inline-block mr-2 h-4 w-4" /> Voltar ao Curso
          </Link>
        </div>
        <div className="flex-grow overflow-y-auto border-r border-border">
          <Accordion type="single" collapsible defaultValue={currentModule.id} className="w-full">
            {course.modules.map(module => (
              <AccordionItem key={module.id} value={module.id} disabled={!isModuleUnlocked(module)}>
                <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:bg-secondary/50 disabled:opacity-50 disabled:hover:bg-transparent">
                  <div className="text-left">
                    {module.title}
                    <div className="text-xs text-muted-foreground font-normal mt-1">
                      {Object.values(module.lessons).filter(l => isLessonCompleted(l.id)).length} / {module.lessons.length} aulas
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="pl-4 border-l border-border ml-4">
                    {module.lessons.map(lesson => (
                      <li key={lesson.id}>
                        <Link href={`/courses/${courseId}/${lesson.id}`} className={cn(
                          "flex items-center justify-between gap-2 p-3 text-sm rounded-r-lg -ml-px border-l-2",
                          lesson.id === lessonId
                            ? "bg-primary/10 text-primary border-primary"
                            : "text-muted-foreground border-transparent hover:bg-secondary/50 hover:text-white"
                        )}>
                          <span>{lesson.title}</span>
                          {isLessonCompleted(lesson.id)
                            ? <CheckCircle className="h-4 w-4 text-green-500" />
                            : <Circle className="h-4 w-4 text-muted-foreground/50" />
                          }
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        isSidebarOpen ? "md:ml-80" : "md:ml-0"
      )}>
        <header className="flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm z-10 border-b border-border h-20 shrink-0 sticky top-20">
           <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </Button>
                <div className="text-sm hidden md:block">
                    <span className="text-muted-foreground">{course.title} / </span>
                    <span className="text-white font-medium">{currentLesson.title}</span>
                </div>
            </div>
          <div className="flex items-center gap-4">
            <div className="w-40 hidden md:block">
                <Progress value={courseProgressPercentage} className="h-2" />
                <span className="text-xs text-muted-foreground">{completedLessonsCount} de {totalLessons} ({Math.round(courseProgressPercentage)}%)</span>
            </div>
            {nextLesson ? (
                 <Button asChild variant={isCurrentLessonCompleted ? 'default' : 'outline'}>
                    <Link href={`/courses/${nextLesson.courseId}/${nextLesson.lessonId}`}>
                        Próxima <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                 </Button>
            ) : (
                <Button variant={isCurrentLessonCompleted ? 'default' : 'outline'} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="mr-2 h-4 w-4"/> Curso Concluído
                </Button>
            )}
             <Button asChild variant="ghost" size="icon">
                <Link href={`/courses/${courseId}`}>
                    <X className="h-5 w-5"/>
                </Link>
            </Button>
          </div>
        </header>

        <div className="p-4 md:p-8 overflow-y-auto flex-grow">
            <div className="aspect-video w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden">
            <ReactPlayer
                url={currentLesson.videoUrl}
                width="100%"
                height="100%"
                controls
                playing
                onProgress={(progress) => handleProgress(progress.played)}
                config={{
                youtube: { playerVars: { showinfo: 0, rel: 0 } },
                vimeo: { playerOptions: { byline: false, portrait: false } }
                }}
            />
            </div>

            <div className="max-w-4xl mx-auto mt-8">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{currentLesson.title}</h1>
                
                {currentLesson.description && (
                    <div className="prose prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: processedDescription }}></div>
                )}
                
                {currentLesson.complementaryMaterials && currentLesson.complementaryMaterials.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-border">
                        <h2 className="text-xl font-semibold text-white mb-4">Materiais Complementares</h2>
                        <div className="space-y-3">
                            {currentLesson.complementaryMaterials.map(material => {
                                const isDrive = material.url.includes('drive.google.com');
                                const isDownloadable = /\.(pdf|zip|rar|jpg|png|jpeg|doc|docx|xls|xlsx|ppt|pptx)$/i.test(material.url);
                                
                                let Icon = Link2;
                                let buttonText = "Acessar Link";
                                if (isDrive) {
                                    Icon = GoogleDriveIcon;
                                    buttonText = "Acessar Drive";
                                } else if (isDownloadable) {
                                    Icon = Download;
                                    buttonText = "Baixar Arquivo";
                                }

                                return (
                                    <div key={material.id} className="flex items-center justify-between gap-3 p-4 rounded-lg bg-secondary/50 border border-border">
                                        <div className="flex items-center gap-4">
                                            <Icon className="h-6 w-6 text-primary flex-shrink-0"/>
                                            <span className="text-sm font-medium text-white">{material.title}</span>
                                        </div>
                                        <Button asChild size="sm">
                                            <a href={material.url} target="_blank" rel="noopener noreferrer">
                                                {buttonText}
                                            </a>
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
}

    