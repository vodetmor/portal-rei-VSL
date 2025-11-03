
'use client';

import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, doc, getDoc, query } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Users, CheckCircle, TrendingUp, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Course {
  modules: {
    id: string;
    title: string;
    lessons: { id: string; title: string }[];
  }[];
}

interface UserProgress {
  completedLessons: Record<string, any>;
}

interface UserData {
    id: string;
    displayName: string;
    photoURL?: string;
}

interface Reaction {
    userId: string;
    type: 'like' | 'dislike';
}

interface AnalyticsData {
  totalEnrollments: number;
  overallCompletionRate: number;
  moduleCompletionRates: {
    id: string;
    title: string;
    completionRate: number;
    lessonCompletionRates: {
      id: string;
      title: string;
      completionRate: number;
    }[];
  }[];
  totalComments: number;
  totalLikes: number;
  totalDislikes: number;
  lessonEngagements: {
      lessonId: string;
      lessonTitle: string;
      commentsCount: number;
      likes: UserData[];
      dislikes: UserData[];
  }[];
}

interface CourseAnalyticsProps {
  courseId: string;
  courseTitle: string;
}

export default function CourseAnalytics({ courseId, courseTitle }: CourseAnalyticsProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!firestore || !courseId) return;

      setLoading(true);
      try {
        const courseRef = doc(firestore, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);
        if (!courseSnap.exists()) throw new Error('Curso não encontrado');
        const course = courseSnap.data() as Course;
        const allLessons = course.modules.flatMap(mod => mod.lessons.map(l => ({...l, moduleId: mod.id})));
        const totalLessonsCount = allLessons.length;
        
        const usersQuery = query(collection(firestore, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        const allUsers = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserData));
        const userMap = new Map(allUsers.map(u => [u.id, u]));

        const progressPromises = allUsers.map(u => getDoc(doc(firestore, `users/${u.id}/progress`, courseId)));
        const progressSnapshots = await Promise.all(progressPromises);
        const allProgressData = progressSnapshots.filter(s => s.exists()).map(s => s.data() as UserProgress);
        const totalEnrollments = allProgressData.length;

        let totalCompletedLessonsOverall = 0;
        const lessonCompletions: Record<string, number> = {};
        allLessons.forEach(l => lessonCompletions[l.id] = 0);
        allProgressData.forEach(p => Object.keys(p.completedLessons).forEach(lessonId => {
            if (lessonId in lessonCompletions) lessonCompletions[lessonId]++;
        }));

        const moduleCompletionRates = course.modules.map(module => {
            let totalCompletedLessonsInModule = 0;
            const lessonCompletionRates = module.lessons.map(lesson => {
                const completionCount = lessonCompletions[lesson.id] || 0;
                totalCompletedLessonsInModule += completionCount;
                return {
                    id: lesson.id,
                    title: lesson.title,
                    completionRate: totalEnrollments > 0 ? (completionCount / totalEnrollments) * 100 : 0
                };
            });
            totalCompletedLessonsOverall += totalCompletedLessonsInModule;
            const moduleTotalLessons = module.lessons.length;
            const moduleCompletionRate = (moduleTotalLessons > 0 && totalEnrollments > 0) ? (totalCompletedLessonsInModule / (moduleTotalLessons * totalEnrollments)) * 100 : 0;
            return { id: module.id, title: module.title, completionRate: moduleCompletionRate, lessonCompletionRates };
        });

        const overallCompletionRate = (totalLessonsCount > 0 && totalEnrollments > 0) ? (totalCompletedLessonsOverall / (totalLessonsCount * totalEnrollments)) * 100 : 0;
        
        // --- Fetch Engagement Data ---
        let totalComments = 0;
        const lessonEngagements = await Promise.all(allLessons.map(async (lesson) => {
            const commentsRef = collection(firestore, `courses/${courseId}/lessons/${lesson.id}/comments`);
            const reactionsRef = collection(firestore, `courses/${courseId}/lessons/${lesson.id}/reactions`);
            const [commentsSnap, reactionsSnap] = await Promise.all([getDocs(commentsRef), getDocs(reactionsRef)]);
            
            totalComments += commentsSnap.size;
            
            const reactions = reactionsSnap.docs.map(d => d.data() as Reaction);
            const likes = reactions.filter(r => r.type === 'like').map(r => userMap.get(r.userId)).filter(Boolean) as UserData[];
            const dislikes = reactions.filter(r => r.type === 'dislike').map(r => userMap.get(r.userId)).filter(Boolean) as UserData[];
            
            return {
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                commentsCount: commentsSnap.size,
                likes,
                dislikes,
            };
        }));
        
        const totalLikes = lessonEngagements.reduce((sum, l) => sum + l.likes.length, 0);
        const totalDislikes = lessonEngagements.reduce((sum, l) => sum + l.dislikes.length, 0);

        setAnalytics({
            totalEnrollments,
            overallCompletionRate,
            moduleCompletionRates,
            totalComments,
            totalLikes,
            totalDislikes,
            lessonEngagements
        });

      } catch (error: any) {
        console.error('Error fetching analytics:', error);
        toast({ variant: 'destructive', title: 'Erro ao Carregar Análise', description: error.message || 'Não foi possível carregar os dados.' });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [courseId, firestore, toast]);

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
        <CardContent className="space-y-6"><div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (<Card><CardHeader><CardTitle>Análise de Progresso de "{courseTitle}"</CardTitle><CardDescription>Não foi possível carregar os dados. Tente novamente mais tarde.</CardDescription></CardHeader></Card>)
  }

  return (
    <div className="space-y-8">
        <Card>
            <CardHeader><CardTitle>Visão Geral de "{courseTitle}"</CardTitle><CardDescription>Veja como os alunos estão progredindo e interagindo com o curso.</CardDescription></CardHeader>
            <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="bg-secondary/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Alunos Inscritos</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.totalEnrollments}</div><p className="text-xs text-muted-foreground">Total de alunos com acesso</p></CardContent></Card>
                    <Card className="bg-secondary/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Conclusão Média</CardTitle><CheckCircle className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.overallCompletionRate.toFixed(1)}%</div><p className="text-xs text-muted-foreground">Média de todas as aulas</p></CardContent></Card>
                    <Card className="bg-secondary/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Módulos</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.moduleCompletionRates.length}</div><p className="text-xs text-muted-foreground">Total de módulos no curso</p></CardContent></Card>
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader><CardTitle>Análise de Engajamento</CardTitle><CardDescription>Acompanhe as interações dos alunos com o conteúdo.</CardDescription></CardHeader>
            <CardContent className="space-y-8">
                 <div className="grid gap-6 md:grid-cols-3">
                    <Card className="bg-secondary/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Comentários</CardTitle><MessageSquare className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.totalComments}</div><p className="text-xs text-muted-foreground">Total no curso</p></CardContent></Card>
                    <Card className="bg-secondary/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Likes</CardTitle><ThumbsUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.totalLikes}</div><p className="text-xs text-muted-foreground">Total no curso</p></CardContent></Card>
                    <Card className="bg-secondary/50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Dislikes</CardTitle><ThumbsDown className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.totalDislikes}</div><p className="text-xs text-muted-foreground">Total no curso</p></CardContent></Card>
                </div>
                <div>
                     <h3 className="text-lg font-semibold mb-4 text-white">Engajamento por Aula</h3>
                     <div className="border rounded-lg">
                        <div className="grid grid-cols-[3fr_1fr_1fr_1fr] p-2 border-b bg-muted/50 font-medium text-muted-foreground text-sm"><div className="pl-2">Aula</div><div className="text-center">Comentários</div><div className="text-center">Likes</div><div className="text-center">Dislikes</div></div>
                        <div className="space-y-1 p-1">
                            {analytics.lessonEngagements.map(l => <EngagementRow key={l.lessonId} lesson={l} />)}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Análise de Progresso</CardTitle><CardDescription>Veja o avanço dos alunos em cada módulo e aula.</CardDescription></CardHeader>
            <CardContent>
                {analytics.moduleCompletionRates.length > 0 ? (
                    <div className="space-y-4">{analytics.moduleCompletionRates.map(module => (<Card key={module.id} className="bg-background/50"><CardHeader className="p-4"><div className="flex justify-between items-center"><CardTitle className="text-base">{module.title}</CardTitle><span className="text-sm font-semibold text-primary">{module.completionRate.toFixed(1)}%</span></div><Progress value={module.completionRate} className="h-2 mt-2"/></CardHeader><CardContent className="p-4 pt-0 space-y-2">{module.lessonCompletionRates.map(lesson => (<div key={lesson.id} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-secondary/40"><p className="text-muted-foreground">{lesson.title}</p><p className="font-medium text-white">{lesson.completionRate.toFixed(1)}%</p></div>))}{module.lessonCompletionRates.length === 0 && (<p className="text-sm text-muted-foreground text-center py-2">Este módulo não possui aulas.</p>)}</CardContent></Card>))}</div>
                ) : (<div className="text-center py-10 border-2 border-dashed rounded-lg"><p className="text-muted-foreground">Este curso ainda não tem módulos para analisar.</p></div>)}
            </CardContent>
        </Card>
    </div>
  );
}


function EngagementRow({ lesson }: { lesson: AnalyticsData['lessonEngagements'][0] }) {
    return (
        <div className="grid grid-cols-[3fr_1fr_1fr_1fr] items-center p-2 rounded-md hover:bg-secondary/40 text-sm">
            <div className="truncate pr-2 text-white">{lesson.lessonTitle}</div>
            <div className="text-center text-muted-foreground">{lesson.commentsCount}</div>
            <div className="text-center">
                 <UserListDialog users={lesson.likes} triggerText={String(lesson.likes.length)} title={`Likes em "${lesson.lessonTitle}"`} />
            </div>
            <div className="text-center">
                <UserListDialog users={lesson.dislikes} triggerText={String(lesson.dislikes.length)} title={`Dislikes em "${lesson.lessonTitle}"`} />
            </div>
        </div>
    )
}

function UserListDialog({ users, triggerText, title }: { users: UserData[], triggerText: string, title: string }) {
    if (users.length === 0) {
        return <span className="text-muted-foreground">{triggerText}</span>
    }
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="link" size="sm" className="h-auto p-0 font-semibold">{triggerText}</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {users.map(user => (
                        <div key={user.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                            <Avatar className="h-8 w-8"><AvatarImage src={user.photoURL} /><AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback></Avatar>
                            <span className="font-medium text-white">{user.displayName}</span>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
