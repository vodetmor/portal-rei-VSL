
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
import { CheckCircle, Circle, Lock, ArrowRight, X, Download, Link2, FileText, Check, ThumbsUp, ThumbsDown, MessageSquare, CornerUpLeft, Send, Heart, MoreVertical, Pin, Trash2, Menu, ShoppingCart, ChevronRight } from 'lucide-react';
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
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import Image from 'next/image';


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
  checkoutUrl?: string;
  modules: Module[];
  isDemoEnabled?: boolean;
  isFree?: boolean;
  status: 'draft' | 'published';
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

function GoogleDriveIcon(props: Omit<React.ComponentProps<typeof Image>, 'src' | 'alt'>) {
    return (
        <Image 
            src="https://i.imgur.com/IKiXRlX.png" 
            alt="Google Drive"
            width={20}
            height={20}
            className={cn('h-5 w-5', props.className)}
        />
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
    if (!firestore) return;
    
    setLoading(true);
    setIsCurrentLessonCompleted(false);

    try {
      const courseDocRef = doc(firestore, 'courses', courseId as string);
      const courseDocSnap = await getDoc(courseDocRef);
      if (!courseDocSnap.exists()) {
          toast({ variant: 'destructive', title: 'Curso não encontrado.'})
          router.push('/dashboard');
          return;
      }
      const courseData = { id: courseDocSnap.id, ...courseDocSnap.data() } as Course;
      setCourse(courseData);
      
      let userHasFullAccess = false;
      let isAdminUser = false;

      if(user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const userRole = userDocSnap.data()?.role;
        isAdminUser = userRole === 'admin' || user.email === 'admin@reidavsl.com';
        setIsAdmin(isAdminUser);

        const accessDocRef = doc(firestore, `users/${user.uid}/courseAccess`, courseId as string);
        const accessDocSnap = await getDoc(accessDocRef);
        userHasFullAccess = accessDocSnap.exists() || isAdminUser || courseData.isFree === true;
      }
      
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
        toast({ variant: 'destructive', title: 'Aula não encontrada.'})
        router.push(`/courses/${courseId}`);
        return;
      }
      
      const isDemoLesson = courseData.isDemoEnabled && (foundLesson.isDemo || foundModule.isDemo);
      const canView = userHasFullAccess || isDemoLesson;
      
      if (!canView) {
        if (!user) {
          router.push(`/login?redirect=/courses/${courseId}/${lessonId}`);
        } else {
          toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Você não tem permissão para ver esta aula.' });
          router.push(`/courses/${courseId}`);
        }
        return;
      }


      setHasAccess(true);
      setHasFullAccess(userHasFullAccess);

      if (userHasFullAccess && user) {
        const accessDocRef = doc(firestore, `users/${user.uid}/courseAccess`, courseId as string);
        const accessDocSnap = await getDoc(accessDocRef);
        const accessTimestamp = accessDocSnap.data()?.grantedAt?.toDate();
        const grantedAtDate = accessTimestamp || (isAdminUser ? new Date() : null);
        if (grantedAtDate) {
          setCourseAccessInfo({ grantedAt: grantedAtDate.toISOString() });
        }
      
        if (!isAdminUser) {
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
              toast({ variant: 'destructive', title: 'Conteúdo Bloqueado', description: 'Esta aula ainda não foi liberada para você.' });
              router.push(`/courses/${courseId}`);
              return;
          }
        }
      }


      setCurrentLesson(foundLesson);
      setCurrentModule(foundModule);

      if (userHasFullAccess && user) {
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
  }, [courseId, lessonId, user, userLoading, firestore, router, toast]);


  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    fetchLessonData();
  }, [user, userLoading, fetchLessonData]);

 const markAsCompleted = async () => {
    if (!firestore || !user || !courseId || !lessonId || !hasFullAccess) return;

    const progressRef = doc(firestore, 'users', user.uid, 'progress', courseId as string);

    try {
        await setDoc(progressRef, {
            completedLessons: {
                [lessonId]: serverTimestamp()
            },
            updatedAt: serverTimestamp(),
            courseId: courseId
        }, { merge: true });

        setIsCurrentLessonCompleted(true);

        if (nextLesson) {
          router.push(`/courses/${nextLesson.courseId}/${nextLesson.lessonId}`);
        } else {
            toast({
                title: "Curso Concluído!",
                description: "Parabéns, você finalizou todas as aulas.",
            });
        }
    } catch (error) {
        console.error("Error marking lesson as completed:", error);
         toast({
            variant: "destructive",
            title: "Erro",
            description: "Não foi possível marcar a aula como concluída.",
        });
    }
 };
 
 const toggleReaction = async (reactionType: 'like' | 'dislike') => {
    if (!firestore || !user || !courseId || !lessonId) return;

    if (!hasFullAccess) {
        toast({
            variant: "destructive",
            title: "Acesso Negado",
            description: "Você precisa adquirir o curso para interagir.",
        });
        return;
    }

    const reactionRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/reactions`, user.uid);
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const reactionDoc = await transaction.get(reactionRef);
        
        if (reactionDoc.exists()) {
          const existingReaction = reactionDoc.data().type;
          if (existingReaction === reactionType) {
            // User is clicking the same button again, so remove the reaction
            transaction.delete(reactionRef);
          } else {
            // User is changing their reaction
            transaction.update(reactionRef, { type: reactionType });
          }
        } else {
          // User is reacting for the first time
          transaction.set(reactionRef, { userId: user.uid, type: reactionType });
        }
      });
    } catch (error) {
      console.error("Error toggling reaction:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível registrar sua reação.",
      });
    }
  };

  const userReaction = useMemo(() => {
    return reactions?.find(r => r.userId === user?.uid)?.type;
  }, [reactions, user]);

  const likeCount = useMemo(() => reactions?.filter(r => r.type === 'like').length || 0, [reactions]);
  const dislikeCount = useMemo(() => reactions?.filter(r => r.type === 'dislike').length || 0, [reactions]);


  const isModuleUnlocked = useCallback((module: Module) => {
    if (!courseAccessInfo || !isClient) return false;
    if (isAdmin) return true;
    
    const delay = module.releaseDelayDays || 0;
    if (delay === 0) return true;

    try {
      const grantedDate = parseISO(courseAccessInfo.grantedAt);
      const releaseDate = addDays(grantedDate, delay);
      return new Date() >= releaseDate;
    } catch (e) {
      return false;
    }
  }, [courseAccessInfo, isClient, isAdmin]);

  if (loading || userLoading) {
    return <LessonPageSkeleton />;
  }

  if (!course || !currentLesson) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
            <h1 className="text-2xl font-bold text-white">Carregando aula...</h1>
            <p className="text-muted-foreground mt-2">Verificando permissões.</p>
        </div>
    );
  }
  
  const isDriveLink = currentLesson.videoUrl && currentLesson.videoUrl.includes('drive.google.com');


  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-80 shrink-0 border-r border-border bg-background transition-transform md:relative md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-border px-4">
          <Link href={`/courses/${courseId}`} className="font-bold text-white truncate hover:text-primary">
            {course.title}
          </Link>
           <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="h-[calc(100vh-5rem)] overflow-y-auto">
          <Accordion type="single" collapsible defaultValue={currentModule?.id} className="w-full">
            {course.modules.map(module => {
              const unlocked = hasFullAccess ? isModuleUnlocked(module) : (module.isDemo || course.isDemoEnabled);
              return (
                <AccordionItem key={module.id} value={module.id} disabled={!unlocked}>
                  <AccordionTrigger className="px-4 text-left font-semibold text-white disabled:text-muted-foreground disabled:cursor-not-allowed">
                    {module.title}
                    {!unlocked && <Lock className="ml-2 h-3 w-3 shrink-0 text-muted-foreground" />}
                  </AccordionTrigger>
                  <AccordionContent className="border-t border-border/50">
                    <ul className="py-1">
                      {module.lessons.map(lesson => {
                        const isCompleted = userProgress?.completedLessons[lesson.id];
                        const isActive = lesson.id === lessonId;
                        const isLessonLocked = hasFullAccess ? !unlocked : !(lesson.isDemo || module.isDemo);
                        const isTextLesson = !lesson.videoUrl;
                        
                        return (
                          <li key={lesson.id}>
                            <Link
                              href={isLessonLocked ? '#' : `/courses/${courseId}/${lesson.id}`}
                              className={cn(
                                'flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50',
                                isActive && 'bg-primary/10 text-primary',
                                isLessonLocked && 'pointer-events-none text-muted-foreground/50'
                              )}
                            >
                              {isLessonLocked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" /> 
                               : isTextLesson ? <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                               : isCompleted ? <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                               : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              <span className="flex-grow">{lesson.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <header className="flex h-20 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
              </Button>
              <div className='hidden md:flex items-center gap-2'>
                <p className="text-sm text-muted-foreground">{currentModule?.title}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <h1 className="text-lg font-semibold text-white truncate">{currentLesson.title}</h1>
            </div>
            
            {hasFullAccess && (
              <Button onClick={markAsCompleted} disabled={isCurrentLessonCompleted}>
                {isCurrentLessonCompleted ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Aula Concluída
                  </>
                ) : (
                  <>
                    Marcar como concluída <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </header>

          <div className="p-4 md:p-8">
            {/* Video Player */}
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
              {currentLesson.videoUrl && !isDriveLink ? (
                <ReactPlayer
                  url={youtubeEmbedUrl}
                  width="100%"
                  height="100%"
                  controls
                  playing
                  light={false}
                  config={{
                    youtube: {
                      playerVars: { showinfo: 0, modestbranding: 1, rel: 0 }
                    }
                  }}
                />
              ) : isDriveLink ? (
                 <div className="h-full w-full flex flex-col items-center justify-center bg-secondary/30 text-center p-4">
                    <GoogleDriveIcon className="h-16 w-16 text-primary mb-4" />
                    <h3 className="text-xl font-bold text-white">Conteúdo no Google Drive</h3>
                    <p className="text-muted-foreground mt-2">Este conteúdo está hospedado no Google Drive. Clique no botão abaixo para acessá-lo.</p>
                     <Button asChild className="mt-6">
                        <a href={currentLesson.videoUrl} target="_blank" rel="noopener noreferrer">Acessar Conteúdo</a>
                    </Button>
                </div>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center bg-secondary/30 text-center p-4">
                    <FileText className="h-16 w-16 text-primary mb-4" />
                    <h3 className="text-xl font-bold text-white">Aula de Leitura</h3>
                    <p className="text-muted-foreground mt-2">Esta aula consiste em texto e materiais complementares. Explore o conteúdo abaixo.</p>
                </div>
              )}
            </div>
            
            {user && (
              <div className="mt-6 flex items-center justify-end gap-2">
                <Button variant={userReaction === 'like' ? 'default' : 'outline'} onClick={() => toggleReaction('like')}>
                  <ThumbsUp className="mr-2 h-4 w-4" /> {likeCount}
                </Button>
                <Button variant={userReaction === 'dislike' ? 'destructive' : 'outline'} onClick={() => toggleReaction('dislike')}>
                  <ThumbsDown className="mr-2 h-4 w-4" /> {dislikeCount}
                </Button>
              </div>
            )}

            <Tabs defaultValue="description" className="mt-8">
              <TabsList>
                <TabsTrigger value="description"><BookOpen className="mr-2 h-4 w-4" />Descrição</TabsTrigger>
                <TabsTrigger value="comments">
                  <MessagesSquare className="mr-2 h-4 w-4" />
                  Comentários
                   {!hasFullAccess && <Lock className="ml-2 h-3 w-3" />}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="description" className="mt-6">
                 <Card>
                    <CardHeader>
                        <h2 className="text-xl font-bold text-white">Sobre esta aula</h2>
                    </CardHeader>
                    <CardContent className="prose prose-invert max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: currentLesson.description }} />
                         {currentLesson.complementaryMaterials && currentLesson.complementaryMaterials.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-border">
                                <h3 className="text-lg font-semibold text-white mb-4">Materiais Complementares</h3>
                                <ul className="space-y-3">
                                {currentLesson.complementaryMaterials.map(material => {
                                  const isDriveLink = material.url && material.url.includes('drive.google.com');
                                  return(
                                    <li key={material.id}>
                                        <a href={material.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md bg-secondary/50 p-3 hover:bg-secondary transition-colors no-underline">
                                            {isDriveLink ? <GoogleDriveIcon /> : <Download className="h-5 w-5 text-primary" />}
                                            <span className="font-medium text-white">{material.title}</span>
                                        </a>
                                    </li>
                                  )
                                })}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="comments" className="mt-6">
                 <Card>
                    <CardHeader>
                        <h2 className="text-xl font-bold text-white">Comunidade</h2>
                    </CardHeader>
                    <CardContent>
                       {user ? (
                           hasFullAccess ? (
                              <CommentsSection
                                firestore={firestore}
                                user={user}
                                courseId={courseId as string}
                                lessonId={lessonId as string}
                                isAdmin={isAdmin}
                              />
                           ) : (
                                <div className="text-center py-12">
                                  <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
                                  <h3 className="mt-4 text-lg font-semibold text-white">Comunidade Exclusiva</h3>
                                  <p className="mt-2 text-sm text-muted-foreground">Adquira o curso para participar da discussão e tirar suas dúvidas.</p>
                                  {course.checkoutUrl && (
                                    <Button asChild className="mt-6">
                                        <a href={course.checkoutUrl}><ShoppingCart className="mr-2 h-4 w-4" /> Comprar Agora</a>
                                    </Button>
                                  )}
                              </div>
                           )
                        ) : (
                          <div className="text-center py-12">
                              <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
                              <h3 className="mt-4 text-lg font-semibold text-white">Faça login para participar</h3>
                              <p className="mt-2 text-sm text-muted-foreground">Você precisa estar logado para ver e postar comentários.</p>
                              <Button asChild className="mt-6">
                                  <Link href={`/login?redirect=/courses/${courseId}/${lessonId}`}>Fazer Login</Link>
                              </Button>
                          </div>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

// --- Comments Section Component ---
interface CommentsSectionProps {
  firestore: any;
  user: any;
  courseId: string;
  lessonId: string;
  isAdmin: boolean;
}

function CommentsSection({ firestore, user, courseId, lessonId, isAdmin }: CommentsSectionProps) {
  const [newComment, setNewComment] = useState("");

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId || !lessonId) return null;
    return query(
      collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments`),
      orderBy('timestamp', 'desc')
    );
  }, [firestore, courseId, lessonId]);

  const { data: comments, isLoading: commentsLoading } = useCollection<LessonComment>(commentsQuery);
  
  const sortedComments = useMemo(() => {
    if (!comments) return [];
    // Sort pinned comments to the top, then by timestamp
    return [...comments].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // Fallback to timestamp if both have same pinned status
      if (a.timestamp && b.timestamp) {
        return b.timestamp.toMillis() - a.timestamp.toMillis();
      }
      return 0;
    });
  }, [comments]);


  const handlePostComment = async () => {
    if (!newComment.trim() || !user) return;
    const commentData = {
      userId: user.uid,
      userDisplayName: user.displayName || 'Anônimo',
      userPhotoURL: user.photoURL || '',
      text: newComment,
      timestamp: serverTimestamp(),
      isPinned: false,
      likeCount: 0,
      replyCount: 0
    };
    await addDoc(collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments`), commentData);
    setNewComment("");
  };

  if (commentsLoading) {
    return <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  }
  
  return (
    <div className="space-y-6">
      {/* Post a new comment */}
      <div className="flex items-start gap-4">
        <Avatar>
          <AvatarImage src={user?.photoURL || ''} />
          <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
        </Avatar>
        <div className="w-full">
          <Textarea 
            value={newComment} 
            onChange={(e) => setNewComment(e.target.value)} 
            placeholder="Deixe seu comentário..."
            className="mb-2"
          />
          <Button onClick={handlePostComment} disabled={!newComment.trim()}>Postar Comentário</Button>
        </div>
      </div>
      
      {/* Comments List */}
      <div className="space-y-6">
        {sortedComments && sortedComments.length > 0 ? sortedComments.map(comment => (
          <CommentItem 
            key={comment.id}
            comment={comment}
            firestore={firestore}
            user={user}
            courseId={courseId}
            lessonId={lessonId}
            isAdmin={isAdmin}
          />
        )) : (
          <p className="text-center text-muted-foreground py-8">Seja o primeiro a comentar!</p>
        )}
      </div>
    </div>
  );
}


// --- Comment Item ---

interface CommentItemProps extends CommentsSectionProps {
    comment: LessonComment;
}

function CommentItem({ comment, firestore, user, courseId, lessonId, isAdmin }: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(false);
  
  const commentLikesQuery = useMemoFirebase(() => {
    return collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${comment.id}/likes`);
  }, [firestore, courseId, lessonId, comment.id]);

  const { data: likes } = useCollection<CommentLike>(commentLikesQuery);
  const isLiked = useMemo(() => likes?.some(like => like.userId === user.uid), [likes, user]);
  
  const { toast } = useToast();

  const toggleLike = async () => {
    const likeRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${comment.id}/likes`, user.uid);
    const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, comment.id);

    try {
      await runTransaction(firestore, async (transaction) => {
        const likeDoc = await transaction.get(likeRef);
        if (likeDoc.exists()) {
          transaction.delete(likeRef);
          transaction.update(commentRef, { likeCount: increment(-1) });
        } else {
          transaction.set(likeRef, { userId: user.uid, timestamp: serverTimestamp() });
          transaction.update(commentRef, { likeCount: increment(1) });
        }
      });
    } catch (e) { console.error(e); }
  };
  
   const togglePin = async () => {
    const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, comment.id);
    await updateDoc(commentRef, { isPinned: !comment.isPinned });
  };
  
  const deleteComment = async () => {
    const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, comment.id);
    await deleteDoc(commentRef);
    toast({ title: 'Comentário excluído.' });
  };


  return (
    <div className={cn("flex items-start gap-4", comment.isPinned && "bg-primary/5 p-4 rounded-lg")}>
      <Avatar>
        <AvatarImage src={comment.userPhotoURL} />
        <AvatarFallback>{comment.userDisplayName.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="w-full">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-white">
                {comment.userDisplayName}
                {comment.userId === user.uid && <Badge variant="secondary" className="ml-2">Você</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {comment.timestamp ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
            </p>
          </div>
          {(isAdmin || comment.userId === user.uid) && (
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {isAdmin && <DropdownMenuItem onClick={togglePin}>{comment.isPinned ? 'Desafixar' : 'Fixar no topo'}</DropdownMenuItem>}
                    <DropdownMenuItem onClick={deleteComment} className="text-destructive focus:text-destructive">Excluir</DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>
          )}
        </div>
        <p className="mt-2 text-white/90 whitespace-pre-wrap">{makeLinksClickable(comment.text)}</p>
        
        <div className="mt-2 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={toggleLike} className={cn("flex items-center gap-1.5", isLiked && "text-primary")}>
            <Heart className={cn("h-4 w-4", isLiked && "fill-current")} /> {comment.likeCount || 0}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-1.5">
            <CornerUpLeft className="h-4 w-4" /> {comment.replyCount || 0}
          </Button>
          {comment.isPinned && <Badge variant="outline" className="border-primary text-primary"><Pin className="mr-1.5 h-3 w-3" /> Fixado</Badge>}
        </div>

        {showReplies && (
          <RepliesSection 
            firestore={firestore}
            user={user}
            courseId={courseId}
            lessonId={lessonId}
            commentId={comment.id}
          />
        )}
      </div>
    </div>
  );
}


// --- Replies Section ---
interface RepliesSectionProps {
  firestore: any;
  user: any;
  courseId: string;
  lessonId: string;
  commentId: string;
}

function RepliesSection({ firestore, user, courseId, lessonId, commentId }: RepliesSectionProps) {
  const [newReply, setNewReply] = useState('');
  
  const repliesQuery = useMemoFirebase(() => {
     return query(
      collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${commentId}/replies`),
      orderBy('timestamp', 'asc')
    );
  }, [firestore, courseId, lessonId, commentId]);

  const { data: replies, isLoading: repliesLoading } = useCollection<CommentReply>(repliesQuery);
  
  const handlePostReply = async () => {
    if (!newReply.trim()) return;
    const replyData = {
      userId: user.uid,
      userDisplayName: user.displayName || 'Anônimo',
      userPhotoURL: user.photoURL || '',
      text: newReply,
      timestamp: serverTimestamp(),
    };
    const repliesCol = collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${commentId}/replies`);
    const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, commentId);

    const batch = writeBatch(firestore);
    batch.set(doc(repliesCol), replyData);
    batch.update(commentRef, { replyCount: increment(1) });
    await batch.commit();

    setNewReply('');
  };
  
  const deleteReply = async (replyId: string) => {
    const replyRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${commentId}/replies`, replyId);
    const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, commentId);
    
    const batch = writeBatch(firestore);
    batch.delete(replyRef);
    batch.update(commentRef, { replyCount: increment(-1) });
    await batch.commit();
  }

  return (
    <div className="mt-4 pl-8 border-l-2 border-border/50 space-y-4">
      {repliesLoading && <Skeleton className="h-12 w-full" />}
      {replies && replies.map(reply => (
        <div key={reply.id} className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={reply.userPhotoURL} />
            <AvatarFallback>{reply.userDisplayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="w-full">
             <div className="flex items-center justify-between">
                <div>
                    <p className="font-semibold text-sm text-white">{reply.userDisplayName}</p>
                    <p className="text-xs text-muted-foreground">
                        {reply.timestamp ? formatDistanceToNow(reply.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
                    </p>
                </div>
                {reply.userId === user.uid && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir resposta?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteReply(reply.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
             </div>
            <p className="mt-1 text-white/90 text-sm whitespace-pre-wrap">{makeLinksClickable(reply.text)}</p>
          </div>
        </div>
      ))}
      {/* Reply input */}
      <div className="flex items-start gap-3 pt-4">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.photoURL || ''} />
          <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
        </Avatar>
        <div className="w-full">
            <Textarea value={newReply} onChange={e => setNewReply(e.target.value)} placeholder="Escreva uma resposta..." className="text-sm min-h-[60px]" />
            <Button onClick={handlePostReply} disabled={!newReply.trim()} size="sm" className="mt-2 flex items-center gap-2">
                <Send className="h-3 w-3" /> Responder
            </Button>
        </div>
      </div>
    </div>
  );
}

function LessonPageSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-80 shrink-0 border-r border-border bg-secondary/30 md:block">
        <div className="flex h-20 items-center border-b border-border px-4">
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="p-4 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <header className="flex h-20 items-center justify-between border-b border-border px-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-10 w-32" />
          </header>

          <div className="p-4 md:p-8">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <div className="mt-8">
              <Skeleton className="h-10 w-1/4 mb-4" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

    