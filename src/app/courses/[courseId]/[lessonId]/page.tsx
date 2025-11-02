
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, Circle, Lock, ArrowLeft, ArrowRight, X, Download, Link2, FileText, Check, ThumbsUp, Send, MessageSquare, BookOpen, Trash2, Pin, PinOff, CornerDownRight } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { addDays, parseISO } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    completedLessons: { [lessonId: string]: string };
}

interface CourseAccessInfo {
    grantedAt: string;
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

interface CommentReply {
    id: string;
    userId: string;
    userDisplayName: string;
    userPhotoURL: string;
    text: string;
    timestamp: any;
}


interface LessonReaction {
    id: string;
    userId: string;
    type: 'like' | 'dislike';
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
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [courseAccessInfo, setCourseAccessInfo] = useState<CourseAccessInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId || !lessonId) return null;
    return query(collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments`), orderBy('isPinned', 'desc'), orderBy('timestamp', 'desc'));
  }, [firestore, courseId, lessonId]);
  const { data: comments, isLoading: commentsLoading } = useCollection<LessonComment>(commentsQuery);

  const reactionsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId || !lessonId) return null;
    return collection(firestore, `courses/${courseId}/lessons/${lessonId}/reactions`);
  }, [firestore, courseId, lessonId]);
  const { data: reactions, isLoading: reactionsLoading } = useCollection<LessonReaction>(reactionsQuery);

  const [nextLesson, setNextLesson] = useState<{ courseId: string; lessonId: string } | null>(null);
  const [isCurrentLessonCompleted, setIsCurrentLessonCompleted] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchLessonData = useCallback(async () => {
    if (!user || !firestore) return;
    setLoading(true);
    setIsCurrentLessonCompleted(false);

    try {
      const userDocSnap = await getDoc(doc(firestore, 'users', user.uid));
      const userRole = userDocSnap.data()?.role;
      const isAdminUser = userRole === 'admin' || user.email === 'admin@reidavsl.com';
      setIsAdmin(isAdminUser);
      
      const accessDocSnap = await getDoc(doc(firestore, `users/${user.uid}/courseAccess`, courseId as string));
      if (!accessDocSnap.exists() && !isAdminUser) {
        toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Você não tem acesso a este curso.' });
        router.push('/dashboard');
        return;
      }
      const accessTimestamp = accessDocSnap.data()?.grantedAt?.toDate();
      setCourseAccessInfo({ grantedAt: accessTimestamp ? accessTimestamp.toISOString() : new Date().toISOString() });

      const courseDocSnap = await getDoc(doc(firestore, 'courses', courseId as string));
      if (!courseDocSnap.exists()) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Curso não encontrado.' });
        router.push('/dashboard');
        return;
      }
      const courseData = { id: courseDocSnap.id, ...courseDocSnap.data() } as Course;
      setCourse(courseData);

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

 const markAsCompleted = async () => {
    if (isCurrentLessonCompleted || !user || !firestore) return;
    
    setIsCurrentLessonCompleted(true);

    const progressRef = doc(firestore, `users/${user.uid}/progress`, courseId as string);
    const newProgressPayload = {
      [`completedLessons.${lessonId}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(progressRef, newProgressPayload);
      toast({ title: "Aula Concluída!", description: `"${currentLesson?.title}" foi marcada como concluída.` });
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
        toast({ title: "Aula Concluída!", description: `"${currentLesson?.title}" foi marcada como concluída.` });
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
    if (!user || !firestore || !courseId || !lessonId) return;

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

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore || !newComment.trim() || !courseId || !lessonId) return;
    
