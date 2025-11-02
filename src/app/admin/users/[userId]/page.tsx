'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminGuard from '@/components/admin/admin-guard';
import { useFirestore } from '@/firebase';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, DocumentData } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Check, X } from 'lucide-react';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

interface User extends DocumentData {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
}

interface CourseAccess {
    [courseId: string]: boolean;
}

function ManageUserAccessPage() {
  const { userId } = useParams();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseAccess, setCourseAccess] = useState<CourseAccess>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!firestore || !userId) return;

    try {
      // Fetch user details
      const userRef = doc(firestore, 'users', userId as string);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUser({ id: userSnap.id, ...userSnap.data() } as User);
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
        accessData[doc.id] = true;
      });
      setCourseAccess(accessData);

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

  const handleAccessChange = async (courseId: string, hasAccess: boolean) => {
    if (!firestore || !userId) return;

    // Optimistically update UI
    setCourseAccess(prev => ({ ...prev, [courseId]: hasAccess }));

    const accessDocRef = doc(firestore, `users/${userId}/courseAccess`, courseId);

    try {
      if (hasAccess) {
        const dataToSet = { courseId: courseId, grantedAt: new Date() };
        // Use non-blocking write with error handling
        setDoc(accessDocRef, dataToSet)
          .catch((error) => {
             // Revert UI on failure
            setCourseAccess(prev => ({ ...prev, [courseId]: !hasAccess }));
            const permissionError = new FirestorePermissionError({
                path: accessDocRef.path,
                operation: 'create',
                requestResourceData: dataToSet
            });
            errorEmitter.emit('permission-error', permissionError);
          });
      } else {
        // Use non-blocking delete with error handling
        deleteDoc(accessDocRef)
          .catch((error) => {
            // Revert UI on failure
            setCourseAccess(prev => ({ ...prev, [courseId]: !hasAccess }));
            const permissionError = new FirestorePermissionError({
                path: accessDocRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
          });
      }
    } catch (error) {
        // This outer catch is for synchronous errors, though unlikely here.
        console.error("Error changing access:", error);
        toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao alterar o acesso." });
        // Revert UI on failure
        setCourseAccess(prev => ({ ...prev, [courseId]: !hasAccess }));
    }
  };


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
    <div className="container mx-auto px-4 py-8 md:px-8">
      <div className="mb-6 pt-20">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Usuários
          </Link>
        </Button>
      </div>

      <Card className="mb-8">
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
          <CardTitle>Acesso aos Cursos</CardTitle>
          <CardDescription>Conceda ou revogue o acesso do usuário aos cursos da plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {courses.length > 0 ? courses.map(course => (
            <div key={course.id} className="flex items-center justify-between p-4 rounded-lg border bg-secondary/50">
              <div>
                <p className="font-medium text-white">{course.title}</p>
                <p className="text-sm text-muted-foreground">ID: {course.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {courseAccess[course.id] ? 
                    <Check className="h-5 w-5 text-green-500" /> :
                    <X className="h-5 w-5 text-destructive" />
                }
                <Switch
                  checked={courseAccess[course.id] || false}
                  onCheckedChange={(checked) => handleAccessChange(course.id, checked)}
                />
              </div>
            </div>
          )) : (
            <p className="text-muted-foreground text-center py-4">Nenhum curso encontrado na plataforma.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ManageUserPage() {
    return (
        <AdminGuard>
            <ManageUserAccessPage />
        </AdminGuard>
    )
}
