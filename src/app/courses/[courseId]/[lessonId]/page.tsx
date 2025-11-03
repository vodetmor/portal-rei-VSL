
'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, addDoc, collection, query, orderBy, deleteDoc, writeBatch, runTransaction, increment } from 'firebase/firestore';
import ReactPlayer from 'react-player/lazy';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, Circle, Lock, ArrowLeft, ArrowRight, X, Download, Link2, FileText, Check, ThumbsUp, ThumbsDown, MessageSquare, CornerUpLeft, Send, Heart, MoreVertical, Pin, Trash2, Menu } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { addDays, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, MessagesSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';


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
  isDemo?: boolean;
  releaseDelayDays?: number;
  complementaryMaterials?: ComplementaryMaterial[];
}

interface Module {
  id: string;
  title: string;
  isDemo?: boolean;
  releaseDelayDays?: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  modules: Module[];
  isDemoEnabled?: boolean;
  isFree?: boolean;
}

interface UserProgress {
    completedLessons: { [lessonId: string]: string };
}

interface CourseAccessInfo {
    grantedAt: string;
}

interface LessonReaction {
    id: string;
    userId: string;
    type: 'like' | 'dislike';
}

interface LessonComment {
    id: string;
    userId: string;
    userDisplayName: string;
    userPhotoURL: string;
    text: string;
    timestamp: any;
    isPinned?: boolean;
    likeCount?: number;
    replyCount?: number;
}

interface CommentLike {
    userId: string;
    timestamp: any;
}

interface CommentReply {
    id: string;
    userId: string;
    userDisplayName: string;
    userPhotoURL: string;
    text: string;
    timestamp: any;
}


const urlRegex = /(https?:\/\/[^\s]+)/g;

function makeLinksClickable(text: string) {
    if(!text) return '';
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{part}</a>;
        }
        return part;
    });
}

function GoogleDriveIcon(props: React.ComponentProps<'svg'>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M18.88 9.94l-3.32-5.4A2 2 0 0 0 13.88 4H10.1a2 2 0 0 0-1.7 1.52l-3.3 5.44a2 2 0 0 0 .34 2.2l5.88 8.64a2 2 0 0 0 3.36 0l5.88-8.64a2 2 0 0 0 .32-2.22Z"/>
        </svg>
    )
}

