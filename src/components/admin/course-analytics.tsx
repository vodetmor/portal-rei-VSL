
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, doc, getDoc, query } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Users, CheckCircle, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
        // Step 1: Get the course structure
        const courseRef = doc(firestore, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);
        if (!courseSnap.exists()) {
          throw new Error('Curso não encontrado');
        }
        const course = courseSnap.data() as Course;
        const totalLessons = course.modules.reduce((acc, mod) => acc + mod.lessons.length, 0);

        // Step 2: Get all users who have access to this course.
        // This is inefficient but necessary with the current structure.
        // A better approach would be a sub-collection on the course itself,
        // but that requires restructuring user access logic.
        const usersQuery = query(collection(firestore, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        const userIds = usersSnapshot.docs.map(d => d.id);
        
        // Step 3: Fetch progress for all those users for this specific course
        const progressPromises = userIds.map(uid => 
            getDoc(doc(firestore, `users/${uid}/progress`, courseId))
        );
        const progressSnapshots = await Promise.all(progressPromises);
        const allProgressData = progressSnapshots
            .filter(snap => snap.exists())
            .map(snap => snap.data() as UserProgress);

        const totalEnrollments = allProgressData.length;

        if (totalEnrollments === 0) {
            setAnalytics({
                totalEnrollments: 0,
                overallCompletionRate: 0,
                moduleCompletionRates: course.modules.map(mod => ({
                    id: mod.id,
                    title: mod.title,
                    completionRate: 0,
                    lessonCompletionRates: mod.lessons.map(l => ({ id: l.id, title: l.title, completionRate: 0 }))
                }))
            });
            setLoading(false);
            return;
        }

        // Step 4: Calculate analytics
        const lessonCompletions: Record<string, number> = {}; // lessonId -> count
        course.modules.forEach(mod => mod.lessons.forEach(l => lessonCompletions[l.id] = 0));

        allProgressData.forEach(progress => {
            Object.keys(progress.completedLessons).forEach(lessonId => {
                if (lessonId in lessonCompletions) {
                    lessonCompletions[lessonId]++;
                }
            });
        });
        
        let totalCompletedLessonsOverall = 0;
        const moduleCompletionRates = course.modules.map(module => {
            let totalCompletedLessonsInModule = 0;
            const lessonCompletionRates = module.lessons.map(lesson => {
                const completionCount = lessonCompletions[lesson.id] || 0;
                const completionRate = totalEnrollments > 0 ? (completionCount / totalEnrollments) * 100 : 0;
                totalCompletedLessonsInModule += completionCount;
                return {
                    id: lesson.id,
                    title: lesson.title,
                    completionRate
                };
            });

            const moduleTotalLessons = module.lessons.length;
            const moduleCompletionRate = (moduleTotalLessons > 0 && totalEnrollments > 0)
                ? (totalCompletedLessonsInModule / (moduleTotalLessons * totalEnrollments)) * 100
                : 0;
            
            totalCompletedLessonsOverall += totalCompletedLessonsInModule;
            
            return {
                id: module.id,
                title: module.title,
                completionRate: moduleCompletionRate,
                lessonCompletionRates
            };
        });
        
        const overallCompletionRate = (totalLessons > 0 && totalEnrollments > 0)
            ? (totalCompletedLessonsOverall / (totalLessons * totalEnrollments)) * 100
            : 0;

        setAnalytics({
            totalEnrollments,
            overallCompletionRate,
            moduleCompletionRates
        });

      } catch (error: any) {
        console.error('Error fetching analytics:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao Carregar Análise',
          description: error.message || 'Não foi possível carregar os dados de progresso.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [courseId, firestore, toast]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Análise de Progresso de "{courseTitle}"</CardTitle>
                <CardDescription>
                    Não foi possível carregar os dados. Tente novamente mais tarde.
                </CardDescription>
            </CardHeader>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise de Progresso de "{courseTitle}"</CardTitle>
        <CardDescription>
          Veja como os alunos estão progredindo no curso em geral.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-secondary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alunos Inscritos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalEnrollments}</div>
              <p className="text-xs text-muted-foreground">Total de alunos com acesso</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conclusão Média</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.overallCompletionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Média de todas as aulas</p>
            </CardContent>
          </Card>
           <Card className="bg-secondary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Módulos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.moduleCompletionRates.length}</div>
              <p className="text-xs text-muted-foreground">Total de módulos no curso</p>
            </CardContent>
          </Card>
        </div>

        <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Progresso por Módulo e Aula</h3>
            {analytics.moduleCompletionRates.length > 0 ? (
                <div className="space-y-4">
                    {analytics.moduleCompletionRates.map(module => (
                        <Card key={module.id} className="bg-background/50">
                            <CardHeader className="p-4">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-base">{module.title}</CardTitle>
                                    <span className="text-sm font-semibold text-primary">{module.completionRate.toFixed(1)}%</span>
                                </div>
                                <Progress value={module.completionRate} className="h-2 mt-2"/>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-2">
                                {module.lessonCompletionRates.map(lesson => (
                                    <div key={lesson.id} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-secondary/40">
                                        <p className="text-muted-foreground">{lesson.title}</p>
                                        <p className="font-medium text-white">{lesson.completionRate.toFixed(1)}%</p>
                                    </div>
                                ))}
                                {module.lessonCompletionRates.length === 0 && (
                                     <p className="text-sm text-muted-foreground text-center py-2">Este módulo não possui aulas.</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">Este curso ainda não tem módulos para analisar.</p>
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
