
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
import { CheckCircle, Circle, Lock, ArrowLeft, ArrowRight, X, Download, Link2, FileText, Check, ThumbsUp, ThumbsDown, MessageSquare, CornerUpLeft, Send, Heart, MoreVertical, Pin, Trash2, Menu, ShoppingCart } from 'lucide-react';
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
    // Only fetch reactions if user has full access
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
      
      if (userHasFullAccess && !isAdminUser) {
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

 const markAsCompleted = async () =>