    setIsSubmittingComment(true);
    const commentsCollectionRef = collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments`);
    const commentData = {
        userId: user.uid,
        userDisplayName: user.displayName,
        userPhotoURL: user.photoURL,
        text: newComment,
        timestamp: serverTimestamp(),
        isPinned: false,
        likeCount: 0,
        replyCount: 0
    };

    addDoc(commentsCollectionRef, commentData)
        .then(() => {
            setNewComment('');
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: commentsCollectionRef.path,
                operation: 'create',
                requestResourceData: commentData,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsSubmittingComment(false);
        });
  };

  const handleDeleteComment = (commentId: string) => {
    if (!firestore || !courseId || !lessonId) return;
    const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, commentId);
    
    deleteDoc(commentRef)
        .then(() => {
            toast({ title: 'Comentário excluído.' });
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: commentRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };


  if (loading || userLoading || !course || !currentLesson || !currentModule || !isClient) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isLessonCompleted = (lessonId: string) => !!userProgress?.completedLessons[lessonId];
  const isModuleUnlocked = (module: Module) => {
      if (isAdmin || !courseAccessInfo || !isClient) return true;
      const delay = module.releaseDelayDays || 0;
      if (delay === 0) return true;
      const grantedDate = parseISO(courseAccessInfo.grantedAt);
      const releaseDate = addDays(grantedDate, delay);
      return new Date() >= releaseDate;
  };
  
  const processedDescription = makeLinksClickable(currentLesson.description || '');

  return (
    <div className="flex min-h-screen bg-black text-white pt-20">
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
        isSidebarOpen ? "md:ml-80" : "md:ml-0"
      )}>
        <header className="flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm z-10 border-b border-border h-20 shrink-0 sticky top-20">
           <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:flex">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </Button>
                <div className="text-sm">
                    <span className="text-muted-foreground hidden md:inline">{course.title} / </span> 
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
            {currentLesson.videoUrl ? (
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
                  <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 p-1 rounded-full bg-secondary/50">
                        <Button size="sm" variant="ghost" onClick={() => handleReaction('like')} className={cn("rounded-full h-8 px-3", userReaction === 'like' && 'bg-primary/20 text-primary')}>
                            <ThumbsUp className="mr-2 h-4 w-4" /> {likes}
                        </Button>
                      </div>
                      {!currentLesson.videoUrl && !isCurrentLessonCompleted && (
                         <Button onClick={markAsCompleted}>
                             <Check className="mr-2 h-4 w-4" /> Marcar concluída
                         </Button>
                      )}
                  </div>
                </div>
                
                <Tabs defaultValue="description" className="w-full">
                    <TabsList>
                        <TabsTrigger value="description"><BookOpen className="h-4 w-4 mr-2" />Descrição</TabsTrigger>
                        <TabsTrigger value="comments"><MessageSquare className="h-4 w-4 mr-2" />Comentários</TabsTrigger>
                    </TabsList>
                    <TabsContent value="description" className="py-6">
                        {currentLesson.description && (
                            <div className="prose prose-invert max-w-none text-muted-foreground">{processedDescription}</div>
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
                    <TabsContent value="comments" className="py-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Comentários ({comments?.length || 0})</h2>
                        <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3 mb-8">
                             <div className="flex gap-3">
                                <Avatar className="h-10 w-10 mt-1">
                                    <AvatarImage src={user?.photoURL || undefined} />
                                    <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <Textarea 
                                    placeholder="Deixe seu comentário..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    className="flex-1 bg-secondary/50"
                                    rows={3}
                                />
                             </div>
                             <div className="flex justify-end">
                                <Button type="submit" disabled={isSubmittingComment}>
                                    <Send className="h-4 w-4 mr-2" />
                                    {isSubmittingComment ? 'Enviando...' : 'Enviar'}
                                </Button>
                             </div>
                        </form>
                        
                        <div className="space-y-6">
                            {commentsLoading ? (
                                <Skeleton className="h-20 w-full" />
                            ) : comments && comments.length > 0 ? (
                                comments.map(comment => (
                                    <Comment
                                        key={comment.id}
                                        comment={comment}
                                        courseId={courseId as string}
                                        lessonId={lessonId as string}
                                        currentUserId={user?.uid}
                                        isAdmin={isAdmin}
                                    />
                                ))
                            ) : (
                                <p className="text-center text-muted-foreground py-4">Seja o primeiro a comentar!</p>
                            )}
                        </div>

                    </TabsContent>
                </Tabs>
            </div>
        </div>
      </main>
    </div>
  );
}

// --- Comment Component and its sub-components ---

interface CommentProps {
    comment: LessonComment;
    courseId: string;
    lessonId: string;
    currentUserId?: string;
    isAdmin?: boolean;
}

function Comment({ comment, courseId, lessonId, currentUserId, isAdmin }: CommentProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [showReplies, setShowReplies] = useState(false);
    
    const repliesQuery = useMemoFirebase(() => {
        if (!firestore || !showReplies) return null;
        return query(collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${comment.id}/replies`), orderBy('timestamp', 'asc'));
    }, [firestore, courseId, lessonId, comment.id, showReplies]);

    const { data: replies, isLoading: repliesLoading } = useCollection<CommentReply>(repliesQuery);

    const handleTogglePin = () => {
        if (!isAdmin || !firestore) return;
        const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, comment.id);
        updateDoc(commentRef, { isPinned: !comment.isPinned })
            .catch(err => console.error("Pin error:", err));
    };

    const handleLike = () => {
        if (!currentUserId || !firestore) return;

        const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, comment.id);
        const likeRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${comment.id}/likes`, currentUserId);

        runTransaction(firestore, async (transaction) => {
            const likeDoc = await transaction.get(likeRef);
            if (likeDoc.exists()) {
                transaction.delete(likeRef);
                transaction.update(commentRef, { likeCount: increment(-1) });
            } else {
                transaction.set(likeRef, { userId: currentUserId, timestamp: serverTimestamp() });
                transaction.update(commentRef, { likeCount: increment(1) });
            }
        }).catch(err => console.error("Like transaction error: ", err));
    };

    return (
        <div className={cn("flex items-start gap-4", comment.isPinned && "bg-secondary/30 p-4 rounded-lg")}>
            <Avatar className="h-10 w-10">
                <AvatarImage src={comment.userPhotoURL} />
                <AvatarFallback>{comment.userDisplayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-baseline justify-between">
                    <p className="font-semibold text-white">{comment.userDisplayName}</p>
                    <div className="flex items-center gap-2">
                        {comment.isPinned && <Pin className="h-4 w-4 text-primary" />}
                        <p className="text-xs text-muted-foreground">{comment.timestamp ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : ''}</p>
                        {(isAdmin || currentUserId === comment.userId) && (
                            <Trash2 className="h-3 w-3 text-destructive/70 cursor-pointer" onClick={() => {
                                 if (!firestore) return;
                                 deleteDoc(doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, comment.id))
                                    .then(() => toast({ title: 'Comentário excluído.' }))
                                    .catch(err => console.error(err));
                            }}/>
                        )}
                    </div>
                </div>
                <div className="text-muted-foreground whitespace-pre-wrap prose-sm prose-invert max-w-none">
                    {makeLinksClickable(comment.text)}
                </div>
                <div className="mt-2 flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={handleLike} className="flex items-center gap-1.5 text-muted-foreground h-auto p-1">
                        <ThumbsUp className="h-4 w-4" /> {comment.likeCount || 0}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-1.5 text-muted-foreground h-auto p-1">
                        <MessageSquare className="h-4 w-4" /> {comment.replyCount || 0} Respostas
                    </Button>
                    {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={handleTogglePin} className="flex items-center gap-1.5 text-muted-foreground h-auto p-1">
                           {comment.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </Button>
                    )}
                </div>
                {showReplies && (
                    <div className="mt-4 space-y-4">
                        <ReplyForm courseId={courseId} lessonId={lessonId} commentId={comment.id} />
                         <div className="space-y-4 pl-8 border-l border-border/50">
                            {repliesLoading && <Skeleton className="h-10 w-full" />}
                            {replies?.map(reply => (
                                <div key={reply.id} className="flex items-start gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={reply.userPhotoURL} />
                                        <AvatarFallback>{reply.userDisplayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                     <div className="flex-1">
                                        <div className="flex items-baseline gap-2">
                                             <p className="font-semibold text-white text-sm">{reply.userDisplayName}</p>
                                              <p className="text-xs text-muted-foreground">{reply.timestamp ? formatDistanceToNow(reply.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : ''}</p>
                                        </div>
                                        <div className="text-muted-foreground text-sm whitespace-pre-wrap prose-sm prose-invert max-w-none">{makeLinksClickable(reply.text)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

interface ReplyFormProps {
    courseId: string;
    lessonId: string;
    commentId: string;
}

function ReplyForm({ courseId, lessonId, commentId }: ReplyFormProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [replyText, setReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !user || !replyText.trim()) return;

        setIsSubmitting(true);
        const replyCollectionRef = collection(firestore, `courses/${courseId}/lessons/${lessonId}/comments/${commentId}/replies`);
        const commentRef = doc(firestore, `courses/${courseId}/lessons/${lessonId}/comments`, commentId);

        const replyData = {
            userId: user.uid,
            userDisplayName: user.displayName,
            userPhotoURL: user.photoURL,
            text: replyText,
            timestamp: serverTimestamp(),
        };

        runTransaction(firestore, async (transaction) => {
            transaction.set(doc(replyCollectionRef), replyData);
            transaction.update(commentRef, { replyCount: increment(1) });
        }).then(() => {
            setReplyText('');
        }).catch(err => {
            console.error("Reply transaction error: ", err);
        }).finally(() => {
            setIsSubmitting(false);
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-start gap-3 pl-8">
            <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
                <Textarea 
                    placeholder="Escreva sua resposta..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 bg-secondary/80 text-sm"
                    rows={2}
                />
                <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={isSubmitting}>
                        {isSubmitting ? "Enviando..." : "Responder"}
                    </Button>
                </div>
            </div>
        </form>
    );
}

    