export default function LessonPage() {
  const { courseId, lessonId } = useParams();
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [courseAccessInfo, setCourseAccessInfo] = useState<CourseAccessInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [nextLesson, setNextLesson] = useState<{ courseId: string; lessonId: string } | null>(null);
  const [isCurrentLessonCompleted, setIsCurrentLessonCompleted] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false); // Differentiates full access from demo access
  
  const youtubeEmbedUrl = useMemo(() => {
    if (!currentLesson || !currentLesson.videoUrl || !currentLesson.videoUrl.includes('youtube.com')) {
      return currentLesson?.videoUrl;
    }
    const videoIdMatch = currentLesson.videoUrl.match(/(?:v=|\/embed\/|\.be\/)([\w-]+)/);
    if (!videoIdMatch) {
      return currentLesson.videoUrl; // fallback to original if ID not found
    }
    const videoId = videoIdMatch[1];
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `https://www.youtube.com/embed/${videoId}?origin=${origin}`;
  }, [currentLesson]);

  const reactionsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId || !lessonId || !hasFullAccess) return null;
    return collection(firestore, `courses/${courseId}/lessons/${lessonId}/reactions`);
  }, [firestore, courseId, lessonId, hasFullAccess]);

  const { data: reactions, isLoading: reactionsLoading } = useCollection<LessonReaction>(reactionsQuery);

  const fetchLessonData = useCallback(async () => {
    if (!firestore || !user) {
        if (!userLoading) {
             setHasAccess(false);
             setLoading(false);
        }
        return;
    };
    
    setLoading(true);
    setIsCurrentLessonCompleted(false);

    try {
      const courseDocRef = doc(firestore, 'courses', courseId as string);
      const courseDocSnap = await getDoc(courseDocRef);
      if (!courseDocSnap.exists()) {
        router.push('/dashboard');
        return;
      }
      const courseData = { id: courseDocSnap.id, ...courseDocSnap.data() } as Course;
      setCourse(courseData);
      
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userRole = userDocSnap.data()?.role;
      const isAdminUser = userRole === 'admin' || user.email === 'admin@reidavsl.com';
      setIsAdmin(isAdminUser);
      
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
        router.push(`/courses/${courseId}`);
        return;
      }
      
      const isDemoAllowed = courseData.isDemoEnabled && (foundLesson.isDemo || foundModule.isDemo);
      const isFreeCourse = courseData.isFree === true;

      const accessDocRef = doc(firestore, `users/${user.uid}/courseAccess`, courseId as string);
      const accessDocSnap = await getDoc(accessDocRef);
      const userHasFullAccess = accessDocSnap.exists() || isAdminUser || isFreeCourse;
      setHasFullAccess(userHasFullAccess);
      
      if (!userHasFullAccess && !isDemoAllowed) {
        router.push(`/courses/${courseId}`);
        return;
      }

      setHasAccess(true);

      const accessTimestamp = accessDocSnap.data()?.grantedAt?.toDate();
      const grantedAtDate = accessTimestamp || (isAdminUser ? new Date() : null);
      if (grantedAtDate) {
        setCourseAccessInfo({ grantedAt: grantedAtDate.toISOString() });
      }
      
      if (!isAdminUser && userHasFullAccess) {
        const isModuleUnlocked = () => {
          if (!grantedAtDate) return false;
          const delay = foundModule?.releaseDelayDays || 0;
          const releaseDate = addDays(grantedAtDate, delay);
          return new Date() >= releaseDate;
        }
        
        const isLessonUnlocked = () => {
          if (!grantedAtDate) return false;
          const moduleDelay = foundModule?.releaseDelayDays || 0;
          const lessonDelay = foundLesson?.releaseDelayDays || 0;
          const releaseDate = addDays(grantedAtDate, moduleDelay + lessonDelay);
          return new Date() >= releaseDate;
        }

        if (!isModuleUnlocked() || !isLessonUnlocked()) {
            router.push(`/courses/${courseId}`);
            return;
        }
      }

      setCurrentLesson(foundLesson);
      setCurrentModule(foundModule);

      if (userHasFullAccess) {
        const progressDocRef = doc(firestore, `users/${user.uid}/progress`, courseId as string);
        const progressDocSnap = await getDoc(progressDocRef);
        if (progressDocSnap.exists()) {
          const progressData = progressDocSnap.data() as UserProgress;
          setUserProgress(progressData);
          if (progressData.completedLessons[lessonId as string]) {
            setIsCurrentLessonCompleted(true);
          }
        } else {
          setUserProgress({ completedLessons: {} });
        }
      }

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
        setNextLesson(null);
      }

    } catch (error: any) {
        const permissionError = new FirestorePermissionError({
            path: `courses/${courseId} or related user data`,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, user, userLoading, firestore, router]);


  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    fetchLessonData();
  }, [user, userLoading, fetchLessonData]);

 const markAsCompleted = async () => {
    if (isCurrentLessonCompleted || !user || !firestore || !hasFullAccess) return;
    
    setIsCurrentLessonCompleted(true);

    const progressRef = doc(firestore, `users/${user.uid}/progress`, courseId as string);
    const newProgressPayload = {
      [`completedLessons.${lessonId}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(progressRef, newProgressPayload);
    } catch (error: any) {
      if (error.code === 'not-found') {
        const initialProgress = {
          courseId: courseId,
          updatedAt: serverTimestamp(),
          completedLessons: {
            [lessonId as string]: serverTimestamp(),
          },
        };
        await setDoc(progressRef, initialProgress);
      } else {
        console.error("Failed to update progress:", error);
        setIsCurrentLessonCompleted(false);
      }
    }
 };

 const handleProgress = async (played: number) => {
    if (played > 0.9) {
      markAsCompleted();
    }
  };
  
  const totalLessons = useMemo(() => course?.modules.reduce((sum, mod) => sum + mod.lessons.length, 0) || 0, [course]);
  const completedLessonsCount = useMemo(() => userProgress ? Object.keys(userProgress.completedLessons).length : 0, [userProgress]);
  const courseProgressPercentage = totalLessons > 0 ? (completedLessonsCount / totalLessons) * 100 : 0;

  const { likes, dislikes, userReaction } = useMemo(() => {
    if (!reactions) return { likes: 0, dislikes: 0, userReaction: null };
    const likes = reactions.filter(r => r.type === 'like').length;
    const dislikes = reactions.filter(r => r.type === 'dislike').length;
    const userReaction = reactions.find(r => r.userId === user?.uid)?.type || null;
    return { likes, dislikes, userReaction };
  }, [reactions, user]);

  const handleReaction = (type: 'like' | 'dislike') => {
    if (!user || !firestore || !courseId || !lessonId || !hasFullAccess) return;

    const reactionRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/reactions`, user.uid);
    const reactionData = { userId: user.uid, type };
    
    if (userReaction === type) {
      // User is toggling off their reaction
      deleteDoc(reactionRef).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: reactionRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    } else {
      // User is setting or changing their reaction
      setDoc(reactionRef, reactionData).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: reactionRef.path,
            operation: 'write',
            requestResourceData: reactionData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    }
  };

  if (loading || userLoading || !isClient) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!hasAccess || !course || !currentLesson || !currentModule) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background text-white p-4 text-center">
            <div>
                <h1 className="text-2xl font-bold">Acesso Negado</h1>
                <p className="text-muted-foreground mt-2">Você não tem permissão para ver esta aula ou ela não existe.</p>
                <Button asChild className="mt-6">
                    <Link href="/dashboard">Voltar ao Painel</Link>
                </Button>
            </div>
        </div>
    );
  }

  const isLessonCompleted = (lessonId: string) => hasFullAccess && !!userProgress?.completedLessons[lessonId];
  const isModuleUnlocked = (module: Module) => {
      if (isAdmin || !hasFullAccess) return false;
      if (!courseAccessInfo) return false;

      const delay = module.releaseDelayDays || 0;
      if (delay === 0) return true;
      const grantedDate = parseISO(courseAccessInfo.grantedAt);
      const releaseDate = addDays(grantedDate, delay);
      return new Date() >= releaseDate;
  };
  
  const processedDescription = makeLinksClickable(currentLesson.description || '');

  return (
    <div className="flex min-h-screen bg-black text-white pt-20">
      {isSidebarOpen && (
          <div 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 z-30"
          ></div>
      )}
      <aside className={cn(
        "bg-background h-[calc(100vh-5rem)] flex-col transition-transform duration-300 ease-in-out fixed top-20 left-0 z-40 w-80 md:w-80 flex",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-r border-border h-20">
          <Button asChild variant="ghost" size="sm" className="text-sm font-semibold hover:bg-transparent hover:text-primary">
            <Link href={`/courses/${courseId}`}>
                <ArrowLeft className="inline-block mr-2 h-4 w-4" /> Voltar ao Curso
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="md:hidden">
              <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-grow overflow-y-auto border-r border-border">
          <Accordion type="single" collapsible defaultValue={currentModule.id} className="w-full">
            {course.modules.map(module => (
              <AccordionItem key={module.id} value={module.id} disabled={!hasFullAccess && !isModuleUnlocked(module) && !(course.isDemoEnabled && module.isDemo)}>
                <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:bg-secondary/50 disabled:opacity-50 disabled:hover:bg-transparent">
                  <div className="text-left">
                    {module.title}
                    <div className="text-xs text-muted-foreground font-normal mt-1">
                      {module.lessons.filter(l => isLessonCompleted(l.id)).length} / {module.lessons.length} aulas
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
                          <div className='flex items-center gap-2'>
                           {lesson.videoUrl ? (
                              isLessonCompleted(lesson.id)
                                ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                : <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                            ) : (
                               <FileText className="h-4 w-4 text-muted-foreground/80 flex-shrink-0" />
                            )}
                            <span>{lesson.title}</span>
                          </div>
                          {isLessonCompleted(lesson.id) && !lesson.videoUrl &&
                             <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
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

      <main className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        "md:ml-80"
      )}>
        <header className="flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm z-10 border-b border-border h-20 shrink-0">
           <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden">
                   <Menu className="h-5 w-5"/>
                </Button>
                <div className="text-sm">
                    <span className="text-muted-foreground hidden md:inline">{course.title} / </span> 
                    <span className="text-white font-medium">{currentLesson.title}</span>
                </div>
            </div>
          <div className="flex items-center gap-4">
            {hasFullAccess && (
              <div className="w-40 hidden md:block">
                  <Progress value={courseProgressPercentage} className="h-2" />
                  <span className="text-xs text-muted-foreground">{completedLessonsCount} de {totalLessons} ({Math.round(courseProgressPercentage)}%)</span>
              </div>
            )}
            {nextLesson ? (
                 <Button asChild variant={isCurrentLessonCompleted ? 'default' : 'outline'}>
                    <Link href={`/courses/${nextLesson.courseId}/${nextLesson.lessonId}`}>
                        Próxima <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                 </Button>
            ) : hasFullAccess ? (
                <Button variant={isCurrentLessonCompleted ? 'default' : 'outline'} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="mr-2 h-4 w-4"/> Curso Concluído
                </Button>
            ) : null}
             <Button asChild variant="ghost" size="icon">
                <Link href={`/courses/${courseId}`}>
                    <X className="h-5 w-5"/>
                </Link>
            </Button>
          </div>
        </header>

        <div className="p-4 md:p-8 overflow-y-auto flex-grow">
            {currentLesson.videoUrl ? (
                <div className="aspect-video w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden">
                    <ReactPlayer
                        url={youtubeEmbedUrl}
                        width="100%"
                        height="100%"
                        controls
                        playing={false}
                        onProgress={(progress) => handleProgress(progress.played)}
                        config={{
                            youtube: { playerVars: { showinfo: 0, rel: 0, origin: typeof window !== 'undefined' ? window.location.origin : '' } },
                            vimeo: { playerOptions: { byline: false, portrait: false } }
                        }}
                    />
                </div>
             ) : (
                <div className="max-w-4xl mx-auto p-8 bg-secondary/30 rounded-lg text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold text-white">Aula em formato de texto</h2>
                    <p className="text-muted-foreground">Esta aula não possui vídeo. Leia o conteúdo abaixo.</p>
                </div>
             )
            }


            <div className="max-w-4xl mx-auto mt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{currentLesson.title}</h1>
                  {hasFullAccess && (
                      <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 p-1 rounded-full bg-secondary/50">
                              <Button size="sm" variant="ghost" onClick={() => handleReaction('like')} className={cn("rounded-full h-8 px-3", userReaction === 'like' && 'bg-primary/20 text-primary')}>
                                  <ThumbsUp className="mr-2 h-4 w-4" /> {likes}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleReaction('dislike')} className={cn("rounded-full h-8 px-3", userReaction === 'dislike' && 'bg-destructive/20 text-destructive')}>
                                 <ThumbsDown className="h-4 w-4" />
                              </Button>
                          </div>
                          {!currentLesson.videoUrl && !isCurrentLessonCompleted && (
                              <Button onClick={markAsCompleted}>
                                  <Check className="mr-2 h-4 w-4" /> Marcar concluída
                              </Button>
                          )}
                      </div>
                  )}
                </div>
                
                <Tabs defaultValue="description" className="w-full">
                    <TabsList>
                        <TabsTrigger value="description"><BookOpen className="h-4 w-4 mr-2" />Descrição</TabsTrigger>
                         {hasFullAccess && <TabsTrigger value="comments"><MessagesSquare className="h-4 w-4 mr-2" />Comentários</TabsTrigger>}
                    </TabsList>
                    <TabsContent value="description" className="py-6">
                        {currentLesson.description && (
                            <div className="prose prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: currentLesson.description }} />
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
                    </TabsContent>
                    {hasFullAccess && (
                        <TabsContent value="comments" className="py-6">
                            <CommentsSection 
                                courseId={courseId as string}
                                lessonId={lessonId as string}
                                user={user}
                                isAdmin={isAdmin}
                            />
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
      </main>
    </div>
  );
}


// --- Comments Section ---

interface CommentsSectionProps {
    courseId: string;
    lessonId: string;
    user: any;
    isAdmin: boolean;
}

function CommentsSection({ courseId, lessonId, user, isAdmin }: CommentsSectionProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [commentText, setCommentText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const commentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments`),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, courseId, lessonId]);

    const { data: rawComments, isLoading: commentsLoading, error: commentsError } = useCollection<LessonComment>(commentsQuery);
    
    useEffect(() => {
        if(commentsError) {
            toast({
                variant: 'destructive',
                title: 'Erro ao carregar comentários.',
                description: commentsError.message || 'Verifique suas permissões de rede ou tente novamente mais tarde.'
            })
        }
    }, [commentsError, toast])

    const comments = useMemo(() => {
        if (!rawComments) return [];
        const pinned = rawComments.filter(c => c.isPinned);
        const unpinned = rawComments.filter(c => !c.isPinned);
        return [...pinned, ...unpinned];
    }, [rawComments]);

    const handlePostComment = async () => {
        if (!firestore || !user || !commentText.trim()) return;
        setIsSubmitting(true);

        const commentsRef = collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments`);
        const commentData = {
            userId: user.uid,
            userDisplayName: user.displayName || 'Anônimo',
            userPhotoURL: user.photoURL || '',
            text: commentText,
            timestamp: serverTimestamp(),
            isPinned: false,
            likeCount: 0,
            replyCount: 0,
        };

        try {
            await addDoc(commentsRef, commentData);
            setCommentText("");
        } catch (error) {
            console.error("Error posting comment:", error);
            const permissionError = new FirestorePermissionError({
                path: commentsRef.path,
                operation: 'create',
                requestResourceData: commentData
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="space-y-8">
            <div className="flex items-start gap-4">
                <Avatar>
                    <AvatarImage src={user?.photoURL || undefined} />
                    <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    <Textarea 
                        placeholder="Adicionar um comentário..." 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="bg-secondary/50"
                        rows={3}
                    />
                    <div className="flex justify-end">
                        <Button onClick={handlePostComment} disabled={!commentText.trim() || isSubmitting}>
                            {isSubmitting ? 'Enviando...' : 'Comentar'}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {commentsLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                
                {commentsError && (
                    <div className="text-center py-8 text-destructive">
                        <p>Ocorreu um erro ao carregar os comentários.</p>
                    </div>
                )}

                {comments && comments.map(comment => (
                    <CommentItem 
                        key={comment.id}
                        comment={comment}
                        courseId={courseId}
                        lessonId={lessonId}
                        currentUser={user}
                        isAdmin={isAdmin}
                    />
                ))}
                 {comments && comments.length === 0 && !commentsLoading && !commentsError && (
                    <p className="text-center text-muted-foreground py-8">Nenhum comentário ainda. Seja o primeiro a comentar!</p>
                )}
            </div>
        </div>
    );
}

// --- Comment Item ---

interface CommentItemProps {
    comment: LessonComment;
    courseId: string;
    lessonId: string;
    currentUser: any;
    isAdmin: boolean;
}

function CommentItem({ comment, courseId, lessonId, currentUser, isAdmin }: CommentItemProps) {
    const firestore = useFirestore();
    const [showReplies, setShowReplies] = useState(false);
    
    const likesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${comment.id}/likes`);
    }, [firestore, courseId, lessonId, comment.id]);
    const { data: likes } = useCollection<CommentLike>(likesQuery);
    
    const userHasLiked = useMemo(() => likes?.some(like => like.userId === currentUser.uid), [likes, currentUser]);

    const handleToggleLike = async () => {
        if (!firestore || !currentUser) return;
        const likeRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${comment.id}/likes`, currentUser.uid);
        const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, comment.id);

        try {
            await runTransaction(firestore, async (transaction) => {
                const likeDoc = await transaction.get(likeRef);
                if (likeDoc.exists()) {
                    transaction.delete(likeRef);
                    transaction.update(commentRef, { likeCount: increment(-1) });
                } else {
                    transaction.set(likeRef, { userId: currentUser.uid, timestamp: serverTimestamp() });
                    transaction.update(commentRef, { likeCount: increment(1) });
                }
            });
        } catch (error) {
            console.error("Error toggling like:", error);
            const permissionError = new FirestorePermissionError({
                path: likeRef.path,
                operation: 'write',
                requestResourceData: { userId: currentUser.uid }
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };

    const handlePinComment = async () => {
        if (!firestore || !isAdmin) return;
        const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, comment.id);
        updateDoc(commentRef, { isPinned: !comment.isPinned }).catch(error => {
            const permissionError = new FirestorePermissionError({
                path: commentRef.path,
                operation: 'update',
                requestResourceData: { isPinned: !comment.isPinned }
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    };

    const handleDeleteComment = async () => {
        if (!firestore) return;
        const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, comment.id);
        deleteDoc(commentRef).catch(error => {
            const permissionError = new FirestorePermissionError({
                path: commentRef.path,
                operation: 'delete'
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    };

    return (
        <div className="flex items-start gap-4 relative">
            <Avatar>
                <AvatarImage src={comment.userPhotoURL} />
                <AvatarFallback>{comment.userDisplayName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                 {comment.isPinned && <Badge variant="secondary" className="absolute -top-2 -left-8 text-xs"><Pin className="mr-1 h-3 w-3" /> Fixo</Badge>}
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{comment.userDisplayName}</span>
                    <span className="text-xs text-muted-foreground">
                        {comment.timestamp ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
                    </span>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap">{comment.text}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <button onClick={handleToggleLike} className={cn("flex items-center gap-1 hover:text-primary", userHasLiked && "text-primary")}>
                        <Heart className={cn("h-4 w-4", userHasLiked && "fill-current")} /> {comment.likeCount || 0}
                    </button>
                    <button onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-1 hover:text-white">
                        <CornerUpLeft className="h-4 w-4" /> <span>Respostas</span>
                    </button>
                </div>
                {showReplies && (
                    <RepliesSection 
                        courseId={courseId}
                        lessonId={lessonId}
                        commentId={comment.id}
                        currentUser={currentUser}
                        isAdmin={isAdmin}
                    />
                )}
            </div>
             <div className="absolute top-0 right-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {isAdmin && (
                            <DropdownMenuItem onClick={handlePinComment}>
                                <Pin className="mr-2 h-4 w-4" /> {comment.isPinned ? 'Desafixar' : 'Fixar'}
                            </DropdownMenuItem>
                        )}
                        {(isAdmin || currentUser.uid === comment.userId) && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />Excluir
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Excluir comentário?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteComment}>Confirmar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
             </div>
        </div>
    )
}

// --- Replies Section ---
interface RepliesSectionProps {
    courseId: string;
    lessonId: string;
    commentId: string;
    currentUser: any;
    isAdmin: boolean;
}

function RepliesSection({ courseId, lessonId, commentId, currentUser, isAdmin }: RepliesSectionProps) {
    const firestore = useFirestore();
    const [replyText, setReplyText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const repliesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${commentId}/replies`),
            orderBy('timestamp', 'asc')
        );
    }, [firestore, courseId, lessonId, commentId]);

    const { data: replies, isLoading: repliesLoading } = useCollection<CommentReply>(repliesQuery);
    
    const handlePostReply = async () => {
        if (!firestore || !currentUser || !replyText.trim()) return;
        setIsSubmitting(true);
        const repliesRef = collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${commentId}/replies`);
        const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, commentId);

        const replyData = {
            userId: currentUser.uid,
            userDisplayName: currentUser.displayName || 'Anônimo',
            userPhotoURL: currentUser.photoURL || '',
            text: replyText,
            timestamp: serverTimestamp(),
        };

        try {
            await runTransaction(firestore, async (transaction) => {
                transaction.set(doc(repliesRef), replyData);
                transaction.update(commentRef, { replyCount: increment(1) });
            });
            setReplyText("");
        } catch (error) {
            console.error("Error posting reply:", error);
             const permissionError = new FirestorePermissionError({
                path: repliesRef.path,
                operation: 'create',
                requestResourceData: replyData
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteReply = async (replyId: string) => {
        if (!firestore) return;
        const replyRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${commentId}/replies`, replyId);
        const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, commentId);
        
        try {
            await runTransaction(firestore, async (transaction) => {
                transaction.delete(replyRef);
                transaction.update(commentRef, { replyCount: increment(-1) });
            });
        } catch(error) {
            const permissionError = new FirestorePermissionError({
                path: replyRef.path,
                operation: 'delete'
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };

    return (
        <div className="mt-4 pl-6 border-l-2 border-border space-y-4">
            {repliesLoading && <Skeleton className="h-16 w-full" />}
            {replies && replies.map(reply => (
                <div key={reply.id} className="flex items-start gap-3 relative group">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={reply.userPhotoURL} />
                        <AvatarFallback>{reply.userDisplayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{reply.userDisplayName}</span>
                            <span className="text-xs text-muted-foreground">
                                {reply.timestamp ? formatDistanceToNow(reply.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reply.text}</p>
                    </div>
                     {(isAdmin || currentUser.uid === reply.userId) && (
                         <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Excluir resposta?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteReply(reply.id)}>Confirmar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                     )}
                </div>
            ))}
             <div className="flex items-start gap-3 pt-4">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUser?.photoURL || undefined} />
                    <AvatarFallback>{currentUser?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                     <Textarea 
                        placeholder="Adicionar uma resposta..." 
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="bg-secondary/50 text-sm"
                        rows={2}
                    />
                    <div className="flex justify-end mt-2">
                        <Button onClick={handlePostReply} size="sm" disabled={!replyText.trim() || isSubmitting}>
                            {isSubmitting ? 'Enviando...' : 'Responder'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
