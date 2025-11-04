

'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminGuard from '@/components/admin/admin-guard';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, DocumentData, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Check, X, ShieldAlert, BookOpen, Lock, ChevronDown, Trash2 } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { logAdminAction } from '@/lib/audit';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { addDays, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface User extends DocumentData {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role?: 'admin' | 'user';
}

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
  modules: { id: string; title: string; releaseDelayDays?: number; lessons: {id: string; releaseDelayDays?: number;}[] }[];
}

interface CourseAccess {
    [courseId: string]: { grantedAt: any };
}

interface UserProgress {
    [courseId: string]: {
        completedLessons: Record<string, any>;
        updatedAt: any;
    }
}

function ManageUserAccessPage() {
  const { userId } = useParams();
  const firestore = useFirestore();
  const { user: adminUser } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseAccess, setCourseAccess] = useState<CourseAccess>({});
  const [userProgress, setUserProgress] = useState<UserProgress>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  const [isConfirmingRoleChange, setIsConfirmingRoleChange] = useState(false);
  const [targetRole, setTargetRole] = useState<'admin' | 'user' | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = useCallback(async () => {
    if (!firestore || !userId) return;

    try {
      // Fetch user details
      const userRef = doc(firestore, 'users', userId as string);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = { id: userSnap.id, ...userSnap.data() } as User;
        setUser(userData);
        setIsAdmin(userData.role === 'admin');
      } else {
        throw new Error("User not found");
      }

      // Fetch all courses
      const coursesRef = collection(firestore, 'courses');
      const coursesSnap = await getDocs(coursesRef);
      const coursesData = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(coursesData);
      
      // Fetch user's current course access
      const accessRef = collection(firestore, `users/${userId}/courseAccess`);
      const accessSnap = await getDocs(accessRef);
      const accessData: CourseAccess = {};
      accessSnap.forEach(doc => {
        accessData[doc.id] = { grantedAt: doc.data().grantedAt };
      });
      setCourseAccess(accessData);
      
      // Fetch user's progress
      const progressRef = collection(firestore, `users/${userId}/progress`);
      const progressSnap = await getDocs(progressRef);
      const progressData: UserProgress = {};
      progressSnap.forEach(snap => {
        progressData[snap.id] = snap.data() as UserProgress[string];
      });
      setUserProgress(progressData);


    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os dados." });
      router.push('/admin/users');
    } finally {
      setLoading(false);
    }
  }, [firestore, userId, toast, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  

  const handleAccessChange = (courseId: string, courseTitle: string, hasAccess: boolean) => {
    if (!firestore || !userId || !adminUser) return;

    setCourseAccess(prev => {
        const newState = { ...prev };
        if (hasAccess) {
            newState[courseId] = { grantedAt: serverTimestamp() }; // Placeholder, will be replaced by server
        } else {
            delete newState[courseId];
        }
        return newState;
    });

    const accessDocRef = doc(firestore, `users/${userId}/courseAccess`, courseId);

    if (hasAccess) {
      const dataToSet = { courseId: courseId, grantedAt: serverTimestamp() };
      setDoc(accessDocRef, dataToSet)
        .then(() => {
          logAdminAction(firestore, adminUser, 'access_granted', {
            type: 'Course Access',
            id: courseId,
            title: `Acesso a '${courseTitle}' para ${user?.email}`
          });
          fetchData(); // Re-fetch to get server timestamp
        })
        .catch(async (serverError) => {
           setCourseAccess(prev => {
                const newState = { ...prev };
                delete newState[courseId];
                return newState;
            });
          const permissionError = new FirestorePermissionError({ path: accessDocRef.path, operation: 'create', requestResourceData: dataToSet });
          errorEmitter.emit('permission-error', permissionError);
        });
    } else {
      deleteDoc(accessDocRef)
        .then(() => {
           logAdminAction(firestore, adminUser, 'access_revoked', {
            type: 'Course Access',
            id: courseId,
            title: `Acesso a '${courseTitle}' revogado para ${user?.email}`
          });
        })
        .catch(async (serverError) => {
          setCourseAccess(prev => ({ ...prev, [courseId]: { grantedAt: 'reverting' } })); // Revert UI optimistically
          const permissionError = new FirestorePermissionError({ path: accessDocRef.path, operation: 'delete' });
          errorEmitter.emit('permission-error', permissionError);
        });
    }
  };
  
  const handleRoleChange = async () => {
    if (!firestore || !user || !adminUser || targetRole === null) return;
    
    const userRef = doc(firestore, 'users', user.id);
    const userData = { role: targetRole };

    updateDoc(userRef, userData)
      .then(async () => {
        await logAdminAction(firestore, adminUser, targetRole === 'admin' ? 'user_promoted' : 'user_demoted', {
            type: 'User Role',
            id: user.id,
            title: `Usuário ${user.email} para ${targetRole}`
        });
        
        setIsAdmin(targetRole === 'admin');
        toast({
          title: "Função Atualizada!",
          description: `${user.displayName} agora é ${targetRole === 'admin' ? 'um administrador' : 'um usuário'}.`,
        });
      })
      .catch((error) => {
        console.error("Error updating role:", error);
        const permissionError = new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: userData });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: "destructive",
          title: "Erro de Permissão",
          description: "Não foi possível alterar a função do usuário.",
        });
      })
      .finally(() => {
        setIsConfirmingRoleChange(false);
        setTargetRole(null);
      });
  };

  const handleResetProgress = async (courseId: string, courseTitle: string) => {
    if (!firestore || !userId || !adminUser) return;
    
    const progressRef = doc(firestore, `users/${userId}/progress`, courseId);

    try {
        const batch = writeBatch(firestore);
        // Deleting the document is the cleanest way to reset progress.
        batch.delete(progressRef); 
        // We could also reset courseAccess here if needed, but for now we only reset progress
        // e.g., batch.update(doc(firestore, `users/${userId}/courseAccess`, courseId), { grantedAt: serverTimestamp() });

        await batch.commit();

        await logAdminAction(firestore, adminUser, 'progress_reset', {
            type: 'User Progress',
            id: courseId,
            title: `Progresso em '${courseTitle}' para ${user?.email}`
        });

        toast({
            title: "Progresso Resetado!",
            description: `O progresso de ${user?.displayName} em ${courseTitle} foi reiniciado.`
        });
        fetchData(); // Refresh data
    } catch (error) {
        console.error("Error resetting progress: ", error);
        const permissionError = new FirestorePermissionError({
            path: progressRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível resetar o progresso." });
    }
  };


  const onSwitchChange = (checked: boolean) => {
      if (isOwner) return;
      setTargetRole(checked ? 'admin' : 'user');
      setIsConfirmingRoleChange(true);
  }

  const isOwner = user?.email === 'admin@reidavsl.com';


  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 md:px-8 space-y-6 pt-20">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return <div className="container text-center py-20">Usuário não encontrado.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 md:px-8 space-y-8">
      <div className="mb-6 pt-20">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Usuários
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.photoURL} />
            <AvatarFallback>{user.displayName?.charAt(0) || user.email.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{user.displayName}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Função Administrativa</CardTitle>
          <CardDescription>Promova ou rebaixe o usuário da função de administrador.</CardDescription>
        </CardHeader>
        <CardContent>
            <AlertDialog open={isConfirmingRoleChange} onOpenChange={setIsConfirmingRoleChange}>
                <div className="flex items-center justify-between p-4 rounded-lg border bg-secondary/50">
                    <div>
                        <Label htmlFor="admin-switch" className="font-medium text-white">Administrador</Label>
                        <p className="text-sm text-muted-foreground">Concede permissões para gerenciar todo o site.</p>
                         {isOwner && <p className="text-xs text-primary mt-1">O dono do site não pode ter sua função alterada.</p>}
                    </div>
                    <Switch
                        id="admin-switch"
                        checked={isAdmin}
                        onCheckedChange={onSwitchChange} 
                        disabled={isOwner}
                    />
                </div>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {targetRole === 'admin'
                                ? `Isso concederá permissões de administrador para ${user.displayName}. O usuário poderá gerenciar cursos, usuários e configurações do site.`
                                : `Isso removerá todas as permissões de administrador de ${user.displayName}. O usuário não poderá mais gerenciar cursos, usuários ou configurações do site.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTargetRole(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRoleChange}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acesso e Progresso nos Cursos</CardTitle>
          <CardDescription>Gerencie o acesso e visualize o progresso do usuário.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {courses.length > 0 ? courses.map(course => (
             <CourseProgressCard 
                key={course.id}
                course={course}
                access={courseAccess[course.id] || null}
                progress={userProgress[course.id] || null}
                onAccessChange={(hasAccess) => handleAccessChange(course.id, course.title, hasAccess)}
                onResetProgress={() => handleResetProgress(course.id, course.title)}
                isClient={isClient}
             />
          )) : (
            <p className="text-muted-foreground text-center py-4">Nenhum curso encontrado na plataforma.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


interface CourseProgressCardProps {
    course: Course;
    access: { grantedAt: any } | null;
    progress: UserProgress[string] | null;
    onAccessChange: (hasAccess: boolean) => void;
    onResetProgress: () => void;
    isClient: boolean;
}

function CourseProgressCard({ course, access, progress, onAccessChange, onResetProgress, isClient }: CourseProgressCardProps) {
    const totalLessons = course.modules?.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0) || 0;
    const completedLessonsCount = progress ? Object.keys(progress.completedLessons).length : 0;
    const overallProgress = totalLessons > 0 ? (completedLessonsCount / totalLessons) * 100 : 0;
    const hasAccess = !!access;
    
    const isModuleUnlocked = (module: Course['modules'][0]) => {
        if (!access || !isClient) return false;
        const delay = module.releaseDelayDays || 0;
        if (delay === 0) return true;

        const grantedAtDate = access.grantedAt.toDate();
        const releaseDate = addDays(grantedAtDate, delay);
        return new Date() >= releaseDate;
    };

    const getDaysUntilRelease = (module: Course['modules'][0]): number | null => {
        if (!access || !isClient) return null;
        const delay = module.releaseDelayDays || 0;
        if (delay === 0) return null;
        
        const grantedAtDate = access.grantedAt.toDate();
        const releaseDate = addDays(grantedAtDate, delay);
        const daysRemaining = differenceInDays(releaseDate, new Date());
        
        return daysRemaining >= 0 ? daysRemaining : null; // Show 0 if it's today
    };

    return (
        <Collapsible className="p-4 rounded-lg border bg-secondary/50 group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                     <div className={`h-8 w-8 rounded-full flex items-center justify-center ${hasAccess ? 'bg-primary/20' : 'bg-muted'}`}>
                        <BookOpen className={`h-4 w-4 ${hasAccess ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                        <p className="font-medium text-white">{course.title}</p>
                        <div className="flex items-center gap-2">
                             {hasAccess ? (
                                <Badge variant="default" className="bg-green-600/80">Com Acesso</Badge>
                             ) : (
                                <Badge variant="destructive">Sem Acesso</Badge>
                             )}
                              {hasAccess && (
                                <div className="text-xs text-muted-foreground">
                                    {Math.round(overallProgress)}% concluído
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasAccess && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Trash2 className="h-4 w-4 text-destructive/70" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Resetar Progresso?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Isso apagará todo o progresso de aulas concluídas deste usuário no curso "{course.title}". A data de liberação dos módulos (drip content) não será afetada. Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={onResetProgress}>Confirmar e Resetar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {hasAccess && course.modules?.length > 0 && (
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="flex gap-2">
                                Detalhes <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </Button>
                        </CollapsibleTrigger>
                    )}
                     <Switch
                        checked={hasAccess}
                        onCheckedChange={onAccessChange}
                        aria-label={`Toggle access for ${course.title}`}
                    />
                </div>
            </div>
            
            {hasAccess && overallProgress > 0 && (
                 <Progress value={overallProgress} className="mt-3 h-1.5" />
            )}

            <CollapsibleContent className="mt-4 pt-4 border-t border-border/50 space-y-3">
                 <h4 className="text-sm font-semibold text-muted-foreground">Progresso por Módulo</h4>
                 {course.modules?.map(module => {
                     const moduleTotalLessons = module.lessons?.length || 0;
                     const moduleCompletedLessons = module.lessons?.filter(l => progress?.completedLessons[l.id]).length || 0;
                     const moduleProgress = moduleTotalLessons > 0 ? (moduleCompletedLessons / moduleTotalLessons) * 100 : 0;
                     const unlocked = isModuleUnlocked(module);
                     const daysRemaining = getDaysUntilRelease(module);

                     return (
                         <div key={module.id} className="p-3 rounded-md bg-background/50">
                             <div className="flex justify-between items-center">
                                 <div>
                                    <p className="font-medium text-sm text-white">{module.title}</p>
                                     <p className="text-xs text-muted-foreground">{moduleCompletedLessons} / {moduleTotalLessons} aulas</p>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     {!unlocked ? (
                                        <Badge variant="outline" className="text-xs">
                                             <Lock className="mr-1.5 h-3 w-3"/>
                                            {daysRemaining !== null ? `Libera em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}` : 'Bloqueado'}
                                        </Badge>
                                     ) : (
                                        <span className="text-sm font-semibold text-white">{Math.round(moduleProgress)}%</span>
                                     )}
                                </div>
                             </div>
                             {unlocked && <Progress value={moduleProgress} className="mt-2 h-1" />}
                         </div>
                     )
                 })}
                 {(!course.modules || course.modules.length === 0) && (
                     <p className="text-center text-sm text-muted-foreground py-4">Este curso ainda não possui módulos.</p>
                 )}
            </CollapsibleContent>
        </Collapsible>
    )
}

export default function ManageUserPage() {
    return (
        <AdminGuard>
            <ManageUserAccessPage />
        </AdminGuard>
    )
}
